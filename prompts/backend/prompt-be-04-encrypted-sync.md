# Backend Phase 3 — Encrypted patient data sync (zero-knowledge relay)

**Status: backlog (spec draft 2026-06-29)**  
**Builds on:** `prompt-be-03-account-shares.md` (approved link required) · `done/prompt-be-01-vision.md` § sharing approach.

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
    "dayRange": { "from": "2026-06-01", "to": "2026-06-29" },
    "includes": ["meals", "cgm", "labs", "weight", "rules", "targets"]
  },
  "createdAt": "ISO"
}
```

- **`summary`** — non-PHI hints for mentor list UI (dates, categories present). Patient app generates; optional redaction toggle later.
- **No health values** in summary for MVP (only category flags + date range).

### Plaintext payload (patient device only)

Reuse **backup export subset** (align with `LocalBackupService` / prompt29 keys):

- Profile, targets, rules, food log window (e.g. last 90 days), CGM store, lab reports, Withings weight, coach prefs
- Exclude: auth tokens, API secrets, Gemini keys
- Format: JSON → gzip → encrypt (AES-256-GCM)

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
| Manual **“Share with clinic”** | Full upload now |
| Auto (optional v2) | Nightly if linked + Wi‑Fi + charging |
| On revoke | Stop future uploads; patient may delete blobs |

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

- [ ] Patient with approved link uploads blob
- [ ] Mentor without link gets `403`
- [ ] Mentor downloads, decrypts in clinic portal (be-05), sees meals + CGM charts
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
