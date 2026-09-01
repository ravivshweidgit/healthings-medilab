/**
 * Shared clinic / Food Log macro meter (prompt119).
 *
 * Eaten sits before the bar, the target after it, and the track between them carries
 * floor-vs-ceiling as a shaded allowed zone. The old `40 / 80g` string is gone.
 *
 * he/ar: row-reverse + track scaleX(-1) so labels sit on the right, fill grows
 * right→left, targets on the left. Other locales stay LTR (label · eaten · track · target).
 * Narrow side columns keep the mirrored row from clipping on a phone card.
 *
 * Labels are short catalog forms in every locale — do not widen for long words.
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getFoodLogUiCopy } from '../i18n/foodLogUiCopy';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

/**
 * Track scale runs past the target so the allowed zone has visible width and an overshoot
 * reads as distance, not a pinned full bar.
 */
const SCALE_HEADROOM = 1.25;

/** Shared with MacroTargetStrip twin — change both or the strips drift. */
export const METER_LABEL_W = 56;
export const METER_EATEN_W = 40;
export const METER_TARGET_W = 78;
export const METER_COL_GAP = 4;

export type MacroMeterBarProps = {
  label: string;
  value: number;
  target: number;
  color: string;
  showTarget?: boolean;
  /** Default grams (`g`). Energy/water pass already-converted display values. */
  unit?: 'g' | 'mg' | 'mcg' | 'kcal' | 'kj' | 'ml' | 'floz';
  /** Hitting the target is the win — no over-target penalty colour (water, fibre). */
  goalIsFloor?: boolean;
  /** Clinic HARD band — when both set, the target reads as a range and outside is red. */
  clinicFloor?: number;
  clinicCeiling?: number;
  /** Localized line under the row (e.g. `2000 + 300 activity`). */
  clinicCaption?: string;
  /** Short chip appended to the target, for markers anchored to a percent of energy. */
  percentChip?: string;
  /** `appLocale` — picks the target wording and he/ar chrome mirror. */
  langCode?: string | null;
  onPress?: () => void;
};

