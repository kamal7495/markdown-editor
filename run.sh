#!/bin/sh
cd "$(dirname "$0")" || exit 1

if ! command -v java >/dev/null 2>&1; then
  echo ""
  echo "ERROR: No Java installation found on PATH."
  echo "Install a JDK (e.g. https://adoptium.net) and try again."
  echo ""
  exit 1
fi

echo "Building and starting MD Editor..."
echo "First run downloads Gradle and JavaFX - this can take a few minutes."
echo ""

./gradlew --no-daemon run
status=$?
if [ $status -ne 0 ]; then
  echo ""
  echo "MD Editor failed to start - see the error above."
  echo "If it mentions a network timeout, check your internet connection or"
  echo "proxy settings and run this again (it resumes/retries downloads)."
  echo ""
fi
exit $status
