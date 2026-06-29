# Publish release APK into website/downloads/ for deploy.
$ErrorActionPreference = "Stop"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$ApkSrc = Join-Path $Root "app\android\app\build\outputs\apk\release\app-release.apk"
$ApkDst = Join-Path $Root "website\downloads\healthings-medilab.apk"

if (-not (Test-Path $ApkSrc)) {
  Write-Error "Missing release APK. Build first: cd app\android; .\gradlew.bat assembleRelease --no-build-cache"
}

Copy-Item -Force $ApkSrc $ApkDst
$Size = [math]::Round((Get-Item $ApkDst).Length / 1MB, 1)
Write-Host "OK - ${Size} MB -> website\downloads\healthings-medilab.apk"
Write-Host "Deploy: bash server/scripts/deploy-website.sh (on VPS after rsync/scp)"
