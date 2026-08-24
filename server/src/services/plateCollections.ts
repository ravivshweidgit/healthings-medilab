/**
 * Example plate collections (prompt118).
 *
 * A slug belongs here only once its pages are live under `website/{lang}/plates/`
 * in every help locale. The clinic picker offers only these, so a value the app
 * would deep-link to a 404 can never be stored.
 *
 * Display labels are NOT here — the portal keeps them in its `clinicLocale`
 * catalog (language-policy), keyed by slug.
 */

export const PLATE_COLLECTIONS = [
  'lipid-protocol',
  'glycemic-protocol',
  'weight-protocol',
  'glp1-support',
  'renal-protocol',
  'low-carb-protocol',
] as const;

export type PlateCollection = (typeof PLATE_COLLECTIONS)[number];

const PLATE_COLLECTION_SET = new Set<string>(PLATE_COLLECTIONS);

/** Client-supplied value → known slug, or null. Never throws. */
export function normalizePlateCollection(raw: unknown): PlateCollection | null {
  if (typeof raw !== 'string') return null;
  const slug = raw.trim().toLowerCase();
  if (!slug || slug === 'null' || slug === 'none') return null;
  return PLATE_COLLECTION_SET.has(slug) ? (slug as PlateCollection) : null;
}
