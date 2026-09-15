@echo off
setlocal
cd /d "%~dp0"

where java >nul 2>nul
if errorlevel 1 (
  echo.
  echo ERROR: No Java installation found on PATH.
  echo Install a JDK ^(e.g. https://adoptium.net^) and try again.
  echo.
  pause
  exit /b 1
)

echo Building and starting MD Editor...
echo First run downloads Gradle and JavaFX - this can take a few minutes.
echo.

call gradlew.bat --no-daemon run
if errorlevel 1 (
  echo.
  echo MD Editor failed to start - see the error above.
  echo If it mentions a network timeout, check your internet connection or
  echo proxy settings and run this again ^(it resumes/retries downloads^).
  echo.
  pause
  exit /b 1
)

endlocal
