# be-56 — Modern Clinic Portal UI (Operator Sidebar Shell)

**Status:** needs-review (implemented 2026-08-28 — evidence below; website deploy pending owner)  
**Model to implement:** Auto (portal CSS + shell markup + view switching + i18n)  
**Authored by:** Owner (2026-08-28 — bring Operator console's modern sidebar UI layout to the Clinic portal)  
**Depends on:** be-25 (clinic portal UI), be-55 (macro trends report)  
**Pairs with:** `website/clinic/index.html`, `website/clinic/clinic-portal.css`, `website/clinic/clinic-i18n.js`

## Problem

The Operator console (`website/admin/index.html`) has a modern, clean sidebar shell layout with backdrop blur, polished nav buttons with badge icons, view headers with email chip, and structured cards. In contrast, the Clinic portal (`website/clinic/index.html`) had a stacked single-column layout with accordion `<details>` dropdowns for usage, billing, and clinic settings, which felt dated.

## Goal

- Redesign the main Clinic portal (`website/clinic/index.html`) with the same modern sidebar layout as the Operator console.
- Sidebar navigation sections:
  1. **Patients** (Active worklist, filters, invite & cover AI strips)
  2. **Macro Trends** (Target vs Actual 7d/14d clinic-wide report)
  3. **AI Usage** (Token usage, breakdown, and event logs)
  4. **Billing** (Token balance, credit reload, invoices)
  5. **My Clinic** (Clinic profile & display name settings)
- Sidebar footer with Language picker, Theme / Appearance picker, and Sign out button.
- Topbar displaying the active view title, lead description, and user email chip + balance chip.
- Responsive mobile navigation when screen width is ≤ 900px.
- Preserves full RTL (Hebrew, Arabic) and LTR (English, etc.) compatibility and Dark/Light theme switching.

## Files

| File | Purpose |
|---|---|
| `website/clinic/index.html` | Portal shell layout with sidebar, navigation tabs, views, and view switching |
| `website/clinic/clinic-portal.css` | Shell styles, sidebar styling, card styles, topbar, responsive layout |
| `website/clinic/clinic-i18n.js` | Tab titles, navigation labels, and descriptions |
