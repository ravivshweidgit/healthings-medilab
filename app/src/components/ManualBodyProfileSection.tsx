/**
 * Manual weigh-in + body fat (one degree of freedom: %, kg, or muscle kg).
 */

import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  compositionSumRatio,
  estimateBodyFromProfile,
  fatKgFromPct,
  resolveFatPctFromInput,
  type ManualFatInput,
} from '../logic/bmrEstimate';
import {
  logManualWeighIn,
  saveManualBodyFatInput,
  type ManualBodySnapshot,
} from '../services/ManualBodyService';
import type { Gender } from '../services/TargetService';
import { WellnessColors } from '../theme/wellness';
import {
  displayToKg,
  formatEnergy,
  formatMass,
  massUnitLabel,
  parseLocaleNumber,
  type EnergyUnit,
  type MassUnit,
} from '../logic/unitConvert';

const HELP_URL = 'https://healthings.ai/help/manual-body.html';

export type ManualFatInputMode = ManualFatInput['mode'];

type Props = {
  effectiveWeightKg: number | null;
  manualBodySnap: ManualBodySnapshot | null;
  userGender: Gender;
  heightCm: number;
  userAge: number;
  massUnit?: MassUnit;
  energyUnit?: EnergyUnit;
  onSaved: (snap: ManualBodySnapshot) => void | Promise<void>;
};

function parseNum(raw: string): number | null {
  return parseLocaleNumber(raw);
}

