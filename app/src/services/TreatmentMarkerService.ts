/**
 * Clinic treatment markers (prompt110 / be-41).
 * Canonical store — screens read here, never the API.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

export const TREATMENT_MARKERS_KEY = 'healthings:treatmentMarkers';
export const TREATMENT_MARKERS_SYNC_AT_KEY = 'healthings:treatmentMarkersSyncedAt';
export const LAB_MARKER_NUDGE_KEY = 'healthings:labMarkerNudge';

/** Canonical catalog code. Not a closed enum — overlay list is the source of truth. */
export type DietMarkerCode = string;
export type DietMarkerUnit = 'g' | 'mg' | 'mcg';
export type DietMarkerLabels = Record<string, { short: string; full: string }>;

const MARKER_CODE_RE = /^[A-Z][A-Z0-9_]{1,46}$/;

export type TreatmentMarker = {
  marker: DietMarkerCode;
  direction: 'cap' | 'floor';
  dailyTarget: number;
  unit: DietMarkerUnit;
  linkedLabCodes: string[];
  note?: string;
  setAt: string;
  setBy: string;
  labels?: DietMarkerLabels;
  estimateGuidance?: string;
  /** From the server catalog. Absent on markers stored before be-47b — see markerKcalPerGram. */
  kcalPerGram?: number;
  /** Additive (be-45). Absent ⇒ constant grams. */
  percentOfEnergy?: number;
  ofEnergy?: 'kcal_eaten';
};

export type MarkersHistoryEntry = {
  updatedAt: string;
  markers: TreatmentMarker[];
};

export type TreatmentMarkersStore = {
  markers: TreatmentMarker[];
  updatedAt: string;
  source: 'clinic';
  /** Prior orders (oldest → newest). Food Log picks the version in effect that day. */
  history?: MarkersHistoryEntry[];
};

function localDayKeyFromIso(iso: string): string | null {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return null;
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function cleanMarkerList(
  markers: TreatmentMarker[] | null | undefined,
  fallbackAt: string,
): TreatmentMarker[] {
  const cleaned: TreatmentMarker[] = [];
  const seen = new Set<string>();
  for (const m of markers || []) {
    if (!m) continue;
    const markerCode =
      String(m.marker || '').trim().toUpperCase() === 'ADDED_SUGAR_G' ? 'SUGAR_G' : m.marker;
    if (!isDietMarkerCode(markerCode)) continue;
    if (seen.has(markerCode)) continue;
    seen.add(markerCode);
    if (m.direction !== 'cap' && m.direction !== 'floor') continue;
    const dailyTarget = Number(m.dailyTarget);
    if (!Number.isFinite(dailyTarget) || dailyTarget <= 0) continue;
    const labels = parseLabels(m.labels);
    const guidance = m.estimateGuidance?.trim();
    cleaned.push({
      marker: markerCode,
      direction: m.direction,
      dailyTarget,
      unit: normalizeUnit(m.unit),
      linkedLabCodes: Array.isArray(m.linkedLabCodes)
        ? m.linkedLabCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean)
        : [],
      ...(m.note?.trim() ? { note: m.note.trim().slice(0, 500) } : {}),
      ...(labels ? { labels } : {}),
      ...(guidance ? { estimateGuidance: guidance.slice(0, 2000) } : {}),
      ...(typeof m.kcalPerGram === 'number' && m.kcalPerGram > 0 && m.kcalPerGram <= 20
        ? { kcalPerGram: m.kcalPerGram }
        : {}),
      ...(typeof m.percentOfEnergy === 'number' &&
      m.percentOfEnergy > 0 &&
      m.percentOfEnergy <= 100 &&
      m.ofEnergy === 'kcal_eaten'
        ? { percentOfEnergy: m.percentOfEnergy, ofEnergy: 'kcal_eaten' as const }
        : {}),
      setAt: m.setAt || fallbackAt,
      setBy: m.setBy || 'clinic',
    });
    if (cleaned.length >= 3) break;
  }
  return cleaned;
}

