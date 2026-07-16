@echo off
REM bi-os.bat — iOS TestFlight pipeline (upload → poll same build → submit).
REM   Android bi  = build-APK.bat install  (local APK + USB)
REM   iOS bi-os   = scripts\bi-os.ps1       (3 stages, ONE eas build — no --auto-submit)
REM
REM Requires: eas-cli, eas login, asc-api.local.ps1 (copy from .example)
REM Guide: server\TESTFLIGHT-INTERNAL.md

setlocal EnableExtensions
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bi-os.ps1" %*
exit /b %ERRORLEVEL%
