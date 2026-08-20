# be-48 — Last client platform + app build on the user

**Status:** needs-review (implemented 2026-08-20)  
**Model to implement:** Auto  
**Authored by:** Owner (need Android/iOS + build for pilots like Natali)  
**Depends on:** auth + shares worklist  

## Problem

Clinic and support cannot tell whether a patient is on Android or iOS, or which
build they run. `source_config` only guesses activity adapters; `sync_blobs.version`
is a sync sequence, not an APK.

## Goal

- Phone sends `X-Healthings-Platform`, `X-Healthings-App-Version`, `X-Healthings-Build`
  on every `authFetch`.
- Server stores last-seen on `users` (platform, app version, build, seen_at).
- Clinic shares API + worklist + patient banner show e.g. `Android · 1.2.40 (69)`.
- Clinic sync export also embeds `client` for forensics.

## Acceptance

- [ ] Migrate adds the four `last_client_*` columns
- [ ] Authenticated API with headers updates the row
- [ ] `/v1/shares` returns `patientClientPlatform` / AppVersion / Build / SeenAt
- [ ] Portal worklist sync cell shows OS + version when known

## Out of scope

- Full device inventory / multi-device history
- Pushing users to update (nudge copy)

## Agent checklist

- [x] Status → needs-review + evidence in README
- [ ] Do not self-move to done/
