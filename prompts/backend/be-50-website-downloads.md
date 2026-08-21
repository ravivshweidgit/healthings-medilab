# be-50 — Downloads page: the companion apps, per phone

**Status:** needs-review
**Model to implement:** Opus (platform matrix + 10-locale copy), regeneration on Auto
**Authored by:** owner request 2026-08-21 — "downloads section: caresens, withings,
xdrip, samsung or apple according to your phone"
**Depends on:** be-49 (xDrip+ mirror + help topic), be-12-help (locale generator),
be-26 (10-locale policy)

## Problem

The site had one install story — two store badges for Healthings on the landing page —
and nothing about the apps that actually carry the data. Everything else a patient
needs was scattered across help articles, and the reader had to already know which
ones applied to their phone.

They mostly don't, and the answer is genuinely different per platform. An Android
CareSens user needs Health Connect *and* xDrip+; the same user on an iPhone needs
neither, because CareSens Air writes to Apple Health by itself. Samsung Health looks
like a device integration and is nothing of the kind — it is a step *writer* into
Health Connect, and useless until the user switches that on inside Samsung Health.
One undifferentiated list would have sent half the readers to install something their
phone cannot use.

## What shipped

`/{lang}/downloads/index.html` in all ten locales, generated. Two lists in one page —
six cards for Android, four for iPhone — with a platform switch above them.

| Card | Android | iPhone |
|---|---|---|
| Healthings | Play internal test | TestFlight |
| Health Connect | **already in Settings** on 14+; Play link as small print for 13 and older | — |
| Apple Health | — | nothing to install, permission only |
| Withings | Play `com.withings.wiscale2` | App Store `id542701020` |
| CareSens Air | Play `com.isens.csair` — keeps readings, needs the bridge | App Store `id1605701892` — shares to Apple Health directly |
| xDrip+ | our mirror, `/downloads/xdrip-plus.apk` | absent, and the page says so |
| Samsung Health | Play `com.sec.android.app.shealth` — step source only, must be enabled inside Samsung Health | absent |

Every card carries one plain sentence about what the app is *for*, a tag (`Start
here` / `Usually needed` / `Only if you have one` / `CareSens integration`), and a link
into the matching help topic.

### Detection, and what happens without it

Both lists are in the HTML; a class on `<body>` hides one. So:

- Android or iPhone user agent → that list, chosen before paint.
- Desktop, or scripting off → **both** lists, which is the honest fallback for a page
  whose whole subject is that the two differ.
- A shared link opens correctly for whoever receives it — nothing is negotiated
  server-side, so no cache or CDN can serve an iPhone list to an Android reader.

Verified by overriding the user agent to a Pixel and to an iPhone and reloading.

### Where it is linked

Landing nav, landing install card, landing footer, and the nav on every generated
help and plates page. `/downloads/` (the binaries folder) now 302s to
`/en/downloads/`, because the nav says "Downloads" and that is the URL people guess.

## Files

| File | Change |
|---|---|
| `website/scripts/downloads-locale-content.mjs` | new — app catalog (store links, per-platform kinds) + copy ×10 |
| `website/scripts/gen-downloads-locales.mjs` | new — page generator, detection script |
| `website/scripts/css-version.mjs` | new — single `CSS_VER` for every generator and hand-written page |
| `website/scripts/gen-help-locales.mjs` | imports shared `CSS_VER`; Downloads in help nav |
| `website/scripts/gen-plates-locales.mjs` | same nav entry, same token |
| `website/scripts/plates-locale-content.mjs` | re-exports the shared token instead of its own |
| `website/styles.css` | `.dl-*` — switch, cards, tags, outline/filled buttons, `.dl-icon` |
| `website/images/apps/xdrip-plus-icon.png` | new — xDrip+ mark, 225×225 |
| `website/images/apps/README.md` | new — provenance, sizes, why only one app has an icon |
| `website/index.html`, `website/privacy.html` | nav + footer links, CSS token |
| `server/scripts/deploy-website.sh` | `/downloads/` → `/en/downloads/` redirect |
| `website/downloads/README.md` | says plainly that the folder is not the page |

## Two things found while building it

1. **Health Connect's card would have lied to most readers.** It started as a plain
   "Get it on Google Play" button, which is correct only on Android 13 and lower —
   from Android 14 Health Connect is a framework module that cannot be installed, so
   the Play listing refuses. The button now reads *Already in Settings (Android 14+)*
   with Play demoted to one line of small print.
2. **The shared CSS token had split into three values** — help on `20260821a`, plates
   on `20260816e`, the landing page mixing `tokens.css?v=20260726e` with
   `styles.css?v=20260815a`. All four load the same two files. A brand-new page can
   therefore inherit a token a returning visitor already has cached from before the
   CSS it needs existed, and render unstyled; this page needed `.dl-*` rules and would
   have been the first victim. One `css-version.mjs`, bumped to `20260821b` — now
   `20260821c` for the icon rules below.

Also: only Healthings keeps a filled button. Six filled buttons made the page read as
six things to install, when five of them depend on owning hardware.

## One icon, on purpose

The xDrip+ card carries the app's own mark; the other five cards carry none. The
asymmetry is the message. A store link shows its icon on the listing before you tap
install — a sideloaded APK shows nothing, so the mark is the reader's only way to check
that the thing on their home screen is the thing this page sent them.

Our own icon was tried on the Healthings card and pulled back out: at 40px it is a
small heart inside a near-white plate, and beside a solid red drop it read as a smudge.
A faint mark on one card is worse than no mark. The vendor icons stay out for a
different reason — they are brand assets under their owners' guidelines, and mirroring
an app's own icon on the page that mirrors the app is not the same act as decorating a
store link with Apple's.

## Verified

- [x] 10 locales × 10 cards, no missing copy key (`undefined` count: 0)
- [x] Auto-detection: Pixel UA → Android list, iPhone UA → iPhone list
- [x] Manual switch works both ways; `aria-pressed` follows
- [x] No class → both lists visible (desktop and no-JS path)
- [x] Store links verified against live listings 2026-08-21 (see catalog comments)
- [x] RTL: Hebrew and Arabic cards right-aligned, tags mirrored, `xDrip+` intact
- [x] Icon mirrors with the card in RTL (mark right of the name, badge on the far left)
- [x] Downloads link present in all 10 help indexes and all 10 plates indexes
- [x] All generators run twice → no diff
- [ ] Owner reads the Hebrew copy on a phone — voice, not correctness
- [ ] Deployed, and the Play/App Store links tapped from a real phone in a real store
      country
- [ ] `/downloads/` redirect confirmed on the VPS after `nginx -t`

## Not done

- **The xDrip+ card 404s until be-49's mirror reaches the VPS.** Same blocking step,
  now with a second page pointing at it.
- No Libre or Dexcom row. Health Connect makes them plausible drop-ins, but nothing in
  the app has been tested against them, and a downloads page is the wrong place to
  imply support.
- iPhone named workouts are still not read from HealthKit (`prompt104`), so the
  Withings card's "workouts" claim is Withings-only on iOS. The card does not say
  otherwise, but it does not spell it out either.
- Google Play badges are used on the landing page and plain text buttons here. If the
  page ever leaves alpha, Google's badge guidelines apply.
