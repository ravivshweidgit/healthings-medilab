"""Render a Healthings explainer clip at publish quality.

Reads a clip spec (clips/<id>.json) plus the ElevenLabs alignment produced by
elevenlabs/gen_clip_vo.py, then renders 1080x1920 H.264 with:

  - screenshots composited inside a branded phone frame (no crops, no status bars)
  - shot changes cut on real speech boundaries from the VO alignment
  - burned subtitles timed to the same boundaries (+ .srt sidecar)
  - branded open / end cards
  - optional music bed ducked under the voice
  - EBU R128 loudness normalisation for social autoplay

Usage:
  python render_clip.py --clip 06-what-is-healthings
  python render_clip.py --clip 05-closed-loop --music "path\\to\\bed.mp3"
  python render_clip.py --clip 06-what-is-healthings --aspect 16x9 --no-subs --crf 24
"""
from __future__ import annotations

import argparse
import json
import subprocess
import tempfile
from dataclasses import dataclass
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLIPS = ROOT / "clips"
STILLS = ROOT / "assets" / "screens" / "stills"
SCREENS = ROOT / "assets" / "screens"
BROLL = SCREENS / "broll"
ART = ROOT / "assets" / "illustrations"
AUDIO = ROOT / "assets" / "audio"
EXPORTS = ROOT / "assets" / "exports"
FONTS = ROOT / "assets" / "fonts"

FPS = 30

# website/tokens.css --surface: the page gradient and phone body live in the
# frame PNG, so the only colour the renderer needs is what sits under the screen.
SCREEN_OFF = "0xFFFFFF"

PREROLL = 1.4   # open card before the first word (override via --preroll / spec)
TAIL = 3.0      # end card after the last word (override via --tail / spec)
XFADE = 0.40    # dissolve straddling each shot boundary

# Burned subs: Noto (vendored) — Hebrew burns + Latin glossary; outline style (no band).
SUB_FONT_HE = "Noto Sans Hebrew"
SUB_FONT_LATIN = "Noto Sans"


def sub_font_for(lang: str) -> str:
    return SUB_FONT_HE if lang == "he" else SUB_FONT_LATIN

# Phone captures are 1080x2400; the status and nav bars are trimmed off so what
# is left matches the screen cutout aspect exactly.
CAPTURE_W, CAPTURE_TRIM_TOP = 1080, 150


@dataclass(frozen=True)
class Layout:
    """One output shape. Screen geometry must match the matching phone-frame SVG."""
    name: str
    w: int
    h: int
    screen_x: int
    screen_y: int
    screen_w: int
    screen_h: int
    sub_size: int
    sub_margin_v: int

    @property
    def art_suffix(self) -> str:
        """9x16 art is unsuffixed — it was drawn first and every spec names it."""
        return "" if self.name == "9x16" else f"-{self.name}"

    @property
    def shot_crop(self) -> tuple[int, int, int, int]:
        crop_h = round(CAPTURE_W * self.screen_h / self.screen_w)
        return CAPTURE_W, crop_h - crop_h % 2, 0, CAPTURE_TRIM_TOP


LAYOUTS = {
    "9x16": Layout("9x16", 1080, 1920, 200, 242, 680, 1300, 54, 150),
    # A whole 19.5:9 handset inside a 16:9 frame shrinks to ~215px once the page
    # scales the video down, and the app UI stops being readable — which is the
    # only reason the shot exists. So the phone runs off the bottom edge instead.
    "16x9": Layout("16x9", 1920, 1080, 600, 105, 720, 1376, 40, 60),
}


def run(args: list[str]) -> None:
    proc = subprocess.run(args, capture_output=True, text=True)
    if proc.returncode != 0:
        raise SystemExit(f"ffmpeg failed:\n{' '.join(map(str, args[:12]))} ...\n{proc.stderr[-1800:]}")


def probe_dur(path: Path) -> float:
    proc = subprocess.run(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration",
         "-of", "default=noprint_wrappers=1:nokey=1", str(path)],
        capture_output=True, text=True,
    )
    if proc.returncode != 0:
        raise SystemExit(f"ffprobe failed on {path}")
    return float(proc.stdout.strip())


