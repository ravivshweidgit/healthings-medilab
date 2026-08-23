/**
 * Shared clinic / Food Log macro meter (≤ ≥ bands, optional % inline).
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

export type MacroMeterBarProps = {
  label: string;
  value: number;
  target: number;
  color: string;
  showTarget?: boolean;
  /** Default grams (`g`). Energy/water pass already-converted display values. */
  unit?: 'g' | 'mg' | 'mcg' | 'kcal' | 'kj' | 'ml' | 'floz';
  /** Hitting the target is the win — no over-target penalty colour (water). */
  goalIsFloor?: boolean;
  /** Clinic HARD band — when both set, display `value  lo–hi` and red outside. */
  clinicFloor?: number;
  clinicCeiling?: number;
  /** Optional caption under the value (e.g. `30% of 2000`). */
  clinicCaption?: string;
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
  onPress,
}: MacroMeterBarProps) {
  const { colors, isDark } = useTheme();
  const barStyles = useMemo(() => makeBarStyles(colors, isDark), [colors, isDark]);
  const hasBand = clinicFloor != null && clinicCeiling != null && clinicFloor > 0 && clinicCeiling > 0;
  const hasClinicCeiling = clinicCeiling != null && clinicCeiling > 0 && clinicFloor == null;
  const hasClinicFloor = clinicFloor != null && clinicFloor > 0 && clinicCeiling == null;
  const effectiveTarget =
    hasBand ? clinicCeiling! : hasClinicCeiling ? clinicCeiling! : hasClinicFloor ? clinicFloor! : target;
  const ratio = effectiveTarget > 0 ? Math.min(1, value / effectiveTarget) : 0;
  const met = hasBand
    ? value >= clinicFloor! && value <= clinicCeiling!
    : hasClinicFloor
      ? value >= clinicFloor!
      : goalIsFloor && effectiveTarget > 0 && value >= effectiveTarget;
  const over = hasBand
    ? value < clinicFloor! || value > clinicCeiling!
    : hasClinicCeiling
      ? value > clinicCeiling!
      : !goalIsFloor && !hasClinicFloor && value > effectiveTarget * 1.05;
  const underFloor = hasClinicFloor && value < clinicFloor!;
  const bad = over || underFloor || (hasBand && (value < clinicFloor! || value > clinicCeiling!));
  const suffix =
    unit === 'g' ? 'g' : unit === 'mg' ? 'mg' : unit === 'mcg' ? 'mcg' : unit === 'ml' ? 'ml' : unit === 'floz' ? 'fl oz' : unit === 'kj' ? '' : '';
  const fmt = (n: number) =>
    unit === 'kcal' || unit === 'kj' || unit === 'mg' || unit === 'mcg' ? `${Math.round(n)}` : `${Math.round(n)}`;
  let valueText: string;
  if (hasBand && showTarget) {
    valueText = `${fmt(value)}  ${fmt(clinicFloor!)}–${fmt(clinicCeiling!)}${suffix}`;
  } else if (hasClinicCeiling && showTarget) {
    valueText = `${fmt(value)} ≤ ${fmt(clinicCeiling!)}${suffix}`;
  } else if (hasClinicFloor && showTarget) {
    valueText = `${fmt(value)} ≥ ${fmt(clinicFloor!)}${suffix}`;
  } else if (showTarget) {
    valueText =
      unit === 'kcal' || unit === 'kj'
        ? `${Math.round(value)} / ${Math.round(target)}`
        : unit === 'floz'
          ? `${value.toFixed(1)} / ${target.toFixed(1)}${suffix}`
          : unit === 'mg' || unit === 'mcg'
            ? `${Math.round(value)} / ${Math.round(target)}${suffix}`
            : `${Math.round(value)} / ${Math.round(target)}${suffix}`;
  } else {
    valueText =
      unit === 'kcal'
        ? `${Math.round(value)} kcal`
        : unit === 'kj'
          ? `${Math.round(value)} kJ`
          : unit === 'floz'
            ? `${value.toFixed(1)}${suffix}`
            : `${Math.round(value)}${suffix}`;
  }
  const pctInline = clinicCaption?.match(/^(\d+(?:\.\d+)?)%/);
  if (pctInline) {
    valueText = `${valueText}  ${pctInline[1]}%`;
  }
  const leftoverCaption = pctInline ? undefined : clinicCaption;
  const row = (
    <View style={barStyles.rowWrap}>
      <View style={barStyles.row}>
        <Text style={barStyles.label} numberOfLines={1}>
          {label}
        </Text>
        <View style={barStyles.track}>
          <View
            style={[
              barStyles.fill,
              {
                width: `${ratio * 100}%`,
                backgroundColor: met && !bad
                  ? colors.accentGreen
                  : bad
                    ? isDark
                      ? colors.accentRed
                      : '#EF5350'
                    : color,
              },
            ]}
          />
        </View>
        <Text
          style={[
            barStyles.value,
            showTarget && barStyles.valueTarget,
            met && !bad && barStyles.valueMet,
            bad && barStyles.valueOver,
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.15}
        >
          {valueText}
        </Text>
      </View>
      {leftoverCaption ? (
        <Text style={barStyles.caption} numberOfLines={1}>
          {leftoverCaption}
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

const makeBarStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 5, width: '100%' },
    rowWrap: { width: '100%', marginBottom: 2 },
    rowPressable: { alignSelf: 'stretch' },
    label: { width: 40, fontSize: 11, fontWeight: '700', color: c.textSecondary },
    caption: { fontSize: 10, color: c.textSecondary, marginLeft: 48, marginBottom: 4 },
    track: {
      flex: 1,
      height: 6,
      borderRadius: 3,
      backgroundColor: isDark ? c.background : c.progressTrack,
      overflow: 'hidden',
    },
    fill: { height: '100%', borderRadius: 3 },
    value: {
      width: 44,
      fontSize: 11,
      fontWeight: '600',
      color: c.textPrimary,
      textAlign: 'right',
      fontVariant: ['tabular-nums'],
    },
    valueTarget: { width: 118 },
    valueMet: { color: c.accentGreen },
    valueOver: { color: isDark ? c.accentRed : '#EF5350' },
  });
