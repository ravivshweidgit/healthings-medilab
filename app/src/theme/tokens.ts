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

/**
 * Data-viz series colors (Phase 3). Kept separate from chrome tokens because charts
 * need a stable, ordered palette: on light the calorie stack goes pale→dark as
 * intensity rises; on dark that inverts (dim→bright) so "more" still reads as
 * "louder" against a near-black canvas.
 */
export type ChartColors = {
  /** Calorie stack: resting baseline → passive activity → explicit workout. */
  bmr: string;
  active: string;
  workout: string;
  /** Total burn line (success/green family). */
  total: string;
  /** Eaten energy (orange family). */
  eaten: string;
  /** Neutral balance line drawn across surplus/deficit zones. */
  balanceLine: string;
  /** Positive-balance (surplus) zone fill. */
  surplusZone: string;
  deficitDot: string;
  surplusDot: string;
  /** Lipid panel series. */
  ldl: string;
  tg: string;
  hdl: string;
  /** Visceral fat trend. */
  visceral: string;
  /** Meal markers on the glucose timeline. */
  mealMarker: string;
  /** Glucose in-range band fill. */
  glucoseBand: string;
};

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
  /** Steel navy — primary-tier strip accent. */
  primaryTier: string;
  /** Deeper brand navy — filled CTAs, brand wordmark. */
  brandNavy: string;
  /** Elevation shadow color. */
  shadow: string;
  chart: ChartColors;
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
  primaryTier: '#1F3D5C',
  brandNavy: '#1A2B4A',
  shadow: '#000000',
  chart: {
    bmr: '#90CAF9',
    active: '#42A5F5',
    workout: '#1565C0',
    total: '#4CAF50',
    eaten: '#FF9800',
    balanceLine: '#37474F',
    surplusZone: '#FFEBEE',
    deficitDot: '#2E7D32',
    surplusDot: '#C62828',
    ldl: '#C62828',
    tg: '#FF9800',
    hdl: '#2E7D32',
    visceral: '#7B1FA2',
    mealMarker: '#FF9800',
    glucoseBand: '#E3F2FD',
  },
};

/**
 * Dark palette — finalized in Phase 3 against `UI-snapshots/dark-theme-reference/`
 * (Withings, approved 2026-07-24). Near-black canvas + dark-grey elevated cards, cool
 * periwinkle data-viz, semantic accents kept (green = success only). Tints are darkened
 * so they don't glow on dark surfaces.
 *
 * Measured against `surface` (#1C1F24): textPrimary 14.9:1, textSecondary 6.4:1,
 * accentGreen 8.4:1, accentBlue 6.5:1, accentRed 6.0:1, primaryTier 4.9:1 — all clear
 * WCAG AA for body text. Every `chart.*` series clears the 3:1 graphical floor
 * (dimmest is `bmr` at 3.7:1).
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
  // primaryTier doubles as small text (4.91:1 on surface); brandNavy stays a FILL for
  // CTAs, where white text on it clears AA (5.28:1) — a lighter navy would break that.
  primaryTier: '#5A8FCC',
  brandNavy: '#3E6EA5',
  shadow: '#000000',
  chart: {
    // Luminance order inverts vs light: dim → bright as intensity rises. Kept above the
    // 3:1 graphical floor with ~1.4-1.9x luminance steps so the stack stays separable.
    bmr: '#5578A8',
    active: '#7BA3D8',
    workout: '#A9B6FF',
    total: '#5FD068',
    eaten: '#FFB74D',
    balanceLine: '#9BA1AA',
    surplusZone: '#3A1F22',
    deficitDot: '#5FD068',
    surplusDot: '#FF6B6B',
    ldl: '#FF6B6B',
    tg: '#FFB74D',
    hdl: '#5FD068',
    visceral: '#C88BE0',
    mealMarker: '#FFB74D',
    glucoseBand: '#1B2740',
  },
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
