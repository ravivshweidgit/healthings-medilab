# Healthings app manual (Help AI knowledge)

English-only source of truth for the in-app Help assistant. Answers are translated
to the user's App & coach language at question time. Keep exact UI labels in
**bold**. Regenerate the bundled KB after editing:
`node app/scripts/gen-app-help-knowledge.mjs`.

## Dashboard tour [dashboard]

The dashboard is one scrolling screen of collapsible strips, top to bottom:

1. Brand header HEALTHINGS.AI — the refresh icon pulls new data (Withings, phone health, CGM).
2. AI chat — opens mentor chat (AI doctor / AI nutritionist / AI coach). Subtitle shows coach tips progress.
3. HELP — this product Q&A card, plus links to website help topics and Watch explainer videos.
4. Body card — weight, muscle, fat, BMR with the measured time. Shows Withings sync marks, or manual-entry provenance when the scale is off. Link / Re-link Withings from here.
5. FOOD LOG — day navigation, calories eaten vs burned, deficit or surplus, meal chips, water, and macro progress vs targets. Buttons: Log Meal, Add water, edit meals, Import.
6. ACTIVITY LOG — manual and wearable activity sessions with a day total (shown when Appearance → Activity log = Yes).
7. GLUCOSE (or ACTIVITY when CGM is off) — chart with glucose, heart rate, steps, workouts, and meal marks. History 7 days / Full; zoom from 1 hour to 16 days.
8. TREND & ENERGY — weight and body-composition trend plus energy (BMR / burn / eaten / balance) history over selectable periods.
9. PROFILE & SETTINGS — all settings, nested (see below).
10. NUTRITIONIST SESSIONS — session PDF archive; the active plan feeds the mentors.
11. LAB RESULTS — lab PDF archive with lipid and custom marker trends.
12. Footer — Refresh my data.

New users may also see a What's next card (Log meal / Add activity), a meal nudge, and a one-time You're set celebration after Quick Start.

## Profile & Settings [profile-settings]

Tap PROFILE & SETTINGS to expand nested strips. Each opens in place:

- PROFILE — first/last name, gender (Male / Female / Other), height, birth date; age is computed. When the Withings scale is off, a Body section adds manual weight, fat, muscle, and BMR. Tap Save to persist everything.
- LANGUAGE — App & coach language. One choice drives dashboard text, coach chat, meal names, reports, Help answers, and website help links. Changes apply immediately.
- UNITS — display-only choices: Glucose mg/dL or mmol/L; Weight kg or lb; Height cm or ft'in"; Water ml or fl oz; Energy kcal or kJ. Storage stays in clinical units.
- APPEARANCE — Theme: System / Light / Dark. Activity log on dashboard: Yes / No.
- GEAR — device sources: Withings scale Yes/No, Withings watch Yes/No, CGM Yes/No. Link Withings / Re-link Withings appears when needed. When the watch is No, a Phone health section handles Health Connect (Android) or Apple Health (iOS). CareSens CSV Import appears when CGM is Yes. Quick Start again reopens the setup wizard.
- TARGETS — body targets. Set / edit targets manually or Suggest with AI (needs profile and a weight), then Accept or Edit.
- MENTORS — choose AI advisors (AI doctor, AI nutritionist, AI coach — at least one). App mentor Man / Woman sets how the mentor speaks in gendered languages (Hebrew, Arabic). Review after each meal toggle and a minimum-gap slider (0–6h) control automatic meal reviews.
- RULES — My Rules free text (Add rules / Edit). The mentors treat these as hard constraints. Past versions can be viewed and restored.
- MACROS — daily macro targets (protein, fat, carbs, fiber, kcal, water). Ask AI to set my macros, then Accept or Edit; Re-analyze with AI refreshes them. Water goal has its own editor.
- ACCOUNT — signed-in email, biometric unlock, Cloud backup (Back up now / Restore from cloud), My web view snapshot, Share app log (today), Sign out, Delete account.
- DATA SHARING — clinic sharing (see the dedicated section below).
- REPORTS — Visit report generation (see Reports below).
- APP BACKUP — local Export / Import of all app data (see Backup below).

## Sharing data with a clinic [clinic-share]

Path: Profile & Settings → Data sharing.

To link a clinic:
1. Under Add a clinic, type the clinic's email address (ask your clinic which email they use) and tap Send request.
2. The request shows as Waiting for approval until the clinic approves it in their portal at healthings.ai/clinic.
3. Once approved, the card reads Sharing with and the clinic name. Tap Share to upload a snapshot now.
4. After you tap Share, the clinic can collect the snapshot from the server even if you close the app. Opening the app also auto-uploads when the clinic has requested an update.

Also on this screen:
- Last shared shows the time and version of the last upload; before any upload it says nothing was uploaded yet.
- A clinic can also invite you first — an invitation card appears with Approve and Decline.
- Stop sharing removes a clinic from your list (with a confirmation). You can re-request later.
- AI credits: chat and AI features spend credits. If a clinic sponsors you, a green AI sponsored by … until … line shows who pays and until when. Without a sponsor, Add AI credits adds a token pack.
- Sharing is optional — the app works fully without it. Only clinics you approved can see your data, and only after you share or they request an update.

What the clinic sees: your meals, activity, metrics history, targets, rules, labs, and reports in their clinic portal — enough to guide your nutrition between visits.

## Food Log and meal logging [food-log]

Open FOOD LOG on the dashboard, then Log Meal. Four ways to log:

