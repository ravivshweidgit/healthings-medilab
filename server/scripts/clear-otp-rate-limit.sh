#!/bin/bash
# Clear OTP rate-limit rows for an email (ops / dev).
set -euo pipefail
EMAIL="${1:?Usage: clear-otp-rate-limit.sh email@example.com}"
sudo -u postgres psql healthings -v ON_ERROR_STOP=1 -c \
  "DELETE FROM otp_requests WHERE email = lower(trim('${EMAIL}'));"
