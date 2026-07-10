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

### Alpha test script (Withings iPhone)

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
