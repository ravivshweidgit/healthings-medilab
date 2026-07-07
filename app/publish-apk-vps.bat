@echo off
setlocal EnableExtensions
REM Build release APK (if needed), copy to website/downloads, upload + deploy on VPS.
set "REPO=%~dp0.."
cd /d "%REPO%"

set "KEY=%USERPROFILE%\.ssh\hetzner_healthings"
set "HOST=root@178.105.218.202"
set "REMOTE_APK=/opt/healthings-api/website/downloads/healthings-medilab.apk"
set "LOCAL_APK=website\downloads\healthings-medilab.apk"
set "RELEASE_APK=app\android\app\build\outputs\apk\release\app-release.apk"

if not exist "%KEY%" (
  echo ERROR: Missing SSH key: %KEY%
  echo Add Host healthings-api in ~/.ssh/config or create the key.
  exit /b 1
)

if not exist "%RELEASE_APK%" (
  echo Building release APK...
  set "GRADLE_USER_HOME=C:\gradle-hm"
  pushd app\android
  call gradlew.bat assembleRelease --no-build-cache --console=plain
  if errorlevel 1 (
    popd
    echo BUILD FAILED
    exit /b 1
  )
  popd
)

echo Copying APK to website\downloads\...
powershell -NoProfile -ExecutionPolicy Bypass -File "website\scripts\publish-apk.ps1"
if errorlevel 1 exit /b 1

echo.
echo Uploading to VPS (%HOST%)...
scp -i "%KEY%" -o BatchMode=yes "%LOCAL_APK%" %HOST%:%REMOTE_APK%
if errorlevel 1 (
  echo SCP FAILED
  exit /b 1
)

echo Running deploy-website.sh on VPS...
ssh -i "%KEY%" -o BatchMode=yes %HOST% "bash /opt/healthings-api/server/scripts/deploy-website.sh"
if errorlevel 1 (
  echo DEPLOY FAILED
  exit /b 1
)

echo.
echo OK - https://healthings.ai/downloads/healthings-medilab.apk
echo.
pause
