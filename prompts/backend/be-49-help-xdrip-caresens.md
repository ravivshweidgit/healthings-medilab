# be-49 — Help topic: xDrip+ for CareSens Air, with the APK on healthings.ai

**Status:** needs-review
**Model to implement:** Auto (structure + regen), copy written by hand for 10 locales
**Authored by:** owner request 2026-08-21 (CareSens screenshots supplied from his phone)
**Depends on:** be-12-help (locale generator), be-26 (10-locale policy)

## Problem

`cgm` is the only glucose topic on the help site and it says one sentence: share your
CGM app with the phone health store. That is true on iPhone and false on Android for
CareSens Air, which does not write to Health Connect at all — it only broadcasts to
xDrip+. An Android CareSens user following the current help gets an empty GLUCOSE
strip and no explanation, and the working chain (CareSens Air → xDrip+ → Health
Connect → Healthings) existed only in a VO script for the explainer video.

The bridge app is also not on the Play Store, so "install xDrip+" previously meant
sending a patient to a GitHub releases page full of nightly builds and five variant
APKs. Owner decision: serve the download from healthings.ai.

## What shipped

New slug `xdrip-caresens` between `cgm` and `withings-link`, so the Quick Start chain
reads CGM → xDrip+ → Link Withings. Ten locales, generated:
`https://healthings.ai/{lang}/help/xdrip-caresens.html`.

Five steps, each ending in something checkable: install the APK, turn on the xDrip+
switch in CareSens Air, set xDrip+ Hardware Data Source to **Companion App**, set the
three Health Connect toggles (Use ON / Send ON / **Get OFF**), then CGM = Yes in
Healthings and refresh. Plus a troubleshooting list — the 15-minute latency, the
CareSens switch, Health Connect app permissions, and battery saver.

Four phone captures from the owner's device, first screenshots any help article
carries: `website/images/help/xdrip-*.png`.

### Download

