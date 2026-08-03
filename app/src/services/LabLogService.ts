/**
 * Lab results persistence — AsyncStorage CRUD, same-day panel merge, mentor context.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';

export type LabResultFlag = 'low' | 'high' | 'normal' | 'unknown';

export type LabResult = {
  code: string;
  name: string;
  nameOriginal?: string;
  value: number;
  unit: string;
  flag: LabResultFlag;
  referenceText?: string;
  /** Numeric reference range bounds when printed (gauge scales, range columns). */
  refLow?: number;
  refHigh?: number;
};

export type LabPanelType = 'chemistry' | 'cbc' | 'other';

export type LabPanel = {
  id: string;
  panelType: LabPanelType;
  results: LabResult[];
  note?: string;
};

/** Known Israeli HMOs get a friendly label; anything else stays 'unknown'. */
export type LabProvider = 'clalit' | 'meuhedet' | 'maccabi' | 'leumit' | 'unknown';

export type LabReport = {
  id: string;
  labProvider: LabProvider;
  patientName?: string;
  patientId?: string;
  collectedAt: string;
  printedAt?: string;
  importedAt: string;
  source: 'pdf-ai' | 'manual';
  panels: LabPanel[];
  note?: string;
};

/** Draft from Gemini before save — one panel per PDF. */
export type ParsedLabPdf = {
  labProvider: LabProvider;
  patientName?: string;
  patientId?: string;
  collectedAt: string;
  printedAt?: string;
  panelType: LabPanelType;
  results: LabResult[];
  panelNote?: string;
};

const KEY_INDEX = 'lab_log_reports';

function storageKey(id: string): string {
  return `lab_report_${id}`;
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Local calendar day from ISO collectedAt. */
export function reportDateKey(collectedAt: string): string {
  const t = Date.parse(collectedAt);
  if (Number.isNaN(t)) return collectedAt.slice(0, 10);
  const d = new Date(t);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

async function getReportIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY_INDEX);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

async function setReportIds(ids: string[]): Promise<void> {
  await AsyncStorage.setItem(KEY_INDEX, JSON.stringify(ids));
}

async function readReport(id: string): Promise<LabReport | null> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(id));
    return raw ? (JSON.parse(raw) as LabReport) : null;
  } catch {
    return null;
  }
}

async function writeReport(report: LabReport): Promise<void> {
  await AsyncStorage.setItem(storageKey(report.id), JSON.stringify(report));
  const ids = await getReportIds();
  if (!ids.includes(report.id)) ids.push(report.id);
  const reports = await Promise.all(ids.map((id) => readReport(id)));
  const sorted = reports
    .filter((r): r is LabReport => r != null)
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt))
    .map((r) => r.id);
  await setReportIds(sorted);
}

export async function getAllLabReports(): Promise<LabReport[]> {
  const ids = await getReportIds();
  const reports = await Promise.all(ids.map((id) => readReport(id)));
  return reports
    .filter((r): r is LabReport => r != null)
    .sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
}

export async function getLatestLabReport(): Promise<LabReport | null> {
  const all = await getAllLabReports();
  return all[0] ?? null;
}

export async function getLabReportById(id: string): Promise<LabReport | null> {
  return readReport(id);
}

/** Reports whose draw date is in dayKeys (YYYY-MM-DD). */
export async function getLabReportsForDayKeys(dayKeys: string[]): Promise<LabReport[]> {
  const set = new Set(dayKeys);
  const all = await getAllLabReports();
  return all.filter((r) => set.has(reportDateKey(r.collectedAt)));
}

export async function findReportByDrawDate(dateKey: string): Promise<LabReport | null> {
  const all = await getAllLabReports();
  return all.find((r) => reportDateKey(r.collectedAt) === dateKey) ?? null;
}

