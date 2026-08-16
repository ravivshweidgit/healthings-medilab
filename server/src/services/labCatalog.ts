/**
 * Lab catalog seed + queries (prompt113 / be-43).
 * Countries: full ISO 3166-1 alpha-2 (~249). Display: name_native ?? name_en.
 */

import { query } from '../db/pool.js';
import { ISO_3166_COUNTRIES } from '../data/iso3166Countries.js';

export type LabCountryRow = {
  code: string;
  name_en: string;
  name_native: string | null;
  sort_order: number;
};

export type LabProviderRow = {
  country_code: string;
  code: string;
  name_en: string;
  name_native: string | null;
  sort_order: number;
};

export type LabPromptPackRow = {
  country_code: string;
  provider_code: string;
  kind: 'identify' | 'parse_layout' | 'parse_base' | 'repair';
  version: number;
  body: string;
};

/** Endonyms for markets that match our 10 UI languages (+ keep English name_en). */
const NATIVE_OVERRIDES: Record<string, string> = {
  IL: 'ישראל',
  ES: 'España',
  FR: 'France',
  DE: 'Deutschland',
  SA: 'السعودية',
  AE: 'الإمارات',
  EG: 'مصر',
  RU: 'Россия',
  PT: 'Portugal',
  BR: 'Brasil',
  IT: 'Italia',
  TR: 'Türkiye',
};

/** Pin common / product markets near the top of the picker. */
const SORT_BOOST: Record<string, number> = {
  IL: 10,
  US: 20,
  GB: 30,
  DE: 40,
  FR: 50,
  ES: 60,
  IT: 70,
  TR: 80,
  RU: 90,
  PT: 100,
  BR: 110,
  SA: 120,
  AE: 130,
  EG: 140,
};

export function displayName(nameEn: string, nameNative: string | null | undefined): string {
  const native = nameNative?.trim();
  return native || nameEn;
}

function loadIsoCountries(): Array<{ code: string; nameEn: string }> {
  return ISO_3166_COUNTRIES.filter((r) => /^[A-Z]{2}$/.test(r.code) && r.nameEn?.trim());
}

let catalogSeedPromise: Promise<void> | null = null;

export async function ensureLabCatalogSeeded(): Promise<void> {
  if (!catalogSeedPromise) {
    catalogSeedPromise = seedLabCatalogOnce().catch((err) => {
      catalogSeedPromise = null;
      throw err;
    });
  }
  await catalogSeedPromise;
}

