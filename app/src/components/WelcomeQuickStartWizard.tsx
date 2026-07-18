/**
 * Welcome & Quick Start — one-question-per-screen onboarding (prompt77).
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Image,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Circle, Ellipse, Path, Rect, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LabReportModal } from './LabReportModal';
import { NutritionDirectiveReviewModal } from './NutritionDirectiveReviewModal';
import { CONFIG } from '../config/env';
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
import { syncMetricsStore } from '../services/MetricsPersistenceService';
import type { NutritionDirective } from '../services/NutritionDirectiveService';
import { setOnboardingCompletedAt } from '../services/ProfileCompletenessService';
import { syncSamsungStepsIfConfigured } from '../services/SamsungStepsAdapter';
import {
  saveSourceConfig,
  sourceConfigFromDevices,
  type DeviceSurvey,
} from '../services/SourceConfigService';
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
import {
  buildAuthorizationUrl,
  handleOAuthCallback,
  loadWithingsTokens,
} from '../services/WithingsApiService';
import { loadWithingsStore } from '../services/WithingsPersistenceService';
import {
  CircleHelp,
  UtensilsCrossed,
} from 'lucide-react-native';
import { GearHeroCard } from './GearIllustrations';
import { WellnessColors } from '../theme/wellness';
import { PhoneHealthActivityStrip } from './PhoneHealthActivityStrip';
import { UnitsPreferenceSection } from './UnitsPreferenceSection';

const HELP_WELCOME = 'https://healthings.ai/help/quick-start-welcome.html';
const HELP_UNITS = 'https://healthings.ai/help/quick-start-units.html';
const HELP_PROFILE = 'https://healthings.ai/help/quick-start-profile.html';
const HELP_LANGUAGE = 'https://healthings.ai/help/quick-start-language.html';
const HELP_MENTOR_VOICE = 'https://healthings.ai/help/mentor-voice-gender.html';
const HELP_SCALE = 'https://healthings.ai/help/withings-scale.html';
const HELP_WATCH = 'https://healthings.ai/help/quick-start-watch.html';
const HELP_CGM = 'https://healthings.ai/help/cgm.html';
const HELP_LINK = 'https://healthings.ai/help/withings-link.html';
const HELP_WEIGHT = 'https://healthings.ai/help/starting-weight.html';
const HELP_PHONE_HEALTH = 'https://healthings.ai/help/phone-health-activity.html';
const HELP_REPORTS = 'https://healthings.ai/help/reports-import.html';
const HELP_TARGETS = 'https://healthings.ai/help/targets-help.html';
const HELP_MEALS = 'https://healthings.ai/help/meal-logging.html';
const HELP_MANUAL_BODY = 'https://healthings.ai/help/manual-body.html';
const SITE_HOME = 'https://healthings.ai';
const BRAND_LOGO = require('../../assets/brand-logo.png');

type StepId =
  | 'welcome'
  | 'units'
  | 'body'
  | 'language'
  | 'scale'
  | 'watch'
  | 'cgm'
  | 'link_withings'
  | 'weight'
  | 'phone_health'
  | 'pdfs'
  | 'targets'
  | 'meals';

type Props = {
  visible: boolean;
  onComplete: () => void;
  onOpenFoodLog?: () => void;
};

function buildStepList(
  hasScale: boolean | null,
  hasWatch: boolean | null,
  tracksCgm: boolean | null,
): StepId[] {
  const steps: StepId[] = ['welcome', 'units', 'body', 'language', 'scale', 'watch', 'cgm'];
  if (hasScale === true || hasWatch === true) {
    steps.push('link_withings');
  }
  steps.push('weight');
  if (hasWatch === false || tracksCgm === true) {
    steps.push('phone_health');
  }
  steps.push('pdfs', 'targets', 'meals');
  return steps;
}

/** Soft sky blue — Next buttons + help ? links (distinct from brand green). */
const NEXT_BLUE = '#5BAFE8';
const NEXT_BLUE_DEEP = '#3D9DD6';
/** Navy from HEALTHINGS.AI wordmark — brand lockup text. */
const BRAND_NAVY = '#1A2B4A';
/** Familiar PDF file-type red (generic document mark, not Adobe trademark). */
const PDF_RED = '#E5252A';

/**
 * Iconic PDF document glyph — red page + fold + PDF label.
 * Instant recognition; grey FileText is too weak for this step.
 */
function PdfFileIcon({ size = 44 }: { size?: number }) {
  const w = size;
  const h = size * 1.15;
  return (
    <Svg width={w} height={h} viewBox="0 0 40 46" accessibilityLabel="PDF">
      {/* Page */}
      <Path
        d="M6 2 H26 L38 14 V42 C38 43.1 37.1 44 36 44 H6 C4.9 44 4 43.1 4 42 V4 C4 2.9 4.9 2 6 2 Z"
        fill={PDF_RED}
      />
      {/* Folded corner */}
      <Path d="M26 2 V12 C26 13.1 26.9 14 28 14 H38 Z" fill="#B71C1C" />
      <Path d="M26 2 L38 14 H28 C26.9 14 26 13.1 26 12 Z" fill="#FF6B6E" opacity={0.9} />
      {/* PDF wordmark */}
      <SvgText
        x="20"
        y="30"
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="800"
        textAnchor="middle"
        letterSpacing="0.5"
      >
        PDF
      </SvgText>
    </Svg>
  );
}

