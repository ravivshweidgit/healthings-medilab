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
- MACROS — live macros are a derivative of My Rules (yours or the clinic’s). Update rebuilds them from that text. Empty rules → no macros. Water goal has its own editor.
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
- NUTRITIONIST SESSIONS (dashboard): Add session imports a session-summary PDF from a licensed nutritionist (dietitian). The first import is saved and set as active automatically; later tap a session → Set active. Mentors follow the active plan. On conflict the active session wins over My Rules. This is the in-app home for a licensed nutritionist's written program — not the same as AI chat's AI nutritionist tab.

## Optimal loop for a health goal [goal-loop]

When someone asks how to use the app for a goal (lower cholesterol / LDL, lose fat, follow a dietitian, improve labs or glucose), give this **full** loop in three phases. **Never stop after lab import.** Labs without sharing, licensed rules, and a daily execute cycle leave the user with numbers and no program.

The licensed nutritionist writes the plan. The app executes it every day (meals, watch, scale, meters, mentors). About every 3 months you bring new labs, share again, and she corrects the rules. Then the daily cycle restarts.

Help explains **where** and **which tap**. It does not diagnose or prescribe. The in-app **AI nutritionist** tab coaches on her plan — it does not replace her.

### Phase A — Start the program (once, then again every ~90 days)

1. **Import labs.** Scroll the dashboard to **LAB RESULTS** → **Add report**. Pick the lab PDF (HMO / clinic). AI extracts markers; lipid and custom charts appear under that strip. Mentors and your nutritionist can now see LDL, HDL, triglycerides, HbA1c, and the rest.
2. **Share with your licensed nutritionist.** Profile & Settings → **DATA SHARING** → type her clinic email → **Send request**. When the card reads **Sharing with** her name, tap **Share**. That upload is how she sees your labs, meals, scale, watch, and current rules in the clinic portal at healthings.ai/clinic. Do this **before** you expect a program — she cannot set rules on data she does not have.
3. **She sets My Rules.** In the portal she writes the nutrition program. Next time you open the app, Profile & Settings → **RULES** shows that text. Mentors treat it as a hard constraint. You can also **Add rules** / **Edit** yourself, or restore a past version from history. Optional extra: if she emailed a session-summary PDF, dashboard → **NUTRITIONIST SESSIONS** → **Add session** (first import becomes **Active**). The active session wins over My Rules on conflict.
4. **Turn the program into live macros.** Profile & Settings → **MACROS** → **Update**. Same engine as clinic Rules Save. Needs My Rules. Healthings does not invent a diet from your profile.
5. **Connect the body sensors** (Quick Start or Profile & Settings → **GEAR**). Withings scale **Yes** and **Link Withings** — morning weigh-ins land on the body card (weight, muscle, fat, BMR). Withings watch **Yes** — activity kcal, heart rate, workouts. Watch **No** → phone steps via Health Connect / Apple Health. CGM **Yes** if you wear a sensor (see CGM section). Pull the header refresh icon after you weigh or wear the watch.

The program has started only when rules are on the phone and live macros have been built from them. Then live it.

### Phase B — Daily cycle (every day — this is how you execute her plan)

**Morning — body and refresh.** Weigh on the smart scale. Open the app. Tap the header refresh icon. The **body card** (top of the dashboard) shows today's weight / muscle / fat / BMR and the measured time. **TREND & ENERGY** (further down) shows whether weight and energy balance are moving the way her plan expects.

**Wear the watch** (or keep phone-health steps on). Burned calories feed the Food Log energy row so eaten vs burned is honest.

**Log every meal** — dashboard → **FOOD LOG** → **Log Meal**:
- **Photo** — Camera or Gallery. AI names items and grams; a clean result auto-saves (**Saved — check time and items**). Fix anything, then **Done**.
- **Describe it** — type the meal and send.
- **Staples** — foods you saved with **Save staple**.
- **From past meal** — reuse a previous day.
Tap a meal chip to **Edit Meal**. Each item has **Edit** / **Delete**. In **Edit item**, the grams slider: centre = original grams, left = 0 g, right = double; kcal and macros scale. You can change date and time. **Delete meal** removes the whole meal.

**Real-time correction (same meal, before it stands).** After analyze / before or at save, the coach checks the meal against **My Rules** and today's targets. A **Nutritionist alert** can appear (for example calories over target, protein short, a rule conflict). Choose **Edit meal** to fix the plate now, or **Save anyway** if you mean it. That is the in-the-moment correction — do not wait until evening.

**Read the Food Log meters** (same **FOOD LOG** strip — this is your day dashboard):
- **eaten** — kcal you logged.
- **burned** / activity — kcal from the watch or phone steps (and **ACTIVITY LOG** sessions if that strip is on).
- **deficit** or **surplus** — eaten minus burned. Her plan usually wants a direction here; the number tells you if the day is on track.
- Macro bars vs **MACROS** targets: protein, carbs, fat, fiber (Fi), kcal, water. Fill protein and fiber; stay inside her carb / fat / kcal rules. **Add water** for Half glass / Full glass / Big glass / Set amount.
- Day chips at the top of Food Log move yesterday / tomorrow so you can see a missed meal.

**Read the glucose chart** (if CGM is on — strip title **GLUCOSE**; if CGM is off the same strip is **ACTIVITY**). Scroll to it. The live curve is glucose; heart rate, steps, workouts, and **meal marks** sit on the same timeline so you can see what a logged meal did. **History 7 days** / **Full**; pinch / zoom from about 1 hour to 16 days. Use it to navigate the day: if a meal spiked, the next meal is the correction (log it, then ask the mentor — do not invent a new diet in Help). HbA1c still comes from **LAB RESULTS**, not the CGM curve.

