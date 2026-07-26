# Backend Phase 3 — Encrypted patient data sync (zero-knowledge relay)

**Status: done** — shipped; header corrected 2026-07-26 (the "backlog" label was stale for weeks).
Live artifacts: `sync_blobs` in `server/src/db/schema.sql`, `server/src/routes/sync.ts`,
`server/src/services/sync.ts`. The clinic snapshot path this spec describes is what `be-15`
(clinician AI) and `be-17` (snapshot purge on unshare) were later built on top of.  
**Builds on:** `prompt-be-03-account-shares.md` (approved link required) · `done/prompt-be-01-vision.md` § sharing approach.

---

## Product decisions (locked 2026-07)

| Decision | Rule |
|----------|------|
| **Payload shape** | Encrypted **image of phone persistence** — same JSON subset as `LocalBackupService` / App Backup (`asyncStorage` keys + structured stores). Not live phone access. |
| **Default window** | **Last 90 days** of time-series data (meals, CGM, labs, Withings intraday). Aligns with visit report window. |
| **Extended window** | Patient may choose **full history on phone** (e.g. clinic wants 5 years). No server-side cap on window — patient controls what leaves the device. |
| **Clinic visibility** | **Once shared, clinic can view all data in that snapshot** — full read-only dashboard (meals, CGM, labs, weight/Withings, rules, targets). No per-field ACL in MVP (all-or-nothing per upload). |
| **Updates** | New phone data requires a **new share** (immutable blob versions). Clinic always uses **latest** blob unless viewing history. |
| **Compression** | **gzip** JSON before encrypt (~90% smaller; ~2.5 MB raw → ~240 KB for ~2 mo). **Do not** base64 the raw JSON (base64 grows ~33%). Base64 only if API carries ciphertext in JSON body (encode **gzip+ciphertext**, not plaintext). |
| **Phone longevity** | Uncapped CGM on device may grow large over years (AsyncStorage / chart perf). **Out of scope for be-04** — separate app prompt for CGM retention/rollup. Export of “full history” still allowed when patient chooses it. |

**Size guidance (from real backup `healthings-backup_2026-07-02-good.json`, gzip):**

| Export window | ~JSON | ~gzip upload |
|---------------|-------|----------------|
| 90 days (default, steady state) | ~2.8 MB | **~280 KB** |
| 1 year | ~3.3 MB | ~320 KB |
| 2 years | ~5.4 MB | ~530 KB |
| 5 years (full CGM history) | ~12 MB | ~1.2 MB |

Dominant size: **CGM minute points** + **Withings intraday** (Withings already trimmed to 60 days on phone). Meals are small.

---

## Problem

Patients keep health data **on device** (local-first). A linked clinic/mentor cannot see meals, CGM, labs, or weight until the patient **chooses to share**. We need async, encrypted upload so:

- Server stores **ciphertext only** (zero-knowledge claim)
- Only **approved** mentors for that patient can download + decrypt
- Works when patient is offline after upload (store-and-forward, not live phone access)

This is **not** “clinic reads the phone live.” It is **git-push**: patient publishes an encrypted snapshot; clinic pulls the latest.

---

## What ships (this prompt only)

### Data model

| Entity | Purpose |
|--------|---------|
| **`sync_blobs`** | One row per uploaded ciphertext (immutable versions) |
| **`sync_blob_keys`** | Per-mentor wrapped DEK (data encryption key) — server never holds plaintext DEK |

### Blob metadata (server-visible)

```json
{
  "id": "uuid",
  "patientId": "uuid",
  "version": 3,
  "byteSize": 842000,
  "contentType": "application/octet-stream",
  "payloadHash": "sha256-hex",
  "summary": {
    "generatedAt": "ISO",
    "lookbackDays": 90,
    "lookbackMode": "90d",
    "dayRange": { "from": "2026-06-01", "to": "2026-06-29" },
    "includes": ["meals", "cgm", "labs", "weight", "withings", "rules", "targets"]
  },
  "createdAt": "ISO"
}
```

- **`summary`** — non-PHI hints for mentor list UI (dates, categories present, `lookbackDays` / `lookbackMode`: `"90d"` | `"full"`). Patient app generates; optional redaction toggle later.
- **No health values** in summary for MVP (only category flags + date range).
- Clinic portal (be-05) shows: *“Shared: 90 days”* or *“Shared: full history”* from `lookbackMode` + `dayRange`.

### Plaintext payload (patient device only)

Reuse **backup export subset** (align with `LocalBackupService` / prompt29 keys):

