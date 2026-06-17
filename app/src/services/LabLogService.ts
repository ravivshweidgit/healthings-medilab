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
