/**
 * PROMPT 05 — Soft-Health palette & elevation.
 *
 * prompt96 (Phase 1): the palette now lives in `theme/tokens.ts` as `lightColors`.
 * `WellnessColors` is a stable alias of the LIGHT tokens (byte-for-byte identical to
 * the historical values), so existing `WellnessColors.X` usages keep working unchanged.
 * Components migrate to `useTheme().colors` (light/dark aware) in Phase 2.
 */
import { lightColors } from './tokens';

export const WellnessColors = lightColors;

export const cardShadow = {
  shadowColor: '#000000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.05,
  shadowRadius: 10,
  elevation: 2,
} as const;

/** Vertical gap between dashboard surface cards (single-direction marginBottom). */
export const dashCardGap = 14;
