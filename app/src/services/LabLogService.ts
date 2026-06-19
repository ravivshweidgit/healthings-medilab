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
};

export type LabPanelType = 'chemistry' | 'cbc' | 'other';

export type LabPanel = {
  id: string;
  panelType: LabPanelType;
  results: LabResult[];
  note?: string;
};

export type LabReport = {
  id: string;
  labProvider: 'clalit' | 'unknown';
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
  labProvider: 'clalit' | 'unknown';
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
  const provider = report.labProvider === 'clalit' ? 'Clalit' : 'Lab';
  const types = report.panels.map((p) => p.panelType);
  const lines: string[] = [`${prefix} ${date} (${provider}) — ${panelTypeLabel(types)}:`];
  for (const panel of report.panels) {
    const row = panel.results.map(formatResultLine).join(' | ');
    if (row) lines.push(`  ${row}`);
  }
  return lines;
}

/** Build mentor context — latest draw or multi-report history. */
export function buildLabsAiContext(
  reports: LabReport[],
  mode: 'latest' | 'history' = 'latest',
): string | null {
  if (reports.length === 0) return null;
  const sorted = [...reports].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  const slice = mode === 'latest' ? sorted.slice(0, 1) : sorted;
  const header =
    mode === 'latest'
      ? 'LAB RESULTS (latest draw — local PDFs, not medical advice):'
      : `LAB HISTORY (${slice.length} draw${slice.length === 1 ? '' : 's'} in review window — not medical advice):`;
  const lines: string[] = [header];
  for (const r of slice) {
    lines.push(...formatReportBlock(r, 'Report'));
  }
  return lines.join('\n');
}

export async function getLabsAiContextForHeader(): Promise<string | null> {
  const latest = await getLatestLabReport();
  return buildLabsAiContext(latest ? [latest] : [], 'latest');
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

function resultMatchBlob(r: LabResult): string {
  return `${r.code} ${r.name} ${r.nameOriginal ?? ''}`.toUpperCase();
}

function isCreatinineResult(r: LabResult): boolean {
  return /CREATININ|קריאאטינין/.test(resultMatchBlob(r));
}

function isUreaResult(r: LabResult): boolean {
  return /\bUREA\b|\bBUN\b|אוריא/.test(resultMatchBlob(r));
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

function isLdlResult(r: LabResult): boolean {
  return /CHOLESTEROL.?LDL|LDL.?CHOL|\bLDL\b/i.test(resultMatchBlob(r));
}

function isTotalCholResult(r: LabResult): boolean {
  const b = resultMatchBlob(r);
  if (/NON.?HDL/i.test(b)) return false;
  return /\bCHOLESTEROL\b/i.test(b) && !/LDL|HDL|NON/i.test(b);
}

function isHdlResult(r: LabResult): boolean {
  return /CHOLESTEROL.?HDL|\bHDL\b/i.test(resultMatchBlob(r));
}

function isTriglycerideResult(r: LabResult): boolean {
  return /TRIGLYCERID|\bTG\b/i.test(resultMatchBlob(r));
}

function isGlucoseResult(r: LabResult): boolean {
  const b = resultMatchBlob(r);
  return /\bGLUCOSE\b|\bGLUC\b|סוכר/i.test(b) && !/HBA1C|A1C|המוגלובין/i.test(b);
}

function isHba1cResult(r: LabResult): boolean {
  return /HBA1C|HBA_?1C|HEMOGLOBIN.?A1C|\bA1C\b/i.test(resultMatchBlob(r));
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
