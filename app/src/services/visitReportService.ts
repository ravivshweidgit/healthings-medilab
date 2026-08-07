/**
 * Build and share a nutritionist visit report (HTML via Android share sheet).
 */

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { PERF_WARN_SYNC_MS, timeAsync } from './AppDailyLogService';
import { periodDeltaKg, periodEndpointsKg } from '../logic/metabolicTrend7d';
import { localDayKeyFromMs } from '../logic/metabolicTrend7d';
import { buildVisitReportCharts } from '../logic/visitReportChartSvg';
import { buildClinicalVisitNote } from '../logic/visitReportClinical';
import {
  buildVisitReportProfile,
  formatVisitReportHtml,
  type VisitReportContent,
} from '../logic/visitReportExport';
import { buildLipidTrendPoints, getAllLabReports } from './LabLogService';
import { getDailyMacros } from './FoodLogService';
import { loadCgmViewFromStore, syncCgmStore } from './CgmPersistenceService';
import { buildPeriodReviewBlock, computeBurnKcalByDay, type PeriodReviewRequest } from './ReviewService';
import {
  computeAge,
  getBirthdate,
  getCachedHeightCm,
  getCoachMessage,
  getGender,
  getLanguage,
  getMacroTarget,
  getMentors,
  getUserRules,
  type UserLanguage,
} from './TargetService';
import { loadMetricsStore, syncMetricsStore } from './MetricsPersistenceService';
import { getUnitsPrefs, type UnitsPrefs } from './UnitsPreferenceService';
import { kgToDisplay, massUnitLabel } from '../logic/unitConvert';

export type VisitReportDayCount = 7 | 14 | 30 | 90;

export const VISIT_REPORT_DAY_OPTIONS: VisitReportDayCount[] = [7, 14, 30, 90];

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function weightTrendLine(
  bodyTrendDays: Array<{ dayKey: string; weightKg?: number | null }>,
  dayCount: number,
  massUnit: UnitsPrefs['mass'] = 'kg',
): string | null {
  const weights = bodyTrendDays.slice(-dayCount).map((d) => d.weightKg ?? null);
  const endpoints = periodEndpointsKg(weights);
  const delta = periodDeltaKg(weights);
  if (!endpoints) return null;
  const unit = massUnitLabel(massUnit);
  const start = kgToDisplay(endpoints.start, massUnit).toFixed(1);
  const end = kgToDisplay(endpoints.end, massUnit).toFixed(1);
  const deltaStr =
    delta != null
      ? ` (${delta >= 0 ? '+' : ''}${kgToDisplay(delta, massUnit).toFixed(1)} ${unit})`
      : '';
  return `${start} → ${end} ${unit}${deltaStr}`;
}

function reportWindowDayKeys(dayCount: number): string[] {
  const n = Math.min(dayCount, 128);
  const keys: string[] = [];
  for (let daysAgo = n - 1; daysAgo >= 0; daysAgo--) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    keys.push(localDayKeyFromMs(d.getTime()));
  }
  return keys;
}

