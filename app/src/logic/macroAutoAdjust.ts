/**
 * Unified macro target revision — one pipeline for dashboard, chat, weigh-in, and lab import.
 */

import { Alert } from 'react-native';
import type { MetabolicTrend7dDay } from './metabolicTrend7d';
import {
  deriveFiberTargetFromCarbs,
  macroKcalFromPcf,
  parseCarbCapFromRules,
  postProcessMacroSuggestion,
} from './macroFiberCoupling';
import { buildPeriodReviewBlock, get7DayAverageBurnKcal } from '../services/ReviewService';
import { buildLabsForMacroRevision } from '../services/LabLogService';
import { loadWithingsStore, syncWithingsStore } from '../services/WithingsPersistenceService';
import {
  getBodyTarget,
  getBirthdate,
  getCachedHeightCm,
  getGender,
  getLanguage,
  getMacroTarget,
  getMentors,
  getUserRules,
  saveMacroTarget,
  computeAge,
  withFiberTarget,
  type BodyTarget,
  type DailyMacroTarget,
  type UserLanguage,
  type UserRules,
  getMacroAutoAdjustState,
  saveMacroAutoAdjustState,
  setMacroManualLock,
} from '../services/TargetService';
import { reviseMacroTargetsWithGemini, type MacroSuggestion } from '../services/GeminiService';

export type MacroRevisionTrigger =
  | 'dashboard-suggest'
  | 'chat-proposal'
  | 'weigh-in'
  | 'lab-import';

export type MacroRevisionBundle = {
  contextText: string;
  weightKg: number | null;
  fatMassKg: number | null;
  leanMassKg: number | null;
  bmr_kcal: number | null;
  avgBurn7d: number | null;
  bodyTarget: BodyTarget | null;
  userRules: UserRules | null;
  macroTarget: DailyMacroTarget | null;
};

