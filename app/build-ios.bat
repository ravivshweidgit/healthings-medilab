@echo off
REM build-ios.bat — EAS cloud iOS build for TestFlight (Windows; no local Xcode).
REM   build-ios.bat         production profile (TestFlight IPA) — build only
REM   bi-os.bat             build + submit (scripts\bi-os.ps1 — proven two-step path)
REM   submit-ios.bat        upload latest EAS build to TestFlight
REM   build-ios.bat submit  alias for submit-ios.bat
REM   build-ios.bat dev     development dev-client (simulator)
REM
REM First time only:
REM   npm install -g eas-cli
REM   eas login
REM   eas build:configure
REM Guide: server\TESTFLIGHT-INTERNAL.md

setlocal EnableExtensions
cd /d "%~dp0"

where eas >nul 2>&1
if errorlevel 1 (
  echo.
  echo EAS CLI not found.
  echo   npm install -g eas-cli
  echo   eas login
  echo.
  exit /b 1
)

set "PROFILE=production"
set "ACTION=build"
if /i "%~1"=="dev" set "PROFILE=development"
if /i "%~1"=="submit" set "ACTION=submit"
if /i "%~1"=="bi-os" set "ACTION=bi-os"
if /i "%~1"=="bios" set "ACTION=bi-os"

if /i "%ACTION%"=="submit" (
  call "%~dp0submit-ios.bat"
  exit /b %ERRORLEVEL%
)

if /i "%ACTION%"=="bi-os" (
  call "%~dp0bi-os.bat"
  exit /b %ERRORLEVEL%
)

echo.
echo === Healthings iOS build (EAS cloud) ===
echo Profile: %PROFILE%
echo Bundle id: com.healthings.medilab
echo Version: see app.config.js ^(version + ios.buildNumber^)
echo.
echo Builds on Expo servers — no Mac required. First run may ask for Apple credentials.
echo.

eas build --platform ios --profile %PROFILE%
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo === BUILD FAILED ===
  echo First time? Run: eas login   then   eas build:configure
  exit /b %ERR%
)

echo.
echo === BUILD QUEUED / FINISHED ===
echo When the build succeeds on expo.dev:
echo   submit-ios.bat
echo Or use bi-os.bat next time ^(build + submit in one step^).
echo Guide: server\TESTFLIGHT-INTERNAL.md
echo.
exit /b 0