**Ask the mentors — this is the daily coaching loop.** Dashboard → **AI chat**. Tabs: **AI doctor**, **AI nutritionist**, **AI coach** (whichever you enabled under Profile & Settings → **MENTORS**). They already see her rules, labs, macros, meals, scale, and glucose. Ask in plain language, every day, for example:
- What went well today?
- What was bad / off-plan?
- How can I improve the next meal / the rest of today?
- Weekly: type **/7** (or **/30**) for a period review; **/macros** on the nutritionist tab if she wants a 7-day macro tweak you confirm.

The coach panel lists **What's going well** and **What to improve** with checkboxes (coach tips). The AI chat subtitle on the dashboard counts how many tips you completed. Turn on **Review after each meal** in **MENTORS** if you want an automatic review after you log (respects the minimum-gap slider).

Photo in chat analyzes a food in the conversation if you are about to eat and want a correction before you log.

### Phase C — Every ~3 months (licensed correction + new labs)

The daily cycle runs until the next clinic visit. Then close the loop:

1. New blood tests from the lab / HMO → **LAB RESULTS** → **Add report** again. Compare lipid / marker charts to the last visit.
2. Profile & Settings → **REPORTS** → tap **90** (or 7 / 14 / 30) to build a visit report. Share the PDF to her if she wants a file as well as the live snapshot.
3. **DATA SHARING** → **Share** again so she has the new labs, 90 days of meals, scale, and watch.
4. She corrects **My Rules** in the portal (or sends a new session PDF → **NUTRITIONIST SESSIONS** → **Set active**).
5. **MACROS** → **Update**. Then go back to Phase B.

That is the optimal rhythm: she sets the program → you execute daily with meters, chart, meal alerts, and mentors → every ~3 months new labs + share + her correction.

## Where each surface lives (quick map) [where]

Use this map whenever a how-to answer needs a location:
- Body / scale numbers — body card, top of dashboard. Link / Re-link Withings on that card or in **GEAR**.
- Meal logging and macro meters — **FOOD LOG** (dashboard).
- Manual workouts — **ACTIVITY LOG** (dashboard; show it with Appearance → Activity log = **Yes**).
- Glucose + HR + steps + meal marks — **GLUCOSE** / **ACTIVITY** chart (dashboard).
- Weight and energy history — **TREND & ENERGY** (dashboard).
- Labs — **LAB RESULTS** (dashboard, near the bottom).
- Licensed session PDFs — **NUTRITIONIST SESSIONS** (dashboard, just above labs).
- My Rules — Profile & Settings → **RULES**.
- Daily macro targets — Profile & Settings → **MACROS**.
- Scale / watch / CGM switches — Profile & Settings → **GEAR**.
- Mentor tabs and meal-review toggle — Profile & Settings → **MENTORS**; chat itself is **AI chat** (dashboard, near the top).
- Share with the licensed clinic — Profile & Settings → **DATA SHARING**.
- 90-day visit PDF — Profile & Settings → **REPORTS**.
- This how-to assistant — **HELP** (dashboard, under AI chat). Ask product questions here; ask “what’s good / what’s bad / how do I improve” in **AI chat**.

## Backup and restore [backup]

Two separate mechanisms:
- App backup (Profile & Settings → App backup): Export shares a JSON file with all app data — meals, activities, favorites, metrics history, CGM, targets, rules, chat, and Withings link. Import merges it back. Works across Android and iPhone.
- Cloud backup (Profile & Settings → Account): Back up now stores a snapshot on the server; Restore from cloud pulls it to a new phone.

## Quick Start wizard [quick-start]

Runs on first launch; reopen anytime from Profile & Settings → Gear → Quick Start again. Steps: language (and App mentor voice), light or dark, your name, welcome cards, units, body (gender, height, birth date), Withings scale Yes/No, watch Yes/No, CGM Yes/No, Link Withings (if scale or watch is Yes), starting weight, phone health permission (if watch is No or CGM is Yes), AI targets, and log your first meal.

## CGM glucose [cgm-manual]

Turn on CGM in Profile & Settings → Gear. Glucose arrives through the phone health store: your CGM app (for example CareSens Air, or xDrip) writes Blood Glucose to Health Connect (Android) or Apple Health (iPhone), and Healthings reads it. Allow the Blood Glucose permission when asked. The dashboard chart strip becomes GLUCOSE with a live curve; meals and workouts are overlaid so you can see responses. CareSens users can also Import CSV history in Gear. Lab PDFs remain the way to track HbA1c.

## Withings devices [withings-manual]

Link once with your Withings account email — the same link covers scale and watch, and reads the Withings cloud (not Bluetooth). Any Withings scale works (Body Comp, Body Smart, Body Scan, and similar). **Body Comp** is our usual recommendation for Healthings — weight, muscle, fat, and BMR on the body card. **Body Scan 2** also works; segmental and ECG extras appear in the Withings app only, not in Healthings. The body card shows sync marks; its menu offers Normal sync (recent days), Deep sync (long history), and Re-link account. The watch supplies activity calories, heart rate, and workouts; with watch No, steps come from the phone health store instead.

## Login and account [login]

Sign-in is by email one-time code — no password. Enter your email, tap Send code, type the code, Verify & continue. Use the same email every time: your data and clinic links belong to that account. Sign out and Delete account are under Profile & Settings → Account.
