# be-24 — The patient's coach chat is not the clinic's to read

**Status:** needs-review  
**Model to implement:** Auto  
**Authored by:** Opus 5  
**Built by:** Auto  
**Date:** 2026-07-26  
**Gate:** be-17 **11/11**, be-19 **33/33**, be-24 **7/7**, `npm run typecheck` clean  
**Depends on:** be-23 (this batch edits the chat tab be-23 made clinician-private)  

> Written after the owner asked why the clinic workspace has a "Mentors & chat" tab at all, and
> whether it should start clean instead of showing the patient's own conversations. It should. The
> suspicion was correct, the behaviour is live, and the disclosure for it does not exist.

## Problem

A linked clinician reads the patient's private conversations with their AI coach. Verified in three
places, and each one is deliberate code rather than an oversight:

**1. The app ships chat in the clinic snapshot.** `buildClinicExport` takes every AsyncStorage key
except a six-item debug list, and `chat_history_*` is not on it. The export goes out of its way to
*keep* chat inside the lookback window:

```ts
// app/src/services/ShareExportService.ts
const cd = chatDayFromKey(key);
if (cd && cd < cutoffDay) continue;
```

With `lookbackMode: 'full'` the patient ships **every conversation they have ever had**, back to 1970.

**2. The portal parses it back out and merges it into the clinician's thread.**
`parseSnapshot` reads `^chat_history_(\d{4}-\d{2}-\d{2})(?:_(doctor|nutritionist|coach))?$` into
`chatFromSnapshot`, keyed by mentor, and then:

```js
// website/clinic/clinic-workspace.js
const thread = mergeChat(ctx.parsed.chatFromSnapshot, ctx.overlay?.chat || {}, activeMentor);
```

**3. The UI labels the patient as an author.** `bubbleHtml` renders `Patient` / `Clinic` / `Mentor`
bylines, so the clinician is reading attributed patient speech, sorted into their own conversation.
Somebody designed that byline for exactly this purpose, which is why it will not correct itself.

### What is not wrong

Worth stating so the fix does not over-reach:

- **The clinician's AI never receives it.** `buildPatientContextBlock` in `geminiClinic.ts` assembles
  a curated key list, and nothing in `server/src` references `chat_history` at all. This is a
  display-only exposure; no coach transcript has gone into a clinic-side model prompt.
- **be-23's store is honest.** `clinic_clinician_chats` holds only clinician-written chat. The
  privacy line "written by your clinic, not copied from your phone" is true *of the table*. The
  merge happens in the browser, at render time.

### The consent gap is the sharpest part

The summary the patient approves is built by `detectIncludes()`, which reports `meals`, `cgm`,
`labs`, `metrics`, `targets`, `rules`, `directives`, `water`. **Chat is not in that list and never
was.** So the payload carries a category the consent summary does not name, and `privacy.html`
`#clinic-sharing` says only "a copy of your current snapshot" without enumerating it. By be-18's
standard — the policy may not claim more than the code does — this is the inverse failure and the
worse one: the code takes more than the policy admits.

### Why it is wrong on product grounds too

The owner's instinct ("I don't see value, and I think it's even problematic") holds up twice over:

- **It poisons the coach.** The coach's clinical value depends on patients being candid about
  binges, alcohol, mood and non-adherence. Once patients grasp that a clinician reads those threads,
  they write for the clinician instead. We would be degrading the core product to feed a feature
  with no demonstrated use.
- **It manufactures a duty to read.** A patient telling the coach about chest pain, sitting unread
  in a clinician's tab, is exposure we created by putting it there. Surveillance implies review.

The legitimate need behind it — *what did the patient actually tell the coach?* — is served by the
patient choosing to send it, which is the clinic↔patient messaging batch be-23 already defers to.
Not by silent copying.

## Decisions (owner, 2026-07-26)

| Question | Decision |
|---|---|
| Should the clinic see patient coach chat? | **No.** Never, not read-only, not visually separated |
| What does the tab become? | **Clinic-only thread, renamed "Clinic chat"** — clinician-private, starts clean |
| Where do we stop it? | **All three layers** — app export, portal render, and a server-side strip |
| Policy | Say plainly that coach conversations are never shared with a clinic |

## Scope

| File | Change |
|---|---|
| `app/src/services/ShareExportService.ts` | Exclude `chat_history_*` from the clinic export |
| `website/clinic/clinic-workspace.js` | Drop `chatFromSnapshot` entirely; rename the tab |
| `server/src/services/sync.ts` | Strip `chat_history_*` on upload, before hashing and storing |
| `website/privacy.html` | Disclose the exclusion |
| `server/verify/be-24-chat-strip.mjs` | New harness, added to `npm run verify` |