function fmtKg(v: number | null | undefined, decimals = 1): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${v.toFixed(decimals)} kg`;
}

function formatCurrentMacroTarget(mt: DailyMacroTarget | null): string | null {
  if (!mt) return 'Current macro target: none (user reset or not set)';
  const fi = mt.fiber_g ?? deriveFiberTargetFromCarbs(mt.carb_g);
  return `Current macro target: ${mt.kcal} kcal | P${mt.protein_g}g C${mt.carb_g}g F${mt.fat_g}g Fi${fi}g | ${mt.diet_label}`;
}

function formatBodyTarget(bt: BodyTarget | null): string | null {
  if (!bt) return 'Body target: not set';
  return [
    `Body target: ${bt.targetWeight_kg} kg | fat ${bt.targetFatPct}% | muscle ${bt.targetMuscleMass_kg} kg`,
    `Start: ${bt.startWeight_kg} kg | muscle ${bt.startMuscle_kg} kg`,
  ].join('\n');
}

function formatUserRulesBlock(rules: UserRules | null): string | null {
  if (!rules) return null;
  const lines = ['My Rules — AI understood:'];
  if (rules.summary) lines.push(`Summary: ${rules.summary}`);
  for (const c of rules.constraints ?? []) lines.push(`- ${c}`);
  if (rules.aiContext) lines.push(`Constraints: ${rules.aiContext}`);
  return lines.join('\n');
}

function formatProfileBasics(opts: {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  fatMassKg: number | null;
  bmr_kcal: number | null;
  leanMassKg: number | null;
  avgBurn7d: number | null;
}): string {
  return [
    `Profile: sex ${opts.gender ?? 'unknown'} | age ${opts.age ?? '—'} | height ${opts.heightCm ?? '—'} cm`,
    `Weight: ${fmtKg(opts.weightKg)} | lean mass ${opts.leanMassKg != null ? `${opts.leanMassKg.toFixed(1)} kg` : '—'} | BMR ${opts.bmr_kcal ?? '—'} kcal/day`,
    `7-day avg burn: ${opts.avgBurn7d ?? '—'} kcal/day`,
  ].join('\n');
}

function formatWeightTrendLines(days: MetabolicTrend7dDay[], lookback: number): string | null {
  const withWeight = days.filter((d) => d.weightKg != null).slice(-lookback);
  if (withWeight.length === 0) return null;
  const lines = [`WEIGHT TREND (${withWeight.length}d):`];
  for (const d of withWeight) {
    lines.push(`  ${d.dayKey}: ${fmtKg(d.weightKg)}`);
  }
  const first = withWeight[0]!.weightKg!;
  const last = withWeight[withWeight.length - 1]!.weightKg!;
  lines.push(`  Δ ${(last - first).toFixed(1)} kg over window`);
  return lines.join('\n');
}

function formatBodyCompTrendLines(days: MetabolicTrend7dDay[], lookback: number): string | null {
  const slice = days.slice(-lookback);
  if (slice.length === 0) return null;
  const lines = [`BODY COMP TREND (${slice.length}d):`];
  for (const d of slice) {
    lines.push(
      `  ${d.dayKey}: W ${fmtKg(d.weightKg)} | fat ${d.fatMassKg != null ? `${d.fatMassKg.toFixed(1)} kg` : '—'} | muscle ${d.muscleMassKg != null ? `${d.muscleMassKg.toFixed(1)} kg` : '—'} | visceral ${d.visceralFatIndex ?? '—'}`,
    );
  }
  return lines.join('\n');
}

export async function buildMacroRevisionBundle(opts: {
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
}): Promise<MacroRevisionBundle> {
  await syncWithingsStore();
  const [macroTarget, bodyTarget, userRules, store, avgBurn7d, birthdate, heightCm, gender] =
    await Promise.all([
      getMacroTarget(),
      getBodyTarget(),
      getUserRules(),
      loadWithingsStore(),
      get7DayAverageBurnKcal(),
      getBirthdate(),
      getCachedHeightCm(),
      getGender(),
    ]);

  const scan = store.bodyScan;
  const weightKg = scan?.weightKg ?? null;
  const fatMassKg = scan?.fatMassKg ?? null;
  const leanMassKg =
    weightKg != null && fatMassKg != null ? weightKg - fatMassKg : null;
  const bmr_kcal = scan?.bmrKcalDay ?? null;
  const age = birthdate ? computeAge(birthdate) : null;

  const period7 = await buildPeriodReviewBlock({ mode: 'days', days: 7 }, macroTarget, null);
  const weightTrend14 = formatWeightTrendLines(store.bodyTrendDays, 14);
  const bodyTrend28 = formatBodyCompTrendLines(store.bodyTrendDays, 28);
  const labs = await buildLabsForMacroRevision();

  const header = `=== MACRO REVISION (${opts.trigger}${opts.triggerDetail ? `: ${opts.triggerDetail}` : ''}) ===`;

  const contextText = [
    header,
    formatCurrentMacroTarget(macroTarget),
    formatBodyTarget(bodyTarget),
    formatUserRulesBlock(userRules),
    formatProfileBasics({ age, gender, heightCm, weightKg, fatMassKg, bmr_kcal, leanMassKg, avgBurn7d }),
    weightTrend14,
    bodyTrend28,
    labs,
    period7,
    'Use ALL sections above to set daily macro TARGETS (not meal advice).',
  ]
    .filter(Boolean)
    .join('\n\n');

  return {
    contextText,
    weightKg,
    fatMassKg,
    leanMassKg,
    bmr_kcal,
    avgBurn7d,
    bodyTarget,
    userRules,
    macroTarget,
  };
}

export type GoalDirection = 'loss' | 'gain' | 'maintain';

export function goalDirection(startKg: number, targetKg: number): GoalDirection {
  if (Math.abs(startKg - targetKg) < 0.5) return 'maintain';
  return startKg > targetKg ? 'loss' : 'gain';
}

export function kcalAdjustmentFromGap(
  weightKg: number,
  targetKg: number,
  direction: GoalDirection,
): number {
  if (direction === 'maintain') return 0;

  if (direction === 'loss') {
    const gapKg = weightKg - targetKg;
    if (gapKg <= 0) return 0;
    return -Math.min(500, Math.max(200, Math.round(gapKg * 150)));
  }

  const gapKg = targetKg - weightKg;
  if (gapKg <= 0) return 0;
  return Math.min(400, Math.max(200, Math.round(gapKg * 120)));
}

export function deterministicMacroFallback(bundle: MacroRevisionBundle): MacroSuggestion {
  const burn = bundle.avgBurn7d ?? bundle.bmr_kcal ?? 2000;
  const weightKg = bundle.weightKg ?? bundle.bodyTarget?.startWeight_kg ?? 80;
  const targetKg = bundle.bodyTarget?.targetWeight_kg ?? weightKg;
  const startKg = bundle.bodyTarget?.startWeight_kg ?? weightKg;
  const direction = goalDirection(startKg, targetKg);
  const adj = kcalAdjustmentFromGap(weightKg, targetKg, direction);
  const targetKcal = Math.round(burn + adj);

  const lean = bundle.leanMassKg ?? (weightKg * 0.75);
  const protein_g = Math.round(1.8 * lean);
  const carbCap = parseCarbCapFromRules(bundle.userRules);
  const carb_g = carbCap ?? 30;
  const fiber_g = deriveFiberTargetFromCarbs(carb_g);
  const fat_g = Math.max(
    40,
    Math.round((targetKcal - 4 * protein_g - 4 * carb_g) / 9),
  );
  const kcal = macroKcalFromPcf(protein_g, carb_g, fat_g);

  const diet =
    direction === 'loss'
      ? adj < 0
        ? 'Low carb · deficit'
        : 'Low carb · maintenance'
      : direction === 'gain'
        ? 'Balanced · surplus'
        : 'Balanced · maintenance';

  const reasoning =
    bundle.avgBurn7d != null
      ? `7d avg burn ${bundle.avgBurn7d}; weight ${weightKg}→${targetKg}; fallback taper`
      : `BMR-based; weight ${weightKg}→${targetKg}; fallback`;

  return postProcessMacroSuggestion(
    { protein_g, fat_g, carb_g, fiber_g, kcal, diet_label: diet, reasoning },
    bundle.userRules,
  );
}

export function macroSuggestionToDailyTarget(
  result: MacroSuggestion,
  userRules: UserRules | null,
  mentors: Awaited<ReturnType<typeof getMentors>>,
): DailyMacroTarget {
  const now = new Date().toISOString();
  return withFiberTarget({
    protein_g: result.protein_g,
    fat_g: result.fat_g,
    carb_g: result.carb_g,
    fiber_g: result.fiber_g,
    kcal: result.kcal,
    diet_label: result.diet_label,
    reasoning: result.reasoning,
    rulesContext: userRules?.aiContext ?? '',
    mentors,
    aiSuggested: {
      protein_g: result.protein_g,
      fat_g: result.fat_g,
      carb_g: result.carb_g,
      fiber_g: result.fiber_g,
      kcal: result.kcal,
    },
    analyzedAt: now,
  });
}

export async function suggestMacroTargets(opts: {
  trigger: MacroRevisionTrigger;
  triggerDetail?: string;
  lang?: UserLanguage | null;
}): Promise<MacroSuggestion> {
  const bundle = await buildMacroRevisionBundle(opts);
  const lang = opts.lang ?? (await getLanguage());
  try {
    const raw = await reviseMacroTargetsWithGemini(bundle.contextText, lang);
    return postProcessMacroSuggestion(raw, bundle.userRules);
  } catch {
    return deterministicMacroFallback(bundle);
  }
}

export function materiallyChanged(
  saved: DailyMacroTarget | null,
  proposed: MacroSuggestion,
): boolean {
  if (!saved) return true;
  if (Math.abs(saved.kcal - proposed.kcal) >= 50) return true;
  if (Math.abs(saved.protein_g - proposed.protein_g) >= 5) return true;
  if (Math.abs(saved.carb_g - proposed.carb_g) >= 5) return true;
  if (Math.abs(saved.fat_g - proposed.fat_g) >= 5) return true;
  const savedFi = saved.fiber_g ?? deriveFiberTargetFromCarbs(saved.carb_g);
  if (Math.abs(savedFi - proposed.fiber_g) >= 5) return true;
  return false;
}

function notifyMacroUpdated(
  trigger: MacroRevisionTrigger,
  triggerDetail: string | undefined,
  result: MacroSuggestion,
  langCode: string,
): void {
  const fi = result.fiber_g;
  const line = `${result.kcal} kcal · P${result.protein_g} · C${result.carb_g} · F${result.fat_g} · Fi${fi}`;
  const he = langCode === 'he';
  let title = he ? 'יעדי המאקרו עודכנו' : 'Macro targets updated';
  let body = result.reasoning;
  if (trigger === 'weigh-in' && triggerDetail) {
    body = he
      ? `אחרי שקילה ${triggerDetail}: ${line}`
      : `After weigh-in ${triggerDetail}: ${line}`;
  } else if (trigger === 'lab-import') {
    body = he ? `אחרי ייבוא בדיקות: ${line}` : `After lab import: ${line}\n${result.reasoning}`;
  } else {
    body = `${line}\n${result.reasoning}`;
  }
  Alert.alert(title, body, [{ text: he ? 'הבנתי' : 'OK' }]);
}

export async function applyAutoMacroRevision(opts: {
  trigger: 'weigh-in' | 'lab-import';
  triggerDetail?: string;
  weightKg?: number | null;
  labReportId?: string | null;
  onSaved?: (t: DailyMacroTarget) => void;
}): Promise<DailyMacroTarget | null> {
  const state = await getMacroAutoAdjustState();
  const lang = await getLanguage();

  if (opts.trigger === 'weigh-in') {
    const w = opts.weightKg;
    if (w == null) return null;
    if (state.lastAdjustedAt === '' && state.lastWeightKg === 0) {
      await saveMacroAutoAdjustState({ ...state, lastWeightKg: w });
      return null;
    }
    if (Math.abs(state.lastWeightKg - w) < 0.05) return null;
  }

  if (opts.trigger === 'lab-import') {
    const id = opts.labReportId;
    if (!id) return null;
    if (state.lastLabReportId === id) return null;
  }

  const proposed = await suggestMacroTargets({
    trigger: opts.trigger,
    triggerDetail: opts.triggerDetail,
    lang,
  });

  const saved = await getMacroTarget();
  if (!materiallyChanged(saved, proposed)) {
    if (opts.trigger === 'weigh-in' && opts.weightKg != null) {
      await saveMacroAutoAdjustState({
        ...state,
        lastWeightKg: opts.weightKg,
        manualLock: false,
      });
    }
    if (opts.trigger === 'lab-import' && opts.labReportId) {
      await saveMacroAutoAdjustState({
        ...state,
        lastLabReportId: opts.labReportId,
        manualLock: false,
      });
    }
    return null;
  }

  const [userRules, mentors] = await Promise.all([getUserRules(), getMentors()]);
  const target = macroSuggestionToDailyTarget(proposed, userRules, mentors);
  await saveMacroTarget(target);

  await saveMacroAutoAdjustState({
    lastWeightKg: opts.weightKg ?? state.lastWeightKg,
    lastLabReportId: opts.labReportId ?? state.lastLabReportId,
    lastKcal: target.kcal,
    lastAdjustedAt: new Date().toISOString(),
    manualLock: false,
  });

  notifyMacroUpdated(opts.trigger, opts.triggerDetail, proposed, lang.code);
  opts.onSaved?.(target);
  return target;
}

export async function onMacroTargetUserEdit(): Promise<void> {
  await setMacroManualLock(true);
}
