# bi-os.ps1 — iOS TestFlight pipeline (proven two-step path on Windows).
# 1. EAS cloud build (production IPA) — NO --auto-submit (Apple ID/SMS trap)
# 2. eas submit --latest (ASC API key via asc-api.local.ps1)
#
# Android "bi" equivalent: build + deliver. Install on iPhone via TestFlight app.
# Guide: server/TESTFLIGHT-INTERNAL.md

$ErrorActionPreference = "Stop"
$AppRoot = Split-Path $PSScriptRoot -Parent
Set-Location $AppRoot

if (-not (Get-Command eas -ErrorAction SilentlyContinue)) {
  Write-Error "EAS CLI not found. Run: npm install -g eas-cli  then  eas login"
}

$AscLocal = Join-Path $AppRoot "asc-api.local.ps1"
if (Test-Path $AscLocal) {
  Write-Host "Loading ASC API key (asc-api.local.ps1)..."
  . $AscLocal
  Set-Location $AppRoot
} else {
  Write-Host ""
  Write-Host "WARN: Missing asc-api.local.ps1 - submit may ask for Apple ID (SMS fails on Windows)."
  Write-Host "  Copy asc-api.local.ps1.example -> asc-api.local.ps1 and fill Key ID / Issuer / .p8 path."
  Write-Host "  See server/TESTFLIGHT-INTERNAL.md section 1b."
  Write-Host ""
}

Write-Host ""
Write-Host "=== bi-os: EAS build + submit-ios (TestFlight) ==="
Write-Host "Step 1/2: eas build (cloud) - answer n if asked to log in to Apple account."
Write-Host "Step 2/2: eas submit --latest (API key, no SMS)."
Write-Host "Bump ios.buildNumber in app.config.js before each new TestFlight upload."
Write-Host ""

Write-Host "--- Step 1/2: production build ---"
& eas build --platform ios --profile production
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "=== bi-os FAILED (build) ==="
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "--- Step 2/2: submit to App Store Connect ---"
& eas submit --platform ios --profile production --latest
if ($LASTEXITCODE -ne 0) {
  Write-Host ""
  Write-Host "=== bi-os FAILED (submit) ==="
  Write-Host "Build may still be on expo.dev - retry: .\submit-ios.bat"
  exit $LASTEXITCODE
}

Write-Host ""
Write-Host "=== bi-os DONE ==="
Write-Host "Next: App Store Connect -> TestFlight -> wait Processing -> testers open TestFlight."
Write-Host "Guide: server/TESTFLIGHT-INTERNAL.md"
