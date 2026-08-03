import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  InteractionManager,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  SafeAreaView,
  initialWindowMetrics,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { BmrHistoryChart7d } from '../components/BmrHistoryChart7d';
import { FoodLogModal } from '../components/FoodLogModal';
import { FoodMacroStrip, type FoodMacroStripHandle } from '../components/FoodMacroStrip';
import { MetabolicChart } from '../components/MetabolicChart';
import { MetabolicTrendChart7d } from '../components/MetabolicTrendChart7d';
import { WeightTargetStrip } from '../components/WeightTargetStrip';
import { MentorStrip } from '../components/MentorStrip';
import { AccountStrip } from '../components/AccountStrip';
import { ClinicLinkStrip } from '../components/ClinicLinkStrip';
import { ReportsStrip } from '../components/ReportsStrip';
import { LocalBackupStrip } from '../components/LocalBackupStrip';
import { HelpStrip } from '../components/HelpStrip';
import { DashboardCollapseHeader } from '../components/DashboardCollapseHeader';
import { ActionIcons, ActiveMentorIcons, DashIcon, StripIcons } from '../theme/icons';
import { RulesStrip } from '../components/RulesStrip';
import { NutritionDirectivesStrip } from '../components/NutritionDirectivesStrip';
import { LabResultsStrip } from '../components/LabResultsStrip';
import { WelcomeQuickStartWizard } from '../components/WelcomeQuickStartWizard';
import { Check, X } from 'lucide-react-native';
import { CgmDevicesMark, WithingsDevicesMark } from '../components/GearIllustrations';
import { MacroTargetStrip } from '../components/MacroTargetStrip';
import { ManualBodyProfileSection, type ManualBodyProfileSectionHandle } from '../components/ManualBodyProfileSection';
import { getManualBody, getManualBodyHistory, manualBodyToDashboardMetrics, type ManualBodySnapshot } from '../services/ManualBodyService';
import { LanguageStrip } from '../components/LanguageStrip';
import { UnitsStrip } from '../components/UnitsStrip';
import { AppearanceStrip } from '../components/AppearanceStrip';
import { GearSetupStrip } from '../components/GearSetupStrip';
import { DebugErrorBoundary } from '../components/DebugErrorBoundary';
import {
  DEFAULT_UNITS_PREFS,
  formatUnitsDisplayHint,
  getUnitsPrefs,
  saveUnitsPrefs,
  type UnitsPrefs,
} from '../services/UnitsPreferenceService';
import {
  formatGlucose,
  formatHeight,
  formatMass,
  heightCmToInput,
  coerceHeightInputForUnit,
  kgToDisplay,
  parseHeightInputToCm,
  parseLocaleNumber,
  formatEnergy,
} from '../logic/unitConvert';
import {
  buildManualTrendDays,
  countMergedWeighInDays,
  fillBmrGaps,
  resolveUserBmrAnchor,
} from '../services/ManualTrendService';
import type { PhoneHealthSyncSummary } from '../services/phoneHealthSyncTypes';
import {
  isLiveGlucoseSource,
  isPhoneHealthActivity,
  loadSourceConfig,
  saveSourceConfig,
  sourceConfigFromToggles,
  togglesFromSourceConfig,
  type SetupToggles,
  type SourceConfig,
} from '../services/SourceConfigService';
import {
  fetchDailyStepTotalsForTrend,
  PHONE_HEALTH_DEEP_LOOKBACK_DAYS,
  PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS,
  stepsToActiveKcal,
} from '../services/SamsungStepsAdapter';
import { hybridWithingsActivityKcal } from '../services/hybridActivityBurn';
import { clearOnboardingCompletedAt, shouldShowQuickStart } from '../services/ProfileCompletenessService';
import { maybeRunOpportunisticCloudBackup } from '../services/CloudBackupService';
import { applyAutoMacroRevision, macroSuggestionToDailyTarget } from '../logic/macroAutoAdjust';
import { ChatScreen } from './ChatScreen';
import { CONFIG } from '../config/env';
import { useHealthData } from '../hooks/useHealthData';
import { useWithingsData } from '../hooks/useWithingsData';
import { healthConnectService, openHealthConnectSettings } from '../services/HealthConnectService';
import {
  DEFAULT_TREND_PERIOD_DAYS,
  TREND_PERIOD_DAY_OPTIONS,
  alignTrendDaysToLastNCalendarDays,
  forwardFillTrendWeight,
  localDayKeyFromMs,
  dayKeyStartMs,
  resolveCompositionPeriodAnchor,
  type CompositionSession,
  type MetabolicTrend7dDay,
} from '../logic/metabolicTrend7d';
import { formatLocalizedDate, formatLocalizedDateTime } from '../i18n/dateLocale';
import { getBodyMetricsCopy } from '../i18n/bodyMetricsCopy';
import { aiChatActionSummary, aiChatAskPrompt, aiChatOpenLabel, aiChatTitle } from '../i18n/aiChatCopy';
import { getProfileSettingsStripCopy } from '../i18n/profileSettingsStripCopy';
import { getHelpStripCopy } from '../i18n/helpStripCopy';
import { getYourSetupCopy } from '../i18n/yourSetupCopy';
import {
  formatRelativeAgoLocalized,
  getMetabolicStripCopy,
} from '../i18n/metabolicStripCopy';
import { metabolicChartHeader } from '../logic/sourceConfigLabels';
import { awsDataService } from '../services/AwsDataService';
import {
  assertCareSensCsvMatchesExportName,
  formatCareSensImportRange,
  parseCareSensAirExportWithSessions,
  readCareSensCsvText,
} from '../services/careSensCsv';
import { foodLogDayKey, defaultMealTimestampForDay, getTodayMeals, getRecentMeals, getDailyMacros, buildMealsAiContext, type FoodEntry } from '../services/FoodLogService';
import { buildLabsAiContext, getAllLabReports, type LabReport } from '../services/LabLogService';
import {
  getActiveNutritionDirective,
  getNutritionDirectiveAiContext,
  listNutritionDirectives,
  type NutritionDirective,
} from '../services/NutritionDirectiveService';
import { exportLocalBackup, importLocalBackup } from '../services/LocalBackupService';
import { shareVisitReport, type VisitReportDayCount } from '../services/visitReportService';
import { buildGlucoseMentorContext } from '../logic/mealGlucoseAnalysis';
import {
  getBirthdate, setBirthdate, computeAge, getCachedHeightCm,
  setHeightCm as saveHeightCm, getGender, setGender, getMentors, saveMentors,
  getUserRules, getMacroTarget, getEffectiveMacroTarget, getBodyTarget, getCoachMessage, saveCoachMessage,
  getLanguage, getMentorGender, SUPPORTED_LANGUAGES,
  ensureMacroTargetDaySnapshot, getManualBmrKcal,
  type Gender, type MentorType, type UserRules, type DailyMacroTarget, type BodyTarget, type CoachMessage, type UserLanguage,
} from '../services/TargetService';
import { type CoachContext } from '../services/GeminiService';
import { triggerCoachReview, forceCoachReview, runAutoChecksAndPersist } from '../services/CoachService';
import {
  buildAuthorizationUrl,
  handleOAuthCallback,
  loadWithingsTokens,
} from '../services/WithingsApiService';
import { type AuthUser, fetchCurrentUser, updatePatientNames } from '../services/AuthApiService';
import { pullAccountRulesIfNewer, pullClinicOverlays } from '../services/ClinicOverlayService';
import {
  CLINIC_SYNC_POLL_MS,
  fulfillPendingClinicSyncRequests,
  pushSnapshotForWebView,
} from '../services/ClinicSyncService';
import {
  SYNC_PERF_ALERT,
  formatSyncPerfReport,
  syncPerfEnd,
  syncPerfStart,
  syncPerfTrackSibling,
} from '../services/SyncPerf';
import { cardShadow, dashCardGap } from '../theme/wellness';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { demoNoticeCopy } from '../utils/wellnessCopy';

/** Must match `styles.scroll.paddingHorizontal`. */
const SCROLL_HORIZONTAL_PADDING = 20;
/** How far back to load meals for historical chart markers (days). */
const CHART_MEAL_LOOKBACK_DAYS = 31;
/** Persist glucose / trend expand state so compact stays default after relaunch. */
const DASH_GLUCOSE_EXPANDED_KEY = 'dash_glucose_chart_expanded';
const DASH_TREND_EXPANDED_KEY = 'dash_trend_chart_expanded';
const DASH_SETTINGS_CARD_EXPANDED_KEY = 'dash_settings_card_expanded';
const DASH_LANGUAGE_EXPANDED_KEY = 'dash_language_expanded';
const DASH_UNITS_EXPANDED_KEY = 'dash_units_expanded';
const DASH_APPEARANCE_EXPANDED_KEY = 'dash_appearance_expanded';
const DASH_GEAR_EXPANDED_KEY = 'dash_gear_expanded';
const BRAND_LOGO = require('../../assets/brand-logo.png');
// Same geometry as the light lockup (so header height is unchanged), light ink on a
// transparent background instead of the white plate.
const BRAND_LOGO_DARK = require('../../assets/brand-logo-dark.png');
const BRAND_HEADER_HEIGHT_FALLBACK = 96;

// Primary-tier anchor (audit F6) — navy left edge groups the top "today" cards
// (AI chat, body metrics, Food Log) so secondary strips below read as lighter.
const PRIMARY_TIER_ACCENT = '#1F3D5C';

function latestGlucoseSummary(
  points: { timestamp: string; value: number }[],
  glucoseUnit: 'mgdl' | 'mmol' = 'mgdl',
  langCode?: string | null,
): { valueLabel: string; ago: string } | null {
  let best: { timestamp: string; value: number } | null = null;
  for (const p of points) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    if (!best || Date.parse(p.timestamp) > Date.parse(best.timestamp)) best = p;
  }
  if (!best) return null;
  return {
    valueLabel: formatGlucose(best.value, glucoseUnit),
    ago: formatRelativeAgoLocalized(best.timestamp, langCode),
  };
}

function trendWeightSummary(
  days: MetabolicTrend7dDay[],
  massUnit: 'kg' | 'lb' = 'kg',
): { weightLabel: string; deltaLabel: string | null } | null {
  const weights = days
    .map((d) => d.weightKg)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (weights.length === 0) return null;
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const delta = weights.length >= 2 ? latest - first : null;
  const deltaDisp = delta != null ? kgToDisplay(delta, massUnit) : null;
  return {
    weightLabel: formatMass(latest, massUnit),
    deltaLabel:
      deltaDisp != null && Math.abs(deltaDisp) >= (massUnit === 'lb' ? 0.1 : 0.05)
        ? `${deltaDisp > 0 ? '+' : ''}${deltaDisp.toFixed(1)} ${massUnit}`
        : null,
  };
}

function computeBrandHeaderHeight(windowWidth: number): number {
  const contentW = Math.max(1, windowWidth - SCROLL_HORIZONTAL_PADDING * 2);
  try {
    const r = Image.resolveAssetSource(BRAND_LOGO);
    if (r?.width && r?.height && r.width > 0 && r.height > 0) {
      const raw = (contentW * r.height) / r.width;
      // Slim brand lockup (audit F18) — cap tighter so metrics/chat/Food Log
      // rise above the fold on first load. resizeMode=contain keeps it centered.
      return Math.round(Math.min(104, Math.max(60, raw)));
    }
  } catch {
    /* ignore */
  }
  return BRAND_HEADER_HEIGHT_FALLBACK;
}

function formatKg(value: number | null | undefined, decimals = 1, unit: 'kg' | 'lb' = 'kg'): string {
  return formatMass(value, unit, decimals);
}

