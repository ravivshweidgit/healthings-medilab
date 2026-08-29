# be-58 — Trainer Programs, Workout Templates & Activity Macros

Status: needs-review
Date: 2026-08-29
Builds on: be-57 (Clinic Capabilities & Personas), be-56 (Modern Clinic UI), prompt80 (Hybrid Energy Burn)
Primary files:
- `server/src/db/schema.sql` (`training_programs`, `training_assignments`)
- `server/src/services/trainingPrograms.ts` (Training program & assignment service logic)
- `server/src/routes/training.ts` (Trainer template & program CRUD, patient assignment endpoints)
- `server/src/index.ts` (Route registration)
- `website/clinic/clinic-workspace.js` (Training tab & Weekly Split view editor)
- `website/clinic/clinic-workspace.css` (Training split & macro cards styling)
- `website/clinic/index.html` (Training Program Templates manager view)
- `website/clinic/clinic-i18n.js` (10-language translations for training programs & activity macros)
- `app/src/services/TrainingDirectiveService.ts` (App-side training plan loader & parser)
- `app/src/services/ClinicOverlayService.ts` (Auto-pull active training program on sync)
- `app/src/components/ActivityLogStrip.tsx` (Activity Macros & prescribed session checklist)
- `app/src/i18n/activityLogUiCopy.ts` (10-language prescription copy)

---

## 0. Amendment 2026-08-29 — multi-activity days

The first cut allowed **one workout per day**, which does not describe a real day. The owner's
routine is four discrete blocks — morning ride, midday walk, evening ride, evening walk — before
Ilya adds a targeted gym session on top. Collapsing those into a single 175-minute card is neither
plannable nor matchable against a watch, which records each block as its own session.

A day now carries an **array of sessions**:

```ts
interface PrescribedActivitySession {
  id: string;
  timeSlot: 'morning' | 'noon' | 'evening' | 'anytime';
  workoutType: 'strength' | 'cardio' | 'hiit' | 'mobility' | 'rest';
  title: string;
  durationMinutes: number;
  targetKcal: number;
  targetZone2Minutes?: number;
  notes?: string;
  /** Which recorded session ticks this off without a manual tap. */
  matchType?: 'bike' | 'walk' | 'run' | 'gym' | 'any';
}
```

| Change | Where |
|---|---|
| `activities[]` per day, `dayFocus` replaces the day-level `title` | `trainingPrograms.ts`, `training.ts` |
| `normalizeSchedule()` lifts legacy single-workout days into a one-element list on read | `trainingPrograms.ts` |
| Add / remove session per day, time-slot + auto-match pickers, live day totals | `clinic-workspace.js` |
| "Fill weekly targets from schedule" sums the week into the four activity macros | `clinic-workspace.js` |
| Session caps raised — a multi-activity week has ~30 sessions, not 4 | `training.ts` (`max(60)`, Z2 `max(2000)`) |
| Greedy one-to-one match of watch/manual sessions to prescriptions | `ActivityLogStrip.tsx` |

**No migration.** Legacy rows are normalized on read, so programs saved before this keep working.

Matching is greedy and one-to-one: two prescribed rides need two recorded rides, and an exact title
match (what 1-tap logging writes) is claimed before the looser `matchType` pass. Gym sessions carry
`matchType: 'gym'` because a watch does not reliably record strength work — those stay a manual tap.

---

## 1. Problem & Clinical Thesis

Just as a clinical dietitian prescribes a **Nutrition Directive & Daily Nutrient Macros** (`kcal`, `protein_g`, `carb_g`, `fat_g`, `fiber_g`), a fitness trainer/coach prescribes a **Periodized Training Program & Activity Macros**.

However, while nutrition is primarily **daily recurring** (humans eat every day), training operates on a **Weekly Periodized Cycle (Weekly Split)** with **Daily Habit Floors** and **Monthly Body Composition Outcomes**:

1. **Daily Level (Habit Floors)**: Non-negotiable daily metabolic movement (e.g., $\ge 9,000$ steps/day) and hydration.
2. **Weekly Level (Training Volume & Quotas)**:
   - Target Workout Sessions (e.g., 4 sessions/week: 3 Resistance + 1 Cardio).
   - Weekly Active Calorie Burn Budget (e.g., $\ge 3,200\text{ kcal/week}$).
   - Weekly Zone 2 Cardiovascular Minutes (e.g., $\ge 120\text{ min/week}$).
3. **Monthly Level (Adaptation & Overload)**:
   - Body composition trajectory (+Skeletal Muscle Mass / -Fat Mass).
   - Resting Heart Rate (RHR) improvement and progressive overload.

---

## 2. Activity / Workout Macros Specification

Training volume is measured along 4 distinct **Activity Macro Axes**:

| Macro Axis | Code | Unit | Direction | Data Source & Calculation |
|---|---|---|---|---|
| **Workout Sessions** | `WORKOUT_COUNT` | `sessions` | Floor ($\ge$) | Logged Gym strength sessions + explicit watch workouts ($\ge 20\text{ min}$) |
| **Active Calorie Burn** | `ACTIVE_BURN_KCAL` | `kcal` | Floor ($\ge$) / Target | $\text{Distance (km)} \times \text{Weight (kg)} \times 0.55$ (outdoor/bike) + Logged Resistance Burn |
| **Zone 2+ Cardio Time** | `ZONE2_CARDIO_MIN` | `minutes` | Floor ($\ge$) | Continuous HR stream ($\ge 60\% \text{ HR}_{\text{max}}$) captured during **explicitly started watch workouts** |
| **Daily Step Floor (NEAT)** | `DAILY_STEPS` | `steps` | Floor ($\ge$) | Wearable daily step accumulator (passive baseline movement) |