function WelcomeBrandMark() {
  return (
    <View style={styles.brandHero} accessibilityRole="header">
      <Image
        source={BRAND_LOGO}
        style={styles.brandLogo}
        resizeMode="contain"
        accessibilityLabel="HEALTHINGS.AI"
      />
      <Pressable
        onPress={() => void Linking.openURL(SITE_HOME)}
        accessibilityRole="link"
        accessibilityLabel="Open healthings.ai"
        hitSlop={8}
        style={({ pressed }) => [styles.brandSiteRow, pressed && styles.helpPressed]}
      >
        <Text style={styles.brandSite}>healthings.ai</Text>
      </Pressable>
      <Text style={styles.brandTag}>Personalized metabolic OS with your licensed nutritionist</Text>
    </View>
  );
}

function HelpButton({
  href,
  label,
  compact = false,
}: {
  href: string;
  label?: string;
  /** Icon-only (for field labels / title row). */
  compact?: boolean;
}) {
  return (
    <Pressable
      onPress={() => void Linking.openURL(href)}
      hitSlop={compact ? 10 : 6}
      accessibilityRole="link"
      accessibilityLabel={label ? `Help: ${label}` : 'Open help for this step'}
      style={({ pressed }) => [
        compact ? styles.helpIconBtn : styles.helpChip,
        pressed && styles.helpPressed,
      ]}
    >
      <CircleHelp size={compact ? 22 : 18} color={NEXT_BLUE_DEEP} strokeWidth={2.25} />
      {!compact && label ? <Text style={styles.helpChipText}>{label}</Text> : null}
      {!compact && !label ? <Text style={styles.helpChipText}>Help</Text> : null}
    </Pressable>
  );
}

/** Step headline + ? — primary place users look for explanations. */
function StepHeading({
  title,
  helpHref,
  helpLabel,
}: {
  title: string;
  helpHref: string;
  helpLabel?: string;
}) {
  return (
    <View style={styles.stepHeading}>
      <Text style={styles.question}>{title}</Text>
      <HelpButton href={helpHref} label={helpLabel} compact />
    </View>
  );
}

function QuestionYesNo({
  value,
  onChange,
  highlight = false,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  /** Pulse when Next was tapped without a choice. */
  highlight?: boolean;
}) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!highlight) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 700,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: false,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [highlight, pulse]);

  const coachBorder = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [WellnessColors.gridLine, NEXT_BLUE_DEEP],
  });

  const selected = { backgroundColor: BRAND_NAVY, borderColor: BRAND_NAVY };

  return (
    <View style={styles.yesNoBlock}>
      <View style={styles.yesNoRow}>
        <Animated.View
          style={[
            styles.yesNoBtnOuter,
            highlight && { borderColor: coachBorder, borderWidth: 2 },
          ]}
        >
          <Pressable
            style={[styles.yesNoBtn, value === true && selected]}
            onPress={() => onChange(true)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === true }}
            accessibilityLabel="Yes"
          >
            <Text style={[styles.yesNoText, value === true && styles.yesNoTextOn]}>Yes</Text>
          </Pressable>
        </Animated.View>
        <Animated.View
          style={[
            styles.yesNoBtnOuter,
            highlight && { borderColor: coachBorder, borderWidth: 2 },
          ]}
        >
          <Pressable
            style={[styles.yesNoBtn, value === false && selected]}
            onPress={() => onChange(false)}
            accessibilityRole="button"
            accessibilityState={{ selected: value === false }}
            accessibilityLabel="No"
          >
            <Text style={[styles.yesNoText, value === false && styles.yesNoTextOn]}>No</Text>
          </Pressable>
        </Animated.View>
      </View>
      {highlight ? <FingerTapCoach /> : null}
    </View>
  );
}

/** Animated pointing hand that taps Yes, then No — coaches an unanswered choice. */
function FingerTapCoach() {
  const x = useRef(new Animated.Value(0)).current;
  const tap = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(x, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(tap, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(tap, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(320),
        Animated.timing(x, {
          toValue: 1,
          duration: 420,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(tap, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.timing(tap, { toValue: 0, duration: 220, useNativeDriver: true }),
        Animated.delay(480),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [x, tap]);

  const translateX = x.interpolate({
    inputRange: [0, 1],
    outputRange: [-52, 52],
  });
  const scale = tap.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0.86],
  });
  const tipY = tap.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 10],
  });

  return (
    <View style={styles.fingerCoach} pointerEvents="none" accessibilityElementsHidden>
      <Text style={styles.fingerCoachLabel}>Tap Yes or No</Text>
      <Animated.View style={{ transform: [{ translateX }, { translateY: tipY }, { scale }] }}>
        <Svg width={44} height={52} viewBox="0 0 44 52">
          {/* Soft shadow */}
          <Ellipse cx="22" cy="48" rx="12" ry="3" fill="rgba(26,43,60,0.18)" />
          {/* Hand — index finger pointing down */}
          <Path
            d="M18 6c0-2.2 1.8-4 4-4s4 1.8 4 4v16.5c0 .8.7 1.5 1.5 1.5h.2c1.5 0 2.8 1.2 2.8 2.8V38c0 4.4-3.6 8-8 8h-1.5c-3.6 0-6.5-2.4-7.4-5.7L11 28.5c-.6-1.8.3-3.7 2-4.4.4-.2.8-.3 1.2-.3H18V6z"
            fill="#F5D0B0"
            stroke="#C9956C"
            strokeWidth="1"
          />
          <Path
            d="M18 22.5h6.5V6c0-1.4-1.1-2.5-2.5-2.5h-1.5C19.1 3.5 18 4.6 18 6v16.5z"
            fill="#F8DEC4"
          />
          {/* Knuckle crease */}
          <Path d="M20 10h4" stroke="#C9956C" strokeWidth="0.8" strokeLinecap="round" opacity={0.5} />
          {/* Tap ripple */}
          <Circle cx="22" cy="4" r="3" fill={NEXT_BLUE} opacity={0.35} />
        </Svg>
      </Animated.View>
    </View>
  );
}

