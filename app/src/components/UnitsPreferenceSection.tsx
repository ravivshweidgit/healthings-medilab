/**
 * Profile, Settings & Quick Start — per-measure unit pickers.
 * Row labels follow app language; unit symbols stay English (glossary).
 */
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check } from 'lucide-react-native';
import { getUnitsSectionCopy } from '../i18n/unitsSectionCopy';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

/** `card` = Quick Start: one grouped card, divided rows, bigger targets, tick on the pick. */
type Variant = 'compact' | 'card';

/** Michal QS teal — keep in sync with WelcomeQuickStartWizard NEXT_BLUE (prompt111). */
const QS_TEAL = '#0D86A3';
const QS_TEAL_DEEP = '#0BA5BE';

type ChipProps<T extends string> = {
  label: string;
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  rtl?: boolean;
  variant?: Variant;
  /** Card variant draws a hairline between rows, so the last row skips it. */
  last?: boolean;
};

function UnitChipRow<T extends string>({
  label,
  value,
  options,
  onChange,
  rtl,
  variant = 'compact',
  last = false,
}: ChipProps<T>) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const card = variant === 'card';
  return (
    <View
      style={[
        styles.row,
        card && styles.rowCard,
        card && rtl && styles.rowCardRtl,
        card && !last && styles.rowCardDivider,
      ]}
    >
      <Text
        style={[
          styles.rowLabel,
          card && styles.rowLabelCard,
          rtl && styles.rowLabelRtl,
        ]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View
        style={[
          styles.chips,
          card && styles.chipsCard,
          card && rtl && styles.chipsCardRtl,
        ]}
      >
        {options.map((opt) => {
          const selected = opt.id === value;
          return (
            <Pressable
              key={opt.id}
              style={[
                styles.chip,
                card && styles.chipCard,
                selected && styles.chipSelected,
                card && selected && styles.chipCardSelected,
              ]}
              onPress={() => onChange(opt.id)}
              accessibilityRole="button"
              accessibilityState={{ selected }}
            >
              <Text
                style={[
                  styles.chipText,
                  card && styles.chipTextCard,
                  selected && styles.chipTextSelected,
                  card && selected && styles.chipTextCardSelected,
                ]}
                numberOfLines={1}
              >
                {opt.label}
              </Text>
              {card && selected ? (
                <Check
                  size={14}
                  color={isDark ? QS_TEAL_DEEP : '#FFFFFF'}
                  strokeWidth={3}
                />
              ) : null}
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
  /** `card` for Quick Start; Profile/Settings keep the dense default. */
  variant?: Variant;
};

export function UnitsPreferenceSection({
  prefs,
  onChange,
  langCode,
  hideHeader,
  variant = 'compact',
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const t = getUnitsSectionCopy(langCode);
  const rtl =
    (langCode || '').toLowerCase().startsWith('he') ||
    (langCode || '').toLowerCase().startsWith('ar');
  const patch = (partial: Partial<UnitsPrefs>) => onChange({ ...prefs, version: 1, ...partial });
  const card = variant === 'card';

  return (
    <View
      style={[
        styles.wrap,
        card && styles.wrapCard,
        // Compact Profile mirrors he/ar. Card rows set direction themselves so
        // pill width cannot spill into the Hebrew label (Michal units mockup).
        !card && rtl ? styles.wrapRtl : null,
      ]}
    >
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
        variant={variant}
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
        variant={variant}
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
        variant={variant}
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
        variant={variant}
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
        variant={variant}
        last
        options={[
          { id: 'kcal', label: 'kcal' },
          { id: 'kj', label: 'kJ' },
        ]}
        onChange={(energy) => patch({ energy })}
      />
    </View>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrap: { marginTop: 8, marginBottom: 4 },
    wrapRtl: { direction: 'rtl' },
    wrapCard: {
      marginTop: 4,
      paddingHorizontal: 14,
      borderWidth: 1,
      borderColor: c.gridLine,
      borderRadius: 16,
      backgroundColor: c.surface,
    },
    title: {
      fontSize: 13,
      fontWeight: '700',
      color: c.textPrimary,
      marginBottom: 4,
    },
    hint: {
      fontSize: 11,
      color: c.textSecondary,
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
    rowCard: {
      marginBottom: 0,
      paddingVertical: 12,
      gap: 12,
    },
    // HE/AR: pills on the physical left, label on the right (Michal).
    rowCardRtl: {
      flexDirection: 'row-reverse',
    },
    rowCardDivider: {
      borderBottomWidth: 1,
      borderBottomColor: c.gridLine,
    },
    rowLabel: {
      width: 72,
      fontSize: 12,
      fontWeight: '600',
      color: c.textSecondary,
    },
    rowLabelCard: {
      width: undefined,
      flexGrow: 0,
      flexShrink: 0,
      minWidth: 64,
      maxWidth: 96,
      fontSize: 14,
      fontWeight: '700',
      color: c.textPrimary,
    },
    rowLabelRtl: {
      textAlign: 'right',
      writingDirection: 'rtl',
    },
    chips: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
    // Equal-width pills, LTR tokens, hug the edge away from the label.
    chipsCard: {
      flex: 1,
      minWidth: 0,
      flexWrap: 'nowrap',
      direction: 'ltr',
      justifyContent: 'flex-end',
      gap: 8,
    },
    // With row-reverse, flex-end packs toward the physical left (away from label).
    chipsCardRtl: {
      flexDirection: 'row-reverse',
      justifyContent: 'flex-end',
    },
    // Dark: both states sit on canvas black and the border alone carries selection, so
    // the row reads as a set of outlined pills instead of one filled tinted chip.
    chip: {
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.gridLine,
      backgroundColor: isDark ? c.background : c.surface,
    },
    chipSelected: {
      borderColor: c.accentBlue,
      backgroundColor: isDark ? c.background : c.iconTintBlue,
    },
    chipCard: {
      flexGrow: 1,
      flexBasis: 0,
      flexShrink: 1,
      minWidth: 0,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      justifyContent: 'center',
      paddingHorizontal: 10,
      paddingVertical: 10,
    },
    // Light fills the pick so the column of chosen units reads at a glance; dark keeps the
    // outlined-on-black pattern (a filled teal pill loses white-text contrast on near-black).
    chipCardSelected: {
      backgroundColor: isDark ? c.background : QS_TEAL,
      borderColor: isDark ? QS_TEAL_DEEP : QS_TEAL,
    },
    chipText: { fontSize: 12, fontWeight: '600', color: c.textSecondary },
    chipTextCard: { fontSize: 13, fontWeight: '700', flexShrink: 1 },
    chipTextSelected: { color: c.accentBlue },
    chipTextCardSelected: { color: isDark ? QS_TEAL_DEEP : '#FFFFFF' },
  });
