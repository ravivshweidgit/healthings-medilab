# App prompt specs

Feature specs for the Healthings MediLab React Native app. **Keep in sync with code** — see `.cursor/rules/prompts-workflow.mdc`.

## Layout (number ranges)

Open vs done is unchanged: **open at the range folder root**, **shipped under that range’s `done/`**.

```
prompts/app/
  README.md                 ← this index
  001-099/
    promptNN.txt            ← open / planned (01–99)
    done/
      promptNN.txt          ← shipped
      README.md             ← done index for 01–99
  100-200/
    promptNN.txt            ← open / planned (100–200)
    done/
      promptNN.txt          ← shipped
      README.md             ← done index for 100–200
```

Macros (Gemini dumps, not ship specs): `prompts/macros/`.

| Number | Folder |
|--------|--------|
| 01–99 (incl. suffixes like `40b`, `81b`) | `001-099/` |
| 100–200 | `100-200/` |

When numbering past 200, add the next range folder the same way (e.g. `201-300/`).

## Open / backlog

### 001–099 — see [`001-099/README.md`](./001-099/README.md)

### 100–200 — see [`100-200/README.md`](./100-200/README.md)

## Done indexes

- [`001-099/done/README.md`](./001-099/done/README.md)
- [`100-200/done/README.md`](./100-200/done/README.md)

Recent: **104** Activity Log + favorites (backlog, Samsung first) · **103** meal rule check My Rules only · **102** trend/energy right trim.
