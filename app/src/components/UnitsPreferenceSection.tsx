/**
 * Profile & Settings — per-measure unit pickers (English chrome).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import { WellnessColors } from '../theme/wellness';

type ChipProps<T extends string> = {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
};

function UnitChipRow<T extends string>({ label, value, options, onChange }: ChipProps<T>) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <View style={styles.chips}>
        {options.map((opt) => {
          const selected = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              style={[styles.chip, selected && styles.chipSelected]}
              onPress={() => onChange(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

type Props = {
  prefs: UnitsPrefs;
  onChange: (next: UnitsPrefs) => void;
};

export function UnitsPreferenceSection({ prefs, onChange }: Props) {
  const patch = (partial: Partial<UnitsPrefs>) => onChange({ ...prefs, version: 1, ...partial });

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>Units & measurements</Text>
      <Text style={styles.hint}>Display and input only — data stays in standard clinical units.</Text>
      <UnitChipRow
        label="Glucose"
        value={prefs.glucose}
        options={[
          { id: 'mgdl', label: 'mg/dL' },
          { id: 'mmol', label: 'mmol/L' },
        ]}
        onChange={(glucose) => patch({ glucose })}
      />
      <UnitChipRow
        label="Weight"
        value={prefs.mass}
        options={[
          { id: 'kg', label: 'kg' },
          { id: 'lb', label: 'lb' },
        ]}
        onChange={(mass) => patch({ mass })}
      />
      <UnitChipRow
        label="Height"
        value={prefs.height}
        options={[
          { id: 'cm', label: 'cm' },
          { id: 'ftin', label: "ft'in\"" },
        ]}
        onChange={(height) => patch({ height })}
      />
      <UnitChipRow
        label="Water"
        value={prefs.water}
        options={[
          { id: 'ml', label: 'ml' },
          { id: 'floz', label: 'fl oz' },
        ]}
        onChange={(water) => patch({ water })}
      />
      <UnitChipRow
        label="Energy"
        value={prefs.energy}
        options={[
          { id: 'kcal', label: 'kcal' },
          { id: 'kj', label: 'kJ' },
        ]}
        onChange={(energy) => patch({ energy })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 8, marginBottom: 4 },
  title: {
    fontSize: 13,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    marginBottom: 4,
  },
  hint: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    marginBottom: 10,
    lineHeight: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rowLabel: {
    width: 64,
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
  chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
  },
  chipSelected: {
    borderColor: WellnessColors.accentBlue,
    backgroundColor: WellnessColors.iconTintBlue,
  },
  chipText: { fontSize: 12, fontWeight: '600', color: WellnessColors.textSecondary },
  chipTextSelected: { color: WellnessColors.accentBlue },
});