function formatResultLine(r: LabResult): string {
  const parts: string[] = [`${r.code} ${r.value} ${r.unit}`];
  const extras: string[] = [];
  if (r.referenceText) extras.push(r.referenceText);
  if (r.flag === 'high' || r.flag === 'low') extras.push(r.flag);
  if (extras.length > 0) parts.push(`(${extras.join(', ')})`);
  return parts.join(' ');
}

function panelTypeLabel(types: LabPanelType[]): string {
  return types.join(' + ');
}

function formatReportBlock(report: LabReport, prefix: string): string[] {
  const date = reportDateKey(report.collectedAt);
  const providerLabels: Record<string, string> = {
    clalit: 'Clalit',
    meuhedet: 'Meuhedet',
    maccabi: 'Maccabi',
    leumit: 'Leumit',
  };
  const provider = providerLabels[report.labProvider] ?? 'Lab';
  const types = report.panels.map((p) => p.panelType);
  const lines: string[] = [`${prefix} ${date} (${provider}) — ${panelTypeLabel(types)}:`];
  for (const panel of report.panels) {
    const row = panel.results.map(formatResultLine).join(' | ');
    if (row) lines.push(`  ${row}`);
  }
  return lines;
}

/** Build mentor context — one draw, all saved draws, or period-review window. */
export function buildLabsAiContext(
  reports: LabReport[],
  mode: 'latest' | 'all' | 'history' = 'latest',
): string | null {
  if (reports.length === 0) return null;
  const sorted = [...reports].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  const slice = mode === 'latest' ? sorted.slice(0, 1) : sorted;
  const header =
    mode === 'latest'
      ? 'LAB RESULTS (latest draw — local PDFs, not medical advice):'
      : mode === 'all'
        ? `LAB RESULTS (${slice.length} saved draw${slice.length === 1 ? '' : 's'} — local PDFs, not medical advice):`
        : `LAB HISTORY (${slice.length} draw${slice.length === 1 ? '' : 's'} in review window — not medical advice):`;
  const lines: string[] = [header];
  for (const r of slice) {
    lines.push(...formatReportBlock(r, 'Report'));
  }
  return lines.join('\n');
}

/** All saved lab draws — injected into coach panel + chat USER DATA on every turn. */
export async function getLabsAiContextForHeader(): Promise<string | null> {
  const all = await getAllLabReports();
  return buildLabsAiContext(all, 'all');
}

export type KidneyLabMarker = {
  code: string;
  name: string;
  value: number;
  unit: string;
  flag: LabResultFlag;
};

export type KidneyLabStatus = {
  creatinine: KidneyLabMarker | null;
  urea: KidneyLabMarker | null;
  hasHighMarker: boolean;
};

function resultCodeKey(r: LabResult): string {
  const s = String(r.code ?? '').trim().toUpperCase();
  let out = '';
  let sep = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i]!;
    const ok = (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9');
    if (ok) {
      out += ch;
      sep = false;
    } else if (out.length > 0 && !sep) {
      out += '_';
      sep = true;
    }
  }
  if (out.endsWith('_')) out = out.slice(0, -1);
  return out;
}

/** Exact AI-assigned lab codes only — no name/Hebrew keyword matching. */
const CREATININE_CODES = new Set(['CREATININE', 'CREATININ']);
const UREA_CODES = new Set(['UREA', 'BUN']);
const LDL_CODES = new Set(['CHOLESTEROL_LDL', 'LDL', 'LDL_CHOL', 'LDL_C']);
const TOTAL_CHOL_CODES = new Set(['CHOLESTEROL', 'TOTAL_CHOLESTEROL', 'CHOL']);
const HDL_CODES = new Set(['CHOLESTEROL_HDL', 'HDL', 'HDL_CHOL', 'HDL_C']);
const TG_CODES = new Set(['TRIGLYCERIDES', 'TRIGLYCERIDE', 'TG']);
const GLUCOSE_CODES = new Set(['GLUCOSE', 'GLUC']);
const HBA1C_CODES = new Set(['HBA1C', 'HBA_1C', 'A1C', 'HEMOGLOBIN_A1C']);

