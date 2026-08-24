/**
 * Example plate collections (prompt118).
 *
 * A slug belongs here only once its pages are live under `website/{lang}/plates/`
 * in every help locale. Propose may emit nothing else, so an unlisted slug can
 * never reach the app as a 404 deep link.
 */

export const PLATE_COLLECTIONS = ['lipid-protocol'] as const;

export type PlateCollection = (typeof PLATE_COLLECTIONS)[number];

const PLATE_COLLECTION_SET = new Set<string>(PLATE_COLLECTIONS);

/**
 * What order each collection serves — read by the model when it chooses one.
 * Generated into the prompt so the registry and the prompt cannot drift.
 */
const PLATE_COLLECTION_INTENT: Record<PlateCollection, string> = {
  'lipid-protocol':
    'Lipid-primary order. The main job is LDL / total cholesterol / triglycerides down, or HDL up. Soluble fibre, plant protein, unsaturated fats, saturated fat held low.',
};

/** Gemini-supplied value → known slug, or null. Never throws. */
export function normalizePlateCollection(raw: unknown): PlateCollection | null {
  if (typeof raw !== 'string') return null;
  const slug = raw.trim().toLowerCase();
  if (!slug || slug === 'null' || slug === 'none') return null;
  return PLATE_COLLECTION_SET.has(slug) ? (slug as PlateCollection) : null;
}

/** Propose prompt section — allowed slugs plus how to choose between them. */
export function plateCollectionPromptBlock(): string {
  const options = PLATE_COLLECTIONS.map(
    (slug) => `- "${slug}" — ${PLATE_COLLECTION_INTENT[slug]}`,
  ).join('\n');

  return [
    'EXAMPLE PLATES (`plate_collection`)',
    'A day of example meals we can show this patient in the app. Allowed values — any other string is discarded:',
    options,
    '- null — nothing above matches this order.',
    'Judge the PRIMARY intent of THIS order, not a secondary constraint: an order whose main job is a renal protein cap is null even when it also mentions cholesterol.',
    'null is a correct, expected answer. Prefer null over a near-miss — showing a patient the wrong day of meals is worse than showing none.',
  ].join('\n');
}
