import DateTimePicker from '@react-native-community/datetimepicker';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
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
import { BmrHistoryChart7d } from '../components/BmrHistoryChart7d';
import { FoodLogModal } from '../components/FoodLogModal';
import { FoodMacroStrip } from '../components/FoodMacroStrip';
import { MetabolicChart } from '../components/MetabolicChart';
import { MetabolicTrendChart7d } from '../components/MetabolicTrendChart7d';
import { WeightTargetStrip } from '../components/WeightTargetStrip';
import { CONFIG } from '../config/env';
import { useHealthData } from '../hooks/useHealthData';
import {
  DEFAULT_TREND_PERIOD_DAYS,
  TREND_PERIOD_DAY_OPTIONS,
  localDayKeyFromMs,
  resolveCompositionPeriodAnchor,
  type CompositionSession,
  type MetabolicTrend7dDay,
} from '../logic/metabolicTrend7d';
import { awsDataService } from '../services/AwsDataService';
import { parseCareSensAirExportCsv } from '../services/careSensCsv';
import { foodLogDayKey, getTodayMeals, type FoodEntry } from '../services/FoodLogService';
import { getBirthdate, setBirthdate, computeAge, getCachedHeightCm, setHeightCm as saveHeightCm, getGender, setGender, type Gender } from '../services/TargetService';
import {
  buildAuthorizationUrl,
  fetchWeightMetrics,
  fetchBodyCompositionTrend7d,
  fetchHeartRateHistory,
  fetchTodayHeartRate,
  fetchUserHeight,
  fetchWorkoutsHistory,
  handleOAuthCallback,
  loadWithingsTokens,
  type WeightMetricsForDashboard,
  type WithingsCaloriePoint,
  type WithingsHeartRatePoint,
  type WorkoutSession,
} from '../services/WithingsApiService';
import { WellnessColors, cardShadow } from '../theme/wellness';
import { demoNoticeCopy } from '../utils/wellnessCopy';

/** Must match `styles.scroll.paddingHorizontal`. */
const SCROLL_HORIZONTAL_PADDING = 20;
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

