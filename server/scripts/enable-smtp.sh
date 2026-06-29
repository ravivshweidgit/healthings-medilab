#!/bin/bash
# Switch Healthings API from console OTP to real SMTP email.
# Run on Hetzner VPS as root (Hetzner Console → SSH if no local key).
#
# Resend (recommended — works with healthings.ai on Hetzner):
#   SMTP_PASS=re_xxxxxxxx SMTP_FROM="Healthings <otp@healthings.ai>" ./enable-smtp.sh
set -euo pipefail

ENV_FILE="${ENV_FILE:-/opt/healthings-api/server/.env}"

if [ ! -f "$ENV_FILE" ]; then
  echo "Missing $ENV_FILE — run hetzner-bootstrap.sh first."
  exit 1
fi

if [ -z "${SMTP_PASS:-}" ]; then
  echo "Set SMTP_PASS (Resend API key or mailbox password)."
  echo "Example: SMTP_PASS=re_xxx SMTP_FROM='Healthings <otp@healthings.ai>' $0"
  exit 1
fi

SMTP_HOST="${SMTP_HOST:-smtp.resend.com}"
SMTP_PORT="${SMTP_PORT:-465}"
SMTP_USER="${SMTP_USER:-resend}"
SMTP_FROM="${SMTP_FROM:-Healthings <otp@healthings.ai>}"

# Update or append SMTP vars (preserve DATABASE_URL, JWT_SECRET, etc.)
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
update_var SMTP_HOST "$SMTP_HOST"
update_var SMTP_PORT "$SMTP_PORT"
update_var SMTP_SECURE true
update_var SMTP_USER "$SMTP_USER"
update_var SMTP_PASS "$SMTP_PASS"
update_var MAIL_FROM "$SMTP_FROM"

chmod 600 "$ENV_FILE"
systemctl restart healthings-api
sleep 1

if systemctl is-active --quiet healthings-api; then
  echo "OK — healthings-api restarted with SMTP_MODE=smtp"
  echo "MAIL_FROM=$SMTP_FROM"
  echo "Test: tap Send code in the app, check inbox (and spam)."
else
  echo "ERROR — service failed to start. Check: journalctl -u healthings-api -n 30"
  exit 1
fi
