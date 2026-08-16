# Why the portal looked soft on the desk monitor (Opus)

**Short answer:** we did not “render the UI on the PC screen.” We **pasted a low-res screenshot** (1024×508) with the **wrong perspective quad**, then stretched it. That always looks like a sticker.

## Ranked causes

1. **Wrong geometry** — paste missed the real glass and sat too flat on a yawed panel  
2. **Source too small** — 1024×508 already mush; warp only makes it softer  
3. **Aspect stretch** — ~2:1 UI forced into a different panel shape  
4. **No screen physics** — crushed blacks, no glare/reflection/spill, no grain match  
5. **JPEG / soft edges** — compounded the fake look  

## Fix shipped

- **Retired** desk monitor composites  
- Clinic thesis + “sees the week” now use a **full-bleed** portal plate (`clinic-portal-dark-16x9`) — UI is readable and sharp  
- Swiss desks restored as pristine plates (environment only; close still uses week-desk crop)  

## To go further (optional)

Recapture the portal at **1920×1080 @ 2–3× device scale** (Playwright) so the plate is a *downsample*, not an upscale. That is the only path to true “slick glass” if you ever paste onto a monitor again.
