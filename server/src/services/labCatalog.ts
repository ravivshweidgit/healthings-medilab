/**
 * Lab PDF catalog — countries, providers, versioned prompt packs (prompt113 / be-43).
 * Display names: name_native ?? name_en (country brand language, not appLocale).
 */

import { query } from '../db/pool.js';

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

export function displayName(nameEn: string, nameNative: string | null | undefined): string {
  const native = nameNative?.trim();
  return native || nameEn;
}

export async function listLabCountries(): Promise<
  Array<{ code: string; nameEn: string; nameNative: string | null; displayName: string }>
> {
  const { rows } = await query<LabCountryRow>(
    `SELECT code, name_en, name_native, sort_order
     FROM lab_countries
     WHERE active = TRUE
     ORDER BY sort_order ASC, code ASC`,
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

/** Idempotent seed of IL prompt bodies (called from migrate helper or first boot if empty). */
export async function ensureIlPromptPacksSeeded(): Promise<void> {
  const { rows } = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM lab_prompt_packs WHERE country_code = 'IL' AND active = TRUE`,
  );
  if (Number(rows[0]?.n ?? 0) > 0) return;

  const identify = `Identify which Israeli HMO / lab portal printed this PDF. Do NOT extract test results.

Return JSON only:
{"labProvider":"meuhedet","confidence":"high"}

labProvider must be one of: clalit, meuhedet, maccabi, leumit, unknown.
Hints:
- כללית / Clalit / clalit.co.il / "רפואי אישי" Clalit online → clalit
- מאוחדת / Meuhedet / gauge/slider scales with marker above → meuhedet
- מכבי / Maccabi → maccabi
- לאומית / Leumit → leumit
confidence "high" when branding or layout is clear; "low" when unsure → still pick best guess or unknown.`;

  const parseBase = `Rules:
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

  const parseDefault = `DEFAULT / TABLE LAYOUT HINTS:
- **GAUGE / SCALE (if present):** LEFT = refLow, RIGHT = refHigh; RESULT = marker ABOVE the scale. value MUST NOT equal refLow or refHigh.
- Plain tables: value in its own column; range like "0.35 - 4.94" → refLow/refHigh.
- HARD example (gauge): TSH ends 0.35 … 4.94, marker 3.64 → value=3.64 (never 0.35).`;

  const meuhedet = `MEUHEDDET GAUGE LAYOUT — HARD (this PDF is Meuhedet):
Each test is a horizontal ruler/slider/scale.
• LEFT end number = refLow ONLY. RIGHT end number (+ unit) = refHigh ONLY.
• RESULT = the number at the vertical marker, almost always printed ABOVE the scale (often blue/bold).
• HARD EXAMPLE: TSH scale ends 0.35 … 4.94 µIU/mL with marker label 3.64 above → value=3.64, refLow=0.35, refHigh=4.94, flag=normal. Writing value:0.35 or 4.94 is WRONG.
• HARD RULE: value MUST NOT equal refLow or refHigh. If it would, you grabbed a bound — find the marker number above the scale.
• Self-check: value < refLow → flag low; value > refHigh → high; else normal. If printed "low" disagrees with this math, re-read value vs bounds.`;

  const repair = `You re-read a medical lab PDF. The first pass wrongly used a REFERENCE RANGE endpoint as the test RESULT for listed codes.

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

  const inserts: Array<[string, string, string, string]> = [
    ['IL', '', 'identify', identify],
    ['IL', '', 'parse_base', parseBase],
    ['IL', '', 'parse_layout', parseDefault],
    ['IL', 'meuhedet', 'parse_layout', meuhedet],
    ['IL', '', 'repair', repair],
    ['US', '', 'identify', `Identify the US lab / portal that printed this PDF if clear. Do NOT extract results.
Return JSON only: {"labProvider":"unknown","confidence":"low"}
labProvider must be "unknown" until a US provider pack exists.`],
    ['US', '', 'parse_base', parseBase],
    ['US', '', 'parse_layout', parseDefault],
    ['US', '', 'repair', repair],
  ];

  for (const [country, provider, kind, body] of inserts) {
    await query(
      `INSERT INTO lab_prompt_packs (country_code, provider_code, kind, version, body, active)
       VALUES ($1, $2, $3, 1, $4, TRUE)
       ON CONFLICT (country_code, provider_code, kind, version) DO NOTHING`,
      [country, provider, kind, body],
    );
  }
}
