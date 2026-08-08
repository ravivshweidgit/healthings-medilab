"""Copy prompt107 catalog mp4s into website/videos/{en,de,fr}/ and write watch HTML.

Usage (from repo root):
  python FB/videos/production/publish_explainers.py

Then deploy: bash server/scripts/deploy-website.sh
mp4s under website/videos/{en,de,fr}/ are gitignored — publish on the deploy machine.
"""
from __future__ import annotations

import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
EXPORTS = ROOT / "FB" / "videos" / "assets" / "exports"
WEB = ROOT / "website"

# Stable id → (export_dir, clip file stem)
CATALOG: dict[str, tuple[str, str]] = {
    "what-is-healthings": ("002-what-is-healthings", "06-what-is-healthings"),
    "phone-health": ("010-phone-health", "10-phone-health"),
    "cgm-pipeline": ("011-cgm-pipeline", "11-cgm-pipeline"),
    "gear": ("006-gear", "03-gear"),
    "scale-choice": ("013-scale-choice", "13-scale-choice"),
    "scale-trends": ("012-scale-trends", "12-scale-trends"),
    "meal-entry": ("009-meal-entry", "09-meal-entry"),
    "meal-grams": ("008-meal-logging", "08-meal-logging"),
    "activity-youtube": ("003-activity-youtube", "07-activity-youtube"),
    "closed-loop": ("001-closed-loop", "05-closed-loop"),
}

FR_ONLY = {"phone-health", "cgm-pipeline"}

TITLES = {
    "en": {
        "what-is-healthings": "What is Healthings",
        "phone-health": "Phone health — who writes, who reads",
        "cgm-pipeline": "Live CGM pipeline",
        "gear": "Connect scale, watch, CGM",
        "scale-choice": "Withings scale — Yes or No",
        "scale-trends": "Scale, body composition, energy",
        "meal-entry": "How to log a meal",
        "meal-grams": "Adjust meal grams",
        "activity-youtube": "Activity from YouTube",
        "closed-loop": "The closed loop",
    },
    "de": {
        "what-is-healthings": "Was ist Healthings",
        "phone-health": "Telefon-Gesundheit — wer schreibt, wer liest",
        "cgm-pipeline": "Live-CGM-Pipeline",
        "gear": "Waage, Uhr, CGM verbinden",
        "scale-choice": "Withings-Waage — Ja oder Nein",
        "scale-trends": "Waage, Körperzusammensetzung, Energie",
        "meal-entry": "Mahlzeit protokollieren",
        "meal-grams": "Gramm einstellen",
        "activity-youtube": "Aktivität von YouTube",
        "closed-loop": "Der geschlossene Kreislauf",
    },
    "fr": {
        "what-is-healthings": "Qu’est-ce que Healthings",
        "phone-health": "Santé du téléphone — qui écrit, qui lit",
        "cgm-pipeline": "Pipeline CGM en direct",
        "gear": "Connecter balance, montre, CGM",
        "scale-choice": "Balance Withings — Oui ou Non",
        "scale-trends": "Balance, composition corporelle, énergie",
        "meal-entry": "Comment enregistrer un repas",
        "meal-grams": "Ajuster les grammes",
        "activity-youtube": "Activité depuis YouTube",
        "closed-loop": "La boucle fermée",
    },
}

BACK = {"en": "← Help", "de": "← Hilfe", "fr": "← Aide"}
WATCH = {"en": "Watch", "de": "Ansehen", "fr": "Regarder"}


def src_mp4(export_dir: str, stem: str, media: str) -> Path:
    folder = EXPORTS / export_dir
    if media == "en":
        name = f"{stem}-en-subhe-9x16.mp4"
    elif media == "de":
        name = f"{stem}-de-subde-9x16.mp4"
    else:
        name = f"{stem}-fr-subfr-9x16.mp4"
    return folder / name


def write_watch_page(loc: str, explainer_id: str, title: str, cache_bust: str = "") -> None:
    out = WEB / loc / "watch" / f"{explainer_id}.html"
    out.parent.mkdir(parents=True, exist_ok=True)
    help_index = f"../help/index.html"
    bust = f"?v={cache_bust}" if cache_bust else ""
    video_src = f"/videos/{loc}/{explainer_id}.mp4{bust}"
    html = f"""<!DOCTYPE html>
<html lang="{loc}" dir="ltr">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="description" content="{title} — Healthings explainer" />
    <title>{title} — Healthings</title>
    <link rel="canonical" href="https://healthings.ai/{loc}/watch/{explainer_id}.html" />
    <link rel="icon" href="../../assets/icon.png" type="image/png" />
    <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="../../tokens.css?v=20260726e" />
    <link rel="stylesheet" href="../../styles.css?v=20260726e" />
    <style>
      .watch-wrap {{ max-width: 420px; margin: 0 auto; padding: 1rem 1rem 2rem; }}
      .watch-video {{
        width: 100%;
        max-height: min(85vh, 720px);
        border-radius: 16px;
        background: #0a1628;
        display: block;
      }}
      .watch-title {{ font-family: Montserrat, system-ui, sans-serif; font-size: 1.15rem; margin: 1rem 0 0.35rem; color: var(--navy, #1A2B4A); }}
      .watch-meta {{ font-size: 0.85rem; color: #5C6B7A; margin-bottom: 0.75rem; }}
      .watch-nav a {{ color: var(--accent, #3D9DD6); font-weight: 600; }}
    </style>
  </head>
  <body>
    <main class="watch-wrap">
      <nav class="watch-nav"><a href="{help_index}">{BACK.get(loc, BACK["en"])}</a></nav>
      <h1 class="watch-title">{title}</h1>
      <p class="watch-meta">{WATCH.get(loc, WATCH["en"])} · Healthings</p>
      <video class="watch-video" controls playsinline preload="metadata" poster="">
        <source src="{video_src}" type="video/mp4" />
      </video>
    </main>
  </body>
</html>
"""
    out.write_text(html, encoding="utf-8")


def main() -> None:
    copied = 0
    for explainer_id, (export_dir, stem) in CATALOG.items():
        for media in ("en", "de", "fr"):
            if media == "fr" and explainer_id not in FR_ONLY:
                continue
            src = src_mp4(export_dir, stem, media)
            if not src.is_file():
                raise SystemExit(f"Missing source: {src}")
            dest_dir = WEB / "videos" / media
            dest_dir.mkdir(parents=True, exist_ok=True)
            dest = dest_dir / f"{explainer_id}.mp4"
            shutil.copy2(src, dest)
            copied += 1
            print(f"OK {dest.relative_to(ROOT)} ({dest.stat().st_size // 1024} KB)")
            title = TITLES[media][explainer_id]
            # Bust 30d nginx mp4 cache when the file changes (watch HTML is no-cache).
            bust = f"{int(dest.stat().st_mtime)}-{dest.stat().st_size}"
            write_watch_page(media, explainer_id, title, cache_bust=bust)
            print(f"   page {media}/watch/{explainer_id}.html")

    readme = WEB / "videos" / "README.md"
    readme.write_text(
        "# Explainer videos (prompt107)\n\n"
        "Stable ids under `en/`, `de/`, `fr/`. Generated by "
        "`python FB/videos/production/publish_explainers.py`.\n\n"
        "mp4s are gitignored — run publish on the machine that deploys the site, "
        "then `bash server/scripts/deploy-website.sh`.\n\n"
        "Watch pages: `/{en|de|fr}/watch/{id}.html`\n",
        encoding="utf-8",
    )
    print(f"\nCopied {copied} mp4s. Watch HTML written.")


if __name__ == "__main__":
    main()
