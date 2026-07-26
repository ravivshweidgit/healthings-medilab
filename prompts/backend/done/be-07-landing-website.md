# Backend — Landing website (healthings.ai)

**Status: shipped (2026-06-29)** — live at https://healthings.ai  
Builds on **be-01-vision.md** § distribution.

---

## Problem

Mentors and users need a single URL to discover and **download** the app (`healthings.ai`), not only the API subdomain.

## What ships

| Area | Detail |
|------|--------|
| Static site | `website/index.html` — hero, features, Android download CTA |
| Assets | Brand logo + icon from app |
| APK publish | `website/scripts/publish-apk.ps1` / `.sh` |
| Deploy | `server/scripts/deploy-website.sh` + `DEPLOY-WEBSITE.md` |
| Nginx | `healthings.ai` + `www` → `/var/www/healthings`; `/downloads/` APK MIME |
| Live URLs | https://healthings.ai · https://www.healthings.ai · APK at `/downloads/healthings-medilab.apk` |

## UX

- **Download for Android** → `downloads/healthings-medilab.apk`
- Install steps on page (unknown sources, email OTP sign-in)
- Button disabled + message if APK not on server yet
- Alpha badge; mailto `otp@healthings.ai`

## Deploy checklist

- [x] DNS: apex + `www` A → `178.105.218.202` (Porkbun)
- [x] `git pull` on VPS + `deploy-website.sh`
- [x] Certbot TLS for `healthings.ai`, `www.healthings.ai`
- [x] Publish APK (`publish-apk` + scp to VPS)
- [ ] Phone: open healthings.ai → download → install → login (full path from browser)

## Deferred

- Play Store internal testing → **`prompt47.txt`** (app)
- Play Store public link when listed
- Clinic web portal → **`be-05-clinic-dashboard.md`** (replaces “mentor sign-up” waitlist)
- iOS TestFlight
- GitHub Releases as alternate APK host
- Remove optional `*.healthings.ai` → `pixie.porkbun.com` wildcard in Porkbun

## Related

- **be-01** — `healthings.ai` landing vision
- **be-02b** — app login (phone-tested)
