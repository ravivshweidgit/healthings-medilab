# Healthings API — Hetzner VPS deploy

Production API: **`https://api.healthings.ai`** (Hetzner VPS, Ubuntu 22.04+).

Phase 1: email OTP auth only. Spec: `prompts/backend/prompt-be-02-accounts-auth.md`.

---

## Prerequisites

- [Hetzner Cloud](https://www.hetzner.com/cloud) VPS (CX22 or similar) — Ubuntu 22.04+
- DNS: `api.healthings.ai` → VPS public IPv4
- SSH as **root** (bootstrap script expects root)

---

## 1. First-time deploy (recommended)

On a fresh VPS, after installing base packages (nginx, postgres, node 20 — see §4 if missing):

```bash
curl -fsSL https://raw.githubusercontent.com/ravivshweidgit/healthings-medilab/main/server/scripts/hetzner-bootstrap.sh -o /tmp/bootstrap.sh
bash /tmp/bootstrap.sh
```

Or from a local clone:

```bash
bash server/scripts/hetzner-bootstrap.sh
```

The script:

- Creates PostgreSQL user `healthings` + database (password in `/root/.healthings_db_pass`)
- Clones repo to `/opt/healthings-api`, `npm ci`, `npm run build`, `npm run migrate`
- Writes `/opt/healthings-api/server/.env` (`SMTP_MODE=console`, JWT secret)
- Installs **systemd** + **nginx** (HTTP on port 80)

### TLS (required before production / HTTPS default)

Bootstrap sets **HTTP only**. The app defaults to `http://` until TLS is enabled.

```bash
bash /opt/healthings-api/server/scripts/enable-tls.sh
# or: certbot --nginx -d api.healthings.ai
```

Then set app `HEALTHINGS_API_URL=https://api.healthings.ai` and remove cleartext network config (see `app/android/.../network_security_config.xml`).

---

## 2. Smoke test

```bash
cd /opt/healthings-api/server
chmod +x scripts/smoke-test.sh

./scripts/smoke-test.sh
EMAIL=you@example.com ./scripts/smoke-test.sh

# OTP in logs while SMTP_MODE=console:
journalctl -u healthings-api -n 40 --no-pager | grep -i otp

EMAIL=you@example.com OTP_CODE=123456 ./scripts/smoke-test.sh
```

---

## 3. Update deploy (code push)

```bash
cd /opt/healthings-api
git pull --ff-only
cd server
npm ci
npm run build
npm run migrate
systemctl restart healthings-api
curl -s https://api.healthings.ai/health
```

---

## 4. Manual setup (reference)

Use only if not running the bootstrap script.

<details>
<summary>Manual steps</summary>

### Packages

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y nginx postgresql postgresql-contrib certbot python3-certbot-nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

### PostgreSQL

```bash
sudo -u postgres psql <<'SQL'
CREATE USER healthings WITH PASSWORD 'STRONG_PASSWORD_HERE';
CREATE DATABASE healthings OWNER healthings;
SQL
```

### App

```bash
sudo mkdir -p /opt/healthings-api
git clone https://github.com/ravivshweidgit/healthings-medilab.git /opt/healthings-api
cd /opt/healthings-api/server
npm ci && npm run build
cp .env.example .env   # edit DATABASE_URL, JWT_SECRET
npm run migrate
```

JWT secret: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`

### systemd + nginx

Same units as `scripts/hetzner-bootstrap.sh` (WorkingDirectory `/opt/healthings-api/server`).

</details>

---

## 5. SMTP (OTP email) — **enable for real mail**

**Alpha default:** `SMTP_MODE=console` — codes only in logs (`journalctl -u healthings-api | grep OTP`).

**To send email now** (Resend — free tier, ~5 min):

1. Sign up at [resend.com](https://resend.com) → **API Keys** → create key (`re_…`)
2. Open **Hetzner Cloud** → your server → **Console** (browser SSH as root)
3. Run (paste your key):

```bash
cd /opt/healthings-api && git pull
SMTP_PASS=re_PASTE_YOUR_KEY_HERE \
SMTP_FROM="Healthings <onboarding@resend.dev>" \
bash server/scripts/enable-smtp.sh
```

Use `onboarding@resend.dev` for first test; then verify **healthings.ai** in Resend (add DNS records where you manage the domain) and set:

```bash
SMTP_PASS=re_xxx SMTP_FROM="Healthings <otp@healthings.ai>" bash server/scripts/enable-smtp.sh
```

**Stack:** API on **Hetzner VPS** · domain **healthings.ai** (Porkbun) · OTP mail via **Porkbun Email Hosting** (`otp@healthings.ai`).

Interactive setup on the VPS (prompts for mailbox password):

```bash
/root/set-smtp-porkbun.sh
```

(Same script in repo: `server/scripts/set-smtp-porkbun.sh`)

---

## 6. Local dev

```bash
cd server
cp .env.example .env
# Local Postgres → DATABASE_URL
npm install
npm run migrate
npm run dev
```

---

## Scripts

| Script | Purpose |
|--------|---------|
| `scripts/hetzner-bootstrap.sh` | First-time VPS setup |
| `scripts/smoke-test.sh` | Health + OTP flow verification |