`/downloads/xdrip-plus.apk`, mirrored unchanged from
[NightscoutFoundation/xDrip](https://github.com/NightscoutFoundation/xDrip) by
`website/scripts/fetch-xdrip.{ps1,sh}`, which also writes
`xdrip-plus-version.txt` (upstream URL, tag, sha256, date). xDrip+ is GPL-3.0, so
mirroring the upstream build with a visible source link is fine; repackaging or
resigning it is not, and the scripts say so.

The bytes come from the release API, never from a phone's Downloads folder — a file
that has been through a device cannot be shown to be the upstream build, and upstream
also publishes `variant1..4` APKs under different app IDs that look almost identical
by name. `fetch-xdrip` matches the plain build only and records its hash.

The pages present xDrip+ as the CareSens integration Healthings uses on Android —
CareSens lined up with Healthings — not as a Nightscout disclaimer. The download note
still links *this build* to `xdrip-plus-version.txt` and the source to GitHub (GPL).
The note is gitignored: committed, it would assert a tag and sha256 that the file
actually being served need not match.

The app's own icon sits above the button, at 76px on a rounded plate. On a store page
the icon is right there before you tap install; a sideload gives you nothing to compare
against, so this is what the reader checks their home screen against afterwards. It is
`alt=""` — the button underneath already names the app, and a second announcement only
makes the page longer to listen to. Attribution and the reason no other app on the site
carries an icon are in `website/images/apps/README.md`.

## Files

| File | Change |
|---|---|
| `website/scripts/help-locale-content.mjs` | `xdrip-caresens` in `HELP_SLUGS`; article ×10; `shot()` + `ltrPlus()` helpers |
| `website/scripts/gen-help-locales.mjs` | `CSS_VER` → `20260821a`, since replaced by the shared `css-version.mjs` (be-50) |
| `website/styles.css` | `.help-shot`, `.help-download`, `.prose .help-download-note`, `.help-mark` |
| `website/images/help/*.png` | 4 captures (2 cropped short) |
| `website/images/apps/xdrip-plus-icon.png` | new — the mark above the download button (also on `/{lang}/downloads/`, be-50) |
| `website/scripts/fetch-xdrip.{ps1,sh}` | new — mirror upstream APK + provenance note |
| `website/downloads/README.md` | documents both APKs |
| `server/scripts/deploy-website.sh` | copy **all** repo APKs; `/downloads/` attachment rule scoped to `.apk`; drop hard-coded `filename=`; probe the xDrip mirror |
| `website/downloads/.gitignore` | ignore the generated provenance note |
| `website/scripts/gen-plates-locales.mjs` | index/meal-logging patches made idempotent and anchored |
| `app/src/i18n/helpUrls.ts` | slug added to `HelpSlug` |
| `app/src/help/AppHelpKnowledge.ts` | regenerated — in-app Help AI now knows the chain |

## Three bugs found on the way

1. **nginx renamed every download.** `location /downloads/` sent
   `Content-Disposition: attachment; filename="healthings-medilab.apk"` for any file
   in the folder. A patient tapping *Download xDrip+* would have received a file
   named like our own app — worse than a broken link, because it installs. The
   parameter is gone; the browser now uses the URL name. The block is also scoped to
   `\.apk$` now, so the provenance note opens as text instead of downloading as a
   nameless Android package.
2. **`xDrip+` painted as `+xDrip` in Hebrew and Arabic.** `+` is bidi-neutral, so at
   the end of a Latin run inside RTL prose it resolves with the paragraph. The `<h1>`
   read like a typo. `ltrPlus()` appends U+200E after the sign. Fixed in title, lead,
   body, captions, and alt text — `<title>` too, which cannot carry markup, which is
   why this is a control character and not `<span dir="ltr">`.
3. **`fetch-xdrip.ps1` would not parse on this machine.** PowerShell 5.1 reads a
   BOM-less script in the machine's ANSI codepage rather than UTF-8; on Hebrew
   Windows that is CP1255, where the em dash's third byte (`0x94`) decodes to a right
   curly quote and PowerShell takes it for a string delimiter. Three dashes in
   comments, and the script died at the first `if`. The file is ASCII-only now, with
   a comment saying why — a BOM would fix it too, but any tool that later rewrites
   the file without one brings the bug back, silently and only on some machines.

Also: re-running `gen-plates-locales.mjs` used to move the Example-plates link to the
top of the help index and add a blank line to `meal-logging.html` each time. The
committed pages had drifted apart across locales because of it (AR had the link
first, EN last). Both patches are now anchored and idempotent; all ten indexes match.

## Verified

- [x] All 16 slugs × 10 locales present; 191 files written, no `missing` warnings
- [x] EN and HE and AR rendered locally: figures, download button, RTL alignment
- [x] `xDrip+` reads correctly in the HE and AR `<h1>` and prose
- [x] Generators run twice → no diff (idempotent)
- [x] Every help index: plates link ×1, xdrip link ×1, no blank list rows
- [ ] Owner reads the Hebrew copy on a phone — voice, not correctness
- [x] Provenance link present once per locale (10/10)
- [x] `fetch-xdrip.ps1` run locally: release `2026.03.01`,
      `xDrip-plus-20260301-805ba04.apk`, 15.91 MB, sha256 `bfc74ebf…90774b`; the zip
      carries `AndroidManifest.xml` declaring package `com.eveningoutpost.dexdrip` —
      the plain build, not a `variant`, so the CareSens broadcast will find it
- [ ] APK on the VPS, deploy smoke: `/downloads/xdrip-plus.apk` 200
- [ ] `/downloads/xdrip-plus-version.txt` opens as text, not as a download
- [ ] A real CareSens Air user walks the five steps and sees the GLUCOSE strip fill

## Not done

- **The APK is not on the VPS yet.** It is fetched into the local working tree and
  gitignored, so it cannot travel with a commit. Either re-run `fetch-xdrip.sh` on the
  server or `scp` the file across, then deploy. Until then the download button 404s,
  and that is the one blocking step before this page is linked from anywhere.
- No app-side link to the topic. (The *website* now links it from the Downloads page —
  see `be-50-website-downloads.md`, which shares this blocking mirror step.) `helpUrls.ts` accepts the slug, but no screen opens
  it; the Gear CGM row and the Quick Start CGM step still point at `cgm`. Needs an
  app batch + phone test, and it should probably be Android-only.
- `cgm.html` still carries its one generic sentence. It now links onward as the next
  topic, but it does not say "Android + CareSens: read this first".
- No explainer video for the chain; `11-cgm-pipeline` covers it in 8 lines of VO.
