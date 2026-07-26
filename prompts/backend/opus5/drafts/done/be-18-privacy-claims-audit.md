# be-18 — Privacy policy claims audit: make every sentence true

**Status:** done — Part A (policy claims) + Part B (drop unused `SYSTEM_ALERT_WINDOW`, retention section on `privacy.html`). Phone-tested and deployed 2026-07-26 (`578146c`). Storage permissions left alone (minSdk 26 still needs them for meal photos).
**Authored by:** Opus 5
**Findings:** 2026-07-26, after be-17 showed the policy had never been diffed against the code
**Depends on:** be-17 (shipped). **Blocks be-15**, which rewrites `#deletion` and adds a patient data page.

> be-17 fixed one paragraph. This is the systematic pass over the rest. Every factual assertion in
> `website/privacy.html` was checked against `server/src`, `app/src`, `schema.sql` and the Android
> manifest. **Nine claims are wrong.** Two of them are affirmative denials of things the product does.

## Method

Each claim was traced to code and verified by reading it, not by searching for reassurance. Where a
subagent reported a finding, the three highest-impact ones were re-verified by hand: the Android
manifest, the server-side Gemini prompt, and the Health Connect record types.

## Findings, worst first

### 1. The policy denies the cloud backup exists

`#on-device` lists "Backups you create in the app" as stored **locally on your phone only**, then
says: *"We do **not** upload this health data to our server."*

The server has `user_cloud_backups` with `payload_gzip BYTEA NOT NULL` **and** `prev_payload_gzip` —
the complete app backup, up to 25 MB, plus the previous copy retained on overwrite. `CloudBackupService.ts`
uploads it and `maybeRunOpportunisticCloudBackup()` re-uploads on its own once enabled. The word
"cloud" appears **nowhere** in the policy.

Mitigating: it is genuinely opt-in behind `CLOUD_BACKUP_OPT_IN_KEY`, so this is a disclosure failure,
not a consent failure. It is still an affirmative denial of a real upload of the full health record.

### 2. "What we collect on our server" omits most of what is collected

The section lists three things: email, account metadata, optional clinic link. The database has
**fourteen tables**. Undisclosed:

| Table | What it holds |
|---|---|
| `payment_methods` | `stripe_customer_id`, `stripe_payment_method_id`, `card_last4`, `card_brand` |
| `wallets`, `wallet_ledger` | Token balance and full transaction history; AI debits reference the patient in `ref_id` |
| `ai_usage_events` | Per-patient AI usage, indefinite, with `reason` codes (`ai_meal`, `ai_lab`, `ai_chat`…) |
| `ai_sponsorships` | Which clinician pays for which patient's AI |
| `clinic_patient_overlays` | Clinic-authored rules **and clinic-side chat threads** — health data, distinct from the patient's own snapshot |
| `clinic_patient_rules_history` | Up to 50 archived rule versions |
| `user_cloud_backups` | See finding 1 |
| `sync_update_requests` | Which clinic asked for a refresh and when |

A policy that says "we collect your email and a clinic link" while holding card metadata and a
per-patient AI usage log is not a small omission.

### 3. Gemini is called from the server too, with patient health data

The policy says health context is sent to Google *"from your device."* It is also sent **from the
server**: `geminiClinic.ts` loads the stored snapshot (`SELECT payload_gzip FROM sync_blobs`), builds
a `PATIENT DATA:` block containing labs, body composition, CGM series, food log, workouts, heart
rate, rules and macro targets, and POSTs it to `generativelanguage.googleapis.com`.

Trigger is a **clinician** using clinic mentor chat — so from the patient's point of view, their
health data goes to Google as a result of someone else's action, which the current wording rules out.

### 4. The permissions list names three of roughly fifteen

Declared in `app/android/app/src/main/AndroidManifest.xml`, verified by reading it:

