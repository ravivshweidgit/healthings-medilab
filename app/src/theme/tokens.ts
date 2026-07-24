/**
 * prompt96 — Dark theme foundation (Phase 1).
 *
 * Semantic color tokens for light + dark. `lightColors` values are IDENTICAL to the
 * historical `WellnessColors` palette, so aliasing `WellnessColors = lightColors`
 * (see `wellness.ts`) is a zero-visual-change refactor. `darkColors` is a DRAFT
 * (finalized in Phase 3 against `UI-snapshots/dark-theme-reference/`).
 *
 * Components read these through `useTheme()`. `WellnessColors` remains an alias of
 * `lightColors` for the few places that intentionally stay fixed (see
 * `DebugErrorBoundary`, illustration bodies in `GearIllustrations`).
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
  /** Collapsible strip header label (uppercase). */
  stripTitle: string;
  /** Leading chrome icon on a strip header. */
  chromeIcon: string;
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
  // Light keeps strip chrome on secondary grey — the warm gold pair is dark-only.
  stripTitle: '#5B6470',
  chromeIcon: '#5B6470',
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
 * Card elevation is measured against the reference, not guessed: Withings cards sit at
 * 1.35:1 over their canvas, so `surface` reads as raised rather than as a slightly
 * different black. The first draft (#1C1F24) managed only 1.16:1 and the strips looked
 * flat on device. Everything that stacks on a card (borders, tracks, tints) moved up
 * with it, otherwise those layers disappear into the lighter surface.
 *
 * The greys are **warm graphite**, not blue-grey: `surface` is the reference card value
 * verbatim (#2C2B27, R−B = +5). Our first pass was cool (R−B = −10), which read as a
 * blue cast across every strip. Cool belongs in the accents — their sparkline blue
 * (#849DED) is within a hair of our `accentBlue` — so the hue lives there and the
 * surfaces stay grey. Layers stacked on the card carry the same slight warmth,
 * luminance-matched to the cool values they replace, so contrast figures below hold.
 *
 * Secondary text is deliberately bright. The reference runs its secondary ink at 9.5:1
 * on card (#D4D3CF) — not the mid-grey dark themes usually reach for — keeping primary
 * only ~1.5x above it. Our first pass at 5.4:1 made every strip subtitle, timestamp and
 * chrome icon look switched off, so it moved up to match that ratio.
 *
 * Measured against `surface` (#2B2B2B): textPrimary 13.0:1, textSecondary 8.5:1,
 * accentGreen 7.2:1, accentBlue 5.6:1, accentRed 5.1:1, primaryTier 5.0:1 — all clear
 * WCAG AA for body text. Every `chart.*` series clears the 3:1 graphical floor.
 */
export const darkColors: ThemeColors = {
  background: '#0F0F0F',
  surface: '#2C2B27',
  textPrimary: '#F5F5F4',
  textSecondary: '#C9C8C4',
  accentGreen: '#5FD068',
  accentBlue: '#8E9BFF',
  accentRed: '#FF6B6B',
  progressTrack: '#403F3A',
  gridLine: '#42413C',
  iconTintBlue: '#233252',
  iconTintGreen: '#1F3F29',
  noticeSoftBg: '#332B15',
  noticeSoftBorder: '#57491D',
  // AI chat strip + coach panel. Light tints these blue; on dark a blue fill competed
  // with the cards for attention, so it is a warm grey one step *above* `surface` —
  // raised enough to read as tappable, quiet enough to let the purple tier edge lead.
  metabolicPairBg: '#32312C',
  metabolicPairBorder: '#46453E',
  // Warm strip chrome, echoing the reference's focused-tab pairing (gold glyph + cream
  // label). Gold is otherwise unused in our semantic map, so it marks chrome without
  // colliding with green = success or red = alert. 7.8:1 and 12.3:1 on card.
  stripTitle: '#FFEEC0',
  chromeIcon: '#E6BC2A',
  // Focus ink for the primary-tier cards, lifted from the reference's own metric purple
  // (#9585C4, which lands at 4.34:1 here — just under AA — so it opens up slightly).
  // Purple rather than another steel blue: it separates "this is the focus tier" from
  // accentBlue links/CTAs, and leaves green free for success. brandNavy stays a FILL for
  // CTAs, where white text on it clears AA (5.28:1) — a lighter navy would break that.
  primaryTier: '#A08FD4',
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
    balanceLine: '#A1A09B',
    surplusZone: '#452930',
    deficitDot: '#5FD068',
    surplusDot: '#FF6B6B',
    ldl: '#FF6B6B',
    tg: '#FFB74D',
    hdl: '#5FD068',
    visceral: '#C88BE0',
    mealMarker: '#FFB74D',
    glucoseBand: '#233252',
  },
};

/**
 * Master switch for dark rendering. Held `false` through Phases 1–3 (foundation,
 * component migration, palette + charts) so the app was guaranteed to render light
 * while the groundwork landed. Enabled in Phase 4 alongside the Appearance picker.
 */
export const DARK_ENABLED = true;

export function colorsFor(mode: ThemeMode): ThemeColors {
  return mode === 'dark' ? darkColors : lightColors;
}
