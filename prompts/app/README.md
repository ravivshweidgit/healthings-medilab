# App prompt specs

Feature specs for the Healthings MediLab React Native app. **Keep in sync with code** — see `.cursor/rules/prompts-workflow.mdc`.

## Ship priority (2026-07-03)

| Order | Prompt | Topic |
|-------|--------|--------|
| **1 — next** | **`prompt54.txt`** | Local-first clinic relay — **Share button shipped**; server relay + revoke purge pending |
| 2 | `prompt52.txt` | My Rules rawText-only save (optional with 54) |

## Backlog (`prompts/app/`)

| File | Topic |
|------|--------|
| `prompt31.txt` | Source config spec — **shipped in `done/prompt55.txt`** |
| `prompt32.txt` | Backup import QA + hardening |
| `prompt38.txt` | Secondary lab findings (liver, iron, uric acid) |
| `prompt40b.txt` | Day/week meal plans, export, food preferences |
| `prompt46.txt` | Medical rules import + My Rules (medical overrides; conflict feedback) |
| `prompt47.txt` | Play Store internal testing (local-first privacy; AAB + privacy page) |
| `prompt49.txt` | Link to clinic + share encrypted data + sponsored AI badge |
| `prompt52.txt` | My Rules rawText-only save — deprecate summarise-on-save |

## Done (`prompts/app/done/`)

See [done/README.md](./done/README.md) for the full index.

Recent: **55** Welcome & Quick Start + manual trend/energy · **53** nutritionist PDF import · **51** My Rules version history.

## Macros reference dumps

`prompts/macros/macro-gemini-prompt_*.txt` — exported Gemini context samples; not ship specs.
