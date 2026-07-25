# 02 — Help site (Opus 5)

**URLs:**  
- https://healthings.ai/en/help/  
- One article under `/en/help/…`  
- RTL: `/he/help/` or `/ar/help/`  
- Long text: `/de/help/` or `/ru/help/`  

**Source of truth:** `website/scripts/help-locale-content.mjs` (+ `gen-help-locales.mjs`)  
**Shared chrome:** usually `website/styles.css` / help templates under `website/{lang}/help/`  
**After this:** `03-privacy.md`

---

## Ask the human for

| Shot | Required |
|------|----------|
| EN help index (desktop + mobile) | yes |
| One EN article (full above-fold + scroll sample) | yes |
| Locale switcher visible | yes |
| One RTL help index or article | yes |
| One DE or RU help index (long strings) | nice-to-have |

---

## Investigate

1. **Index scanability** — Can a tester find “Withings / Quick Start / CGM” in &lt;10s?
2. **Article readability** — Type size, measure (line length), headings, lists, code/paths.
3. **Nav** — Back to index, locale switcher, consistency with landing brand.
4. **RTL** — Mirroring of chrome vs body; broken alignment; switcher usability.
5. **Text expansion** — DE/RU overflow, truncated titles, cramped cards.
6. **Edit path** — For each finding, say **CSS/template** vs **content.mjs + regen**.

---

## Output for this pass

1. Help-only verdict (2–4 sentences).
2. Findings **W…** (continue numbering from pass 01).
3. List of “shared chrome” fixes vs “per-locale content” fixes.
4. Suggested draft split (e.g. help chrome vs one content cleanup) — assign names in `06`.

**Next:** `03-privacy.md`
