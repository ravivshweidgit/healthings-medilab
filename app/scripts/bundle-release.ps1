# Build signed Android App Bundle (AAB) for Google Play upload.
$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Android = Join-Path $Root "android"
$AabOut = Join-Path $Root "android\app\build\outputs\bundle\release\app-release.aab"
$KeystoreProps = Join-Path $Android "keystore.properties"

if (-not (Test-Path $KeystoreProps)) {
  Write-Error "Missing keystore.properties. Copy keystore.properties.example -> android/keystore.properties"
}

$env:GRADLE_USER_HOME = if ($env:GRADLE_USER_HOME) { $env:GRADLE_USER_HOME } else { "C:\gradle-hm" }
Set-Location $Android

Write-Host "Building release AAB (bundleRelease)..."
& .\gradlew.bat bundleRelease --no-build-cache --console=plain
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if (-not (Test-Path $AabOut)) {
  Write-Error "Build finished but AAB not found at $AabOut"
}

$Size = [math]::Round((Get-Item $AabOut).Length / 1MB, 1)
$GradleFile = Join-Path $Android "app\build.gradle"
$VersionCode = (Select-String -Path $GradleFile -Pattern 'versionCode\s+(\d+)' | ForEach-Object { $_.Matches[0].Groups[1].Value })
$VersionName = (Select-String -Path $GradleFile -Pattern 'versionName\s+"([^"]+)"' | ForEach-Object { $_.Matches[0].Groups[1].Value })

Write-Host ""
Write-Host "OK - AAB ready for Google Play"
Write-Host "  versionCode : $VersionCode"
Write-Host "  versionName : $VersionName"
Write-Host "  size        : ${Size} MB"
Write-Host "  path        : $AabOut"
Write-Host ""
Write-Host "Next: Play Console -> Testing -> Internal testing -> Create release -> Upload AAB"
Write-Host "Guide: server/PLAY-CONSOLE-INTERNAL.md"
