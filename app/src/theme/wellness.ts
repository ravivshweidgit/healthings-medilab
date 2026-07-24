/** PROMPT 05 — Soft-Health palette & elevation */

export const WellnessColors = {
  background: '#F8F9FB',
  surface: '#FFFFFF',
  textPrimary: '#1A1A1A',
  // Darkened from #7C7C7C (~4.0:1, failed AA) to ~5.9:1 on white so small strip
  // labels and secondary UI text meet WCAG AA. Shared token — don't fork per strip.
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
  /** Soft band for metabolic “pair” (e.g. visceral fat + glucose). */
  metabolicPairBg: '#EDF4FF',
  metabolicPairBorder: '#D6E8FC',
} as const;

export const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
} as const;

/** Vertical gap between dashboard surface cards (single-direction marginBottom). */
export const dashCardGap = 14;
