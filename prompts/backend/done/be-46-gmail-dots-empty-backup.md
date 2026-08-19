# be-46 — Gmail dots alias + empty cloud backup never stored

**Status:** done (2026-08-19) — owner accepted (Play 1.2.39 / API live)  
**Builds on:** prompt60 cloud backup, be-02 auth  
**App half:** [`../../app/100-200/done/prompt115.txt`](../../app/100-200/done/prompt115.txt)

## Problem

Gmail ignores dots in the local part. Healthings stored the typed spelling, so `name.surname@gmail.com` and `namesurname@gmail.com` were two users. A first INSERT of an empty phone created a 0-meal “backup” that hid restore. Plus-tags must stay separate (`user+clinic@` is a different Healthings user).

## What shipped

| Piece | Change |
|-------|--------|
| `gmailDotKey()` | Gmail/googlemail only; strip dots in the mailbox; **keep** `+tag` |
| `users.gmail_canonical` | Indexed (not UNIQUE yet) |
| OTP / `findOrCreateUser` | One sibling + typed spelling missing → send code and **log into the existing user**. 409 only if two Healthings users already share the inbox |
| `upsertCloudBackup` | Recompute fingerprint from payload; reject empty on first insert **and** force |
| `isEmptyish` | 0 meals + 0 CGM + 0 activity + 0 HR |
| `user_cloud_backup_days` | Trigger archives the replaced current, **one gzip per UTC day**, prune after 14 days. App still reads only the live row. Toggle off / account delete cascade-wipes the trail. Seeded existing `prev_*` for users who had one. |

## Deployed

VPS: schema + backfill, auth/users/crypto, empty-backup guard, 14-day history trigger. API health OK 2026-08-19. Monitor trail fill 2026-08-20.

## Related

- prompt60 / prompt115 — Account restore UX
- Do not strip `+` — clinic vs patient emails on the same inbox
