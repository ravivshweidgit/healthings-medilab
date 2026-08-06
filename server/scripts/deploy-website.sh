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

SITE_CONF=/etc/nginx/sites-available/healthings-web

# The config below is written in place, so a syntax error would sit in
# sites-available waiting for the next unrelated `systemctl reload nginx` to pick
# it up — long after this script exited. Keep the previous one and roll back.
CONF_BACKUP=""
if [ -f "$SITE_CONF" ]; then
  CONF_BACKUP="$(mktemp)"
  cp "$SITE_CONF" "$CONF_BACKUP"
fi

restore_conf() {
  if [ -n "$CONF_BACKUP" ] && [ -f "$CONF_BACKUP" ]; then
    echo "nginx config rejected — restoring the previous one." >&2
    cp "$CONF_BACKUP" "$SITE_CONF"
  fi
}

cat > "$SITE_CONF" <<'NGINX'
server {
    listen 80;
    server_name healthings.ai www.healthings.ai;

    root /var/www/healthings;
    index index.html;

    # HTML must revalidate on every request. Without this nginx sends only an
    # ETag, browsers apply heuristic freshness, and a returning visitor can sit
    # on a deployed-over landing page for hours. Revalidation is cheap — the
    # ETag still yields a 304. Query-versioned CSS overrides this below.
    add_header Cache-Control "no-cache" always;

    location / {
        try_files $uri $uri/ =404;
    }

    # Legacy English help → canonical /en/help/
    location ^~ /help/ {
        rewrite ^/help/(.*)$ /en/help/$1 permanent;
    }

    location ~* \.(css|js)$ {
        add_header Cache-Control "public, max-age=300";
        try_files $uri =404;
    }

    # WebVTT is absent from nginx's bundled mime.types. Without this the caption
    # tracks on the explainer video are served as application/octet-stream and
    # Safari refuses to load them, so the film ships with no captions at all.
    location ~* \.vtt$ {
        types { }
        default_type text/vtt;
        add_header Cache-Control "public, max-age=300" always;
        try_files $uri =404;
    }

    # Media is versioned by filename, so it can be cached hard. The blanket
    # no-cache above is meant for HTML; left to apply here it would revalidate a
    # 5 MB video on every page view.
    location ~* \.(mp4|webm|jpg|jpeg|png|webp|svg|ico|woff2)$ {
        add_header Cache-Control "public, max-age=2592000" always;
        try_files $uri =404;
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

    location /admin/ {
        try_files $uri $uri/ /admin/index.html;
    }

    location /downloads/ {
        default_type application/vnd.android.package-archive;
        add_header Content-Disposition 'attachment; filename="healthings-medilab.apk"';
        try_files $uri =404;
    }
}
NGINX

ln -sf "$SITE_CONF" /etc/nginx/sites-enabled/

if ! nginx -t; then
  restore_conf
  exit 1
fi

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
