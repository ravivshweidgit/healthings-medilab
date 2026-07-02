#!/bin/bash
# Deploy static landing site to Hetzner VPS (healthings.ai + www).
# Run on VPS as root after DNS points apex + www to this server.
# See ../DEPLOY-WEBSITE.md
set -euo pipefail

REPO="${REPO:-/opt/healthings-api}"
WEB_ROOT="/var/www/healthings"
SITE_SRC="$REPO/website"

if [ ! -d "$SITE_SRC" ]; then
  echo "Missing $SITE_SRC — git pull in $REPO first."
  exit 1
fi

mkdir -p "$WEB_ROOT/downloads"
rsync -a --delete \
  --exclude 'downloads/*.apk' \
  "$SITE_SRC/" "$WEB_ROOT/"
# Preserve uploaded APK if present; copy new one if in repo working tree
if [ -f "$SITE_SRC/downloads/healthings-medilab.apk" ]; then
  cp "$SITE_SRC/downloads/healthings-medilab.apk" "$WEB_ROOT/downloads/"
fi

chown -R www-data:www-data "$WEB_ROOT"

cat > /etc/nginx/sites-available/healthings-web <<'NGINX'
server {
    listen 80;
    server_name healthings.ai www.healthings.ai;

    root /var/www/healthings;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /v1/ {
        proxy_pass http://127.0.0.1:3000/v1/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /clinic/ {
        try_files $uri $uri/ /clinic/index.html;
    }

    location /downloads/ {
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition 'attachment; filename="healthings-medilab.apk"';
        try_files $uri =404;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/healthings-web /etc/nginx/sites-enabled/

if ! grep -q "healthings.ai" /etc/letsencrypt/renewal/*.conf 2>/dev/null; then
  certbot --nginx -d healthings.ai -d www.healthings.ai \
    --non-interactive --agree-tos --register-unsafely-without-email --redirect
else
  certbot --nginx -d healthings.ai -d www.healthings.ai --non-interactive --expand --redirect || true
fi

nginx -t
systemctl reload nginx

echo "Site: $(curl -sf -o /dev/null -w '%{http_code}' https://healthings.ai/ || echo FAIL)"
if [ -f "$WEB_ROOT/downloads/healthings-medilab.apk" ]; then
  echo "APK:  $(curl -sf -o /dev/null -w '%{http_code}' -I https://healthings.ai/downloads/healthings-medilab.apk || echo FAIL)"
else
  echo "APK:  not uploaded yet — run publish-apk then redeploy"
fi