def find_shot(kind: str, name: str, layout: Layout) -> Path:
    if kind == "art":
        # Diagrams are composed per shape, so prefer the variant drawn for this
        # layout. Screenshots are shape-agnostic — they sit inside the phone.
        sized = ART / f"{Path(name).stem}{layout.art_suffix}{Path(name).suffix}"
        path = sized if sized.is_file() else ART / name
    elif kind == "broll":
        path = BROLL / name
        if not path.is_file():
            path = SCREENS / name
    else:
        path = STILLS / name
        if not path.is_file():
            path = SCREENS / name
    if not path.is_file():
        raise SystemExit(f"Missing shot asset: {kind}/{name}")
    return path


@dataclass
class Shot:
    kind: str
    path: Path
    start: float
    end: float

    @property
    def dur(self) -> float:
        return max(0.4, self.end - self.start)


def load_alignment(spec: dict, stem: str, *, vo_lang: str | None = None) -> list[dict]:
    lang = vo_lang or spec.get("vo_lang", "en")
    path = AUDIO / lang / f"{stem}-align.json"
    if not path.is_file():
        raise SystemExit(
            f"Missing alignment: {path}\n"
            f"Run: python elevenlabs/gen_clip_vo.py --clip {spec['id']} --lang {lang}"
        )
    data = json.loads(path.read_text(encoding="utf-8"))
    segs = data["segments"]
    if len(segs) != len(spec["segments"]):
        raise SystemExit("Alignment is stale — regenerate with --force after editing the spec.")
    return segs


def proportional_times(spec: dict, vo_dur: float) -> list[tuple[float, float]]:
    weights = [max(1, len(s["en"])) for s in spec["segments"]]
    total = sum(weights)
    out, cursor = [], 0.0
    for w in weights:
        span = vo_dur * w / total
        out.append((cursor, cursor + span))
        cursor += span
    return out


def build_shots(
    spec: dict, segs: list[dict], vo_dur: float, layout: Layout
) -> tuple[list[Shot], dict[str, list[tuple[float, float, str]]]]:
    aligned = all(s.get("start", -1) >= 0 for s in segs)
    if aligned:
        times = [(float(s["start"]), float(s["end"])) for s in segs]
    else:
        times = proportional_times(spec, vo_dur)

    # Subtitle spans, one track per language the spec carries: hold each line
    # until the next one starts. The website needs every language as a sidecar,
    # not just the one that would have been burned in.
    # Include spoken-locale keys (de/fr/…) so native VO cuts can burn same-language
    # subs for hearing accessibility.
    candidate_langs = ("en", "he", "de", "fr", "es", "pt", "it", "ar", "ru", "tr")
    langs = [
        k for k in candidate_langs
        if all((s.get(k) or "").strip() for s in spec["segments"])
    ]
    subs: dict[str, list[tuple[float, float, str]]] = {k: [] for k in langs}
    for i, (start, end) in enumerate(times):
        next_start = times[i + 1][0] if i + 1 < len(times) else vo_dur
        span_end = max(end, next_start - 0.06)
        for lang in langs:
            text = spec["segments"][i][lang]
            # Split multi-sentence captions across the beat (film readability).
            parts = [p.strip() for p in text.replace("? ", "?|").replace(". ", ".|").split("|") if p.strip()]
            if len(parts) >= 2 and len(text) >= 56:
                weights = [max(1, len(p)) for p in parts]
                total_w = sum(weights)
                cursor = start
                for j, part in enumerate(parts):
                    part_end = span_end if j == len(parts) - 1 else cursor + (span_end - start) * weights[j] / total_w
                    subs[lang].append((cursor, part_end, part))
                    cursor = part_end
            else:
                subs[lang].append((start, span_end, text))

    # picture: one shot per segment, merged when consecutive segments share an asset
    shots: list[Shot] = []
    for i, seg in enumerate(spec["segments"]):
        kind = seg["shot"]["type"]
        path = find_shot(kind, seg["shot"]["file"], layout)
        start = 0.0 if i == 0 else times[i][0]
        end = times[i + 1][0] if i + 1 < len(times) else vo_dur
        if shots and shots[-1].path == path and shots[-1].kind == kind:
            shots[-1].end = end
        else:
            shots.append(Shot(kind, path, start, end))
    return shots, subs