export function ManualBodyProfileSection({
  effectiveWeightKg,
  manualBodySnap,
  userGender,
  heightCm,
  userAge,
  massUnit = 'kg',
  energyUnit = 'kcal',
  onSaved,
}: Props) {
  const [weighInInput, setWeighInInput] = useState('');
  const [weighInSaving, setWeighInSaving] = useState(false);
  const [fatMode, setFatMode] = useState<ManualFatInputMode>('pct');
  const [fatInput, setFatInput] = useState('');
  const [fatSaving, setFatSaving] = useState(false);

  const profileOpts = useMemo(
    () => ({ gender: userGender, heightCm, ageYears: userAge }),
    [userGender, heightCm, userAge],
  );

  const previewWeightDisp = parseNum(weighInInput);
  const previewWeight =
    (previewWeightDisp != null ? displayToKg(previewWeightDisp, massUnit) : null) ??
    manualBodySnap?.weight_kg ??
    effectiveWeightKg ??
    null;

  const previewFatPct = useMemo(() => {
    if (previewWeight == null || previewWeight <= 0) return null;
    const typed = parseNum(fatInput);
    if (typed != null && typed > 0) {
      const fromInput = resolveFatPctFromInput(previewWeight, { mode: fatMode, value: typed } as ManualFatInput);
      if (fromInput != null) return fromInput;
    }
    if (manualBodySnap?.weight_kg === previewWeight) return manualBodySnap.fat_pct;
    return null;
  }, [previewWeight, fatInput, fatMode, manualBodySnap]);

  const previewMetrics = useMemo(() => {
    if (previewWeight == null || previewWeight <= 0 || previewFatPct == null) return null;
    const est = estimateBodyFromProfile({
      ...profileOpts,
      weightKg: previewWeight,
      fatPct: previewFatPct,
    });
    const fatKg = fatKgFromPct(previewWeight, est.fat_pct);
    const ratio = compositionSumRatio(previewWeight, fatKg, est.muscle_mass_kg);
    return { ...est, fatKg, ratio };
  }, [previewWeight, previewFatPct, profileOpts]);

  const fatPlaceholder = useMemo(() => {
    if (!manualBodySnap) {
      if (fatMode === 'pct') return 'Body fat % (optional)';
      if (fatMode === 'kg') return `Fat mass ${massUnitLabel(massUnit)} (optional)`;
      return `Muscle mass ${massUnitLabel(massUnit)} (optional)`;
    }
    if (fatMode === 'pct') {
      return manualBodySnap.fat_pct_source === 'user'
        ? `Body fat · now ${manualBodySnap.fat_pct.toFixed(1)} %`
        : 'Body fat % (optional)';
    }
    if (fatMode === 'kg') {
      const kg = fatKgFromPct(manualBodySnap.weight_kg, manualBodySnap.fat_pct);
      return `Fat mass · now ${formatMass(kg, massUnit)}`;
    }
    return `Muscle · now ${formatMass(manualBodySnap.muscle_mass_kg, massUnit)}`;
  }, [manualBodySnap, fatMode, massUnit]);

  const buildFatInput = (): ManualFatInput | null => {
    const value = parseNum(fatInput);
    if (value == null || value <= 0) return null;
    if (fatMode === 'pct') return { mode: 'pct', value };
    // Fat kg / muscle: convert display mass → kg for store
    return { mode: fatMode, value: displayToKg(value, massUnit) };
  };

  const fatOptsForWeighIn = () => {
    const input = buildFatInput();
    if (!input) return {};
    if (input.mode === 'pct') return { fatPct: input.value };
    if (input.mode === 'kg') return { fatKg: input.value };
    return { muscleKg: input.value };
  };

  const massLabel = massUnitLabel(massUnit);

  return (
    <View>
      <Text style={styles.sectionTitle}>Body</Text>
      <Text style={styles.hint}>
        Log weight when you weigh yourself. Edit body fat as % or {massLabel} — muscle is calculated automatically.
      </Text>
      <Pressable onPress={() => void Linking.openURL(HELP_URL)} hitSlop={8}>
        <Text style={styles.helpLink}>How manual body logging works →</Text>
      </Pressable>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={
            effectiveWeightKg != null
              ? `Weight · now ${formatMass(effectiveWeightKg, massUnit)}`
              : `Weight (${massLabel})`
          }
          placeholderTextColor={WellnessColors.textSecondary}
          value={weighInInput}
          onChangeText={setWeighInInput}
        />
        <Pressable
          style={[styles.btn, weighInSaving && styles.btnDisabled]}
          disabled={weighInSaving}
          onPress={async () => {
            const typed = parseNum(weighInInput);
            const wKg = typed != null ? displayToKg(typed, massUnit) : null;
            const maxDisp = massUnit === 'lb' ? 880 : 400;
            if (typed == null || !(typed > 0) || typed > maxDisp || wKg == null) {
              Alert.alert('Weigh-in', `Enter a valid weight in ${massLabel}.`);
              return;
            }
            setWeighInSaving(true);
            try {
              const snap = await logManualWeighIn(wKg, { ...profileOpts, ...fatOptsForWeighIn() });
              await onSaved(snap);
              setWeighInInput('');
            } finally {
              setWeighInSaving(false);
            }
          }}
        >
          <Text style={styles.btnText}>{weighInSaving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>

      <View style={styles.modeRow}>
        {(['pct', 'kg', 'muscle'] as const).map((mode) => (
          <Pressable
            key={mode}
            style={[styles.modeChip, fatMode === mode && styles.modeChipActive]}
            onPress={() => setFatMode(mode)}
          >
            <Text style={[styles.modeChipText, fatMode === mode && styles.modeChipTextActive]}>
              {mode === 'pct' ? 'Fat %' : mode === 'kg' ? `Fat ${massLabel}` : `Muscle ${massLabel}`}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder={fatPlaceholder}
          placeholderTextColor={WellnessColors.textSecondary}
          value={fatInput}
          onChangeText={setFatInput}
        />
        <Pressable
          style={[styles.btn, fatSaving && styles.btnDisabled]}
          disabled={fatSaving}
          onPress={async () => {
            const input = buildFatInput();
            if (!input) {
              Alert.alert(
                'Body composition',
                fatMode === 'pct'
                  ? 'Enter a value between 3 and 65 %.'
                  : 'Enter a valid positive number.',
              );
              return;
            }
            setFatSaving(true);
            try {
              const snap = await saveManualBodyFatInput(input, profileOpts);
              if (!snap) {
                Alert.alert('Body composition', 'Log your weight first, or check the value.');
                return;
              }
              await onSaved(snap);
              setFatInput('');
            } finally {
              setFatSaving(false);
            }
          }}
        >
          <Text style={styles.btnText}>{fatSaving ? '…' : 'Save'}</Text>
        </Pressable>
      </View>

      {previewMetrics ? (
        <Text style={styles.preview}>
          Fat {formatMass(previewMetrics.fatKg, massUnit)} · Muscle{' '}
          {formatMass(previewMetrics.muscle_mass_kg, massUnit)} · BMR{' '}
          {formatEnergy(previewMetrics.bmr_kcal, energyUnit)}
          {manualBodySnap?.fat_pct_source !== 'user' && !fatInput.trim() ? ' · fat % estimated' : ''}
        </Text>
      ) : null}
      {previewMetrics && (previewMetrics.ratio < 0.92 || previewMetrics.ratio > 0.98) ? (
        <Text style={styles.warn}>
          Fat + muscle should be close to your weight. Adjust fat % or muscle {massUnitLabel(massUnit)}.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  helpLink: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.accentBlue,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  modeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: WellnessColors.background,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  modeChipActive: {
    backgroundColor: WellnessColors.accentBlue,
    borderColor: WellnessColors.accentBlue,
  },
  modeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
  modeChipTextActive: {
    color: '#fff',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: WellnessColors.textPrimary,
    backgroundColor: WellnessColors.surface,
  },
  btn: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  preview: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  warn: {
    fontSize: 12,
    color: '#C62828',
    lineHeight: 17,
    marginBottom: 12,
  },
});
