# Google Play — internal testing (alpha)

Step-by-step for **Healthings Medilab** (`com.healthings.medilab`). Spec: `prompts/app/001-099/prompt47.txt`.

## Prerequisites

| Item | Status |
|------|--------|
| Google Play Developer account | **$25 one-time** — [play.google.com/console](https://play.google.com/console) |
| Release keystore | `app/android/app/healthings-release.keystore` + `keystore.properties` |
| Privacy policy URL | https://healthings.ai/privacy.html (deploy website first) |
| Signed AAB | Run `app/scripts/bundle-release.ps1` |

---

## 1. Build AAB (dev machine)

```powershell
Set-Location c:\projects\healthings-medilab
.\app\scripts\bundle-release.ps1
```

Output: `app\android\app\build\outputs\bundle\release\app-release.aab`

**Each new upload:** bump `versionCode` in `app/android/app/build.gradle` (must increase every time).

---

## 2. Deploy privacy page

```powershell
# On VPS after git pull:
bash server/scripts/deploy-website.sh
```

Verify: https://healthings.ai/privacy.html

---

## 3. Create app in Play Console

1. **Play Console** → **Create app**
2. App name: **Healthings** (or Healthings Medilab)
3. Default language: English (add Hebrew listing later if needed)
4. App / Game: **App**
5. Free or paid: **Free**
6. Declarations: comply with policies; US export laws — typical consumer app answers

---

## 4. App access & content (one-time setup)

Complete all items in **Policy and programs** / **App content** before release:

### Privacy policy
- URL: `https://healthings.ai/privacy.html`

### App access
- All functionality available after email OTP login
- Provide test instructions: *Sign in with tester email; OTP sent to inbox*

### Ads
- **No**, app does not contain ads

### Content rating
- Start questionnaire → category **Health & Fitness** / wellness
- No violence, gambling, user-generated public content
- Typical result: **Everyone** or low teen (depends on questionnaire)

### Target audience
- **18+** recommended (health/wellness alpha; not for children)

### Data safety (alpha — local-first)

| Question | Answer |
|----------|--------|
| Collect or share user data? | **Yes** (email for account) |
| Health data collected by developer? | **No** — stored on device only (alpha) |
| Email | Collected, required for account, not shared with third parties |
| Data encrypted in transit | **Yes** (HTTPS) |
| Request data deletion | **Yes** — email support@healthings.ai |
| Health Connect glucose | Declared under **Health apps** / permissions — on-device charts only |

Do **not** claim E2E encrypted cloud sync until be-04 ships.

### Health apps declaration
- Uses Health Connect to read blood glucose
- Purpose: user-initiated wellness tracking, **not** diagnosis or treatment
- Link privacy policy

---

## 5. Store listing (minimal for internal)

Internal testing still needs a basic listing:

| Field | Suggested text |
|-------|----------------|
| Short description | Personal metabolic coach — track meals & glucose on your phone. Alpha. |
| Full description | Healthings helps you log meals, view CGM trends, import labs, and chat with AI mentors. Data stays on your device. Alpha software — not a medical device. |
| App icon | 512×512 PNG (export from `app/assets/icon.png`) |
| Feature graphic | Optional for internal; required for production |
| Screenshots | 2+ phone screenshots from dashboard |
| Category | Health & Fitness |
| Contact email | support@healthings.ai |
| Website | https://healthings.ai |

Tone: **wellness / coaching**, not diagnosis.

---

## 6. Upload to internal testing

1. **Testing** → **Internal testing** → **Create new release**
2. **Upload** `app-release.aab`
3. Release name: e.g. `1.1.1 (7)` — match versionName / versionCode
4. Release notes: *Alpha — lipid charts, all lab history for mentors*
5. **Review release** → **Start rollout to Internal testing**

First upload may trigger **app review** (often hours to a few days).

---

## 7. Add testers

1. **Internal testing** → **Testers** tab
2. Create email list (Ehud, Raviv, …) — max **100** for internal track
3. Copy **Join on the web** / opt-in link

Share link instead of APK sideload.

---

## 8. Update website with Play link

Edit `website/index.html`:

```javascript
var PLAY_STORE_ALPHA_URL = 'https://play.google.com/apps/internaltest/...';
```

Redeploy website → Play button appears on https://healthings.ai

---

## 9. Phone test checklist

- [ ] Opt-in link opens Play Store on tester phone
- [ ] Install → open → OTP login → dashboard
- [ ] Health Connect permission flow works
- [ ] Upload new AAB with higher `versionCode` → update via Play

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Upload rejected — version | Increase `versionCode` |
| Signing key mismatch | Must use same `healthings-release.keystore` forever |
| Privacy policy 404 | Run `deploy-website.sh` on VPS |
| Review asks for demo login | Provide test email + note OTP auth |
| Health app policy | Emphasize local-first, no diagnosis, internal alpha |

---

## Related

- `app/scripts/bundle-release.ps1` — AAB build
- `website/privacy.html` — privacy policy
- `prompts/app/001-099/prompt47.txt` — full spec
- `prompts/app/001-099/done/prompt15.txt` — release signing
