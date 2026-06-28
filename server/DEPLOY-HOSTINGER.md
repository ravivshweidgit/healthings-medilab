# Healthings API — Hostinger VPS deploy

Phase 1: email OTP auth only. See `prompts/backend/prompt-be-02-accounts-auth.md`.

## Prerequisites

- Hostinger **VPS** (not shared hosting) — Ubuntu 22.04+
- Domain DNS: `api.healthings.ai` → VPS public IP
- Optional: Hostinger email mailbox for SMTP OTP

## 1. Server packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 2. PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER healthings WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE healthings OWNER healthings;
SQL
```

## 3. Deploy app

```bash
sudo mkdir -p /opt/healthings-api
sudo chown $USER:$USER /opt/healthings-api
cd /opt/healthings-api
git clone https://github.com/ravivshweidgit/healthings-medilab.git .
cd server
npm ci
npm run build
cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET, SMTP_*
npm run migrate
```

Generate JWT secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 4. systemd

```bash
sudo tee /etc/systemd/system/healthings-api.service <<'UNIT'
[Unit]
Description=Healthings API
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/healthings-api/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node dist/index.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
UNIT

sudo systemctl daemon-reload
sudo systemctl enable healthings-api
sudo systemctl start healthings-api
```

## 5. nginx + TLS

```bash
sudo tee /etc/nginx/sites-available/healthings-api <<'NGINX'
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

sudo ln -sf /etc/nginx/sites-available/healthings-api /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d api.healthings.ai
```

## 6. SMTP (Hostinger mailbox)

In `.env`:

```
SMTP_MODE=smtp
SMTP_HOST=smtp.hostinger.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=otp@yourdomain.com
SMTP_PASS=your-mailbox-password
MAIL_FROM="Healthings <otp@yourdomain.com>"
```

## 7. Smoke test

Quick health check:

```bash
curl https://api.healthings.ai/health
```

Full OTP flow (run on VPS after deploy):

```bash
cd /opt/healthings-api/server
chmod +x scripts/smoke-test.sh

# Step 1 — health only
./scripts/smoke-test.sh

# Step 2 — request OTP
EMAIL=you@example.com ./scripts/smoke-test.sh

# If SMTP_MODE=console, read code from logs:
journalctl -u healthings-api -n 40 --no-pager | grep -i otp

# Step 3 — verify + refresh + logout
EMAIL=you@example.com OTP_CODE=123456 ./scripts/smoke-test.sh
```

Manual curls (same flow):

```bash
curl -X POST https://api.healthings.ai/v1/auth/otp/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","role":"patient"}'

curl -X POST https://api.healthings.ai/v1/auth/otp/verify \
  -H 'Content-Type: application/json' \
  -d '{"email":"you@example.com","code":"123456"}'
```

## Local dev

```bash
cd server
cp .env.example .env
# Start Postgres locally, set DATABASE_URL
npm install
npm run migrate
npm run dev
```