### Calculation & Data Provenance Rules (No Watch Calorie Guesswork)

1. **Distance & Cardio (Bike, Run, Walk)**:
   - Formula: $\text{Kcal} = \text{Distance (km)} \times \text{Body Weight (kg)} \times 0.55$.
   - Heart Rate stream & Zone 2 minutes are attached **only if the user explicitly started a workout session on the watch** (eliminates passive snapshot noise).
2. **Gym & Resistance Training**:
   - Wearable wrist sensors cannot gauge mechanical load (50kg vs 150kg squats).
   - The user logs duration & type via the app, or completes a **1-Tap Check-off** from the Trainer's assigned prescription.

---

## 3. Trainer Workspace & Program Templates (1-to-Many Sharing)

In the **Clinic Portal** (`website/clinic/`), trainers can manage:

### 3.1 Reusable Program Templates (`training_programs`)
Trainers build master programs once and assign them to multiple patients:
* **Program Metadata**: Title, description, duration (weeks), target fitness level.
* **Weekly Macro Targets**: Weekly workout count, weekly active burn kcal, weekly Zone 2 minutes, daily step floor.
* **Workout Schedule / Split**:
  - *Workout A*: Upper Body Strength (45 min · ~380 kcal).
  - *Workout B*: Lower Body & Core (50 min · ~450 kcal).
  - *Workout C*: Zone 2 Aerobic Conditioning (40 min · ~400 kcal).
  - *Rest / Recovery*: Active walking & mobility.

### 3.2 One-to-Many Assignment & Forking
* Trainer clicks **"Assign to Patients"** $\rightarrow$ Selects one or multiple linked patients.
* Once assigned, the trainer can optionally customize individual targets (e.g. adjust step floor or substitute an exercise) without modifying the master template.

---

## 4. Technical Requirements & Database Schema

### 4.1 Database Schema (`server/src/db/schema.sql`)

```sql
CREATE TABLE IF NOT EXISTS training_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  target_sessions_per_week INT NOT NULL DEFAULT 3,
  target_active_burn_weekly INT NOT NULL DEFAULT 2500,
  target_zone2_minutes_weekly INT NOT NULL DEFAULT 120,
  target_daily_steps INT NOT NULL DEFAULT 8000,
  schedule_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_template BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS training_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES training_programs (id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  mentor_id UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  custom_adjustments_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (patient_id, active)
);
```

### 4.2 API Routes (`server/src/routes/training.ts`)
- `GET /v1/clinic/training/programs` → List trainer's reusable program templates.
- `POST /v1/clinic/training/programs` → Create a new training program template.
- `PUT /v1/clinic/training/programs/:id` → Update a training program template.
- `DELETE /v1/clinic/training/programs/:id` → Remove template.
- `POST /v1/clinic/training/assign` → Assign program to one or more patients.
- `GET /v1/clinic/patients/:patientId/training` → Fetch patient's active program, compliance metrics & workout logs.

---

## 5. Mobile App UI & Activity Log Strip

1. **Activity Log Strip (`ActivityLogStrip.tsx`)**:
   - Header shows today's scheduled training mission (e.g., *"Today: Upper Body Strength"*).
   - **Activity Macro Bars**:
     - `⚡ Active Burn`: Actual kcal vs Daily Target kcal.
     - `⏱️ Workout Time`: Actual min vs Target min.
     - `👟 Daily Steps`: Actual steps vs Daily Step Floor.
   - **Weekly Status Chip**: `3 of 4 Workouts Completed · 2,450 / 3,000 kcal`.
2. **1-Tap Workout Check-off**:
   - Tapping the today's mission button opens the prescribed workout with exercises & target burn, allowing one-tap logging.

---

## 6. Verification Checklist

- [x] Database tables `training_programs` and `training_assignments` created via schema & migrations.
- [x] Server routes for program CRUD and patient assignment functional and authenticated.
- [x] Clinic Portal Trainer Workspace renders weekly split, template selector, and macro compliance.
- [x] Mobile app fetches active training assignment and displays Activity Macro meters.
- [x] Distance calculations use exact $\text{km} \times \text{kg} \times 0.55$ physics formula.
- [x] Continuous HR stream attached to workout chips only when explicit session started on watch.
- [x] Full 10-language localization (`en he es fr de ar ru pt it tr`) across portal and app.

### Multi-activity amendment

- [x] `normalizeSchedule` round-trips a 7-day / 31-session week and lifts legacy days (verified against `dist`).
- [x] Portal day card renders add/remove, time slot, auto-match and live day totals — light and dark.
- [x] 170 new locale strings resolve on the deployed portal across all 10 locales.
- [x] Release APK bundles clean with the session checklist.
- [ ] **Phone test** — watch-recorded ride flips its card to `✓ Watch`; gym session still needs the tap.
- [ ] **Portal test** — build a full week, save as template, reselect it and confirm every session returns.