- Profile, targets, rules, food log, CGM store, lab reports, Withings store (`healthings:withingsStore`), coach prefs
- **Time filter:** default **last 90 calendar days** for dated series; `lookbackMode: "full"` exports all keys on device (patient choice at share time)
- Exclude: auth tokens, Withings OAuth tokens, API secrets, Gemini keys, debug keys (`EXCLUDED_ASYNC_KEYS` in `LocalBackupService`)
- Format on device: build JSON → **gzip** → encrypt (AES-256-GCM) → upload ciphertext

### Encryption (MVP)

1. Patient app generates random **DEK** (256-bit) per upload.
2. Encrypt gzip(JSON) with DEK → **ciphertext** uploaded to server.
3. For each **approved** mentor share (`account_shares.status = approved`):
   - Wrap DEK for mentor using **mentor public key** (X25519 + sealed box, libsodium-style) OR
   - **Alpha shortcut:** derive wrap key from `(shareId + server secret)` — document as **non–zero-knowledge alpha**; replace with true E2E before public claim.
4. Server stores ciphertext + wrapped DEKs; **never** plaintext DEK or health JSON.

> **Alpha decision:** start with server-side wrap for speed; migrate to client-side sealed box in follow-up. Mark in privacy policy until true E2E ships.

### Endpoints

| Endpoint | Method | Auth | Role | Body | Response |
|----------|--------|------|------|------|----------|
| `/v1/sync/upload` | POST | Bearer | **patient** | multipart or `{ ciphertextBase64, summary, wrappedKeys[] }` | `{ blob }` |
| `/v1/sync/latest` | GET | Bearer | **mentor** | `?patientId=` | `{ blob, wrappedKeyForMe }` or `404` |
| `/v1/sync/history` | GET | Bearer | patient or mentor | `?patientId=` `?limit=` | `{ blobs[] }` metadata only |
| `/v1/sync/:id/download` | GET | Bearer | **mentor** | — | ciphertext stream |
| `/v1/sync/:id` | DELETE | Bearer | **patient** | — | `{ ok }` revoke blob |

**Access rules:**

- Upload: patient must be authenticated; increments `version` per patient.
- Download: mentor must have **`approved`** share with that `patient_id`; else `403`.
- Patient can delete own blobs (GDPR / revoke share cleanup).

### Upload triggers (app — see `prompt49.txt`)

| Trigger | Behaviour |
|---------|-----------|
| Manual **“Share with clinic”** | Build export (default **90d**; optional **Full history** in confirm dialog) → gzip → encrypt → upload |
| After upload | **All approved linked clinics** may download and view **entire** decrypted snapshot (be-05). Not partial fields. |
| Auto (optional v2) | Nightly if linked + Wi‑Fi + charging |
| On revoke | Stop future uploads; patient may delete blobs |

**Share export API (app):**

```ts
buildClinicExport({ lookbackMode: '90d' | 'full' })  // default '90d'
```

### Storage

- **MVP:** filesystem on VPS `/var/healthings/blobs/{patientId}/{version}.bin` or PostgreSQL `BYTEA` if &lt; 5 MB typical
- **Later:** S3-compatible object store
- Retain last **N** versions per patient (default **5**); prune oldest on upload

---

## Primary files

| Path | Purpose |
|------|---------|
| `server/src/db/schema.sql` | `sync_blobs`, `sync_blob_keys` |
| `server/src/routes/sync.ts` | upload/download/list |
| `server/src/services/sync.ts` | access checks via `account_shares` |
| `server/src/services/blobStorage.ts` | read/write ciphertext |
| `app/src/services/ShareExportService.ts` | build export JSON, encrypt, upload (prompt49) |

---

## Phone-tested checklist

- [ ] Patient with approved link uploads blob (default 90d)
- [ ] Patient can upload `lookbackMode: full` (larger blob; gzip still &lt; ~2 MB typical at 5y)
- [ ] Mentor without link gets `403`
- [ ] Mentor downloads, decrypts in clinic portal (be-05), sees **all sections** in snapshot (meals + CGM + labs + Withings)
- [ ] Clinic UI shows lookback label (90d vs full history) from blob `summary`
- [ ] Patient revoke share → mentor loses download on next request
- [ ] Server DB/files contain no plaintext health JSON

---

## Deferred

- True E2E (client-only DEK wrap, server blind to keys)
- Incremental/delta sync (full snapshot MVP only)
- WebSocket nudge “new data available” → `rt.healthings.ai`
- Blob encryption at rest (disk-level OK for alpha)

---

## Related

- **`prompt-be-03-account-shares.md`** — link gate
- **`prompt-be-05-clinic-dashboard.md`** — mentor decrypt + charts UI
- **`prompt49.txt`** — app share UX + upload
- **`done/prompt-be-01-vision.md`** — store-and-forward rationale
