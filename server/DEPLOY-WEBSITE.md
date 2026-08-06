# Healthings landing site — healthings.ai

Public download page for the Android app. Spec: `prompts/backend/done/be-07-landing-website.md`.

## Local preview

Open `website/index.html` in a browser (download button shows “not published” until APK exists).

## Publish APK

```powershell
# Build
Set-Location app\android
.\gradlew.bat assembleRelease --no-build-cache

# Copy into website/downloads/
Set-Location c:\projects\healthings-medilab
.\website\scripts\publish-apk.ps1
```

**One command (build if needed + upload + deploy):**

```bat
app\publish-apk-vps.bat
```

Uses SSH key `~/.ssh/hetzner_healthings` (see `~/.ssh/config` Host `healthings-api`).

## Google Play (internal testing)

Build signed **AAB** (not APK) for Play Console upload:

```powershell
Set-Location c:\projects\healthings-medilab
.\app\scripts\bundle-release.ps1
```

Output: `app\android\app\build\outputs\bundle\release\app-release.aab`

Full Play Console steps: **`server/PLAY-CONSOLE-INTERNAL.md`**

Privacy policy (required for Play listing): `website/privacy.html` → https://healthings.ai/privacy.html

After internal-testing opt-in link exists, set `PLAY_STORE_ALPHA_URL` in `website/index.html` and redeploy.

## Deploy to Hetzner

### 1. DNS (Porkbun)

| Host | Type | Value |
|------|------|--------|
| `@` (apex) | A | VPS IPv4 (same as `api.healthings.ai`) |
| `www` | A or CNAME | VPS IPv4 or `healthings.ai` |

Keep `api` → same VPS (separate nginx `server_name`).

### 2. On the VPS

```bash
cd /opt/healthings-api
git pull --ff-only

# Upload APK from dev machine (if built locally):
# scp website/downloads/healthings-medilab.apk root@178.105.218.202:/opt/healthings-api/website/downloads/
# Use SSH key (see ~/.ssh/config Host healthings-api):
# scp -i ~/.ssh/hetzner_healthings website/downloads/healthings-medilab.apk root@178.105.218.202:/opt/healthings-api/website/downloads/

bash server/scripts/deploy-website.sh
```

### 3. Verify

- https://healthings.ai — landing page
- https://healthings.ai/privacy.html — privacy policy (Play Store)
- https://healthings.ai/downloads/healthings-medilab.apk — APK download

Explainer video in **How it works** — check the content types, not just the status
codes. A `.vtt` served as `application/octet-stream` still returns 200 while Safari
silently drops the captions:

```bash
curl -sI https://healthings.ai/videos/how-it-works.mp4    | grep -i 'content-type\|accept-ranges'
curl -sI https://healthings.ai/videos/how-it-works.en.vtt | grep -i content-type   # text/vtt
```

## Structure

```
website/
  index.html          Landing + Play (when configured) + APK download
  privacy.html        Privacy policy (Play Store required)
  styles.css
  assets/             Logo, favicon
  videos/             Explainer film + WebVTT captions + poster (in git)
  downloads/          healthings-medilab.apk (not in git)
  scripts/publish-apk.*
app/
  build-release.bat   Release APK (sideload)
  build-aab.bat       Release AAB (Play Store)
  publish-apk-vps.bat Build APK + publish to healthings.ai VPS
  scripts/
    bundle-release.ps1  Build signed AAB for Play Console
```
