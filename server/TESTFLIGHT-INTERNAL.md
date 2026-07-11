# Apple TestFlight — internal testing (iOS)

Step-by-step for **Healthings** (`com.healthings.medilab`). Spec: `prompts/app/prompt65.txt`.

## Prerequisites

| Item | Status |
|------|--------|
| Apple Developer Program | Enrolled (2026-07-10) |
| Expo account + EAS CLI | `npm i -g eas-cli` · `eas login` |
| Bundle id | `com.healthings.medilab` (matches Android) |
| Privacy policy | https://healthings.ai/privacy.html |
| v1 scope | **Withings cloud + manual body** — no HealthKit read |

---

## 1. One-time EAS setup (Windows OK — cloud builds)

```powershell
Set-Location c:\projects\healthings-medilab\app
eas login
eas build:configure
eas credentials
```

When prompted, let EAS create the iOS distribution certificate and provisioning profile for `com.healthings.medilab`.

Copy the EAS project id into `app.config.js` → `extra.eas.projectId` (or set `EAS_PROJECT_ID` in EAS secrets).

### Apple login blocked (SMS 2FA fails on Windows)

Use an **App Store Connect API key** instead of Apple ID + SMS in EAS. See **§1b** below.

---

## 1b. App Store Connect API key (no SMS 2FA)

Use when EAS shows: *Verification codes can't be sent to this phone number*.

### A. Create the key (browser)

1. Open [App Store Connect](https://appstoreconnect.apple.com) → sign in as **raviv.shweid@healthings.ai**.
2. **Users and Access** (top menu).
3. **Integrations** tab → **App Store Connect API**.
4. Copy **Issuer ID** (top of page) — save it.
5. **Generate API Key** (+):
   - Name: `EAS Healthings`
   - Access: **Admin** or **App Manager**
6. **Download** the `.p8` file **once** (Apple never shows it again).
7. Note the **Key ID** (e.g. `AB12CD34EF`).

Store the file **outside git**, e.g.:

`C:\secrets\healthings\AuthKey_AB12CD34EF.p8`

(`*.p8` is gitignored.)

### B. Configure locally (PowerShell)

Copy the template and edit:

```powershell
Copy-Item c:\projects\healthings-medilab\app\asc-api.local.ps1.example `
  c:\projects\healthings-medilab\app\asc-api.local.ps1
notepad c:\projects\healthings-medilab\app\asc-api.local.ps1
```

Or set env vars manually:

```powershell
$env:EXPO_ASC_API_KEY_PATH = "C:\secrets\healthings\AuthKey_XXXXXXXXXX.p8"
$env:EXPO_ASC_KEY_ID       = "YOUR_KEY_ID"
$env:EXPO_ASC_ISSUER_ID    = "your-issuer-uuid"
$env:EXPO_APPLE_TEAM_ID    = "5WPC43PY7L"
$env:EXPO_APPLE_TEAM_TYPE  = "COMPANY_OR_ORGANIZATION"
$env:EXPO_NO_KEYCHAIN      = "1"
Remove-Item -Recurse -Force "$env:USERPROFILE\.app-store" -ErrorAction SilentlyContinue
```

`EXPO_APPLE_TEAM_TYPE`: use `INDIVIDUAL` only if your developer account is personal, not a company.

### C. Build

```powershell
cd c:\projects\healthings-medilab\app
. .\asc-api.local.ps1    # if using the script
.\bi-os.bat
```

At **`Do you want to log in to your Apple account?`** → type **`n`**.

EAS should use the API key to create/sign credentials. First run may ask a few certificate questions — accept defaults / let EAS manage.

**Do not** paste `.p8` contents or Key ID into chat or git.

---

## 2. Build for TestFlight

```powershell
Set-Location c:\projects\healthings-medilab\app
.\build-ios.bat
```

Or manually:

```powershell
eas build --platform ios --profile production
```

- Uses `app.config.js` — **Health Connect plugin omitted on iOS**.
- Aligns with Android **1.2.2** / build **18** until bumped again.

For a dev client (simulator / local debugging):

```powershell
eas build --platform ios --profile development
```

---

## 3. Submit to App Store Connect

After the build finishes:

```powershell
.\build-ios.bat submit
```

(`submit-ios.bat` is the canonical name; `build-ios.bat submit` still works.)

Or:

```powershell
.\submit-ios.bat
```

Or:

```powershell
eas submit --platform ios --profile production --latest
```

Or download the `.ipa` from the [EAS dashboard](https://expo.dev) and upload manually in [App Store Connect](https://appstoreconnect.apple.com).

---

## 4. TestFlight internal testing

1. **App Store Connect** → your app → **TestFlight**
2. Wait for **Processing** (often 10–30 min)
3. **Internal testing** → add testers (Apple IDs on your team)
4. Testers install **TestFlight** app → accept invite → install Healthings

### Alpha website link (healthings.ai)

After the build is **Ready to test**, create a **public TestFlight link** for the website:

1. App Store Connect → **TestFlight** → **External Testing** (or Internal group with public link if enabled)
2. Add build **1.2.2 (18)** to the group → **Public Link** → copy URL (`https://testflight.apple.com/join/…`)
3. Update `website/index.html` → `#testflight-link` `href`
4. Deploy: `bash server/scripts/deploy-website.sh` on VPS

Until the link is set, iPhone testers can still install via **email invite** from TestFlight.

---

- [ ] OTP login
- [ ] Quick Start: scale + watch **Yes** → link Withings on dashboard
- [ ] Body scan, trend, HR, workouts from cloud
- [ ] Food log + coach
- [ ] Clinic snapshot → portal dashboard
- [ ] **No** Health Connect UI
- [ ] CGM: CSV import only; live strip absent or “coming soon”
- [ ] Scale **No**: manual Body in My Profile

Help pages: https://healthings.ai/help/

---

## 5. App Store Connect one-time (if not done)

Mirror Play internal setup where applicable:

| Section | Notes |
|---------|--------|
| Privacy policy URL | https://healthings.ai/privacy.html |
| App privacy | Email for account; health data **on device** + optional Withings cloud |
| HealthKit | **Not used in v1** — do not enable HealthKit capability until `prompt56` |
| Export compliance | Standard consumer app |

---

## Version alignment with Android

| Platform | versionName | Build |
|----------|-------------|-------|
| Android Play | 1.2.2 | versionCode 18 |
| iOS TestFlight | 1.2.2 | buildNumber 18 |

Bump both before each store upload. Android: `app/android/app/build.gradle`. iOS: `app.config.js` (`buildNumber`) + optional EAS `autoIncrement`.

---

## Related

- `server/PLAY-CONSOLE-INTERNAL.md` — Android Play internal
- `prompts/app/prompt65.txt` — full iOS scope (Phases A–D)
- `prompts/app/prompt56.txt` — HealthKit Phase 2