function cleanHistory(
  history: MarkersHistoryEntry[] | null | undefined,
): MarkersHistoryEntry[] {
  if (!Array.isArray(history) || history.length === 0) return [];
  const out: MarkersHistoryEntry[] = [];
  for (const h of history) {
    if (!h || typeof h.updatedAt !== 'string' || !h.updatedAt) continue;
    const markers = cleanMarkerList(h.markers, h.updatedAt);
    if (!markers.length) continue;
    out.push({ updatedAt: h.updatedAt, markers });
  }
  return out.slice(-20);
}

/** Clinic-queued past meal fill — mirrors server MarkersBackfillRequest. */
export type MarkersBackfillRequest = {
  id: string;
  days: number;
  requestedAt: string;
  requestedBy: string;
  status: 'pending' | 'done' | 'failed';
  completedAt?: string;
  mealsUpdated?: number;
  error?: string;
};

export type MarkerAmounts = Partial<Record<DietMarkerCode, number>>;

/** JSON field names Gemini returns per item (snake of the code). */
export function dietMarkerJsonField(code: DietMarkerCode): string {
  return code.toLowerCase();
}

/**
 * kcal/g for percent-of-energy caps. The server hydrates `kcalPerGram` from the catalog,
 * so this map is only reached for markers stored before that field existed — a new
 * percent-capable marker needs a catalog row, not a change here.
 */
const LEGACY_KCAL_PER_GRAM: Record<string, number> = { SAT_FAT_G: 9, SUGAR_G: 4 };

export function markerKcalPerGram(marker: TreatmentMarker | string): number | null {
  if (typeof marker !== 'string' && marker?.kcalPerGram != null) return marker.kcalPerGram;
  const code = typeof marker === 'string' ? marker : marker?.marker;
  return LEGACY_KCAL_PER_GRAM[code] ?? null;
}

export function isDietMarkerCode(raw: string): raw is DietMarkerCode {
  return MARKER_CODE_RE.test(String(raw || '').trim());
}

function normalizeUnit(raw: unknown): DietMarkerUnit {
  if (raw === 'mg' || raw === 'mcg' || raw === 'g') return raw;
  return 'g';
}

function parseLabels(raw: unknown): DietMarkerLabels | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const out: DietMarkerLabels = {};
  for (const [loc, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const short = String((val as { short?: string }).short || '').trim();
    const full = String((val as { full?: string }).full || '').trim();
    if (!short && !full) continue;
    out[loc.slice(0, 8)] = { short: short || full, full: full || short };
  }
  return Object.keys(out).length ? out : undefined;
}