function isCreatinineResult(r: LabResult): boolean {
  return CREATININE_CODES.has(resultCodeKey(r));
}

function isUreaResult(r: LabResult): boolean {
  return UREA_CODES.has(resultCodeKey(r));
}

function isLdlResult(r: LabResult): boolean {
  return LDL_CODES.has(resultCodeKey(r));
}

function isTotalCholResult(r: LabResult): boolean {
  return TOTAL_CHOL_CODES.has(resultCodeKey(r));
}

function isHdlResult(r: LabResult): boolean {
  return HDL_CODES.has(resultCodeKey(r));
}

function isTriglycerideResult(r: LabResult): boolean {
  return TG_CODES.has(resultCodeKey(r));
}

function isGlucoseResult(r: LabResult): boolean {
  return GLUCOSE_CODES.has(resultCodeKey(r));
}

function isHba1cResult(r: LabResult): boolean {
  return HBA1C_CODES.has(resultCodeKey(r));
}

/** Scan one lab report for creatinine / urea markers and high flags. */
export function scanKidneyLabStatus(report: LabReport): KidneyLabStatus {
  let creatinine: KidneyLabMarker | null = null;
  let urea: KidneyLabMarker | null = null;
  for (const panel of report.panels) {
    for (const r of panel.results) {
      if (!creatinine && isCreatinineResult(r)) {
        creatinine = {
          code: r.code,
          name: r.name,
          value: r.value,
          unit: r.unit,
          flag: r.flag,
        };
      }
      if (!urea && isUreaResult(r)) {
        urea = {
          code: r.code,
          name: r.name,
          value: r.value,
          unit: r.unit,
          flag: r.flag,
        };
      }
    }
  }
  const hasHighMarker =
    creatinine?.flag === 'high' || urea?.flag === 'high';
  return { creatinine, urea, hasHighMarker };
}

export async function getLatestKidneyLabStatus(): Promise<KidneyLabStatus | null> {
  const latest = await getLatestLabReport();
  if (!latest) return null;
  const status = scanKidneyLabStatus(latest);
  if (!status.creatinine && !status.urea) return null;
  return status;
}

export function formatKidneyMarkersSummary(status: KidneyLabStatus): string {
  const parts: string[] = [];
  if (status.creatinine) {
    const hi = status.creatinine.flag === 'high' ? ' (high)' : '';
    parts.push(`creatinine ${status.creatinine.value} ${status.creatinine.unit}${hi}`);
  }
  if (status.urea) {
    const hi = status.urea.flag === 'high' ? ' (high)' : '';
    parts.push(`urea ${status.urea.value} ${status.urea.unit}${hi}`);
  }
  return parts.join(', ');
}

export type LipidLabMarker = KidneyLabMarker;

export type LipidLabStatus = {
  ldl: LipidLabMarker | null;
  totalCholesterol: LipidLabMarker | null;
  triglycerides: LipidLabMarker | null;
  hdl: LipidLabMarker | null;
  hasActionableMarker: boolean;
};

export type GlycemicLabStatus = {
  glucose: LipidLabMarker | null;
  hba1c: LipidLabMarker | null;
  hasHighMarker: boolean;
};

function pickMarker(r: LabResult): LipidLabMarker {
  return {
    code: r.code,
    name: r.name,
    value: r.value,
    unit: r.unit,
    flag: r.flag,
  };
}

