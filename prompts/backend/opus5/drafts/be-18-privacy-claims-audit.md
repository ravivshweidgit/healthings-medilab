# be-18 — Privacy policy claims audit: make every sentence true

**Status:** Part A done (website only, not deployed) · Part B open
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

- [ ] Drop `RECORD_AUDIO` by configuring `expo-image-picker` with `microphonePermission: false`
- [ ] Establish whether `SYSTEM_ALERT_WINDOW` belongs in a release build; remove if it is a dev artifact
- [x] ~~Health Connect `Distance`~~ — **closed, do not touch.** Owner instruction: stay out of the
      calorie path. Not a defect to fix; see the section above before reopening this
- [ ] Decide on retention for `otp_requests`, `refresh_tokens`, `ai_usage_events`, `wallet_ledger`
- [ ] Confirm the VPS is not running `SMTP_MODE=console`
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

## Out of scope

- `#deletion` — be-15 replaces it with a real URL, which is what Play requires
- Localizing anything beyond the existing summary block

## Agent checklist

- [ ] Part A shipped and deployed with the server unchanged
- [ ] Part B raised separately; do not bundle an app build into a policy fix
- [ ] Update `drafts/README.md`
