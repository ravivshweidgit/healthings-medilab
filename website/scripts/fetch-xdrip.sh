#!/bin/bash
# Mirror the current xDrip+ release into website/downloads/ for the CareSens help
# topic. Run from repo root, or straight on the VPS inside /opt/healthings-api.
#
# xDrip+ is GPL-3.0 software from the Nightscout community. We serve the upstream
# build byte-for-byte and the help page links to the source — do not repackage or
# resign the APK, that would make us the distributor of a modified
# medical-adjacent app.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DST_DIR="$ROOT/website/downloads"
APK="$DST_DIR/xdrip-plus.apk"
NOTE="$DST_DIR/xdrip-plus-version.txt"

API="https://api.github.com/repos/NightscoutFoundation/xDrip/releases/latest"
RELEASE="$(curl -sfL -H 'User-Agent: healthings-website' "$API")"

TAG="$(printf '%s' "$RELEASE" | grep -o '"tag_name": *"[^"]*"' | head -1 | cut -d'"' -f4)"
# Upstream also publishes variant1..4 builds (alternate app IDs for running two
# copies side by side). A CareSens user wants the plain one.
URL="$(printf '%s' "$RELEASE" \
  | grep -o '"browser_download_url": *"[^"]*"' \
  | cut -d'"' -f4 \
  | grep -E 'xDrip-plus-[0-9]{8}-[0-9a-f]+\.apk$' \
  | head -1)"

if [ -z "$URL" ]; then
  echo "No plain xDrip-plus APK in release ${TAG:-unknown} — check the asset names before mirroring." >&2
  exit 1
fi

mkdir -p "$DST_DIR"
curl -sfL -o "$APK" "$URL"

SHA="$(sha256sum "$APK" | cut -d' ' -f1)"
cat > "$NOTE" <<EOF
xDrip+ mirror on healthings.ai
upstream: $URL
release:  $TAG
file:     $(basename "$URL")
sha256:   $SHA
mirrored: $(date +%F)
licence:  GPL-3.0 - source at https://github.com/NightscoutFoundation/xDrip
EOF

echo "OK — $(du -h "$APK" | cut -f1) → website/downloads/xdrip-plus.apk"
echo "sha256 $SHA"
echo "Deploy: bash server/scripts/deploy-website.sh"