`INTERNET`, `READ_EXTERNAL_STORAGE`, `WRITE_EXTERNAL_STORAGE`, `RECORD_AUDIO`, `SYSTEM_ALERT_WINDOW`,
`VIBRATE`, and five health permissions — `READ_BLOOD_GLUCOSE`, `READ_STEPS`, `READ_EXERCISE`,
`READ_ACTIVE_CALORIES_BURNED`, `READ_HEART_RATE`. Library merge adds `CAMERA`, `USE_BIOMETRIC`,
`USE_FINGERPRINT`, `ACCESS_NETWORK_STATE`.

Two of these deserve attention beyond disclosure:

- **`RECORD_AUDIO`** is declared but the app only picks still images. It comes from the
  `expo-image-picker` plugin default. Disclosing a microphone permission the product does not use is
  worse than removing it.
- **`SYSTEM_ALERT_WINDOW`** is in the **release** manifest. It reads like a dev-tooling artifact.

### 5. Health Connect is described as blood glucose only

The app requests five record types, confirmed in `HealthConnectService.android.ts`: `BloodGlucose`,
`Steps`, `ExerciseSession`, `ActiveCaloriesBurned`, `HeartRate`. The policy names glucose and calls it
"on-device charts only".

`Distance` is **read in code** (`HealthConnectActivityService.ts`) but is **not declared in the
manifest and not requested**, so the read throws and `fetchDailyDistanceKmTotals` returns an empty
map from its `catch`.

### DO NOT TOUCH THIS — owner instruction, 2026-07-26

**Leave the Distance read exactly as it is.** Do not declare the permission, do not request it, and
do not delete the dead call. This is not a bug to be tidied up.

Why declaring it would be actively harmful: Distance is not an extra signal on top of steps — it
*replaces* step 2 of the estimate in `SamsungStepsAdapter`: `distance_km = steps × stride`, "or use
HC/HK Distance when present". The stride path is the one calibrated against Samsung walking activity
(~43 kcal/km at 80 kg), it is the only path that has ever run in production, and the owner has
**phone-tested it without a Withings watch and confirmed the calories are solid**. Granting the
permission would silently swap a validated input for an untested one on any phone that records
Distance.

Why removing the dead call is also off the table: the owner's instruction is to stay out of the
calorie path entirely. A behaviour-neutral refactor is still a diff in tested code, and the cost of
being wrong here is wrong calorie numbers in a health app. The wasted paged query on each sync is a
price worth paying.

The current permission list in `privacy.html` is already correct on this point — it names glucose,
steps, workouts, heart rate and active calories, and does **not** claim Distance, because Distance
is never actually granted.

### 6. Apple Health is not mentioned at all

`HealthKitService.ios.ts` requests blood glucose, step count, heart rate and active energy. The
policy's permissions and third-parties sections describe Android's Health Connect only. iOS shipped
to TestFlight.

### 7. "on-device charts only" is not true once you share

Health Connect data lands in `metricsStore`, which is part of the clinic snapshot. So HC-derived
steps, workouts and heart rate reach the server whenever the patient shares. Same for the Withings
line: OAuth **tokens** genuinely stay in SecureStore and are excluded from both upload paths on
iOS/Android — that claim holds — but **synced weight and activity data** does travel in the snapshot,
which the sentence "data is stored in the app on your device" denies.

Web is a real exception worth knowing: on `Platform.OS === 'web'` the Withings tokens fall back to
AsyncStorage under `healthings_withings_tokens_web` and are **not** in either exclusion list, so on
web they would be included in an upload. No web build ships today.

### 8. Nothing is ever deleted, and the policy implies otherwise

There is no scheduled cleanup anywhere in `server/src` — no cron, no TTL sweep. Expired
`otp_requests` (which hold an email plus a code hash) are deleted only on **successful** verify, so
every abandoned or failed sign-in attempt persists forever. `refresh_tokens` rows are never deleted,
only marked revoked. `ai_usage_events` and `wallet_ledger` are explicitly retained indefinitely.

### 9. "Account metadata — login timestamps needed to operate auth"

There is no login-timestamp column. `users.updated_at` only moves when the display name changes. The
closest real artifact is `refresh_tokens.created_at`. Minor, but it describes a field that does not
exist while not describing the ones that do.