def zoompan(frames: int, out_w: int, out_h: int, index: int, zmax: float) -> str:
    """Optional slow push-in + vertical drift (Ken Burns).

    Default path is *static* — zoompan re-samples every frame and makes app UI
    look soft / shaky. Pass zmax > 1 only when you want that living-still feel.
    """
    if zmax <= 1.001:
        return (
            f"scale={out_w}:{out_h}:flags=lanczos,"
            f"fps={FPS},setpts=PTS-STARTPTS,"
            f"trim=end_frame={frames},setpts=PTS-STARTPTS"
        )
    span = max(1, frames - 1)
    rate = (zmax - 1.0) / span
    drift = f"(on/{span})" if index % 2 == 0 else f"(1-on/{span})"
    return (
        f"zoompan=z='min({zmax:.3f},1+{rate:.6f}*on)'"
        f":x='(iw-iw/zoom)/2'"
        f":y='(ih-ih/zoom)*{drift}'"
        f":d={frames}:s={out_w}x{out_h}:fps={FPS}"
    )


def encode(chain: str, inputs: list[str], frames: int, out: Path) -> None:
    run([
        "ffmpeg", "-hide_banner", "-loglevel", "error",
        *inputs,
        "-filter_complex", chain,
        "-map", "[v]", "-frames:v", str(frames),
        "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p",
        "-y", str(out),
    ])


def render_phone_shot(
    src: Path, frame_png: Path, dur: float, index: int, out: Path, layout: Layout,
    *, motion: float = 1.0, screen_off: str = SCREEN_OFF,
) -> None:
    """Screenshot (or short screencap mp4) inside the site's phone mockup.

    The frame PNG carries the page gradient and punches the screen hole, so it
    overlays the screenshot. Video sources loop if shorter than the VO beat;
    Ken Burns stays off for video so the UI stays sharp while the slider moves.
    """
    frames = max(12, round(dur * FPS))
    cw, ch, cx, cy = layout.shot_crop
    is_video = src.suffix.lower() in {".mp4", ".mov", ".webm", ".mkv"}
    frame_in = ["-loop", "1", "-i", str(frame_png)]
    if is_video:
        chain = (
            f"[0:v]crop={cw}:{ch}:{cx}:{cy},"
            f"scale={layout.screen_w}:{layout.screen_h}:flags=lanczos,"
            f"fps={FPS},setpts=PTS-STARTPTS,"
            f"trim=end_frame={frames},setpts=PTS-STARTPTS[scr];"
            f"color=c={screen_off}:s={layout.w}x{layout.h}:r={FPS}[base];"
            f"[base][scr]overlay={layout.screen_x}:{layout.screen_y}:format=auto[withscreen];"
            f"[withscreen][1:v]overlay=0:0:format=auto,format=yuv420p[v]"
        )
        encode(chain, ["-stream_loop", "-1", "-i", str(src), *frame_in], frames, out)
        return
    chain = (
        f"[0:v]crop={cw}:{ch}:{cx}:{cy},"
        f"{zoompan(frames, layout.screen_w, layout.screen_h, index, motion)}[scr];"
        f"color=c={screen_off}:s={layout.w}x{layout.h}:r={FPS}[base];"
        f"[base][scr]overlay={layout.screen_x}:{layout.screen_y}:format=auto[withscreen];"
        f"[withscreen][1:v]overlay=0:0:format=auto,format=yuv420p[v]"
    )
    encode(chain, ["-loop", "1", "-i", str(src), *frame_in], frames, out)


def render_full_shot(
    src: Path, dur: float, index: int, out: Path, layout: Layout, *, motion: float = 1.0,
) -> None:
    frames = max(12, round(dur * FPS))
    chain = (
        f"[0:v]scale={layout.w}:{layout.h}:force_original_aspect_ratio=increase:flags=lanczos,"
        f"crop={layout.w}:{layout.h},"
        f"{zoompan(frames, layout.w, layout.h, index, motion)},"
        f"format=yuv420p[v]"
    )
    encode(chain, ["-loop", "1", "-i", str(src)], frames, out)