function FieldLabelWithHelp({ label, href }: { label: string; href: string }) {
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={[styles.fieldLabel, styles.fieldLabelFlush]}>{label}</Text>
      <HelpButton href={href} compact />
    </View>
  );
}

export function WelcomeQuickStartWizard({ visible, onComplete, onOpenFoodLog }: Props) {
  const [stepId, setStepId] = useState<StepId>('welcome');
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
  const [withingsLinked, setWithingsLinked] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

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
  const [yesNoCoach, setYesNoCoach] = useState(false);
  const [nextBusy, setNextBusy] = useState(false);
  const [nextSpinner, setNextSpinner] = useState(false);
  const [finishBusy, setFinishBusy] = useState(false);
  const [finishSpinner, setFinishSpinner] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const yesNoAnchorY = useRef(0);

  const stepList = useMemo(
    () => buildStepList(hasScale, hasWatch, tracksCgm),
    [hasScale, hasWatch, tracksCgm],
  );

  const stepIndex = Math.max(0, stepList.indexOf(stepId));
  const totalSteps = stepList.length;
  const progressLabel = `Quick Start · ${stepIndex + 1} of ${totalSteps}`;

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      const [lang, gd, ht, bd, mgd, prefs, tokens] = await Promise.all([
        getLanguage(),
        getGender(),
        getCachedHeightCm(),
        getBirthdate(),
        getMentorGender(),
        getUnitsPrefs(),
        loadWithingsTokens(),
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
      setWithingsLinked(Boolean(tokens?.refreshToken));
      setHasScale(null);
      setHasWatch(null);
      setTracksCgm(null);
      setLinkWithingsLater(false);
      setLinkError(null);
      setStepId('welcome');
      setStepError(null);
      setBodyTarget(null);
      setMacroTarget(null);
      setTargetsError(null);
      setLabDone(false);
      setNutritionDone(false);
      setUsingSavedTargets(false);
      setRulesPreview(null);
      setPermNote(null);
    })();
  }, [visible]);

  useEffect(() => {
    if (!stepList.includes(stepId)) {
      setStepId(stepList[Math.min(stepIndex, stepList.length - 1)] ?? 'welcome');
    }
  }, [stepList, stepId, stepIndex]);

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

  const validateBody = useCallback((): boolean => {
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

  const validateWeight = useCallback((): boolean => {
    if (hasScale && (linkWithingsLater || withingsLinked)) {
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
  }, [hasScale, linkWithingsLater, withingsLinked, weightInput, unitsPrefs.mass]);

  const saveProfileBasics = useCallback(async () => {
    const iso = birthdate.toISOString().split('T')[0];
    const cm = parseHeightInputToCm(heightInput, unitsPrefs.height);
    if (cm == null) return;
    await Promise.all([
      setBirthdate(iso),
      setGender(gender),
      setHeightCm(cm),
      saveUnitsPrefs(unitsPrefs),
    ]);
  }, [birthdate, heightInput, gender, unitsPrefs]);

  const saveLanguage = useCallback(async () => {
    const prev = await getLanguage();
    await Promise.all([setLanguage(language), setMentorGender(mentorGender)]);
    if (prev.code !== language.code) {
      await resetQuickQuestionsForLanguage(language);
    }
  }, [language, mentorGender]);

  const buildManualBody = useCallback(async (): Promise<ManualBodySnapshot | null> => {
    if (hasScale && (linkWithingsLater || (withingsLinked && !weightInput.trim()))) return null;
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
  }, [
    hasScale,
    linkWithingsLater,
    withingsLinked,
    weightInput,
    heightInput,
    gender,
    age,
    unitsPrefs,
  ]);

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

  const handleLinkWithings = useCallback(async () => {
    setLinkError(null);
    setLinkBusy(true);
    try {
      const state = `st-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const authUrl = buildAuthorizationUrl(state);
      const result = await WebBrowser.openAuthSessionAsync(authUrl, CONFIG.withingsCallbackUrl, {
        preferEphemeralSession: false,
        showInRecents: false,
        createTask: false,
      });
      if (result.type === 'success' && result.url) {
        await handleOAuthCallback(result.url);
        const tokens = await loadWithingsTokens();
        setWithingsLinked(Boolean(tokens?.refreshToken));
        setLinkWithingsLater(false);
        await syncMetricsStore({ deep: true });
        const { bodyScan } = await loadWithingsStore();
        if (bodyScan?.weightKg != null && bodyScan.weightKg > 0) {
          setWeightInput(String(Number(kgToDisplay(bodyScan.weightKg, unitsPrefs.mass).toFixed(1))));
        }
      }
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Withings link failed.');
    } finally {
      setLinkBusy(false);
    }
  }, [unitsPrefs.mass]);

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
          bodyScan.muscleMassKg ?? bodyScan.weightKg - (bodyScan.weightKg * fatPct) / 100,
        bmr_kcal:
          bodyScan.bmrKcalDay ??
          estimateBodyFromProfile({
            gender,
            weightKg: bodyScan.weightKg,
            heightCm: cm,
            ageYears: age,
          }).bmr_kcal,
        measuredAt: bodyScan.measuredAt ?? new Date().toISOString(),
        source: 'user-entered',
      };
    }
    if (hasScale && (linkWithingsLater || withingsLinked)) {
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
  }, [
    manualBody,
    buildManualBody,
    heightInput,
    age,
    gender,
    hasScale,
    linkWithingsLater,
    withingsLinked,
    unitsPrefs.height,
  ]);

  const runTargetAi = useCallback(
    async (forceRegenerate = false) => {
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
    },
    [resolveBodyForTargets, heightInput, age, gender, language, unitsPrefs.height],
  );

  useEffect(() => {
    if (visible && stepId === 'targets' && !bodyTarget && !targetsBusy && !targetsError) {
      void runTargetAi(false);
    }
  }, [visible, stepId, bodyTarget, targetsBusy, targetsError, runTargetAi]);

  const finishWizard = useCallback(async () => {
    if (!deviceSurvey) return;
    // Scale + linked → Withings body. Scale + “link later” → Withings path (empty until link).
    // Scale + enter weight now (not linked) → manual. No scale → manual.
    const usesManual = !hasScale || (!withingsLinked && !linkWithingsLater);
    await saveSourceConfig(sourceConfigFromDevices(deviceSurvey, usesManual));
    const rawW = parseLocaleNumber(weightInput);
    const w = rawW != null ? displayToKg(rawW, unitsPrefs.mass) : 0;
    const cm = parseHeightInputToCm(heightInput, unitsPrefs.height) ?? 0;
    if (usesManual && w > 0 && cm > 0) {
      if (!deviceSurvey.hasWithingsWatch) {
        await syncMetricsStore();
      }
      await syncSamsungStepsIfConfigured(w, cm, gender);
    } else if (withingsLinked) {
      await syncMetricsStore();
    }
    await setOnboardingCompletedAt();
    onComplete();
  }, [
    deviceSurvey,
    hasScale,
    linkWithingsLater,
    withingsLinked,
    weightInput,
    heightInput,
    gender,
    onComplete,
    unitsPrefs.mass,
    unitsPrefs.height,
  ]);

  const goToAdjacent = useCallback(
    (delta: 1 | -1) => {
      const idx = stepList.indexOf(stepId);
      const next = stepList[idx + delta];
      if (next) {
        setYesNoCoach(false);
        setStepError(null);
        setStepId(next);
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: 0, animated: false });
        });
      }
    },
    [stepList, stepId],
  );

  const nudgeYesNoChoice = useCallback(() => {
    setStepError(null);
    setYesNoCoach(true);
  }, []);

  useEffect(() => {
    if (!yesNoCoach) return;
    const t = setTimeout(() => {
      const y = Math.max(0, yesNoAnchorY.current - 12);
      scrollRef.current?.scrollTo({ y, animated: true });
    }, 40);
    return () => clearTimeout(t);
  }, [yesNoCoach, stepId]);

  const pickScale = useCallback((v: boolean) => {
    setHasScale(v);
    setYesNoCoach(false);
    setStepError(null);
  }, []);
  const pickWatch = useCallback((v: boolean) => {
    setHasWatch(v);
    setYesNoCoach(false);
    setStepError(null);
  }, []);
  const pickCgm = useCallback((v: boolean) => {
    setTracksCgm(v);
    setYesNoCoach(false);
    setStepError(null);
  }, []);

  const goNext = useCallback(async () => {
    setStepError(null);
    if (stepId === 'welcome') {
      goToAdjacent(1);
      return;
    }
    if (stepId === 'units') {
      await saveUnitsPrefs(unitsPrefs);
      goToAdjacent(1);
      return;
    }
    if (stepId === 'body') {
      if (!validateBody()) return;
      await saveProfileBasics();
      goToAdjacent(1);
      return;
    }
    if (stepId === 'language') {
      await saveLanguage();
      goToAdjacent(1);
      return;
    }
    if (stepId === 'scale') {
      if (hasScale == null) {
        nudgeYesNoChoice();
        return;
      }
      goToAdjacent(1);
      return;
    }
    if (stepId === 'watch') {
      if (hasWatch == null) {
        nudgeYesNoChoice();
        return;
      }
      goToAdjacent(1);
      return;
    }
    if (stepId === 'cgm') {
      if (tracksCgm == null) {
        nudgeYesNoChoice();
        return;
      }
      goToAdjacent(1);
      return;
    }
    if (stepId === 'link_withings') {
      goToAdjacent(1);
      return;
    }
    if (stepId === 'weight') {
      if (!validateWeight()) return;
      if (!hasScale || (!linkWithingsLater && !(withingsLinked && !weightInput.trim()))) {
        const body = await buildManualBody();
        if (body) setManualBody(body);
      }
      goToAdjacent(1);
      return;
    }
    if (stepId === 'phone_health') {
      await runPermissions();
      goToAdjacent(1);
      return;
    }
    if (stepId === 'pdfs') {
      goToAdjacent(1);
      return;
    }
    if (stepId === 'targets') {
      if (!bodyTarget || !macroTarget) {
        setStepError('Wait for targets or tap Retry.');
        return;
      }
      await saveBodyTarget(bodyTarget);
      await confirmSavedMacroTarget(macroTarget, 'onboarding');
      goToAdjacent(1);
    }
  }, [
    stepId,
    unitsPrefs,
    validateBody,
    saveProfileBasics,
    saveLanguage,
    hasScale,
    hasWatch,
    tracksCgm,
    validateWeight,
    linkWithingsLater,
    withingsLinked,
    weightInput,
    buildManualBody,
    runPermissions,
    bodyTarget,
    macroTarget,
    goToAdjacent,
    nudgeYesNoChoice,
  ]);

  const goBack = useCallback(() => {
    setStepError(null);
    setNextBusy(false);
    setNextSpinner(false);
    goToAdjacent(-1);
  }, [goToAdjacent]);

  /** Immediate press look + delayed spinner when Next work lags. */
  const pressNext = useCallback(async () => {
    if (nextBusy || linkBusy || (stepId === 'phone_health' && permBusy)) return;
    setNextBusy(true);
    const spinTimer = setTimeout(() => setNextSpinner(true), 140);
    try {
      await goNext();
    } finally {
      clearTimeout(spinTimer);
      setNextSpinner(false);
      setNextBusy(false);
    }
  }, [nextBusy, linkBusy, stepId, permBusy, goNext]);

  const pressFinish = useCallback(
    async (openFoodLog: boolean) => {
      if (finishBusy) return;
      setFinishBusy(true);
      const spinTimer = setTimeout(() => setFinishSpinner(true), 140);
      try {
        await finishWizard();
        if (openFoodLog) onOpenFoodLog?.();
      } finally {
        clearTimeout(spinTimer);
        setFinishSpinner(false);
        setFinishBusy(false);
      }
    },
    [finishBusy, finishWizard, onOpenFoodLog],
  );

  const showMentorGender = language.code === 'he' || language.code === 'ar';
  const headerSub = stepId === 'welcome' ? 'Welcome to Healthings' : progressLabel;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Quick Start</Text>
          <Text style={styles.headerSub}>{headerSub}</Text>
          <View style={styles.dots}>
            {stepList.map((id, i) => (
              <View key={id} style={[styles.dot, i <= stepIndex && styles.dotOn]} />
            ))}
          </View>
        </View>

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {stepId === 'welcome' && (
            <>
              <WelcomeBrandMark />
              <StepHeading title="Welcome" helpHref={HELP_WELCOME} helpLabel="How Healthings works" />
              <Text style={styles.lead}>
                Healthings is a wellness app with a high-end method: it learns your body, teaches you
                in the moment, and feeds clear feedback to your nutritionist — so the path to your
                targets keeps getting sharper.
              </Text>
              <View style={styles.welcomeCard}>
                <Text style={styles.optionTitle}>Learns your body. Teaches you.</Text>
                <Text style={styles.hint}>
                  Watch live charts as weight, composition, activity, and glucose (when connected)
                  update. The model builds a picture of how your body responds, explains what the
                  numbers mean in plain language, and coaches you under My Rules — so you understand
                  your progress, not just store it.
                </Text>
              </View>
              <View style={styles.welcomeCard}>
                <Text style={styles.optionTitle}>A breakthrough in how care runs</Text>
                <Text style={styles.hint}>
                  Most wellness tools stop at tracking. Healthings closes the loop:{'\n'}
                  {'\n'}
                  • Your nutritionist sets clinical intent in My Rules{'\n'}
                  • You live the plan — meals, body, activity, labs{'\n'}
                  • Healthings executes, learns, and explains as days unfold{'\n'}
                  • Body feedback reaches your nutritionist when you share{'\n'}
                  • Together you refine the plan — the optimized path to your targets{'\n'}
                  {'\n'}
                  Continuous optimization for you and for your professional’s focus — not another
                  disconnected food diary.
                </Text>
              </View>
              <View style={styles.welcomeCard}>
                <Text style={styles.optionTitle}>Wellness category. Professional standard.</Text>
                <Text style={styles.hint}>
                  We sit in wellness on purpose — no diagnosis, no prescribing, no replacing your
                  clinician. The value is the method: licensed guidance, live body insight, and a
                  feedback cycle that feels like premium practice.
                </Text>
              </View>
              <View style={styles.welcomeCard}>
                <Text style={styles.optionTitle}>Not medical care</Text>
                <Text style={styles.hint}>
                  Healthings executes the plan under My Rules. Emergency and medical decisions stay
                  with licensed professionals. Tap ? for privacy and the full story.
                </Text>
              </View>
              <HelpButton href={HELP_WELCOME} label="How it works & privacy" />
            </>
          )}

          {stepId === 'units' && (
            <>
              <StepHeading title="Units & measurements" helpHref={HELP_UNITS} helpLabel="Units" />
              <Text style={styles.lead}>
                How weight, height, and energy appear in the app. You can change this later in My
                Profile.
              </Text>
              <UnitsPreferenceSection prefs={unitsPrefs} onChange={onUnitsChange} />
            </>
          )}

          {stepId === 'body' && (
            <>
              <StepHeading title="About you" helpHref={HELP_PROFILE} helpLabel="Why we ask" />
              <Text style={styles.lead}>Used for BMR, BMI, and energy targets.</Text>
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
                  {birthdate.toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
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
            </>
          )}

          {stepId === 'language' && (
            <>
              <StepHeading
                title="Coach & meals language"
                helpHref={HELP_LANGUAGE}
                helpLabel="Language help"
              />
              <Text style={styles.lead}>
                Chat, meal names, and exported reports use this language. App menus stay in English.
              </Text>
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
                <View style={styles.mentorBlock}>
                  <FieldLabelWithHelp label="Mentor voice gender" href={HELP_MENTOR_VOICE} />
                  <Text style={styles.hint}>
                    How the coach addresses you in Hebrew or Arabic — not your profile gender.
                  </Text>
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
                </View>
              )}
            </>
          )}

          {stepId === 'scale' && (
            <>
              <GearHeroCard kind="scale" />
              <StepHeading
                title="Do you have a Withings body scale?"
                helpHref={HELP_SCALE}
                helpLabel="Scale help"
              />
              <Text style={styles.lead}>
                Any Withings scale on your Withings account works — Body, Body Scan, and similar.
                Healthings reads the cloud after you link (not Bluetooth).
              </Text>
              <View
                onLayout={(e) => {
                  yesNoAnchorY.current = e.nativeEvent.layout.y;
                }}
              >
                <QuestionYesNo value={hasScale} onChange={pickScale} highlight={yesNoCoach} />
              </View>
            </>
          )}

          {stepId === 'watch' && (
            <>
              <GearHeroCard kind="watch" />
              <StepHeading
                title="Do you have a Withings watch or activity band?"
                helpHref={HELP_WATCH}
                helpLabel="Watch help"
              />
              <Text style={styles.lead}>
                Yes → activity and heart rate from Withings cloud. No → from Health Connect / Apple
                Health (Garmin, Apple Watch, Samsung, etc.).
              </Text>
              <View
                onLayout={(e) => {
                  yesNoAnchorY.current = e.nativeEvent.layout.y;
                }}
              >
                <QuestionYesNo value={hasWatch} onChange={pickWatch} highlight={yesNoCoach} />
              </View>
            </>
          )}

          {stepId === 'cgm' && (
            <>
              <GearHeroCard kind="cgm" />
              <StepHeading
                title="Do you track glucose with a CGM?"
                helpHref={HELP_CGM}
                helpLabel="CGM help"
              />
              <Text style={styles.lead}>
                Continuous glucose via Health Connect (Android) or Apple Health (iPhone). You can
                also import lab PDFs later.
              </Text>
              <View
                onLayout={(e) => {
                  yesNoAnchorY.current = e.nativeEvent.layout.y;
                }}
              >
                <QuestionYesNo value={tracksCgm} onChange={pickCgm} highlight={yesNoCoach} />
              </View>
            </>
          )}

          {stepId === 'link_withings' && (
            <>
              <GearHeroCard kind="link" />
              <StepHeading
                title="Link your Withings account"
                helpHref={HELP_LINK}
                helpLabel="Linking help"
              />
              <Text style={styles.lead}>
                Sign in with the same account used in the Withings app. One link covers scale and
                watch data.
              </Text>
              {withingsLinked ? (
                <View style={styles.successCard}>
                  <Text style={styles.successText}>Withings connected</Text>
                  <Text style={styles.hint}>You can re-link anytime in My Profile.</Text>
                </View>
              ) : (
                <>
                  <Pressable
                    style={[styles.btnPrimary, styles.btnFull, linkBusy && styles.btnDisabled]}
                    disabled={linkBusy}
                    onPress={() => void handleLinkWithings()}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {linkBusy ? 'Opening Withings…' : 'Link Withings'}
                    </Text>
                  </Pressable>
                  {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}
                  <Text style={styles.hint}>
                    Or tap Next to skip — link later in My Profile. Targets may use a temporary
                    weight estimate until you link.
                  </Text>
                </>
              )}
            </>
          )}

          {stepId === 'weight' && (
            <>
              <StepHeading title="Starting weight" helpHref={HELP_WEIGHT} helpLabel="Weight help" />
              <Text style={styles.lead}>Needed for targets and energy balance.</Text>
              {hasScale && withingsLinked ? (
                <Text style={styles.hint}>
                  Linked — enter a weight if the scale has not synced yet, or tap Next to use cloud
                  data when available.
                </Text>
              ) : null}
              {hasScale && !withingsLinked ? (
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
                    <Text style={styles.optionTitle}>Skip — I&apos;ll get weight from Withings later</Text>
                  </Pressable>
                </>
              ) : null}
              {(!hasScale || !linkWithingsLater || withingsLinked) && (
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
                  {!hasScale ? (
                    <HelpButton href={HELP_MANUAL_BODY} label="Manual body guide" />
                  ) : null}
                </>
              )}
            </>
          )}

          {stepId === 'phone_health' && (
            <>
              <GearHeroCard kind="phone" />
              {Platform.OS === 'ios' ? (
                <>
                  <StepHeading
                    title="Allow Apple Health"
                    helpHref={HELP_PHONE_HEALTH}
                    helpLabel="Phone health"
                  />
                  <Text style={styles.lead}>
                    Tap Next — Apple Health may ask once. Use Allow access below for steps and heart
                    rate when your Withings watch is off.
                  </Text>
                  {tracksCgm ? (
                    <Text style={styles.hint}>
                      CGM: CareSens Air → share with Apple Health → allow Blood Glucose.
                    </Text>
                  ) : null}
                </>
              ) : (
                <>
                  <StepHeading
                    title="Allow Health Connect"
                    helpHref={HELP_PHONE_HEALTH}
                    helpLabel="Phone health"
                  />
                  <Text style={styles.lead}>
                    Tap Next — Health Connect may open once. When Withings watch is off, steps and
                    heart rate come from any brand that writes to Health Connect.
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

          {stepId === 'pdfs' && (
            <>
              <StepHeading
                title="Optional reports"
                helpHref={HELP_REPORTS}
                helpLabel="PDF reports"
              />
              <Text style={styles.lead}>
                Import PDFs you already have — or tap Continue to do this later in the app.
              </Text>
              <View style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <View style={styles.pdfIconWrap}>
                    <PdfFileIcon size={46} />
                  </View>
                  <View style={styles.reportCardCopy}>
                    <Text style={styles.optionTitle}>Lab report</Text>
                    <Text style={styles.hint}>
                      Lipids, kidney markers, and more — for smarter macro targets.
                    </Text>
                  </View>
                </View>
                {labDone ? <Text style={styles.doneBadgeNavy}>Imported</Text> : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.btnNavy}
                    onPress={() => {
                      setLabAutoPick(true);
                      setLabModal(true);
                    }}
                  >
                    <PdfFileIcon size={18} />
                    <Text style={styles.btnNavyText}>Import lab PDF</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <View style={styles.pdfIconWrap}>
                    <PdfFileIcon size={46} />
                  </View>
                  <View style={styles.reportCardCopy}>
                    <Text style={styles.optionTitle}>Nutritionist session</Text>
                    <Text style={styles.hint}>Visit summary — coaches follow your plan text.</Text>
                  </View>
                </View>
                {nutritionDone ? <Text style={styles.doneBadgeNavy}>Imported</Text> : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.btnNavy}
                    onPress={() => {
                      setNutritionAutoPick(true);
                      setNutritionModal(true);
                    }}
                  >
                    <PdfFileIcon size={18} />
                    <Text style={styles.btnNavyText}>Import session PDF</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {stepId === 'targets' && (
            <>
              <StepHeading title="Your targets" helpHref={HELP_TARGETS} helpLabel="Targets help" />
              <Text style={styles.lead}>AI suggests body and macro targets from your profile.</Text>
              {rulesPreview ? (
                <Text style={styles.rulesPreview} numberOfLines={6}>
                  {rulesPreview}
                </Text>
              ) : null}
              {targetsBusy ? (
                <ActivityIndicator
                  size="large"
                  color={WellnessColors.accentGreen}
                  style={{ marginVertical: 24 }}
                />
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
                      Using your saved targets — My Rules and prior edits are kept. Tap Regenerate
                      only if you want fresh AI numbers.
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
                      {formatEnergy(macroTarget.kcal, unitsPrefs.energy)} · P{macroTarget.protein_g} ·
                      C{macroTarget.carb_g} · F{macroTarget.fat_g}
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

          {stepId === 'meals' && (
            <>
              <GearHeroCard kind="meals" />
              <StepHeading title="How to log meals" helpHref={HELP_MEALS} helpLabel="Meal logging" />
              <Text style={styles.lead}>
                Log what you eat so Healthings can coach under My Rules and show live impact on your
                charts.
              </Text>
              <Text style={styles.bullet}>1. Tap + on the metabolic chart to open the food log.</Text>
              <Text style={styles.bullet}>2. Photo — snap your plate; AI lists items; you approve.</Text>
              <Text style={styles.bullet}>3. Text — describe your meal; AI parses macros.</Text>
              <Text style={styles.bullet}>4. Coach chat can suggest what to log — save via the food log.</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.btnNavy,
                  styles.btnNavyFull,
                  { marginTop: 16 },
                  pressed && !finishBusy && styles.btnNavyPressed,
                  finishBusy && styles.btnDisabled,
                ]}
                disabled={finishBusy}
                onPress={() => void pressFinish(true)}
                accessibilityState={{ busy: finishBusy }}
              >
                {finishSpinner ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <UtensilsCrossed size={18} color="#fff" strokeWidth={2.25} />
                )}
                <Text style={styles.btnNavyText}>
                  {finishSpinner ? 'Working…' : 'Log my first meal'}
                </Text>
              </Pressable>
            </>
          )}

          {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}
        </ScrollView>

        <View style={styles.footer}>
          {stepIndex > 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && !(nextBusy || finishBusy) && styles.btnGhostPressed,
              ]}
              onPress={goBack}
              disabled={nextBusy || finishBusy}
            >
              <Text style={styles.btnGhostText}>Back</Text>
            </Pressable>
          ) : (
            <View style={styles.footerSpacer} />
          )}
          {stepId === 'meals' ? (
            <Pressable
              style={({ pressed }) => [
                styles.btnNext,
                pressed && !finishBusy && styles.btnNextPressed,
                finishBusy && styles.btnDisabled,
              ]}
              disabled={finishBusy}
              onPress={() => void pressFinish(false)}
              accessibilityState={{ busy: finishBusy || finishSpinner }}
            >
              {finishSpinner ? (
                <ActivityIndicator color="#fff" size="small" style={styles.btnNextSpinner} />
              ) : null}
              <Text style={styles.btnNextText}>{finishSpinner ? 'Working…' : 'Finish'}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.btnNext,
                pressed && !nextBusy && styles.btnNextPressed,
                (nextBusy || (stepId === 'phone_health' && permBusy) || linkBusy) &&
                  styles.btnDisabled,
              ]}
              disabled={nextBusy || (stepId === 'phone_health' && permBusy) || linkBusy}
              onPress={() => void pressNext()}
              accessibilityState={{ busy: nextBusy || nextSpinner }}
            >
              {nextSpinner || (stepId === 'phone_health' && permBusy) ? (
                <ActivityIndicator color="#fff" size="small" style={styles.btnNextSpinner} />
              ) : null}
              <Text style={styles.btnNextText}>
                {stepId === 'pdfs'
                  ? 'Continue'
                  : nextSpinner || (stepId === 'phone_health' && permBusy)
                    ? 'Working…'
                    : 'Next'}
              </Text>
            </Pressable>
          )}
        </View>

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
  brandHero: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: WellnessColors.gridLine,
  },
  brandLogo: {
    width: '100%',
    maxWidth: 320,
    height: 100,
  },
  brandSiteRow: {
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 10,
  },
  brandSite: {
    fontSize: 16,
    fontWeight: '700',
    color: NEXT_BLUE_DEEP,
    letterSpacing: 0.3,
  },
  brandTag: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: BRAND_NAVY,
    opacity: 0.72,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: WellnessColors.gridLine,
  },
  dotOn: { backgroundColor: BRAND_NAVY },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  question: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    lineHeight: 28,
    paddingRight: 8,
  },
  stepHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 4,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 4,
    gap: 6,
  },
  mentorBlock: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: WellnessColors.gridLine,
  },
  helpIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(61, 157, 214, 0.12)',
  },
  helpChip: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    marginTop: 14,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(61, 157, 214, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(61, 157, 214, 0.35)',
  },
  helpChipText: {
    fontSize: 14,
    fontWeight: '600',
    color: NEXT_BLUE_DEEP,
  },
  helpPressed: { opacity: 0.7 },
  lead: { fontSize: 15, lineHeight: 22, color: WellnessColors.textPrimary, marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: WellnessColors.textSecondary,
    marginTop: 12,
    marginBottom: 8,
  },
  fieldLabelFlush: {
    marginTop: 0,
    marginBottom: 0,
    flexShrink: 1,
  },
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
  chipOn: { backgroundColor: BRAND_NAVY, borderColor: BRAND_NAVY },
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
  yesNoBlock: { marginTop: 8, marginBottom: 8 },
  yesNoRow: { flexDirection: 'row', gap: 12 },
  yesNoBtnOuter: {
    flex: 1,
    borderRadius: 14,
  },
  yesNoBtn: {
    paddingVertical: 18,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.surface,
  },
  yesNoText: { fontSize: 18, fontWeight: '700', color: WellnessColors.textSecondary },
  yesNoTextOn: { color: '#fff' },
  fingerCoach: {
    alignItems: 'center',
    marginTop: 14,
    minHeight: 78,
  },
  fingerCoachLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: NEXT_BLUE_DEEP,
    marginBottom: 6,
  },
  successCard: {
    borderWidth: 1,
    borderColor: '#2E7D5A',
    borderRadius: 12,
    padding: 14,
    backgroundColor: WellnessColors.surface,
    marginBottom: 8,
  },
  successText: { fontSize: 16, fontWeight: '700', color: '#2E7D5A' },
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
  welcomeCard: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: WellnessColors.surface,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    backgroundColor: WellnessColors.surface,
  },
  reportCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  reportCardCopy: { flex: 1, minWidth: 0 },
  pdfIconWrap: {
    width: 52,
    height: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, alignItems: 'center' },
  doneBadge: { fontSize: 12, fontWeight: '700', color: '#2E7D5A', marginTop: 6 },
  doneBadgeNavy: { fontSize: 12, fontWeight: '700', color: BRAND_NAVY, marginTop: 8 },
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
  btnNavy: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BRAND_NAVY,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    minWidth: 160,
    borderWidth: 2,
    borderColor: BRAND_NAVY,
  },
  btnNavyPressed: {
    backgroundColor: '#0F1A2E',
    borderColor: NEXT_BLUE_DEEP,
    transform: [{ scale: 0.97 }],
  },
  btnNavyFull: {
    alignSelf: 'stretch',
    minWidth: 0,
  },
  btnNavyText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnFull: { flex: 0, alignSelf: 'stretch', marginBottom: 8 },
  btnDisabled: { opacity: 0.6 },
  btnPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnNext: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: NEXT_BLUE,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: NEXT_BLUE_DEEP,
  },
  btnNextPressed: {
    backgroundColor: NEXT_BLUE_DEEP,
    borderColor: BRAND_NAVY,
    transform: [{ scale: 0.97 }],
  },
  btnNextSpinner: { marginRight: 2 },
  btnNextText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnGhost: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: WellnessColors.textSecondary,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: WellnessColors.surface,
  },
  btnGhostPressed: {
    borderColor: BRAND_NAVY,
    backgroundColor: 'rgba(26, 43, 74, 0.06)',
    transform: [{ scale: 0.97 }],
  },
  btnGhostText: { color: WellnessColors.textSecondary, fontWeight: '600', fontSize: 15 },
  errorText: { fontSize: 13, color: '#c0392b', marginTop: 10 },
});