export const DashboardScreen = () => {
  const { width: windowWidth } = useWindowDimensions();
  const brandHeaderHeight = useMemo(() => computeBrandHeaderHeight(windowWidth), [windowWidth]);
  const noticeOverlapUnderLogo = useMemo(
    () => Math.min(40, Math.round(brandHeaderHeight * 0.24)),
    [brandHeaderHeight]
  );

  const {
    glucoseData,
    heartRateData,
    activityZones,
    isLoading,
    error,
    refetch,
    applyImportedGlucose,
    dataSource,
  } = useHealthData();

  const [importBusy, setImportBusy] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);

  const [bodyScan, setBodyScan] = useState<WeightMetricsForDashboard | null>(null);
  const [bodyScanLoading, setBodyScanLoading] = useState(true);
  const [bodyScanError, setBodyScanError] = useState<string | null>(null);

  const [bodyTrendDays, setBodyTrendDays] = useState<MetabolicTrend7dDay[]>([]);
  const [bodyTrendSessions, setBodyTrendSessions] = useState<CompositionSession[]>([]);
  const [withingsHeartRate, setWithingsHeartRate] = useState<WithingsHeartRatePoint[]>([]);
  const [withingsCalories, setWithingsCalories] = useState<WithingsCaloriePoint[]>([]);
  const [workoutSessions, setWorkoutSessions] = useState<WorkoutSession[]>([]);
  const [trendPeriodDays, setTrendPeriodDays] = useState<number>(DEFAULT_TREND_PERIOD_DAYS);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);

  const [withingsLinked, setWithingsLinked] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [foodModalVisible, setFoodModalVisible] = useState(false);
  const [foodEditEntry, setFoodEditEntry] = useState<FoodEntry | undefined>();
  const [foodRefreshKey, setFoodRefreshKey] = useState(0);
  const [todayFoodEntries, setTodayFoodEntries] = useState<FoodEntry[]>([]);
  const todayDayKey = foodLogDayKey(Date.now());

  const [pullRefreshing, setPullRefreshing] = useState(false);

  // ─── Height + birthdate + gender ─────────────────────────────────────────
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [userGender, setUserGender] = useState<Gender | null>(null);
  const [birthdateModalVisible, setBirthdateModalVisible] = useState(false);
  const [birthdatePicker, setBirthdatePicker] = useState<Date>(new Date(1980, 0, 1));
  const [genderPicker, setGenderPicker] = useState<Gender>('male');
  const [showDatePickerDialog, setShowDatePickerDialog] = useState(false);
  const [heightInput, setHeightInput] = useState('');

  const refreshWithingsLinkState = useCallback(async () => {
    const t = await loadWithingsTokens();
    setWithingsLinked(Boolean(t?.refreshToken));
  }, []);

  const loadTodayFood = useCallback(async () => {
    const meals = await getTodayMeals();
    setTodayFoodEntries(meals);
  }, []);

  const loadHeightAndBirthdate = useCallback(async () => {
    // Load cached height first, then try fetching fresh from Withings.
    const cached = await getCachedHeightCm();
    if (cached) { setHeightCm(cached); setHeightInput(String(cached)); }
    const fromWithings = await fetchUserHeight();
    if (fromWithings) { setHeightCm(fromWithings); setHeightInput(String(fromWithings)); }

    // Show modal if gender or birthdate not yet stored.
    const [storedBd, gd] = await Promise.all([getBirthdate(), getGender()]);
    if (gd) setUserGender(gd);
    if (storedBd) { const d = new Date(storedBd); if (!isNaN(d.getTime())) setBirthdatePicker(d); }
    if (!gd || !storedBd) setBirthdateModalVisible(true);
  }, []);

  const handleFoodSaved = useCallback(() => {
    setFoodModalVisible(false);
    setFoodEditEntry(undefined);
    setFoodRefreshKey((k) => k + 1);
    loadTodayFood();
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

  /** Prefer device (continuous) heart rate, augmented with Withings spot readings. */
  const mergedHeartRate = useMemo(() => {
    if (withingsHeartRate.length === 0) return heartRateData;
    const all = [...heartRateData, ...withingsHeartRate];
    all.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    return all;
  }, [heartRateData, withingsHeartRate]);

  const loadBodyScan = useCallback(async () => {
    setBodyScanError(null);
    setBodyScanLoading(true);
    try {
      const metrics = await fetchWeightMetrics();
      setBodyScan(metrics);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load body scan.';
      setBodyScanError(message);
    } finally {
      setBodyScanLoading(false);
    }
  }, []);

  const loadTrend = useCallback(async () => {
    setTrendError(null);
    setTrendLoading(true);
    try {
      const payload = await fetchBodyCompositionTrend7d();
      setBodyTrendDays(payload.days);
      setBodyTrendSessions(payload.debug.sessions);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load 7-day trend.';
      setTrendError(message);
    } finally {
      setTrendLoading(false);
    }
  }, []);

  const loadHeartRate = useCallback(async () => {
    try {
      const { heartRate, calories } = await fetchHeartRateHistory();
      setWithingsHeartRate(heartRate);
      setWithingsCalories(calories);
    } catch {
      // Non-fatal: chart falls back to device heart rate only.
    }
  }, []);

  const loadWorkouts = useCallback(async () => {
    try {
      const sessions = await fetchWorkoutsHistory();
      setWorkoutSessions(sessions);
    } catch {
      // Non-fatal: workout overlay is informational.
    }
  }, []);

  const handlePullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await Promise.all([
        refetch(),
        loadBodyScan(),
        loadTrend(),
        loadHeartRate(),
        loadWorkouts(),
        loadTodayFood(),
      ]);
    } finally {
      setPullRefreshing(false);
    }
  }, [refetch, loadBodyScan, loadTrend, loadHeartRate, loadWorkouts, loadTodayFood]);

  useEffect(() => {
    void loadBodyScan();
  }, [loadBodyScan]);

  useEffect(() => {
    void loadTrend();
  }, [loadTrend]);

  useEffect(() => {
    void loadHeartRate();
  }, [loadHeartRate]);

  useEffect(() => {
    void loadWorkouts();
  }, [loadWorkouts]);

  useEffect(() => {
    void loadTodayFood();
  }, [loadTodayFood]);

  useEffect(() => {
    void loadHeightAndBirthdate();
  }, [loadHeightAndBirthdate]);

  /** Re-fetch today's Withings HR + calories every 10 min so recent readings appear without manual sync. */
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const { heartRate: todayHr, calories: todayCal } = await fetchTodayHeartRate();
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayStartMs = todayStart.getTime();

        if (todayHr.length > 0) {
          setWithingsHeartRate((prev) => {
            const older = prev.filter((p) => new Date(p.timestamp).getTime() < todayStartMs);
            const merged = [...older, ...todayHr];
            merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return merged;
          });
        }
        if (todayCal.length > 0) {
          setWithingsCalories((prev) => {
            const older = prev.filter((p) => new Date(p.timestamp).getTime() < todayStartMs);
            const merged = [...older, ...todayCal];
            merged.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
            return merged;
          });
        }
      } catch {
        // Non-fatal: periodic refresh failure is silent.
      }
    }, 10 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

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
        await Promise.all([loadBodyScan(), loadTrend(), loadHeartRate(), loadWorkouts()]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Withings link failed.';
      setLinkError(message);
    } finally {
      setLinkBusy(false);
    }
  }, [loadBodyScan, loadTrend, loadHeartRate, loadWorkouts, refreshWithingsLinkState]);

  const handleSync = async () => {
    const [, , , , result] = await Promise.all([loadBodyScan(), loadTrend(), loadHeartRate(), loadWorkouts(), refetch()]);
    if (!result) return;
    await awsDataService.persistData({
      syncedAt: new Date().toISOString(),
      glucose: result.metrics.glucose,
      steps: result.metrics.steps,
      heartRate: result.metrics.heartRate ?? [],
      efficiencyScore: result.efficiencyScore,
      insight: result.insight,
      activityZones: result.activityZones,
    });
  };

  const handleImportCareSensCsv = useCallback(async () => {
    setImportMessage(null);
    setImportBusy(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'application/csv', '*/*'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets?.[0]?.uri;
      if (!uri) {
        setImportMessage('No file was selected.');
        return;
      }
      const text = await FileSystem.readAsStringAsync(uri);
      const points = parseCareSensAirExportCsv(text);
      applyImportedGlucose(points);
      setImportMessage(`Imported ${points.length} glucose readings from CareSens CSV.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not import CSV.';
      setImportMessage(message);
    } finally {
      setImportBusy(false);
    }
  }, [applyImportedGlucose]);

  const demoNotice = demoNoticeCopy(dataSource);

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
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
                foodEntries={todayFoodEntries}
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
              <BmrHistoryChart7d days={visibleTrend.days} loading={trendLoading} />
            </View>
          </View>
        ) : null}

        {/* Section 5 — Food log */}
        <FoodMacroStrip
          dayKey={todayDayKey}
          onAddMeal={() => { setFoodEditEntry(undefined); setFoodModalVisible(true); }}
          onEditMeal={handleEditMeal}
          refreshKey={foodRefreshKey}
          burnKcalByDay={burnKcalByDay}
          onImported={() => { setFoodRefreshKey((k) => k + 1); loadTodayFood(); }}
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
          <Pressable
            style={styles.profileRow}
            onPress={async () => {
              const [bd, gd] = await Promise.all([getBirthdate(), getGender()]);
              if (gd) setGenderPicker(gd);
              if (bd) { const d = new Date(bd); if (!isNaN(d.getTime())) setBirthdatePicker(d); }
              setBirthdateModalVisible(true);
            }}
          >
            <Text style={styles.profileRowIcon}>👤</Text>
            <View style={styles.profileRowInfo}>
              <Text style={styles.profileRowTitle}>My Profile</Text>
              <Text style={styles.profileRowSub}>
                {[
                  userGender ? userGender.charAt(0).toUpperCase() + userGender.slice(1) : null,
                  heightCm ? `${heightCm} cm` : null,
                ].filter(Boolean).join(' · ') || 'Tap to set gender, height & birthdate'}
              </Text>
            </View>
            <Text style={styles.profileRowChevron}>›</Text>
          </Pressable>

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
          />
        </View>
      </ScrollView>

      {pullRefreshing && (
        <View style={styles.refreshOverlay} pointerEvents="none">
          <ActivityIndicator size="large" color="#000" />
        </View>
      )}

      <FoodLogModal
        visible={foodModalVisible}
        onClose={() => { setFoodModalVisible(false); setFoodEditEntry(undefined); }}
        onSaved={handleFoodSaved}
        editEntry={foodEditEntry}
      />

      {/* ── Birthdate + gender one-time modal ────────────────────────── */}
      {birthdateModalVisible && (
        <View style={styles.birthdateOverlay}>
          <View style={styles.birthdateCard}>
            <ScrollView
              style={{ width: '100%' }}
              contentContainerStyle={styles.birthdateScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.birthdateTitle}>One quick thing</Text>
              <Text style={styles.birthdateSubtitle}>
                Used by AI for personalised health recommendations. Only asked once.
              </Text>


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
              {heightInput === '' && (
                <Text style={styles.heightHint}>Not found in Withings — please enter manually</Text>
              )}

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
              <Text style={styles.birthdateAge}>
                Age: {computeAge(birthdatePicker.toISOString().split('T')[0])} years
              </Text>
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

              <Pressable
                style={styles.birthdateSaveBtn}
                onPress={async () => {
                  const iso = birthdatePicker.toISOString().split('T')[0];
                  const cm = parseFloat(heightInput);
                  await Promise.all([
                    setBirthdate(iso),
                    setGender(genderPicker),
                    ...(cm > 0 ? [saveHeightCm(cm)] : []),
                  ]);
                  if (cm > 0) setHeightCm(cm);
                  setUserGender(genderPicker);
                  setBirthdateModalVisible(false);
                }}
              >
                <Text style={styles.birthdateSaveBtnText}>Save</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: WellnessColors.background,
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
    paddingBottom: 40,
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
