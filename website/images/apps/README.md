# App icons

Marks used to identify an app we point people at. One file so far.

## `xdrip-plus-icon.png`

The xDrip+ app icon — the red half-filled drop, 225×225 PNG on its own opaque
white background. Shown in two places, both generated:

| Where | Size | Why |
|---|---|---|
| `/{lang}/help/xdrip-caresens.html`, above the download button | 76px | The reader is about to sideload an APK. This is what to look for on the home screen afterwards. |
| `/{lang}/downloads/`, on the xDrip+ card | 40px | The only card there that is not a store link, so it is the only one that cannot show its own icon before you install. |

Rounded by CSS (`.help-mark img`, `.dl-icon`) rather than in the file, and the
white background is kept rather than keyed out — knocking out white would leave a
halo along the drop's anti-aliased edge.

**Not a Healthings mark.** xDrip+ comes from
[NightscoutFoundation/xDrip](https://github.com/NightscoutFoundation/xDrip) under
GPL-3.0, and the icon identifies their app on pages that say plainly it is not our
product. Same rule as the APK mirror in `website/downloads/README.md`: unchanged,
attributed, linked to source.

## Why the other apps have no icon here

Google's, Apple's, Samsung's and i-SENS' icons are their brand assets under their
own guidelines. Mirroring them for decoration is a different thing from showing a
mirrored app's own icon, so the downloads cards use text for those. If that ever
changes, get the asset from the vendor's brand page, not from a store screenshot.

Cache-busting: bump `ICON_VER` in `website/scripts/downloads-locale-content.mjs`
and `SHOT_VER` in `website/scripts/help-locale-content.mjs` when a file here is
replaced. Nginx caches images for 30 days.
