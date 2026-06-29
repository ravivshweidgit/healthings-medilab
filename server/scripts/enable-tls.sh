#!/bin/bash
# Enable HTTPS for api.healthings.ai (Certbot + nginx). Run on Hetzner VPS as root.
# Required for the mobile app — it calls https://api.healthings.ai
set -euo pipefail

apt-get update
apt-get install -y certbot python3-certbot-nginx

certbot --nginx -d api.healthings.ai --non-interactive --agree-tos --register-unsafely-without-email --redirect

nginx -t
systemctl reload nginx

echo "HTTPS: $(curl -sf https://api.healthings.ai/health || echo FAILED)"