## Also noted, not policy text

- `email.ts` logs `[OTP] {email} → {code}` in plaintext when `SMTP_MODE=console`, which is the
  `.env.example` default, and again on SMTP send failure. Production uses real SMTP, so this is a
  configuration hazard rather than a live leak — worth confirming the VPS is not on console mode.
- `users.display_name` and `role` are collected and undisclosed. Trivial next to the rest.

## What to change

### Part A — policy text (website only, no build)

- [ ] Lead and Summary: "we do not upload your health data unless you share with a clinic" must
      acknowledge the opt-in cloud backup as a second path
- [ ] `#on-device`: remove backups from the "phone only" list; state plainly that HC and Withings
      data travel in the clinic snapshot when you share
- [ ] New subsection for **cloud backup**: opt-in, full backup plus one previous copy, deleted when
      you turn it off
- [ ] `#server-data`: add payments, wallet and ledger, AI usage metering, sponsorships, clinic
      overlay and rules history, cloud backup, sync requests
- [ ] `#third-parties`: Gemini gains the server-side clinician path; Withings distinguishes tokens
      (stay on device) from synced values (travel in the snapshot); Health Connect lists all five
      record types; add Apple Health
- [ ] `#permissions`: rewrite against the real manifest, grouped by what the user gets for each
- [ ] Retention: say what is kept indefinitely rather than implying it is not
- [ ] Fix the login-timestamp sentence
- [ ] Bump "Last updated"

### Part B — app and server (needs a build and a phone test)

- [x] **Done 2026-07-26.** Dropped `RECORD_AUDIO`. Two places, because the platforms build
      differently: deleted the line from the committed `app/android/app/src/main/AndroidManifest.xml`
      (Gradle builds from it, so the plugin config alone would not have reached Android), and added
      an explicit `expo-image-picker` block to `app.json` for iOS, which has no committed project and
      prebuilds on EAS. Verified on the merged release manifest **and** on the installed package via
      `dumpsys` — 14 permissions down to 13, camera and the five health reads untouched. Apple's
      placeholder usage strings ("Allow $(PRODUCT_NAME) to access your camera") were replaced with
      real ones in the same block. Committed without a phone test at the owner's call; the picker is
      the only plausible regression surface, and reverting the `app.json` block alone would restore
      old behaviour without putting the Android permission back.
- [ ] Establish whether `SYSTEM_ALERT_WINDOW` belongs in a release build; remove if it is a dev artifact
- [x] ~~Health Connect `Distance`~~ — **closed, do not touch.** Owner instruction: stay out of the
      calorie path. Not a defect to fix; see the section above before reopening this
- [x] **Decided 2026-07-26: no retention policy during the alpha.** Owner's call — everything stays
      in the database, no scheduled expiry, no cleanup job. This needs no code change and no policy
      change: `privacy.html` already states plainly that we do not run automatic clean-up and that
      sign-in records, AI usage records and billing history are kept until account deletion. The
      document is accurate *because* it was written after the audit rather than before it. Revisit
      when the product leaves alpha; the policy commits to saying so on the page when that happens.
- [x] **Done 2026-07-26.** VPS is on `SMTP_MODE=smtp`, so codes are not routinely logged. But the
      journal held **one** `[OTP] <address> → <code>` line from 28 June: the SMTP *failure* path
      logged the credential and then **swallowed the error**, so the route still answered
      `{ sent: true }` and the user was told to check an inbox that never received anything.
      Fixed: the failure now logs the address without the code and throws a typed
      `OtpEmailSendError`, which `auth.ts` turns into a 502 with a retry message. The
      `SMTP_MODE=console` dev path still prints codes by design and is now marked in
      `.env.example` as never-for-a-server, since that template is what seeds new deploys.
      Deliberately **not** changed: the `otp_requests` row is inserted before the send, so a failed
      send still consumes rate-limit quota. Fixing that means `RETURNING id` plus a compensating
      delete, which is more surgery than an auth path deserves without a reason.
      Verified by `tmp/be-18-otp-verify/verify.mjs`: drives the **compiled** `email.js` with SMTP
      pointed at a refused port, so nothing is mocked, and asserts the throw, the typed error, the
      absence of the code in captured output, and the 502 mapping — 11/11. The success branch was
      not touched, so a working SMTP path behaves exactly as before.
