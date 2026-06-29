# Backend — Landing website (healthings.ai)

**Status: backlog** — site scaffold in repo; DNS + VPS deploy pending  
Builds on **prompt-be-01-vision.md** § distribution.

---

## Problem

Mentors and users need a single URL to discover and **download** the app (`healthings.ai`), not only the API subdomain.

## What ships (repo)

| Area | Detail |
|------|--------|
| Static site | `website/index.html` — hero, features, Android download CTA |
| Assets | Brand logo + icon from app |
| APK publish | `website/scripts/publish-apk.ps1` / `.sh` |
| Deploy | `server/scripts/deploy-website.sh` + `DEPLOY-WEBSITE.md` |
| Nginx | `healthings.ai` + `www` → `/var/www/healthings`; `/downloads/` APK MIME |

## UX

- **Download for Android** → `downloads/healthings-medilab.apk`
- Install steps on page (unknown sources, email OTP sign-in)
- Button disabled + message if APK not on server yet
- Alpha badge; mailto `otp@healthings.ai`

## Deploy checklist

- [ ] DNS: apex + `www` → Hetzner VPS
- [ ] `git pull` on VPS + `deploy-website.sh`
- [ ] Certbot TLS for `healthings.ai`, `www.healthings.ai`
- [ ] Publish APK (`publish-apk` + scp or build on CI)
- [ ] Phone: open healthings.ai → download → install → login

## Deferred

- Play Store link when listed
- Mentor sign-up / waitlist form
- iOS TestFlight
- GitHub Releases as alternate APK host

## Related

- **prompt-be-01** — `healthings.ai` landing vision
- **prompt-be-02b** — app login (phone-tested)
