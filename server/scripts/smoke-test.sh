#!/bin/bash
# Healthings API — OTP auth smoke test. See ../DEPLOY-HETZNER.md §2
set -euo pipefail

BASE_URL="${BASE_URL:-https://api.healthings.ai}"
EMAIL="${EMAIL:-}"
OTP_CODE="${OTP_CODE:-}"

echo "=== Healthings API smoke test ==="
echo "BASE_URL=$BASE_URL"

echo ""
echo "1. GET /health"
HEALTH=$(curl -sf "$BASE_URL/health")
echo "$HEALTH"
echo "$HEALTH" | grep -q '"ok":true' || { echo "FAIL: health"; exit 1; }

if [ -z "$EMAIL" ]; then
  echo ""
  echo "Set EMAIL=you@example.com to run OTP flow (optional OTP_CODE=123456 if already sent)."
  exit 0
fi

echo ""
echo "2. POST /v1/auth/otp/request"
curl -sf -X POST "$BASE_URL/v1/auth/otp/request" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"role\":\"patient\"}"
echo ""

if [ -z "$OTP_CODE" ]; then
  echo ""
  echo "OTP sent. If SMTP_MODE=console, run:"
  echo "  journalctl -u healthings-api -n 40 --no-pager | grep -i otp"
  echo "Then re-run: OTP_CODE=123456 EMAIL=$EMAIL $0"
  exit 0
fi

echo ""
echo "3. POST /v1/auth/otp/verify"
VERIFY_JSON=$(curl -sf -X POST "$BASE_URL/v1/auth/otp/verify" \
  -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"code\":\"$OTP_CODE\"}")
echo "$VERIFY_JSON" | head -c 120
echo "..."

ACCESS=$(echo "$VERIFY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
REFRESH=$(echo "$VERIFY_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['refreshToken'])")

echo ""
echo "4. GET /v1/me"
ME=$(curl -sf "$BASE_URL/v1/me" -H "Authorization: Bearer $ACCESS")
echo "$ME"
echo "$ME" | grep -q "$EMAIL" || { echo "FAIL: /me email"; exit 1; }

echo ""
echo "5. POST /v1/auth/refresh"
REFRESH_JSON=$(curl -sf -X POST "$BASE_URL/v1/auth/refresh" \
  -H 'Content-Type: application/json' \
  -d "{\"refreshToken\":\"$REFRESH\"}")
NEW_ACCESS=$(echo "$REFRESH_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")
echo "new access token ok"

echo ""
echo "6. POST /v1/auth/logout"
curl -sf -X POST "$BASE_URL/v1/auth/logout" -H "Authorization: Bearer $NEW_ACCESS"
echo ""

echo ""
echo "=== All steps passed ==="