- [ ] Web Withings token fallback key should join both exclusion lists before any web build ships

Part A makes the document true of the product as it ships today. Part B shrinks what has to be
disclosed, and should be followed by a second, smaller policy edit.

## Part A outcome (2026-07-26, built by Opus 5)

All nine findings above are addressed in the policy text. `website/privacy.html` and the nine
translated summaries in `help-locale-content.mjs` moved together; the JSON island was regenerated.

**No cache-token bump.** No stylesheet changed in this batch, and HTML is served `no-cache` since
be-16, so bumping would have burned `20260726f` for nothing. Token stays `20260726e`.

Two things worth recording:

- **The Hebrew translation was wrong on first pass** and only the rendered screenshot caught it. I
  wrote `בחירות של את/ה`, which is not valid Hebrew — `של` cannot take that pronoun. Corrected to
  `בחירות שאת/ה עושה`. The structural checks all passed while the sentence was ungrammatical, which
  is the limit of automated verification on translated copy.
- **A new `#cloud-backup` section was added**, so the TOC and heading order had to stay in sync.
  `tmp/verify-be18.py` now asserts that, plus that every in-page anchor resolves, that all nine
  locales carry the cloud-backup clause, and that each retired claim is gone by exact string.

Verification: `tmp/verify-be18.py` (33 checks, all passing) and screenshots in `tmp/be-18-review/`
at 390 and 1280, English and Hebrew RTL.

## Part C — the landing page repeated the same denial (2026-07-26)

Found only because the owner asked why `/account/` was not linked from `index.html`. The audit had
scoped itself to `privacy.html` and never looked at the page far more people read.

`#local-first` was worse than the policy had been, because it was a headline:

| Before | Why it was false |
|---|---|
| `<h2>` "Your health data **never leaves your phone**" | It leaves on clinic share and on cloud backup |
| "our server holds your email address so you can sign in — **nothing else**" | Then the next sentence describes sending a snapshot to a clinic — self-contradictory in one paragraph |
| Diagram: red X across the link, "no sync" | Asserts sync is impossible, not off-by-default |
| Diagram: server labelled "Sign-in only / email address" | Omits the snapshot and the full cloud backup |
| Cloud backup | Absent from the page entirely |

Now mirrors the `#lead` wording of the policy almost verbatim, so the two can be diffed by eye:
data lives on the device, nothing reaches the server unless you choose it, named paths are clinic
sharing and cloud backup, neither on by default, ending either deletes what we hold.

**The diagram became a switch in the off position** rather than a severed line. That is the honest
shape of the claim: the connection exists and is off until the user turns it on. The `<desc>` moved
with it, so the accessible description does not contradict the picture.

Checked the rest of the repo for the same sentence — help articles, app copy, clinic pages — and it
appeared nowhere else. The two remaining hits are historical references inside `be-16`'s own draft.

Evidence: `tmp/landing-claim/` at 390 and 1280, light and dark.

### Standing item, both documents

When the app build carrying **My web view** reaches testers, the web view becomes a **third** path
and both `privacy.html` (`#lead`, `#summary`) and `index.html` (`#local-first`) must name it, plus
the exception that the snapshot survives losing the last clinic link while the view is on. Left out
for now deliberately: no distributed build has the toggle, so describing a third path would be its
own inaccuracy and would advertise a `noindex`, unlinked page.

## Out of scope

- `#deletion` — be-15 replaces it with a real URL, which is what Play requires
- Localizing anything beyond the existing summary block

## Agent checklist

- [ ] Part A shipped and deployed with the server unchanged
- [ ] Part B raised separately; do not bundle an app build into a policy fix
- [ ] Update `drafts/README.md`
