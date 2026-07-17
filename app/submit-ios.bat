@echo off
REM submit-ios.bat — upload latest EAS iOS build to App Store Connect (TestFlight).
REM Use after build-ios.bat if you did not use bi-os.bat (build + submit in one go).
REM Not "publish" — that means public App Store release later.
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

echo.
echo === submit-ios: EAS - App Store Connect (TestFlight) ===
echo Uploads the latest successful production iOS build from expo.dev.
echo.

eas submit --platform ios --profile production --latest --no-wait
set "ERR=%ERRORLEVEL%"
if not "%ERR%"=="0" (
  echo.
  echo === SUBMIT FAILED ===
  exit /b %ERR%
)

echo.
echo === SUBMIT SCHEDULED ===
echo Apple will email when TestFlight processing finishes - no need to wait here.
echo Guide: server\TESTFLIGHT-INTERNAL.md
exit /b 0
