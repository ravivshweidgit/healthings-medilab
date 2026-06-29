#!/bin/bash
# Copy release APK into website/downloads/ for deploy. Run from repo root.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
APK_SRC="$ROOT/app/android/app/build/outputs/apk/release/app-release.apk"
APK_DST="$ROOT/website/downloads/healthings-medilab.apk"

if [ ! -f "$APK_SRC" ]; then
  echo "Missing release APK. Build first:"
  echo "  cd app/android && ./gradlew assembleRelease --no-build-cache"
  exit 1
fi

cp "$APK_SRC" "$APK_DST"
echo "OK — $(du -h "$APK_DST" | cut -f1) → website/downloads/healthings-medilab.apk"
echo "Deploy: bash server/scripts/deploy-website.sh"