export function scanLipidLabStatus(report: LabReport): LipidLabStatus {
  let ldl: LipidLabMarker | null = null;
  let totalCholesterol: LipidLabMarker | null = null;
  let triglycerides: LipidLabMarker | null = null;
  let hdl: LipidLabMarker | null = null;

  for (const panel of report.panels) {
    for (const r of panel.results) {
      if (!ldl && isLdlResult(r)) ldl = pickMarker(r);
      if (!totalCholesterol && isTotalCholResult(r)) totalCholesterol = pickMarker(r);
      if (!triglycerides && isTriglycerideResult(r)) triglycerides = pickMarker(r);
      if (!hdl && isHdlResult(r)) hdl = pickMarker(r);
    }
  }

  const hasActionableMarker =
    ldl?.flag === 'high' ||
    totalCholesterol?.flag === 'high' ||
    triglycerides?.flag === 'high' ||
    hdl?.flag === 'low';

  return { ldl, totalCholesterol, triglycerides, hdl, hasActionableMarker };
}

export function scanGlycemicLabStatus(report: LabReport): GlycemicLabStatus {
  let glucose: LipidLabMarker | null = null;
  let hba1c: LipidLabMarker | null = null;

  for (const panel of report.panels) {
    for (const r of panel.results) {
      if (!glucose && isGlucoseResult(r)) glucose = pickMarker(r);
      if (!hba1c && isHba1cResult(r)) hba1c = pickMarker(r);
    }
  }

  const hasHighMarker = glucose?.flag === 'high' || hba1c?.flag === 'high';
  return { glucose, hba1c, hasHighMarker };
}

export async function getLatestLipidLabStatus(): Promise<LipidLabStatus | null> {
  const latest = await getLatestLabReport();
  if (!latest) return null;
  const status = scanLipidLabStatus(latest);
  if (!status.ldl && !status.totalCholesterol && !status.triglycerides && !status.hdl) {
    return null;
  }
  return status;
}

export async function getLatestGlycemicLabStatus(): Promise<GlycemicLabStatus | null> {
  const latest = await getLatestLabReport();
  if (!latest) return null;
  const status = scanGlycemicLabStatus(latest);
  if (!status.glucose && !status.hba1c) return null;
  return status;
}

/** One draw-day point for lipid trend charts (oldest → newest). */
export type LipidTrendPoint = {
  dateKey: string;
  collectedAt: string;
  ldl: number | null;
  totalCholesterol: number | null;
  hdl: number | null;
  triglycerides: number | null;
};

/** Extract lipid time series from saved reports — one row per draw date. */
export function buildLipidTrendPoints(reports: LabReport[]): LipidTrendPoint[] {
  const sorted = [...reports].sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
  const points: LipidTrendPoint[] = [];
  for (const report of sorted) {
    const lipids = scanLipidLabStatus(report);
    if (!lipids.ldl && !lipids.totalCholesterol && !lipids.hdl && !lipids.triglycerides) continue;
    points.push({
      dateKey: reportDateKey(report.collectedAt),
      collectedAt: report.collectedAt,
      ldl: lipids.ldl?.value ?? null,
      totalCholesterol: lipids.totalCholesterol?.value ?? null,
      hdl: lipids.hdl?.value ?? null,
      triglycerides: lipids.triglycerides?.value ?? null,
    });
  }
  return points;
}

/** AsyncStorage — patient’s selected custom lab trend marker (synced via backup/clinic snapshot). */
export const LAB_CUSTOM_TREND_CODE_KEY = 'lab_custom_trend_code';

/** Codes covered by the dedicated lipid chart — excluded from custom marker picker. */
export function isLipidChartCode(code: string): boolean {
  const k = resultCodeKey({ code, name: '', value: 0, unit: '', flag: 'unknown' });
  return (
    LDL_CODES.has(k) ||
    TOTAL_CHOL_CODES.has(k) ||
    HDL_CODES.has(k) ||
    TG_CODES.has(k)
  );
}

/** Collapse known alias families to one picker key (exact codes only — no name regex). */
export function canonicalLabTrendCode(code: string): string | null {
  const k = resultCodeKey({ code, name: '', value: 0, unit: '', flag: 'unknown' });
  if (!k || isLipidChartCode(k)) return null;
  if (CREATININE_CODES.has(k)) return 'CREATININE';
  if (UREA_CODES.has(k)) return 'UREA';
  if (GLUCOSE_CODES.has(k)) return 'GLUCOSE';
  if (HBA1C_CODES.has(k)) return 'HBA1C';
  return k;
}