export async function buildVisitReportContent(opts: {
  dayCount: VisitReportDayCount;
  lang?: UserLanguage | null;
}): Promise<VisitReportContent> {
  const lang = opts.lang ?? (await getLanguage());
  const dayCount = opts.dayCount;

  const [
    birthdate,
    gender,
    heightCm,
    macroTarget,
    userRules,
    coachMsg,
    mentors,
    labReports,
    unitsPrefs,
  ] = await Promise.all([
    getBirthdate(),
    getGender(),
    getCachedHeightCm(),
    getMacroTarget(),
    getUserRules(),
    getCoachMessage(),
    getMentors(),
    getAllLabReports(),
    getUnitsPrefs(),
  ]);

  await Promise.all([syncMetricsStore(), syncCgmStore()]);
  const [metricsStore, cgmView] = await Promise.all([
    loadMetricsStore(),
    loadCgmViewFromStore(),
  ]);
  const reportWorkouts = metricsStore.workouts;

  const bodyScan = metricsStore.bodyScan;
  const profile = buildVisitReportProfile({
    birthdate,
    gender,
    heightCm,
    weightKg: bodyScan?.weightKg ?? null,
    weightMeasuredAt: bodyScan?.measuredAt ?? null,
    weightTrendLine: weightTrendLine(metricsStore.bodyTrendDays, dayCount, unitsPrefs.mass),
  });

  const periodRequest: PeriodReviewRequest = { mode: 'days', days: dayCount };
  const exportedAt = new Date().toISOString();
  const periodReviewText = await buildPeriodReviewBlock(
    periodRequest,
    macroTarget,
    cgmView.glucose,
    { includeLabHistory: false },
  );

  const clinicalNote = await buildClinicalVisitNote({
    dayCount,
    exportedAt,
    lang,
    gender,
    profile,
    macroTarget,
    userRules,
    labs: labReports,
    coachMsg,
    includeCoach: mentors.includes('nutritionist'),
    bodyTrendDays: metricsStore.bodyTrendDays,
    compositionSessions: metricsStore.bodyTrendSessions,
    workouts: reportWorkouts,
    caloriePoints: metricsStore.calories,
    heartRatePoints: metricsStore.heartRate,
    glucose: cgmView.glucose,
    cgmSessionStarts: cgmView.cgmSessionStarts,
    cgmStatSummary: cgmView.cgmStatSummary,
    periodReviewText,
    unitsPrefs,
  });

  const dayKeys = reportWindowDayKeys(dayCount);
  const macrosList = await Promise.all(dayKeys.map((dk) => getDailyMacros(dk)));
  const eatenByDay = new Map(
    dayKeys.map((dk, i) => {
      const kcal = macrosList[i].kcal;
      return [dk, kcal > 0 ? Math.round(kcal) : 0] as const;
    }),
  );
  const burnByDay = computeBurnKcalByDay(
    metricsStore.bodyTrendDays,
    metricsStore.calories,
    reportWorkouts,
  );
  const chartAppendix = buildVisitReportCharts({
    dayCount,
    dayKeys,
    lipidPoints: buildLipidTrendPoints(labReports),
    gender,
    bodyTrendDays: metricsStore.bodyTrendDays,
    eatenByDay,
    burnByDay,
    glucose: cgmView.glucose,
    lang,
    unitsPrefs,
  });

  return {
    dayCount,
    exportedAt,
    lang,
    profile,
    macroTarget,
    labs: labReports,
    periodReviewText,
    userRules,
    coachMsg,
    includeCoach: mentors.includes('nutritionist'),
    clinicalNote,
    chartAppendix,
    unitsPrefs,
  };
}

export async function shareVisitReport(opts: {
  dayCount: VisitReportDayCount;
  lang?: UserLanguage | null;
}): Promise<{ ok: boolean; error?: string }> {
  return timeAsync(
    'shareVisitReport',
    async () => {
      const content = await buildVisitReportContent(opts);
      const html = formatVisitReportHtml(content);
      const filename = `healthings_visit_${opts.dayCount}d_${todayKey()}.html`;
      const cacheDir = FileSystem.cacheDirectory;
      if (!cacheDir) {
        return { ok: false, error: 'Cache directory unavailable.' };
      }

      const fileUri = `${cacheDir}${filename}`;
      await FileSystem.writeAsStringAsync(fileUri, html, { encoding: 'utf8' });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        return { ok: false, error: 'Sharing is not available on this device.' };
      }

      await Sharing.shareAsync(fileUri, {
        mimeType: 'text/html',
        dialogTitle: opts.lang?.code === 'he' ? 'שיתוף דוח ביקור' : 'Share visit report',
        UTI: 'public.html',
      });

      return { ok: true };
    },
    { days: opts.dayCount },
    PERF_WARN_SYNC_MS,
  );
}

/** Profile age helper for tests / diagnostics. */
export { computeAge };
