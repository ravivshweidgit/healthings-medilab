# ElevenLabs VO — Healthings explainers

Same pattern as `C:\projects\home-hero-video` (Daniel VO → EQ → edit to picture).

## Defaults (from safari project)

| Setting | Value |
|---------|--------|
| Voice (EN) | **Daniel** `onwK4e9ZLuTAKqWW03F9` |
| Model | `eleven_multilingual_v2` |
| Stability / similarity / style | `0.55` / `0.8` / `0.35` + speaker boost |
| EQ (ffmpeg) | same approved chain as safari v5 |

Hebrew Reels: run **auditions** first (`gen_auditions.py`) — Daniel can speak HE via multilingual_v2, but a Hebrew-native voice may win. Pick in `voice-choice.txt`.

## Secrets

**Never commit the API key.**

```text
# preferred (gitignored)
FB/videos/elevenlabs/api-key.local.txt

# or env
$env:ELEVENLABS_API_KEY = "..."

# or reuse safari Drive key path (local only)
G:\My Drive\TanzaniaSafariDeals\elevenlabs\api-key.txt
```

## Commands

From repo root (or `FB/videos/elevenlabs`):

```powershell
# 1) Short auditions (HE + EN sample line × candidate voices)
python FB/videos/elevenlabs/gen_auditions.py

# 2) After you pick a voice — write voice-choice.txt, then generate all clips
python FB/videos/elevenlabs/gen_vo.py --lang he
python FB/videos/elevenlabs/gen_vo.py --lang en

# 3) One clip only
python FB/videos/elevenlabs/gen_vo.py --lang he --clip 05
```

Outputs:

```text
FB/videos/assets/audio/auditions/   ← compare voices
FB/videos/assets/audio/he/          ← clipNN-raw.mp3 + clipNN-eq.wav
FB/videos/assets/audio/en/
```

## Edit

CapCut / ffmpeg: lay `clip05-eq.wav` under picture; keep **burned Hebrew captions** (FB is often muted). Soft music + duck under VO like safari `remix_duck_v5.py` — optional for alpha.

See `production/edit-clip05-capcut.md` (updated for VO).