function resultMatchesTrendCode(r: LabResult, selectedCode: string): boolean {
  const canon = canonicalLabTrendCode(r.code);
  const selected = canonicalLabTrendCode(selectedCode);
  if (!canon || !selected) return false;
  return canon === selected;
}

export type LabTrendMarkerOption = {
  code: string;
  name: string;
  unit: string;
  drawCount: number;
};

/** Union of non-lipid markers across reports, grouped by canonical code. */
export function listLabTrendMarkerOptions(reports: LabReport[]): LabTrendMarkerOption[] {
  const byCode = new Map<string, { name: string; unit: string; dates: Set<string> }>();
  for (const report of reports) {
    const dateKey = reportDateKey(report.collectedAt);
    for (const panel of report.panels) {
      for (const r of panel.results) {
        const code = canonicalLabTrendCode(r.code);
        if (!code) continue;
        const cur = byCode.get(code);
        if (!cur) {
          byCode.set(code, {
            name: r.name || code,
            unit: r.unit || '',
            dates: new Set([dateKey]),
          });
        } else {
          cur.dates.add(dateKey);
          if (!cur.name && r.name) cur.name = r.name;
          if (!cur.unit && r.unit) cur.unit = r.unit;
        }
      }
    }
  }
  return Array.from(byCode.entries())
    .map(([code, v]) => ({
      code,
      name: v.name,
      unit: v.unit,
      drawCount: v.dates.size,
    }))
    .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
}

export type LabMarkerTrendPoint = {
  dateKey: string;
  collectedAt: string;
  value: number;
};

export type LabMarkerTrendSeries = {
  code: string;
  name: string;
  unit: string;
  points: LabMarkerTrendPoint[];
  /** Single from–to for the whole series (latest draw that has both bounds). */
  refLow: number | null;
  refHigh: number | null;
};

/** Time series for one marker code; green band from a single refLow–refHigh. */
export function buildLabMarkerTrendSeries(
  reports: LabReport[],
  selectedCode: string,
): LabMarkerTrendSeries | null {
  const selected = canonicalLabTrendCode(selectedCode);
  if (!selected) return null;

  const sorted = [...reports].sort((a, b) => a.collectedAt.localeCompare(b.collectedAt));
  const points: LabMarkerTrendPoint[] = [];
  let name = selected;
  let unit = '';
  let refLow: number | null = null;
  let refHigh: number | null = null;

  // Newest → oldest for range pick
  for (let i = sorted.length - 1; i >= 0; i--) {
    const report = sorted[i]!;
    for (const panel of report.panels) {
      for (const r of panel.results) {
        if (!resultMatchesTrendCode(r, selected)) continue;
        if (
          refLow == null &&
          refHigh == null &&
          r.refLow != null &&
          r.refHigh != null &&
          Number.isFinite(r.refLow) &&
          Number.isFinite(r.refHigh)
        ) {
          refLow = r.refLow;
          refHigh = r.refHigh;
        }
        if (!unit && r.unit) unit = r.unit;
        if (name === selected && r.name) name = r.name;
      }
    }
  }

  for (const report of sorted) {
    let value: number | null = null;
    for (const panel of report.panels) {
      for (const r of panel.results) {
        if (!resultMatchesTrendCode(r, selected)) continue;
        if (Number.isFinite(r.value)) {
          value = r.value;
          if (r.name) name = r.name;
          if (r.unit) unit = r.unit;
          break;
        }
      }
      if (value != null) break;
    }
    if (value == null) continue;
    points.push({
      dateKey: reportDateKey(report.collectedAt),
      collectedAt: report.collectedAt,
      value,
    });
  }

  if (points.length === 0) return null;
  return { code: selected, name, unit, points, refLow, refHigh };
}

