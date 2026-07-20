/**
 * Profile, Settings & Quick Start — per-measure unit pickers.
 * Row labels follow app language; unit symbols stay English (glossary).
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getUnitsSectionCopy } from '../i18n/unitsSectionCopy';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import { WellnessColors } from '../theme/wellness';

type ChipProps<T extends string> = {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  rtl?: boolean;
};

function UnitChipRow<T extends string>({ label, value, options, onChange, rtl }: ChipProps<T>) {
  return (
    <View style={[styles.row, rtl && styles.rowRtl]}>
      <Text style={[styles.rowLabel, rtl && styles.rowLabelRtl]}>{label}</Text>
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
  /** App locale — drives row labels (default English). */
  langCode?: string;
  /** When true, skip title/hint (wizard already has StepHeading). */
  hideHeader?: boolean;
};

export function UnitsPreferenceSection({ prefs, onChange, langCode, hideHeader }: Props) {
  const t = getUnitsSectionCopy(langCode);
  const rtl = (langCode || '').toLowerCase().startsWith('he') || (langCode || '').toLowerCase().startsWith('ar');
  const patch = (partial: Partial<UnitsPrefs>) => onChange({ ...prefs, version: 1, ...partial });

  return (
    <View style={styles.wrap}>
      {!hideHeader ? (
        <>
          <Text style={[styles.title, rtl && styles.textRtl]}>{t.title}</Text>
          <Text style={[styles.hint, rtl && styles.textRtl]}>{t.hint}</Text>
        </>
      ) : null}
      <UnitChipRow
        label={t.glucose}
        value={prefs.glucose}
        rtl={rtl}
        options={[
          { id: 'mgdl', label: 'mg/dL' },
          { id: 'mmol', label: 'mmol/L' },
        ]}
        onChange={(glucose) => patch({ glucose })}
      />
      <UnitChipRow
        label={t.weight}
        value={prefs.mass}
        rtl={rtl}
        options={[
          { id: 'kg', label: 'kg' },
          { id: 'lb', label: 'lb' },
        ]}
        onChange={(mass) => patch({ mass })}
      />
      <UnitChipRow
        label={t.height}
        value={prefs.height}
        rtl={rtl}
        options={[
          { id: 'cm', label: 'cm' },
          { id: 'ftin', label: "ft'in\"" },
        ]}
        onChange={(height) => patch({ height })}
      />
      <UnitChipRow
        label={t.water}
        value={prefs.water}
        rtl={rtl}
        options={[
          { id: 'ml', label: 'ml' },
          { id: 'floz', label: 'fl oz' },
        ]}
        onChange={(water) => patch({ water })}
      />
      <UnitChipRow
        label={t.energy}
        value={prefs.energy}
        rtl={rtl}
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
  textRtl: {
    writingDirection: 'rtl',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  rowLabel: {
    width: 72,
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
  rowLabelRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
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