1. Photo — Camera or Gallery. AI identifies items with grams and macros; a clean result auto-saves (a banner says Saved — check time and items). Adjust anything, then Done.
2. Describe it — type the meal (for example "protein shake") and send. AI parses items and macros.
3. Staples — one-tap chips for foods you saved with Save staple.
4. From past meal — browse previous days and reuse a meal as new.

Editing: tap a meal chip to open Edit Meal. Each item has Edit / Delete. In Edit item, the grams field has a slider — center is the original grams, left is 0 g, right is double; kcal and macros scale with grams. You can also update a meal with a new photo (Approve update). Meal date and time can be changed. Delete meal removes it.

The coach checks each meal against My Rules and daily targets and flags conflicts before saving (Edit meal / Save anyway).

Water: Add water offers Half glass, Full glass, Big glass, Set amount, Set total, and Edit goal.

The strip shows calories eaten, activity burn, and the day's deficit or surplus, plus macro progress against your targets. Import at the strip footer restores a food-log JSON export.

## Activity Log [activity-log]

Open ACTIVITY LOG → Add activity. Fields: Name, Minutes (with a slider that scales calories), optional youtube link, optional Load kg (equipment weight). AI calc estimates calories from the YouTube video or the description using your body weight. Save as favorite adds a one-tap chip for next time; From past activity reuses an old session. Wearable sessions (Watch) appear alongside manual ones with a day total.

If the Withings watch is off, daily activity calories come from phone steps (Health Connect on Android, Apple Health on iOS) — pull-to-refresh reloads today's steps.

## AI chat, mentors, and slash commands [ai-chat]

AI chat opens mentor chat with tabs for the advisors you enabled in Profile & Settings → Mentors: AI doctor (health and safety), AI nutritionist (food, macros, recipes), AI coach (habits and motivation). Mentors see your data — meals, metrics, labs, rules, targets — and coach on it. This is different from Help, which explains how to use the app.

Chat tools: Send, Photo (analyze a food photo in chat), FAQ (custom quick questions, up to 5 per language), Refresh, Clear, Export.

Slash commands:
- /1 … /128 — period review of the last N days (for example /7 weekly, /30 monthly). /yesterday reviews yesterday only.
- /macros — nutritionist tab: proposes a 7-day macro revision you can confirm.
- /eat <what you have> — nutritionist: eat-now recipe suggestion.
- /recipe <idea> — nutritionist: recipe card.

You can also just ask in plain language — "How am I doing today", "Weekly summary", glucose questions, and meal reviews are understood.

Coach tips: the coach panel lists What's going well and What to improve with action-item checkboxes; the dashboard AI chat subtitle tracks how many tips you completed.

## Reports, labs, and nutritionist sessions [reports]

- Visit report (Profile & Settings → Reports): tap 7 / 14 / 30 / 90 days to build a PDF-style report — clinical summary plus a full data appendix (charts, and full CGM detail for 7-day reports). It opens the share sheet, so you can send it to your clinic or nutritionist before a visit.
- LAB RESULTS (dashboard): Add report imports a lab PDF (for example from your HMO). AI extracts markers; lipid trends and custom marker trends appear as charts. Mentors use lab values (for example LDL, HbA1c) in their guidance. Export / Import moves the archive between phones.
- NUTRITIONIST SESSIONS (dashboard): Add session imports a session-summary PDF from your nutritionist. Set active makes that plan the one your mentors follow.

## Backup and restore [backup]

Two separate mechanisms:
- App backup (Profile & Settings → App backup): Export shares a JSON file with all app data — meals, activities, favorites, metrics history, CGM, targets, rules, chat, and Withings link. Import merges it back. Works across Android and iPhone.
- Cloud backup (Profile & Settings → Account): Back up now stores a snapshot on the server; Restore from cloud pulls it to a new phone.

## Quick Start wizard [quick-start]

Runs on first launch; reopen anytime from Profile & Settings → Gear → Quick Start again. Steps: language (and App mentor voice), light or dark, your name, welcome cards, units, body (gender, height, birth date), Withings scale Yes/No, watch Yes/No, CGM Yes/No, Link Withings (if scale or watch is Yes), starting weight, phone health permission (if watch is No or CGM is Yes), AI targets, and log your first meal.

## CGM glucose [cgm-manual]

Turn on CGM in Profile & Settings → Gear. Glucose arrives through the phone health store: your CGM app (for example CareSens Air, or xDrip) writes Blood Glucose to Health Connect (Android) or Apple Health (iPhone), and Healthings reads it. Allow the Blood Glucose permission when asked. The dashboard chart strip becomes GLUCOSE with a live curve; meals and workouts are overlaid so you can see responses. CareSens users can also Import CSV history in Gear. Lab PDFs remain the way to track HbA1c.

## Withings devices [withings-manual]

Link once with your Withings account email — the same link covers scale and watch, and reads the Withings cloud (not Bluetooth). Any Withings scale works (Body, Body Scan, and similar). The body card shows sync marks; its menu offers Normal sync (recent days), Deep sync (long history), and Re-link account. The watch supplies activity calories, heart rate, and workouts; with watch No, steps come from the phone health store instead.

## Login and account [login]

Sign-in is by email one-time code — no password. Enter your email, tap Send code, type the code, Verify & continue. Use the same email every time: your data and clinic links belong to that account. Sign out and Delete account are under Profile & Settings → Account.