async function seedLabCatalogOnce(): Promise<void> {
  const { rows: countRows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM lab_countries`,
  );
  const countryCount = Number(countRows[0]?.n ?? 0);

  if (countryCount < 200) {
    const countries = loadIsoCountries();
    for (const c of countries) {
      const native = NATIVE_OVERRIDES[c.code] ?? null;
      const sort = SORT_BOOST[c.code] ?? 1000;
      await query(
        `INSERT INTO lab_countries (code, name_en, name_native, sort_order, active)
         VALUES ($1, $2, $3, $4, TRUE)
         ON CONFLICT (code) DO UPDATE SET
           name_en = EXCLUDED.name_en,
           name_native = COALESCE(EXCLUDED.name_native, lab_countries.name_native),
           sort_order = LEAST(lab_countries.sort_order, EXCLUDED.sort_order),
           active = TRUE`,
        [c.code, c.nameEn, native, sort],
      );
    }
  } else {
    for (const [code, native] of Object.entries(NATIVE_OVERRIDES)) {
      await query(
        `UPDATE lab_countries
         SET name_native = COALESCE(name_native, $2),
             sort_order = LEAST(sort_order, $3)
         WHERE code = $1`,
        [code, native, SORT_BOOST[code] ?? 1000],
      );
    }
  }

  await query(
    `INSERT INTO lab_providers (country_code, code, name_en, name_native, sort_order, active) VALUES
       ('IL', 'clalit', 'Clalit', 'כללית', 10, TRUE),
       ('IL', 'meuhedet', 'Meuhedet', 'מאוחדת', 20, TRUE),
       ('IL', 'maccabi', 'Maccabi', 'מכבי', 30, TRUE),
       ('IL', 'leumit', 'Leumit', 'לאומית', 40, TRUE)
     ON CONFLICT (country_code, code) DO UPDATE SET
       name_en = EXCLUDED.name_en,
       name_native = EXCLUDED.name_native,
       sort_order = EXCLUDED.sort_order,
       active = TRUE`,
  );

  await ensurePromptPacksForAllCountries();
}

const PARSE_BASE = `Rules:
- Extract EVERY numeric test row; do not invent tests not in the PDF.
- **Values are sacred:** copy each number EXACTLY as printed (digits and decimal point). Never round, estimate, or invent. If unreadable, skip that row.
- **\`refLow\` / \`refHigh\`:** always fill when the report prints a range (scale ends or norm column).
- **Self-check:** value < refLow → flag low; value > refHigh → high; else normal. If flag text (e.g. "low") disagrees with this math, you mixed value and bound — re-read.
- **\`name\` is ALWAYS canonical clinical English** (e.g. "Glucose", "TSH") — never Hebrew/Russian/app language. Clinicians read this JSON worldwide.
- **\`nameOriginal\` = verbatim PDF label** (any language).
- Specimen date/time → ISO 8601 with local offset.
- panelType: "chemistry", "cbc", or "other".
- **Canonical \`code\` when present:** CREATININE, UREA (or BUN), CHOLESTEROL_LDL, CHOLESTEROL, CHOLESTEROL_HDL, TRIGLYCERIDES, GLUCOSE, HBA1C, TSH. Map any-language labels to these codes — the app matches codes only.
- Other tests: spaces/hyphens → underscore, UPPERCASE.
- flag: "high", "low", "normal", or "unknown".
- Skip non-numeric QC rows (HEMOLYTIC, LIPEMIC, ICTERIC) — put text in panelNote if needed.
- referenceText stays verbatim when present.
- labProvider: use the confirmed provider code for this country, or "unknown".`;

const PARSE_DEFAULT = `DEFAULT / TABLE LAYOUT HINTS:
- **GAUGE / SCALE (if present):** LEFT = refLow, RIGHT = refHigh; RESULT = marker ABOVE the scale. value MUST NOT equal refLow or refHigh.
- Plain tables: value in its own column; range like "0.35 - 4.94" → refLow/refHigh.
- HARD example (gauge): TSH ends 0.35 … 4.94, marker 3.64 → value=3.64 (never 0.35).`;

const REPAIR = `You re-read a medical lab PDF. The first pass wrongly used a REFERENCE RANGE endpoint as the test RESULT for listed codes.

GAUGE LAYOUT (Meuhedet / similar): each test is a horizontal scale.
- Numbers at the LEFT and RIGHT ends of the scale = refLow and refHigh only.
- The RESULT is the number printed at the vertical marker, usually ABOVE the scale (often blue/bold).
- HARD example: TSH scale ends 0.35 … 4.94 with marker label 3.64 above → value=3.64, refLow=0.35, refHigh=4.94. NEVER value=0.35 or 4.94.

For EACH listed code, find that row again and output JSON only:
{"results":[{"code":"TSH","value":3.64,"unit":"µIU/mL","refLow":0.35,"refHigh":4.94,"flag":"normal"}]}

Rules:
- value MUST NOT equal refLow or refHigh.
- Copy digits exactly; skip a code if the marker value is unreadable.
- Include only the codes listed that you can fix.`;

const IL_IDENTIFY = `Identify which Israeli HMO / lab portal printed this PDF. Do NOT extract test results.

Return JSON only:
{"labProvider":"meuhedet","confidence":"high"}

labProvider must be one of: clalit, meuhedet, maccabi, leumit, unknown.
Hints:
- כללית / Clalit / clalit.co.il / "רפואי אישי" Clalit online → clalit
- מאוחדת / Meuhedet / gauge/slider scales with marker above → meuhedet
- מכבי / Maccabi → maccabi
- לאומית / Leumit → leumit
confidence "high" when branding or layout is clear; "low" when unsure → still pick best guess or unknown.`;

const MEUHEDDET = `MEUHEDDET GAUGE LAYOUT — HARD (this PDF is Meuhedet):
Each test is a horizontal ruler/slider/scale.
• LEFT end number = refLow ONLY. RIGHT end number (+ unit) = refHigh ONLY.
• RESULT = the number at the vertical marker, almost always printed ABOVE the scale (often blue/bold).
• HARD EXAMPLE: TSH scale ends 0.35 … 4.94 µIU/mL with marker label 3.64 above → value=3.64, refLow=0.35, refHigh=4.94, flag=normal. Writing value:0.35 or 4.94 is WRONG.
• HARD RULE: value MUST NOT equal refLow or refHigh. If it would, you grabbed a bound — find the marker number above the scale.
• Self-check: value < refLow → flag low; value > refHigh → high; else normal. If printed "low" disagrees with this math, re-read value vs bounds.`;

async function upsertPack(
  country: string,
  provider: string,
  kind: string,
  body: string,
): Promise<void> {
  await query(
    `INSERT INTO lab_prompt_packs (country_code, provider_code, kind, version, body, active)
     VALUES ($1, $2, $3, 1, $4, TRUE)
     ON CONFLICT (country_code, provider_code, kind, version) DO NOTHING`,
    [country, provider, kind, body],
  );
}

async function ensurePromptPacksForAllCountries(): Promise<void> {
  // IL specialized packs first.
  await upsertPack('IL', '', 'identify', IL_IDENTIFY);
  await upsertPack('IL', '', 'parse_base', PARSE_BASE);
  await upsertPack('IL', '', 'parse_layout', PARSE_DEFAULT);
  await upsertPack('IL', 'meuhedet', 'parse_layout', MEUHEDDET);
  await upsertPack('IL', '', 'repair', REPAIR);

  // Generic packs for every other country missing an identify row (one INSERT…SELECT per kind).
  await query(
    `INSERT INTO lab_prompt_packs (country_code, provider_code, kind, version, body, active)
     SELECT c.code, '', 'identify', 1,
       'Identify the lab / portal that printed this PDF for country ' || c.code || ', if branding is clear. Do NOT extract test results.

Return JSON only:
{"labProvider":"unknown","confidence":"low"}

labProvider must be "unknown" until a provider pack exists for this country. Prefer unknown over guessing.',
       TRUE
     FROM lab_countries c
     WHERE c.active = TRUE AND c.code <> 'IL'
       AND NOT EXISTS (
         SELECT 1 FROM lab_prompt_packs p
         WHERE p.country_code = c.code AND p.provider_code = '' AND p.kind = 'identify' AND p.version = 1
       )`,
  );
  await query(
    `INSERT INTO lab_prompt_packs (country_code, provider_code, kind, version, body, active)
     SELECT c.code, '', 'parse_base', 1, $1, TRUE
     FROM lab_countries c
     WHERE c.active = TRUE AND c.code <> 'IL'
       AND NOT EXISTS (
         SELECT 1 FROM lab_prompt_packs p
         WHERE p.country_code = c.code AND p.provider_code = '' AND p.kind = 'parse_base' AND p.version = 1
       )`,
    [PARSE_BASE],
  );
  await query(
    `INSERT INTO lab_prompt_packs (country_code, provider_code, kind, version, body, active)
     SELECT c.code, '', 'parse_layout', 1, $1, TRUE
     FROM lab_countries c
     WHERE c.active = TRUE AND c.code <> 'IL'
       AND NOT EXISTS (
         SELECT 1 FROM lab_prompt_packs p
         WHERE p.country_code = c.code AND p.provider_code = '' AND p.kind = 'parse_layout' AND p.version = 1
       )`,
    [PARSE_DEFAULT],
  );
  await query(
    `INSERT INTO lab_prompt_packs (country_code, provider_code, kind, version, body, active)
     SELECT c.code, '', 'repair', 1, $1, TRUE
     FROM lab_countries c
     WHERE c.active = TRUE AND c.code <> 'IL'
       AND NOT EXISTS (
         SELECT 1 FROM lab_prompt_packs p
         WHERE p.country_code = c.code AND p.provider_code = '' AND p.kind = 'repair' AND p.version = 1
       )`,
    [REPAIR],
  );
}

/** @deprecated name kept for migrate callers — seeds full ISO catalog. */
export async function ensureIlPromptPacksSeeded(): Promise<void> {
  await ensureLabCatalogSeeded();
}

export async function listLabCountries(): Promise<
  Array<{ code: string; nameEn: string; nameNative: string | null; displayName: string }>
> {
  await ensureLabCatalogSeeded();
  const { rows } = await query<LabCountryRow>(
    `SELECT code, name_en, name_native, sort_order
     FROM lab_countries
     WHERE active = TRUE
     ORDER BY sort_order ASC, name_en ASC`,
  );
  return rows.map((r) => ({
    code: r.code,
    nameEn: r.name_en,
    nameNative: r.name_native,
    displayName: displayName(r.name_en, r.name_native),
  }));
}

export async function getLabCountryCatalog(countryCode: string): Promise<{
  country: { code: string; nameEn: string; nameNative: string | null; displayName: string };
  providers: Array<{
    code: string;
    nameEn: string;
    nameNative: string | null;
    displayName: string;
  }>;
  packs: {
    identify: string | null;
    parseBase: string | null;
    repair: string | null;
    parseLayoutByProvider: Record<string, string>;
    parseLayoutDefault: string | null;
  };
} | null> {
  await ensureLabCatalogSeeded();
  const code = countryCode.toUpperCase().slice(0, 2);
  const { rows: countries } = await query<LabCountryRow>(
    `SELECT code, name_en, name_native, sort_order
     FROM lab_countries
     WHERE code = $1 AND active = TRUE`,
    [code],
  );
  const country = countries[0];
  if (!country) return null;

  const { rows: providers } = await query<LabProviderRow>(
    `SELECT country_code, code, name_en, name_native, sort_order
     FROM lab_providers
     WHERE country_code = $1 AND active = TRUE
     ORDER BY sort_order ASC, code ASC`,
    [code],
  );

  const { rows: packs } = await query<LabPromptPackRow>(
    `SELECT DISTINCT ON (country_code, provider_code, kind)
       country_code, provider_code, kind, version, body
     FROM lab_prompt_packs
     WHERE country_code = $1 AND active = TRUE
     ORDER BY country_code, provider_code, kind, version DESC`,
    [code],
  );

  let identify: string | null = null;
  let parseBase: string | null = null;
  let repair: string | null = null;
  let parseLayoutDefault: string | null = null;
  const parseLayoutByProvider: Record<string, string> = {};

  for (const p of packs) {
    const prov = (p.provider_code ?? '').trim();
    if (p.kind === 'identify' && !prov) identify = p.body;
    else if (p.kind === 'parse_base' && !prov) parseBase = p.body;
    else if (p.kind === 'repair' && !prov) repair = p.body;
    else if (p.kind === 'parse_layout') {
      if (!prov) parseLayoutDefault = p.body;
      else parseLayoutByProvider[prov] = p.body;
    }
  }

  return {
    country: {
      code: country.code,
      nameEn: country.name_en,
      nameNative: country.name_native,
      displayName: displayName(country.name_en, country.name_native),
    },
    providers: providers.map((r) => ({
      code: r.code,
      nameEn: r.name_en,
      nameNative: r.name_native,
      displayName: displayName(r.name_en, r.name_native),
    })),
    packs: {
      identify,
      parseBase,
      repair,
      parseLayoutByProvider,
      parseLayoutDefault,
    },
  };
}
