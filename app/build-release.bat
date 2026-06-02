@echo off
echo Building release APK...
cd android
call gradlew.bat assembleRelease
cd ..
echo.
echo Done. APK location:
echo   android\app\build\outputs\apk\release\app-release.apk
echo.
echo To install on connected device:
echo   adb install -r android\app\build\outputs\apk\release\app-release.apk