export async function loadTreatmentMarkers(): Promise<TreatmentMarkersStore | null> {
  try {
    const raw = await AsyncStorage.getItem(TREATMENT_MARKERS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TreatmentMarkersStore;
    if (!parsed || !Array.isArray(parsed.markers)) return null;
    const markers = cleanMarkerList(parsed.markers, parsed.updatedAt || '');
    const history = cleanHistory(parsed.history);
    return {
      markers,
      updatedAt: parsed.updatedAt || '',
      source: 'clinic',
      ...(history.length ? { history } : {}),
    };
  } catch {
    return null;
  }
}

export async function saveTreatmentMarkers(store: TreatmentMarkersStore): Promise<void> {
  const history = cleanHistory(store.history);
  const payload: TreatmentMarkersStore = {
    markers: cleanMarkerList(store.markers, store.updatedAt || new Date().toISOString()),
    updatedAt: store.updatedAt || new Date().toISOString(),
    source: 'clinic',
    ...(history.length ? { history } : {}),
  };
  await AsyncStorage.setItem(TREATMENT_MARKERS_KEY, JSON.stringify(payload));
}

export async function clearTreatmentMarkers(): Promise<void> {
  await AsyncStorage.removeItem(TREATMENT_MARKERS_KEY);
}

/** Local calendar day of the current clinic markers order (YYYY-MM-DD). */
export function treatmentMarkersEffectiveDayKey(
  store: TreatmentMarkersStore | null,
): string | null {
  if (!store?.updatedAt) return null;
  return localDayKeyFromIso(store.updatedAt);
}

/**
 * Markers that were in effect on dayKey (latest order whose local day ≤ dayKey).
 * Days before the first order → []. Does not rewrite meal estimates in storage.
 */
export function markersForDay(
  store: TreatmentMarkersStore | null,
  dayKey: string,
): TreatmentMarker[] {
  if (!store || !dayKey) return [];
  const versions: MarkersHistoryEntry[] = [
    ...cleanHistory(store.history),
    { updatedAt: store.updatedAt, markers: store.markers },
  ];
  let best: TreatmentMarker[] | null = null;
  for (const v of versions) {
    const d = localDayKeyFromIso(v.updatedAt);
    if (!d || d > dayKey) continue;
    best = v.markers;
  }
  return best ?? [];
}

/**
 * @deprecated Prefer markersForDay — blanking past days after an update is not honest.
 */
export function treatmentMarkersApplyToDay(
  store: TreatmentMarkersStore | null,
  dayKey: string,
): boolean {
  return markersForDay(store, dayKey).length > 0;
}

/** Apply overlay.markers from GET /v1/clinic/overlays when newer. */
export async function applyClinicMarkersFromOverlay(
  markers: TreatmentMarker[] | null | undefined,
  overlayUpdatedAt: string,
  options?: {
    markersUpdatedAt?: string | null;
    history?: MarkersHistoryEntry[] | null;
  },
): Promise<TreatmentMarkersStore | null> {
  const markersAt =
    (options?.markersUpdatedAt && !Number.isNaN(Date.parse(options.markersUpdatedAt))
      ? options.markersUpdatedAt
      : null) || overlayUpdatedAt;
  if (Number.isNaN(Date.parse(markersAt))) return null;

  const cleaned = cleanMarkerList(markers || [], markersAt);
  const history = cleanHistory(options?.history);
  const syncToken = [
    markersAt,
    `h${history.length}`,
    cleaned
      .map((m) =>
        [
          m.marker,
          m.direction,
          m.dailyTarget,
          m.percentOfEnergy ?? '',
          m.ofEnergy ?? '',
        ].join(':'),
      )
      .join('|'),
  ].join('#');

  const lastRaw = await AsyncStorage.getItem(TREATMENT_MARKERS_SYNC_AT_KEY);
  if (lastRaw === syncToken) return null;

  if (!markers || markers.length === 0 || cleaned.length === 0) {
    await clearTreatmentMarkers();
    await AsyncStorage.setItem(TREATMENT_MARKERS_SYNC_AT_KEY, syncToken);
    return { markers: [], updatedAt: markersAt, source: 'clinic' };
  }

  const store: TreatmentMarkersStore = {
    markers: cleaned,
    updatedAt: markersAt,
    source: 'clinic',
    ...(history.length ? { history } : {}),
  };
  await saveTreatmentMarkers(store);
  await AsyncStorage.setItem(TREATMENT_MARKERS_SYNC_AT_KEY, syncToken);
  return store;
}

export function sumMarkerAmounts(parts: MarkerAmounts[]): MarkerAmounts {
  const out: MarkerAmounts = {};
  for (const part of parts) {
    for (const [code, v] of Object.entries(part)) {
      if (!isDietMarkerCode(code) || v == null || !Number.isFinite(v)) continue;
      out[code] = Math.round(((out[code] ?? 0) + v) * 10) / 10;
    }
  }
  return out;
}

/** Scale marker amounts with portion (Edit Item grams slider). */
export function scaleMarkerAmounts(amounts: MarkerAmounts, ratio: number): MarkerAmounts {
  if (!Number.isFinite(ratio) || ratio <= 0) return {};
  const out: MarkerAmounts = {};
  for (const [code, v] of Object.entries(amounts)) {
    if (!isDietMarkerCode(code) || v == null || !Number.isFinite(v)) continue;
    out[code] = Math.round(v * ratio * 10) / 10;
  }
  return out;
}

type MarkerPortionItem = {
  name: string;
  name_local?: string;
  grams: number;
  markers?: MarkerAmounts;
};

function itemMatchKey(it: MarkerPortionItem): string {
  return `${String(it.name || '').trim().toLowerCase()}|${String(it.name_local || '').trim().toLowerCase()}`;
}

function itemNameKey(it: MarkerPortionItem): string {
  return String(it.name || '').trim().toLowerCase();
}

/**
 * Chat corrections ("divide everything by 2") change grams/kcal/macros but Gemini
 * often copies the previous sat_fat_g (and other markers) unchanged. Edit Item
 * already scales markers with grams; this is the same math for a whole-meal
 * portion change. New unmatched items keep whatever Gemini estimated.
 */
export function rescaleMarkersWhenGramsChange<T extends MarkerPortionItem>(
  next: T[],
  prior: T[],
): T[] {
  const used = new Set<number>();
  return next.map((item) => {
    let prev: T | undefined;
    const want = itemMatchKey(item);
    const wantName = itemNameKey(item);
    if (want !== '|') {
      const i = prior.findIndex((p, idx) => !used.has(idx) && itemMatchKey(p) === want);
      if (i >= 0) {
        used.add(i);
        prev = prior[i];
      }
    }
    if (!prev && wantName) {
      const i = prior.findIndex((p, idx) => !used.has(idx) && itemNameKey(p) === wantName);
      if (i >= 0) {
        used.add(i);
        prev = prior[i];
      }
    }
    if (!prev?.markers || Object.keys(prev.markers).length === 0) return item;
    if (!(prev.grams > 0) || !(item.grams >= 0)) return item;
    const ratio = item.grams / prev.grams;
    if (Math.abs(ratio - 1) < 0.02) return item;
    const markers = scaleMarkerAmounts(prev.markers, ratio);
    return Object.keys(markers).length > 0 ? { ...item, markers } : item;
  });
}

export function extractMarkersFromFoodItem(
  it: Record<string, unknown>,
  active: DietMarkerCode[],
): MarkerAmounts {
  const nested =
    it.markers && typeof it.markers === 'object' && !Array.isArray(it.markers)
      ? (it.markers as Record<string, unknown>)
      : null;
  const out: MarkerAmounts = {};
  for (const code of active) {
    const field = dietMarkerJsonField(code);
    let raw = it[field] ?? it[code] ?? nested?.[code] ?? nested?.[field];
    // Legacy meal fields (added_sugar_g) → SUGAR_G totals.
    if ((raw == null || raw === '') && code === 'SUGAR_G') {
      raw = it.added_sugar_g ?? nested?.added_sugar_g ?? it.sugar_g ?? nested?.sugar_g;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) out[code] = Math.round(n * 10) / 10;
  }
  return out;
}

/** HARD lines for Gemini prompts — numbers only, no clinical reinterpretation. */
export function treatmentMarkersHardBlock(markers: TreatmentMarker[]): string {
  if (!markers.length) return '';
  const lines = markers.map(
    (m) =>
      `HARD from clinic: ${m.marker} ${m.direction} ${m.dailyTarget} ${m.unit}/day` +
      (m.note?.trim() ? ` (${m.note.trim()})` : ''),
  );
  return [
    'CLINIC TREATMENT MARKERS (HARD — do not revise, soften, or contradict):',
    ...lines,
    'Daily meal estimates must include these markers when estimating food.',
  ].join('\n');
}

/** One-line target list for period review / visit report headers. */
export function formatTreatmentMarkersTargetLine(markers: TreatmentMarker[]): string {
  if (!markers.length) return '';
  return (
    'Clinic treatment markers (HARD): ' +
    markers
      .map(
        (m) =>
          `${m.marker} ${m.direction} ${m.dailyTarget}${m.unit}/day` +
          (m.note?.trim() ? ` (${m.note.trim()})` : ''),
      )
      .join(' | ')
  );
}

/** Day/meal amounts vs clinic targets — for mentor period review & meal context. */
export function formatMarkerAmountsVsTargets(
  amounts: MarkerAmounts,
  markers: TreatmentMarker[],
): string {
  if (!markers.length) return '';
  const bits = markers.map((m) => {
    const v = amounts[m.marker];
    const shown = v != null && Number.isFinite(v) ? String(v) : '—';
    const sign = m.direction === 'floor' ? '≥' : '≤';
    const pct = m.percentOfEnergy != null ? ` ${m.percentOfEnergy}%` : '';
    return `${m.marker} ${shown} ${sign} ${m.dailyTarget}${m.unit}${pct}`;
  });
  return `Treat markers: ${bits.join(' · ')}`;
}

/**
 * Per-marker estimation rules for Gemini (definition only — no clinical targets).
 * SUGAR_G = simple sugars (mono/di); do not confuse with total carbs / starch.
 */
export function markerEstimateGuidance(markers: TreatmentMarker[]): string {
  const lines = markers
    .map((m) => m.estimateGuidance?.trim())
    .filter((s): s is string => Boolean(s));
  return lines.length ? `MARKER DEFINITIONS:\n${lines.join('\n')}` : '';
}

export function mealMarkerSchemaHint(markers: TreatmentMarker[]): string {
  if (!markers.length) return '';
  const fields = markers.map((m) => {
    const f = dietMarkerJsonField(m.marker);
    return `"${f}":0.0 /* ${m.marker} ${m.direction} ${m.dailyTarget}${m.unit}/day — estimate for this item */`;
  });
  const defs = markerEstimateGuidance(markers);
  return (
    `Also estimate per item (same units): ${fields.join(', ')}. ` +
    'These are absolute estimates for THAT item only (treatment monitoring) — best effort from the meal description/photo. ' +
    'When grams on an existing item change (half, double, divide the meal), scale these fields by the same factor as grams — they are amounts for that portion, not a constant per food name. ' +
    'Do NOT put remaining daily budget or day totals in these fields; the app sums all of today\'s meals itself.' +
    (defs ? ` ${defs}` : '')
  );
}

export type LabMarkerNudge = {
  marker: DietMarkerCode;
  labCode: string;
  labValue: string;
  seenAt: string;
};

export async function loadLabMarkerNudge(): Promise<LabMarkerNudge | null> {
  try {
    const raw = await AsyncStorage.getItem(LAB_MARKER_NUDGE_KEY);
    return raw ? (JSON.parse(raw) as LabMarkerNudge) : null;
  } catch {
    return null;
  }
}

export async function saveLabMarkerNudge(nudge: LabMarkerNudge): Promise<void> {
  await AsyncStorage.setItem(LAB_MARKER_NUDGE_KEY, JSON.stringify(nudge));
}

export async function clearLabMarkerNudge(): Promise<void> {
  await AsyncStorage.removeItem(LAB_MARKER_NUDGE_KEY);
}

/** After lab import: if a new result code matches an active marker's linkedLabCodes, queue a one-shot nudge. */
export async function maybeQueueLabMarkerNudgeFromReports(
  reports: Array<{
    collectedAt?: string;
    panels?: Array<{ results?: Array<{ code?: string; value?: string | number }> }>;
  }>,
): Promise<LabMarkerNudge | null> {
  const store = await loadTreatmentMarkers();
  if (!store?.markers?.length || !reports?.length) return null;
  const latest = [...reports].sort((a, b) =>
    String(b.collectedAt || '').localeCompare(String(a.collectedAt || '')),
  )[0];
  if (!latest) return null;
  for (const m of store.markers) {
    const linked = (m.linkedLabCodes || []).map((c) => c.toUpperCase());
    if (!linked.length) continue;
    for (const panel of latest.panels || []) {
      for (const r of panel.results || []) {
        const code = String(r.code || '').trim().toUpperCase();
        if (!code) continue;
        const hit = linked.some(
          (l) => code === l || code.includes(l) || l.includes(code),
        );
        if (!hit) continue;
        const nudge: LabMarkerNudge = {
          marker: m.marker,
          labCode: code,
          labValue: String(r.value ?? ''),
          seenAt: new Date().toISOString(),
        };
        await saveLabMarkerNudge(nudge);
        return nudge;
      }
    }
  }
  return null;
}
