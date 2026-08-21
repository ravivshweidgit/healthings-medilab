/**
 * One cache-busting token for the shared stylesheets, for every generator and
 * hand-written page on the site.
 *
 * It used to live in three places and had drifted to three values: help pages
 * asked for `styles.css?v=20260821a`, plates pages for `?v=20260816e`, and the
 * landing page mixed `tokens.css?v=20260726e` with `styles.css?v=20260815a`.
 * Since all of them load the *same two files*, a returning visitor could hold
 * several cached copies and — worse — a brand-new page could inherit a token
 * someone already has cached from before the CSS it needs existed, and render
 * unstyled. That is exactly what nearly happened when the downloads page landed.
 *
 * Format: date plus a letter, and it only ever moves forward. Batch names were
 * the old scheme and they do not sort — be-16 shipped before be-13, so the token
 * went backwards and burned two keys.
 *
 * Bump this whenever `styles.css` or `tokens.css` changes, and keep the
 * hand-written `index.html` / `privacy.html` links on the same value.
 */
export const CSS_VER = '20260821c';
