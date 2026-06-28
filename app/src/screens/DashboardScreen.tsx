import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { RulesStrip } from '../components/RulesStrip';
import { LabResultsStrip } from '../components/LabResultsStrip';
import { MacroTargetStrip } from '../components/MacroTargetStrip';
import { applyAutoMacroRevision, macroSuggestionToDailyTarget } from '../logic/macroAutoAdjust';
import { ChatScreen } from './ChatScreen';
import { CONFIG } from '../config/env';
import { useHealthData } from '../hooks/useHealthData';
import { useWithingsData } from '../hooks/useWithingsData';
import { openHealthConnectSettings } from '../services/HealthConnectService';
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
import { getAllLabReports, getLabsAiContextForHeader, type LabReport } from '../services/LabLogService';
import { exportLocalBackup, importLocalBackup } from '../services/LocalBackupService';
import { buildGlucoseMentorContext } from '../logic/mealGlucoseAnalysis';
import { activeMentorEmojis, mentorsCollectiveLabel } from '../logic/mentorLabels';
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
import { WellnessColors, cardShadow } from '../theme/wellness';
import { demoNoticeCopy } from '../utils/wellnessCopy';

/** Must match `styles.scroll.paddingHorizontal`. */
const SCROLL_HORIZONTAL_PADDING = 20;
/** How far back to load meals for historical chart markers (days). */
const CHART_MEAL_LOOKBACK_DAYS = 31;
const BRAND_LOGO = require('../../assets/brand-logo.png');
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

