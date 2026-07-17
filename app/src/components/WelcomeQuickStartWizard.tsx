/**
 * Welcome & Quick Start — 7-step onboarding for all new users.
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LabReportModal } from './LabReportModal';
import { NutritionDirectiveReviewModal } from './NutritionDirectiveReviewModal';
import { estimateBodyFromProfile } from '../logic/bmrEstimate';
import {
  confirmSavedMacroTarget,
  macroSuggestionToDailyTarget,
  suggestMacroTargets,
} from '../logic/macroAutoAdjust';
import {
  displayToKg,
  formatEnergy,
  formatMass,
  heightCmToInput,
  coerceHeightInputForUnit,
  kgToDisplay,
  massUnitLabel,
  parseHeightInputToCm,
  parseLocaleNumber,
} from '../logic/unitConvert';
import { formatUserRulesBlock } from '../logic/userRulesContext';
import { suggestBodyTargets } from '../services/GeminiService';
import { healthConnectService } from '../services/HealthConnectService';
import { healthKitService } from '../services/HealthKitService';
import type { LabReport } from '../services/LabLogService';
import { getManualBody, saveManualBody, type ManualBodySnapshot } from '../services/ManualBodyService';
import { loadWithingsStore } from '../services/WithingsPersistenceService';
import type { NutritionDirective } from '../services/NutritionDirectiveService';
import { setOnboardingCompletedAt } from '../services/ProfileCompletenessService';
import {
  saveSourceConfig,
  sourceConfigFromDevices,
  type DeviceSurvey,
} from '../services/SourceConfigService';
import { syncMetricsStore } from '../services/MetricsPersistenceService';
import { syncSamsungStepsIfConfigured } from '../services/SamsungStepsAdapter';
import {
  computeAge,
  getBirthdate,
  getCachedHeightCm,
  getGender,
  getLanguage,
  getMentorGender,
  resetQuickQuestionsForLanguage,
  getMentors,
  getUserRules,
  getBodyTarget,
  getMacroTarget,
  saveBodyTarget,
  setBirthdate,
  setGender,
  setHeightCm,
  setLanguage,
  setManualBmrKcal,
  setMentorGender,
  SUPPORTED_LANGUAGES,
  type BodyTarget,
  type DailyMacroTarget,
  type Gender,
  type UserLanguage,
} from '../services/TargetService';
import {
  DEFAULT_UNITS_PREFS,
  getUnitsPrefs,
  saveUnitsPrefs,
  type UnitsPrefs,
} from '../services/UnitsPreferenceService';
import { WellnessColors } from '../theme/wellness';
import { SetupToggleRow } from './SetupToggleRow';
import { PhoneHealthActivityStrip } from './PhoneHealthActivityStrip';
import { UnitsPreferenceSection } from './UnitsPreferenceSection';

const TOTAL_STEPS = 7;

type Props = {
  visible: boolean;
  onComplete: () => void;
  onOpenFoodLog?: () => void;
};

export function WelcomeQuickStartWizard({ visible, onComplete, onOpenFoodLog }: Props) {
  const [step, setStep] = useState(1);
  const [gender, setGenderPick] = useState<Gender>('male');
  const [mentorGender, setMentorGenderPick] = useState<Gender>('female');
  const [heightInput, setHeightInput] = useState('');
  const [birthdate, setBirthdatePick] = useState(new Date(1980, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [language, setLangPick] = useState<UserLanguage>(SUPPORTED_LANGUAGES[0]);
  const [unitsPrefs, setUnitsPrefs] = useState<UnitsPrefs>({ ...DEFAULT_UNITS_PREFS });

  const [hasScale, setHasScale] = useState<boolean | null>(null);
  const [hasWatch, setHasWatch] = useState<boolean | null>(null);
  const [tracksCgm, setTracksCgm] = useState<boolean | null>(null);

  const [weightInput, setWeightInput] = useState('');
  const [linkWithingsLater, setLinkWithingsLater] = useState(false);

  const [permBusy, setPermBusy] = useState(false);
  const [permNote, setPermNote] = useState<string | null>(null);

  const [labModal, setLabModal] = useState(false);
  const [labAutoPick, setLabAutoPick] = useState(false);
  const [nutritionModal, setNutritionModal] = useState(false);
  const [nutritionAutoPick, setNutritionAutoPick] = useState(false);
  const [labDone, setLabDone] = useState(false);
  const [nutritionDone, setNutritionDone] = useState(false);

  const [targetsBusy, setTargetsBusy] = useState(false);
  const [targetsError, setTargetsError] = useState<string | null>(null);
  const [bodyTarget, setBodyTarget] = useState<BodyTarget | null>(null);
  const [macroTarget, setMacroTarget] = useState<DailyMacroTarget | null>(null);
  const [usingSavedTargets, setUsingSavedTargets] = useState(false);
  const [rulesPreview, setRulesPreview] = useState<string | null>(null);
  const [manualBody, setManualBody] = useState<ManualBodySnapshot | null>(null);

  const [stepError, setStepError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      const [lang, gd, ht, bd, mgd, prefs] = await Promise.all([
        getLanguage(),
        getGender(),
        getCachedHeightCm(),
        getBirthdate(),
        getMentorGender(),
        getUnitsPrefs(),
      ]);
      setLangPick(lang);
      setUnitsPrefs(prefs);
      if (gd) setGenderPick(gd);
      if (ht) setHeightInput(heightCmToInput(ht, prefs.height));
      if (bd) {
        const d = new Date(bd);
        if (!Number.isNaN(d.getTime())) setBirthdatePick(d);
      }
      if (mgd) setMentorGenderPick(mgd);
      else if (gd === 'male' || gd === 'female') setMentorGenderPick(gd === 'male' ? 'female' : 'male');
      setStep(1);
      setStepError(null);
      setBodyTarget(null);
      setMacroTarget(null);
      setTargetsError(null);
      setLabDone(false);
      setNutritionDone(false);
      setUsingSavedTargets(false);
      setRulesPreview(null);
    })();
  }, [visible]);

  const onUnitsChange = useCallback(
    (next: UnitsPrefs) => {
      if (next.height !== unitsPrefs.height) {
        setHeightInput(coerceHeightInputForUnit(heightInput, next.height, null));
      }
      if (next.mass !== unitsPrefs.mass) {
        const n = parseLocaleNumber(weightInput);
        if (n != null) {
          const kg = displayToKg(n, unitsPrefs.mass);
          setWeightInput(String(Number(kgToDisplay(kg, next.mass).toFixed(1))));
        }
      }
      setUnitsPrefs(next);
    },
    [unitsPrefs, heightInput, weightInput],
  );

  const age = useMemo(() => {
    const iso = birthdate.toISOString().split('T')[0];
    return computeAge(iso);
  }, [birthdate]);

  const deviceSurvey: DeviceSurvey | null = useMemo(() => {
    if (hasScale == null || hasWatch == null || tracksCgm == null) return null;
    return { hasWithingsScale: hasScale, hasWithingsWatch: hasWatch, tracksGlucose: tracksCgm };
  }, [hasScale, hasWatch, tracksCgm]);

  const progressLabel = `Quick Start · ${step} of ${TOTAL_STEPS}`;

  const validateStep1 = useCallback((): boolean => {
    const cm = parseHeightInputToCm(heightInput, unitsPrefs.height);
    if (cm == null || cm < 100 || cm > 250) {
      setStepError(
        unitsPrefs.height === 'ftin'
          ? 'Enter height between about 3\'3" and 8\'2".'
          : 'Enter height between 100 and 250 cm.',
      );
      return false;
    }
    if (age < 13) {
      setStepError('You must be at least 13 years old.');
      return false;
    }
    setStepError(null);
    return true;
  }, [heightInput, unitsPrefs.height, age]);

  const validateStep2 = useCallback((): boolean => {
    if (hasScale == null || hasWatch == null || tracksCgm == null) {
      setStepError('Answer all device questions.');
      return false;
    }
    setStepError(null);
    return true;
  }, [hasScale, hasWatch, tracksCgm]);

  const validateStep3 = useCallback((): boolean => {
    if (hasScale && linkWithingsLater) {
      setStepError(null);
      return true;
    }
    const raw = parseLocaleNumber(weightInput);
    const kg = raw != null ? displayToKg(raw, unitsPrefs.mass) : null;
    if (kg == null || kg < 30 || kg > 300) {
      const unit = massUnitLabel(unitsPrefs.mass);
      setStepError(
        unitsPrefs.mass === 'lb'
          ? `Enter a valid weight in lb (about 66–660).`
          : `Enter a valid weight in ${unit} (30–300).`,
      );
      return false;
    }
    setStepError(null);
    return true;
  }, [hasScale, linkWithingsLater, weightInput, unitsPrefs.mass]);

  const saveStep1 = useCallback(async () => {
    const iso = birthdate.toISOString().split('T')[0];
    const cm = parseHeightInputToCm(heightInput, unitsPrefs.height);
    if (cm == null) return;
    const prev = await getLanguage();
    await Promise.all([
      setBirthdate(iso),
      setGender(gender),
      setHeightCm(cm),
      setLanguage(language),
      setMentorGender(mentorGender),
      saveUnitsPrefs(unitsPrefs),
    ]);
    if (prev.code !== language.code) {
      await resetQuickQuestionsForLanguage(language);
    }
  }, [birthdate, heightInput, gender, language, mentorGender, unitsPrefs]);

  const buildManualBody = useCallback(async (): Promise<ManualBodySnapshot | null> => {
    if (hasScale && linkWithingsLater) return null;
    const raw = parseLocaleNumber(weightInput);
    const w = raw != null ? displayToKg(raw, unitsPrefs.mass) : null;
    if (w == null || w < 30) return null;
    const cm = parseHeightInputToCm(heightInput, unitsPrefs.height);
    if (cm == null) return null;
    const est = estimateBodyFromProfile({ gender, weightKg: w, heightCm: cm, ageYears: age });
    const snap: ManualBodySnapshot = {
      weight_kg: w,
      fat_pct: est.fat_pct,
      muscle_mass_kg: est.muscle_mass_kg,
      bmr_kcal: est.bmr_kcal,
      measuredAt: new Date().toISOString(),
      source: 'ai-estimate',
    };
    await saveManualBody(snap);
    await setManualBmrKcal(est.bmr_kcal);
    return snap;
  }, [hasScale, linkWithingsLater, weightInput, heightInput, gender, age, unitsPrefs]);

  const runPermissions = useCallback(async () => {
    setPermBusy(true);
    setPermNote(null);
    const notes: string[] = [];
    try {
      if (Platform.OS === 'ios') {
        if (tracksCgm) {
          try {
            await healthKitService.initializeAndRequestPermissions();
            notes.push(
              'Apple Health: allow Blood Glucose for Healthings. In CareSens Air, share glucose with Apple Health.',
            );
          } catch {
            notes.push(
              'Apple Health: allow Blood Glucose later in Settings → Health → Data Access → Healthings.',
            );
          }
        }
        if (!hasWatch) {
          try {
            const ok = await healthKitService.requestActivityPermissions();
            notes.push(
              ok
                ? 'Apple Health: steps and heart rate access granted or already on.'
                : 'Apple Health: allow Steps and Heart Rate for Healthings (Settings → Health → Data Access).',
            );
          } catch {
            notes.push(
              'Apple Health: allow Steps and Heart Rate later in Settings → Health → Data Access → Healthings.',
            );
          }
        }
        if (notes.length === 0) {
          notes.push('Withings cloud sync is available after you link your account.');
        }
        return;
      }
      if (tracksCgm) {
        try {
          await healthConnectService.initializeAndRequestPermissions();
          notes.push('Glucose access granted or already on.');
        } catch {
          notes.push('Glucose: allow in Health Connect settings later.');
        }
      }
      if (!hasWatch) {
        const ok = await healthConnectService.requestActivityPermissions();
        notes.push(
          ok
            ? 'Health Connect: activity access granted (steps, workouts, heart rate).'
            : 'Health Connect: allow Steps, Exercise, Active calories, and Heart rate for Healthings.',
        );
      }
    } finally {
      setPermNote(notes.join(' '));
      setPermBusy(false);
    }
  }, [tracksCgm, hasWatch]);

  const resolveBodyForTargets = useCallback(async (): Promise<ManualBodySnapshot | null> => {
    if (manualBody) return manualBody;
    const fromInput = await buildManualBody();
    if (fromInput) return fromInput;
    const storedManual = await getManualBody();
    if (storedManual) return storedManual;
    const { bodyScan } = await loadWithingsStore();
    if (bodyScan?.weightKg != null && bodyScan.weightKg > 0) {
      const cm = parseHeightInputToCm(heightInput, unitsPrefs.height) ?? 170;
      const fatPct =
        bodyScan.fatMassKg != null && bodyScan.weightKg > 0
          ? (bodyScan.fatMassKg / bodyScan.weightKg) * 100
          : estimateBodyFromProfile({
              gender,
              weightKg: bodyScan.weightKg,
              heightCm: cm,
              ageYears: age,
            }).fat_pct;
      return {
        weight_kg: bodyScan.weightKg,
        fat_pct: fatPct,
        muscle_mass_kg:
          bodyScan.muscleMassKg ??
          bodyScan.weightKg - (bodyScan.weightKg * fatPct) / 100,
        bmr_kcal: bodyScan.bmrKcalDay ?? estimateBodyFromProfile({
          gender,
          weightKg: bodyScan.weightKg,
          heightCm: cm,
          ageYears: age,
        }).bmr_kcal,
        measuredAt: bodyScan.measuredAt ?? new Date().toISOString(),
        source: 'user-entered',
      };
    }
    if (hasScale && linkWithingsLater) {
      const cm = parseHeightInputToCm(heightInput, unitsPrefs.height) ?? 170;
      const estWeight = Math.round(24 * (cm / 100) ** 2 * 10) / 10;
      const est = estimateBodyFromProfile({ gender, weightKg: estWeight, heightCm: cm, ageYears: age });
      return {
        weight_kg: estWeight,
        fat_pct: est.fat_pct,
        muscle_mass_kg: est.muscle_mass_kg,
        bmr_kcal: est.bmr_kcal,
        measuredAt: new Date().toISOString(),
        source: 'ai-estimate',
      };
    }
    return null;
  }, [manualBody, buildManualBody, heightInput, age, gender, hasScale, linkWithingsLater, unitsPrefs.height]);

  const runTargetAi = useCallback(async (forceRegenerate = false) => {
    setTargetsBusy(true);
    setTargetsError(null);
    try {
      const [existingBody, existingMacro, rules] = await Promise.all([
        getBodyTarget(),
        getMacroTarget(),
        getUserRules(),
      ]);
      setRulesPreview(rules ? formatUserRulesBlock(rules) : null);

      if (!forceRegenerate && existingBody && existingMacro) {
        setBodyTarget(existingBody);
        setMacroTarget(existingMacro);
        setUsingSavedTargets(true);
        return;
      }

      setUsingSavedTargets(false);
      const body = await resolveBodyForTargets();
      if (body) setManualBody(body);
      if (!body) {
        setTargetsError('Enter weight, link Withings, or pull refresh before setting targets.');
        return;
      }
      const cm = parseHeightInputToCm(heightInput, unitsPrefs.height) ?? 170;
      const bmi = body.weight_kg / ((cm / 100) ** 2);
      let proposedBody: BodyTarget;
      if (!forceRegenerate && existingBody) {
        proposedBody = existingBody;
      } else {
        try {
          const ai = await suggestBodyTargets(
            {
              weight_kg: body.weight_kg,
              fatPct: body.fat_pct,
              muscleMass_kg: body.muscle_mass_kg,
              bmr_kcal: body.bmr_kcal,
              heightCm: cm,
              age,
              gender,
              bmi,
            },
            language,
          );
          const now = new Date().toISOString();
          proposedBody = {
            targetWeight_kg: ai.targetWeight_kg,
            targetFatPct: ai.targetFatPct,
            targetMuscleMass_kg: ai.targetMuscleMass_kg,
            aiWeight_kg: ai.targetWeight_kg,
            aiFatPct: ai.targetFatPct,
            aiMuscle_kg: ai.targetMuscleMass_kg,
            startWeight_kg: body.weight_kg,
            startFatPct: body.fat_pct,
            startMuscle_kg: body.muscle_mass_kg,
            reasoning: ai.reasoning,
            analyzedAt: now,
            estimatedWeeks: ai.estimatedWeeks,
            targetWeeks: ai.estimatedWeeks,
          };
        } catch {
          const now = new Date().toISOString();
          proposedBody = existingBody ?? {
            targetWeight_kg: body.weight_kg,
            targetFatPct: body.fat_pct,
            targetMuscleMass_kg: body.muscle_mass_kg,
            aiWeight_kg: body.weight_kg,
            aiFatPct: body.fat_pct,
            aiMuscle_kg: body.muscle_mass_kg,
            startWeight_kg: body.weight_kg,
            startFatPct: body.fat_pct,
            startMuscle_kg: body.muscle_mass_kg,
            reasoning: 'Default healthy targets from your profile.',
            analyzedAt: now,
            estimatedWeeks: 12,
            targetWeeks: 12,
          };
        }
      }
      setBodyTarget(proposedBody);

      const { suggestion } = await suggestMacroTargets({ trigger: 'onboarding', lang: language });
      const [mentorList] = await Promise.all([getMentors()]);
      const daily = macroSuggestionToDailyTarget(suggestion, rules, mentorList);
      setMacroTarget(daily);
    } catch (e: unknown) {
      setTargetsError(e instanceof Error ? e.message : 'Could not generate targets.');
    } finally {
      setTargetsBusy(false);
    }
  }, [resolveBodyForTargets, heightInput, age, gender, language, unitsPrefs.height]);

  useEffect(() => {
    if (visible && step === 6 && !bodyTarget && !targetsBusy && !targetsError) {
      void runTargetAi(false);
    }
  }, [visible, step, bodyTarget, targetsBusy, targetsError, runTargetAi]);

  const finishWizard = useCallback(async () => {
    if (!deviceSurvey) return;
    const usesManual = !hasScale || !linkWithingsLater;
    await saveSourceConfig(sourceConfigFromDevices(deviceSurvey, usesManual));
    const rawW = parseLocaleNumber(weightInput);
    const w = rawW != null ? displayToKg(rawW, unitsPrefs.mass) : 0;
    const cm = parseHeightInputToCm(heightInput, unitsPrefs.height) ?? 0;
    if (usesManual && w > 0 && cm > 0) {
      if (!deviceSurvey.withingsWatch) {
        await syncMetricsStore();
      }
      await syncSamsungStepsIfConfigured(w, cm, gender);
    }
    await setOnboardingCompletedAt();
    onComplete();
  }, [
    deviceSurvey,
    hasScale,
    linkWithingsLater,
    weightInput,
    heightInput,
    gender,
    onComplete,
    unitsPrefs.mass,
    unitsPrefs.height,
  ]);

  const goNext = useCallback(async () => {
    if (step === 1) {
      if (!validateStep1()) return;
      await saveStep1();
      setStep(2);
      return;
    }
    if (step === 2) {
      if (!validateStep2()) return;
      setStep(3);
      return;
    }
    if (step === 3) {
      if (!validateStep3()) return;
      if (!hasScale || !linkWithingsLater) {
        const body = await buildManualBody();
        if (body) setManualBody(body);
      }
      setStep(4);
      return;
    }
    if (step === 4) {
      await runPermissions();
      setStep(5);
      return;
    }
    if (step === 5) {
      setStep(6);
      return;
    }
    if (step === 6) {
      if (!bodyTarget || !macroTarget) {
        setStepError('Wait for targets or tap Retry.');
        return;
      }
      await saveBodyTarget(bodyTarget);
      await confirmSavedMacroTarget(macroTarget, 'onboarding');
      setStep(7);
      return;
    }
  }, [
    step,
    validateStep1,
    validateStep2,
    validateStep3,
    saveStep1,
    buildManualBody,
    hasScale,
    linkWithingsLater,
    runPermissions,
    bodyTarget,
    macroTarget,
  ]);

  const goBack = useCallback(() => {
    setStepError(null);
    if (step > 1) setStep(step - 1);
  }, [step]);

  const showMentorGender = language.code === 'he' || language.code === 'ar';

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quick Start</Text>
          <Text style={styles.headerSub}>{step === 1 ? 'Welcome to Healthings' : progressLabel}</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
          {step === 1 && (
            <>
              <Text style={styles.lead}>
                Your data stays on your phone. This is a wellness coach — not medical advice.
              </Text>
              <UnitsPreferenceSection prefs={unitsPrefs} onChange={onUnitsChange} />
              <Text style={styles.fieldLabel}>Gender</Text>
              <View style={styles.chipRow}>
                {(['male', 'female', 'other'] as Gender[]).map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.chip, gender === g && styles.chipOn]}
                    onPress={() => setGenderPick(g)}
                  >
                    <Text style={[styles.chipText, gender === g && styles.chipTextOn]}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.fieldLabel}>
                Height ({unitsPrefs.height === 'ftin' ? "ft'in\"" : 'cm'})
              </Text>
              <TextInput
                style={styles.input}
                value={heightInput}
                onChangeText={setHeightInput}
                keyboardType={unitsPrefs.height === 'ftin' ? 'default' : 'number-pad'}
                placeholder={unitsPrefs.height === 'ftin' ? "e.g. 5'9\"" : 'e.g. 175'}
                placeholderTextColor={WellnessColors.textSecondary}
              />
              <Text style={styles.fieldLabel}>Birth date</Text>
              <Pressable style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateBtnText}>
                  {birthdate.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
              </Pressable>
              {showDatePicker && (
                <DateTimePicker
                  value={birthdate}
                  mode="date"
                  display="default"
                  maximumDate={new Date()}
                  minimumDate={new Date(1920, 0, 1)}
                  onChange={(_e, d) => {
                    setShowDatePicker(false);
                    if (d) setBirthdatePick(d);
                  }}
                />
              )}
              {age >= 13 && <Text style={styles.hint}>Age: {age} years</Text>}
              <Text style={styles.fieldLabel}>Language</Text>
              <View style={styles.langWrap}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang.code}
                    style={[styles.langChip, language.code === lang.code && styles.chipOn]}
                    onPress={() => setLangPick(lang)}
                  >
                    <Text style={[styles.chipText, language.code === lang.code && styles.chipTextOn]}>
                      {lang.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
              {showMentorGender && (
                <>
                  <Text style={styles.fieldLabel}>Mentor voice gender</Text>
                  <View style={styles.chipRow}>
                    {(['male', 'female'] as Gender[]).map((g) => (
                      <Pressable
                        key={g}
                        style={[styles.chip, mentorGender === g && styles.chipOn]}
                        onPress={() => setMentorGenderPick(g)}
                      >
                        <Text style={[styles.chipText, mentorGender === g && styles.chipTextOn]}>
                          {g.charAt(0).toUpperCase() + g.slice(1)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <Text style={styles.lead}>Tell us what devices you use — we’ll pick the right data sources.</Text>
              <SetupToggleRow label="Withings body scale?" value={hasScale} onChange={setHasScale} />
              <SetupToggleRow label="Withings watch or activity band?" value={hasWatch} onChange={setHasWatch} />
              <SetupToggleRow label="Track glucose (CGM)?" value={tracksCgm} onChange={setTracksCgm} />
            </>
          )}

          {step === 3 && (
            <>
              <Text style={styles.lead}>We need a starting weight for targets and energy balance.</Text>
              {hasScale ? (
                <>
                  <Pressable
                    style={[styles.optionCard, !linkWithingsLater && styles.optionCardOn]}
                    onPress={() => setLinkWithingsLater(false)}
                  >
                    <Text style={styles.optionTitle}>Enter weight now</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.optionCard, linkWithingsLater && styles.optionCardOn]}
                    onPress={() => setLinkWithingsLater(true)}
                  >
                    <Text style={styles.optionTitle}>I’ll link Withings on the dashboard</Text>
                  </Pressable>
                </>
              ) : null}
              {(!hasScale || !linkWithingsLater) && (
                <>
                  <Text style={styles.fieldLabel}>
                    Current weight ({massUnitLabel(unitsPrefs.mass)})
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder={unitsPrefs.mass === 'lb' ? 'e.g. 173' : 'e.g. 78.5'}
                    placeholderTextColor={WellnessColors.textSecondary}
                  />
                </>
              )}
            </>
          )}

          {step === 4 && (
            <>
              {Platform.OS === 'ios' ? (
                <>
                  <Text style={styles.lead}>Allow Apple Health so we can read the data you chose.</Text>
                  <Text style={styles.hint}>
                    Tap Next — Apple Health may ask once. Withings scale/watch sync from the Withings cloud
                    after you link on the dashboard. When Withings watch is off, steps and heart rate come
                    from Apple Health (any watch or phone that writes there).
                  </Text>
                  {tracksCgm ? (
                    <Text style={styles.hint}>
                      CGM: CareSens Air → share with Apple Health → allow Healthings to read Blood Glucose.
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <Text style={styles.lead}>Allow Health Connect so we can read the data you chose.</Text>
                  <Text style={styles.hint}>
                    Tap Next — Health Connect may open once. When Withings watch is off, steps and heart
                    rate come from Health Connect (any watch or phone that writes there). Brand does not
                    matter.
                  </Text>
                  {tracksCgm ? (
                    <Text style={styles.hint}>Blood glucose — for CGM charts and meal impact.</Text>
                  ) : null}
                </>
              )}
              {!hasWatch ? <PhoneHealthActivityStrip /> : null}
              {permBusy ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
              {permNote ? <Text style={styles.hint}>{permNote}</Text> : null}
            </>
          )}

          {step === 5 && (
            <>
              <Text style={styles.lead}>Optional — import reports you already have.</Text>
              <View style={styles.reportCard}>
                <Text style={styles.optionTitle}>Lab report (PDF)</Text>
                <Text style={styles.hint}>
                  Lipids, kidney markers, and more — for smarter macro targets.
                </Text>
                {labDone ? <Text style={styles.doneBadge}>Imported</Text> : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.btnPrimary}
                    onPress={() => {
                      setLabAutoPick(true);
                      setLabModal(true);
                    }}
                  >
                    <Text style={styles.btnPrimaryText}>Import lab PDF</Text>
                  </Pressable>
                  {!labDone && (
                    <Pressable style={styles.btnGhost} onPress={() => setLabDone(true)}>
                      <Text style={styles.btnGhostText}>Skip for now</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <View style={styles.reportCard}>
                <Text style={styles.optionTitle}>Nutritionist session (PDF)</Text>
                <Text style={styles.hint}>Visit summary — coaches follow your plan text.</Text>
                {nutritionDone ? <Text style={styles.doneBadge}>Imported</Text> : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.btnPrimary}
                    onPress={() => {
                      setNutritionAutoPick(true);
                      setNutritionModal(true);
                    }}
                  >
                    <Text style={styles.btnPrimaryText}>Import session PDF</Text>
                  </Pressable>
                  {!nutritionDone && (
                    <Pressable style={styles.btnGhost} onPress={() => setNutritionDone(true)}>
                      <Text style={styles.btnGhostText}>Skip for now</Text>
                    </Pressable>
                  )}
                </View>
              </View>
              <Text style={styles.hint}>Don’t have these yet? Continue — add them anytime from the dashboard.</Text>
            </>
          )}

          {step === 6 && (
            <>
              <Text style={styles.lead}>AI suggests body and macro targets from your profile.</Text>
              {rulesPreview ? (
                <Text style={styles.rulesPreview} numberOfLines={6}>
                  {rulesPreview}
                </Text>
              ) : null}
              {targetsBusy ? (
                <ActivityIndicator size="large" color={WellnessColors.accentGreen} style={{ marginVertical: 24 }} />
              ) : null}
              {targetsError ? (
                <>
                  <Text style={styles.errorText}>{targetsError}</Text>
                  <Pressable style={styles.btnPrimary} onPress={() => void runTargetAi(false)}>
                    <Text style={styles.btnPrimaryText}>Retry</Text>
                  </Pressable>
                </>
              ) : null}
              {bodyTarget && macroTarget ? (
                <>
                  {usingSavedTargets ? (
                    <Text style={styles.hint}>
                      Using your saved targets — My Rules and prior edits are kept. Tap Regenerate only if you want fresh AI numbers.
                    </Text>
                  ) : null}
                  <View style={styles.targetSummary}>
                    <Text style={styles.optionTitle}>Body target</Text>
                    <Text style={styles.hint}>
                      {formatMass(bodyTarget.targetWeight_kg, unitsPrefs.mass)} ·{' '}
                      {bodyTarget.targetFatPct.toFixed(0)}% fat · {bodyTarget.reasoning}
                    </Text>
                    <Text style={[styles.optionTitle, { marginTop: 12 }]}>Daily macros</Text>
                    <Text style={styles.hint}>
                      {formatEnergy(macroTarget.kcal, unitsPrefs.energy)} · P{macroTarget.protein_g} · C
                      {macroTarget.carb_g} · F{macroTarget.fat_g}
                      {macroTarget.fiber_g != null ? ` · Fi${macroTarget.fiber_g}` : ''}
                    </Text>
                    {macroTarget.rulesContext ? (
                      <Text style={[styles.hint, { marginTop: 8 }]}>
                        Rules applied: {macroTarget.rulesContext}
                      </Text>
                    ) : null}
                  </View>
                  <Pressable
                    style={styles.btnGhost}
                    onPress={() => {
                      setBodyTarget(null);
                      setMacroTarget(null);
                      setUsingSavedTargets(false);
                      void runTargetAi(true);
                    }}
                  >
                    <Text style={styles.btnGhostText}>Regenerate with AI</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          )}

          {step === 7 && (
            <>
              <Text style={styles.lead}>How to log meals</Text>
              <Text style={styles.bullet}>1. Tap + on the metabolic chart to open the food log.</Text>
              <Text style={styles.bullet}>2. Photo — snap your plate; AI lists items; you approve.</Text>
              <Text style={styles.bullet}>3. Text — describe your meal; AI parses macros.</Text>
              <Text style={styles.bullet}>4. Coach chat can suggest what to log — save via the food log.</Text>
              <Pressable
                style={styles.btnPrimary}
                onPress={() => {
                  void finishWizard().then(() => onOpenFoodLog?.());
                }}
              >
                <Text style={styles.btnPrimaryText}>Log my first meal</Text>
              </Pressable>
              <Pressable style={styles.btnGhost} onPress={() => void finishWizard()}>
                <Text style={styles.btnGhostText}>I&apos;ll log later — Finish</Text>
              </Pressable>
            </>
          )}

          {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}
        </ScrollView>

        {step < 7 && (
          <View style={styles.footer}>
            {step > 1 ? (
              <Pressable style={styles.btnGhost} onPress={goBack}>
                <Text style={styles.btnGhostText}>Back</Text>
              </Pressable>
            ) : (
              <View style={styles.footerSpacer} />
            )}
            <Pressable style={styles.btnPrimary} onPress={() => void goNext()}>
              <Text style={styles.btnPrimaryText}>
                {step === 5 ? 'Continue' : step === 4 && permBusy ? '…' : 'Next'}
              </Text>
            </Pressable>
          </View>
        )}

        <LabReportModal
          visible={labModal}
          lang={language}
          autoPickPdf={labAutoPick}
          onClose={() => {
            setLabModal(false);
            setLabAutoPick(false);
          }}
          onSaved={(_r: LabReport) => {
            setLabDone(true);
            setLabModal(false);
            setLabAutoPick(false);
          }}
        />
        <NutritionDirectiveReviewModal
          visible={nutritionModal}
          lang={language}
          autoPickPdf={nutritionAutoPick}
          onClose={() => {
            setNutritionModal(false);
            setNutritionAutoPick(false);
          }}
          onSaved={(_e: NutritionDirective) => {
            setNutritionDone(true);
            setNutritionModal(false);
            setNutritionAutoPick(false);
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: WellnessColors.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: WellnessColors.gridLine,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: WellnessColors.textPrimary },
  headerSub: { fontSize: 14, color: WellnessColors.textSecondary, marginTop: 4 },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 32 },
  lead: { fontSize: 15, lineHeight: 22, color: WellnessColors.textPrimary, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontWeight: '700', color: WellnessColors.textSecondary, marginTop: 12, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: WellnessColors.textPrimary,
    backgroundColor: WellnessColors.surface,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  chipOn: { backgroundColor: '#2E7D5A', borderColor: '#2E7D5A' },
  chipText: { fontSize: 14, fontWeight: '600', color: WellnessColors.textSecondary },
  chipTextOn: { color: '#fff' },
  langWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  langChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 10,
    padding: 12,
    backgroundColor: WellnessColors.surface,
  },
  dateBtnText: { fontSize: 15, color: WellnessColors.textPrimary },
  hint: { fontSize: 13, lineHeight: 19, color: WellnessColors.textSecondary, marginTop: 6 },
  rulesPreview: {
    fontSize: 11,
    lineHeight: 16,
    color: WellnessColors.textSecondary,
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: WellnessColors.progressTrack,
  },
  bullet: { fontSize: 14, lineHeight: 22, color: WellnessColors.textPrimary, marginBottom: 8 },
  optionCard: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: WellnessColors.surface,
  },
  optionCardOn: { borderColor: '#2E7D5A', borderWidth: 2 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: WellnessColors.textPrimary },
  reportCard: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    backgroundColor: WellnessColors.surface,
  },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  doneBadge: { fontSize: 12, fontWeight: '700', color: '#2E7D5A', marginTop: 6 },
  targetSummary: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    padding: 14,
    backgroundColor: WellnessColors.surface,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
  },
  footerSpacer: { flex: 1 },
  btnPrimary: {
    flex: 1,
    backgroundColor: '#2E7D5A',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.textSecondary,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  btnGhostText: { color: WellnessColors.textSecondary, fontWeight: '600', fontSize: 15 },
  errorText: { fontSize: 13, color: '#c0392b', marginTop: 10 },
});