**Do not touch:** `app/src/services/LocalBackupService.ts`, `app/src/services/CloudBackupService.ts`,
`app/src/logic/backupFingerprint.ts`. Those are the patient's own restore paths and **must keep
carrying chat** — see *Must not regress*. Also off-limits: `clinic_clinician_chats` and anything else
be-23 built, the app's calorie path, and be-22's territory.

## Design

### Layer 1 — the app stops sending it

`isChatHistoryKey` already exists in `ShareExportService.ts` and is the predicate to use. Filter it
out where `exportKeys` is built, alongside `EXCLUDED_ASYNC_KEYS`:

```ts
const exportKeys = allKeys.filter((k) => !EXCLUDED_ASYNC_KEYS.has(k) && !isChatHistoryKey(k));
```

A `Set` cannot express a pattern, so do not try to fold it into `EXCLUDED_ASYNC_KEYS`. Leave
`chatDayFromKey` in place — `dayRangeFromKeys` still uses it, and after this change the reported day
range narrows to food days only, which is correct rather than a regression.

`detectIncludes()` needs **no change**: it never claimed chat. Assert that it still does not.

### Layer 2 — the portal stops rendering it

This is the layer that ends the exposure for data already on the server, so it is not optional even
though layer 3 overlaps it.

- Delete `chatFromSnapshot` from `parseSnapshot` — the accumulator, the `cm` regex branch, and the
  key in the returned object. It has exactly one consumer, so this is contained.
- `mergeChat` loses its reason to exist. The thread becomes `ctx.overlay?.chat?.[activeMentor] || []`,
  which is already sorted and already deduped by the server. Delete `mergeChat` rather than leaving
  it to be re-wired by someone later.
- `bubbleHtml`: `fromSnapshot` can no longer occur. Keep the `Clinic` / `Mentor` bylines; the
  `Patient` byline is now unreachable and should be removed, not left as documentation of an
  intention we reversed.
- Tab label `'Mentors & chat'` → `'Clinic chat'`. The mentor picker **stays** — it still selects
  which AI persona the clinician is talking to, which is a different axis from whose chat it is.
- The tab's subtitle currently reads "Chat with the patient's AI mentors using snapshot data."
  Rewrite so it cannot be misread as access to the patient's threads, and say the chat is private to
  this clinician (true since be-23, and currently unstated): something like *"Your private chat about
  this case, using the shared snapshot. The patient's own coach conversations are not shared with the
  clinic."* Stating the boundary in the product is worth more than stating it only in the policy.
- The empty state is now the normal first view for every patient. "No messages yet — ask about
  meals, glucose, or goals." already reads correctly for a clean start; confirm it does not look
  broken.

### Layer 3 — the server strips it on upload

**This layer is the reason the batch is not just an app fix.** Patients on already-installed builds
keep uploading chat for as long as they do not update, and we cannot force an update. Without the
strip, layer 1 protects only patients who upgrade.

`uploadSyncBlob` already decompresses the payload for
`reconcileOverlayRulesFromPatientSnapshot`, so the machinery is present:

1. Inflate with the existing tolerant `decompressSyncPayload`.
2. Delete every key matching `^chat_history_\d{4}-\d{2}-\d{2}(?:_(doctor|nutritionist|coach))?$`.
3. If nothing matched, **store the original buffer untouched** — do not re-compress for nothing and
   change the hash of an unmodified payload.
4. If something matched, re-serialise, `deflateSync`, and use that buffer for `byte_size`,
   `payload_hash` and `payload_gzip`. The client compresses with pako `deflate` (zlib-wrapped) and
   the browser reads it with pako `inflate`, so `deflateSync` output is the same format both ends
   already handle — **verify this end to end in the browser, not by reasoning about it**.
5. Keep the 15 MB limit check on the **received** buffer, before inflating.

Two things to get right:

- **Order.** Strip before `payloadHash` is computed, or the stored hash describes bytes that are not
  stored. `reconcileOverlayRulesFromPatientSnapshot` only reads `user_rules` and is unaffected either
  way, but run it on the stripped buffer for consistency.
- **Inflate-bomb cap.** Making decompression mandatory in the write path widens an exposure that
  already exists on the read path. Cap the inflated size (64 MB is generous for a 15 MB deflate) and
  reject rather than strip if it blows the cap. A malformed or hostile payload must fail the upload,
  not be stored unstripped.

This also purges the at-rest copies: snapshots are replace-on-share with only the latest kept, so
every patient's stored chat disappears at their next share. Note in the batch record that until each
patient shares once, their **existing** blob still contains chat at rest — invisible to the portal
after layer 2, but present. Do not write a migration to rewrite stored blobs; the natural refresh is
sufficient and rewriting patient payloads server-side is a worse precedent than waiting.

### Layer 4 — the policy says so