/** Latest draw + one prior draw for macro revision (trends: UREA, creatinine, LDL). */
export async function buildLabsForMacroRevision(): Promise<string | null> {
  const all = await getAllLabReports();
  const forRevision = all.slice(0, 2);
  if (forRevision.length === 0) return null;
  return buildLabsAiContext(
    forRevision,
    forRevision.length === 1 ? 'latest' : 'history',
  );
}

/** Merge parsed PDF panel into storage (same draw day → one report). */
export async function saveParsedLabPanel(parsed: ParsedLabPdf): Promise<LabReport> {
  const dateKey = reportDateKey(parsed.collectedAt);
  const existing = await findReportByDrawDate(dateKey);
  const panel: LabPanel = {
    id: makeId(),
    panelType: parsed.panelType,
    results: parsed.results,
    note: parsed.panelNote,
  };

  const now = new Date().toISOString();

  if (existing) {
    const panels = [...existing.panels];
    const idx = panels.findIndex((p) => p.panelType === parsed.panelType);
    if (idx >= 0) panels[idx] = panel;
    else panels.push(panel);
    const updated: LabReport = {
      ...existing,
      labProvider: parsed.labProvider !== 'unknown' ? parsed.labProvider : existing.labProvider,
      patientName: parsed.patientName ?? existing.patientName,
      patientId: parsed.patientId ?? existing.patientId,
      collectedAt: parsed.collectedAt,
      printedAt: parsed.printedAt ?? existing.printedAt,
      importedAt: now,
      source: 'pdf-ai',
      panels,
    };
    await writeReport(updated);
    return updated;
  }

  const created: LabReport = {
    id: makeId(),
    labProvider: parsed.labProvider,
    patientName: parsed.patientName,
    patientId: parsed.patientId,
    collectedAt: parsed.collectedAt,
    printedAt: parsed.printedAt,
    importedAt: now,
    source: 'pdf-ai',
    panels: [panel],
  };
  await writeReport(created);
  return created;
}

export async function updateLabReport(report: LabReport): Promise<void> {
  await writeReport({ ...report, importedAt: new Date().toISOString() });
}

export async function deleteLabReport(id: string): Promise<void> {
  await AsyncStorage.removeItem(storageKey(id));
  const ids = (await getReportIds()).filter((x) => x !== id);
  await setReportIds(ids);
}

// ─── Export / Import ──────────────────────────────────────────────────────────

type LabExportPayload = {
  version: 1;
  exportedAt: string;
  reports: Record<string, LabReport>;
};

function todayExportKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function exportLabLog(): Promise<void> {
  const all = await getAllLabReports();
  const reports: Record<string, LabReport> = {};
  for (const r of all) reports[r.id] = r;
  const payload: LabExportPayload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    reports,
  };
  const json = JSON.stringify(payload, null, 2);
  const filename = `lab_log_${todayExportKey()}.json`;
  const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
  if (!perm.granted) return;
  const fileUri = await FileSystem.StorageAccessFramework.createFileAsync(
    perm.directoryUri,
    filename,
    'application/json',
  );
  await FileSystem.writeAsStringAsync(fileUri, json, { encoding: 'utf8' });
}

export async function importLabLog(): Promise<number> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'application/json',
    copyToCacheDirectory: true,
  });
  if (result.canceled) return 0;
  const raw = await FileSystem.readAsStringAsync(result.assets[0].uri, { encoding: 'utf8' });
  const payload = JSON.parse(raw) as LabExportPayload;
  if (payload.version !== 1 || typeof payload.reports !== 'object') {
    throw new Error('Invalid lab log file format');
  }
  let count = 0;
  for (const report of Object.values(payload.reports)) {
    const prev = await readReport(report.id);
    await writeReport(report);
    if (!prev) count++;
  }
  return count;
}

/** Read PDF from document picker URI as base64. */
export async function readPdfBase64FromUri(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
}
