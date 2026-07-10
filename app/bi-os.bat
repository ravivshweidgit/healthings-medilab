@echo off
REM bi-os.bat — iOS "build + deliver" (full pipeline on Windows).
REM   Android bi  = build-APK.bat install  (local build + USB install)
REM   iOS bi-os   = EAS build + auto-submit to TestFlight (no USB; install via TestFlight app)
REM
REM Split steps if needed:
REM   build-ios.bat   build only (compile-check equivalent)
REM   submit-ios.bat  upload an already-finished build
REM
REM First time: npm i -g eas-cli  &&  eas login  &&  eas build:configure
call "%~dp0build-ios.bat" bi-os %*
