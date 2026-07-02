# App prompt specs

Feature specs for the Healthings MediLab React Native app. **Keep in sync with code** — see `.cursor/rules/prompts-workflow.mdc`.

## Ship priority (2026-07-03)

| Order | Prompt | Topic |
|-------|--------|--------|
| **1 — next** | **`prompt54.txt`** | Local-first clinic relay — snapshot nulled on revoke, rules mailbox, stateless chat |
| 2 | `prompt52.txt` | My Rules rawText-only save (optional with 54) |

## Backlog (`prompts/app/`)

| File | Topic |
|------|--------|
| `prompt31.txt` | Source config, Samsung, AI/manual BMR |
| `prompt32.txt` | Backup import QA + hardening |
| `prompt38.txt` | Secondary lab findings (liver, iron, uric acid) |
| `prompt40b.txt` | Day/week meal plans, export, food preferences |
| `prompt46.txt` | Medical rules import + My Rules (medical overrides; conflict feedback) |
| `prompt47.txt` | Play Store internal testing (local-first privacy; AAB + privacy page) |
| `prompt49.txt` | Link to clinic + share encrypted data + sponsored AI badge |
| `prompt52.txt` | My Rules rawText-only save — deprecate summarise-on-save |
| `prompt54.txt` | **NEXT** — Local-first clinic relay (revoke purge, rules mailbox, stateless chat) |

## Done (`prompts/app/done/`)

See [done/README.md](./done/README.md) for the full index.

Recent: **53** nutritionist PDF import (plain-text directive history) · **51** My Rules version history · **48** lipid trend charts.

## Macros reference dumps

`prompts/macros/macro-gemini-prompt_*.txt` — exported Gemini context samples; not ship specs.
