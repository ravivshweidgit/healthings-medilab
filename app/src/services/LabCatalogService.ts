/**
 * Fetch lab country / provider / prompt catalog from the API (prompt113 / be-43).
 * Provider chip label = nameNative ?? nameEn (country brand — not appLocale).
 */

import { authFetch } from './AuthApiService';

export type LabCountryInfo = {
  code: string;
  nameEn: string;
  nameNative: string | null;
  displayName: string;
};

export type LabProviderInfo = {
  code: string;
  nameEn: string;
  nameNative: string | null;
  displayName: string;
};

export type LabCountryCatalog = {
  country: LabCountryInfo;
  providers: LabProviderInfo[];
  packs: {
    identify: string | null;
    parseBase: string | null;
    repair: string | null;
    parseLayoutByProvider: Record<string, string>;
    parseLayoutDefault: string | null;
  };
};

const catalogByCountry = new Map<string, { at: number; catalog: LabCountryCatalog }>();
const CACHE_MS = 10 * 60 * 1000;
let countriesCache: { at: number; countries: LabCountryInfo[] } | null = null;

export function providerDisplayName(p: Pick<LabProviderInfo, 'nameEn' | 'nameNative' | 'displayName'>): string {
  return p.displayName || p.nameNative?.trim() || p.nameEn;
}

export function countryDisplayName(c: Pick<LabCountryInfo, 'nameEn' | 'nameNative' | 'displayName'>): string {
  return c.displayName || c.nameNative?.trim() || c.nameEn;
}

/** Offline / pre-migrate fallback so IL import still works. */
export function fallbackCountries(): LabCountryInfo[] {
  return [
    { code: 'IL', nameEn: 'Israel', nameNative: 'ישראל', displayName: 'ישראל' },
    { code: 'US', nameEn: 'United States', nameNative: null, displayName: 'United States' },
  ];
}

export function fallbackCatalog(countryCode: string): LabCountryCatalog {
  const code = countryCode.toUpperCase().slice(0, 2);
  const country =
    fallbackCountries().find((c) => c.code === code) ?? {
      code,
      nameEn: code,
      nameNative: null,
      displayName: code,
    };
  if (code === 'IL') {
    return {
      country,
      providers: [
        { code: 'clalit', nameEn: 'Clalit', nameNative: 'כללית', displayName: 'כללית' },
        { code: 'meuhedet', nameEn: 'Meuhedet', nameNative: 'מאוחדת', displayName: 'מאוחדת' },
        { code: 'maccabi', nameEn: 'Maccabi', nameNative: 'מכבי', displayName: 'מכבי' },
        { code: 'leumit', nameEn: 'Leumit', nameNative: 'לאומית', displayName: 'לאומית' },
      ],
      packs: { identify: null, parseBase: null, repair: null, parseLayoutByProvider: {}, parseLayoutDefault: null },
    };
  }
  return {
    country,
    providers: [],
    packs: { identify: null, parseBase: null, repair: null, parseLayoutByProvider: {}, parseLayoutDefault: null },
  };
}

export async function fetchLabCountries(): Promise<LabCountryInfo[]> {
  const now = Date.now();
  if (countriesCache && now - countriesCache.at < CACHE_MS) {
    return countriesCache.countries;
  }
  try {
    const res = await authFetch('/v1/lab/countries');
    if (!res.ok) return fallbackCountries();
    const json = (await res.json()) as { countries?: LabCountryInfo[] };
    const list = Array.isArray(json.countries) ? json.countries : fallbackCountries();
    countriesCache = { at: now, countries: list };
    return list;
  } catch {
    return fallbackCountries();
  }
}

export async function fetchLabCountryCatalog(countryCode: string): Promise<LabCountryCatalog> {
  const code = countryCode.toUpperCase().slice(0, 2);
  const now = Date.now();
  const hit = catalogByCountry.get(code);
  if (hit && now - hit.at < CACHE_MS) return hit.catalog;
  try {
    const res = await authFetch(`/v1/lab/catalog/${encodeURIComponent(code)}`);
    if (!res.ok) return fallbackCatalog(code);
    const catalog = (await res.json()) as LabCountryCatalog;
    if (!catalog?.country?.code) return fallbackCatalog(code);
    catalogByCountry.set(code, { at: now, catalog });
    return catalog;
  } catch {
    return fallbackCatalog(code);
  }
}
