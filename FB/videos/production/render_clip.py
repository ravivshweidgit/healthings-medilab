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
ART = ROOT / "assets" / "illustrations"
AUDIO = ROOT / "assets" / "audio"
EXPORTS = ROOT / "assets" / "exports"

FPS = 30

# website/tokens.css --surface: the page gradient and phone body live in the
# frame PNG, so the only colour the renderer needs is what sits under the screen.
SCREEN_OFF = "0xFFFFFF"

PREROLL = 1.4   # open card before the first word
TAIL = 3.0      # end card after the last word
XFADE = 0.40    # dissolve straddling each shot boundary

SUB_FONT = "Arial"  # Montserrat carries no Hebrew; --font-text is a system sans anyway

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


def load_alignment(spec: dict) -> list[dict]:
    lang = spec.get("vo_lang", "en")
    path = AUDIO / lang / f"{spec['id']}-align.json"
    if not path.is_file():
        raise SystemExit(
            f"Missing alignment: {path}\n"
            f"Run: python elevenlabs/gen_clip_vo.py --clip {spec['id']}"
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
    langs = [k for k in ("en", "he") if all(k in s for s in spec["segments"])]
    subs: dict[str, list[tuple[float, float, str]]] = {k: [] for k in langs}
    for i, (start, end) in enumerate(times):
        next_start = times[i + 1][0] if i + 1 < len(times) else vo_dur
        span_end = max(end, next_start - 0.06)
        for lang in langs:
            subs[lang].append((start, span_end, spec["segments"][i][lang]))

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
    """Slow push-in. Flat vector art gets a gentler ceiling than a screenshot —
    a hard zoom makes the diagram strokes shimmer."""
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
    src: Path, frame_png: Path, dur: float, index: int, out: Path, layout: Layout
) -> None:
    """Screenshot inside the site's phone mockup. The frame PNG carries the page
    gradient and punches the screen hole, so it overlays the screenshot."""
    frames = max(12, round(dur * FPS))
    cw, ch, cx, cy = layout.shot_crop
    chain = (
        f"[0:v]crop={cw}:{ch}:{cx}:{cy},"
        f"{zoompan(frames, layout.screen_w, layout.screen_h, index, 1.10)}[scr];"
        f"color=c={SCREEN_OFF}:s={layout.w}x{layout.h}:r={FPS}[base];"
        f"[base][scr]overlay={layout.screen_x}:{layout.screen_y}:format=auto[withscreen];"
        f"[withscreen][1:v]overlay=0:0:format=auto,format=yuv420p[v]"
    )
    encode(chain, ["-loop", "1", "-i", str(src), "-loop", "1", "-i", str(frame_png)], frames, out)


def render_full_shot(src: Path, dur: float, index: int, out: Path, layout: Layout) -> None:
    frames = max(12, round(dur * FPS))
    chain = (
        f"[0:v]scale={layout.w}:{layout.h}:force_original_aspect_ratio=increase,"
        f"crop={layout.w}:{layout.h},"
        f"{zoompan(frames, layout.w, layout.h, index, 1.035)},"
        f"format=yuv420p[v]"
    )
    encode(chain, ["-loop", "1", "-i", str(src)], frames, out)


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
    path: Path, subs: list[tuple[float, float, str]], shift: float, layout: Layout
) -> None:
    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: {layout.w}
