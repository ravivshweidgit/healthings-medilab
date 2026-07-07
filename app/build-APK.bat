@echo off
REM build-APK.bat — release APK with live Gradle progress (phone / compile-check).
REM   build-APK.bat         build only
REM   build-APK.bat install build + adb install (same as "bi")
REM Uses short GRADLE_USER_HOME to avoid Windows 260-char native build paths.
REM For debug dev client + Metro, use build-dev.bat instead.

setlocal EnableExtensions
cd /d "%~dp0"

call "%~dp0check-java-for-android.bat"
if errorlevel 1 exit /b 1

REM Always override — sandbox/CI may set a long GRADLE_USER_HOME (260-char ninja failures).
set "GRADLE_USER_HOME=C:\gradle-hm"

echo.
echo === Healthings release APK ===
echo Gradle user home: %GRADLE_USER_HOME%
echo Task: assembleRelease --no-build-cache --console=plain
echo Gradle log streams below; first native compile can take several minutes.
echo.

pushd android
call gradlew.bat assembleRelease --no-build-cache --console=plain
set "BUILD_ERR=%ERRORLEVEL%"
popd

if not "%BUILD_ERR%"=="0" (
  echo.
  echo === BUILD FAILED ===
  exit /b %BUILD_ERR%
)

set "APK=%~dp0android\app\build\outputs\apk\release\app-release.apk"
echo.
echo === BUILD SUCCESSFUL ===
echo APK: %APK%

if /I "%~1"=="install" (
  echo.
  echo === adb install -r ===
  where adb >nul 2>&1
  if errorlevel 1 (
    echo ERROR: adb not found on PATH.
    exit /b 1
  )
  adb install -r "%APK%"
  if errorlevel 1 (
    echo INSTALL FAILED
    exit /b 1
  )
  echo INSTALL SUCCESSFUL
)

exit /b 0
