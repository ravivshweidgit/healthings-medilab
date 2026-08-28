# be-57 — Clinic Capabilities, Roles & Professional Credentials

Status: needs-review
Date: 2026-08-29
Builds on: be-55 (Macro Trends Report), be-56 (Modern Clinic UI), be-26 (Portal i18n)
Primary files:
- `website/clinic/index.html` (Clinic settings view & capabilities picker)
- `website/clinic/clinic-portal.css` (Credentials & capability badge styles)
- `website/clinic/clinic-i18n.js` (10-locale translation keys for capabilities & credentials)
- `server/src/db/schema.sql` (Capabilities & credentials schema)
- `server/src/services/clinicProfiles.ts` (Profile & credential blob service)
- `server/src/routes/clinic.ts` (Profile & credential upload routes)

---

## 1. Problem & Clinical Thesis

Healthcare and metabolic coaching are inherently multi-disciplinary, but practitioners operate either independently or in integrated teams:
1. **Nutritionists / Dietitians (`N`)**: Require food logs, macro trends, clinical nutrition directives, and metabolic lab markers.
2. **Fitness Trainers & Coaches (`T`)**: Require active burn, workouts, heart rate zones, steps, body composition, and recovery metrics. They must **not** see sensitive medical blood lab reports unless specifically authorized.
3. **Physicians / Longevity Doctors (`D`)**: Require a 360° clinical view (blood panels, continuous glucose CGM, liver/kidney markers) and set hard clinical guardrails (Treatment Markers & Caps).
4. **Unified / Hybrid Practitioners (`D + N + T`)**: Solo longevity practitioners or multi-disciplinary clinics that manage all three pillars in a single unified workspace.

Healthings is a **Metabolic OS platform**, not a medical provider. Licensing and clinical authority remain strictly with the practitioner. The platform must provide self-serve capability declaration, credential verification upload, and role-based data sharing consent.

---

## 2. The 8 Clinic Personas (3-Bit Capability Matrix)

Each clinic organization configures its active capabilities:
- `can_nutrition` (N)
- `can_training` (T)
- `can_medical` (D)

$$\text{Personas} = 2^3 = 8 \text{ Distinct Profiles}$$

| # | N (Nutrition) | T (Training) | D (Medical) | Persona / Target Specialist | Visible Views in Portal |
|:-:|:---:|:---:|:---:|:---|:---|
| **1** | ❌ | ❌ | ❌ | Basic Viewer | Overview & Demographics only |
| **2** | ❌ | ❌ | ✅ | **Physician / Doctor Only** | Lab Panels, CGM, Treatment Markers, Blood Trends |
| **3** | ❌ | ✅ | ❌ | **Fitness Trainer Only** | Workouts, Active Burn, Steps, Heart Rate, Body Composition |
| **4** | ❌ | ✅ | ✅ | **Sports Medicine Doctor** | Labs + CGM + Training Workload & Recovery |
| **5** | ✅ | ❌ | ❌ | **Nutritionist / Dietitian** | Food Log, Macro Trends Report, Nutrition Directives |
| **6** | ✅ | ❌ | ✅ | **Metabolic / Endocrine Specialist** | Lab Panels + Nutrition Directives + Macro Trends |
| **7** | ✅ | ✅ | ❌ | **Health Coach & Trainer** | Macro Trends + Workouts, Burn & Body Composition |
| **8** | ✅ | ✅ | ✅ | **All-in-One Longevity Clinic** | Full Suite: Medical Labs + Nutrition + Fitness |

---

## 3. Data Scoping & Patient Consent

When an invite is sent or a patient links to a clinic, the mobile app displays explicit role-based consent:

```text
┌────────────────────────────────────────────────────────┐
│ Link Request from: Dr. Daniel Levi                     │
│ Clinic: Longevity & Metabolic Health                   │
├────────────────────────────────────────────────────────┤
│ Professional Capabilities:                             │
│  [x] 🩺 Clinical & Lab Panels (Blood, CGM, Markers)    │
│  [x] 🥗 Food & Nutrition (Meals, Macros, Rules)        │
│  [x] 🏋️ Activity & Fitness (Burn, Workouts, Steps)    │
│                                                        │
│ Credentials: MD License #12345 (Ministry of Health)    │
│ [📄 View Verified Certificate]                         │
├────────────────────────────────────────────────────────┤
│ [  Approve & Link Clinic  ]         [  Decline  ]      │
└────────────────────────────────────────────────────────┘
```

---

## 4. Professional Credentials & Licensing Upload

In the **My Clinic / Settings** tab (`⚙️ My clinic`):
1. **License Details**:
   - `license_number`: Text string.
   - `issuing_body`: e.g., "State Medical Board", "Academy of Nutrition and Dietetics", "NSCA".
   - `specialty`: e.g., "Clinical Dietitian", "Internal Medicine", "Strength & Conditioning".
2. **Credential Document Upload**:
   - Supported formats: PDF, JPEG, PNG (Max 10 MB).
   - Secure storage on VPS / server blob store.
   - Public/Patient visibility toggle: `show_credentials_to_patient` (boolean).

---

## 5. Technical Requirements & API Endpoints

### 5.1 Database Schema (`clinic_profiles`)
```sql
CREATE TABLE IF NOT EXISTS clinic_profiles (
  account_id UUID PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  clinic_name VARCHAR(255) NOT NULL,
  can_nutrition BOOLEAN NOT NULL DEFAULT TRUE,
  can_training BOOLEAN NOT NULL DEFAULT FALSE,
  can_medical BOOLEAN NOT NULL DEFAULT FALSE,
  license_number VARCHAR(100),
  issuing_body VARCHAR(255),
  specialty VARCHAR(255),
  credential_blob_id UUID,
  credential_filename VARCHAR(255),
  show_credentials_to_patient BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 5.2 API Routes
- `GET /v1/clinic/profile` → Fetch active capabilities, licensing info, and credential upload metadata.
- `PUT /v1/clinic/profile` → Update capabilities and licensing fields.
- `POST /v1/clinic/credentials/upload` → Upload verification license document (multipart / binary).
- `GET /v1/clinic/credentials/download` → Download uploaded certificate.
- `GET /v1/sync/clinic-info?clinicId=...` → App-side endpoint for consent screen displaying verified credentials.

---

## 6. Verification Checklist

- [ ] Clinic Settings view allows selecting capability checkboxes (Nutrition, Training, Medical).
- [ ] Sidebar dynamically adapts navigation items based on active clinic capabilities.
- [ ] License details and document upload form functional with PDF/Image support.
- [ ] Server stores and streams credential files with authentication checks.
- [ ] Patient app consent screen displays declared capabilities and credential links.
- [ ] Full 10-language localization (`en he es fr de ar ru pt it tr`) for all UI strings.
