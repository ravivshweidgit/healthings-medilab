@echo off
REM build-dev.bat — debug dev build (counterpart to build-release.bat).
REM 1) JDK 17/21 for Gradle  2) Native build + install ^(--no-bundler^)  3) Metro in foreground ^(QR, dev menu^).
REM Each run reinstalls the debug APK so the device matches this build ^(normal for expo run:android^).
REM JS-only days: keep the dev client installed and run: npm run start:dev ^(no native reinstall^).
REM USB cable: Metro needs adb reverse 8081 ^(done below after install^). WiFi: same LAN or Dev Menu ^> Change bundle location.
REM For a full clean: npm install, then android\gradlew.bat clean, then run this script again.

setlocal
cd /d "%~dp0"

REM Stop adb.exe so the next build/install talks to a fresh daemon ^(harmless if none were running^).
taskkill /IM adb.exe /F >nul 2>&1

call "%~dp0check-java-for-android.bat"
if errorlevel 1 exit /b 1

echo.
echo === npx expo run:android --no-bundler ^(native build + install^) ===
echo First lines can take a bit; Gradle log should stream below.
echo If nothing appears for minutes, run this script again or check device/USB debugging.
echo.

REM Reduces spinner/TUI that sometimes prints nothing in Windows terminals until the end.
set "CI=1"
call npx expo run:android --no-bundler
set "CI="
if errorlevel 1 exit /b %errorlevel%

REM Killing adb cleared any old forwards; USB devices need Metro reachable from the phone.
where adb >nul 2>&1
if not errorlevel 1 (
  call adb reverse tcp:8081 tcp:8081 2>nul
)

echo.
echo === Metro ^(expo start --dev-client^) — QR and server below; Ctrl+C to stop ===
echo.

call npm run start:dev
exit /b %errorlevel%
