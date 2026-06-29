@echo off
setlocal
echo Building release AAB for Google Play...
if not defined GRADLE_USER_HOME set GRADLE_USER_HOME=C:\gradle-hm
cd /d "%~dp0android"
call gradlew.bat bundleRelease --no-build-cache --console=plain
if errorlevel 1 (
  echo.
  echo BUILD FAILED
  exit /b 1
)
cd /d "%~dp0"
echo.
echo Done. Upload this file to Play Console - Internal testing:
echo   android\app\build\outputs\bundle\release\app-release.aab
echo.
echo Next: Play Console - Testing - Internal testing - Create release
echo Guide: server\PLAY-CONSOLE-INTERNAL.md
echo.
pause
