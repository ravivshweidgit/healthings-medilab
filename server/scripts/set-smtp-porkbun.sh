#!/bin/bash
# Configure Healthings API OTP email via Porkbun (otp@healthings.ai).
# Run on Hetzner VPS as root — prompts for mailbox password (not stored in shell history).
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/healthings-api/server/.env}"
SMTP_USER="${SMTP_USER:-otp@healthings.ai}"
SMTP_FROM="${SMTP_FROM:-Healthings <otp@healthings.ai>}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE"
  exit 1
fi

echo "Healthings SMTP setup (Porkbun)"
echo "Mailbox: $SMTP_USER"
echo ""
read -r -s -p "Enter mailbox password for $SMTP_USER: " SMTP_PASS
echo ""
if [ -z "$SMTP_PASS" ]; then
  echo "Empty password — aborted."
  exit 1
fi

update_var() {
  local key="$1"
  local val="$2"
  if grep -q "^${key}=" "$ENV_FILE"; then
    sed -i "s|^${key}=.*|${key}=${val}|" "$ENV_FILE"
  else
    echo "${key}=${val}" >> "$ENV_FILE"
  fi
}

update_var SMTP_MODE smtp
update_var SMTP_HOST smtp.porkbun.com
update_var SMTP_PORT 587
update_var SMTP_SECURE false
update_var SMTP_USER "$SMTP_USER"
update_var SMTP_PASS "$SMTP_PASS"
update_var MAIL_FROM "$SMTP_FROM"

chmod 600 "$ENV_FILE"
systemctl restart healthings-api
sleep 1

if systemctl is-active --quiet healthings-api; then
  echo "OK — API restarted with Porkbun SMTP."
  echo "Test: Send code in the app → check inbox."
else
  echo "ERROR — service not running. Check: journalctl -u healthings-api -n 30"
  exit 1
fi