PlayResY: {layout.h}
WrapStyle: 0
ScaledBorderAndShadow: yes
YCbCr Matrix: TV.709

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,{SUB_FONT},{layout.sub_size},&H004A2B1A,&H000000FF,&H00FFFFFF,&H40C0D0E0,-1,0,0,0,100,100,0,0,1,5,0,2,96,96,{layout.sub_margin_v},1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    rows = []
    for start, end, text in subs:
        safe = text.replace("\\", "\\\\").replace("{", "(").replace("}", ")")
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
    ap.add_argument("--no-subs", action="store_true",
                    help="Skip burned-in subtitles; sidecars are written either way")
    ap.add_argument("--aspect", choices=sorted(LAYOUTS), default="9x16")
    ap.add_argument("--crf", type=int, default=19,
                    help="Lower is better quality. 19 for social upload, 23-24 for the web")
    args = ap.parse_args()
    layout = LAYOUTS[args.aspect]

    spec_path = CLIPS / f"{args.clip}.json"
    if not spec_path.is_file():
        raise SystemExit(f"No spec: {spec_path}")
    spec = json.loads(spec_path.read_text(encoding="utf-8"))

    vo_lang = spec.get("vo_lang", "en")
    subs_lang = spec.get("subs_lang", "he")
    vo = AUDIO / vo_lang / f"{spec['id']}-eq.wav"
    if not vo.is_file():
        raise SystemExit(f"Missing VO: {vo}\nRun: python elevenlabs/gen_clip_vo.py --clip {spec['id']}")

    vo_dur = probe_dur(vo)
    segs = load_alignment(spec)
    shots, subs = build_shots(spec, segs, vo_dur, layout)
    total = PREROLL + vo_dur + TAIL

    sfx = layout.art_suffix
    frame_png = ART / f"phone-frame{sfx}.png"
    card_open = ART / f"card-open{sfx}.png"
    card_end = ART / f"card-end{sfx}.png"
    for required in (frame_png, card_open, card_end):
        if not required.is_file():
            raise SystemExit(
                f"Missing brand asset: {required}\nRun: python production/build_art.py"
            )

    EXPORTS.mkdir(parents=True, exist_ok=True)
    tag = f"{vo_lang}" + ("" if args.no_subs else f"-sub{subs_lang}")
    out = EXPORTS / f"{spec['id']}-{tag}-{layout.name}.mp4"

    print(f"clip={spec['id']} {layout.name} vo={vo_dur:.1f}s "
          f"shots={len(shots)} total={total:.1f}s")

    with tempfile.TemporaryDirectory(prefix="hm-render-") as tmp:
        tmp_path = Path(tmp)
        spans = [PREROLL] + [s.dur for s in shots] + [TAIL]
        durs, offsets, trans = xfade_chain(spans)

        parts: list[Path] = []
        for i, dur in enumerate(durs):
            part = tmp_path / f"part-{i:02d}.mp4"
            if i == 0:
                render_full_shot(card_open, dur, 0, part, layout)
                print(f"  open  {dur:5.1f}s {card_open.name}")
            elif i == len(durs) - 1:
                render_full_shot(card_end, dur, 1, part, layout)
                print(f"  end   {dur:5.1f}s {card_end.name}")
            else:
                shot = shots[i - 1]
                if shot.kind == "phone":
                    render_phone_shot(shot.path, frame_png, dur, i, part, layout)
                else:
                    render_full_shot(shot.path, dur, i, part, layout)
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
            write_srt(EXPORTS / f"{spec['id']}-{lang}.srt", lines, PREROLL)
            write_vtt(EXPORTS / f"{spec['id']}-{lang}.vtt", lines, PREROLL)
        print(f"  sidecars: {', '.join(sorted(subs))} (.srt + .vtt)")

        v_chain = f"[0:v]trim=duration={total:.3f},setpts=PTS-STARTPTS,fps={FPS}"
        if not args.no_subs:
            if subs_lang not in subs:
                raise SystemExit(f"Spec has no '{subs_lang}' text to burn")
            ass_path = tmp_path / "subs.ass"
            write_ass(ass_path, subs[subs_lang], PREROLL, layout)
            v_chain += (
                f",subtitles='{escape_filter_path(ass_path)}'"
                f":fontsdir='{escape_filter_path(Path('C:/Windows/Fonts'))}'"
            )
            print(f"  burned {subs_lang}: {len(subs[subs_lang])} lines")
        v_chain += (
            f",fade=t=in:st=0:d=0.45:color=white"
            f",fade=t=out:st={total - 0.6:.3f}:d=0.6:color=white"
            f",format=yuv420p[v]"
        )

        pre_ms = int(PREROLL * 1000)
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
            a_chain += (
                f";[2:a]volume={args.music_level},atrim=0:{headroom:.3f},asetpts=N/SR/TB,"
                f"aformat=sample_fmts=fltp:sample_rates=48000:channel_layouts=stereo[bed]"
                f";[bed][vo]sidechaincompress=threshold=0.03:ratio=14:attack=12:release=320[duck]"
                f";[duck][vo]amix=inputs=2:normalize=0:duration=first[mix]"
                f";[mix]loudnorm=I=-14:TP=-1.5:LRA=11,apad,atrim=0:{total:.3f},asetpts=N/SR/TB[a]"
            )
            print(f"  music bed: {music.name} @ {args.music_level}")
        else:
            a_chain += (
                f";[vo]loudnorm=I=-14:TP=-1.5:LRA=11,apad,atrim=0:{total:.3f},asetpts=N/SR/TB[a]"
            )

        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error",
            *inputs,
            "-filter_complex", f"{v_chain};{a_chain}",
            "-map", "[v]", "-map", "[a]",
            "-c:v", "libx264", "-preset", "slow", "-crf", str(args.crf), "-profile:v", "high",
            "-c:a", "aac", "-b:a", "192k", "-ar", "48000",
            "-movflags", "+faststart",
            "-y", str(out),
        ])

    print(f"OK {out} ({total:.1f}s, {out.stat().st_size / 1024 / 1024:.1f} MB)")


if __name__ == "__main__":
    main()