`privacy.html`, `#clinic-sharing`: state that the snapshot carries meals, glucose, labs, body
metrics, targets, rules and directives, and that **conversations with the AI coach are not included**.
Put it as a positive commitment, not a footnote — it is a promise patients would want and would
otherwise assume the other way. Keep the existing workspace bullet's "written by your clinic, not
copied from your phone", which becomes unambiguously true at every layer instead of only in the store.

Check `#local-first` and `#server-data` for any wording that implied the full snapshot went up, and
the Hebrew/other locale JSON block at the foot of the file if the changed sentences are translated
there.

## Must not regress

**The persistence-parity rule is the trap in this batch.** Chat must keep round-tripping through
local backup and cloud backup, or a patient loses their history on a phone switch. The exclusion
belongs **only** in the clinic export path.

| Path | Chat included? |
|---|---|
| `buildClinicExport` → `sync_blobs` | **No** (this batch) |
| `LocalBackupService` | **Yes** — unchanged |
| `CloudBackupService` | **Yes** — unchanged |
| App-side coach history on the phone | **Yes** — unchanged, never touched |

Both backup services have their own `isChatKey` copies at roughly `LocalBackupService.ts:49` and via
`backupFingerprint.ts:19`. Leaving them alone is the requirement, not an oversight — do not
"consolidate" the three predicates into one shared helper in this batch. They express three different
policies that merely happen to share a regex today, and merging them is how a future edit silently
strips chat from a patient's backup.

Also verify:

- `/account/` still renders. It shows the patient exactly what a clinic would see, so it must not
  break when chat is absent, and it will now honestly show less.
- be-23's harnesses stay green: `npm run verify` (be-17 **11/11**, be-19 **33/33**).
- The clinician chat still works end to end — send a message, get a reply, reload, thread persists
  from `clinic_clinician_chats`.

## New harness — `server/verify/be-24-chat-strip.mjs`

Follow the house pattern in `server/verify/README.md`: copy the SQL/logic under test from source and
`assertInSource()` so a later edit to `sync.ts` fails the run instead of passing against a stale copy.

Cases:

- [x] A payload containing `chat_history_2026-07-01_nutritionist` stores with **no** chat key
- [x] Mentor-suffixed and bare (`chat_history_2026-07-01`) legacy keys are both stripped
- [x] `food_log_*`, `user_rules`, `lab_report_*` and `healthings:metricsStore` **survive** the strip
- [x] `payload_hash` and `byte_size` match the **stored** bytes, not the received ones
- [x] A payload with no chat keys is stored byte-identical to what arrived
- [x] A key that merely looks similar (`chat_history_backup`, `chat_history_2026-7-1`) is left alone
- [x] Add `assertNotInSource` for a re-introduced chat parse in `clinic-workspace.js`, mirroring how
      be-23 pinned the rules-history delete

## Acceptance criteria

- [x] A clinician opening a patient workspace sees an **empty** chat thread on first visit
- [x] No patient-authored message can appear in the clinic thread by any route
- [x] The tab reads "Clinic chat" and states that coach conversations are not shared
- [x] `chatFromSnapshot` and `mergeChat` no longer exist in `clinic-workspace.js`
- [x] A snapshot uploaded by an **old app build** carrying chat is stored stripped
- [x] An oversized inflated payload is rejected, not stored unstripped
- [x] Local and cloud backup still carry chat; a backup round-trip restores coach history
- [x] `privacy.html` states the exclusion in `#clinic-sharing`
- [x] `npm run verify` green including the new harness; `npm run typecheck` clean; app builds

## Evidence

- `npm run verify` — be-17 11/11, be-19 33/33, be-24 7/7 (strip + portal pins + inflate-bomb)
- `npm run typecheck` clean
- LocalBackupService / CloudBackupService untouched (their own `isChatKey` predicates intact)
- Not committed / not deployed

## Agent checklist

- [x] Status → in_progress
- [x] Changes match this batch only
- [x] Acceptance criteria above
- [x] Status → `needs-review` with evidence attached; do **not** self-accept
- [x] Update `prompts/backend/README.md` open-batch table
- [x] Do not commit or deploy — both human-owned

## Out of scope

- Clinic↔patient messaging; per-thread opt-in share; portal layout (panel / be-22); rewriting already-stored blobs.

## Review by Opus 5

**Evidence:** verify transcript above; confirm LocalBackupService chat predicate untouched; clinician tab empty + subtitle states the boundary.

**Judgment calls:** deflateSync round-trip for `/account/` + portal inflate; no unification of the three `isChatKey`s; empty tab reads as intent not a bug; policy does not under-claim the rest of the snapshot.

## Related

- be-23 — made clinic chat clinician-private in the store; this batch makes the *view* match
- be-18 — the standard that the policy may not claim more than the code does; this is its inverse
- be-17 — the purge that already deletes clinic workspace data on revoke
