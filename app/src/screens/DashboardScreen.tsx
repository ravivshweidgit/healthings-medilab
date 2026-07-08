import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider, initialWindowMetrics, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BmrHistoryChart7d } from '../components/BmrHistoryChart7d';
import { FoodLogModal } from '../components/FoodLogModal';
import { FoodMacroStrip } from '../components/FoodMacroStrip';
import { MetabolicChart } from '../components/MetabolicChart';
import { MetabolicTrendChart7d } from '../components/MetabolicTrendChart7d';
import { WeightTargetStrip } from '../components/WeightTargetStrip';
import { MentorStrip } from '../components/MentorStrip';
import { AccountStrip } from '../components/AccountStrip';
import { ClinicLinkStrip } from '../components/ClinicLinkStrip';
import { DashboardCollapseHeader } from '../components/DashboardCollapseHeader';
import { RulesStrip } from '../components/RulesStrip';
import { NutritionDirectivesStrip } from '../components/NutritionDirectivesStrip';
import { LabResultsStrip } from '../components/LabResultsStrip';
import { WelcomeQuickStartWizard } from '../components/WelcomeQuickStartWizard';
import { MacroTargetStrip } from '../components/MacroTargetStrip';
import { getManualBody, getManualBodyHistory, logManualWeighIn, saveManualFatPct, manualBodyToDashboardMetrics, countDistinctWeighInDays, type ManualBodySnapshot } from '../services/ManualBodyService';
import { buildManualTrendDays } from '../services/ManualTrendService';
import { SetupToggleRow } from '../components/SetupToggleRow';
import { HealthConnectStepsGuide } from '../components/HealthConnectStepsGuide';
import {
  loadSourceConfig,
  saveSourceConfig,
  sourceConfigFromToggles,
  togglesFromSourceConfig,
  type SetupToggles,
  type SourceConfig,
} from '../services/SourceConfigService';
import { fetchDailyStepTotalsForTrend, stepsToActiveKcal } from '../services/SamsungStepsAdapter';
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
  localDayKeyFromMs,
  dayKeyStartMs,
  resolveCompositionPeriodAnchor,
  type CompositionSession,
  type MetabolicTrend7dDay,
} from '../logic/metabolicTrend7d';
import { awsDataService } from '../services/AwsDataService';
import { parseCareSensAirExportWithSessions } from '../services/careSensCsv';
import { foodLogDayKey, defaultMealTimestampForDay, getTodayMeals, getRecentMeals, getDailyMacros, buildMealsAiContext, type FoodEntry } from '../services/FoodLogService';
import { buildLabsAiContext, getAllLabReports, type LabReport } from '../services/LabLogService';
import {
  getActiveNutritionDirective,
  getNutritionDirectiveAiContext,
  listNutritionDirectives,
  type NutritionDirective,
} from '../services/NutritionDirectiveService';
import { exportLocalBackup, importLocalBackup } from '../services/LocalBackupService';
import { shareVisitReport, VISIT_REPORT_DAY_OPTIONS, type VisitReportDayCount } from '../services/visitReportService';
import { buildGlucoseMentorContext } from '../logic/mealGlucoseAnalysis';
import { activeMentorEmojis } from '../logic/mentorLabels';
import {
  getBirthdate, setBirthdate, computeAge, getCachedHeightCm,
  setHeightCm as saveHeightCm, getGender, setGender, getMentors, saveMentors,
  getUserRules, getMacroTarget, getBodyTarget, getCoachMessage, saveCoachMessage,
  getLanguage, setLanguage, getMentorGender, SUPPORTED_LANGUAGES, resetQuickQuestionsForLanguage,
  type Gender, type MentorType, type UserRules, type DailyMacroTarget, type BodyTarget, type CoachMessage, type UserLanguage,
} from '../services/TargetService';
import { type CoachContext } from '../services/GeminiService';
import { triggerCoachReview, forceCoachReview, runAutoChecksAndPersist } from '../services/CoachService';
import {
  buildAuthorizationUrl,
  handleOAuthCallback,
  loadWithingsTokens,
} from '../services/WithingsApiService';
import { type AuthUser } from '../services/AuthApiService';
import { pullClinicOverlays } from '../services/ClinicOverlayService';
import { CLINIC_SYNC_POLL_MS, fulfillPendingClinicSyncRequests } from '../services/ClinicSyncService';
import { WellnessColors, cardShadow, dashCardGap } from '../theme/wellness';
import { demoNoticeCopy } from '../utils/wellnessCopy';

/** Must match `styles.scroll.paddingHorizontal`. */
const SCROLL_HORIZONTAL_PADDING = 20;
/** How far back to load meals for historical chart markers (days). */
const CHART_MEAL_LOOKBACK_DAYS = 31;
/** Persist glucose / trend expand state so compact stays default after relaunch. */
const DASH_GLUCOSE_EXPANDED_KEY = 'dash_glucose_chart_expanded';
const DASH_TREND_EXPANDED_KEY = 'dash_trend_chart_expanded';
const DASH_SETTINGS_CARD_EXPANDED_KEY = 'dash_settings_card_expanded';
const BRAND_LOGO = require('../../assets/brand-logo.png');
const BRAND_HEADER_HEIGHT_FALLBACK = 152;

function formatRelativeAgo(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 36) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function latestGlucoseSummary(
  points: { timestamp: string; value: number }[]
): { valueLabel: string; ago: string } | null {
  let best: { timestamp: string; value: number } | null = null;
  for (const p of points) {
    if (!Number.isFinite(p.value) || p.value <= 0) continue;
    if (!best || Date.parse(p.timestamp) > Date.parse(best.timestamp)) best = p;
  }
  if (!best) return null;
  return {
    valueLabel: `${Math.round(best.value)} mg/dL`,
    ago: formatRelativeAgo(best.timestamp),
  };
}

function trendWeightSummary(
  days: MetabolicTrend7dDay[]
): { weightLabel: string; deltaLabel: string | null } | null {
  const weights = days
    .map((d) => d.weightKg)
    .filter((v): v is number => v != null && Number.isFinite(v));
  if (weights.length === 0) return null;
  const latest = weights[weights.length - 1];
  const first = weights[0];
  const delta = weights.length >= 2 ? latest - first : null;
  return {
    weightLabel: formatKg(latest),
    deltaLabel:
      delta != null && Math.abs(delta) >= 0.05
        ? `${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg`
        : null,
  };
}

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

function formatKg(value: number | null | undefined, decimals = 1): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(decimals)} kg`;
}

function formatKcal(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${Math.round(value)} kcal`;
}