function formatMeasuredAt(
  iso: string | null | undefined,
  langCode?: string | null,
): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  try {
    return formatLocalizedDateTime(t, langCode, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function navBarBottomInset(bottom: number): number {
  if (bottom > 0) return bottom;
  return Platform.OS === 'android' ? 48 : 16;
}

const COACH_LAST_WEIGH_IN_KEY = 'coach_last_weigh_in_at';
const COACH_LAST_WORKOUT_MS_KEY = 'coach_last_workout_start_ms';

type DashboardScreenProps = {
  user: AuthUser;
  onSignedOut: () => void;
};

export const DashboardScreen = ({ user, onSignedOut }: DashboardScreenProps) => {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const brandHeaderHeight = useMemo(() => computeBrandHeaderHeight(windowWidth), [windowWidth]);
  const noticeOverlapUnderLogo = useMemo(
    () => Math.min(40, Math.round(brandHeaderHeight * 0.24)),
    [brandHeaderHeight]
  );

  const {
    glucoseData,
    cgmSessionStarts,
    cgmStatSummary,
    heartRateData: _heartRateData,
    activityZones,
    isLoading,
    error,
    refetch,
    applyImportedGlucose,
    dataSource,
  } = useHealthData();

  const {
    bodyScan,
    bodyTrendDays,
    bodyTrendSessions,
    heartRate: withingsHeartRate,
    calories: withingsCalories,
    workouts: workoutSessions,
    bodyScanLoading,
    bodyScanError,
    trendLoading,
    trendError,
    sync: syncWithings,
    refreshTodayIntraday,
    hrSyncDiagLine,
  } = useWithingsData();

  const [sourceConfig, setSourceConfig] = useState<SourceConfig | null>(null);
  const [setupToggles, setSetupToggles] = useState<SetupToggles | null>(null);
  const [hcStepTotalsByDay, setHcStepTotalsByDay] = useState<Map<string, number>>(new Map());
  const [hcActivityLookbackDays, setHcActivityLookbackDays] = useState(PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS);
  const [manualBodySnap, setManualBodySnap] = useState<ManualBodySnapshot | null>(null);

  const effectiveBodyScan = useMemo(() => {
    const useWithingsBody = sourceConfig?.bodyComposition === 'withings';
    if (useWithingsBody && bodyScan?.weightKg != null) return bodyScan;
    if (manualBodySnap) return manualBodyToDashboardMetrics(manualBodySnap);
    if (bodyScan?.weightKg != null) return bodyScan;
    return bodyScan;
  }, [bodyScan, manualBodySnap, sourceConfig]);

  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);
  const [visitReportBusy, setVisitReportBusy] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const [clinicExpanded, setClinicExpanded] = useState(false);
  const [reportsExpanded, setReportsExpanded] = useState(false);
  const [backupExpanded, setBackupExpanded] = useState(false);
  const [helpExpanded, setHelpExpanded] = useState(false);

  const [trendPeriodDays, setTrendPeriodDays] = useState<number>(DEFAULT_TREND_PERIOD_DAYS);

  const [withingsLinked, setWithingsLinked] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [withingsMenuVisible, setWithingsMenuVisible] = useState(false);

  const [foodModalVisible, setFoodModalVisible] = useState(false);
  const [foodEditEntry, setFoodEditEntry] = useState<FoodEntry | undefined>();
  const [foodInitialTimestamp, setFoodInitialTimestamp] = useState<number | undefined>();
  const [foodRefreshKey, setFoodRefreshKey] = useState(0);
  const [todayFoodEntries, setTodayFoodEntries] = useState<FoodEntry[]>([]);
  /** Meals across the last month for historical chart markers when panning back. */
  const [chartMeals, setChartMeals] = useState<FoodEntry[]>([]);
  const [eatenKcalByDay, setEatenKcalByDay] = useState<Record<string, number>>({});
  const todayDayKey = foodLogDayKey(Date.now());

  const [pullRefreshing, setPullRefreshing] = useState(false);

  // ─── Coach message + chat ────────────────────────────────────────────────
  const [coachMsg, setCoachMsg] = useState<CoachMessage | null>(null);
  const [chatVisible, setChatVisible] = useState(false);
  // Always holds the latest coachContext to avoid stale closure issues
  const coachContextRef = useRef<CoachContext | null>(null);
  const foodMacroStripRef = useRef<FoodMacroStripHandle>(null);
  const manualBodySectionRef = useRef<ManualBodyProfileSectionHandle>(null);

  // ─── Height + birthdate + gender ─────────────────────────────────────────
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [userGender, setUserGender] = useState<Gender | null>(null);
  const [bodyTargetForMacros, setBodyTargetForMacros] = useState<BodyTarget | null>(null);
  const [mentors, setMentorsState] = useState<MentorType[]>(['coach', 'nutritionist']);
  const [userRules, setUserRules] = useState<UserRules | null>(null);
  const [labReports, setLabReports] = useState<LabReport[]>([]);
  const [labsAiContext, setLabsAiContext] = useState<string | null>(null);
  const [nutritionDirectiveContext, setNutritionDirectiveContext] = useState<string | null>(null);
  const [nutritionDirectives, setNutritionDirectives] = useState<NutritionDirective[]>([]);
  const [directiveActiveId, setDirectiveActiveId] = useState<string | null>(null);
  const [macroTarget, setMacroTarget] = useState<DailyMacroTarget | null>(null);
  const [effectiveMacroTarget, setEffectiveMacroTarget] = useState<DailyMacroTarget | null>(null);
  const [userLanguage, setUserLanguage] = useState<UserLanguage>(SUPPORTED_LANGUAGES[0]);
  const [unitsPrefs, setUnitsPrefs] = useState<UnitsPrefs>(DEFAULT_UNITS_PREFS);
  // expanded state for each collapsible row in the grouped card
  const [mentorExpanded, setMentorExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [macroExpanded, setMacroExpanded] = useState(false);
  /** Glucose + trend (incl. energy) charts: collapsed by default so Food Log sits higher. */
  const [glucoseExpanded, setGlucoseExpanded] = useState(false);
  const [trendExpanded, setTrendExpanded] = useState(false);
  const [settingsCardExpanded, setSettingsCardExpanded] = useState(false);
  const [dashExpandPrefsLoaded, setDashExpandPrefsLoaded] = useState(false);
  const [macroWeighInSuggestion, setMacroWeighInSuggestion] = useState<DailyMacroTarget | null>(null);
  const [macroWeighInHint, setMacroWeighInHint] = useState<string | null>(null);
  const [macroAnalyzeRequestId, setMacroAnalyzeRequestId] = useState(0);
  const [birthdatePicker, setBirthdatePicker] = useState<Date>(new Date(1980, 0, 1));
  const [genderPicker, setGenderPicker] = useState<Gender>('male');
  const [mentorGenderPicker, setMentorGenderPicker] = useState<Gender>('female');
  const [userMentorGender, setUserMentorGender] = useState<Gender | null>(null);
  const [showDatePickerDialog, setShowDatePickerDialog] = useState(false);
  const [heightInput, setHeightInput] = useState('');
  const [firstNameInput, setFirstNameInput] = useState('');
  const [lastNameInput, setLastNameInput] = useState('');
  const [profileNameLabel, setProfileNameLabel] = useState(() =>
    [user.firstName, user.lastName].filter(Boolean).join(' ').trim(),
  );

  const refreshWithingsLinkState = useCallback(async () => {
    const t = await loadWithingsTokens();
    setWithingsLinked(Boolean(t?.refreshToken));
  }, []);

  const loadTodayFood = useCallback(async () => {
    const [meals, recent] = await Promise.all([
      getTodayMeals(),
      getRecentMeals(CHART_MEAL_LOOKBACK_DAYS),
    ]);
    setTodayFoodEntries(meals);
    setChartMeals(recent);
  }, []);

  const [profileExpanded, setProfileExpanded] = useState(false);
  const [languageExpanded, setLanguageExpanded] = useState(false);
  const [unitsExpanded, setUnitsExpanded] = useState(false);
  const [appearanceExpanded, setAppearanceExpanded] = useState(false);
  const [gearExpanded, setGearExpanded] = useState(false);
  const [quickStartVisible, setQuickStartVisible] = useState(false);
  const [manualTrendDays, setManualTrendDays] = useState<MetabolicTrend7dDay[]>([]);
  const [manualTrendLoading, setManualTrendLoading] = useState(false);
  const [manualWeighInDayCount, setManualWeighInDayCount] = useState(0);
  /** Profile BMR override or earliest user-entered BMR — seeds empty chart days. */
  const [userBmrAnchor, setUserBmrAnchor] = useState<number | null>(null);

  const loadManualTrend = useCallback(async (
    manualSnap?: ManualBodySnapshot | null,
    opts?: { deepSteps?: boolean },
  ) => {
    setManualTrendLoading(true);
    try {
      const [config, history, gender, height, bd, bmrOverride] = await Promise.all([
        loadSourceConfig(),
        getManualBodyHistory(),
        getGender(),
        getCachedHeightCm(),
        getBirthdate(),
        getManualBmrKcal(),
      ]);
      setSourceConfig(config);
      setSetupToggles(togglesFromSourceConfig(config));
      const snap = manualSnap ?? (await getManualBody());
      const prior = bodyTrendDays;
      const hist = history.length > 0 ? history : snap ? [snap] : [];
      setUserBmrAnchor(resolveUserBmrAnchor(hist, bmrOverride ?? null));
      const mergedWeighIns = countMergedWeighInDays(prior, history);
      setManualWeighInDayCount(mergedWeighIns);
      if (history.length === 0 && !snap && !prior.some((d) => d.weightKg != null)) {
        setManualTrendDays([]);
        return;
      }
      const age = bd ? computeAge(bd) : null;
      if (!gender || !height || !age || age < 13) {
        setManualTrendDays([]);
        return;
      }
      const latestWeight =
        snap?.weight_kg ??
        history[history.length - 1]?.weight_kg ??
        [...prior].reverse().find((d) => d.weightKg != null)?.weightKg ??
        0;
      const lookback = Math.max(...TREND_PERIOD_DAY_OPTIONS, DEFAULT_TREND_PERIOD_DAYS);
      // HC/HK step pull: shallow by default; deep after Deep sync (same 128d window).
      const stepLookback = opts?.deepSteps
        ? PHONE_HEALTH_DEEP_LOOKBACK_DAYS
        : PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS;
      const stepMap = isPhoneHealthActivity(config.activity)
        ? await fetchDailyStepTotalsForTrend(stepLookback, latestWeight, height, gender)
        : new Map<string, number>();
      const days = buildManualTrendDays({
        lookbackDays: lookback,
        heightCm: height,
        ageYears: age,
        gender,
        history: history.length > 0 ? history : snap ? [snap] : [],
        stepTotalsByDay: stepMap,
        bmrOverrideKcal: bmrOverride ?? null,
        priorTrendDays: prior,
      });
      setManualTrendDays(days);
    } finally {
      setManualTrendLoading(false);
    }
  }, [bodyTrendDays]);

  const loadLabReports = useCallback(async (refreshCoach = false) => {
    const [reports, mt, effMt] = await Promise.all([
      getAllLabReports(),
      getMacroTarget(),
      getEffectiveMacroTarget(),
    ]);
    const ctx = buildLabsAiContext(reports, 'all');
    setLabReports(reports);
    setLabsAiContext(ctx);
    if (mt) setMacroTarget(mt);
    if (effMt) setEffectiveMacroTarget(effMt);

    if (coachContextRef.current) {
      coachContextRef.current = { ...coachContextRef.current, labsAiContext: ctx };
    }

    if (refreshCoach && ctx && coachContextRef.current) {
      const storedLang = await getLanguage();
      const newMsg = await triggerCoachReview('meal', {
        ...coachContextRef.current,
        lang: storedLang,
        event: 'meal',
      });
      if (newMsg) setCoachMsg(newMsg);
    }
  }, []);

  const loadNutritionDirectives = useCallback(async (refreshCoach = false) => {
    const [aiCtx, active, entries] = await Promise.all([
      getNutritionDirectiveAiContext(),
      getActiveNutritionDirective(),
      listNutritionDirectives(),
    ]);
    setNutritionDirectiveContext(aiCtx);
    setNutritionDirectives(entries);
    setDirectiveActiveId(active?.id ?? null);
    if (coachContextRef.current) {
      coachContextRef.current = {
        ...coachContextRef.current,
        nutritionDirectiveContext: aiCtx,
      };
    }
    if (refreshCoach && coachContextRef.current) {
      const storedLang = await getLanguage();
      const newMsg = await triggerCoachReview('meal', {
        ...coachContextRef.current,
        lang: storedLang,
        event: 'meal',
      });
      if (newMsg) setCoachMsg(newMsg);
    }
  }, []);

  const loadHeightAndBirthdate = useCallback(async () => {
    const [cached, prefs] = await Promise.all([getCachedHeightCm(), getUnitsPrefs()]);
    setUnitsPrefs(prefs);
    if (cached) {
      setHeightCm(cached);
      setHeightInput(heightCmToInput(cached, prefs.height));
    }

    // Show modal if gender or birthdate not yet stored.
    const [storedBd, gd, mgd] = await Promise.all([getBirthdate(), getGender(), getMentorGender()]);
    if (gd) setUserGender(gd);
    if (gd === 'male' || gd === 'female') setGenderPicker(gd);
    if (mgd) {
      setUserMentorGender(mgd);
      if (mgd === 'male' || mgd === 'female') setMentorGenderPicker(mgd);
    } else if (gd === 'male' || gd === 'female') {
      setMentorGenderPicker(gd);
    }
    if (storedBd) { const d = new Date(storedBd); if (!isNaN(d.getTime())) setBirthdatePicker(d); }

    const [m, r, mt, bt, lang, manual] = await Promise.all([
      getMentors(),
      getUserRules(),
      getMacroTarget(),
      getBodyTarget(),
      getLanguage(),
      getManualBody(),
    ]);
    await ensureMacroTargetDaySnapshot();
    const effMt = await getEffectiveMacroTarget();
    setManualBodySnap(manual);
    setMentorsState(m);
    if (r) setUserRules(r);
    if (mt) setMacroTarget(mt);
    if (effMt) setEffectiveMacroTarget(effMt);
    if (bt) setBodyTargetForMacros(bt);
    setUserLanguage(lang);

    void loadManualTrend(manual);

    const needQuickStart = await shouldShowQuickStart();
    if (needQuickStart) {
      setQuickStartVisible(true);
    } else if (!gd || !storedBd) {
      setProfileExpanded(true);
    }
  }, [loadManualTrend]);

  const handleFoodSaved = useCallback(async (opts?: { close?: boolean }) => {
    const shouldClose = opts?.close !== false;
    setFoodRefreshKey((k) => k + 1);
    // Persist already finished in FoodLogModal; refresh list/chips before closing
    // so reopen cannot show the pre-save JSON snapshot.
    await Promise.all([
      loadTodayFood(),
      foodMacroStripRef.current?.reload() ?? Promise.resolve(),
    ]);
    if (shouldClose) {
      setFoodModalVisible(false);
      setFoodEditEntry(undefined);
      setFoodInitialTimestamp(undefined);
    }
    if (!shouldClose) return;
    // Do not await coach — FoodLogModal calls reset() after onSaved resolves.
    // Awaiting here left a ~2s window where reopen looked fine, then reset wiped the meal.
    const ctx = coachContextRef.current;
    if (!ctx) return;
    void (async () => {
      try {
        const storedLang = await getLanguage();
        const newMsg = await triggerCoachReview('meal', {
          ...ctx,
          lang: storedLang,
          event: 'meal',
          mealCount: ctx.mealCount + 1,
        });
        if (newMsg) setCoachMsg(newMsg);
      } catch {
        /* non-fatal */
      }
    })();
  }, [loadTodayFood]);

  const handleEditMeal = useCallback((entry: FoodEntry) => {
    setFoodEditEntry(entry);
    setFoodModalVisible(true);
  }, []);

  const usePhoneHealthActivity = isPhoneHealthActivity(sourceConfig?.activity ?? 'none');

  /** After Deep sync, keep the 128d step window until app restart (shallow remounts used to wipe UI). */
  const hcPreferDeepRef = useRef(false);

  const loadHcStepTotals = useCallback(async (deep = false) => {
    if (!usePhoneHealthActivity || !heightCm || !userGender) {
      setHcStepTotalsByDay(new Map());
      setHcActivityLookbackDays(PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS);
      return;
    }
    if (deep) hcPreferDeepRef.current = true;
    const weightKg =
      effectiveBodyScan?.weightKg ?? manualBodySnap?.weight_kg ?? bodyScan?.weightKg ?? 70;
    const lookback =
      deep || hcPreferDeepRef.current
        ? PHONE_HEALTH_DEEP_LOOKBACK_DAYS
        : PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS;
    setHcActivityLookbackDays(lookback);
    const map = await fetchDailyStepTotalsForTrend(lookback, weightKg, heightCm, userGender);
    // Shallow map covers only the lookback window; older days render from the
    // persisted store activityKcalDay (or Withings hybrid when distance exists).
    setHcStepTotalsByDay(map);
    return map;
  }, [usePhoneHealthActivity, heightCm, userGender, effectiveBodyScan, manualBodySnap, bodyScan]);

  const useManualWeightTrend = useMemo(() => {
    if (sourceConfig?.bodyComposition === 'manual') return true;
    if (bodyScan?.weightKg != null && sourceConfig?.bodyComposition === 'withings') return false;
    const withingsWeightDays = bodyTrendDays.filter((d) => d.weightKg != null).length;
    return withingsWeightDays < 2 && manualBodySnap != null;
  }, [sourceConfig, bodyScan, bodyTrendDays, manualBodySnap]);

  /** Withings devices on body card — scale and/or watch (Link / ✓✕ only apply here). */
  const showWithingsBodyHeader = useMemo(() => {
    if (setupToggles != null) return setupToggles.withingsScale || setupToggles.withingsWatch;
    if (sourceConfig != null) {
      return (
        sourceConfig.bodyComposition === 'withings' || sourceConfig.activity === 'withings'
      );
    }
    return false;
  }, [setupToggles, sourceConfig]);

  /** CGM mark on the body card — only when user opted into CGM. */
  const showCgmBodyMark = useMemo(() => {
    if (setupToggles != null) return setupToggles.cgm === true;
    if (sourceConfig != null) return sourceConfig.glucose !== 'none';
    return false;
  }, [setupToggles, sourceConfig]);

  const showBodySourcesHeader = showWithingsBodyHeader || showCgmBodyMark;

  /** Scale off in persisted source_config — drives Body form / charts (not the chip, so toggle stays snappy). */
  const manualBodyScaleActive = useMemo(() => {
    if (sourceConfig != null) return sourceConfig.bodyComposition !== 'withings';
    if (setupToggles != null) return !setupToggles.withingsScale;
    return false;
  }, [setupToggles, sourceConfig]);

  const displayBodyScan = useMemo(() => {
    const useWithingsBody = sourceConfig?.bodyComposition === 'withings';
    if (useWithingsBody && bodyScan?.weightKg != null) {
      return { metrics: bodyScan, provenance: 'withings' as const };
    }
    if (effectiveBodyScan?.weightKg != null) {
      return {
        metrics: effectiveBodyScan,
        provenance: 'manual' as const,
        fatEstimated: manualBodySnap?.fat_pct_source !== 'user',
      };
    }
    return null;
  }, [bodyScan, effectiveBodyScan, manualBodySnap, sourceConfig]);

  const persistSetupToggles = useCallback((next: SetupToggles) => {
    const config = sourceConfigFromToggles(next);
    // Chip paints in this frame; Body form / chart switch wait until after paint.
    setSetupToggles(next);
    const applyHeavy = () => {
      setSourceConfig(config);
      void saveSourceConfig(config);
      if (config.bodyComposition === 'manual') {
        void loadManualTrend();
      }
      // Do NOT request HC/HealthKit permissions here — Android only shows the sheet from a
      // direct tap (Allow access on PhoneHealthActivityStrip). Delayed requestPermission
      // after a toggle often does nothing and then blocks a later Allow tap.
      if (isPhoneHealthActivity(config.activity)) {
        void (async () => {
          await syncWithings();
          await loadHcStepTotals();
        })();
      }
    };
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(applyHeavy);
    });
  }, [loadManualTrend, syncWithings, loadHcStepTotals]);

  const baseTrendDays = useManualWeightTrend ? manualTrendDays : bodyTrendDays;

  /**
   * Patch activityKcalDay:
   * - Watch Off (phone health): steps→kcal in lookback; older days null then hybrid below.
   * - Watch On: Withings distance×weight + non-distance workouts (prompt80 hybrid).
   * Distance comes from Withings bodyTrendDays (store), including when base trend is manual weight.
   */
  const bodyTrendDaysWithActivity = useMemo((): MetabolicTrend7dDay[] => {
    let days = baseTrendDays;
    const phoneLookbackKeys = new Set<string>();
    if (usePhoneHealthActivity) {
      for (let i = 0; i < hcActivityLookbackDays; i += 1) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        phoneLookbackKeys.add(localDayKeyFromMs(d.getTime()));
      }
    }
    const phoneOwnsDay = (dk: string) => phoneLookbackKeys.has(dk);

    const storeDistanceByDay = new Map<string, number>();
    const storeStepsByDay = new Map<string, number>();
    const storeActivityByDay = new Map<string, number>();
    for (const d of bodyTrendDays) {
      if (d.distanceM != null && Number.isFinite(d.distanceM) && d.distanceM > 0) {
        storeDistanceByDay.set(d.dayKey, d.distanceM);
      }
      if (d.steps != null && Number.isFinite(d.steps) && d.steps > 0) {
        storeStepsByDay.set(d.dayKey, d.steps);
      }
      if (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay) && d.activityKcalDay > 0) {
        storeActivityByDay.set(d.dayKey, d.activityKcalDay);
      }
    }

    const weightForDay = (d: MetabolicTrend7dDay): number | null => {
      const w = d.weightKg ?? effectiveBodyScan?.weightKg ?? manualBodySnap?.weight_kg;
      return w != null && Number.isFinite(w) && w > 0 ? w : null;
    };

    const distanceForDay = (d: MetabolicTrend7dDay): number | null => {
      if (d.distanceM != null && Number.isFinite(d.distanceM) && d.distanceM > 0) {
        return d.distanceM;
      }
      return storeDistanceByDay.get(d.dayKey) ?? null;
    };

    const stepsForDay = (d: MetabolicTrend7dDay): number | null => {
      if (d.steps != null && Number.isFinite(d.steps) && d.steps > 0) return d.steps;
      return storeStepsByDay.get(d.dayKey) ?? null;
    };

    const storedOrBaseActivity = (d: MetabolicTrend7dDay): number | null => {
      const stored = storeActivityByDay.get(d.dayKey);
      if (stored != null) return stored;
      return d.activityKcalDay;
    };

    if (usePhoneHealthActivity && heightCm && userGender) {
      days = days.map((d) => {
        if (!phoneOwnsDay(d.dayKey)) {
          // Outside the phone window: prefer metricsStore activity (HC deep merge).
          const act = storedOrBaseActivity(d);
          return act !== d.activityKcalDay ? { ...d, activityKcalDay: act } : d;
        }
        const steps = hcStepTotalsByDay.get(d.dayKey) ?? 0;
        const weightKg = weightForDay(d);
        if (weightKg && steps > 0) {
          return {
            ...d,
            activityKcalDay: stepsToActiveKcal(steps, weightKg, heightCm, userGender),
          };
        }
        // No fresh steps — keep store history instead of forcing 0 (shallow remount wipe).
        const kept = storedOrBaseActivity(d);
        return { ...d, activityKcalDay: kept ?? 0 };
      });
    }

    // Watch On (or days outside phone lookback): hybrid distance + non-walk sports.
    days = days.map((d) => {
      if (phoneOwnsDay(d.dayKey)) return d;
      const weightKg = weightForDay(d);
      if (weightKg == null) return d;
      const dist = distanceForDay(d);
      const steps = stepsForDay(d);
      const hybrid = hybridWithingsActivityKcal({
        dayKey: d.dayKey,
        distanceM: dist,
        steps,
        weightKg,
        heightCm,
        gender: userGender,
        workouts: workoutSessions,
      });
      return {
        ...d,
        distanceM: dist,
        steps,
        // Watch Off: hybrid has no Withings distance/workouts and returns 0 — persisted
        // HC history (store activityKcalDay) must win, not be overwritten with 0.
        activityKcalDay: usePhoneHealthActivity
          ? (hybrid > 0 ? hybrid : storedOrBaseActivity(d))
          : hybrid,
      };
    });

    // Empty BMR days: carry-forward measured BMR; seed from Profile / first user BMR.
    days = fillBmrGaps(days, { seedBmrKcal: userBmrAnchor });

    return days;
  }, [
    baseTrendDays,
    bodyTrendDays,
    usePhoneHealthActivity,
    hcActivityLookbackDays,
    hcStepTotalsByDay,
    heightCm,
    userGender,
    effectiveBodyScan,
    manualBodySnap,
    workoutSessions,
    userBmrAnchor,
  ]);

  const visibleTrend = useMemo(() => {
    if (bodyTrendDaysWithActivity.length < 2) return null;
    const aligned = alignTrendDaysToLastNCalendarDays(
      bodyTrendDaysWithActivity,
      trendPeriodDays,
    );
    const todayKey = localDayKeyFromMs(Date.now());
    const firstKey = aligned[0]?.dayKey;
    let seedWeight: number | null = null;
    if (firstKey) {
      for (const d of bodyTrendDaysWithActivity) {
        if (d.dayKey < firstKey && d.weightKg != null && Number.isFinite(d.weightKg)) {
          seedWeight = d.weightKg;
        }
      }
    }
    // Fill through today only — leave empty tomorrow pad so lines keep a small right gap.
    const filled = fillBmrGaps(
      forwardFillTrendWeight(aligned, seedWeight, todayKey),
      { seedBmrKcal: userBmrAnchor },
    );
    const days = filled.map((d) =>
      d.dayKey > todayKey
        ? { ...d, weightKg: null, bmrKcalDay: null, activityKcalDay: null, fatMassKg: null, muscleMassKg: null, visceralFatIndex: null }
        : d,
    );
    const hasPlot =
      days.some((d) => d.weightKg != null) || days.some((d) => d.bmrKcalDay != null);
    if (!hasPlot) return null;
    const anchor = resolveCompositionPeriodAnchor(
      bodyTrendSessions,
      days.filter((d) => d.dayKey <= todayKey).map((d) => d.dayKey),
    );
    return { days, anchor };
  }, [bodyTrendDaysWithActivity, bodyTrendSessions, trendPeriodDays, userBmrAnchor]);

  const hasEnergyHistory = useMemo(
    () =>
      visibleTrend?.days.some(
        (d) =>
          (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) ||
          (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay))
      ) ?? false,
    [visibleTrend]
  );

  const glucoseCompactSummary = useMemo(
    () => latestGlucoseSummary(glucoseData, unitsPrefs.glucose, userLanguage.code),
    [glucoseData, unitsPrefs.glucose, userLanguage.code],
  );

  const metabolicStripCopy = useMemo(
    () => getMetabolicStripCopy(userLanguage.code),
    [userLanguage.code],
  );

  const bodyMetricsCopy = useMemo(
    () => getBodyMetricsCopy(userLanguage.code),
    [userLanguage.code],
  );

  const profileStripCopy = useMemo(
    () => getProfileSettingsStripCopy(userLanguage.code),
    [userLanguage.code],
  );
  const helpStripCopy = useMemo(
    () => getHelpStripCopy(userLanguage.code),
    [userLanguage.code],
  );
  const yourSetupCopy = useMemo(
    () => getYourSetupCopy(userLanguage.code),
    [userLanguage.code],
  );

  const metabolicHeader = useMemo(() => {
    const summaryLine = glucoseCompactSummary
      ? `${glucoseCompactSummary.valueLabel}${
          glucoseCompactSummary.ago ? ` · ${glucoseCompactSummary.ago}` : ''
        }`
      : null;
    return metabolicChartHeader(sourceConfig, summaryLine, userLanguage.code);
  }, [sourceConfig, glucoseCompactSummary, userLanguage.code]);

  const trendCompactSummary = useMemo(
    () => (visibleTrend ? trendWeightSummary(visibleTrend.days, unitsPrefs.mass) : null),
    [visibleTrend, unitsPrefs.mass],
  );

  const loadEatenHistory = useCallback(async (dayKeys: string[]) => {
    if (dayKeys.length === 0) {
      setEatenKcalByDay({});
      return;
    }
    const pairs = await Promise.all(
      dayKeys.map(async (dk) => {
        const m = await getDailyMacros(dk);
        return [dk, Math.round(m.kcal)] as const;
      }),
    );
    setEatenKcalByDay(Object.fromEntries(pairs));
  }, []);

  useEffect(() => {
    const keys = visibleTrend?.days.map((d) => d.dayKey) ?? [];
    void loadEatenHistory(keys);
  }, [visibleTrend, foodRefreshKey, loadEatenHistory]);

  /**
   * BMR + activity kcal per day.
   * Watch On: hybrid (distance×weight + non-distance workouts).
   * Watch Off: phone steps in lookback; hybrid outside.
   * Do not Math.max with legacy Withings totals — that re-inflated activity to ~937.
   */
  const burnPartsByDay = useMemo((): Record<string, { bmr: number; activity: number }> => {
    const fallbackBmr =
      effectiveBodyScan?.bmrKcalDay ??
      manualBodySnap?.bmr_kcal ??
      bodyTrendDaysWithActivity.find((d) => d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay))
        ?.bmrKcalDay ??
      null;

    const weightByDay = new Map<string, number>();
    const distanceByDay = new Map<string, number>();
    const stepsByDay = new Map<string, number>();
    for (const d of bodyTrendDays) {
      if (d.weightKg != null && Number.isFinite(d.weightKg) && d.weightKg > 0) {
        weightByDay.set(d.dayKey, d.weightKg);
      }
      if (d.distanceM != null && Number.isFinite(d.distanceM) && d.distanceM > 0) {
        distanceByDay.set(d.dayKey, d.distanceM);
      }
      if (d.steps != null && Number.isFinite(d.steps) && d.steps > 0) {
        stepsByDay.set(d.dayKey, d.steps);
      }
    }
    for (const d of bodyTrendDaysWithActivity) {
      if (d.weightKg != null && Number.isFinite(d.weightKg) && d.weightKg > 0) {
        weightByDay.set(d.dayKey, d.weightKg);
      }
      if (d.distanceM != null && Number.isFinite(d.distanceM) && d.distanceM > 0) {
        distanceByDay.set(d.dayKey, d.distanceM);
      }
      if (d.steps != null && Number.isFinite(d.steps) && d.steps > 0) {
        stepsByDay.set(d.dayKey, d.steps);
      }
    }
    const fallbackWeight =
      effectiveBodyScan?.weightKg ?? manualBodySnap?.weight_kg ?? null;

    const withingsActivityForDay = (dk: string): number => {
      const weightKg = weightByDay.get(dk) ?? fallbackWeight;
      if (weightKg == null || weightKg <= 0) return 0;
      return hybridWithingsActivityKcal({
        dayKey: dk,
        distanceM: distanceByDay.get(dk) ?? null,
        steps: stepsByDay.get(dk) ?? null,
        weightKg,
        heightCm,
        gender: userGender,
        workouts: workoutSessions,
      });
    };

    const ensureDay = (
      result: Record<string, { bmr: number; activity: number }>,
      dk: string,
      activity: number,
      bmrHint?: number | null,
    ) => {
      const bmr = bmrHint ?? result[dk]?.bmr ?? fallbackBmr;
      if (bmr == null || !Number.isFinite(bmr)) return;
      result[dk] = {
        bmr: Math.round(bmr),
        activity: Math.round(activity),
      };
    };

    if (useManualWeightTrend || usePhoneHealthActivity) {
      const phoneLookbackKeys = new Set<string>();
      if (usePhoneHealthActivity) {
        for (let i = 0; i < hcActivityLookbackDays; i += 1) {
          const day = new Date();
          day.setDate(day.getDate() - i);
          phoneLookbackKeys.add(localDayKeyFromMs(day.getTime()));
        }
      }
      const result: Record<string, { bmr: number; activity: number }> = {};
      for (const d of bodyTrendDaysWithActivity) {
        const bmr = d.bmrKcalDay ?? fallbackBmr;
        if (!bmr || !Number.isFinite(bmr)) continue;
        const phoneOwns = phoneLookbackKeys.has(d.dayKey);
        const activity = phoneOwns
          ? (d.activityKcalDay ?? 0)
          : withingsActivityForDay(d.dayKey);
        result[d.dayKey] = { bmr: Math.round(bmr), activity: Math.round(activity) };
      }
      const todayKey = localDayKeyFromMs(Date.now());
      // New calendar day with 0 steps must still show activity 0 + burned (BMR + 0).
      ensureDay(
        result,
        todayKey,
        phoneLookbackKeys.has(todayKey) ? 0 : withingsActivityForDay(todayKey),
      );
      for (const dk of phoneLookbackKeys) {
        if (!result[dk]) ensureDay(result, dk, 0);
      }
      return result;
    }

    const bmrByDay = new Map<string, number>();
    for (const d of bodyTrendDaysWithActivity) {
      if (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) {
        bmrByDay.set(d.dayKey, d.bmrKcalDay);
      }
    }

    const allDayKeys = new Set<string>([
      localDayKeyFromMs(Date.now()),
      ...bmrByDay.keys(),
      ...distanceByDay.keys(),
    ]);
    for (const w of workoutSessions) {
      allDayKeys.add(localDayKeyFromMs(w.startMs));
    }

    const result: Record<string, { bmr: number; activity: number }> = {};
    for (const dk of allDayKeys) {
      const bmr = bmrByDay.get(dk) ?? fallbackBmr;
      if (!bmr || !Number.isFinite(bmr)) continue;
      result[dk] = {
        bmr: Math.round(bmr),
        activity: Math.round(withingsActivityForDay(dk)),
      };
    }
    return result;
  }, [
    effectiveBodyScan,
    manualBodySnap,
    bodyTrendDays,
    bodyTrendDaysWithActivity,
    workoutSessions,
    useManualWeightTrend,
    usePhoneHealthActivity,
    hcActivityLookbackDays,
    heightCm,
    userGender,
  ]);

  const burnKcalByDay = useMemo((): Record<string, number> => {
    const result: Record<string, number> = {};
    for (const [dk, parts] of Object.entries(burnPartsByDay)) {
      result[dk] = parts.bmr + parts.activity;
    }
    return result;
  }, [burnPartsByDay]);

  /** Fat% derived from body scan (fatMassKg / weightKg * 100). */
  const fatPct = useMemo((): number | null => {
    const { fatMassKg, weightKg } = effectiveBodyScan ?? {};
    if (sourceConfig?.bodyComposition === 'manual' && manualBodySnap?.weight_kg) {
      return manualBodySnap.fat_pct;
    }
    if (manualBodySnap && manualBodySnap.weight_kg > 0 && sourceConfig?.bodyComposition !== 'withings') {
      return manualBodySnap.fat_pct;
    }
    if (!fatMassKg || !weightKg || weightKg <= 0) return null;
    return (fatMassKg / weightKg) * 100;
  }, [effectiveBodyScan, manualBodySnap, sourceConfig]);

  /** Weekly weight change (kg/week) via linear regression on up to last 14 days with data. */
  const weeklyWeightChange_kg = useMemo((): number | null => {
    const pts = baseTrendDays
      .filter((d) => d.weightKg != null)
      .slice(-14)
      .map((d) => ({
        x: new Date(d.dayKey).getTime() / (7 * 24 * 3600 * 1000), // weeks
        y: d.weightKg as number,
      }));
    if (pts.length < 3) return null;
    const n = pts.length;
    const sumX = pts.reduce((s, p) => s + p.x, 0);
    const sumY = pts.reduce((s, p) => s + p.y, 0);
    const sumXY = pts.reduce((s, p) => s + p.x * p.y, 0);
    const sumX2 = pts.reduce((s, p) => s + p.x * p.x, 0);
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return Number.isFinite(slope) ? Math.round(slope * 100) / 100 : null;
  }, [baseTrendDays]);

  const trendChartLoading = useManualWeightTrend ? manualTrendLoading : trendLoading;
  const trendAvailableDays = useManualWeightTrend
    ? Math.max(manualTrendDays.length, bodyTrendDays.length)
    : bodyTrendDays.length;

  /** Prior Withings BIA still in merged manual trend — show fat/muscle strips. */
  const trendHasScaleComposition = useMemo(
    () =>
      (useManualWeightTrend ? manualTrendDays : bodyTrendDays).some(
        (d) =>
          (d.fatMassKg != null && Number.isFinite(d.fatMassKg)) ||
          (d.muscleMassKg != null && Number.isFinite(d.muscleMassKg)),
      ),
    [useManualWeightTrend, manualTrendDays, bodyTrendDays],
  );

  /** User age computed from stored birthdate. */
  const userAge = useMemo((): number | null => {
    if (!birthdatePicker) return null;
    const iso = birthdatePicker.toISOString().split('T')[0];
    return computeAge(iso);
  }, [birthdatePicker]);

  /** Persisted profile plus in-form draft values while My Profile is open. */
  const manualBodyProfile = useMemo(() => {
    const gender =
      userGender ??
      (genderPicker === 'male' || genderPicker === 'female' ? genderPicker : null);
    const heightCmEff =
      heightCm ?? parseHeightInputToCm(heightInput, unitsPrefs.height);
    const ageEff =
      userAge ??
      (birthdatePicker ? computeAge(birthdatePicker.toISOString().split('T')[0]) : null);
    return { gender, heightCm: heightCmEff, age: ageEff };
  }, [userGender, genderPicker, heightCm, heightInput, userAge, birthdatePicker, unitsPrefs.height]);

  const manualBodyProfileReady =
    manualBodyProfile.gender != null &&
    manualBodyProfile.heightCm != null &&
    manualBodyProfile.age != null &&
    manualBodyProfile.age >= 13;

  const settingsCardSummary = useMemo(() => {
    const t = metabolicStripCopy;
    const code = userLanguage.code;
    const bareUnits = code === 'he' || code === 'ar';
    const genderLabel =
      userGender === 'male'
        ? t.genderMale
        : userGender === 'female'
          ? t.genderFemale
          : userGender === 'other'
            ? t.genderOther
            : null;
    const parts: string[] = [];
    if (genderLabel) parts.push(genderLabel);
    if (heightCm) {
      parts.push(
        bareUnits && unitsPrefs.height === 'cm'
          ? String(Math.round(heightCm))
          : formatHeight(heightCm, unitsPrefs.height),
      );
    }
    if (userAge != null) parts.push(bareUnits ? String(userAge) : t.ageYears(userAge));
    if (code !== 'en') parts.push(userLanguage.label);
    return parts.length > 0 ? parts.join(' · ') : t.tapToOpen;
  }, [
    userGender,
    heightCm,
    userAge,
    unitsPrefs.height,
    metabolicStripCopy,
    userLanguage.code,
    userLanguage.label,
  ]);

  /** Today's actual macros summed from food entries. */
  const todayActualMacros = useMemo(() => {
    if (todayFoodEntries.length === 0) return { protein_g: null, fat_g: null, carb_g: null, fiber_g: null, kcal: null };
    const sum = todayFoodEntries.reduce(
      (acc, e) => ({
        protein_g: acc.protein_g + (e.totalProtein_g ?? 0),
        fat_g:     acc.fat_g     + (e.totalFat_g     ?? 0),
        carb_g:    acc.carb_g    + (e.totalCarb_g    ?? 0),
        fiber_g:   acc.fiber_g   + (e.totalFiber_g ?? e.items.reduce((s, i) => s + (i.fiber_g ?? 0), 0)),
        kcal:      acc.kcal      + (e.totalKcal      ?? 0),
      }),
      { protein_g: 0, fat_g: 0, carb_g: 0, fiber_g: 0, kcal: 0 },
    );
    return sum;
  }, [todayFoodEntries]);

  /** Today's estimated burn from burnKcalByDay. */
  const todayEstimatedBurn = useMemo(() => {
    const todayKey = localDayKeyFromMs(Date.now());
    return burnKcalByDay[todayKey] ?? null;
  }, [burnKcalByDay]);

  /** Meal detail strings for mentor AI context. */
  const mealContext = useMemo(
    () => buildMealsAiContext(todayFoodEntries),
    [todayFoodEntries],
  );

  const mealGlucoseContext = useMemo(
    () => buildGlucoseMentorContext(todayFoodEntries, glucoseData, cgmSessionStarts, cgmStatSummary),
    [todayFoodEntries, glucoseData, cgmSessionStarts, cgmStatSummary],
  );

  const visitReportUi = useMemo(() => {
    const dayLabel = (n: VisitReportDayCount): string => {
      if (userLanguage.code === 'he') return `${n} ימים`;
      if (userLanguage.code === 'ar') {
        return `${n} ${n === 7 || n === 30 ? 'أيام' : 'يوماً'}`;
      }
      return `${n} days`;
    };
    if (userLanguage.code === 'he') {
      return {
        title: 'דוח ביקור',
        subtitle: 'דוח הערכת תזונה פנימית — סיכום מקצועי + נספח נתונים מלא',
        dayLabel,
        busy: 'מכין דוח…',
        doneTitle: 'דוח מוכן',
        doneMessage: 'בחר/י איך לשתף (אימייל, Drive, הדפסה)',
        errorTitle: 'דוח ביקור',
        cgmNote: 'נספח א: גרפים (שומנים, גוף, אנרגיה, CGM). CGM דקה-דקה — בנספח ב (7 ימים).',
      };
    }
    if (userLanguage.code === 'ar') {
      return {
        title: 'تقرير الزيارة',
        subtitle: 'نتائج المختبر — كل السجل. ملخص CGM/الوجبات — حسب الفترة.',
        dayLabel,
        busy: 'جاري التحضير…',
        doneTitle: 'التقرير جاهز',
        doneMessage: 'اختر طريقة المشاركة (بريد، Drive، طباعة)',
        errorTitle: 'تقرير الزيارة',
        cgmNote: 'CGM كل 5 دقائق في 7 أيام فقط؛ 30/90 — متوسطات ووجبات يومية.',
      };
    }
    return {
      title: 'Visit report',
      subtitle: 'Internal nutrition assessment — clinical summary + full data appendix',
      dayLabel,
      busy: 'Building report…',
      doneTitle: 'Report ready',
      doneMessage: 'Choose how to share (email, Drive, print)',
      errorTitle: 'Visit report',
      cgmNote: 'Appendix A: charts (lipids, body, energy, CGM). Full CGM readings in Appendix B (7d).',
    };
  }, [userLanguage.code]);

  /** Build CoachContext from current state — memoized to avoid recreating on every render. */
  const coachContext = useMemo((): CoachContext => {
    const ctx: CoachContext = {
      mentors,
      event: 'meal', // default; overridden in trigger calls
      lang: userLanguage,
      mentorGender: userMentorGender ?? mentorGenderPicker,
      age: userAge,
      gender: userGender,
      heightCm,
      weightKg: effectiveBodyScan?.weightKg ?? null,
      fatPct,
      muscleMass_kg: effectiveBodyScan?.muscleMassKg ?? null,
      bmr_kcal: effectiveBodyScan?.bmrKcalDay ?? null,
      startWeight_kg: bodyTargetForMacros?.startWeight_kg ?? null,
      startMuscle_kg: bodyTargetForMacros?.startMuscle_kg ?? null,
      todayEaten: todayActualMacros.kcal,
      todayBurn: todayEstimatedBurn,
      todayProtein_g: todayActualMacros.protein_g,
      todayFat_g: todayActualMacros.fat_g,
      todayCarb_g: todayActualMacros.carb_g,
      mealCount: todayFoodEntries.length,
      lastMealSummary: mealContext.lastMealSummary,
      todayMealsDetail: mealContext.todayMealsDetail,
      todayMealGlucoseDetail: mealGlucoseContext,
      glucoseHistory: glucoseData,
      macroTarget: macroTarget ?? effectiveMacroTarget,
      bodyTarget: bodyTargetForMacros,
      userRules,
      labsAiContext,
      nutritionDirectiveContext,
      unitsDisplayHint: formatUnitsDisplayHint(unitsPrefs),
      unitsPrefs,
    };
    coachContextRef.current = ctx;
    return ctx;
  }, [
    mentors, userAge, userGender, userMentorGender, mentorGenderPicker, heightCm, effectiveBodyScan, fatPct, bodyTargetForMacros,
    todayActualMacros, todayEstimatedBurn, todayFoodEntries.length, mealContext, mealGlucoseContext, glucoseData, macroTarget, effectiveMacroTarget, userRules, labsAiContext, nutritionDirectiveContext, userLanguage, unitsPrefs,
  ]);

  /** Regenerate coach message using stored language (not stale React state). */
  const refreshCoachForLanguage = useCallback(async () => {
    const storedLang = await getLanguage();
    const ctx = coachContextRef.current;
    if (!ctx) return null;
    try {
      const newMsg = await forceCoachReview({ ...ctx, lang: storedLang, event: 'day-close' });
      setCoachMsg(newMsg);
      return newMsg;
    } catch {
      return null;
    }
  }, []);

  /** Load coach message on mount and run auto-checks. */
  const loadCoachMessage = useCallback(async () => {
    const storedLang = await getLanguage();
    const msg = await getCoachMessage();
    const ctx = coachContextRef.current;

    if (msg) {
      const msgLang = msg.generatedLangCode ?? 'en';
      if (msgLang !== storedLang.code && ctx) {
        // Generate-then-replace: never clear storage until a new message succeeds.
        try {
          const newMsg = await forceCoachReview({
            ...ctx,
            lang: storedLang,
            event: msg.triggerEvent ?? 'day-close',
          });
          setCoachMsg(newMsg);
          return;
        } catch {
          // Regen failed — keep showing the stale message rather than an empty panel.
        }
      }
    } else if (ctx) {
      // No stored message — try once (e.g. after a failed day-close regen at midnight).
      try {
        const newMsg = await forceCoachReview({ ...ctx, lang: storedLang, event: 'day-close' });
        setCoachMsg(newMsg);
        return;
      } catch {
        setCoachMsg(null);
        return;
      }
    } else {
      setCoachMsg(null);
      return;
    }

    if (!msg) {
      setCoachMsg(null);
      return;
    }

    const data = {
      todayCarb_g: ctx?.todayCarb_g ?? null,
      todayProtein_g: ctx?.todayProtein_g ?? null,
      todayEaten: ctx?.todayEaten ?? null,
      todayBurn: ctx?.todayBurn ?? null,
      mealCount: ctx?.mealCount ?? 0,
      macroTargetCarb_g: ctx?.macroTarget?.carb_g ?? null,
      macroTargetProtein_g: ctx?.macroTarget?.protein_g ?? null,
    };
    const updated = await runAutoChecksAndPersist(msg, data);
    setCoachMsg(updated);
  }, []);

  /** Day-close trigger — fires once per calendar day on first dashboard mount. */
  const checkDayClose = useCallback(async () => {
    const today = localDayKeyFromMs(Date.now());
    const lastDayClose = await AsyncStorage.getItem('last_day_close_date');
    if (lastDayClose !== today) {
      await AsyncStorage.setItem('last_day_close_date', today);
      const ctx = coachContextRef.current;
      if (!ctx) return;
      try {
        const newMsg = await triggerCoachReview('day-close', { ...ctx, event: 'day-close' });
        if (newMsg) setCoachMsg(newMsg);
      } catch {
        // Non-fatal
      }
    }
  }, []);

  const applyClinicOverlays = useCallback(async () => {
    // Web-view rules first so a clinic overlay pull does not race past a newer account edit.
    const fromWeb = await pullAccountRulesIfNewer();
    const fromClinic = await pullClinicOverlays();
    const rules = fromClinic || fromWeb;
    if (rules) {
      setUserRules(rules);
      await loadCoachMessage();
    }
  }, [loadCoachMessage]);

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    syncPerfStart('pull-refresh');
    try {
      await Promise.all([
        syncPerfTrackSibling('cgm/refetch', () => refetch()),
        syncPerfTrackSibling('metrics/syncWithings', () => syncWithings({ quiet: true })),
        syncPerfTrackSibling('food/loadToday', () => loadTodayFood()),
        syncPerfTrackSibling('manualTrend/load', () => loadManualTrend()),
        // Watch Off: Food Log activity kcal comes from the phone step map (HK/HC),
        // not metricsStore alone — reload it on refresh so daytime steps update.
        ...(usePhoneHealthActivity
          ? [syncPerfTrackSibling('phoneHealth/steps', () => loadHcStepTotals())]
          : []),
      ]);
      // Clinic already polls on an interval — don't block pull-refresh on it.
      if (user.role === 'patient') {
        void fulfillPendingClinicSyncRequests();
        void applyClinicOverlays();
      }
    } finally {
      setPullRefreshing(false);
      const report = syncPerfEnd();
      if (SYNC_PERF_ALERT && report) {
        const body = formatSyncPerfReport(report);
        Alert.alert('Refresh timing (ms)', body, [
          { text: 'Share / copy', onPress: () => void Share.share({ message: body }) },
          { text: 'OK' },
        ]);
      }
    }
  }, [
    refetch,
    syncWithings,
    loadTodayFood,
    loadManualTrend,
    usePhoneHealthActivity,
    loadHcStepTotals,
    user.role,
    applyClinicOverlays,
  ]);

  useEffect(() => {
    void loadTodayFood();
  }, [loadTodayFood]);

  useEffect(() => {
    void (async () => {
      try {
        const [g, t, s, langEx, unitsEx, appearanceEx, gearEx] = await AsyncStorage.multiGet([
          DASH_GLUCOSE_EXPANDED_KEY,
          DASH_TREND_EXPANDED_KEY,
          DASH_SETTINGS_CARD_EXPANDED_KEY,
          DASH_LANGUAGE_EXPANDED_KEY,
          DASH_UNITS_EXPANDED_KEY,
          DASH_APPEARANCE_EXPANDED_KEY,
          DASH_GEAR_EXPANDED_KEY,
        ]);
        if (g[1] === 'true') setGlucoseExpanded(true);
        if (t[1] === 'true') setTrendExpanded(true);
        if (s[1] === 'true') setSettingsCardExpanded(true);
        if (langEx[1] === 'true') setLanguageExpanded(true);
        if (unitsEx[1] === 'true') setUnitsExpanded(true);
        if (appearanceEx[1] === 'true') setAppearanceExpanded(true);
        if (gearEx[1] === 'true') setGearExpanded(true);
      } finally {
        setDashExpandPrefsLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!dashExpandPrefsLoaded) return;
    void AsyncStorage.setItem(DASH_GLUCOSE_EXPANDED_KEY, glucoseExpanded ? 'true' : 'false');
  }, [glucoseExpanded, dashExpandPrefsLoaded]);

  useEffect(() => {
    if (!dashExpandPrefsLoaded) return;
    void AsyncStorage.setItem(DASH_TREND_EXPANDED_KEY, trendExpanded ? 'true' : 'false');
  }, [trendExpanded, dashExpandPrefsLoaded]);

  useEffect(() => {
    if (!dashExpandPrefsLoaded) return;
    void AsyncStorage.setItem(DASH_SETTINGS_CARD_EXPANDED_KEY, settingsCardExpanded ? 'true' : 'false');
  }, [settingsCardExpanded, dashExpandPrefsLoaded]);

  /** Collapsing Profile & Settings also collapses every nested strip. */
  useEffect(() => {
    if (settingsCardExpanded) return;
    setProfileExpanded(false);
    setLanguageExpanded(false);
    setUnitsExpanded(false);
    setAppearanceExpanded(false);
    setGearExpanded(false);
    setMentorExpanded(false);
    setRulesExpanded(false);
    setMacroExpanded(false);
    setAccountExpanded(false);
    setClinicExpanded(false);
    setReportsExpanded(false);
    setBackupExpanded(false);
  }, [settingsCardExpanded]);

  useEffect(() => {
    if (!dashExpandPrefsLoaded) return;
    void AsyncStorage.setItem(DASH_LANGUAGE_EXPANDED_KEY, languageExpanded ? 'true' : 'false');
  }, [languageExpanded, dashExpandPrefsLoaded]);

  useEffect(() => {
    if (!dashExpandPrefsLoaded) return;
    void AsyncStorage.setItem(DASH_UNITS_EXPANDED_KEY, unitsExpanded ? 'true' : 'false');
  }, [unitsExpanded, dashExpandPrefsLoaded]);

  useEffect(() => {
    if (!dashExpandPrefsLoaded) return;
    void AsyncStorage.setItem(DASH_APPEARANCE_EXPANDED_KEY, appearanceExpanded ? 'true' : 'false');
  }, [appearanceExpanded, dashExpandPrefsLoaded]);

  useEffect(() => {
    if (!dashExpandPrefsLoaded) return;
    void AsyncStorage.setItem(DASH_GEAR_EXPANDED_KEY, gearExpanded ? 'true' : 'false');
  }, [gearExpanded, dashExpandPrefsLoaded]);

  useEffect(() => {
    void (async () => {
      await loadHeightAndBirthdate();
      await loadLabReports();
      await loadNutritionDirectives();
      await loadCoachMessage();
    })();
  }, [loadHeightAndBirthdate, loadLabReports, loadNutritionDirectives, loadCoachMessage]);

  useEffect(() => {
    if (user.role !== 'patient') return;
    void applyClinicOverlays();
    void maybeRunOpportunisticCloudBackup();
    // The patient's own web page cannot request a refresh the way a clinic can,
    // so the app pushes for it. Self-throttled; a no-op when the view is off.
    void pushSnapshotForWebView();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void applyClinicOverlays();
        void maybeRunOpportunisticCloudBackup();
        void pushSnapshotForWebView();
      }
    });
    const poll = setInterval(() => {
      void applyClinicOverlays();
    }, CLINIC_SYNC_POLL_MS);
    return () => {
      sub.remove();
      clearInterval(poll);
    };
  }, [user.role, applyClinicOverlays]);

  useEffect(() => {
    void checkDayClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Coach weigh-in trigger when persisted body scan advances. */
  useEffect(() => {
    if (!bodyScan?.measuredAt) return;
    void (async () => {
      const prev = await AsyncStorage.getItem(COACH_LAST_WEIGH_IN_KEY);
      await AsyncStorage.setItem(COACH_LAST_WEIGH_IN_KEY, bodyScan.measuredAt!);
      if (prev && prev !== bodyScan.measuredAt) {
        const ctx = coachContextRef.current;
        if (ctx) {
          const storedLang = await getLanguage();
          const newMsg = await triggerCoachReview('weigh-in', {
            ...ctx,
            lang: storedLang,
            event: 'weigh-in',
          });
          if (newMsg) setCoachMsg(newMsg);
        }
      }
    })();
  }, [bodyScan?.measuredAt]);

  /** Auto macro revision on new scale reading (prompt35) — keyed on measuredAt, not weight alone. */
  useEffect(() => {
    const w = bodyScan?.weightKg;
    const measuredAt = bodyScan?.measuredAt;
    if (w == null || !Number.isFinite(w) || !measuredAt) return;
    void applyAutoMacroRevision({
      trigger: 'weigh-in',
      triggerDetail: formatMass(w, unitsPrefs.mass),
      weightKg: w,
      measuredAt,
      onSaved: (t) => { setMacroTarget(t); setEffectiveMacroTarget(t); },
      onNeedsReview: async ({ proposal, source, triggerDetail }) => {
        setMacroExpanded(true);
        const he = userLanguage?.code === 'he';
        if (source === 'gemini') {
          const [rules, mentorList] = await Promise.all([getUserRules(), getMentors()]);
          setMacroWeighInHint(
            triggerDetail
              ? he
                ? `אחרי שקילה ${triggerDetail} — אשר/י את היעדים המוצעים`
                : `After weigh-in ${triggerDetail} — confirm proposed targets`
              : he
                ? 'אשר/י את היעדים המוצעים אחרי השקילה'
                : 'Confirm proposed targets after weigh-in',
          );
          setMacroWeighInSuggestion(macroSuggestionToDailyTarget(proposal, rules, mentorList));
        } else {
          setMacroWeighInHint(
            he
              ? 'לא הצלחנו לעדכן אוטומטית — מחשבים מחדש…'
              : 'Could not auto-update — recalculating…',
          );
          setMacroAnalyzeRequestId((n) => n + 1);
        }
      },
    });
  }, [bodyScan?.measuredAt, bodyScan?.weightKg, userLanguage?.code, unitsPrefs.mass]);

  /** Coach workout trigger when today's workout list grows. */
  useEffect(() => {
    if (workoutSessions.length === 0) return;
    void (async () => {
      const todayKey = localDayKeyFromMs(Date.now());
      const todayStart = dayKeyStartMs(todayKey);
      const todayMax = workoutSessions
        .filter((s) => s.startMs >= todayStart)
        .reduce((max, s) => Math.max(max, s.startMs), 0);
      if (todayMax === 0) return;

      const prevRaw = await AsyncStorage.getItem(COACH_LAST_WORKOUT_MS_KEY);
      const prev = prevRaw ? Number(prevRaw) : 0;
      const next = Math.max(prev, todayMax);
      await AsyncStorage.setItem(COACH_LAST_WORKOUT_MS_KEY, String(next));

      if (prevRaw && todayMax > prev) {
        const ctx = coachContextRef.current;
        if (ctx) {
          const storedLang = await getLanguage();
          const newMsg = await triggerCoachReview('workout', {
            ...ctx,
            lang: storedLang,
            event: 'workout',
          });
          if (newMsg) setCoachMsg(newMsg);
        }
      }
    })();
  }, [workoutSessions]);

  useEffect(() => {
    if (usePhoneHealthActivity) void loadHcStepTotals();
  }, [usePhoneHealthActivity, loadHcStepTotals]);

  /** Rebuild manual trend when store Withings history arrives/updates (scale-off merge). */
  useEffect(() => {
    if (useManualWeightTrend) void loadManualTrend();
  }, [useManualWeightTrend, loadManualTrend]);

  useEffect(() => {
    void loadSourceConfig().then((c) => {
      setSourceConfig(c);
      setSetupToggles(togglesFromSourceConfig(c));
    });
  }, []);

  useEffect(() => {
    void refreshWithingsLinkState();
  }, [refreshWithingsLinkState]);

  useEffect(() => {
    if (!profileExpanded) {
      setShowDatePickerDialog(false);
      return;
    }
    void loadSourceConfig().then((c) => {
      setSourceConfig(c);
      setSetupToggles(togglesFromSourceConfig(c));
    });
  }, [profileExpanded]);

  // Sync height field before paint whenever prefs/unit and draft disagree (iOS TextInput crash guard).
  useLayoutEffect(() => {
    const next = coerceHeightInputForUnit(heightInput, unitsPrefs.height, heightCm);
    if (next !== heightInput) setHeightInput(next);
  }, [profileExpanded, unitsPrefs.height, heightCm]);

  const handleLinkWithings = useCallback(async () => {
    setLinkError(null);
    setLinkBusy(true);
    try {
      const state = `st-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
      const authUrl = buildAuthorizationUrl(state);
      // Same string as authorize2 `redirect_uri` (default `healthings-medilab://oauth` via .env). Not AuthSession.makeRedirectUri() / not exp://.
      const result = await WebBrowser.openAuthSessionAsync(authUrl, CONFIG.withingsCallbackUrl, {
        preferEphemeralSession: false,
        showInRecents: false,
        createTask: false,
      });
      if (result.type === 'success' && result.url) {
        await handleOAuthCallback(result.url);
        await refreshWithingsLinkState();
        // First link: deep history pull (HR 128d / workouts 128d).
        await syncWithings({ deep: true });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withings link failed.';
      setLinkError(message);
    } finally {
      setLinkBusy(false);
    }
  }, [syncWithings, refreshWithingsLinkState]);

  const runWithingsSync = useCallback(
    async (deep: boolean) => {
      setLinkBusy(true);
      try {
        await syncWithings(deep ? { deep: true } : undefined);
        await loadHcStepTotals();
      } finally {
        setLinkBusy(false);
      }
    },
    [syncWithings, loadHcStepTotals],
  );

  /** Linked: sheet with Normal / Deep / Re-link (Alert is limited to 3 buttons on Android). */
  const handleWithingsAccountPress = useCallback(() => {
    if (!withingsLinked) {
      void handleLinkWithings();
      return;
    }
    setWithingsMenuVisible(true);
  }, [withingsLinked, handleLinkWithings]);

  const closeWithingsMenu = useCallback(() => setWithingsMenuVisible(false), []);

  const onWithingsMenuNormal = useCallback(() => {
    setWithingsMenuVisible(false);
    void runWithingsSync(false);
  }, [runWithingsSync]);

  const onWithingsMenuDeep = useCallback(() => {
    setWithingsMenuVisible(false);
    void runWithingsSync(true);
  }, [runWithingsSync]);

  const onWithingsMenuRelink = useCallback(() => {
    setWithingsMenuVisible(false);
    void handleLinkWithings();
  }, [handleLinkWithings]);

  const handleSync = async () => {
    const [, result] = await Promise.all([syncWithings(), refetch()]);
    if (!result) {
      if (dataSource === 'health-connect') {
        Alert.alert(
          'Health Connect',
          'Healthings needs permission to read Blood glucose. Tap Open settings → App permissions → Healthings → allow Blood glucose.',
          [
            { text: 'Open settings', onPress: () => openHealthConnectSettings() },
            { text: 'Cancel', style: 'cancel' },
          ],
        );
      } else if (dataSource === 'healthkit') {
        Alert.alert(
          'Apple Health',
          'Allow Healthings to read Blood Glucose in Settings → Health → Data Access & Devices. Also turn on sharing from CareSens Air → Apple Health.',
        );
      }
      return;
    }
    await awsDataService.persistData({
      syncedAt: new Date().toISOString(),
      glucose: result.metrics.glucose,
      steps: [],
      heartRate: [],
      efficiencyScore: result.efficiencyScore,
      insight: result.insight,
      activityZones: result.activityZones,
    });
  };

  const handleImportCareSensCsv = useCallback(async () => {
    setImportMessage(null);
    setImportBusy(true);
    try {
      const pick = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (pick.canceled) return;
      const asset = pick.assets?.[0];
      const uri = asset?.uri;
      if (!uri) {
        setImportMessage('No file was selected.');
        return;
      }
      const expectedBytes =
        typeof asset.size === 'number' && asset.size > 0 ? asset.size : null;
      const read = await readCareSensCsvText(
        uri,
        (u, opts) => FileSystem.readAsStringAsync(u, opts),
        async (u) => {
          const info = await FileSystem.getInfoAsync(u);
          return {
            exists: info.exists,
            size: info.exists && 'size' in info ? info.size : undefined,
          };
        },
        expectedBytes,
        async (u) => {
          const res = await fetch(u);
          return res.text();
        },
      );
      if (read.truncated) {
        throw new Error(
          `CSV read was truncated (${read.bytesRead} of ~${read.expectedBytes} bytes). Re-copy the full CareSens export to the phone and import again.`,
        );
      }
      const { points, sessionStarts, firstTimestamp, lastTimestamp } =
        parseCareSensAirExportWithSessions(read.text);
      assertCareSensCsvMatchesExportName(asset.name, lastTimestamp, read.bytesRead);
      const importResult = await applyImportedGlucose(points, sessionStarts);
      const range = formatCareSensImportRange(firstTimestamp, lastTimestamp);
      setImportMessage(
        `Imported ${importResult.csvCount} CSV (+${importResult.newPointsAdded} new) + ${importResult.hcCount} HC → ${importResult.chartCount} on chart (${importResult.sessionCount} sensor session${importResult.sessionCount === 1 ? '' : 's'}; ${range}).`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not import CSV.';
      setImportMessage(message);
    } finally {
      setImportBusy(false);
    }
  }, [applyImportedGlucose]);

  const handleExportBackup = useCallback(async () => {
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      await exportLocalBackup();
      setBackupMessage('Backup exported.');
      Alert.alert('Backup', 'Backup saved to the folder you picked.');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not export backup.';
      setBackupMessage(message);
      Alert.alert('Backup', message);
    } finally {
      setBackupBusy(false);
    }
  }, []);

  const refreshAfterBackupRestore = useCallback(async () => {
    await Promise.all([
      refetch(),
      syncWithings(),
      loadTodayFood(),
      loadLabReports(),
      loadNutritionDirectives(),
      loadHeightAndBirthdate(),
      loadCoachMessage(),
      loadManualTrend(),
    ]);
  }, [
    loadCoachMessage,
    loadHeightAndBirthdate,
    loadLabReports,
    loadManualTrend,
    loadNutritionDirectives,
    loadTodayFood,
    refetch,
    syncWithings,
  ]);

  const handleImportBackup = useCallback(async () => {
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      const result = await importLocalBackup();
      if (result.keysRestored === 0 && !result.tokensRestored) {
        setBackupMessage('Import cancelled.');
        return;
      }

      await refreshAfterBackupRestore();

      const summary = `Restored ${result.keysRestored} keys • +${result.mealsAdded} meals • +${result.chatMessagesAdded} chat messages • +${result.glucosePointsMerged} glucose points${result.tokensRestored ? ' • Withings link restored' : ''}`;
      setBackupMessage(summary);
      Alert.alert('Backup imported', summary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not import backup.';
      setBackupMessage(message);
      Alert.alert('Backup', message);
    } finally {
      setBackupBusy(false);
    }
  }, [refreshAfterBackupRestore]);

  const handleShareVisitReport = useCallback(
    async (dayCount: VisitReportDayCount) => {
      setVisitReportBusy(true);
      try {
        const result = await shareVisitReport({ dayCount, lang: userLanguage });
        if (result.ok) {
          Alert.alert(visitReportUi.doneTitle, visitReportUi.doneMessage);
        } else if (result.error) {
          Alert.alert(visitReportUi.errorTitle, result.error);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Could not build visit report.';
        Alert.alert(visitReportUi.errorTitle, message);
      } finally {
        setVisitReportBusy(false);
      }
    },
    [userLanguage, visitReportUi],
  );

  const demoNotice = demoNoticeCopy(dataSource);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoid}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: 32 + navBarBottomInset(insets.bottom) }]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={false}
            onRefresh={handlePullRefresh}
            colors={['transparent']}
            tintColor="transparent"
          />
        }
      >
        <View
          style={[styles.brandHeader, { height: brandHeaderHeight, marginTop: 8 }]}
          accessibilityRole="header"
        >
          <Image
            source={isDark ? BRAND_LOGO_DARK : BRAND_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="HEALTHINGS.AI"
          />
          <Pressable
            style={styles.headerRefreshBtn}
            onPress={() => void handlePullRefresh()}
            disabled={pullRefreshing}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={metabolicStripCopy.refreshMyData}
          >
            {pullRefreshing ? (
              <ActivityIndicator size="small" color={colors.textSecondary} />
            ) : (
              <DashIcon icon={ActionIcons.refresh} size={20} color={colors.textSecondary} />
            )}
          </Pressable>
        </View>

        {demoNotice ? (
          <View style={[styles.notice, { marginTop: -noticeOverlapUnderLogo }]}>
            <Text style={styles.noticeText}>{demoNotice}</Text>
          </View>
        ) : null}

        {/* AI chat entry — always visible; mentors + optional action progress */}
        <Pressable
          style={styles.nudgeStrip}
          onPress={() => setChatVisible(true)}
          accessibilityRole="button"
          accessibilityLabel={
            coachMsg
              ? aiChatOpenLabel(userLanguage.code, {
                  actionDone: coachMsg.actionItems.filter((i) => i.done).length,
                  actionTotal: coachMsg.actionItems.length,
                })
              : aiChatOpenLabel(userLanguage.code)
          }
        >
          <ActiveMentorIcons
            mentors={mentors}
            size={20}
            color={colors.chromeIcon}
            style={styles.nudgeStripIcons}
          />
          <View style={styles.nudgeStripTextCol}>
            <Text
              style={[
                styles.nudgeStripTitle,
                (userLanguage.code === 'he' || userLanguage.code === 'ar') &&
                  styles.nudgeStripTitleRtl,
              ]}
            >
              {aiChatTitle(userLanguage.code)}
            </Text>
            <Text style={styles.nudgeStripSub} numberOfLines={1} ellipsizeMode="tail">
              {coachMsg
                ? aiChatActionSummary(
                    userLanguage.code,
                    coachMsg.actionItems.filter((i) => i.done).length,
                    coachMsg.actionItems.length,
                  )
                : aiChatAskPrompt(userLanguage.code)}
            </Text>
          </View>
          <Text style={styles.nudgeStripChevron}>›</Text>
        </Pressable>

        {/* App Help — product Q&A (not mentor chat); near AI entry for discoverability */}
        <View style={[styles.groupCard, cardShadow, !helpExpanded && styles.groupCardCollapsed]}>
          <HelpStrip
            expanded={helpExpanded}
            onToggleExpand={() => setHelpExpanded((e) => !e)}
            lang={userLanguage}
          />
        </View>

        <View style={[styles.bodyScanCard, cardShadow]}>
          {showBodySourcesHeader || bodyScanLoading ? (
          <View style={[styles.bodyScanHeader, !showBodySourcesHeader && bodyScanLoading && styles.bodyScanHeaderManualOnly]}>
            {showBodySourcesHeader ? (
              <>
                <View style={styles.bodySourcesCluster}>
                  {showWithingsBodyHeader ? (
                    <WithingsDevicesMark
                      showScale={
                        setupToggles?.withingsScale === true ||
                        (setupToggles == null && sourceConfig?.bodyComposition === 'withings')
                      }
                      showWatch={
                        setupToggles?.withingsWatch === true ||
                        (setupToggles == null && sourceConfig?.activity === 'withings')
                      }
                    />
                  ) : null}
                  {showCgmBodyMark ? <CgmDevicesMark /> : null}
                </View>
                {showWithingsBodyHeader ? (
                  <>
                    <View style={styles.bodyHeaderSpacer} />
                    <View style={styles.bodyHeaderActions}>
                      <Text style={styles.withingsActionsLabel} numberOfLines={1}>
                        Withings
                      </Text>
                      <View style={styles.bodyHeaderActionsGroup}>
                        <View
                          style={[
                            styles.withingsStatusBadge,
                            withingsLinked ? styles.withingsStatusBadgeOn : styles.withingsStatusBadgeOff,
                          ]}
                          accessible
                          accessibilityRole="text"
                          accessibilityLabel={
                            withingsLinked
                              ? 'Withings connected, signed in'
                              : 'Withings disconnected, signed out'
                          }
                        >
                          {withingsLinked ? (
                            <Check
                              size={16}
                              color={isDark ? colors.accentGreen : '#2E7D32'}
                              strokeWidth={2.75}
                              accessible={false}
                            />
                          ) : (
                            <X
                              size={16}
                              color={isDark ? colors.accentRed : '#C62828'}
                              strokeWidth={2.75}
                              accessible={false}
                            />
                          )}
                        </View>
                        <Pressable
                          accessibilityRole="button"
                          accessibilityLabel={
                            withingsLinked
                              ? 'Withings sync options or re-link account'
                              : 'Link Withings account'
                          }
                          style={[
                            styles.withingsLinkButtonCompact,
                            (linkBusy || bodyScanLoading) && styles.withingsLinkButtonDisabled,
                          ]}
                          onPress={handleWithingsAccountPress}
                          disabled={linkBusy || bodyScanLoading}
                        >
                          {linkBusy ? (
                            <ActivityIndicator color={colors.accentBlue} size="small" />
                          ) : (
                            <Text style={styles.withingsLinkButtonTextCompact}>
                              {withingsLinked ? 'Re-link' : 'Link'}
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    </View>
                  </>
                ) : null}
              </>
            ) : null}
            {bodyScanLoading ? <ActivityIndicator color={colors.accentBlue} style={styles.bodyScanHeaderSpinner} /> : null}
          </View>
          ) : null}

          {!showWithingsBodyHeader && linkError ? <Text style={styles.linkErrorText}>{linkError}</Text> : null}

          {bodyScanError ? <Text style={styles.bodyScanErrorText}>{bodyScanError}</Text> : null}

          {displayBodyScan && !bodyScanLoading ? (
            <>
              <View style={[styles.bodyScanRow, styles.bodyScanTripleRow]}>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={bodyMetricsCopy.a11yWeight(
                    formatKg(displayBodyScan.metrics.weightKg, 1, unitsPrefs.mass),
                  )}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    {bodyMetricsCopy.weight}
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(displayBodyScan.metrics.weightKg, 1, unitsPrefs.mass)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={bodyMetricsCopy.a11yMuscle(
                    formatKg(displayBodyScan.metrics.muscleMassKg, 1, unitsPrefs.mass),
                  )}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    {bodyMetricsCopy.muscle}
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(displayBodyScan.metrics.muscleMassKg, 1, unitsPrefs.mass)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={bodyMetricsCopy.a11yFat(
                    formatKg(displayBodyScan.metrics.fatMassKg, 1, unitsPrefs.mass),
                  )}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    {bodyMetricsCopy.fat}
                    {displayBodyScan.provenance === 'manual' && displayBodyScan.fatEstimated
                      ? ` ${bodyMetricsCopy.fatEst}`
                      : ''}
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(displayBodyScan.metrics.fatMassKg, 1, unitsPrefs.mass)}
                  </Text>
                </View>
              </View>

              {displayBodyScan.provenance === 'manual' ? (
                <Text style={styles.bodyScanProvenance}>
                  Manual weigh-in
                  {displayBodyScan.fatEstimated ? ' · fat % estimated from profile' : ' · fat % entered by you'}
                </Text>
              ) : null}

              {displayBodyScan.metrics.bmrKcalDay != null && Number.isFinite(displayBodyScan.metrics.bmrKcalDay) ? (
                <View
                  style={styles.bodyScanBmrRow}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`BMR ${formatEnergy(displayBodyScan.metrics.bmrKcalDay, unitsPrefs.energy)} per day${
                    formatMeasuredAt(displayBodyScan.metrics.measuredAt, userLanguage.code)
                      ? `, measured ${formatMeasuredAt(displayBodyScan.metrics.measuredAt, userLanguage.code)}`
                      : ''
                  }`}
                >
                  <View style={styles.bodyScanBmrLeft}>
                    <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                      BMR
                    </Text>
                    <Text style={styles.bodyScanBmrValue} accessible={false}>
                      {formatEnergy(displayBodyScan.metrics.bmrKcalDay, unitsPrefs.energy)}
                    </Text>
                  </View>
                  {formatMeasuredAt(displayBodyScan.metrics.measuredAt, userLanguage.code) ? (
                    <Text style={styles.bodyScanBmrDate} accessible={false}>
                      {formatMeasuredAt(displayBodyScan.metrics.measuredAt, userLanguage.code)}
                    </Text>
                  ) : null}
                </View>
              ) : formatMeasuredAt(displayBodyScan.metrics.measuredAt, userLanguage.code) ? (
                <Text style={styles.bodyScanMeasured}>
                  Last measurement · {formatMeasuredAt(displayBodyScan.metrics.measuredAt, userLanguage.code)}
                </Text>
              ) : null}

              {hrSyncDiagLine ? (
                <Text style={styles.hrSyncDiagText} selectable>
                  {hrSyncDiagLine}
                </Text>
              ) : null}

            </>
          ) : !bodyScanLoading && !displayBodyScan && !bodyScanError ? (
            <Text style={styles.bodyScanEmpty}>No body scan data yet.</Text>
          ) : null}
        </View>

        {/* Food log — above charts so users find it without scrolling past glucose/trend */}
        <FoodMacroStrip
          ref={foodMacroStripRef}
          dayKey={todayDayKey}
          onAddMeal={(dayKey) => {
            setFoodEditEntry(undefined);
            setFoodInitialTimestamp(defaultMealTimestampForDay(dayKey));
            setFoodModalVisible(true);
          }}
          onEditMeal={handleEditMeal}
          refreshKey={foodRefreshKey}
          burnKcalByDay={burnKcalByDay}
          burnPartsByDay={burnPartsByDay}
          onImported={() => { setFoodRefreshKey((k) => k + 1); loadTodayFood(); }}
          macroTarget={macroTarget}
          unitsPrefs={unitsPrefs}
          lang={userLanguage}
        />

        {metabolicHeader.show ? (
          <View style={styles.glucoseHistorySection}>
            <View style={styles.chartBleed}>
              <View
                style={[
                  styles.chartCardBleed,
                  !glucoseExpanded && styles.chartCardBleedCollapsed,
                  cardShadow,
                ]}
              >
                <DashboardCollapseHeader
                  title={metabolicHeader.title}
                  subtitle={metabolicHeader.compactSub}
                  expanded={glucoseExpanded}
                  onToggle={() => setGlucoseExpanded((v) => !v)}
                  titleRtl={userLanguage.code === 'he' || userLanguage.code === 'ar'}
                  collapseLabel={metabolicHeader.a11yCollapse}
                  expandLabel={metabolicHeader.a11yExpand}
                  icon={StripIcons.glucose}
                />
                {glucoseExpanded ? (
                  <MetabolicChart
                    glucose={
                      isLiveGlucoseSource(sourceConfig?.glucose ?? 'none') ? glucoseData : []
                    }
                    heartRate={withingsHeartRate}
                    activityZones={activityZones}
                    calorieBurns={withingsCalories}
                    workoutSessions={workoutSessions}
                    bmrKcalDay={effectiveBodyScan?.bmrKcalDay}
                    foodEntries={chartMeals}
                    glucoseDisplayUnit={unitsPrefs.glucose}
                    energyDisplayUnit={unitsPrefs.energy}
                    langCode={userLanguage.code}
                  />
                ) : null}
              </View>
            </View>
          </View>
        ) : null}

        <View style={styles.trendBleed}>
          <View
            style={[
              styles.trendCardBleed,
              !trendExpanded && styles.trendCardBleedCollapsed,
              cardShadow,
            ]}
          >
            <DashboardCollapseHeader
              title={metabolicStripCopy.trendTitle}
              subtitle={
                trendCompactSummary
                  ? `${trendCompactSummary.weightLabel}${
                      trendCompactSummary.deltaLabel
                        ? ` · ${trendCompactSummary.deltaLabel}`
                        : ''
                    }`
                  : trendChartLoading
                    ? metabolicStripCopy.loading
                    : metabolicStripCopy.tapToOpenCharts
              }
              expanded={trendExpanded}
              onToggle={() => setTrendExpanded((v) => !v)}
              titleRtl={userLanguage.code === 'he' || userLanguage.code === 'ar'}
              collapseLabel={metabolicStripCopy.a11yCollapseTrend}
              expandLabel={metabolicStripCopy.a11yExpandTrend}
              icon={StripIcons.trend}
            />
            {trendExpanded ? (
              <>
                {trendError && !useManualWeightTrend ? (
                  <Text style={styles.trendErrorText}>{trendError}</Text>
                ) : null}
                {trendChartLoading && !visibleTrend ? (
                  <View style={styles.trendLoadingOnly}>
                    <ActivityIndicator color={colors.accentBlue} />
                    <Text style={styles.trendLoadingLabel}>Loading trend analysis…</Text>
                  </View>
                ) : null}
                {visibleTrend ? (
                  <MetabolicTrendChart7d
                    days={visibleTrend.days}
                    periodAnchor={
                      useManualWeightTrend && !trendHasScaleComposition
                        ? null
                        : visibleTrend.anchor
                    }
                    periodDays={trendPeriodDays}
                    periodOptions={TREND_PERIOD_DAY_OPTIONS}
                    availableDays={trendAvailableDays}
                    onPeriodChange={setTrendPeriodDays}
                    weightOnly={useManualWeightTrend && !trendHasScaleComposition}
                    weighInDayCount={manualWeighInDayCount}
                    hideTitle
                    massUnit={unitsPrefs.mass}
                    langCode={userLanguage.code}
                  />
                ) : null}
                {hasEnergyHistory && visibleTrend ? (
                  <View style={styles.bmrInsideTrend}>
                    <BmrHistoryChart7d
                      days={visibleTrend.days}
                      loading={trendChartLoading}
                      eatenKcalByDay={eatenKcalByDay}
                      energyUnit={unitsPrefs.energy}
                      langCode={userLanguage.code}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>

        {dataSource === 'health-connect' && error ? (
          <Pressable
            style={styles.hcErrorBanner}
            onPress={() => openHealthConnectSettings()}
            accessibilityRole="button"
            accessibilityLabel="Open Health Connect settings to allow blood glucose read access"
          >
            <Text style={styles.hcErrorBannerText}>{error}</Text>
            <Text style={styles.hcErrorBannerAction}>Open Health Connect settings →</Text>
          </Pressable>
        ) : null}

        {dataSource === 'healthkit' && error ? (
          <View style={styles.hcErrorBanner}>
            <Text style={styles.hcErrorBannerText}>{error}</Text>
            <Text style={styles.hcErrorBannerAction}>
              Settings → Health → Data Access → Healthings → Blood Glucose
            </Text>
          </View>
        ) : null}

        {/* My Profile + My Targets — single grouped card */}
        <View style={[styles.groupCard, cardShadow, !settingsCardExpanded && styles.groupCardCollapsed]}>
          <DashboardCollapseHeader
            title={metabolicStripCopy.profileSettingsTitle}
            subtitle={settingsCardSummary}
            expanded={settingsCardExpanded}
            onToggle={() => setSettingsCardExpanded((v) => !v)}
            titleRtl={userLanguage.code === 'he' || userLanguage.code === 'ar'}
            collapseLabel={metabolicStripCopy.a11yCollapseProfileSettings}
            expandLabel={metabolicStripCopy.a11yExpandProfileSettings}
            subtitleNumberOfLines={2}
            icon={StripIcons.profile}
          />
          {settingsCardExpanded ? (
          <>
          <DashboardCollapseHeader
            title={profileStripCopy.myProfile}
            subtitle={
              [
                profileNameLabel || null,
                userGender === 'male'
                  ? metabolicStripCopy.genderMale
                  : userGender === 'female'
                    ? metabolicStripCopy.genderFemale
                    : userGender === 'other'
                      ? metabolicStripCopy.genderOther
                      : null,
                heightCm
                  ? userLanguage.code === 'he' || userLanguage.code === 'ar'
                    ? unitsPrefs.height === 'cm'
                      ? String(Math.round(heightCm))
                      : formatHeight(heightCm, unitsPrefs.height)
                    : formatHeight(heightCm, unitsPrefs.height)
                  : null,
                birthdatePicker != null && userAge != null
                  ? userLanguage.code === 'he' || userLanguage.code === 'ar'
                    ? String(userAge)
                    : metabolicStripCopy.ageYears(userAge)
                  : null,
                !profileNameLabel
                  ? `${yourSetupCopy.firstName} · ${yourSetupCopy.lastName}`
                  : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Tap to set name, gender, height & birthdate'
            }
            expanded={profileExpanded}
            onToggle={() => {
              // Coerce before expand so the height TextInput never mounts with ft'in" under cm prefs (iOS crash).
              if (!profileExpanded) {
                setHeightInput(coerceHeightInputForUnit(heightInput, unitsPrefs.height, heightCm));
                setFirstNameInput(user.firstName?.trim() || '');
                setLastNameInput(user.lastName?.trim() || '');
                void fetchCurrentUser().then((me) => {
                  if (!me) return;
                  setFirstNameInput(me.firstName?.trim() || '');
                  setLastNameInput(me.lastName?.trim() || '');
                  setProfileNameLabel(
                    [me.firstName, me.lastName].filter(Boolean).join(' ').trim(),
                  );
                });
              }
              setProfileExpanded((e) => !e);
            }}
            titleRtl={userLanguage.code === 'he' || userLanguage.code === 'ar'}
            collapseLabel="Collapse my profile"
            expandLabel="Expand my profile"
            subtitleNumberOfLines={2}
          />

          {profileExpanded && (
            <DebugErrorBoundary label="My Profile">
            <View style={styles.profileBody}>
              <Text style={styles.birthdateSectionTitle}>{yourSetupCopy.firstName}</Text>
              <TextInput
                style={styles.heightInput}
                value={firstNameInput}
                onChangeText={setFirstNameInput}
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={colors.textSecondary}
              />
              <Text style={styles.birthdateSectionTitle}>{yourSetupCopy.lastName}</Text>
              <TextInput
                style={styles.heightInput}
                value={lastNameInput}
                onChangeText={setLastNameInput}
                autoCapitalize="words"
                autoCorrect={false}
                placeholderTextColor={colors.textSecondary}
              />

              <Text style={styles.birthdateSectionTitle}>{yourSetupCopy.gender}</Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as Gender[]).map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.genderBtn, genderPicker === g && styles.genderBtnSelected]}
                    onPress={() => setGenderPicker(g)}
                  >
                    <Text style={[styles.genderBtnText, genderPicker === g && styles.genderBtnTextSelected]}>
                      {g === 'male'
                        ? yourSetupCopy.male
                        : g === 'female'
                          ? yourSetupCopy.female
                          : yourSetupCopy.other}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Text style={styles.birthdateSectionTitle}>{yourSetupCopy.height}</Text>
              <View style={styles.heightRow}>
                <TextInput
                  style={styles.heightInput}
                  value={coerceHeightInputForUnit(heightInput, unitsPrefs.height, heightCm)}
                  onChangeText={setHeightInput}
                  keyboardType="default"
                  placeholder={unitsPrefs.height === 'ftin' ? "e.g. 5'9\"" : 'e.g. 175'}
                  placeholderTextColor={colors.textSecondary}
                />
                <Text style={styles.heightUnit}>{unitsPrefs.height === 'ftin' ? "ft'in\"" : 'cm'}</Text>
              </View>

              <Text style={styles.birthdateSectionTitle}>{yourSetupCopy.birthDate}</Text>
              <Pressable
                style={styles.datePickerBtn}
                onPress={() => setShowDatePickerDialog(true)}
              >
                <Text style={styles.datePickerBtnText}>
                  {formatLocalizedDate(birthdatePicker, userLanguage.code, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </Text>
                <Text style={styles.datePickerBtnIcon}>📅</Text>
              </Pressable>
              {userAge != null && (
                <Text style={styles.birthdateAge}>{yourSetupCopy.ageYears(userAge)}</Text>
              )}

              {manualBodyScaleActive ? (
                manualBodyProfileReady ? (
                  <ManualBodyProfileSection
                    ref={manualBodySectionRef}
                    effectiveWeightKg={effectiveBodyScan?.weightKg ?? null}
                    manualBodySnap={manualBodySnap}
                    userGender={manualBodyProfile.gender!}
                    heightCm={manualBodyProfile.heightCm!}
                    userAge={manualBodyProfile.age!}
                    massUnit={unitsPrefs.mass}
                    energyUnit={unitsPrefs.energy}
                    langCode={userLanguage.code}
                    onSaved={(snap) => {
                      setManualBodySnap(snap);
                      // Don't block Save on trend rebuild (Android HC step fetch is slow).
                      void loadManualTrend(snap);
                    }}
                  />
                ) : (
                  <View style={styles.manualBodyProfileGate}>
                    <Text style={styles.birthdateSectionTitle}>Body</Text>
                    <Text style={styles.manualBodyProfileGateHint}>
                      Set gender, height, and birth date above, then tap Save to log weight and body fat.
                    </Text>
                  </View>
                )
              ) : null}

              <Text style={styles.birthdateSaveHint}>
                {manualBodyScaleActive
                  ? yourSetupCopy.saveHintWithBody
                  : yourSetupCopy.saveHint}
              </Text>
              <Pressable
                style={styles.birthdateSaveBtn}
                onPress={async () => {
                  const iso = birthdatePicker.toISOString().split('T')[0];
                  const cm = parseHeightInputToCm(heightInput, unitsPrefs.height);
                  try {
                    const saved = await updatePatientNames(firstNameInput, lastNameInput);
                    setProfileNameLabel(
                      [saved.firstName, saved.lastName].filter(Boolean).join(' ').trim(),
                    );
                  } catch (err) {
                    Alert.alert(
                      'Name',
                      err instanceof Error ? err.message : 'Could not save your name',
                    );
                    return;
                  }
                  await Promise.all([
                    setBirthdate(iso),
                    setGender(genderPicker),
                    ...(cm != null && cm > 0 ? [saveHeightCm(cm)] : []),
                  ]);
                  if (cm != null && cm > 0) setHeightCm(cm);
                  setUserGender(genderPicker);

                  if (manualBodyScaleActive && manualBodyProfileReady) {
                    const ageEff = computeAge(iso);
                    const heightEff = cm != null && cm > 0 ? cm : manualBodyProfile.heightCm!;
                    const bodyResult = await manualBodySectionRef.current?.saveBody({
                      gender: genderPicker,
                      heightCm: heightEff,
                      ageYears: ageEff,
                    });
                    if (bodyResult === 'error') return;
                  }

                  setProfileExpanded(false);
                }}
              >
                <Text style={styles.birthdateSaveBtnText}>{yourSetupCopy.save}</Text>
              </Pressable>
            </View>
            </DebugErrorBoundary>
          )}

          <Modal
            visible={showDatePickerDialog && Platform.OS === 'ios'}
            transparent
            animationType="fade"
            onRequestClose={() => setShowDatePickerDialog(false)}
          >
            <View style={styles.heightModalBackdrop}>
              <View style={styles.heightModalCard}>
                <DateTimePicker
                  value={birthdatePicker}
                  mode="date"
                  display="spinner"
                  maximumDate={new Date()}
                  minimumDate={new Date(1920, 0, 1)}
                  onChange={(_e, date) => {
                    if (date) setBirthdatePicker(date);
                  }}
                />
                <Pressable
                  style={styles.birthdateSaveBtn}
                  onPress={() => setShowDatePickerDialog(false)}
                >
                  <Text style={styles.birthdateSaveBtnText}>Done</Text>
                </Pressable>
              </View>
            </View>
          </Modal>
          {showDatePickerDialog && Platform.OS === 'android' ? (
            <DateTimePicker
              value={birthdatePicker}
              mode="date"
              display="default"
              maximumDate={new Date()}
              minimumDate={new Date(1920, 0, 1)}
              onChange={(_e, date) => {
                setShowDatePickerDialog(false);
                if (date) setBirthdatePicker(date);
              }}
            />
          ) : null}

          <View style={styles.groupDivider} />

          <LanguageStrip
            expanded={languageExpanded}
            onToggleExpand={() => setLanguageExpanded((e) => !e)}
            language={userLanguage}
            onLanguageChanged={setUserLanguage}
            onAfterLanguagePersist={async () => {
              await refreshCoachForLanguage();
            }}
          />

          <View style={styles.groupDivider} />

          <Pressable
            style={styles.profileHelpLink}
            onPress={() => {
              setSettingsCardExpanded(false);
              setHelpExpanded(true);
            }}
            accessibilityRole="button"
            accessibilityLabel={helpStripCopy.openFromProfile}
          >
            <Text style={styles.profileHelpLinkText}>
              {helpStripCopy.openFromProfile}
            </Text>
            <Text style={styles.profileHelpLinkChevron}>›</Text>
          </Pressable>

          <View style={styles.groupDivider} />

          <UnitsStrip
            expanded={unitsExpanded}
            onToggleExpand={() => setUnitsExpanded((e) => !e)}
            prefs={unitsPrefs}
            lang={userLanguage}
            onChange={(next) => {
              if (next.height !== unitsPrefs.height) {
                setHeightInput(
                  coerceHeightInputForUnit(heightInput, next.height, heightCm),
                );
              }
              setUnitsPrefs(next);
              void saveUnitsPrefs(next);
            }}
          />

          <View style={styles.groupDivider} />

          <AppearanceStrip
            expanded={appearanceExpanded}
            onToggleExpand={() => setAppearanceExpanded((e) => !e)}
            lang={userLanguage}
          />

          <View style={styles.groupDivider} />

          <GearSetupStrip
            expanded={gearExpanded}
            onToggleExpand={() => setGearExpanded((e) => !e)}
            lang={userLanguage}
            setupToggles={setupToggles}
            onPersistToggles={(next) => void persistSetupToggles(next)}
            withingsLinked={withingsLinked}
            linkBusy={linkBusy}
            linkError={linkError}
            showLinkError={manualBodyScaleActive && !!setupToggles?.withingsWatch}
            onWithingsAccountPress={handleWithingsAccountPress}
            onPhoneHealthPermissionGranted={() => {
              void syncWithings().then(() => loadHcStepTotals(false));
            }}
            onPhoneHealthSync={async (deep): Promise<PhoneHealthSyncSummary> => {
              const store = await syncWithings(deep ? { deep: true } : undefined);
              const stepMap = (await loadHcStepTotals(deep)) ?? new Map<string, number>();
              if (deep) {
                await loadManualTrend(undefined, { deepSteps: true });
              }
              const lookback = deep
                ? PHONE_HEALTH_DEEP_LOOKBACK_DAYS
                : PHONE_HEALTH_SHALLOW_LOOKBACK_DAYS;
              let stepDays = 0;
              for (const n of stepMap.values()) {
                if (n > 0) stepDays += 1;
              }
              const activityDays = store.bodyTrendDays.filter(
                (d) => d.activityKcalDay != null && d.activityKcalDay > 0,
              ).length;
              return {
                deep,
                lookbackDays: lookback,
                stepDays,
                activityDays,
                hrSamples: store.heartRate.length,
                workouts: store.workouts.length,
              };
            }}
            onQuickStartAgain={() => {
              void clearOnboardingCompletedAt().then(() => setQuickStartVisible(true));
            }}
            careSensImportBusy={importBusy}
            careSensImportMessage={importMessage}
            onCareSensImport={() => void handleImportCareSensCsv()}
          />

          <View style={styles.groupDivider} />

          <WeightTargetStrip
            weightKg={effectiveBodyScan?.weightKg ?? null}
            fatPct={fatPct}
            muscleMass_kg={effectiveBodyScan?.muscleMassKg ?? null}
            bmr_kcal={effectiveBodyScan?.bmrKcalDay ?? null}
            heightCm={heightCm}
            age={userAge}
            gender={userGender}
            weeklyWeightChange_kg={weeklyWeightChange_kg}
            lang={userLanguage}
            hideWithingsScalePrompt={manualBodyScaleActive}
            massUnit={unitsPrefs.mass}
          />

          <View style={styles.groupDivider} />

          <MentorStrip
            mentors={mentors}
            onChanged={async (m) => { setMentorsState(m); await saveMentors(m); }}
            expanded={mentorExpanded}
            onToggleExpand={() => setMentorExpanded((e) => !e)}
            lang={userLanguage}
            mentorGender={userMentorGender ?? mentorGenderPicker}
            onMentorGenderChange={(g) => {
              setMentorGenderPicker(g);
              setUserMentorGender(g);
            }}
            userGender={userGender}
          />

          <View style={styles.groupDivider} />

          <RulesStrip
            userRules={userRules}
            mentors={mentors}
            onSaved={setUserRules}
            expanded={rulesExpanded}
            onToggleExpand={() => setRulesExpanded((e) => !e)}
            lang={userLanguage}
          />

          <View style={styles.groupDivider} />

          <MacroTargetStrip
            actualProtein_g={todayActualMacros.protein_g}
            actualFat_g={todayActualMacros.fat_g}
            actualCarb_g={todayActualMacros.carb_g}
            actualFiber_g={todayActualMacros.fiber_g}
            actualKcal={todayActualMacros.kcal}
            weightKg={effectiveBodyScan?.weightKg ?? null}
            fatMassKg={effectiveBodyScan?.fatMassKg ?? null}
            muscleMass_kg={effectiveBodyScan?.muscleMassKg ?? null}
            bmr_kcal={effectiveBodyScan?.bmrKcalDay ?? null}
            estimatedBurn_kcal={todayEstimatedBurn}
            heightCm={heightCm}
            age={userAge}
            gender={userGender}
            bodyTarget={bodyTargetForMacros}
            userRules={userRules}
            mentors={mentors}
            savedTarget={macroTarget}
            onSaved={(t) => { setMacroTarget(t ?? null); setEffectiveMacroTarget(t ?? null); }}
            weighInSuggestion={macroWeighInSuggestion}
            weighInSuggestionHint={macroWeighInHint}
            onWeighInSuggestionConsumed={() => {
              setMacroWeighInSuggestion(null);
              setMacroWeighInHint(null);
            }}
            analyzeRequestId={macroAnalyzeRequestId}
            expanded={macroExpanded}
            onToggleExpand={() => setMacroExpanded((e) => !e)}
            lang={userLanguage}
            unitsPrefs={unitsPrefs}
          />

          <View style={styles.groupDivider} />

          <AccountStrip
            user={user}
            expanded={accountExpanded}
            onToggleExpand={() => setAccountExpanded((e) => !e)}
            onSignedOut={onSignedOut}
            onDataRestored={refreshAfterBackupRestore}
            lang={userLanguage}
          />

          <View style={styles.groupDivider} />
          <ClinicLinkStrip
            user={user}
            expanded={clinicExpanded}
            onToggleExpand={() => setClinicExpanded((e) => !e)}
            lang={userLanguage}
          />

          <View style={styles.groupDivider} />
          <ReportsStrip
            expanded={reportsExpanded}
            onToggleExpand={() => setReportsExpanded((e) => !e)}
            busy={visitReportBusy}
            visitReportUi={visitReportUi}
            onShareVisitReport={(days) => void handleShareVisitReport(days)}
            lang={userLanguage}
          />

          <View style={styles.groupDivider} />
          <LocalBackupStrip
            expanded={backupExpanded}
            onToggleExpand={() => setBackupExpanded((e) => !e)}
            busy={backupBusy}
            message={backupMessage}
            onExport={() => void handleExportBackup()}
            onImport={() => void handleImportBackup()}
            lang={userLanguage}
          />
          </>
          ) : null}
        </View>

        {/* Nutrition + lab archives — bottom of dashboard */}
        <NutritionDirectivesStrip
          directives={nutritionDirectives}
          activeId={directiveActiveId}
          onChanged={() => void loadNutritionDirectives(true)}
          lang={userLanguage}
        />
        <LabResultsStrip
          reports={labReports}
          onReportsChanged={() => void loadLabReports(false)}
          lang={userLanguage}
          gender={userGender}
        />

        <Pressable
          style={[styles.primaryButton, (isLoading || bodyScanLoading || trendLoading) && styles.primaryButtonDisabled]}
          onPress={handleSync}
          disabled={isLoading || bodyScanLoading || trendLoading}
        >
          {(isLoading || bodyScanLoading || trendLoading) ? (
            <ActivityIndicator color={isDark ? colors.textPrimary : colors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>{metabolicStripCopy.refreshMyData}</Text>
          )}
        </Pressable>

        {dataSource !== 'health-connect' && !withingsLinked && !effectiveBodyScan?.weightKg ? (
          <Text style={styles.previewFoot}>Preview · sample wellness data</Text>
        ) : null}
      </ScrollView>
      </KeyboardAvoidingView>

      {pullRefreshing && (
        <View style={styles.refreshOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}

      <FoodLogModal
        visible={foodModalVisible}
        onClose={() => {
          setFoodModalVisible(false);
          setFoodEditEntry(undefined);
          setFoodInitialTimestamp(undefined);
        }}
        onSaved={handleFoodSaved}
        initialTimestamp={foodInitialTimestamp}
        editEntry={foodEditEntry}
        lang={userLanguage}
        energyUnit={unitsPrefs.energy}
      />

      <WelcomeQuickStartWizard
        visible={quickStartVisible}
        onComplete={() => {
          setQuickStartVisible(false);
          void loadHeightAndBirthdate();
          void loadManualTrend();
        }}
        onOpenFoodLog={() => {
          setQuickStartVisible(false);
          setFoodModalVisible(true);
          void loadHeightAndBirthdate();
          void loadManualTrend();
        }}
      />

      <Modal
        visible={withingsMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={closeWithingsMenu}
      >
        <Pressable style={styles.withingsMenuBackdrop} onPress={closeWithingsMenu}>
          <Pressable style={styles.withingsMenuCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.withingsMenuTitle}>Withings</Text>
            <Text style={styles.withingsMenuHint}>
              Normal = last 2 days. Deep = full history. Re-link if sync fails on this phone.
            </Text>
            <Pressable
              accessibilityRole="button"
              style={styles.withingsMenuBtn}
              onPress={onWithingsMenuNormal}
              disabled={linkBusy}
            >
              <Text style={styles.withingsMenuBtnText}>Normal sync</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.withingsMenuBtn}
              onPress={onWithingsMenuDeep}
              disabled={linkBusy}
            >
              <Text style={styles.withingsMenuBtnText}>Deep sync</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={styles.withingsMenuBtn}
              onPress={onWithingsMenuRelink}
              disabled={linkBusy}
            >
              <Text style={styles.withingsMenuBtnText}>Re-link account</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              style={[styles.withingsMenuBtn, styles.withingsMenuBtnCancel]}
              onPress={closeWithingsMenu}
            >
              <Text style={styles.withingsMenuBtnCancelText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Chat screen modal */}
      <Modal
        visible={chatVisible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => setChatVisible(false)}
      >
        <SafeAreaProvider initialMetrics={initialWindowMetrics}>
          <ChatScreen
            visible={chatVisible}
            onClose={() => setChatVisible(false)}
            context={coachContext}
            onCoachMessageUpdated={(msg) => setCoachMsg(msg)}
            onMacroTargetUpdated={(t) => { setMacroTarget(t); setEffectiveMacroTarget(t); }}
            onFoodLogSaved={handleFoodSaved}
          />
        </SafeAreaProvider>
      </Modal>

      {/* ── Birthdate + gender one-time modal ────────────────────────── */}
    </SafeAreaView>
  );
};

const makeStyles = (c: ThemeColors, isDark: boolean) => {
  // Pre-token hexes kept verbatim for light; dark swaps in tokens so the tinted
  // surfaces and navy accents stay visible against the near-black background.
  const tierAccent = isDark ? c.primaryTier : PRIMARY_TIER_ACCENT;
  const chatStripBg = isDark ? c.metabolicPairBg : '#EAF4FB';
  const chatStripBorder = isDark ? c.metabolicPairBorder : '#B3D9F0';
  return StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: c.background,
  },
  keyboardAvoid: {
    flex: 1,
  },
  refreshOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.55)',
    zIndex: 20,
  },
  scroll: {
    paddingHorizontal: 20,
    paddingTop: 0,
    paddingBottom: 100,
  },
  brandHeader: {
    marginBottom: 0,
    width: '100%',
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  // Compact top refresh affordance (audit F9) — reachable without scrolling to the
  // bottom "Refresh my data" button; both call the same sync.
  headerRefreshBtn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  notice: {
    backgroundColor: c.noticeSoftBg,
    borderWidth: 1,
    borderColor: c.noticeSoftBorder,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: dashCardGap,
  },
  noticeText: {
    color: c.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  bodyScanCard: {
    backgroundColor: c.surface,
    borderRadius: 24,
    borderLeftWidth: 3,
    borderLeftColor: tierAccent,
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 18,
    marginBottom: dashCardGap,
  },
  bodyScanHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  bodyScanHeaderManualOnly: {
    justifyContent: 'flex-end',
    marginBottom: 0,
  },
  bodyScanHeaderSpinner: {
    marginLeft: 8,
  },
  bodySourcesCluster: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flexShrink: 1,
    gap: 4,
  },
  bodyHeaderSpacer: {
    flex: 1,
    minWidth: 8,
  },
  bodyHeaderActions: {
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
    gap: 2,
  },
  withingsActionsLabel: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: isDark ? c.textPrimary : '#1A2B4A',
    textTransform: 'uppercase',
    textAlign: 'center',
    alignSelf: 'stretch',
    lineHeight: 10,
    includeFontPadding: false,
    height: 12,
  },
  bodyHeaderActionsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingHorizontal: 4,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(26, 43, 74, 0.04)',
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.10)' : 'rgba(26, 43, 74, 0.08)',
  },
  withingsStatusBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Dark: canvas black like the Link button beside it, state carried by the ring.
  withingsStatusBadgeOn: {
    backgroundColor: isDark ? c.background : c.iconTintGreen,
    borderWidth: 1,
    borderColor: isDark ? c.accentGreen : 'rgba(76, 175, 80, 0.35)',
  },
  withingsStatusBadgeOff: {
    backgroundColor: isDark ? c.background : '#FFEBEE',
    borderWidth: 1,
    borderColor: isDark ? c.accentRed : 'rgba(255, 82, 82, 0.35)',
  },
  withingsLinkButtonCompact: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: c.accentBlue,
    // Outlined buttons sit on canvas black in dark, punched out of the card.
    backgroundColor: isDark ? c.background : undefined,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 72,
  },
  withingsLinkButtonProfile: {
    alignSelf: 'flex-start',
    marginTop: 2,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: c.accentBlue,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 36,
  },
  withingsLinkButtonDisabled: {
    opacity: 0.55,
  },
  withingsLinkButtonTextCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: c.accentBlue,
  },
  linkErrorText: {
    color: c.accentRed,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  bodyScanErrorText: {
    color: c.accentRed,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  bodyScanMeasured: {
    fontSize: 10,
    lineHeight: 14,
    color: c.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  hrSyncDiagText: {
    fontSize: 10,
    lineHeight: 14,
    color: c.textSecondary,
    marginTop: 2,
    marginBottom: 10,
  },
  bodyScanRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  bodyScanTripleRow: {
    gap: 6,
  },
  bodyScanMetricThird: {
    flex: 1,
    minWidth: 0,
  },
  bodyScanMetricLabelTriple: {
    fontSize: 10,
    fontWeight: '600',
    color: c.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  bodyScanMetricValueTriple: {
    fontSize: 16,
    fontWeight: '500',
    color: c.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bodyScanBmrRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 4,
    marginBottom: 12,
  },
  bodyScanBmrLeft: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
    flexShrink: 1,
    minWidth: 0,
  },
  bodyScanBmrValue: {
    fontSize: 16,
    fontWeight: '600',
    color: c.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bodyScanBmrDate: {
    fontSize: 10,
    lineHeight: 14,
    color: c.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  bodyScanEmpty: {
    fontSize: 14,
    color: c.textSecondary,
    marginTop: 4,
  },
  /** Same horizontal gutter as surface cards (scroll padding + card inner padding). */
  chartBleed: {
    marginBottom: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  chartCardBleed: {
    backgroundColor: c.surface,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 4,
    minHeight: 328,
    overflow: 'visible',
  },
  chartCardBleedCollapsed: {
    minHeight: 0,
    paddingTop: 14,
    paddingBottom: 12,
    paddingHorizontal: 14,
  },
  trendBleed: {
    marginBottom: dashCardGap,
    alignSelf: 'stretch',
    width: '100%',
  },
  trendCardBleed: {
    backgroundColor: c.surface,
    borderRadius: 24,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 16,
    minHeight: 320,
    overflow: 'visible',
  },
  trendCardBleedCollapsed: {
    minHeight: 0,
    paddingTop: 14,
    paddingBottom: 12,
  },
  bmrCardBleed: {
    minHeight: 160,
    paddingTop: 14,
    paddingBottom: 14,
  },
  bmrInsideTrend: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gridLine,
  },
  trendErrorText: {
    color: c.accentRed,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 10,
    lineHeight: 19,
  },
  trendLoadingOnly: {
    minHeight: 200,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  trendLoadingLabel: {
    marginTop: 10,
    fontSize: 13,
    color: c.textSecondary,
  },
  glucoseHistorySection: {
    marginBottom: dashCardGap,
  },
  // Dark: black pill with light border (matches outlined action pattern); light keeps
  // the solid blue CTA.
  primaryButton: {
    backgroundColor: isDark ? c.background : c.accentBlue,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: dashCardGap,
    borderWidth: isDark ? 1.5 : 0,
    borderColor: isDark ? c.gridLine : undefined,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: isDark ? c.textPrimary : c.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    color: c.accentRed,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  hcErrorBanner: {
    backgroundColor: c.noticeSoftBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.noticeSoftBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: dashCardGap,
  },
  hcErrorBannerText: {
    fontSize: 14,
    color: c.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  hcErrorBannerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: c.accentBlue,
  },
  // AI chat entry strip
  nudgeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: chatStripBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: chatStripBorder,
    borderLeftWidth: 3,
    borderLeftColor: tierAccent,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: dashCardGap,
    gap: 10,
  },
  nudgeStripIcons: {
    flexShrink: 0,
  },
  nudgeStripTextCol: {
    flex: 1,
    minWidth: 0,
  },
  nudgeStripTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: c.textPrimary,
  },
  nudgeStripTitleRtl: {
    writingDirection: 'rtl',
  },
  nudgeStripSub: {
    fontSize: 12,
    fontWeight: '500',
    color: c.textSecondary,
    marginTop: 1,
    flexShrink: 1,
  },
  withingsMenuBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  withingsMenuCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
  },
  withingsMenuTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 6,
  },
  withingsMenuHint: {
    fontSize: 13,
    lineHeight: 18,
    color: c.textSecondary,
    marginBottom: 12,
  },
  withingsMenuBtn: {
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.gridLine,
  },
  withingsMenuBtnCancel: {
    marginTop: 4,
  },
  withingsMenuBtnText: {
    fontSize: 16,
    fontWeight: '600',
    color: c.accentBlue,
    textAlign: 'center',
  },
  withingsMenuBtnCancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: c.textSecondary,
    textAlign: 'center',
  },
  nudgeStripChevron: {
    fontSize: 20,
    color: c.textSecondary,
    fontWeight: '300',
    flexShrink: 0,
  },
  _unused: {
  },
  previewFoot: {
    fontSize: 11,
    color: c.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  groupCard: {
    backgroundColor: c.surface,
    borderRadius: 24,
    marginBottom: dashCardGap,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingTop: 14,
  },
  groupCardCollapsed: {
    paddingBottom: 12,
  },
  profileHelpLink: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  profileHelpLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: c.accentBlue,
  },
  profileHelpLinkChevron: {
    fontSize: 20,
    color: c.textSecondary,
    marginLeft: 8,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: c.gridLine,
    marginHorizontal: 4,
    marginVertical: 2,
  },
  profileBody: {
    paddingHorizontal: 4,
    paddingBottom: 16,
  },
  heightModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  heightModalCard: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
  },
  birthdateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  birthdateCard: {
    backgroundColor: c.surface,
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 8,
    width: '88%',
    maxHeight: '88%',
    ...cardShadow,
  },
  birthdateScroll: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  birthdateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  birthdateSubtitle: {
    fontSize: 13,
    color: c.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  birthdateFieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: c.textSecondary,
    marginBottom: 8,
  },
  birthdateSectionTitle: {
    alignSelf: 'flex-start',
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    marginTop: 4,
    marginBottom: 8,
  },
  manualBodyProfileGate: {
    marginTop: 8,
    marginBottom: 12,
  },
  manualBodyProfileGateHint: {
    fontSize: 12,
    color: c.textSecondary,
    lineHeight: 17,
  },
  genderRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    width: '100%',
  },
  genderBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    alignItems: 'center',
    backgroundColor: c.background,
  },
  genderBtnSelected: {
    borderColor: c.accentBlue,
    backgroundColor: c.accentBlue + '15',
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
  },
  genderBtnTextSelected: {
    color: c.accentBlue,
  },
  langRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
    width: '100%',
  },
  langBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    alignItems: 'center',
    backgroundColor: c.background,
  },
  langBtnSelected: {
    borderColor: c.accentBlue,
    backgroundColor: c.accentBlue + '15',
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textSecondary,
  },
  langBtnTextSelected: {
    color: c.accentBlue,
  },
  heightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 10,
    marginBottom: 4,
  },
  heightInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    backgroundColor: c.background,
    fontSize: 18,
    fontWeight: '700',
    color: c.textPrimary,
    textAlign: 'center',
  },
  heightUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: c.textSecondary,
    width: 32,
  },
  heightHint: {
    fontSize: 11,
    color: isDark ? c.chart.eaten : '#E65100',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  datePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: c.gridLine,
    backgroundColor: c.background,
    marginBottom: 8,
  },
  datePickerBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: c.textPrimary,
  },
  datePickerBtnIcon: {
    fontSize: 18,
  },
  birthdateAge: {
    fontSize: 14,
    fontWeight: '600',
    color: c.accentBlue,
    marginTop: 4,
    marginBottom: 16,
  },
  quickStartAgainBtn: {
    marginBottom: 12,
    paddingVertical: 8,
    alignItems: 'center',
  },
  quickStartAgainText: {
    fontSize: 14,
    fontWeight: '600',
    color: c.accentBlue,
  },
  setupChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  setupChip: {
    backgroundColor: c.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '30%',
    flexGrow: 1,
  },
  setupChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: c.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  setupChipValue: {
    fontSize: 13,
    fontWeight: '600',
    color: c.textPrimary,
    marginTop: 2,
  },
  bodyScanProvenance: {
    fontSize: 11,
    color: c.textSecondary,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  birthdateSaveHint: {
    fontSize: 12,
    color: c.textSecondary,
    alignSelf: 'center',
    textAlign: 'center',
    marginBottom: 8,
    marginTop: 4,
  },
  birthdateSaveBtn: {
    backgroundColor: c.accentBlue,
    borderRadius: 999,
    paddingHorizontal: 40,
    paddingVertical: 12,
    width: '100%',
    alignItems: 'center',
  },
  birthdateSaveBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  });
};
