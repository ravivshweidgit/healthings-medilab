/**
 * Welcome & Quick Start — one-question-per-screen onboarding (prompt77).
 */

import DateTimePicker from '@react-native-community/datetimepicker';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
  useWindowDimensions,
  View,
} from 'react-native';
import Svg, { Path, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IosDateTimePickerSheet } from './IosDateTimePickerSheet';
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
import { fetchCurrentUser, updatePatientNames } from '../services/AuthApiService';
import { loadCachedAuthUser } from '../services/AuthTokenStore';
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
  ensureQuickQuestionsForLanguage,
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
import { helpUrl } from '../i18n/helpUrls';
import { formatLocalizedDate } from '../i18n/dateLocale';
import {
  LANGUAGE_GATE_OPTIONS,
  languageGateOption,
} from '../i18n/languageGate';
import { getAppearanceCopy } from '../i18n/appearanceCopy';
import { getQuickStartCopy, isRtlLang, usesMentorGenderUi } from '../i18n/quickStartCopy';
import {
  CircleHelp,
  Moon,
  Smartphone,
  Sun,
  UtensilsCrossed,
} from 'lucide-react-native';
import { GearHeroCard } from './GearIllustrations';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import type { ThemePref } from '../services/ThemePreferenceService';
import { PhoneHealthActivityStrip } from './PhoneHealthActivityStrip';
import { UnitsPreferenceSection } from './UnitsPreferenceSection';

const SITE_HOME = 'https://healthings.ai';
const BRAND_LOGO = require('../../assets/brand-logo.png');
const BRAND_LOGO_DARK = require('../../assets/brand-logo-dark.png');
/** Match DashboardScreen brand lockup sizing. */
const SCROLL_HORIZONTAL_PADDING = 20;
const BRAND_HEADER_HEIGHT_FALLBACK = 152;

function computeBrandHeaderHeight(windowWidth: number): number {
  const contentW = Math.max(1, windowWidth - SCROLL_HORIZONTAL_PADDING * 2);
  try {
    const r = Image.resolveAssetSource(BRAND_LOGO);
    if (r?.width && r?.height && r.width > 0 && r.height > 0) {
      const raw = (contentW * r.height) / r.width;
      return Math.round(Math.min(220, Math.max(72, raw)));
    }
  } catch {
    /* ignore */
  }
  return BRAND_HEADER_HEIGHT_FALLBACK;
}

type StepId =
  | 'language'
  | 'appearance'
  | 'names'
  | 'welcome'
  | 'units'
  | 'body'
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
  // Theme + name right after language so clinic findability and live theme preview early.
  const steps: StepId[] = [
    'language',
    'appearance',
    'names',
    'welcome',
    'units',
    'body',
    'scale',
    'watch',
    'cgm',
  ];
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

/**
 * Fixed progress denominator. Device answers (scale/watch/cgm) insert optional
 * steps, so the raw list length grows 11→13 mid-flow — a moving goalpost. Using
 * the maximum possible length keeps "Step N of M" and the dot count stable.
 */
const MAX_QUICK_START_STEPS = buildStepList(true, true, true).length;

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

/**
 * Language gate (prompt81) — black “Select language” stack + native names + blue select frame.
 */
function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

/**
 * Appearance step (prompt96 P4b) — System pre-selected; tap Light/Dark for live preview
 * (ThemeProvider applies immediately to the whole wizard shell).
 */
