/**
 * Example plate collections — single registry for website generator, server enum,
 * and clinic portal picker. Add a slug here only once its pages are generated.
 */

export const PLATE_COLLECTION_SLUGS = [
  'lipid-protocol',
  'glycemic-protocol',
  'weight-protocol',
  'glp1-support',
  'renal-protocol',
  'low-carb-protocol',
];

/** Lipid uses legacy copy in plates-locale-content.mjs; others use bundled data. */
export const LEGACY_LIPID_SLUG = 'lipid-protocol';

export function collectionFile(slug) {
  return `${slug}.html`;
}