export function MacroMeterBar({
  label,
  value,
  target,
  color,
  showTarget,
  unit = 'g',
  goalIsFloor,
  clinicFloor,
  clinicCeiling,
  clinicCaption,
  percentChip,
  langCode,
  onPress,
}: MacroMeterBarProps) {
  const { colors, isDark } = useTheme();
  const rtl = langCode === 'he' || langCode === 'ar';
  const barStyles = useMemo(() => makeBarStyles(colors, isDark, rtl), [colors, isDark, rtl]);
  const copy = getFoodLogUiCopy(langCode);

  const hasBand =
    clinicFloor != null && clinicCeiling != null && clinicFloor > 0 && clinicCeiling > 0;
  const hasClinicCeiling = clinicCeiling != null && clinicCeiling > 0 && clinicFloor == null;
  const hasClinicFloor = clinicFloor != null && clinicFloor > 0 && clinicCeiling == null;
  /** No labeled goal (FLEX / unlocked) — show eaten only, leave the track empty. */
  const displayOnly =
    !showTarget && !hasBand && !hasClinicCeiling && !hasClinicFloor;
  const effectiveTarget = displayOnly
    ? 0
    : hasBand
      ? clinicCeiling!
      : hasClinicCeiling
        ? clinicCeiling!
        : hasClinicFloor
          ? clinicFloor!
          : target;

  // Status logic is unchanged from the pre-prompt119 bar — only the chrome moved.
  // Ceiling-only HARD: at/under the cap is in zone (green). Floor-only: at/above. Band: inside.
  const met = displayOnly
    ? false
    : hasBand
      ? value >= clinicFloor! && value <= clinicCeiling!
      : hasClinicFloor
        ? value >= clinicFloor!
        : hasClinicCeiling
          ? value <= clinicCeiling!
          : goalIsFloor && effectiveTarget > 0 && value >= effectiveTarget;
  const over = displayOnly
    ? false
    : hasBand
      ? value < clinicFloor! || value > clinicCeiling!
      : hasClinicCeiling
        ? value > clinicCeiling!
        : !goalIsFloor && !hasClinicFloor && value > effectiveTarget * 1.05;
  const underFloor = !displayOnly && hasClinicFloor && value < clinicFloor!;
  const bad = over || underFloor;

  /** `end: null` means the allowed zone runs off the end of the track (a floor). */
  const zone: { start: number; end: number | null } | null = displayOnly
    ? null
    : hasBand
      ? { start: clinicFloor!, end: clinicCeiling! }
      : hasClinicCeiling
        ? { start: 0, end: clinicCeiling! }
        : hasClinicFloor
          ? { start: clinicFloor!, end: null }
          : goalIsFloor && effectiveTarget > 0
            ? { start: effectiveTarget, end: null }
            : null;

  const scaleMax = zone
    ? Math.max((zone.end ?? zone.start) * SCALE_HEADROOM, value, 1)
    : Math.max(effectiveTarget, value, 1);
  const pctOf = (n: number) => Math.max(0, Math.min(1, n / scaleMax));
  const ratio = displayOnly ? 0 : pctOf(value);

  const suffix =
    unit === 'g'
      ? 'g'
      : unit === 'mg'
        ? 'mg'
        : unit === 'mcg'
          ? 'mcg'
          : unit === 'ml'
            ? 'ml'
            : unit === 'floz'
              ? 'fl oz'
              : '';
  const fmt = (n: number) => (unit === 'floz' ? n.toFixed(1) : String(Math.round(n)));

  const eatenText = showTarget ? fmt(value) : `${fmt(value)}${suffix}`;

  let targetText = '';
  if (showTarget) {
    if (hasBand) {
      targetText = copy.targetRange(fmt(clinicFloor!), `${fmt(clinicCeiling!)}${suffix}`);
    } else if (hasClinicCeiling) {
      targetText = copy.targetUpTo(`${fmt(clinicCeiling!)}${suffix}`);
    } else if (hasClinicFloor) {
      targetText = copy.targetAbove(`${fmt(clinicFloor!)}${suffix}`);
    } else {
      // A local goal (water, fibre) is something to reach, not an order to stay under —
      // "above 2000ml" would read as a warning. Plain number; the zone shows the direction.
      targetText = `${fmt(target)}${suffix}`;
    }
    if (percentChip) targetText = `${targetText}  ${percentChip}`;
    // Isolate so RTL copy doesn't reorder "13g" past "7%".
    if (rtl && targetText) targetText = `\u2066${targetText}\u2069`;
  }

  const zoneStart = zone ? pctOf(zone.start) : 0;
  const zoneEnd = zone ? (zone.end == null ? 1 : pctOf(zone.end)) : 0;
  const marks = zone
    ? [zoneStart, zoneEnd].filter((p, i, arr) => p > 0.02 && p < 0.98 && arr.indexOf(p) === i)
    : [];

  const row = (
    <View style={barStyles.rowWrap}>
      <View style={barStyles.row}>
        <Text style={barStyles.label} numberOfLines={1} ellipsizeMode="tail">
          {label}
        </Text>
        <Text
          style={[
            barStyles.eaten,
            met && !bad && barStyles.eatenMet,
            bad && barStyles.eatenOver,
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.15}
        >
          {eatenText}
        </Text>
        {/* scaleX(-1) flips fill + zone + marks together for he/ar growth direction. */}
        <View style={[barStyles.track, rtl && barStyles.trackRtl]}>
          {zone ? (
            <View
              style={[
                barStyles.zone,
                { left: `${zoneStart * 100}%`, width: `${Math.max(0, zoneEnd - zoneStart) * 100}%` },
              ]}
            />
          ) : null}
          <View
            style={[
              barStyles.fill,
              {
                width: `${ratio * 100}%`,
                backgroundColor:
                  met && !bad
                    ? colors.accentGreen
                    : bad
                      ? isDark
                        ? colors.accentRed
                        : '#EF5350'
                      : color,
              },
            ]}
          />
          {marks.map((p) => (
            <View key={p} style={[barStyles.mark, { left: `${p * 100}%` }]} />
          ))}
        </View>
        {showTarget ? (
          <Text style={barStyles.target} numberOfLines={1} maxFontSizeMultiplier={1.15}>
            {targetText}
          </Text>
        ) : (
          // Keep column width so FLEX rows (eaten only) stay aligned with HARD rows.
          <View style={barStyles.targetSlot} />
        )}
      </View>
      {clinicCaption ? (
        <Text style={barStyles.caption} numberOfLines={1}>
          {clinicCaption}
        </Text>
      ) : null}
    </View>
  );
  if (!onPress) return row;
  return (
    <Pressable style={barStyles.rowPressable} onPress={onPress} accessibilityRole="button" hitSlop={4}>
      {row}
    </Pressable>
  );
}

const makeBarStyles = (c: ThemeColors, isDark: boolean, rtl: boolean) =>
  StyleSheet.create({
    row: {
      flexDirection: rtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: METER_COL_GAP,
      marginBottom: 5,
      width: '100%',
    },
    rowWrap: { width: '100%', marginBottom: 2 },
    rowPressable: { alignSelf: 'stretch' },
    label: {
      width: METER_LABEL_W,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: '700',
      color: c.textSecondary,
      // Hug the eaten/track side in both directions.
      textAlign: rtl ? 'left' : 'right',
    },
    caption: {
      fontSize: 10,
      color: c.textSecondary,
      marginBottom: 4,
      // Sit under the track — past the label column on the leading edge.
      marginLeft: rtl ? 0 : METER_LABEL_W + METER_COL_GAP,
      marginRight: rtl ? METER_LABEL_W + METER_COL_GAP : 0,
      textAlign: rtl ? 'right' : 'left',
    },
    // Track is the optical center — side columns sized to fit a phone card without clipping.
    track: {
      flex: 1,
      minWidth: 64,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? c.background : c.progressTrack,
      overflow: 'hidden',
    },
    trackRtl: { transform: [{ scaleX: -1 }] },
    zone: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      backgroundColor: isDark ? 'rgba(102, 187, 106, 0.22)' : 'rgba(46, 125, 50, 0.14)',
    },
    mark: {
      position: 'absolute',
      top: 0,
      bottom: 0,
      width: 2,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.45)' : 'rgba(0, 0, 0, 0.32)',
    },
    fill: { height: '100%', borderRadius: 3 },
    eaten: {
      width: METER_EATEN_W,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: '700',
      color: c.textPrimary,
      textAlign: rtl ? 'left' : 'right',
      fontVariant: ['tabular-nums'],
    },
    eatenMet: { color: c.accentGreen },
    eatenOver: { color: isDark ? c.accentRed : '#EF5350' },
    target: {
      width: METER_TARGET_W,
      flexShrink: 0,
      fontSize: 11,
      fontWeight: '600',
      color: c.textSecondary,
      textAlign: rtl ? 'right' : 'left',
      fontVariant: ['tabular-nums'],
      writingDirection: 'ltr',
    },
    targetSlot: { width: METER_TARGET_W, flexShrink: 0 },
  });