export const DashboardScreen = () => {
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

  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupMessage, setBackupMessage] = useState<string | null>(null);

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
  const [macroTarget, setMacroTarget] = useState<DailyMacroTarget | null>(null);
  const [userLanguage, setUserLanguage] = useState<UserLanguage>(SUPPORTED_LANGUAGES[0]);
  // expanded state for each collapsible row in the grouped card
  const [mentorExpanded, setMentorExpanded] = useState(false);
  const [rulesExpanded, setRulesExpanded] = useState(false);
  const [macroExpanded, setMacroExpanded] = useState(false);
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

  const loadLabReports = useCallback(async () => {
    const [reports, ctx, mt] = await Promise.all([
      getAllLabReports(),
      getLabsAiContextForHeader(),
      getMacroTarget(),
    ]);
    setLabReports(reports);
    setLabsAiContext(ctx);
    if (mt) setMacroTarget(mt);
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
    if (!gd || !storedBd) setProfileExpanded(true);

    // Load mentors, rules, macro target, body target, language
    const [m, r, mt, bt, lang] = await Promise.all([getMentors(), getUserRules(), getMacroTarget(), getBodyTarget(), getLanguage()]);
    setMentorsState(m);
    if (r) setUserRules(r);
    if (mt) setMacroTarget(mt);
    if (bt) setBodyTargetForMacros(bt);
    setUserLanguage(lang);
  }, []);

  const handleFoodSaved = useCallback(() => {
    setFoodModalVisible(false);
    setFoodEditEntry(undefined);
    setFoodRefreshKey((k) => k + 1);
    loadTodayFood().then(async () => {
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

  /**
   * Patch activityKcalDay from workoutSessions for any day the getactivity API left null.
   * This covers two cases: token missing user.activity scope, or Withings not synced yet.
   */
  const bodyTrendDaysWithActivity = useMemo((): MetabolicTrend7dDay[] => {
    if (workoutSessions.length === 0) return bodyTrendDays;
    // Sum workout kcal per local day key
    const workoutByDay = new Map<string, number>();
    for (const w of workoutSessions) {
      const dk = localDayKeyFromMs(w.startMs);
      workoutByDay.set(dk, (workoutByDay.get(dk) ?? 0) + w.kcal);
    }
    return bodyTrendDays.map((d) => {
      if (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay)) return d;
      const wkt = workoutByDay.get(d.dayKey);
      return wkt != null ? { ...d, activityKcalDay: wkt } : d;
    });
  }, [bodyTrendDays, workoutSessions]);

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
    const fallbackBmr = bodyScan?.bmrKcalDay;
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
  }, [bodyScan, bodyTrendDaysWithActivity, withingsCalories, workoutSessions]);

  /** Fat% derived from body scan (fatMassKg / weightKg * 100). */
  const fatPct = useMemo((): number | null => {
    const { fatMassKg, weightKg } = bodyScan ?? {};
    if (!fatMassKg || !weightKg || weightKg <= 0) return null;
    return (fatMassKg / weightKg) * 100;
  }, [bodyScan]);

  /** Weekly weight change (kg/week) via linear regression on up to last 14 days with data. */
  const weeklyWeightChange_kg = useMemo((): number | null => {
    const pts = bodyTrendDays
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
  }, [bodyTrendDays]);

  /** User age computed from stored birthdate. */
  const userAge = useMemo((): number | null => {
    if (!birthdatePicker) return null;
    const iso = birthdatePicker.toISOString().split('T')[0];
    return computeAge(iso);
  }, [birthdatePicker]);

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
      weightKg: bodyScan?.weightKg ?? null,
      fatPct,
      muscleMass_kg: bodyScan?.muscleMassKg ?? null,
      bmr_kcal: bodyScan?.bmrKcalDay ?? null,
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
    };
    coachContextRef.current = ctx;
    return ctx;
  }, [
    mentors, userAge, userGender, userMentorGender, mentorGenderPicker, heightCm, bodyScan, fatPct, bodyTargetForMacros,
    todayActualMacros, todayEstimatedBurn, todayFoodEntries.length, mealContext, mealGlucoseContext, glucoseData, macroTarget, userRules, labsAiContext, userLanguage,
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

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([refetch(), syncWithings(), refreshTodayIntraday(), loadTodayFood()]);
    } finally {
      setPullRefreshing(false);
    }
  }, [refetch, syncWithings, refreshTodayIntraday, loadTodayFood]);

  useEffect(() => {
    void loadTodayFood();
  }, [loadTodayFood]);

  useEffect(() => {
    void (async () => {
      await loadHeightAndBirthdate();
      await loadLabReports();
      await loadCoachMessage();
    })();
  }, [loadHeightAndBirthdate, loadLabReports, loadCoachMessage]);

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

  const handleImportBackup = useCallback(async () => {
    setBackupBusy(true);
    setBackupMessage(null);
    try {
      const result = await importLocalBackup();
      if (result.keysRestored === 0 && !result.tokensRestored) {
        setBackupMessage('Import cancelled.');
        return;
      }

      await Promise.all([
        refetch(),
        syncWithings(),
        loadTodayFood(),
        loadLabReports(),
        loadHeightAndBirthdate(),
        loadCoachMessage(),
      ]);

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
  }, [loadCoachMessage, loadHeightAndBirthdate, loadLabReports, loadTodayFood, refetch, syncWithings]);

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

        {/* Mentor nudge strip — tap to open chat */}
        {coachMsg && (
          <Pressable
            style={styles.nudgeStrip}
            onPress={() => setChatVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={`${mentorsCollectiveLabel(userLanguage, userMentorGender ?? mentorGenderPicker, userGender)}, ${coachMsg.actionItems.filter((i) => i.done).length} of ${coachMsg.actionItems.length} action items`}
          >
            <Text style={styles.nudgeStripIcons} numberOfLines={1}>
              {activeMentorEmojis(mentors)}
            </Text>
            <Text style={styles.nudgeStripCount} numberOfLines={1}>
              {`${coachMsg.actionItems.filter((i) => i.done).length}/${coachMsg.actionItems.length}`}
            </Text>
            <View style={styles.nudgeStripSpacer} />
            <Text style={styles.nudgeStripChevron}>›</Text>
          </Pressable>
        )}

        <View style={styles.glucoseHistorySection}>
          <View style={styles.chartBleed}>
            <View style={[styles.chartCardBleed, cardShadow]}>
              <MetabolicChart
                glucose={glucoseData}
                heartRate={mergedHeartRate}
                activityZones={activityZones}
                calorieBurns={withingsCalories}
                workoutSessions={workoutSessions}
                bmrKcalDay={bodyScan?.bmrKcalDay}
                foodEntries={chartMeals}
              />
            </View>
          </View>
        </View>

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

          {bodyScan && !bodyScanLoading ? (
            <>
              <View style={[styles.bodyScanRow, styles.bodyScanTripleRow]}>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Weight ${formatKg(bodyScan.weightKg)}`}
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
                    {formatKg(bodyScan.weightKg)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Muscle mass ${formatKg(bodyScan.muscleMassKg)}`}
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
                    {formatKg(bodyScan.muscleMassKg)}
                  </Text>
                </View>
                <View
                  style={styles.bodyScanMetricThird}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`Fat mass ${formatKg(bodyScan.fatMassKg)}`}
                >
                  <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                    Fat
                  </Text>
                  <Text
                    style={styles.bodyScanMetricValueTriple}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                    accessible={false}
                  >
                    {formatKg(bodyScan.fatMassKg)}
                  </Text>
                </View>
              </View>

              {bodyScan.bmrKcalDay != null && Number.isFinite(bodyScan.bmrKcalDay) ? (
                <View
                  style={styles.bodyScanBmrRow}
                  accessible
                  accessibilityRole="text"
                  accessibilityLabel={`BMR ${formatKcal(bodyScan.bmrKcalDay)} per day${
                    formatMeasuredAt(bodyScan.measuredAt)
                      ? `, measured ${formatMeasuredAt(bodyScan.measuredAt)}`
                      : ''
                  }`}
                >
                  <View style={styles.bodyScanBmrLeft}>
                    <Text style={styles.bodyScanMetricLabelTriple} accessible={false}>
                      BMR
                    </Text>
                    <Text style={styles.bodyScanBmrValue} accessible={false}>
                      {formatKcal(bodyScan.bmrKcalDay)}
                    </Text>
                  </View>
                  {formatMeasuredAt(bodyScan.measuredAt) ? (
                    <Text style={styles.bodyScanBmrDate} accessible={false}>
                      {formatMeasuredAt(bodyScan.measuredAt)}
                    </Text>
                  ) : null}
                </View>
              ) : formatMeasuredAt(bodyScan.measuredAt) ? (
                <Text style={styles.bodyScanMeasured}>
                  Last measurement · {formatMeasuredAt(bodyScan.measuredAt)}
                </Text>
              ) : null}

              {hrSyncDiagLine ? (
                <Text style={styles.hrSyncDiagText} selectable>
                  {hrSyncDiagLine}
                </Text>
              ) : null}

            </>
          ) : !bodyScanLoading && !bodyScan && !bodyScanError ? (
            <Text style={styles.bodyScanEmpty}>No body scan data yet.</Text>
          ) : null}
        </View>

        <View style={styles.trendBleed}>
          <View style={[styles.trendCardBleed, cardShadow]}>
            {trendError ? <Text style={styles.trendErrorText}>{trendError}</Text> : null}
            {trendLoading && !visibleTrend ? (
              <View style={styles.trendLoadingOnly}>
                <ActivityIndicator color={WellnessColors.accentBlue} />
                <Text style={styles.trendLoadingLabel}>Loading trend analysis…</Text>
              </View>
            ) : null}
            {visibleTrend ? (
              <MetabolicTrendChart7d
                days={visibleTrend.days}
                periodAnchor={visibleTrend.anchor}
                periodDays={trendPeriodDays}
                periodOptions={TREND_PERIOD_DAY_OPTIONS}
                availableDays={bodyTrendDays.length}
                onPeriodChange={setTrendPeriodDays}
              />
            ) : null}
          </View>
        </View>

        {hasEnergyHistory && visibleTrend ? (
          <View style={styles.trendBleed}>
            <View style={[styles.trendCardBleed, styles.bmrCardBleed, cardShadow]}>
              <BmrHistoryChart7d
                days={visibleTrend.days}
                loading={trendLoading}
                eatenKcalByDay={eatenKcalByDay}
              />
            </View>
          </View>
        ) : null}

        {/* Section 5 — Food log */}
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

        {dataSource !== 'health-connect' && !withingsLinked ? (
          <Text style={styles.previewFoot}>Preview · sample wellness data</Text>
        ) : null}

        {/* My Profile + My Targets — single grouped card */}
        <View style={[styles.groupCard, cardShadow]}>
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
            weightKg={bodyScan?.weightKg ?? null}
            fatPct={fatPct}
            muscleMass_kg={bodyScan?.muscleMassKg ?? null}
            bmr_kcal={bodyScan?.bmrKcalDay ?? null}
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
            weightKg={bodyScan?.weightKg ?? null}
            fatMassKg={bodyScan?.fatMassKg ?? null}
            muscleMass_kg={bodyScan?.muscleMassKg ?? null}
            bmr_kcal={bodyScan?.bmrKcalDay ?? null}
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
        </View>

        {/* Lab results — least-used; bottom of dashboard */}
        <LabResultsStrip
          reports={labReports}
          onReportsChanged={loadLabReports}
          lang={userLanguage}
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
    marginBottom: 10,
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
    marginBottom: 10,
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
  trendBleed: {
    marginBottom: 20,
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
  bmrCardBleed: {
    minHeight: 160,
    paddingTop: 14,
    paddingBottom: 14,
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
    marginBottom: 2,
  },
  careSensImportSection: {
    gap: 6,
    marginBottom: 10,
  },
  primaryButton: {
    backgroundColor: WellnessColors.accentBlue,
    borderRadius: 24,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 20,
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
    marginBottom: 12,
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
  // Mentor nudge strip
  nudgeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#EAF4FB',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#B3D9F0',
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 10,
    gap: 8,
  },
  nudgeStripIcons: {
    fontSize: 17,
    letterSpacing: 1,
    flexShrink: 0,
  },
  nudgeStripCount: {
    fontSize: 14,
    fontWeight: '700',
    color: WellnessColors.textPrimary,
    flexShrink: 0,
  },
  nudgeStripSpacer: {
    flex: 1,
    minWidth: 4,
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
    marginTop: 8,
    overflow: 'hidden',
  },
  groupDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: WellnessColors.gridLine,
    marginHorizontal: 16,
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