function AppearanceStepHero({
  pref,
  onSelect,
  rtl,
  systemLabel,
  lightLabel,
  darkLabel,
  hint,
}: {
  pref: ThemePref;
  onSelect: (p: ThemePref) => void;
  rtl: boolean;
  systemLabel: string;
  lightLabel: string;
  darkLabel: string;
  hint: string;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const options: { id: ThemePref; label: string; Icon: typeof Sun }[] = [
    { id: 'system', label: systemLabel, Icon: Smartphone },
    { id: 'light', label: lightLabel, Icon: Sun },
    { id: 'dark', label: darkLabel, Icon: Moon },
  ];
  const iconColor = (on: boolean) =>
    on ? (isDark ? colors.accentBlue : NEXT_BLUE_DEEP) : colors.textSecondary;

  return (
    <View style={styles.appearRoot}>
      <View style={styles.appearOptions}>
        {options.map(({ id, label, Icon }) => {
          const on = pref === id;
          return (
            <Pressable
              key={id}
              onPress={() => onSelect(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={label}
              style={({ pressed }) => [
                styles.appearCard,
                on && styles.appearCardOn,
                pressed && styles.gateCardPressed,
              ]}
            >
              <Icon size={22} color={iconColor(on)} strokeWidth={2.25} />
              <Text
                style={[
                  styles.appearCardLabel,
                  rtl && styles.gateCloudWordRtl,
                  on && styles.appearCardLabelOn,
                ]}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Live mini preview — recolors with the active theme on each tap. */}
      <View style={styles.appearPreview} accessibilityLabel="Theme preview">
        <View style={styles.appearPreviewStrip}>
          <Text style={styles.appearPreviewStripTitle} numberOfLines={1}>
            HEALTHINGS
          </Text>
        </View>
        <View style={styles.appearPreviewCard}>
          <View style={styles.appearPreviewBar} />
          <Text style={styles.appearPreviewPrimary} numberOfLines={1}>
            {lightLabel} · {darkLabel}
          </Text>
          <Text style={styles.appearPreviewSecondary} numberOfLines={2}>
            {hint}
          </Text>
        </View>
      </View>
    </View>
  );
}

function LanguageGateHero({
  selectedCode,
  onSelect,
}: {
  selectedCode: string;
  onSelect: (code: string) => void;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const selected = languageGateOption(selectedCode);
  const selectedRtl = selectedCode === 'he' || selectedCode === 'ar';
  return (
    <View style={styles.gateRoot}>
      {/* One localized "Select language" header that follows the current pick — */}
      {/* the tappable flag + native-name grid below is the single selector. */}
      <Text
        style={[styles.gateHeader, selectedRtl && styles.gateCloudWordRtl]}
        numberOfLines={2}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
        accessibilityRole="header"
      >
        {selected.selectLanguage}
      </Text>

      <View style={styles.gateGrid}>
        {chunkPairs(LANGUAGE_GATE_OPTIONS).map((pair, rowIndex) => (
          <View key={`lang-row-${rowIndex}`} style={styles.gateGridRow}>
            {pair.map((opt) => {
              const on = opt.code === selectedCode;
              const rtlLabel = opt.code === 'he' || opt.code === 'ar';
              return (
                <Pressable
                  key={opt.code}
                  onPress={() => onSelect(opt.code)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`${opt.englishLabel}, ${opt.nativeLabel}`}
                  style={({ pressed }) => [
                    styles.gateGridCell,
                    on && styles.gateGridCellOn,
                    pressed && styles.gateCardPressed,
                  ]}
                >
                  <Text style={styles.gateGridFlag}>{opt.flag}</Text>
                  <Text
                    style={[
                      styles.gateGridNative,
                      rtlLabel && styles.gateFlagNativeRtl,
                      on && styles.gateFlagNativeOn,
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.7}
                  >
                    {opt.nativeLabel}
                  </Text>
                </Pressable>
              );
            })}
            {pair.length === 1 ? <View style={styles.gateGridCell} /> : null}
          </View>
        ))}
      </View>
    </View>
  );
}

function WelcomeBrandMark({ brandTag, compact }: { brandTag: string; compact?: boolean }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { width: windowWidth } = useWindowDimensions();
  const contentW = Math.max(1, windowWidth - SCROLL_HORIZONTAL_PADDING * 2);
  const fullH = useMemo(() => {
    try {
      const r = Image.resolveAssetSource(BRAND_LOGO);
      if (r?.width && r?.height && r.width > 0 && r.height > 0) {
        return (contentW * r.height) / r.width;
      }
    } catch {
      /* ignore */
    }
    return BRAND_HEADER_HEIGHT_FALLBACK;
  }, [contentW]);

  // Crop tagline out of brand-logo.png on the gate (wordmark only).
  const gateCrop = 0.56;
  const logoWrapH = compact
    ? Math.round(Math.min(88, Math.max(60, fullH * gateCrop * 0.9)))
    : Math.round(Math.min(220, Math.max(72, fullH)));
  const logoImgH = compact ? Math.round(logoWrapH / gateCrop) : logoWrapH;

  return (
    <View
      style={[styles.brandHero, compact && styles.brandHeroGate]}
      accessibilityRole="header"
    >
      <View style={[styles.brandLogoWrap, { height: logoWrapH }, compact && styles.brandLogoWrapCrop]}>
        <Image
          source={isDark ? BRAND_LOGO_DARK : BRAND_LOGO}
          style={[styles.brandLogo, { height: compact ? logoImgH : '100%' }]}
          resizeMode="contain"
          accessibilityLabel="HEALTHINGS.AI"
        />
      </View>
      {!compact ? (
        <Pressable
          onPress={() => void Linking.openURL(SITE_HOME)}
          accessibilityRole="link"
          accessibilityLabel="Open healthings.ai"
          hitSlop={8}
          style={({ pressed }) => [styles.brandSiteRow, pressed && styles.helpPressed]}
        >
          <Text style={styles.brandSite}>healthings.ai</Text>
        </Pressable>
      ) : null}
      {!compact && brandTag ? <Text style={styles.brandTag}>{brandTag}</Text> : null}
    </View>
  );
}

function HelpButton({
  href,
  label,
  defaultLabel = 'Help',
  compact = false,
}: {
  href: string;
  label?: string;
  /** Shown when non-compact and `label` omitted. */
  defaultLabel?: string;
  /** Icon-only (for field labels / title row). */
  compact?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const shown = label ?? defaultLabel;
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
      {!compact ? <Text style={styles.helpChipText}>{shown}</Text> : null}
    </Pressable>
  );
}

/** Step headline + ? — primary place users look for explanations. */
function StepHeading({
  title,
  helpHref,
  helpLabel,
  textStyle,
  rtl = false,
}: {
  title: string;
  helpHref: string;
  helpLabel?: string;
  textStyle?: object;
  rtl?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={[styles.stepHeading, rtl && styles.stepHeadingRtl]}>
      <Text style={[styles.question, textStyle]}>{title}</Text>
      <HelpButton href={helpHref} label={helpLabel} compact />
    </View>
  );
}

/**
 * Title with ? glued to a glossary brand (Withings) — in-app tip first, optional help article.
 * Falls back to StepHeading if the brand string is missing from the title.
 */
function BrandStepHeading({
  title,
  brand = 'Withings',
  tipTitle,
  tipBody,
  tipMore,
  tipDismiss,
  helpHref,
  helpLabel,
  textStyle,
  rtl = false,
}: {
  title: string;
  brand?: string;
  tipTitle: string;
  tipBody: string;
  tipMore: string;
  tipDismiss: string;
  helpHref: string;
  helpLabel?: string;
  textStyle?: object;
  rtl?: boolean;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const idx = title.indexOf(brand);

  const openTip = useCallback(() => {
    Alert.alert(tipTitle, tipBody, [
      {
        text: tipMore,
        onPress: () => void Linking.openURL(helpHref),
      },
      { text: tipDismiss, style: 'default' },
    ]);
  }, [tipTitle, tipBody, tipMore, tipDismiss, helpHref]);

  if (idx < 0) {
    return (
      <StepHeading
        title={title}
        helpHref={helpHref}
        helpLabel={helpLabel}
        textStyle={textStyle}
        rtl={rtl}
      />
    );
  }

  const before = title.slice(0, idx);
  const after = title.slice(idx + brand.length);

  return (
    <View style={[styles.stepHeading, rtl && styles.stepHeadingRtl]}>
      <View style={[styles.brandTitleWrap, rtl && styles.brandTitleWrapRtl]}>
        {before ? (
          <Text style={[styles.questionInline, textStyle]}>{before}</Text>
        ) : null}
        <Text style={[styles.questionInline, styles.brandInTitle, textStyle]}>{brand}</Text>
        <Pressable
          onPress={openTip}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={helpLabel ?? tipTitle}
          style={({ pressed }) => [styles.brandHelpBtn, pressed && styles.helpPressed]}
        >
          <CircleHelp size={22} color={NEXT_BLUE_DEEP} strokeWidth={2.25} />
        </Pressable>
        {after ? (
          <Text style={[styles.questionInline, textStyle]}>{after}</Text>
        ) : null}
      </View>
    </View>
  );
}

function QuestionYesNo({
  value,
  onChange,
  highlight = false,
  yesLabel,
  noLabel,
  coachLabel,
}: {
  value: boolean | null;
  onChange: (v: boolean) => void;
  /** Pulse when Next was tapped without a choice. */
  highlight?: boolean;
  yesLabel: string;
  noLabel: string;
  coachLabel: string;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
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
    outputRange: [colors.gridLine, NEXT_BLUE_DEEP],
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
            accessibilityLabel={yesLabel}
          >
            <Text style={[styles.yesNoText, value === true && styles.yesNoTextOn]}>{yesLabel}</Text>
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
            accessibilityLabel={noLabel}
          >
            <Text style={[styles.yesNoText, value === false && styles.yesNoTextOn]}>{noLabel}</Text>
          </Pressable>
        </Animated.View>
      </View>
      {highlight ? <Text style={styles.yesNoCoachHint}>{coachLabel}</Text> : null}
    </View>
  );
}

function FieldLabelWithHelp({
  label,
  href,
  textStyle,
}: {
  label: string;
  href: string;
  textStyle?: object;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.fieldLabelRow}>
      <Text style={[styles.fieldLabel, styles.fieldLabelFlush, textStyle]}>{label}</Text>
      <HelpButton href={href} compact />
    </View>
  );
}

export function WelcomeQuickStartWizard({ visible, onComplete, onOpenFoodLog }: Props) {
  const { colors, isDark, pref: themePref, setThemePref } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const [stepId, setStepId] = useState<StepId>('language');
  const [gender, setGenderPick] = useState<Gender>('male');
  const [mentorGender, setMentorGenderPick] = useState<Gender>('female');
  const [heightInput, setHeightInput] = useState('');
  const [birthdate, setBirthdatePick] = useState(new Date(1980, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [language, setLangPick] = useState<UserLanguage>(SUPPORTED_LANGUAGES[0]);
  const [unitsPrefs, setUnitsPrefs] = useState<UnitsPrefs>({ ...DEFAULT_UNITS_PREFS });
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const appearanceLabels = useMemo(() => getAppearanceCopy(language.code), [language.code]);

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

  const t = useMemo(() => getQuickStartCopy(language.code), [language.code]);
  const rtl = isRtlLang(language.code);
  const copyAlign = useMemo(
    () => ({
      writingDirection: (rtl ? 'rtl' : 'ltr') as 'rtl' | 'ltr',
      textAlign: (rtl ? 'right' : 'left') as 'right' | 'left',
    }),
    [rtl],
  );

  const stepList = useMemo(
    () => buildStepList(hasScale, hasWatch, tracksCgm),
    [hasScale, hasWatch, tracksCgm],
  );

  const stepIndex = Math.max(0, stepList.indexOf(stepId));
  const progressLabel = t.progress(stepIndex + 1, MAX_QUICK_START_STEPS);

  useEffect(() => {
    if (!visible) return;
    void (async () => {
      // Language gate always opens on English (prompt81). Persist only on Next.
      const [gd, ht, bd, mgd, prefs, tokens] = await Promise.all([
        getGender(),
        getCachedHeightCm(),
        getBirthdate(),
        getMentorGender(),
        getUnitsPrefs(),
        loadWithingsTokens(),
      ]);
      setLangPick(SUPPORTED_LANGUAGES[0]);
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
      setStepId('language');
      setStepError(null);
      setBodyTarget(null);
      setMacroTarget(null);
      setTargetsError(null);
      setLabDone(false);
      setNutritionDone(false);
      setUsingSavedTargets(false);
      setRulesPreview(null);
      setPermNote(null);
      const cached = await loadCachedAuthUser();
      setFirstNameInput(cached?.firstName?.trim() || '');
      setLastNameInput(cached?.lastName?.trim() || '');
      void fetchCurrentUser().then((me) => {
        if (!me) return;
        setFirstNameInput(me.firstName?.trim() || '');
        setLastNameInput(me.lastName?.trim() || '');
      });
    })();
  }, [visible]);

  useEffect(() => {
    if (!stepList.includes(stepId)) {
      setStepId(stepList[Math.min(stepIndex, stepList.length - 1)] ?? 'language');
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
    const tasks: Promise<unknown>[] = [setLanguage(language)];
    // Mentor gender only applies to Hebrew/Arabic coach grammar.
    if (usesMentorGenderUi(language.code)) {
      tasks.push(setMentorGender(mentorGender));
    }
    await Promise.all(tasks);
    if (prev.code !== language.code) {
      await ensureQuickQuestionsForLanguage(language);
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

  const validateNames = useCallback((): boolean => {
    if (!firstNameInput.trim() || !lastNameInput.trim()) {
      setStepError(t.names.required);
      return false;
    }
    setStepError(null);
    return true;
  }, [firstNameInput, lastNameInput, t.names.required]);

  const savePatientNames = useCallback(async () => {
    await updatePatientNames(firstNameInput.trim(), lastNameInput.trim());
  }, [firstNameInput, lastNameInput]);

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
    if (stepId === 'appearance') {
      // Pref already persisted on tap via setThemePref (live preview).
      goToAdjacent(1);
      return;
    }
    if (stepId === 'names') {
      if (!validateNames()) return;
      try {
        await savePatientNames();
      } catch (e) {
        setStepError(e instanceof Error ? e.message : t.names.saveFailed);
        return;
      }
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
        setStepError(t.targets.waitOrRetry);
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
    validateNames,
    savePatientNames,
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
    t.targets.waitOrRetry,
    t.names.saveFailed,
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

  const showMentorGender = usesMentorGenderUi(language.code);
  const isLanguageGate = stepId === 'language';
  const headerSub = stepId === 'welcome' ? t.welcomeTo : progressLabel;
  const genderLabel = (g: Gender) =>
    g === 'male' ? t.genderMale : g === 'female' ? t.genderFemale : t.genderOther;
  const langCode = language.code;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen">
      <SafeAreaView style={styles.safe}>
        {!isLanguageGate ? (
          <View style={styles.header}>
            <Text style={[styles.headerTitle, copyAlign]}>{t.quickStart}</Text>
            <Text style={[styles.headerSub, copyAlign]}>{headerSub}</Text>
            <View style={styles.dots}>
              {Array.from({ length: MAX_QUICK_START_STEPS }).map((_, i) => (
                <View key={i} style={[styles.dot, i <= stepIndex && styles.dotOn]} />
              ))}
            </View>
          </View>
        ) : null}

        <ScrollView
          ref={scrollRef}
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            isLanguageGate && styles.languageGateContent,
          ]}
          scrollEnabled={!isLanguageGate}
          keyboardShouldPersistTaps="handled"
        >
          {stepId === 'language' && (
            <View style={styles.languageGateShell}>
              <WelcomeBrandMark brandTag="" compact />
              <LanguageGateHero
                selectedCode={language.code}
                onSelect={(code) => {
                  const lang = SUPPORTED_LANGUAGES.find((l) => l.code === code);
                  if (!lang) return;
                  setLangPick(lang);
                }}
              />
            </View>
          )}

          {stepId === 'appearance' && (
            <>
              <StepHeading
                title={t.appearance.title}
                helpHref={helpUrl(langCode, 'quick-start-welcome')}
                helpLabel={t.appearance.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.appearance.lead}</Text>
              <AppearanceStepHero
                pref={themePref}
                onSelect={setThemePref}
                rtl={rtl}
                systemLabel={appearanceLabels.system}
                lightLabel={appearanceLabels.light}
                darkLabel={appearanceLabels.dark}
                hint={appearanceLabels.hint}
              />
            </>
          )}

          {stepId === 'names' && (
            <>
              <StepHeading
                title={t.names.title}
                helpHref={helpUrl(langCode, 'quick-start-profile')}
                helpLabel={t.names.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.names.lead}</Text>
              <Text style={[styles.fieldLabel, copyAlign]}>{t.names.firstName}</Text>
              <TextInput
                style={styles.input}
                value={firstNameInput}
                onChangeText={setFirstNameInput}
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.fieldLabel, copyAlign]}>{t.names.lastName}</Text>
              <TextInput
                style={styles.input}
                value={lastNameInput}
                onChangeText={setLastNameInput}
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={colors.textSecondary}
              />
            </>
          )}

          {stepId === 'welcome' && (
            <>
              <WelcomeBrandMark brandTag={t.brandTag} />
              <StepHeading
                title={t.welcome.title}
                helpHref={helpUrl(langCode, 'quick-start-welcome')}
                helpLabel={t.welcome.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.welcome.lead}</Text>
              {showMentorGender ? (
                <View style={styles.mentorBlock}>
                  <FieldLabelWithHelp
                    label={t.language.mentorVoice}
                    href={helpUrl(langCode, 'mentor-voice-gender')}
                    textStyle={copyAlign}
                  />
                  <Text style={[styles.hint, copyAlign]}>{t.language.mentorHint}</Text>
                  <View style={styles.chipRow}>
                    {(['male', 'female'] as Gender[]).map((g) => (
                      <Pressable
                        key={g}
                        style={[styles.chip, mentorGender === g && styles.chipOn]}
                        onPress={() => setMentorGenderPick(g)}
                      >
                        <Text style={[styles.chipText, mentorGender === g && styles.chipTextOn]}>
                          {genderLabel(g)}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={styles.welcomeCard}>
                <Text style={[styles.optionTitle, copyAlign]}>{t.welcome.card1Title}</Text>
                <Text style={[styles.hint, copyAlign]}>{t.welcome.card1Body}</Text>
              </View>
              <View style={styles.welcomeCard}>
                <Text style={[styles.optionTitle, copyAlign]}>{t.welcome.card2Title}</Text>
                <Text style={[styles.hint, copyAlign]}>{t.welcome.card2Body}</Text>
              </View>
              <View style={styles.welcomeCard}>
                <Text style={[styles.optionTitle, copyAlign]}>{t.welcome.card3Title}</Text>
                <Text style={[styles.hint, copyAlign]}>{t.welcome.card3Body}</Text>
              </View>
              <View style={styles.welcomeCard}>
                <Text style={[styles.optionTitle, copyAlign]}>{t.welcome.card4Title}</Text>
                <Text style={[styles.hint, copyAlign]}>{t.welcome.card4Body}</Text>
              </View>
              <HelpButton
                href={helpUrl(langCode, 'quick-start-welcome')}
                label={t.welcome.privacyLink}
                defaultLabel={t.help}
              />
            </>
          )}

          {stepId === 'units' && (
            <>
              <StepHeading
                title={t.units.title}
                helpHref={helpUrl(langCode, 'quick-start-units')}
                helpLabel={t.units.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.units.lead}</Text>
              <UnitsPreferenceSection
                prefs={unitsPrefs}
                onChange={onUnitsChange}
                langCode={langCode}
                hideHeader
              />
            </>
          )}

          {stepId === 'body' && (
            <>
              <StepHeading
                title={t.body.title}
                helpHref={helpUrl(langCode, 'quick-start-profile')}
                helpLabel={t.body.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.body.lead}</Text>
              <Text style={[styles.fieldLabel, copyAlign]}>{t.body.gender}</Text>
              <View style={styles.chipRow}>
                {(['male', 'female', 'other'] as Gender[]).map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.chip, gender === g && styles.chipOn]}
                    onPress={() => setGenderPick(g)}
                  >
                    <Text style={[styles.chipText, gender === g && styles.chipTextOn]}>
                      {genderLabel(g)}
                    </Text>
                  </Pressable>
                ))}
              </View>
              <Text style={[styles.fieldLabel, copyAlign]}>
                {t.body.height} ({unitsPrefs.height === 'ftin' ? "ft'in\"" : 'cm'})
              </Text>
              <TextInput
                style={styles.input}
                value={heightInput}
                onChangeText={setHeightInput}
                keyboardType={unitsPrefs.height === 'ftin' ? 'default' : 'number-pad'}
                placeholder={unitsPrefs.height === 'ftin' ? "e.g. 5'9\"" : 'e.g. 175'}
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={[styles.fieldLabel, copyAlign]}>{t.body.birthDate}</Text>
              <Pressable style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
                <Text style={styles.dateBtnText}>
                  {formatLocalizedDate(birthdate, language.code, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
              </Pressable>
              <IosDateTimePickerSheet
                visible={showDatePicker}
                value={birthdate}
                mode="date"
                maximumDate={new Date()}
                minimumDate={new Date(1920, 0, 1)}
                onDone={(d) => {
                  setBirthdatePick(d);
                  setShowDatePicker(false);
                }}
                onCancel={() => setShowDatePicker(false)}
              />
              {showDatePicker && Platform.OS === 'android' ? (
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
              ) : null}
              {age >= 13 && <Text style={[styles.hint, copyAlign]}>{t.ageYears(age)}</Text>}
            </>
          )}

          {stepId === 'scale' && (
            <>
              <GearHeroCard kind="scale" compact />
              <BrandStepHeading
                title={t.scale.title}
                tipTitle={t.withingsTip.title}
                tipBody={t.withingsTip.body}
                tipMore={t.withingsTip.more}
                tipDismiss={t.withingsTip.dismiss}
                helpHref={helpUrl(langCode, 'withings-scale')}
                helpLabel={t.scale.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.scale.lead}</Text>
              <View
                onLayout={(e) => {
                  yesNoAnchorY.current = e.nativeEvent.layout.y;
                }}
              >
                <QuestionYesNo
                  value={hasScale}
                  onChange={pickScale}
                  highlight={yesNoCoach}
                  yesLabel={t.yes}
                  noLabel={t.no}
                  coachLabel={t.tapYesNo}
                />
              </View>
            </>
          )}

          {stepId === 'watch' && (
            <>
              <GearHeroCard kind="watch" compact />
              <BrandStepHeading
                title={t.watch.title}
                tipTitle={t.withingsTip.title}
                tipBody={t.withingsTip.body}
                tipMore={t.withingsTip.more}
                tipDismiss={t.withingsTip.dismiss}
                helpHref={helpUrl(langCode, 'quick-start-watch')}
                helpLabel={t.watch.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.watch.lead}</Text>
              <View
                onLayout={(e) => {
                  yesNoAnchorY.current = e.nativeEvent.layout.y;
                }}
              >
                <QuestionYesNo
                  value={hasWatch}
                  onChange={pickWatch}
                  highlight={yesNoCoach}
                  yesLabel={t.yes}
                  noLabel={t.no}
                  coachLabel={t.tapYesNo}
                />
              </View>
            </>
          )}

          {stepId === 'cgm' && (
            <>
              <GearHeroCard kind="cgm" compact />
              <StepHeading
                title={t.cgm.title}
                helpHref={helpUrl(langCode, 'cgm')}
                helpLabel={t.cgm.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.cgm.lead}</Text>
              <View
                onLayout={(e) => {
                  yesNoAnchorY.current = e.nativeEvent.layout.y;
                }}
              >
                <QuestionYesNo
                  value={tracksCgm}
                  onChange={pickCgm}
                  highlight={yesNoCoach}
                  yesLabel={t.yes}
                  noLabel={t.no}
                  coachLabel={t.tapYesNo}
                />
              </View>
            </>
          )}

          {stepId === 'link_withings' && (
            <>
              <GearHeroCard kind="link" />
              <StepHeading
                title={t.link.title}
                helpHref={helpUrl(langCode, 'withings-link')}
                helpLabel={t.link.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.link.lead}</Text>
              {withingsLinked ? (
                <View style={styles.successCard}>
                  <Text style={[styles.successText, copyAlign]}>{t.link.connected}</Text>
                  <Text style={[styles.hint, copyAlign]}>{t.link.relinkHint}</Text>
                </View>
              ) : (
                <>
                  <Pressable
                    style={[styles.btnPrimary, styles.btnFull, linkBusy && styles.btnDisabled]}
                    disabled={linkBusy}
                    onPress={() => void handleLinkWithings()}
                  >
                    <Text style={styles.btnPrimaryText}>
                      {linkBusy ? t.link.opening : t.link.linkBtn}
                    </Text>
                  </Pressable>
                  {linkError ? <Text style={styles.errorText}>{linkError}</Text> : null}
                  <Text style={[styles.hint, copyAlign]}>{t.link.skipHint}</Text>
                </>
              )}
            </>
          )}

          {stepId === 'weight' && (
            <>
              <StepHeading
                title={t.weight.title}
                helpHref={helpUrl(langCode, 'starting-weight')}
                helpLabel={t.weight.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.weight.lead}</Text>
              {hasScale && withingsLinked ? (
                <Text style={[styles.hint, copyAlign]}>{t.weight.linkedHint}</Text>
              ) : null}
              {hasScale && !withingsLinked ? (
                <>
                  <Pressable
                    style={[styles.optionCard, !linkWithingsLater && styles.optionCardOn]}
                    onPress={() => setLinkWithingsLater(false)}
                  >
                    <Text style={[styles.optionTitle, copyAlign]}>{t.weight.enterNow}</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.optionCard, linkWithingsLater && styles.optionCardOn]}
                    onPress={() => setLinkWithingsLater(true)}
                  >
                    <Text style={[styles.optionTitle, copyAlign]}>{t.weight.skipWithings}</Text>
                  </Pressable>
                </>
              ) : null}
              {(!hasScale || !linkWithingsLater || withingsLinked) && (
                <>
                  <Text style={[styles.fieldLabel, copyAlign]}>
                    {t.weight.currentWeight} ({massUnitLabel(unitsPrefs.mass)})
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={weightInput}
                    onChangeText={setWeightInput}
                    keyboardType="decimal-pad"
                    placeholder={unitsPrefs.mass === 'lb' ? 'e.g. 173' : 'e.g. 78.5'}
                    placeholderTextColor={colors.textSecondary}
                  />
                  {!hasScale ? (
                    <HelpButton
                      href={helpUrl(langCode, 'manual-body')}
                      label={t.weight.manualGuide}
                      defaultLabel={t.help}
                    />
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
                    title={t.phoneHealth.titleIos}
                    helpHref={helpUrl(langCode, 'phone-health-activity')}
                    helpLabel={t.phoneHealth.helpLabel}
                    textStyle={copyAlign}
                    rtl={rtl}
                  />
                  <Text style={[styles.lead, copyAlign]}>{t.phoneHealth.leadIos}</Text>
                  {tracksCgm ? (
                    <Text style={[styles.hint, copyAlign]}>{t.phoneHealth.cgmIos}</Text>
                  ) : null}
                </>
              ) : (
                <>
                  <StepHeading
                    title={t.phoneHealth.titleAndroid}
                    helpHref={helpUrl(langCode, 'phone-health-activity')}
                    helpLabel={t.phoneHealth.helpLabel}
                    textStyle={copyAlign}
                    rtl={rtl}
                  />
                  <Text style={[styles.lead, copyAlign]}>{t.phoneHealth.leadAndroid}</Text>
                  {tracksCgm ? (
                    <Text style={[styles.hint, copyAlign]}>{t.phoneHealth.cgmAndroid}</Text>
                  ) : null}
                </>
              )}
              {!hasWatch ? <PhoneHealthActivityStrip langCode={langCode} /> : null}
              {permBusy ? <ActivityIndicator style={{ marginTop: 12 }} /> : null}
              {permNote ? <Text style={[styles.hint, copyAlign]}>{permNote}</Text> : null}
            </>
          )}

          {stepId === 'pdfs' && (
            <>
              <StepHeading
                title={t.pdfs.title}
                helpHref={helpUrl(langCode, 'reports-import')}
                helpLabel={t.pdfs.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.pdfs.lead}</Text>
              <View style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <View style={styles.pdfIconWrap}>
                    <PdfFileIcon size={46} />
                  </View>
                  <View style={styles.reportCardCopy}>
                    <Text style={[styles.optionTitle, copyAlign]}>{t.pdfs.labTitle}</Text>
                    <Text style={[styles.hint, copyAlign]}>{t.pdfs.labHint}</Text>
                  </View>
                </View>
                {labDone ? <Text style={styles.doneBadgeNavy}>{t.pdfs.imported}</Text> : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.btnNavy}
                    onPress={() => {
                      setLabAutoPick(true);
                      setLabModal(true);
                    }}
                  >
                    <PdfFileIcon size={18} />
                    <Text style={styles.btnNavyText}>{t.pdfs.importLab}</Text>
                  </Pressable>
                </View>
              </View>
              <View style={styles.reportCard}>
                <View style={styles.reportCardHeader}>
                  <View style={styles.pdfIconWrap}>
                    <PdfFileIcon size={46} />
                  </View>
                  <View style={styles.reportCardCopy}>
                    <Text style={[styles.optionTitle, copyAlign]}>{t.pdfs.nutritionTitle}</Text>
                    <Text style={[styles.hint, copyAlign]}>{t.pdfs.nutritionHint}</Text>
                  </View>
                </View>
                {nutritionDone ? <Text style={styles.doneBadgeNavy}>{t.pdfs.imported}</Text> : null}
                <View style={styles.cardActions}>
                  <Pressable
                    style={styles.btnNavy}
                    onPress={() => {
                      setNutritionAutoPick(true);
                      setNutritionModal(true);
                    }}
                  >
                    <PdfFileIcon size={18} />
                    <Text style={styles.btnNavyText}>{t.pdfs.importSession}</Text>
                  </Pressable>
                </View>
              </View>
            </>
          )}

          {stepId === 'targets' && (
            <>
              <StepHeading
                title={t.targets.title}
                helpHref={helpUrl(langCode, 'targets-help')}
                helpLabel={t.targets.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.targets.lead}</Text>
              {rulesPreview ? (
                <Text style={[styles.rulesPreview, copyAlign]} numberOfLines={6}>
                  {rulesPreview}
                </Text>
              ) : null}
              {targetsBusy ? (
                <ActivityIndicator
                  size="large"
                  color={colors.accentGreen}
                  style={{ marginVertical: 24 }}
                />
              ) : null}
              {targetsError ? (
                <>
                  <Text style={styles.errorText}>{targetsError}</Text>
                  <Pressable style={styles.btnPrimary} onPress={() => void runTargetAi(false)}>
                    <Text style={styles.btnPrimaryText}>{t.targets.retry}</Text>
                  </Pressable>
                </>
              ) : null}
              {bodyTarget && macroTarget ? (
                <>
                  {usingSavedTargets ? (
                    <Text style={[styles.hint, copyAlign]}>{t.targets.usingSaved}</Text>
                  ) : null}
                  <View style={styles.targetSummary}>
                    <Text style={[styles.optionTitle, copyAlign]}>{t.targets.bodyTarget}</Text>
                    <Text style={[styles.hint, copyAlign]}>
                      {formatMass(bodyTarget.targetWeight_kg, unitsPrefs.mass)} ·{' '}
                      {bodyTarget.targetFatPct.toFixed(0)}% fat · {bodyTarget.reasoning}
                    </Text>
                    <Text style={[styles.optionTitle, copyAlign, { marginTop: 12 }]}>
                      {t.targets.dailyMacros}
                    </Text>
                    <Text style={[styles.hint, copyAlign]}>
                      {formatEnergy(macroTarget.kcal, unitsPrefs.energy)} · P{macroTarget.protein_g} ·
                      C{macroTarget.carb_g} · F{macroTarget.fat_g}
                      {macroTarget.fiber_g != null ? ` · Fi${macroTarget.fiber_g}` : ''}
                    </Text>
                    {macroTarget.rulesContext ? (
                      <Text style={[styles.hint, copyAlign, { marginTop: 8 }]}>
                        {t.targets.rulesApplied}: {macroTarget.rulesContext}
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
                    <Text style={styles.btnGhostText}>{t.targets.regenerate}</Text>
                  </Pressable>
                </>
              ) : null}
            </>
          )}

          {stepId === 'meals' && (
            <>
              <GearHeroCard kind="meals" />
              <StepHeading
                title={t.meals.title}
                helpHref={helpUrl(langCode, 'meal-logging')}
                helpLabel={t.meals.helpLabel}
                textStyle={copyAlign}
                rtl={rtl}
              />
              <Text style={[styles.lead, copyAlign]}>{t.meals.lead}</Text>
              <Text style={[styles.bullet, copyAlign]}>{t.meals.b1}</Text>
              <Text style={[styles.bullet, copyAlign]}>{t.meals.b2}</Text>
              <Text style={[styles.bullet, copyAlign]}>{t.meals.b3}</Text>
              <Text style={[styles.bullet, copyAlign]}>{t.meals.b4}</Text>
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
                  {finishSpinner ? t.working : t.meals.logFirst}
                </Text>
              </Pressable>
            </>
          )}

          {stepError ? <Text style={styles.errorText}>{stepError}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, isLanguageGate && styles.footerGate]}>
          {stepIndex > 0 ? (
            <Pressable
              style={({ pressed }) => [
                styles.btnGhost,
                pressed && !(nextBusy || finishBusy) && styles.btnGhostPressed,
              ]}
              onPress={goBack}
              disabled={nextBusy || finishBusy}
            >
              <Text style={styles.btnGhostText}>{t.back}</Text>
            </Pressable>
          ) : isLanguageGate ? null : (
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
              <Text style={styles.btnNextText}>{finishSpinner ? t.working : t.finish}</Text>
            </Pressable>
          ) : (
            <Pressable
              style={({ pressed }) => [
                styles.btnNext,
                isLanguageGate && styles.btnNextGate,
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
                {nextSpinner || (stepId === 'phone_health' && permBusy)
                  ? t.working
                  : isLanguageGate
                    ? 'Next'
                    : t.next}
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

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  header: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.gridLine,
  },
  headerTitle: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
  headerSub: { fontSize: 14, color: c.textSecondary, marginTop: 4 },
  languageGateContent: {
    flexGrow: 1,
    paddingTop: 4,
    paddingBottom: 4,
    paddingHorizontal: 16,
  },
  languageGateShell: {
    flex: 1,
    justifyContent: 'space-between',
  },
  brandHeroGate: {
    marginBottom: 0,
    paddingBottom: 0,
    borderBottomWidth: 0,
  },
  brandLogoWrapCrop: {
    overflow: 'hidden',
    alignItems: 'center',
  },
  gateRoot: {
    flex: 1,
    marginTop: 4,
  },
  gateHeader: {
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    // Light keeps brand navy; dark needs cream/white — navy on black was invisible.
    color: isDark ? c.stripTitle : BRAND_NAVY,
    marginBottom: 18,
    paddingHorizontal: 8,
  },
  gateCloudWordRtl: {
    writingDirection: 'rtl',
  },
  gateGrid: {
    gap: 10,
    paddingHorizontal: 2,
  },
  gateGridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gateGridCell: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: c.gridLine,
    // Dark: outlined black pills (same pattern as Profile units); light keeps white cards.
    backgroundColor: isDark ? c.background : '#FFFFFF',
  },
  gateGridCellOn: {
    borderColor: isDark ? c.accentBlue : NEXT_BLUE,
    backgroundColor: isDark ? c.background : '#F2F9FE',
    shadowColor: isDark ? c.shadow : NEXT_BLUE_DEEP,
    shadowOpacity: isDark ? 0 : 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: isDark ? 0 : 3,
  },
  gateGridFlag: {
    fontSize: 26,
    lineHeight: 32,
  },
  gateGridNative: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'center',
  },
  gateFlagNativeRtl: {
    writingDirection: 'rtl',
  },
  gateFlagNativeOn: {
    color: isDark ? c.accentBlue : NEXT_BLUE_DEEP,
    fontWeight: '700',
  },
  gateCardPressed: {
    opacity: 0.9,
    transform: [{ scale: 0.96 }],
  },
  appearRoot: {
    marginTop: 4,
    gap: 16,
  },
  appearOptions: {
    gap: 10,
  },
  appearCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: c.gridLine,
    backgroundColor: isDark ? c.background : '#FFFFFF',
  },
  appearCardOn: {
    borderColor: isDark ? c.accentBlue : NEXT_BLUE,
    backgroundColor: isDark ? c.background : '#F2F9FE',
  },
  appearCardLabel: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: c.textPrimary,
  },
  appearCardLabelOn: {
    color: isDark ? c.accentBlue : NEXT_BLUE_DEEP,
  },
  appearPreview: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: c.gridLine,
    backgroundColor: c.surface,
    overflow: 'hidden',
  },
  appearPreviewStrip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: c.gridLine,
    backgroundColor: isDark ? c.background : c.surface,
  },
  appearPreviewStripTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    color: isDark ? c.stripTitle : BRAND_NAVY,
  },
  appearPreviewCard: {
    margin: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: isDark ? c.background : '#FFFFFF',
    borderWidth: 1,
    borderColor: c.gridLine,
    gap: 8,
  },
  appearPreviewBar: {
    height: 6,
    borderRadius: 3,
    width: '42%',
    backgroundColor: isDark ? c.accentBlue : NEXT_BLUE,
  },
  appearPreviewPrimary: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
  },
  appearPreviewSecondary: {
    fontSize: 12,
    lineHeight: 16,
    color: c.textSecondary,
  },
  brandHero: {
    alignItems: 'center',
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: c.gridLine,
  },
  brandLogoWrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  brandLogo: {
    width: '100%',
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
    color: isDark ? c.textSecondary : BRAND_NAVY,
    opacity: isDark ? 1 : 0.72,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 10 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: c.gridLine,
  },
  dotOn: { backgroundColor: isDark ? c.accentBlue : BRAND_NAVY },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 48 },
  question: {
    flex: 1,
    fontSize: 22,
    fontWeight: '700',
    color: c.textPrimary,
    lineHeight: 28,
    paddingRight: 8,
  },
  questionInline: {
    fontSize: 22,
    fontWeight: '700',
    color: c.textPrimary,
    lineHeight: 28,
  },
  brandTitleWrap: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 2,
    rowGap: 2,
  },
  brandTitleWrapRtl: {
    flexDirection: 'row-reverse',
  },
  brandInTitle: {
    color: NEXT_BLUE_DEEP,
  },
  brandHelpBtn: {
    paddingHorizontal: 2,
    paddingVertical: 1,
    marginTop: 1,
  },
  stepHeading: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 4,
  },
  stepHeadingRtl: {
    flexDirection: 'row-reverse',
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
    borderTopColor: c.gridLine,
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
  lead: { fontSize: 15, lineHeight: 22, color: c.textPrimary, marginBottom: 16 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textSecondary,
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
    borderColor: c.gridLine,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: c.textPrimary,
    backgroundColor: c.surface,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: c.gridLine,
  },
  chipOn: { backgroundColor: BRAND_NAVY, borderColor: BRAND_NAVY },
  chipText: { fontSize: 14, fontWeight: '600', color: c.textSecondary },
  chipTextOn: { color: '#fff' },
  dateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 10,
    padding: 12,
    backgroundColor: c.surface,
  },
  dateBtnText: { fontSize: 15, color: c.textPrimary },
  hint: { fontSize: 13, lineHeight: 19, color: c.textSecondary, marginTop: 6 },
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
    borderColor: c.gridLine,
    backgroundColor: c.surface,
  },
  yesNoText: { fontSize: 18, fontWeight: '700', color: c.textSecondary },
  yesNoTextOn: { color: '#fff' },
  yesNoCoachHint: {
    textAlign: 'center',
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: NEXT_BLUE_DEEP,
  },
  successCard: {
    borderWidth: 1,
    borderColor: isDark ? c.gridLine : '#2E7D5A',
    borderRadius: 12,
    padding: 14,
    backgroundColor: isDark ? c.background : c.surface,
    marginBottom: 8,
  },
  successText: { fontSize: 16, fontWeight: '700', color: isDark ? c.accentGreen : '#2E7D5A' },
  rulesPreview: {
    fontSize: 11,
    lineHeight: 16,
    color: c.textSecondary,
    marginTop: 8,
    marginBottom: 4,
    padding: 10,
    borderRadius: 8,
    backgroundColor: c.progressTrack,
  },
  bullet: { fontSize: 14, lineHeight: 22, color: c.textPrimary, marginBottom: 8 },
  optionCard: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    backgroundColor: c.surface,
  },
  optionCardOn: { borderColor: '#2E7D5A', borderWidth: 2 },
  optionTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  welcomeCard: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    backgroundColor: c.surface,
  },
  reportCard: {
    borderWidth: 1,
    borderColor: c.gridLine,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
    backgroundColor: c.surface,
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
    borderColor: c.gridLine,
    borderRadius: 12,
    padding: 14,
    backgroundColor: c.surface,
  },
  footer: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: c.gridLine,
    paddingBottom: Platform.OS === 'android' ? 24 : 16,
  },
  footerGate: {
    borderTopWidth: 0,
    paddingTop: 8,
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
  btnNextGate: {
    paddingVertical: 15,
    borderRadius: 14,
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
    borderColor: c.textSecondary,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: c.surface,
  },
  btnGhostPressed: {
    borderColor: BRAND_NAVY,
    backgroundColor: 'rgba(26, 43, 74, 0.06)',
    transform: [{ scale: 0.97 }],
  },
  btnGhostText: { color: c.textSecondary, fontWeight: '600', fontSize: 15 },
  errorText: { fontSize: 13, color: '#c0392b', marginTop: 10 },
  });