def render_broll_shot(
    src: Path, dur: float, index: int, out: Path, layout: Layout, *, motion: float = 1.0,
) -> None:
    """Full-bleed motion from a short mp4 (YouTube workout flash). Loops if short."""
    frames = max(12, round(dur * FPS))
    # Source already moves — extra zoompan only softens the picture.
    if motion <= 1.001:
        chain = (
            f"[0:v]scale={layout.w}:{layout.h}:force_original_aspect_ratio=increase:flags=lanczos,"
            f"crop={layout.w}:{layout.h},"
            f"fps={FPS},setpts=PTS-STARTPTS,"
            f"trim=end_frame={frames},setpts=PTS-STARTPTS,"
            f"format=yuv420p[v]"
        )
    else:
        chain = (
            f"[0:v]scale={layout.w}:{layout.h}:force_original_aspect_ratio=increase:flags=lanczos,"
            f"crop={layout.w}:{layout.h},"
            f"fps={FPS},setpts=PTS-STARTPTS,"
            f"{zoompan(frames, layout.w, layout.h, index, motion)},"
            f"format=yuv420p[v]"
        )
    encode(
        chain,
        ["-stream_loop", "-1", "-i", str(src)],
        frames,
        out,
    )


def xfade_chain(spans: list[float]) -> tuple[list[float], list[float], list[float]]:
    """Plan dissolves that straddle each boundary instead of butting parts together.

    Every cut lands on a word boundary from the VO alignment, so the dissolve is
    centred on it: each part is rendered long enough to supply half a transition
    at both ends, and the accumulated xfade offsets keep the boundary times exact.
    """
    n = len(spans)
    trans = [0.0] * n  # trans[i] = dissolve at the boundary entering part i
    for i in range(1, n):
        trans[i] = min(XFADE, 0.4 * spans[i - 1], 0.4 * spans[i])

    durs, offsets, bounds = [], [], []
    cursor = 0.0
    for i, span in enumerate(spans):
        bounds.append(cursor)
        head = trans[i] / 2
        tail = trans[i + 1] / 2 if i + 1 < n else 0.0
        durs.append(span + head + tail)
        cursor += span
    for i in range(1, n):
        offsets.append(bounds[i] - trans[i] / 2)
    return durs, offsets, trans[1:]


def ass_time(t: float) -> str:
    t = max(0.0, t)
    return f"{int(t // 3600)}:{int((t % 3600) // 60):02d}:{t % 60:05.2f}"


def srt_time(t: float) -> str:
    t = max(0.0, t)
    ms = int(round((t - int(t)) * 1000))
    return f"{int(t // 3600):02d}:{int((t % 3600) // 60):02d}:{int(t % 60):02d},{ms:03d}"


def write_ass(
    path: Path,
    subs: list[tuple[float, float, str]],
    shift: float,
    layout: Layout,
    *,
    font: str,
    style: str = "brand",
) -> None:
    # brand  — navy fill + thick white edge (social / muted FB)
    # film   — white fill + soft black outline + light shadow (cinema)
    size = layout.sub_size
    margin_v = layout.sub_margin_v
    if style == "film":
        # Broadcast-ish: ~42px @1080p, baseline ~86% (MarginV from bottom).
        size = 42 if layout.h >= 1080 else max(36, round(layout.sub_size * 1.05))
        margin_v = max(120, round(layout.h * 0.12))
        style_line = (
            f"Style: Default,{font},{size},"
            f"&H00F5F5F5,&H000000FF,&H00000000,&H80000000,"
            f"0,0,0,0,100,100,0.6,0,1,2.8,1.4,2,96,96,{margin_v},1"
        )
    else:
        style_line = (
            f"Style: Default,{font},{size},"
            f"&H004A2B1A,&H000000FF,&H00FFFFFF,&H40C0D0E0,"
            f"0,0,0,0,100,100,0,0,1,5,0,2,96,96,{margin_v},1"
        )
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {layout.w}
PlayResY: {layout.h}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
{style_line}

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    rows = []
    for start, end, text in subs:
        safe = text.replace("\\", "\\\\").replace("{", "(").replace("}", ")")
        # Soft wrap long single lines for film burns (ASS \\N).
        if "\\N" not in safe and len(safe) > 48:
            mid = len(safe) // 2
            # Prefer break after punctuation / space near midpoint.
            cut = -1
            for i in range(mid - 18, mid + 18):
                if 0 < i < len(safe) and safe[i] == " ":
                    cut = i
                    break
            if cut > 0:
                safe = safe[:cut].rstrip() + "\\N" + safe[cut + 1 :].lstrip()
        rows.append(
            f"Dialogue: 0,{ass_time(start + shift)},{ass_time(end + shift)},Default,,0,0,0,,{safe}"
        )
    path.write_text(header + "\n".join(rows) + "\n", encoding="utf-8-sig")