function formatMeasuredAt(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  try {
    return new Date(t).toLocaleString(undefined, {
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

  const [trendPeriodDays, setTrendPeriodDays] = useState<number>(DEFAULT_TREND_PERIOD_DAYS);

  const [withingsLinked, setWithingsLinked] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

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
  const [userLanguage, setUserLanguage] = useState<UserLanguage>(SUPPORTED_LANGUAGES[0]);
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
  const [quickStartVisible, setQuickStartVisible] = useState(false);
  const [manualTrendDays, setManualTrendDays] = useState<MetabolicTrend7dDay[]>([]);
  const [manualTrendLoading, setManualTrendLoading] = useState(false);
  const [manualWeighInDayCount, setManualWeighInDayCount] = useState(0);
  const [weighInInput, setWeighInInput] = useState('');
  const [weighInSaving, setWeighInSaving] = useState(false);
  const [fatPctInput, setFatPctInput] = useState('');
  const [fatPctSaving, setFatPctSaving] = useState(false);

  const loadManualTrend = useCallback(async (manualSnap?: ManualBodySnapshot | null) => {
    setManualTrendLoading(true);
    try {
      const [config, history, gender, height, bd] = await Promise.all([
        loadSourceConfig(),
        getManualBodyHistory(),
        getGender(),
        getCachedHeightCm(),
        getBirthdate(),
      ]);
      setSourceConfig(config);
      setSetupToggles(togglesFromSourceConfig(config));
      setManualWeighInDayCount(countDistinctWeighInDays(history));
      const snap = manualSnap ?? (await getManualBody());
      if (history.length === 0 && !snap) {
        setManualTrendDays([]);
        return;
      }
      const age = bd ? computeAge(bd) : null;
      if (!gender || !height || !age || age < 13) {
        setManualTrendDays([]);
        return;
      }
      const latestWeight = snap?.weight_kg ?? history[history.length - 1]?.weight_kg ?? 0;
      const lookback = Math.max(...TREND_PERIOD_DAY_OPTIONS, DEFAULT_TREND_PERIOD_DAYS);
      const stepMap = await fetchDailyStepTotalsForTrend(lookback, latestWeight, height, gender);
      const days = buildManualTrendDays({
        lookbackDays: lookback,
        heightCm: height,
        ageYears: age,
        gender,
        history: history.length > 0 ? history : snap ? [snap] : [],
        stepTotalsByDay: stepMap,
      });
      setManualTrendDays(days);
    } finally {
      setManualTrendLoading(false);
    }
  }, []);

  const loadLabReports = useCallback(async (refreshCoach = false) => {
    const [reports, mt] = await Promise.all([
      getAllLabReports(),
      getMacroTarget(),
    ]);
    const ctx = buildLabsAiContext(reports, 'all');
    setLabReports(reports);
    setLabsAiContext(ctx);
    if (mt) setMacroTarget(mt);

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
    const cached = await getCachedHeightCm();
    if (cached) {
      setHeightCm(cached);
      setHeightInput(String(cached));
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
    setManualBodySnap(manual);
    setMentorsState(m);
    if (r) setUserRules(r);
    if (mt) setMacroTarget(mt);
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

  const handleFoodSaved = useCallback((opts?: { close?: boolean }) => {
    const shouldClose = opts?.close !== false;
    if (shouldClose) {
      setFoodModalVisible(false);
      setFoodEditEntry(undefined);
    }
    setFoodRefreshKey((k) => k + 1);
    loadTodayFood().then(async () => {
      if (!shouldClose) return;
      const ctx = coachContextRef.current;
      if (!ctx) return;
      const storedLang = await getLanguage();
      triggerCoachReview('meal', {
        ...ctx,
        lang: storedLang,
        event: 'meal',
        mealCount: ctx.mealCount + 1,
      })
        .then((newMsg) => { if (newMsg) setCoachMsg(newMsg); })
        .catch(() => {/* non-fatal */});
    });
  }, [loadTodayFood]);

  const handleEditMeal = useCallback((entry: FoodEntry) => {
    setFoodEditEntry(entry);
    setFoodModalVisible(true);
  }, []);

  const useHcStepsForActivity = sourceConfig?.activity === 'samsung-steps';

  const useManualWeightTrend = useMemo(() => {
    if (sourceConfig?.bodyComposition === 'manual') return true;
    if (bodyScan?.weightKg != null && sourceConfig?.bodyComposition === 'withings') return false;
    const withingsWeightDays = bodyTrendDays.filter((d) => d.weightKg != null).length;
    return withingsWeightDays < 2 && manualBodySnap != null;
  }, [sourceConfig, bodyScan, bodyTrendDays, manualBodySnap]);

  const showManualBodyInProfile = useMemo(() => {
    if (!userGender || !heightCm || !userAge) return false;
    return sourceConfig?.bodyComposition !== 'withings';
  }, [userGender, heightCm, userAge, sourceConfig]);

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

  const loadHcStepTotals = useCallback(async () => {
    if (!useHcStepsForActivity || !heightCm || !userGender) {
      setHcStepTotalsByDay(new Map());
      return;
    }
    const weightKg =
      effectiveBodyScan?.weightKg ?? manualBodySnap?.weight_kg ?? bodyScan?.weightKg ?? 70;
    const lookback = Math.max(...TREND_PERIOD_DAY_OPTIONS, DEFAULT_TREND_PERIOD_DAYS);
    const map = await fetchDailyStepTotalsForTrend(lookback, weightKg, heightCm, userGender);
    setHcStepTotalsByDay(map);
  }, [useHcStepsForActivity, heightCm, userGender, effectiveBodyScan, manualBodySnap, bodyScan]);

  const persistSetupToggles = useCallback(
    async (next: SetupToggles) => {
      const config = sourceConfigFromToggles(next);
      await saveSourceConfig(config);
      setSourceConfig(config);
      setSetupToggles(next);
      if (config.bodyComposition === 'manual') {
        await loadManualTrend();
      }
      if (config.activity === 'samsung-steps') {
        await healthConnectService.requestStepsPermission();
        await loadHcStepTotals();
      }
    },
    [loadManualTrend, loadHcStepTotals],
  );

  const baseTrendDays = useManualWeightTrend ? manualTrendDays : bodyTrendDays;

  /**
   * Patch activityKcalDay from workoutSessions for any day the getactivity API left null.
   * This covers two cases: token missing user.activity scope, or Withings not synced yet.
   */
  const bodyTrendDaysWithActivity = useMemo((): MetabolicTrend7dDay[] => {
    if (useManualWeightTrend) return baseTrendDays;

    let days = baseTrendDays;
    if (useHcStepsForActivity && heightCm && userGender) {
      days = baseTrendDays.map((d) => {
        const steps = hcStepTotalsByDay.get(d.dayKey) ?? 0;
        const weightKg = d.weightKg ?? effectiveBodyScan?.weightKg ?? manualBodySnap?.weight_kg;
        const activityKcalDay =
          weightKg && steps > 0
            ? stepsToActiveKcal(steps, weightKg, heightCm, userGender)
            : null;
        return { ...d, activityKcalDay };
      });
    }

    if (!useHcStepsForActivity && workoutSessions.length === 0) return days;
    if (useHcStepsForActivity) return days;

    const workoutByDay = new Map<string, number>();
    for (const w of workoutSessions) {
      const dk = localDayKeyFromMs(w.startMs);
      workoutByDay.set(dk, (workoutByDay.get(dk) ?? 0) + w.kcal);
    }
    return days.map((d) => {
      if (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay)) return d;
      const wkt = workoutByDay.get(d.dayKey);
      return wkt != null ? { ...d, activityKcalDay: wkt } : d;
    });
  }, [
    baseTrendDays,
    useManualWeightTrend,
    useHcStepsForActivity,
    hcStepTotalsByDay,
    heightCm,
    userGender,
    effectiveBodyScan,
    manualBodySnap,
    workoutSessions,
  ]);

  const visibleTrend = useMemo(() => {
    if (bodyTrendDaysWithActivity.length < 2) return null;
    const n = Math.min(trendPeriodDays, bodyTrendDaysWithActivity.length);
    const days = bodyTrendDaysWithActivity.slice(-n);
    const anchor = resolveCompositionPeriodAnchor(
      bodyTrendSessions,
      days.map((d) => d.dayKey)
    );
    return { days, anchor };
  }, [bodyTrendDaysWithActivity, bodyTrendSessions, trendPeriodDays]);

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
    () => latestGlucoseSummary(glucoseData),
    [glucoseData]
  );

  const trendCompactSummary = useMemo(
    () => (visibleTrend ? trendWeightSummary(visibleTrend.days) : null),
    [visibleTrend]
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
   * Total calorie burn per day key for all days covered by intraday data.
   * BMR comes from bodyTrendDays (per-day) with bodyScan as fallback.
   * Passive calories and workouts are bucketed per day.
   */
  const burnKcalByDay = useMemo((): Record<string, number> => {
    const fallbackBmr = effectiveBodyScan?.bmrKcalDay;

    if (useManualWeightTrend || useHcStepsForActivity) {
      const result: Record<string, number> = {};
      for (const d of bodyTrendDaysWithActivity) {
        const bmr = d.bmrKcalDay ?? fallbackBmr;
        if (!bmr || !Number.isFinite(bmr)) continue;
        const activity = d.activityKcalDay ?? 0;
        result[d.dayKey] = Math.round(bmr + activity);
      }
      const todayKey = localDayKeyFromMs(Date.now());
      if (!result[todayKey] && fallbackBmr && Number.isFinite(fallbackBmr)) {
        const todayActivity =
          bodyTrendDaysWithActivity.find((d) => d.dayKey === todayKey)?.activityKcalDay ?? 0;
        result[todayKey] = Math.round(fallbackBmr + todayActivity);
      }
      return result;
    }

    const BUCKET_MS = 30 * 60 * 1000;

    // BMR per day key from trend data
    const bmrByDay = new Map<string, number>();
    for (const d of bodyTrendDaysWithActivity) {
      if (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) {
        bmrByDay.set(d.dayKey, d.bmrKcalDay);
      }
    }

    // Passive calories bucketed by day key
    const passiveByDay = new Map<string, Map<number, number>>();
    for (const pt of withingsCalories) {
      const t = new Date(pt.timestamp).getTime();
      const dk = localDayKeyFromMs(t);
      if (!passiveByDay.has(dk)) passiveByDay.set(dk, new Map());
      const bk = Math.floor(t / BUCKET_MS) * BUCKET_MS;
      const m = passiveByDay.get(dk)!;
      m.set(bk, (m.get(bk) ?? 0) + pt.kcal);
    }

    // Workout calories + buckets by day key
    const workoutKcalByDay = new Map<string, number>();
    const workoutBucketsByDay = new Map<string, Set<number>>();
    for (const w of workoutSessions) {
      const dk = localDayKeyFromMs(w.startMs);
      workoutKcalByDay.set(dk, (workoutKcalByDay.get(dk) ?? 0) + w.kcal);
      if (!workoutBucketsByDay.has(dk)) workoutBucketsByDay.set(dk, new Set());
      const bkSet = workoutBucketsByDay.get(dk)!;
      const firstBk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
      for (let bk = firstBk; bk < w.endMs; bk += BUCKET_MS) bkSet.add(bk);
    }

    // Collect all day keys with any data — always include today so the row shows even before first activity
    const allDayKeys = new Set<string>([
      localDayKeyFromMs(Date.now()),
      ...bmrByDay.keys(),
      ...passiveByDay.keys(),
      ...workoutKcalByDay.keys(),
    ]);

    const result: Record<string, number> = {};
    for (const dk of allDayKeys) {
      const bmr = bmrByDay.get(dk) ?? fallbackBmr;
      if (!bmr || !Number.isFinite(bmr)) continue;

      const wktBuckets = workoutBucketsByDay.get(dk) ?? new Set<number>();
      const wktKcal = workoutKcalByDay.get(dk) ?? 0;
      let passiveKcal = 0;
      for (const [bk, kcal] of (passiveByDay.get(dk) ?? new Map())) {
        if (!wktBuckets.has(bk)) passiveKcal += kcal;
      }
      result[dk] = Math.round(bmr + passiveKcal + wktKcal);
    }
    return result;
  }, [effectiveBodyScan, bodyTrendDaysWithActivity, withingsCalories, workoutSessions, useManualWeightTrend, useHcStepsForActivity]);

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
  const trendAvailableDays = useManualWeightTrend ? manualTrendDays.length : bodyTrendDays.length;

  /** User age computed from stored birthdate. */
  const userAge = useMemo((): number | null => {
    if (!birthdatePicker) return null;
    const iso = birthdatePicker.toISOString().split('T')[0];
    return computeAge(iso);
  }, [birthdatePicker]);

  const settingsCardSummary = useMemo(() => {
    const parts: string[] = [];
    if (userGender) parts.push(userGender.charAt(0).toUpperCase() + userGender.slice(1));
    if (heightCm) parts.push(`${heightCm} cm`);
    if (userAge != null) parts.push(`${userAge} y`);
    if (mentors.length > 0) parts.push(`${mentors.length} mentor${mentors.length === 1 ? '' : 's'}`);
    return parts.length > 0 ? parts.join(' · ') : 'Tap to open';
  }, [userGender, heightCm, userAge, mentors]);

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
      if (userLanguage.code === 'he') {
        if (n === 90) return '90 ימים (~3 חודשים)';
        return `${n} ימים`;
      }
      if (userLanguage.code === 'ar') {
        if (n === 90) return '90 يوماً (~3 أشهر)';
        return `${n} ${n === 7 || n === 30 ? 'أيام' : 'يوماً'}`;
      }
      if (n === 90) return '90 days (~3 mo)';
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
      macroTarget,
      bodyTarget: bodyTargetForMacros,
      userRules,
      labsAiContext,
      nutritionDirectiveContext,
    };
    coachContextRef.current = ctx;
    return ctx;
  }, [
    mentors, userAge, userGender, userMentorGender, mentorGenderPicker, heightCm, effectiveBodyScan, fatPct, bodyTargetForMacros,
    todayActualMacros, todayEstimatedBurn, todayFoodEntries.length, mealContext, mealGlucoseContext, glucoseData, macroTarget, userRules, labsAiContext, nutritionDirectiveContext, userLanguage,
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

  /** Heart rate chart line — Withings only (never Health Connect). */
  const mergedHeartRate = withingsHeartRate;

  const applyClinicOverlays = useCallback(async () => {
    const rules = await pullClinicOverlays();
    if (rules) {
      setUserRules(rules);
      await loadCoachMessage();
    }
  }, [loadCoachMessage]);

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        syncWithings(),
        refreshTodayIntraday(),
        loadTodayFood(),
        loadManualTrend(),
        user.role === 'patient' ? fulfillPendingClinicSyncRequests() : Promise.resolve(),
        user.role === 'patient' ? applyClinicOverlays() : Promise.resolve(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [refetch, syncWithings, refreshTodayIntraday, loadTodayFood, loadManualTrend, user.role, applyClinicOverlays]);

  useEffect(() => {
    void loadTodayFood();
  }, [loadTodayFood]);

  useEffect(() => {
    void (async () => {
      try {
        const [g, t, s] = await AsyncStorage.multiGet([
          DASH_GLUCOSE_EXPANDED_KEY,
          DASH_TREND_EXPANDED_KEY,
          DASH_SETTINGS_CARD_EXPANDED_KEY,
        ]);
        if (g[1] === 'true') setGlucoseExpanded(true);
        if (t[1] === 'true') setTrendExpanded(true);
        if (s[1] === 'true') setSettingsCardExpanded(true);
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
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void applyClinicOverlays();
        void maybeRunOpportunisticCloudBackup();
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
      triggerDetail: `${w.toFixed(1)} kg`,
      weightKg: w,
      measuredAt,
      onSaved: (t) => setMacroTarget(t),
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
  }, [bodyScan?.measuredAt, bodyScan?.weightKg, userLanguage?.code]);

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
    void refreshWithingsLinkState();
  }, [refreshWithingsLinkState]);

  useEffect(() => {
    if (!profileExpanded) return;
    void loadSourceConfig().then((c) => {
      setSourceConfig(c);
      setSetupToggles(togglesFromSourceConfig(c));
    });
  }, [profileExpanded]);

  useEffect(() => {
    if (useHcStepsForActivity) void loadHcStepTotals();
  }, [useHcStepsForActivity, loadHcStepTotals]);

  useEffect(() => {
    if (manualBodySnap?.fat_pct_source === 'user') {
      setFatPctInput(String(manualBodySnap.fat_pct));
    }
  }, [manualBodySnap]);

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
        await syncWithings();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withings link failed.';
      setLinkError(message);
    } finally {
      setLinkBusy(false);
    }
  }, [syncWithings, refreshWithingsLinkState]);

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
      const uri = pick.assets?.[0]?.uri;
      if (!uri) {
        setImportMessage('No file was selected.');
        return;
      }
      const text = await FileSystem.readAsStringAsync(uri);
      const { points, sessionStarts } = parseCareSensAirExportWithSessions(text);
      const importResult = await applyImportedGlucose(points, sessionStarts);
      setImportMessage(
        `Imported ${importResult.csvCount} CSV + ${importResult.hcCount} HC readings → ${importResult.chartCount} on chart (${importResult.sessionCount} sensor session${importResult.sessionCount === 1 ? '' : 's'}).`,
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
    <SafeAreaView style={styles.safe}>
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
        <View style={[styles.brandHeader, { height: brandHeaderHeight }]} accessibilityRole="header">
          <Image
            source={BRAND_LOGO}
            style={styles.brandLogo}
            resizeMode="contain"
            accessibilityLabel="Healthings Medilab"
          />
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
              ? `Open AI chat, ${coachMsg.actionItems.filter((i) => i.done).length} of ${coachMsg.actionItems.length} action items`
              : 'Open AI chat with your mentors'
          }
        >
          <Text style={styles.nudgeStripIcons} numberOfLines={1}>
            {activeMentorEmojis(mentors)}
          </Text>
          <View style={styles.nudgeStripTextCol}>
            <Text style={styles.nudgeStripTitle}>AI chat</Text>
            <Text style={styles.nudgeStripSub} numberOfLines={1}>
              {coachMsg
                ? `${coachMsg.actionItems.filter((i) => i.done).length}/${coachMsg.actionItems.length} actions · tap to open`
                : 'Ask your mentors · tap to open'}
            </Text>
          </View>
          <Text style={styles.nudgeStripChevron}>›</Text>
        </Pressable>

        <View style={[styles.bodyScanCard, cardShadow]}>
          <View style={styles.bodyScanHeader}>
            <View style={styles.withingsLogoWrap}>
              <Image
                source={require('../../assets/WithingsLogo.jpeg')}
                style={styles.withingsHeaderLogo}
                resizeMode="contain"
                accessibilityLabel="Withings"
              />
            </View>
            <View style={styles.withingsHeaderMiddle}>
              <View
                style={[
                  styles.withingsStatusBadge,
                  withingsLinked ? styles.withingsStatusBadgeOn : styles.withingsStatusBadgeOff,
                ]}
                accessible
                accessibilityRole="text"
                accessibilityLabel={
                  withingsLinked ? 'Withings connected, signed in' : 'Withings disconnected, signed out'
                }
              >
                <Text
                  accessible={false}
                  importantForAccessibility="no"
                  style={[
                    styles.withingsStatusLine,
                    Platform.OS === 'android' && styles.withingsStatusLineAndroid,
                    withingsLinked ? styles.withingsStatusLineOn : styles.withingsStatusLineOff,
                  ]}
                  numberOfLines={1}
                >
                  {withingsLinked ? 'OK' : 'X'}
                </Text>
              </View>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={withingsLinked ? 'Re-link Withings account' : 'Link Withings account'}
              style={[
                styles.withingsLinkButtonCompact,
                (linkBusy || bodyScanLoading) && styles.withingsLinkButtonDisabled,
              ]}
              onPress={handleLinkWithings}
              disabled={linkBusy || bodyScanLoading}
            >
              {linkBusy ? (
                <ActivityIndicator color={WellnessColors.accentBlue} size="small" />
              ) : (
                <Text style={styles.withingsLinkButtonTextCompact}>
                  {withingsLinked ? 'Re-link' : 'Link'}
                </Text>
              )}
            </Pressable>
            {bodyScanLoading ? <ActivityIndicator color={WellnessColors.accentBlue} style={styles.bodyScanHeaderSpinner} /> : null}
          </View>

          {linkError ? <Text style={styles.linkErrorText}>{linkError}</Text> : null}

          {bodyScanError ? <Text style={styles.bodyScanErrorText}>{bodyScanError}</Text> : null}

          {displayBodyScan && !bodyScanLoading ? (
            <>
              <View style={[styles.bodyScanRow, styles.bodyScanTripleRow]}>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Weight ${formatKg(displayBodyScan.metrics.weightKg)}`}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    Weight
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(displayBodyScan.metrics.weightKg)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Muscle mass ${formatKg(displayBodyScan.metrics.muscleMassKg)}`}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    Muscle
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(displayBodyScan.metrics.muscleMassKg)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Fat mass ${formatKg(displayBodyScan.metrics.fatMassKg)}`}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    Fat{displayBodyScan.provenance === 'manual' && displayBodyScan.fatEstimated ? ' (est.)' : ''}
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(displayBodyScan.metrics.fatMassKg)}
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
                  accessibilityLabel={`BMR ${formatKcal(displayBodyScan.metrics.bmrKcalDay)} per day${
                    formatMeasuredAt(displayBodyScan.metrics.measuredAt)
                      ? `, measured ${formatMeasuredAt(displayBodyScan.metrics.measuredAt)}`
                      : ''
                  }`}
                >
                  <View style={styles.bodyScanBmrLeft}>
                    <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                      BMR
                    </Text>
                    <Text style={styles.bodyScanBmrValue} accessible={false}>
                      {formatKcal(displayBodyScan.metrics.bmrKcalDay)}
                    </Text>
                  </View>
                  {formatMeasuredAt(displayBodyScan.metrics.measuredAt) ? (
                    <Text style={styles.bodyScanBmrDate} accessible={false}>
                      {formatMeasuredAt(displayBodyScan.metrics.measuredAt)}
                    </Text>
                  ) : null}
                </View>
              ) : formatMeasuredAt(displayBodyScan.metrics.measuredAt) ? (
                <Text style={styles.bodyScanMeasured}>
                  Last measurement · {formatMeasuredAt(displayBodyScan.metrics.measuredAt)}
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
          dayKey={todayDayKey}
          onAddMeal={(dayKey) => {
            setFoodEditEntry(undefined);
            setFoodInitialTimestamp(defaultMealTimestampForDay(dayKey));
            setFoodModalVisible(true);
          }}
          onEditMeal={handleEditMeal}
          refreshKey={foodRefreshKey}
          burnKcalByDay={burnKcalByDay}
          onImported={() => { setFoodRefreshKey((k) => k + 1); loadTodayFood(); }}
          macroTarget={macroTarget}
        />

        {sourceConfig?.glucose === 'health-connect' ? (
          <View style={styles.glucoseHistorySection}>
            <View style={styles.chartBleed}>
              <View
                style={[
                  styles.chartCardBleed,
                  !glucoseExpanded && styles.chartCardBleedCollapsed,
                  cardShadow,
                ]}
              >
                <Pressable
                  style={styles.dashCollapseHeader}
                  onPress={() => setGlucoseExpanded((v) => !v)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: glucoseExpanded }}
                  accessibilityLabel={
                    glucoseExpanded ? 'Collapse glucose chart' : 'Expand glucose chart'
                  }
                >
                  <View style={styles.dashCollapseHeaderText}>
                    <Text style={styles.dashCollapseTitle}>GLUCOSE</Text>
                    {!glucoseExpanded ? (
                      <Text style={styles.dashCollapseSub} numberOfLines={1}>
                        {glucoseCompactSummary
                          ? `${glucoseCompactSummary.valueLabel}${
                              glucoseCompactSummary.ago
                                ? ` · ${glucoseCompactSummary.ago}`
                                : ''
                            }`
                          : 'Tap to open chart'}
                      </Text>
                    ) : null}
                  </View>
                  <Text style={styles.dashCollapseChevron}>{glucoseExpanded ? '⌃' : '›'}</Text>
                </Pressable>
                {glucoseExpanded ? (
                  <MetabolicChart
                    glucose={glucoseData}
                    heartRate={mergedHeartRate}
                    activityZones={activityZones}
                    calorieBurns={withingsCalories}
                    workoutSessions={workoutSessions}
                    bmrKcalDay={effectiveBodyScan?.bmrKcalDay}
                    foodEntries={chartMeals}
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
            <Pressable
              style={styles.dashCollapseHeader}
              onPress={() => setTrendExpanded((v) => !v)}
              accessibilityRole="button"
              accessibilityState={{ expanded: trendExpanded }}
              accessibilityLabel={
                trendExpanded
                  ? 'Collapse trend analysis and energy'
                  : 'Expand trend analysis and energy'
              }
            >
              <View style={styles.dashCollapseHeaderText}>
                <Text style={styles.dashCollapseTitle}>TREND & ENERGY</Text>
                {!trendExpanded ? (
                  <Text style={styles.dashCollapseSub} numberOfLines={1}>
                    {trendCompactSummary
                      ? `${trendCompactSummary.weightLabel}${
                          trendCompactSummary.deltaLabel
                            ? ` · ${trendCompactSummary.deltaLabel}`
                            : ''
                        }`
                      : trendChartLoading
                        ? 'Loading…'
                        : 'Tap to open charts'}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.dashCollapseChevron}>{trendExpanded ? '⌃' : '›'}</Text>
            </Pressable>
            {trendExpanded ? (
              <>
                {trendError && !useManualWeightTrend ? (
                  <Text style={styles.trendErrorText}>{trendError}</Text>
                ) : null}
                {trendChartLoading && !visibleTrend ? (
                  <View style={styles.trendLoadingOnly}>
                    <ActivityIndicator color={WellnessColors.accentBlue} />
                    <Text style={styles.trendLoadingLabel}>Loading trend analysis…</Text>
                  </View>
                ) : null}
                {visibleTrend ? (
                  <MetabolicTrendChart7d
                    days={visibleTrend.days}
                    periodAnchor={useManualWeightTrend ? null : visibleTrend.anchor}
                    periodDays={trendPeriodDays}
                    periodOptions={TREND_PERIOD_DAY_OPTIONS}
                    availableDays={trendAvailableDays}
                    onPeriodChange={setTrendPeriodDays}
                    weightOnly={useManualWeightTrend}
                    weighInDayCount={manualWeighInDayCount}
                    hideTitle
                  />
                ) : null}
                {hasEnergyHistory && visibleTrend ? (
                  <View style={styles.bmrInsideTrend}>
                    <BmrHistoryChart7d
                      days={visibleTrend.days}
                      loading={trendChartLoading}
                      eatenKcalByDay={eatenKcalByDay}
                    />
                  </View>
                ) : null}
              </>
            ) : null}
          </View>
        </View>

        {dataSource === 'health-connect' ? (
          <View style={styles.careSensImportSection}>
            <Pressable
              style={[styles.careSensImportButton, importBusy && styles.careSensImportButtonDisabled]}
              onPress={handleImportCareSensCsv}
              disabled={importBusy}
              accessibilityRole="button"
              accessibilityLabel="Import CareSens Air CSV"
            >
              {importBusy ? (
                <ActivityIndicator color={WellnessColors.accentBlue} />
              ) : (
                <View style={styles.careSensImportButtonRow}>
                  <View style={styles.careSensImportLogoWrap}>
                    <Image
                      source={require('../../assets/CareScenseAirLogo.jpeg')}
                      style={styles.careSensImportButtonLogo}
                      resizeMode="contain"
                      accessibilityIgnoresInvertColors
                    />
                  </View>
                  <Text style={styles.careSensImportButtonLabel}>Import</Text>
                </View>
              )}
            </Pressable>
            {importMessage ? <Text style={styles.importMessageText}>{importMessage}</Text> : null}
          </View>
        ) : null}

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

        <Pressable
          style={[styles.primaryButton, (isLoading || bodyScanLoading || trendLoading) && styles.primaryButtonDisabled]}
          onPress={handleSync}
          disabled={isLoading || bodyScanLoading || trendLoading}
        >
          {(isLoading || bodyScanLoading || trendLoading) ? (
            <ActivityIndicator color={WellnessColors.surface} />
          ) : (
            <Text style={styles.primaryButtonText}>Refresh my data</Text>
          )}
        </Pressable>

        {dataSource !== 'health-connect' && !withingsLinked && !effectiveBodyScan?.weightKg ? (
          <Text style={styles.previewFoot}>Preview · sample wellness data</Text>
        ) : null}

        {/* My Profile + My Targets — single grouped card */}
        <View style={[styles.groupCard, cardShadow, !settingsCardExpanded && styles.groupCardCollapsed]}>
          <DashboardCollapseHeader
            title="PROFILE & SETTINGS"
            subtitle={settingsCardSummary}
            expanded={settingsCardExpanded}
            onToggle={() => setSettingsCardExpanded((v) => !v)}
            style={styles.groupCardCollapseHeader}
            collapseLabel="Collapse profile and settings"
            expandLabel="Expand profile and settings"
          />
          {settingsCardExpanded ? (
          <>
          {/* ── My Profile collapsible row ── */}
          <Pressable
            style={styles.profileRow}
            onPress={() => setProfileExpanded((e) => !e)}
          >
            <Text style={styles.profileRowIcon}>👤</Text>
            <View style={styles.profileRowInfo}>
              <Text style={styles.profileRowTitle}>My Profile</Text>
              <Text style={styles.profileRowSub}>
                {[
                  userGender ? userGender.charAt(0).toUpperCase() + userGender.slice(1) : null,
                  heightCm ? `${heightCm} cm` : null,
                  birthdatePicker ? `${userAge} y` : null,
                  userLanguage.code !== 'en' ? userLanguage.label : null,
                ].filter(Boolean).join(' · ') || 'Tap to set gender, height & birthdate'}
              </Text>
            </View>
            <Text style={styles.profileRowChevron}>{profileExpanded ? '⌃' : '›'}</Text>
          </Pressable>

          {profileExpanded && (
            <View style={styles.profileBody}>
              {/* Gender */}
              <Text style={styles.birthdateSectionTitle}>Gender</Text>
              <View style={styles.genderRow}>
                {(['male', 'female', 'other'] as Gender[]).map((g) => (
                  <Pressable
                    key={g}
                    style={[styles.genderBtn, genderPicker === g && styles.genderBtnSelected]}
                    onPress={() => setGenderPicker(g)}
                  >
                    <Text style={[styles.genderBtnText, genderPicker === g && styles.genderBtnTextSelected]}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Height */}
              <Text style={styles.birthdateSectionTitle}>Height</Text>
              <View style={styles.heightRow}>
                <TextInput
                  style={styles.heightInput}
                  value={heightInput}
                  onChangeText={setHeightInput}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder="e.g. 175"
                  placeholderTextColor={WellnessColors.textSecondary}
                />
                <Text style={styles.heightUnit}>cm</Text>
              </View>

              {/* Birth Date */}
              <Text style={styles.birthdateSectionTitle}>Birth Date</Text>
              <Pressable
                style={styles.datePickerBtn}
                onPress={() => setShowDatePickerDialog(true)}
              >
                <Text style={styles.datePickerBtnText}>
                  {birthdatePicker.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                </Text>
                <Text style={styles.datePickerBtnIcon}>📅</Text>
              </Pressable>
              {userAge != null && (
                <Text style={styles.birthdateAge}>Age: {userAge} years</Text>
              )}
              {showDatePickerDialog && (
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
              )}

              {/* Language */}
              <Text style={styles.birthdateSectionTitle}>Language</Text>
              <View style={styles.langRow}>
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <Pressable
                    key={lang.code}
                    style={[styles.langBtn, userLanguage.code === lang.code && styles.langBtnSelected]}
                    onPress={() => setUserLanguage(lang)}
                  >
                    <Text style={[styles.langBtnText, userLanguage.code === lang.code && styles.langBtnTextSelected]}>
                      {lang.label}
                    </Text>
                  </Pressable>
                ))}
              </View>

              <Pressable
                style={styles.quickStartAgainBtn}
                onPress={() => {
                  void clearOnboardingCompletedAt().then(() => setQuickStartVisible(true));
                }}
              >
                <Text style={styles.quickStartAgainText}>Quick Start again</Text>
              </Pressable>

              <Text style={styles.birthdateSectionTitle}>Your setup</Text>
              {setupToggles ? (
                <>
                  <SetupToggleRow
                    label="Withings scale"
                    value={setupToggles.withingsScale}
                    onChange={(v) => void persistSetupToggles({ ...setupToggles, withingsScale: v })}
                    hint={
                      setupToggles.withingsScale && !withingsLinked
                        ? 'Link Withings on the dashboard to sync scale data.'
                        : undefined
                    }
                  />
                  <SetupToggleRow
                    label="Withings watch"
                    value={setupToggles.withingsWatch}
                    onChange={(v) => void persistSetupToggles({ ...setupToggles, withingsWatch: v })}
                  />
                  {!setupToggles.withingsWatch ? (
                    <HealthConnectStepsGuide onPermissionGranted={() => void loadHcStepTotals()} />
                  ) : null}
                  <SetupToggleRow
                    label="CGM"
                    value={setupToggles.cgm}
                    onChange={(v) => void persistSetupToggles({ ...setupToggles, cgm: v })}
                    hint={
                      setupToggles.cgm
                        ? 'Allow Blood glucose in Health Connect settings.'
                        : undefined
                    }
                  />
                </>
              ) : null}

              {showManualBodyInProfile ? (
                <>
                  <Text style={styles.birthdateSectionTitle}>Body</Text>
                  <Text style={styles.weighInHint}>
                    Optional — log weight when you want. Muscle is calculated from weight and fat %.
                  </Text>
                  <View style={styles.weighInRow}>
                    <TextInput
                      style={styles.weighInInput}
                      keyboardType="decimal-pad"
                      placeholder={
                        effectiveBodyScan?.weightKg != null
                          ? `Weight · now ${effectiveBodyScan.weightKg.toFixed(1)} kg`
                          : 'Weight (kg)'
                      }
                      placeholderTextColor={WellnessColors.textSecondary}
                      value={weighInInput}
                      onChangeText={setWeighInInput}
                    />
                    <Pressable
                      style={[styles.weighInBtn, weighInSaving && styles.weighInBtnDisabled]}
                      disabled={weighInSaving}
                      onPress={async () => {
                        const w = parseFloat(weighInInput.replace(',', '.'));
                        if (!(w > 0) || w > 400) {
                          Alert.alert('Weigh-in', 'Enter a valid weight in kg.');
                          return;
                        }
                        const fatOpt = fatPctInput.trim()
                          ? parseFloat(fatPctInput.replace(',', '.'))
                          : undefined;
                        setWeighInSaving(true);
                        try {
                          const snap = await logManualWeighIn(w, {
                            gender: userGender!,
                            heightCm: heightCm!,
                            ageYears: userAge!,
                            fatPct: fatOpt,
                          });
                          setManualBodySnap(snap);
                          setWeighInInput('');
                          await loadManualTrend(snap);
                        } finally {
                          setWeighInSaving(false);
                        }
                      }}
                    >
                      <Text style={styles.weighInBtnText}>{weighInSaving ? '…' : 'Save'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.weighInRow}>
                    <TextInput
                      style={styles.weighInInput}
                      keyboardType="decimal-pad"
                      placeholder={
                        manualBodySnap?.fat_pct_source === 'user'
                          ? `Body fat · now ${manualBodySnap.fat_pct.toFixed(1)} %`
                          : 'Body fat % (optional)'
                      }
                      placeholderTextColor={WellnessColors.textSecondary}
                      value={fatPctInput}
                      onChangeText={setFatPctInput}
                    />
                    <Pressable
                      style={[styles.weighInBtn, fatPctSaving && styles.weighInBtnDisabled]}
                      disabled={fatPctSaving}
                      onPress={async () => {
                        const fp = parseFloat(fatPctInput.replace(',', '.'));
                        if (!(fp >= 3 && fp <= 65)) {
                          Alert.alert('Body fat', 'Enter a value between 3 and 65 %.');
                          return;
                        }
                        setFatPctSaving(true);
                        try {
                          const snap = await saveManualFatPct(fp, {
                            gender: userGender!,
                            heightCm: heightCm!,
                            ageYears: userAge!,
                          });
                          if (!snap) {
                            Alert.alert('Body fat', 'Log your weight first.');
                            return;
                          }
                          setManualBodySnap(snap);
                          await loadManualTrend(snap);
                        } finally {
                          setFatPctSaving(false);
                        }
                      }}
                    >
                      <Text style={styles.weighInBtnText}>{fatPctSaving ? '…' : 'Save'}</Text>
                    </Pressable>
                  </View>
                </>
              ) : null}

              <Pressable
                style={styles.birthdateSaveBtn}
                onPress={async () => {
                  const iso = birthdatePicker.toISOString().split('T')[0];
                  const cm = parseFloat(heightInput);
                  const prevLang = await getLanguage();
                  const langChanged = prevLang.code !== userLanguage.code;
                  await Promise.all([
                    setBirthdate(iso),
                    setGender(genderPicker),
                    setLanguage(userLanguage),
                    ...(cm > 0 ? [saveHeightCm(cm)] : []),
                  ]);
                  if (langChanged) {
                    await resetQuickQuestionsForLanguage(userLanguage);
                    // Generate-then-replace: forceCoachReview overwrites storage on success only.
                    await refreshCoachForLanguage();
                  }
                  if (cm > 0) setHeightCm(cm);
                  setUserGender(genderPicker);
                  setProfileExpanded(false);
                }}
              >
                <Text style={styles.birthdateSaveBtnText}>Save</Text>
              </Pressable>
            </View>
          )}

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
            onSaved={(t) => setMacroTarget(t ?? null)}
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
          />

          <View style={styles.groupDivider} />

          <AccountStrip
            user={user}
            expanded={accountExpanded}
            onToggleExpand={() => setAccountExpanded((e) => !e)}
            onSignedOut={onSignedOut}
            onDataRestored={refreshAfterBackupRestore}
          />

          <View style={styles.groupDivider} />
          <ClinicLinkStrip
            user={user}
            expanded={clinicExpanded}
            onToggleExpand={() => setClinicExpanded((e) => !e)}
          />

          <View style={styles.groupDivider} />
          <View style={styles.visitReportSection}>
            <Text style={styles.visitReportTitle}>{visitReportUi.title}</Text>
            <Text style={styles.visitReportSubtitle}>{visitReportUi.subtitle}</Text>
            <View style={styles.visitReportButtonGrid}>
              {VISIT_REPORT_DAY_OPTIONS.map((days) => (
                <Pressable
                  key={days}
                  style={[styles.visitReportButton, visitReportBusy && styles.visitReportButtonDisabled]}
                  onPress={() => void handleShareVisitReport(days)}
                  disabled={visitReportBusy}
                >
                  <Text style={styles.visitReportButtonText}>{visitReportUi.dayLabel(days)}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.visitReportNote}>{visitReportUi.cgmNote}</Text>
            {visitReportBusy ? (
              <ActivityIndicator color={WellnessColors.accentBlue} style={styles.visitReportSpinner} />
            ) : null}
          </View>

          <View style={styles.groupDivider} />
          <View style={styles.backupSection}>
            <Text style={styles.backupTitle}>App Backup</Text>
            <View style={styles.backupButtonRow}>
              <Pressable
                style={[styles.backupButton, backupBusy && styles.backupButtonDisabled]}
                onPress={handleExportBackup}
                disabled={backupBusy}
              >
                <Text style={styles.backupButtonText}>Export all data</Text>
              </Pressable>
              <Pressable
                style={[styles.backupButton, backupBusy && styles.backupButtonDisabled]}
                onPress={handleImportBackup}
                disabled={backupBusy}
              >
                <Text style={styles.backupButtonText}>Import all data</Text>
              </Pressable>
            </View>
            {backupBusy ? <ActivityIndicator color={WellnessColors.accentBlue} style={styles.backupSpinner} /> : null}
            {backupMessage ? <Text style={styles.backupMessage}>{backupMessage}</Text> : null}
          </View>
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
            onMacroTargetUpdated={(t) => setMacroTarget(t)}
            onFoodLogSaved={handleFoodSaved}
          />
        </SafeAreaProvider>
      </Modal>

      {/* ── Birthdate + gender one-time modal ────────────────────────── */}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: WellnessColors.background,
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
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  notice: {
    backgroundColor: WellnessColors.noticeSoftBg,
    borderWidth: 1,
    borderColor: WellnessColors.noticeSoftBorder,
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: dashCardGap,
  },
  noticeText: {
    color: WellnessColors.textPrimary,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '400',
  },
  bodyScanCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingTop: 10,
    paddingBottom: 16,
    paddingHorizontal: 18,
    marginBottom: dashCardGap,
  },
  bodyScanHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  bodyScanHeaderSpinner: {
    marginLeft: 8,
  },
  withingsLogoWrap: {
    width: 52,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  withingsHeaderLogo: {
    width: '100%',
    height: '100%',
  },
  withingsHeaderMiddle: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  withingsStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: '100%',
    minWidth: 40,
    minHeight: 34,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 999,
  },
  withingsStatusBadgeOn: {
    backgroundColor: WellnessColors.iconTintGreen,
    borderWidth: 1,
    borderColor: 'rgba(76, 175, 80, 0.35)',
  },
  withingsStatusBadgeOff: {
    backgroundColor: '#FFEBEE',
    borderWidth: 1,
    borderColor: 'rgba(255, 82, 82, 0.35)',
  },
  withingsStatusLine: {
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 16,
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
  withingsStatusLineOn: {
    color: '#2E7D32',
  },
  withingsStatusLineOff: {
    color: '#C62828',
  },
  withingsStatusLineAndroid: {
    includeFontPadding: false,
  },
  withingsLinkButtonCompact: {
    flexShrink: 0,
    borderWidth: 1,
    borderColor: WellnessColors.accentBlue,
    borderRadius: 14,
    paddingVertical: 7,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    minWidth: 72,
  },
  withingsLinkButtonDisabled: {
    opacity: 0.55,
  },
  withingsLinkButtonTextCompact: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.accentBlue,
  },
  linkErrorText: {
    color: WellnessColors.accentRed,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  bodyScanErrorText: {
    color: WellnessColors.accentRed,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 8,
  },
  bodyScanMeasured: {
    fontSize: 10,
    lineHeight: 14,
    color: WellnessColors.textSecondary,
    marginTop: 4,
    marginBottom: 12,
  },
  hrSyncDiagText: {
    fontSize: 10,
    lineHeight: 14,
    color: WellnessColors.textSecondary,
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
    color: WellnessColors.textSecondary,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  bodyScanMetricValueTriple: {
    fontSize: 16,
    fontWeight: '500',
    color: WellnessColors.textPrimary,
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
    color: WellnessColors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  bodyScanBmrDate: {
    fontSize: 10,
    lineHeight: 14,
    color: WellnessColors.textSecondary,
    textAlign: 'right',
    flexShrink: 0,
  },
  bodyScanEmpty: {
    fontSize: 14,
    color: WellnessColors.textSecondary,
    marginTop: 4,
  },
  /** Same horizontal gutter as surface cards (scroll padding + card inner padding). */
  chartBleed: {
    marginBottom: 0,
    alignSelf: 'stretch',
    width: '100%',
  },
  chartCardBleed: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingHorizontal: 8,
    paddingTop: 6,
    paddingBottom: 4,
    minHeight: 328,
    overflow: 'visible',
  },
  chartCardBleedCollapsed: {
    minHeight: 0,
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  trendBleed: {
    marginBottom: dashCardGap,
    alignSelf: 'stretch',
    width: '100%',
  },
  trendCardBleed: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 320,
    overflow: 'visible',
  },
  trendCardBleedCollapsed: {
    minHeight: 0,
    paddingTop: 10,
    paddingBottom: 10,
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
    borderTopColor: WellnessColors.gridLine,
  },
  dashCollapseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 2,
    paddingHorizontal: 4,
  },
  dashCollapseHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  dashCollapseTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    color: WellnessColors.textSecondary,
  },
  dashCollapseSub: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    marginTop: 2,
  },
  dashCollapseChevron: {
    fontSize: 18,
    color: WellnessColors.textSecondary,
    paddingHorizontal: 4,
  },
  trendErrorText: {
    color: WellnessColors.accentRed,
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
    color: WellnessColors.textSecondary,
  },
  careSensImportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: WellnessColors.accentBlue,
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 18,
    backgroundColor: WellnessColors.surface,
    minHeight: 56,
  },
  careSensImportButtonDisabled: {
    opacity: 0.65,
  },
  careSensImportButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 4,
  },
  careSensImportLogoWrap: {
    flex: 1,
    height: 40,
    minWidth: 0,
    marginRight: 12,
    justifyContent: 'center',
  },
  careSensImportButtonLogo: {
    width: '100%',
    height: '100%',
  },
  careSensImportButtonLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: WellnessColors.accentBlue,
    letterSpacing: 0.3,
  },
  glucoseHistorySection: {
    marginBottom: dashCardGap,
  },
  careSensImportSection: {
    gap: 6,
    marginBottom: dashCardGap,
  },
  primaryButton: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: dashCardGap,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: WellnessColors.surface,
    fontSize: 16,
    fontWeight: '600',
  },
  importMessageText: {
    fontSize: 14,
    color: WellnessColors.textPrimary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  errorText: {
    color: WellnessColors.accentRed,
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 20,
  },
  hcErrorBanner: {
    backgroundColor: WellnessColors.noticeSoftBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: WellnessColors.noticeSoftBorder,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: dashCardGap,
  },
  hcErrorBannerText: {
    fontSize: 14,
    color: WellnessColors.textPrimary,
    lineHeight: 20,
    marginBottom: 6,
  },
  hcErrorBannerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: WellnessColors.accentBlue,
  },
  // AI chat entry strip
  nudgeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B3D9F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: dashCardGap,
    gap: 10,
  },
  nudgeStripIcons: {
    fontSize: 20,
    letterSpacing: 1,
    flexShrink: 0,
  },
  nudgeStripTextCol: {
    flex: 1,
    minWidth: 0,
  },
  nudgeStripTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  nudgeStripSub: {
    fontSize: 12,
    fontWeight: '500',
    color: WellnessColors.textSecondary,
    marginTop: 1,
  },
  nudgeStripChevron: {
    fontSize: 20,
    color: WellnessColors.textSecondary,
    fontWeight: '300',
    flexShrink: 0,
  },
  _unused: {
  },
  previewFoot: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  groupCard: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 20,
    marginBottom: dashCardGap,
    overflow: 'hidden',
  },
  groupCardCollapsed: {
    paddingBottom: 2,
  },
  groupCardCollapseHeader: {
    paddingHorizontal: 12,
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: WellnessColors.gridLine,
    marginHorizontal: 16,
  },
  visitReportSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  visitReportTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  visitReportSubtitle: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 17,
  },
  visitReportButtonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  visitReportButton: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#2E7D5A',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WellnessColors.surface,
  },
  visitReportButtonDisabled: {
    opacity: 0.6,
  },
  visitReportButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#2E7D5A',
  },
  visitReportSpinner: {
    marginTop: 4,
  },
  visitReportNote: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    lineHeight: 15,
  },
  backupSection: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 10,
  },
  backupTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  backupButtonRow: {
    flexDirection: 'row',
    gap: 8,
  },
  backupButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: WellnessColors.accentBlue,
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WellnessColors.surface,
  },
  backupButtonDisabled: {
    opacity: 0.6,
  },
  backupButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.accentBlue,
  },
  backupSpinner: {
    marginTop: 2,
  },
  backupMessage: {
    fontSize: 12,
    lineHeight: 18,
    color: WellnessColors.textSecondary,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  profileRowIcon: {
    fontSize: 24,
  },
  profileRowInfo: {
    flex: 1,
  },
  profileRowTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
  },
  profileRowSub: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    marginTop: 2,
  },
  profileRowChevron: {
    fontSize: 20,
    color: WellnessColors.textSecondary,
    fontWeight: '300',
  },
  profileBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  birthdateOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  birthdateCard: {
    backgroundColor: WellnessColors.surface,
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
    color: WellnessColors.textPrimary,
    marginBottom: 8,
    textAlign: 'center',
  },
  birthdateSubtitle: {
    fontSize: 13,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 18,
  },
  birthdateFieldLabel: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
    color: WellnessColors.textSecondary,
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
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
    backgroundColor: WellnessColors.background,
  },
  genderBtnSelected: {
    borderColor: WellnessColors.accentGreen,
    backgroundColor: WellnessColors.accentGreen + '18',
  },
  genderBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
  genderBtnTextSelected: {
    color: WellnessColors.accentGreen,
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
    borderColor: WellnessColors.gridLine,
    alignItems: 'center',
    backgroundColor: WellnessColors.background,
  },
  langBtnSelected: {
    borderColor: WellnessColors.accentBlue,
    backgroundColor: WellnessColors.accentBlue + '15',
  },
  langBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
  },
  langBtnTextSelected: {
    color: WellnessColors.accentBlue,
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
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.background,
    fontSize: 18,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    textAlign: 'center',
  },
  heightUnit: {
    fontSize: 16,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    width: 32,
  },
  heightHint: {
    fontSize: 11,
    color: '#E65100',
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
    borderColor: WellnessColors.gridLine,
    backgroundColor: WellnessColors.background,
    marginBottom: 8,
  },
  datePickerBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
  },
  datePickerBtnIcon: {
    fontSize: 18,
  },
  birthdateAge: {
    fontSize: 14,
    fontWeight: '600',
    color: WellnessColors.accentBlue,
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
    color: WellnessColors.accentBlue,
  },
  weighInHint: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 17,
    marginBottom: 8,
  },
  weighInRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 16,
  },
  weighInInput: {
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
  weighInBtn: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  weighInBtnDisabled: {
    opacity: 0.6,
  },
  weighInBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  setupChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  setupChip: {
    backgroundColor: WellnessColors.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    minWidth: '30%',
    flexGrow: 1,
  },
  setupChipLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  setupChipValue: {
    fontSize: 13,
    fontWeight: '600',
    color: WellnessColors.textPrimary,
    marginTop: 2,
  },
  bodyScanProvenance: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  birthdateSaveBtn: {
    backgroundColor: WellnessColors.accentGreen,
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
