/**
 * Manual weigh-in + body composition + optional BMR (no Withings scale).
 * Same UI on Android and iOS â€” weight, %/mass toggle, Fat + Muscle fields, BMR, one Save.
 */

import { useEffect, useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  compositionSumRatio,
  estimateBodyFromProfile,
  fatKgFromPct,
  fatPctFromKg,
  muscleKgFromPct,
  musclePctFromKg,
  mifflinStJeorKcal,
} from '../logic/bmrEstimate';
import {
  logManualWeighIn,
  type ManualBodySnapshot,
} from '../services/ManualBodyService';
import type { Gender } from '../services/TargetService';
import { getBodyMetricsCopy } from '../i18n/bodyMetricsCopy';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import {
  displayToKcal,
  displayToKg,
  formatEnergy,
  formatMass,
  kcalToDisplay,
  kgToDisplay,
  massUnitLabel,
  parseLocaleNumber,
  type EnergyUnit,
  type MassUnit,
} from '../logic/unitConvert';

const HELP_URL = 'https://healthings.ai/en/help/manual-body.html';

type CompUnit = 'pct' | 'mass';

type Props = {
  effectiveWeightKg: number | null;
  manualBodySnap: ManualBodySnapshot | null;
  userGender: Gender;
  heightCm: number;
  userAge: number;
  massUnit?: MassUnit;
  energyUnit?: EnergyUnit;
  langCode?: string | null;
  onSaved: (snap: ManualBodySnapshot) => void | Promise<void>;
};

function parseNum(raw: string): number | null {
  return parseLocaleNumber(raw);
}

function fmt1(n: number): string {
  return (Math.round(n * 10) / 10).toFixed(1);
}

