#!/bin/bash
set -euo pipefail

if [ ! -f /root/.healthings_db_pass ]; then
  openssl rand -hex 16 > /root/.healthings_db_pass
  chmod 600 /root/.healthings_db_pass
fi
DB_PASS=$(cat /root/.healthings_db_pass)

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='healthings'" | grep -q 1; then
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE USER healthings WITH PASSWORD '${DB_PASS}';"
  sudo -u postgres psql -v ON_ERROR_STOP=1 -c "CREATE DATABASE healthings OWNER healthings;"
fi

if [ ! -d /opt/healthings-api/.git ]; then
  git clone https://github.com/ravivshweidgit/healthings-medilab.git /opt/healthings-api
fi

cd /opt/healthings-api
git pull --ff-only
cd server
npm ci
npm run build

if [ ! -f .env ]; then
  JWT_SECRET=$(openssl rand -hex 32)
  cat > .env <<ENV
PORT=3000
NODE_ENV=production
DATABASE_URL=postgresql://healthings:${DB_PASS}@localhost:5432/healthings
JWT_SECRET=${JWT_SECRET}
SMTP_MODE=console
CORS_ORIGINS=*
ENV
  chmod 600 .env
fi

npm run migrate

cat > /etc/systemd/system/healthings-api.service <<'UNIT'
[Unit]
Description=Healthings API
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/healthings-api/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable healthings-api
systemctl restart healthings-api

cat > /etc/nginx/sites-available/healthings-api <<'NGINX'
server {
    listen 80;
    server_name api.healthings.ai;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/healthings-api /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

echo "LOCAL: $(curl -s http://127.0.0.1:3000/health)"
echo "PUBLIC_HTTP: $(curl -s http://api.healthings.ai/health)"