def write_srt(path: Path, subs: list[tuple[float, float, str]], shift: float) -> None:
    blocks = []
    for i, (start, end, text) in enumerate(subs, 1):
        blocks.append(f"{i}\n{srt_time(start + shift)} --> {srt_time(end + shift)}\n{text}\n")
    path.write_text("\n".join(blocks), encoding="utf-8")


def write_vtt(path: Path, subs: list[tuple[float, float, str]], shift: float) -> None:
    """WebVTT for <track> on the site — the browser renders it in the visitor's
    own language, which burned-in pixels cannot do. Bidi is left to the browser;
    Hebrew and Arabic cues resolve from their own first strong character."""
    blocks = ["WEBVTT", ""]
    for start, end, text in subs:
        stamp = f"{srt_time(start + shift)} --> {srt_time(end + shift)}".replace(",", ".")
        blocks.append(f"{stamp} align:center line:88%")
        blocks.append(text)
        blocks.append("")
    path.write_text("\n".join(blocks), encoding="utf-8")


def escape_filter_path(path: Path) -> str:
    return path.as_posix().replace(":", "\\:").replace("'", r"\'")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--clip", required=True)
    ap.add_argument("--music", help="Optional music bed (ducked under the voice)")
    ap.add_argument("--music-level", type=float, default=0.22)
    ap.add_argument(
        "--music-fade-in",
        type=float,
        default=0.55,
        help="Seconds for music bed fade-in (0 disables)",
    )
    ap.add_argument("--no-subs", action="store_true",
                    help="Skip burned-in subtitles; sidecars are written either way")
    ap.add_argument("--aspect", choices=sorted(LAYOUTS), default="9x16")
    ap.add_argument("--crf", type=int, default=19,
                    help="Lower is better quality. 16–17 for dark brand films, 19 social, 23–24 web")
    ap.add_argument(
        "--vo-tag",
        help="Use side-by-side VO from gen_clip_vo.py --tag (e.g. sarah). "
             "Writes <id>-…-<tag>.mp4 so the Daniel cut stays.",
    )
    ap.add_argument(
        "--motion",
        type=float,
        default=1.0,
        help="Ken Burns peak zoom (1.0 = sharp locked frame; try 1.06 for a soft push). "
             "Old shaky look was ~1.10 on phone stills.",
    )
    ap.add_argument(
        "--vo-lang",
        help="Override VO language folder / alignment (e.g. de). Default: spec vo_lang",
    )
    ap.add_argument(
        "--subs-lang",
        help="Burned subtitle language (e.g. de). Default: same as --vo-lang when not en; "
             "else spec subs_lang (usually he). Use with native VO so hard-of-hearing viewers "
             "can read in the spoken language.",
    )
    ap.add_argument(
        "--preroll",
        type=float,
        help="Open logo hold seconds (default 1.4; brand films ~3.0–3.5)",
    )
    ap.add_argument(
        "--tail",
        type=float,
        help="End logo hold seconds (default 3.0; brand closers ~3.5–4.5)",
    )
    ap.add_argument(
        "--outro-fade",
        type=float,
        help="Slow fade-out at the end (picture + music). Default 0.6; brand ~3–4s",
    )
    ap.add_argument(
        "--cards",
        choices=("default", "dark"),
        help="Card art variant. dark → card-open-dark-{aspect}.png",
    )
    ap.add_argument(
        "--subs-style",
        choices=("brand", "film"),
        help="Burned caption look. film = white + soft black edge (cinema). Default brand.",
    )
    args = ap.parse_args()
    layout = LAYOUTS[args.aspect]

    spec_path = CLIPS / f"{args.clip}.json"
    if not spec_path.is_file():
        raise SystemExit(f"No spec: {spec_path}")
    spec = json.loads(spec_path.read_text(encoding="utf-8"))

    preroll = float(args.preroll if args.preroll is not None else spec.get("preroll", PREROLL))
    tail = float(args.tail if args.tail is not None else spec.get("tail", TAIL))
    cards = args.cards or spec.get("cards", "default")
    subs_style = args.subs_style or spec.get("subs_style", "brand")
    outro_fade = float(
        args.outro_fade if args.outro_fade is not None else spec.get("outro_fade", 0.6)
    )
    # Spec may raise quality for dark brand cuts; CLI --crf always wins when passed.
    crf = int(args.crf)
    if args.crf == 19 and "crf" in spec:
        crf = int(spec["crf"])
    if preroll < 0.5 or tail < 0.5:
        raise SystemExit("preroll/tail must be >= 0.5s")
    if outro_fade < 0.3 or outro_fade > tail - 0.2:
        raise SystemExit("outro_fade must be >= 0.3s and leave >= 0.2s of solid end card")

    vo_lang = args.vo_lang or spec.get("vo_lang", "en")
    if args.subs_lang:
        subs_lang = args.subs_lang
    elif vo_lang != "en" and all((s.get(vo_lang) or "").strip() for s in spec["segments"]):
        # Native VO → same-language burned subs (accessibility).
        subs_lang = vo_lang
    else:
        subs_lang = spec.get("subs_lang", "he")
    vo_stem = f"{spec['id']}-{args.vo_tag}" if args.vo_tag else spec["id"]
    vo = AUDIO / vo_lang / f"{vo_stem}-eq.wav"
    if not vo.is_file():
        hint = f" --tag {args.vo_tag}" if args.vo_tag else ""
        raise SystemExit(
            f"Missing VO: {vo}\n"
            f"Run: python elevenlabs/gen_clip_vo.py --clip {spec['id']} --lang {vo_lang}{hint}"
        )

    vo_dur = probe_dur(vo)
    segs = load_alignment(spec, vo_stem, vo_lang=vo_lang)
    shots, subs = build_shots(spec, segs, vo_dur, layout)
    total = preroll + vo_dur + tail

    sfx = layout.art_suffix
    frame_png = ART / f"phone-frame{sfx}.png"
    screen_off = SCREEN_OFF
    if cards == "dark":
        # Prefer aspect-specific dark cards; fall back to light if missing.
        card_open = ART / f"card-open-dark{sfx}.png"
        card_end = ART / f"card-end-dark{sfx}.png"
        if not card_open.is_file():
            card_open = ART / f"card-open{sfx}.png"
        if not card_end.is_file():
            card_end = ART / f"card-end{sfx}.png"
        dark_frame = ART / f"phone-frame-dark{sfx}.png"
        if dark_frame.is_file():
            frame_png = dark_frame
            screen_off = "0x1C2128"
    else:
        card_open = ART / f"card-open{sfx}.png"
        card_end = ART / f"card-end{sfx}.png"
    for required in (frame_png, card_open, card_end):
        if not required.is_file():
            raise SystemExit(
                f"Missing brand asset: {required}\nRun: python production/build_art.py"
            )

    EXPORTS.mkdir(parents=True, exist_ok=True)
    export_subdir = spec.get("export_dir")
    out_dir = EXPORTS / export_subdir if export_subdir else EXPORTS
    out_dir.mkdir(parents=True, exist_ok=True)
    tag = f"{vo_lang}" + ("" if args.no_subs else f"-sub{subs_lang}")
    voice_suffix = f"-{args.vo_tag}" if args.vo_tag else ""
    out = out_dir / f"{spec['id']}-{tag}-{layout.name}{voice_suffix}.mp4"

    print(f"clip={spec['id']} {layout.name} vo={vo_dur:.1f}s "
          f"shots={len(shots)} total={total:.1f}s open={preroll:.1f}s end={tail:.1f}s "
          f"outro_fade={outro_fade:.1f}s cards={cards}"
          + (f" voice_tag={args.vo_tag}" if args.vo_tag else "")
          + (f" motion={args.motion}" if args.motion > 1.001 else " stable"))

    with tempfile.TemporaryDirectory(prefix="hm-render-") as tmp:
        tmp_path = Path(tmp)
        spans = [preroll] + [s.dur for s in shots] + [tail]
        durs, offsets, trans = xfade_chain(spans)
        motion = args.motion

        parts: list[Path] = []
        for i, dur in enumerate(durs):
            part = tmp_path / f"part-{i:02d}.mp4"
            if i == 0:
                render_full_shot(card_open, dur, 0, part, layout, motion=motion)
                print(f"  open  {dur:5.1f}s {card_open.name}")
            elif i == len(durs) - 1:
                render_full_shot(card_end, dur, 1, part, layout, motion=motion)
                print(f"  end   {dur:5.1f}s {card_end.name}")
            else:
                shot = shots[i - 1]
                if shot.kind == "phone":
                    render_phone_shot(
                        shot.path, frame_png, dur, i, part, layout, motion=motion,
                        screen_off=screen_off,
                    )
                elif shot.kind == "broll":
                    render_broll_shot(shot.path, dur, i, part, layout, motion=motion)
                else:
                    render_full_shot(shot.path, dur, i, part, layout, motion=motion)
                print(f"  shot {i}/{len(shots)} {dur:5.1f}s {shot.kind:5} {shot.path.name}")
            parts.append(part)

        # Dissolve rather than butt-cut: every asset shares the same page gradient,
        # so a crossfade reads as the content changing, not the scene.
        links = []
        prev = "[0:v]"
        for i in range(1, len(parts)):
            label = "[xf]" if i == len(parts) - 1 else f"[x{i}]"
            links.append(
                f"{prev}[{i}:v]xfade=transition=fade"
                f":duration={trans[i - 1]:.3f}:offset={offsets[i - 1]:.3f}{label}"
            )
            prev = label
        part_inputs: list[str] = []
        for p in parts:
            part_inputs += ["-i", str(p)]
        picture = tmp_path / "picture.mp4"
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            *part_inputs,
            "-filter_complex", ";".join(links) + f";[xf]fps={FPS},format=yuv420p[v]",
            "-map", "[v]", "-fps_mode", "cfr", "-r", str(FPS),
            "-c:v", "libx264", "-preset", "medium", "-crf", "17", "-pix_fmt", "yuv420p",
            "-y", str(picture),
        ])

        picture_dur = probe_dur(picture)
        if picture_dur + 0.05 < total:
            print(f"  WARNING picture {picture_dur:.2f}s is short of {total:.2f}s")
        else:
            print(f"  picture {picture_dur:.2f}s (need {total:.2f}s)")

        # Sidecars for every language in the spec, burned or not: the website
        # picks the visitor's language from <track>, so it needs them all.
        for lang, lines in subs.items():
            write_srt(out_dir / f"{spec['id']}-{lang}.srt", lines, preroll)
            write_vtt(out_dir / f"{spec['id']}-{lang}.vtt", lines, preroll)
        print(f"  sidecars: {', '.join(sorted(subs))} (.srt + .vtt) -> {out_dir.name}")

        v_chain = f"[0:v]trim=duration={total:.3f},setpts=PTS-STARTPTS,fps={FPS}"
        if not args.no_subs:
            if subs_lang not in subs:
                raise SystemExit(f"Spec has no '{subs_lang}' text to burn")
            ass_path = tmp_path / "subs.ass"
            font = sub_font_for(subs_lang)
            write_ass(ass_path, subs[subs_lang], preroll, layout, font=font, style=subs_style)
            if not FONTS.is_dir():
                raise SystemExit(f"Missing fonts dir: {FONTS}")
            v_chain += (
                f",subtitles='{escape_filter_path(ass_path)}'"
                f":fontsdir='{escape_filter_path(FONTS)}'"
            )
            print(f"  burned {subs_lang}: {len(subs[subs_lang])} lines · font={font} · style={subs_style}")
        # Dark cards: fade to black so the closer doesn't flash white.
        fade_color = "black" if cards == "dark" else "white"
        fade_start = max(0.0, total - outro_fade)
        v_chain += (
            f",fade=t=in:st=0:d=0.45:color={fade_color}"
            f",fade=t=out:st={fade_start:.3f}:d={outro_fade:.3f}:color={fade_color}"
            f",format=yuv420p[v]"
        )

        pre_ms = int(preroll * 1000)
        # Single-pass loudnorm has lookahead latency and eats the tail, so run it
        # against a generously padded stream and cut to length afterwards.
        headroom = total + 6.0
        inputs = ["-i", str(picture), "-i", str(vo)]
        a_chain = (
            f"[1:a]adelay={pre_ms}|{pre_ms},apad,atrim=0:{headroom:.3f},"
            f"asetpts=N/SR/TB,aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[vo]"
        )
        if args.music:
            music = Path(args.music)
            if not music.is_file():
                raise SystemExit(f"Music not found: {music}")
            inputs = ["-i", str(picture), "-i", str(vo), "-stream_loop", "-1", "-i", str(music)]
            # asplit VO: sidechaincompress + amix each consume a label once
            fade_in = (
                f",afade=t=in:st=0:d={args.music_fade_in:.3f}"
                if args.music_fade_in > 0
                else ""
            )
            fade_out = f",afade=t=out:st={fade_start:.3f}:d={outro_fade:.3f}"
            # Light presence boost so gym riffs cut through under VO
            a_chain += (
                f";[vo]asplit=2[vo_sc][vo_mix]"
                f";[2:a]volume={args.music_level}"
                f",equalizer=f=2200:t=q:w=1.1:g=3.5"
                f",equalizer=f=4500:t=q:w=1.0:g=2.0"
                f"{fade_in}{fade_out},atrim=0:{headroom:.3f},asetpts=N/SR/TB,"
                f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[bed]"
                f";[bed][vo_sc]sidechaincompress=threshold=0.045:ratio=9:attack=8:release=220[duck]"
                f";[duck][vo_mix]amix=inputs=2:normalize=0:duration=first[mix]"
                f";[mix]loudnorm=I=-14:TP=-1.5:LRA=11,"
                f"afade=t=out:st={fade_start:.3f}:d={outro_fade:.3f},"
                f"apad,atrim=0:{total:.3f},asetpts=N/SR/TB[a]"
            )
            print(
                f"  music bed: {music.name} @ {args.music_level}"
                f" fade-in={args.music_fade_in:.2f}s outro_fade={outro_fade:.2f}s"
            )
        else:
            a_chain += (
                f";[vo]loudnorm=I=-14:TP=-1.5:LRA=11,apad,atrim=0:{total:.3f},asetpts=N/SR/TB[a]"
            )

        v_encode = [
            "-c:v", "libx264", "-preset", "slow", "-profile:v", "high",
            "-pix_fmt", "yuv420p",
        ]
        # Dark brand cuts: bitrate target so slate gradients don't band under CRF.
        if cards == "dark" or crf <= 16:
            v_encode += ["-b:v", "8M", "-maxrate", "10M", "-bufsize", "16M"]
        else:
            v_encode += ["-crf", str(crf)]

        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            *inputs,
            "-filter_complex", f"{v_chain};{a_chain}",
            "-map", "[v]", "-map", "[a]",
            *v_encode,
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-movflags", "+faststart",
            "-y", str(out),
        ])

    print(f"OK {out} ({total:.1f}s, {out.stat().st_size / 1024 / 1024:.1f} MB, crf={crf})")


if __name__ == "__main__":
    main()
