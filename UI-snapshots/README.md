# UI snapshots

On-device / rendered screenshots for the UI/UX review (`prompts/app/prompt92.txt`, Opus 4.8).

Capture light mode, real data unless noted. Suggested naming:
`passN-screen[-locale][-state].png` — e.g. `pass1-language-gate-he.png`,
`pass2-trend-energy-8d.png`, `pass2-dashboard-collapsed-de.png`.

## Folders by review pass

- `pass1-first-run/` — language gate, Quick Start steps (+ one RTL, one long-text locale)
- `pass2-dashboard/` — full collapsed, each strip expanded (Trend & energy 8d + 32d),
  empty vs data-rich, Refresh idle/loading, one RTL, one long-text
- `pass3-food-log/` — idle, photo confirm, text describe, item edit/delete, edit sheet,
  from-past-meal, add water, one RTL
- `pass4-coach-chat/` — chat entry, open conversation, quick-question chips, My Mentors
- `pass5-website/` — landing hero, full landing (mobile + desktop), help index,
  help article, locale switcher, one RTL help, one pt/it/tr help

## Minimal core set (if not capturing everything up front)

language gate · Quick Start (welcome + profile + one device step) · dashboard collapsed ·
trend & energy expanded · Food Log idle · chat open · website hero + one help page.
