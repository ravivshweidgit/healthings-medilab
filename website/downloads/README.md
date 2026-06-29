# APK files are published to the VPS — not stored in git.

Build locally:

```powershell
Set-Location app\android
.\gradlew.bat assembleRelease --no-build-cache
```

Then publish (from repo root):

```powershell
bash website/scripts/publish-apk.sh
# or on Windows: website\scripts\publish-apk.ps1
```

Output on server: `https://healthings.ai/downloads/healthings-medilab.apk`
