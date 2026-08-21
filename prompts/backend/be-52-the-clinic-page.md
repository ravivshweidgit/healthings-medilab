# be-52 — Healthings main clinic page + one-tap share

**Status:** needs-review
**Model to implement:** Auto (locale generator + nav), copy from owner
**Authored by:** owner request 2026-08-21
**Depends on:** be-12-help (locale generator), be-26 (10-locale policy)

## Problem

Healthings has a main clinic. Michal Habusha is clinic manager and clinical dietitian.
There was no public identity page — homepage **Clinic** opened the staff portal login.

Patients also had to type the clinic email to share. They wanted one tap in Data sharing.

## What shipped

Public pages `/{lang}/the-clinic/` in all ten locales. Identity only: name, license, degrees.
No Share how-to, no Nutritionews, no slogan.

Homepage **Clinic** → `/en/the-clinic/`. Footer **Clinic login** still → `/clinic/`.

Help / Downloads / Plates nav includes the clinic page. Current page is an underline, not bold.
`theme-auto` on those pages follows OS light/dark (picker stays on the staff portal).

App: Data sharing one-tap **Share with Healthings clinic**. Email from `GET /v1/public/app-config`
(`HEALTHINGS_CLINIC_SHARE_EMAIL`, default `habushamichal@gmail.com`).

## Files

| Path | Role |
|------|------|
| `website/scripts/the-clinic-locale-content.mjs` | Copy |
| `website/scripts/gen-the-clinic-locales.mjs` | Generator |
| `website/{lang}/the-clinic/index.html` | Pages |
| `website/index.html` | Header Clinic link |
| `app/src/components/ClinicLinkStrip.tsx` | One-tap |
| `app/src/services/ShareApiService.ts` | `fetchClinicShareEmail` |
| `server/src/index.ts` | `GET /v1/public/app-config` |

## Evidence

- Local: `http://127.0.0.1:8765/he/the-clinic/`
- Live after deploy: `https://healthings.ai/he/the-clinic/`
- Portal unchanged: `https://healthings.ai/clinic/`
