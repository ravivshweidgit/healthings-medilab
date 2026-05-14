@echo off
REM React Native / Expo Android native builds need JDK 17 or 21. Java 24+ breaks CMake ^(restricted System methods^).
where java >nul 2>&1
if errorlevel 1 (
  echo java not found on PATH.
  exit /b 1
)

set "JVFILE=%TEMP%\medilab-jv-%RANDOM%.txt"
java -version > "%JVFILE%" 2>&1
REM First line looks like: java version "24..." / openjdk version "21..." — match major 24–26 only.
findstr /R /I "version.*2[4-6][.]" "%JVFILE%" >nul
if errorlevel 1 (
  del "%JVFILE%" >nul 2>&1
  exit /b 0
)
del "%JVFILE%" >nul 2>&1

REM PATH points at Java 24+. Prefer Android Studio JBR ^(17/21^) for this session.
set "JBR_AS=C:\Program Files\Android\Android Studio\jbr"
set "JBR_JB=C:\Program Files\JetBrains\Android Studio\jbr"
if not exist "%JBR_AS%\bin\java.exe" goto :jbr_jetbrains
echo.
echo === Using Android Studio JBR for this session ^(PATH had Java 24+^) ===
echo     JAVA_HOME=%JBR_AS%
set "JAVA_HOME=%JBR_AS%"
set "PATH=%JAVA_HOME%\bin;%PATH%"
goto :recheck

:jbr_jetbrains
if not exist "%JBR_JB%\bin\java.exe" goto :jbr_missing
echo.
echo === Using Android Studio JBR for this session ^(PATH had Java 24+^) ===
echo     JAVA_HOME=%JBR_JB%
set "JAVA_HOME=%JBR_JB%"
set "PATH=%JAVA_HOME%\bin;%PATH%"
goto :recheck

:jbr_missing
echo.
echo === Wrong Java version for Android native build ===
java -version 2>&1
echo.
echo Use JDK 17 or 21 ^(not 24+^). Install Android Studio or set JAVA_HOME, then retry.
echo Examples ^(this window only^):
echo   CMD:
echo     set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
echo     set "PATH=%%JAVA_HOME%%\bin;%%PATH%%"
echo   PowerShell:
echo     $env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
echo     $env:Path = "$env:JAVA_HOME\bin;$env:Path"
echo.
echo Then run: npx expo run:android   ^(or app\run-android.bat^)
echo.
exit /b 1

:recheck
set "JVFILE=%TEMP%\medilab-jv-%RANDOM%.txt"
"%JAVA_HOME%\bin\java.exe" -version > "%JVFILE%" 2>&1
findstr /R /I "version.*2[4-6][.]" "%JVFILE%" >nul
if errorlevel 1 (
  del "%JVFILE%" >nul 2>&1
  exit /b 0
)
del "%JVFILE%" >nul 2>&1
echo After switching to JBR, java still reports 24+. Check PATH and JAVA_HOME.
exit /b 1
