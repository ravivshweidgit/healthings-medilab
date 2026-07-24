/**
 * prompt96 — Dark theme foundation (Phase 1).
 *
 * Semantic color tokens for light + dark. `lightColors` values are IDENTICAL to the
 * historical `WellnessColors` palette, so aliasing `WellnessColors = lightColors`
 * (see `wellness.ts`) is a zero-visual-change refactor. `darkColors` is a DRAFT
 * (finalized in Phase 3 against `UI-snapshots/dark-theme-reference/`).
 *
 * IMPORTANT: dark is NOT wired to components yet. Components still read the static
 * `WellnessColors` alias (= light). `DARK_ENABLED` stays `false` until Phase 3 so the
 * app renders light everywhere regardless of OS/user preference. Do not flip it on
 * before component migration (Phase 2) is complete, or screens will be half-dark.
 */

export type ThemeMode = 'light' | 'dark';

/** Every color the app themes. Keys mirror the historical WellnessColors palette. */
export type ThemeColors = {
  background: string;
  surface: string;
  textPrimary: string;
  textSecondary: string;
  accentGreen: string;
  accentBlue: string;
  accentRed: string;
  progressTrack: string;
  gridLine: string;
  iconTintBlue: string;
  iconTintGreen: string;
  noticeSoftBg: string;
  noticeSoftBorder: string;
  metabolicPairBg: string;
  metabolicPairBorder: string;
};

/** Light palette — MUST stay byte-for-byte equal to the pre-prompt96 WellnessColors. */
export const lightColors: ThemeColors = {
  background: '#F8F9FB',
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  textSecondary: '#5B6470',
  accentGreen: '#4CAF50',
  accentBlue: '#2196F3',
  accentRed: '#FF5252',
  progressTrack: '#F0F0F0',
  gridLine: '#E8E8E8',
  iconTintBlue: '#E3F2FD',
  iconTintGreen: '#E8F5E9',
  noticeSoftBg: '#FFF8E1',
  noticeSoftBorder: '#FFE082',
  metabolicPairBg: '#EDF4FF',
  metabolicPairBorder: '#D6E8FC',
};

/**
 * Dark palette — DRAFT (Phase 3 finalizes vs the Withings reference). Near-black
 * canvas + dark-grey elevated cards, cool periwinkle data-viz, semantic accents kept
 * (green = success only). Tints are darkened so they don't glow on dark surfaces.
 */
export const darkColors: ThemeColors = {
  background: '#0E0F11',
  surface: '#1C1F24',
  textPrimary: '#F2F3F5',
  textSecondary: '#9BA1AA',
  accentGreen: '#5FD068',
  accentBlue: '#8E9BFF',
  accentRed: '#FF6B6B',
  progressTrack: '#262A30',
  gridLine: '#2A2E35',
  iconTintBlue: '#1B2740',
  iconTintGreen: '#17301E',
  noticeSoftBg: '#2A2410',
  noticeSoftBorder: '#4A3F16',
  metabolicPairBg: '#16233A',
  metabolicPairBorder: '#24405F',
};

/**
 * Master switch for dark rendering. Stays `false` through Phases 1–2 (foundation +
 * component migration) so the app is guaranteed to render light. Flip to `true` in
 * Phase 3 once dark palettes/charts are ready.
 */
export const DARK_ENABLED = false;

export function colorsFor(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}