export function ManualBodyProfileSection({
  effectiveWeightKg,
  manualBodySnap,
  userGender,
  heightCm,
  userAge,
  massUnit = 'kg',
  energyUnit = 'kcal',
  langCode,
  onSaved,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const bodyLabels = getBodyMetricsCopy(langCode);
  const [weightInput, setWeightInput] = useState('');
  const [compUnit, setCompUnit] = useState<CompUnit>('pct');
  const [fatInput, setFatInput] = useState('');
  const [muscleInput, setMuscleInput] = useState('');
  const [bmrInput, setBmrInput] = useState('');
  const [saving, setSaving] = useState(false);

  const massLabel = massUnitLabel(massUnit);
  const energyLab = energyUnit === 'kj' ? 'kJ' : 'kcal';
  const compSuffix = compUnit === 'pct' ? '%' : massLabel;

  const profileOpts = useMemo(
    () => ({ gender: userGender, heightCm, ageYears: userAge }),
    [userGender, heightCm, userAge],
  );

  useEffect(() => {
    if (!manualBodySnap) {
      if (effectiveWeightKg != null) {
        setWeightInput(fmt1(kgToDisplay(effectiveWeightKg, massUnit)));
      }
      return;
    }
    const w = manualBodySnap.weight_kg;
    setWeightInput(fmt1(kgToDisplay(w, massUnit)));
    setCompUnit('pct');
    setFatInput(
      manualBodySnap.fat_pct_source === 'user' ? fmt1(manualBodySnap.fat_pct) : '',
    );
    const mPct = musclePctFromKg(w, manualBodySnap.muscle_mass_kg);
    setMuscleInput(mPct != null ? fmt1(mPct) : '');
    setBmrInput(String(Math.round(kcalToDisplay(manualBodySnap.bmr_kcal, energyUnit))));
  }, [manualBodySnap?.measuredAt, manualBodySnap?.bmr_kcal, massUnit, energyUnit, effectiveWeightKg]);

  const draftWeightKg = useMemo(() => {
    const n = parseNum(weightInput);
    if (n != null && n > 0) return displayToKg(n, massUnit);
    return manualBodySnap?.weight_kg ?? effectiveWeightKg ?? null;
  }, [weightInput, massUnit, manualBodySnap, effectiveWeightKg]);

  const draftComp = useMemo(() => {
    if (draftWeightKg == null || draftWeightKg <= 0) return null;
    const fatN = parseNum(fatInput);
    const musN = parseNum(muscleInput);

    let fatPct: number | null = null;
    let fatKg: number | null = null;
    let muscleKg: number | null = null;
    let musclePct: number | null = null;

    if (compUnit === 'pct') {
      if (fatN != null && fatN > 0) {
        fatPct = fatN;
        fatKg = fatKgFromPct(draftWeightKg, fatN);
      }
      if (musN != null && musN > 0) {
        musclePct = musN;
        muscleKg = muscleKgFromPct(draftWeightKg, musN);
      }
    } else {
      if (fatN != null && fatN > 0) {
        const kg = displayToKg(fatN, massUnit);
        fatKg = kg;
        fatPct = fatPctFromKg(draftWeightKg, kg);
      }
      if (musN != null && musN > 0) {
        const kg = displayToKg(musN, massUnit);
        muscleKg = kg;
        musclePct = musclePctFromKg(draftWeightKg, kg);
      }
    }

    // Fall back to saved snapshot for empty fields (preview only).
    if (fatPct == null && manualBodySnap) {
      fatPct = manualBodySnap.fat_pct;
      fatKg = fatKgFromPct(draftWeightKg, fatPct);
    }
    if (muscleKg == null && manualBodySnap) {
      muscleKg = manualBodySnap.muscle_mass_kg;
      musclePct = musclePctFromKg(draftWeightKg, muscleKg);
    }

    if (fatPct == null && muscleKg == null) {
      const est = estimateBodyFromProfile({
        ...profileOpts,
        weightKg: draftWeightKg,
      });
      fatPct = est.fat_pct;
      fatKg = fatKgFromPct(draftWeightKg, fatPct);
      muscleKg = est.muscle_mass_kg;
      musclePct = musclePctFromKg(draftWeightKg, muscleKg);
    }

    if (fatPct == null || fatKg == null || muscleKg == null) return null;

    const residualKg = Math.max(0, Math.round((draftWeightKg - fatKg - muscleKg) * 10) / 10);
    const ratio = compositionSumRatio(draftWeightKg, fatKg, muscleKg);
    const formulaBmr = mifflinStJeorKcal(
      profileOpts.gender,
      draftWeightKg,
      profileOpts.heightCm,
      profileOpts.ageYears,
    );

    return {
      fatPct,
      fatKg,
      muscleKg,
      musclePct,
      residualKg,
      ratio,
      formulaBmr,
      fatTyped: fatN != null && fatN > 0,
      muscleTyped: musN != null && musN > 0,
    };
  }, [
    draftWeightKg,
    fatInput,
    muscleInput,
    compUnit,
    massUnit,
    manualBodySnap,
    profileOpts,
  ]);

  const switchCompUnit = (next: CompUnit) => {
    if (next === compUnit || draftWeightKg == null || draftWeightKg <= 0) {
      setCompUnit(next);
      return;
    }
    const fatN = parseNum(fatInput);
    const musN = parseNum(muscleInput);
    if (next === 'mass') {
      // % â†’ mass
      if (fatN != null && fatN > 0) {
        setFatInput(fmt1(kgToDisplay(fatKgFromPct(draftWeightKg, fatN), massUnit)));
      }
      if (musN != null && musN > 0) {
        const kg = muscleKgFromPct(draftWeightKg, musN);
        if (kg != null) setMuscleInput(fmt1(kgToDisplay(kg, massUnit)));
      }
    } else {
      // mass â†’ %
      if (fatN != null && fatN > 0) {
        const pct = fatPctFromKg(draftWeightKg, displayToKg(fatN, massUnit));
        if (pct != null) setFatInput(fmt1(pct));
      }
      if (musN != null && musN > 0) {
        const pct = musclePctFromKg(draftWeightKg, displayToKg(musN, massUnit));
        if (pct != null) setMuscleInput(fmt1(pct));
      }
    }
    setCompUnit(next);
  };

  const saveAll = async () => {
    const wTyped = parseNum(weightInput);
    const wKg = wTyped != null ? displayToKg(wTyped, massUnit) : null;
    const maxW = massUnit === 'lb' ? 880 : 400;
    const bmrTyped = parseNum(bmrInput);
    const bmrKcal = bmrTyped != null ? Math.round(displayToKcal(bmrTyped, energyUnit)) : null;

    const fatN = parseNum(fatInput);
    const musN = parseNum(muscleInput);
    const hasComp = (fatN != null && fatN > 0) || (musN != null && musN > 0);

    if (wKg != null && (!(wKg > 0) || (wTyped != null && wTyped > maxW))) {
      Alert.alert('Body', `Enter a valid weight in ${massLabel}.`);
      return;
    }
    if (bmrKcal != null && (bmrKcal < 800 || bmrKcal > 4500)) {
      Alert.alert('BMR', `Enter BMR between 800 and 4500 ${energyLab}/day.`);
      return;
    }
    if (wKg == null && !manualBodySnap) {
      Alert.alert('Body', 'Enter your weight first.');
      return;
    }
    if (wKg == null && !hasComp && bmrKcal == null) {
      Alert.alert('Body', 'Change weight, composition, or BMR, then Save.');
      return;
    }

    const weightForComp = wKg ?? manualBodySnap!.weight_kg;
    const opts: {
      fatPct?: number;
      fatKg?: number;
      muscleKg?: number;
      musclePct?: number;
    } = {};

    if (fatN != null && fatN > 0) {
      if (compUnit === 'pct') {
        if (fatN < 3 || fatN > 65) {
          Alert.alert('Body fat', 'Enter body fat between 3% and 65%.');
          return;
        }
        opts.fatPct = fatN;
      } else {
        const kg = displayToKg(fatN, massUnit);
        if (fatPctFromKg(weightForComp, kg) == null) {
          Alert.alert('Body fat', `Enter a valid fat mass in ${massLabel}.`);
          return;
        }
        opts.fatKg = kg;
      }
    }

    if (musN != null && musN > 0) {
      if (compUnit === 'pct') {
        if (musN < 5 || musN > 80) {
          Alert.alert('Muscle', 'Enter muscle between 5% and 80%.');
          return;
        }
        opts.musclePct = musN;
      } else {
        const kg = displayToKg(musN, massUnit);
        if (!(kg > 0) || kg >= weightForComp) {
          Alert.alert('Muscle', `Muscle must be less than total weight (${massLabel}).`);
          return;
        }
        opts.muscleKg = kg;
      }
    }

    const fatKgCheck =
      opts.fatPct != null
        ? fatKgFromPct(weightForComp, opts.fatPct)
        : opts.fatKg != null
          ? opts.fatKg
          : null;
    const musKgCheck =
      opts.musclePct != null
        ? muscleKgFromPct(weightForComp, opts.musclePct)
        : opts.muscleKg != null
          ? opts.muscleKg
          : null;
    if (fatKgCheck != null && musKgCheck != null && fatKgCheck + musKgCheck > weightForComp + 0.05) {
      Alert.alert('Composition', 'Fat + muscle cannot exceed total weight. Check your values.');
      return;
    }

    setSaving(true);
    try {
      const weightToSave = wKg ?? manualBodySnap!.weight_kg;
      const snap = await logManualWeighIn(weightToSave, {
        ...profileOpts,
        ...opts,
        ...(bmrKcal != null ? { bmrKcal } : {}),
      });
      await onSaved(snap);
    } finally {
      setSaving(false);
    }
  };

  const fatAlt =
    draftComp && draftWeightKg
      ? compUnit === 'pct'
        ? `â‰ˆ ${formatMass(draftComp.fatKg, massUnit)}`
        : `â‰ˆ ${fmt1(draftComp.fatPct)}%`
      : null;
  const muscleAlt =
    draftComp && draftComp.musclePct != null
      ? compUnit === 'pct'
        ? `â‰ˆ ${formatMass(draftComp.muscleKg, massUnit)}`
        : `â‰ˆ ${fmt1(draftComp.musclePct)}%`
      : null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.sectionTitle}>Body</Text>
      <Text style={styles.hint}>
        Log weight and composition from your scale or DEXA. Fat and muscle are independent â€” residual
        (bone, water) is normal.
      </Text>
      <Pressable onPress={() => void Linking.openURL(HELP_URL)} hitSlop={8}>
        <Text style={styles.helpLink}>How manual body logging works</Text>
      </Pressable>

      <Text style={styles.fieldLabel}>{bodyLabels.weight} ({massLabel})</Text>
      <TextInput
        style={styles.input}
        keyboardType="decimal-pad"
        value={weightInput}
        onChangeText={setWeightInput}
        placeholder={massUnit === 'lb' ? 'e.g. 173' : 'e.g. 78.4'}
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={`${bodyLabels.weight} in ${massLabel}`}
      />

      <View style={styles.compHeader}>
        <Text style={styles.fieldLabelInline}>Composition</Text>
        <View style={styles.unitToggle}>
          {(
            [
              { id: 'pct' as const, label: '%' },
              { id: 'mass' as const, label: massLabel },
            ] as const
          ).map((opt) => {
            const on = compUnit === opt.id;
            return (
              <Pressable
                key={opt.id}
                style={[styles.unitChip, on && styles.unitChipActive]}
                onPress={() => switchCompUnit(opt.id)}
                accessibilityRole="button"
                accessibilityState={{ selected: on }}
                accessibilityLabel={`Composition in ${opt.label}`}
              >
                <Text style={[styles.unitChipText, on && styles.unitChipTextActive]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.compRow}>
        <View style={styles.compCol}>
          <Text style={styles.compColLabel}>{bodyLabels.fat}</Text>
          <View style={styles.compInputRow}>
            <TextInput
              style={styles.compInput}
              keyboardType="decimal-pad"
              value={fatInput}
              onChangeText={setFatInput}
              placeholder={compUnit === 'pct' ? '18.5' : massUnit === 'lb' ? '32' : '14.5'}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={`${bodyLabels.fat} in ${compSuffix}`}
            />
            <Text style={styles.compUnit}>{compSuffix}</Text>
          </View>
          {fatAlt ? <Text style={styles.compAlt}>{fatAlt}</Text> : null}
        </View>
        <View style={styles.compCol}>
          <Text style={styles.compColLabel}>{bodyLabels.muscle}</Text>
          <View style={styles.compInputRow}>
            <TextInput
              style={styles.compInput}
              keyboardType="decimal-pad"
              value={muscleInput}
              onChangeText={setMuscleInput}
              placeholder={compUnit === 'pct' ? '42' : massUnit === 'lb' ? '73' : '33'}
              placeholderTextColor={colors.textSecondary}
              accessibilityLabel={`${bodyLabels.muscle} in ${compSuffix}`}
            />
            <Text style={styles.compUnit}>{compSuffix}</Text>
          </View>
          {muscleAlt ? <Text style={styles.compAlt}>{muscleAlt}</Text> : null}
        </View>
      </View>

      {draftComp ? (
        <Text style={styles.preview}>
          Residual â‰ˆ {formatMass(draftComp.residualKg, massUnit)}
          {!draftComp.fatTyped && manualBodySnap?.fat_pct_source !== 'user'
            ? ' Â· fat estimated until you enter it'
            : ''}
        </Text>
      ) : null}
      {draftComp && draftComp.ratio > 1.001 ? (
        <Text style={styles.warn}>Fat + muscle exceeds weight â€” check the numbers.</Text>
      ) : null}

      <Text style={styles.fieldLabel}>BMR ({energyLab}/day)</Text>
      <TextInput
        style={styles.input}
        keyboardType="number-pad"
        value={bmrInput}
        onChangeText={setBmrInput}
        placeholder={
          draftComp
            ? `Formula ~${Math.round(kcalToDisplay(draftComp.formulaBmr, energyUnit))} â€” or scale value`
            : 'e.g. 1854'
        }
        placeholderTextColor={colors.textSecondary}
        accessibilityLabel={`BMR in ${energyLab} per day`}
      />
      {draftComp ? (
        <Text style={styles.bmrHint}>
          Mifflin estimate ~{formatEnergy(draftComp.formulaBmr, energyUnit)}/day. Override with your
          scale or clinic BMR if you have it.
        </Text>
      ) : null}

      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        disabled={saving}
        onPress={() => void saveAll()}
        accessibilityRole="button"
        accessibilityLabel="Save body"
      >
        <Text style={styles.saveBtnText}>{saving ? 'Savingâ€¦' : 'Save body'}</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
  wrap: { marginTop: 4, marginBottom: 8 },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 6,
  },
  hint: {
    fontSize: 12,
    color: c.textSecondary,
    lineHeight: 17,
    marginBottom: 4,
  },
  helpLink: {
    fontSize: 12,
    fontWeight: '600',
    color: c.accentBlue,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSecondary,
    marginBottom: 6,
    marginTop: 4,
  },
  fieldLabelInline: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textSecondary,
  },
  input: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 16,
    color: c.textPrimary,
    backgroundColor: c.surface,
    marginBottom: 10,
  },
  compHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
    marginTop: 4,
  },
  unitToggle: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.gridLine,
    overflow: 'hidden',
    backgroundColor: c.background,
  },
  unitChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 44,
    alignItems: 'center',
  },
  unitChipActive: {
    backgroundColor: c.accentBlue,
  },
  unitChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textSecondary,
  },
  unitChipTextActive: { color: '#fff' },
  compRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 6,
  },
  compCol: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 12,
    padding: 10,
    backgroundColor: c.surface,
  },
  compColLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 6,
  },
  compInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  compInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
    backgroundColor: c.background,
  },
  compUnit: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '600',
    color: c.textSecondary,
    minWidth: 28,
  },
  compAlt: {
    marginTop: 6,
    fontSize: 11,
    color: c.textSecondary,
  },
  preview: {
    fontSize: 12,
    color: c.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  warn: {
    fontSize: 12,
    color: '#C62828',
    lineHeight: 17,
    marginBottom: 8,
  },
  bmrHint: {
    fontSize: 11,
    color: c.textSecondary,
    lineHeight: 15,
    marginTop: -4,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: c.accentBlue,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
