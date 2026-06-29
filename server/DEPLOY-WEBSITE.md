# Healthings landing site — healthings.ai

Public download page for the Android app. Spec: `prompts/backend/prompt-be-07-landing-website.md`.

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

bash server/scripts/deploy-website.sh
```

### 3. Verify

- https://healthings.ai — landing page
- https://healthings.ai/downloads/healthings-medilab.apk — APK download

## Structure

```
website/
  index.html          Landing + install steps
  styles.css
  assets/             Logo, favicon
  downloads/          healthings-medilab.apk (not in git)
  scripts/publish-apk.*
```
