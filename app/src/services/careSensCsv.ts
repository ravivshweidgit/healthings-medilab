import {
  excludeCgmWarmupReadings,
  type CgmSessionStart,
} from '../logic/cgmWarmupFilter';
import type { TimePoint } from './SamsungHealthService';

/** RFC4180-style row split (handles quoted fields with commas). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      out.push(cur);
      cur = '';
    } else {
      cur += c;
    }
  }
  out.push(cur);
  return out;
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase();
}

function parseCareSensDateTime(raw: string): Date {
  const s = raw.trim().replace(' ', 'T');
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d;
  const d2 = new Date(raw.trim());
  if (!Number.isNaN(d2.getTime())) return d2;
  throw new Error(`Unrecognized date/time: "${raw}"`);
}

function glucoseToMgDl(value: number, unitRaw: string): number {
  const u = unitRaw.trim().toLowerCase();
  if (u.includes('mmol')) {
    return Math.round(value * 18.0182);
  }
  return Math.round(value);
}

type ParsedRow = {
  timestamp: string;
  value: number;
  serial: string;
  sequence: number | null;
};

/**
 * CareSens Air: new sensor → serial number changes and Sequence resets (~6).
 * First ~24h readings are warm-up (often falsely low, e.g. 40–50 mg/dL).
 */
function detectCareSensSessionStarts(rows: ParsedRow[]): CgmSessionStart[] {
  const starts: CgmSessionStart[] = [];
  let prevSerial = '';
  let prevSeq: number | null = null;
  let prevMs = 0;

  for (const row of rows) {
    const ms = new Date(row.timestamp).getTime();
    if (Number.isNaN(ms)) continue;

    let isNewSession = false;
    if (starts.length === 0) {
      isNewSession = true;
    } else if (row.serial && prevSerial && row.serial !== prevSerial) {
      isNewSession = true;
    } else if (
      row.sequence != null &&
      prevSeq != null &&
      row.sequence <= 20 &&
      prevSeq - row.sequence > 50
    ) {
      isNewSession = true;
    } else if (prevMs > 0 && ms - prevMs > 24 * 60 * 60 * 1000) {
      isNewSession = true;
    }

    if (isNewSession) {
      starts.push({ startMs: ms, serial: row.serial || undefined });
    }

    if (row.serial) prevSerial = row.serial;
    if (row.sequence != null) prevSeq = row.sequence;
    prevMs = ms;
  }

  return starts;
}

export type CareSensParseResult = {
  /** All parsed points (raw — warm-up not removed). */
  points: TimePoint[];
  sessionStarts: CgmSessionStart[];
};

/**
 * Parses CareSens Air CSV and detects each sensor session (serial change / sequence reset).
 */
export function parseCareSensAirExportWithSessions(text: string): CareSensParseResult {
  const lines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trimEnd())
    .filter((l) => l.length > 0);
  if (lines.length < 2) {
    throw new Error('CSV is empty or has no data rows.');
  }

  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader);
  const dateIdx = headerCells.findIndex(
    (h) => h === 'date and time' || h.includes('datetime') || (h.includes('date') && h.includes('time'))
  );
  const glucoseIdx = headerCells.findIndex(
    (h) => h === 'glucose value' || h === 'glucose' || (h.includes('glucose') && h.includes('value'))
  );
  const unitIdx = headerCells.findIndex((h) => h === 'unit');
  const serialIdx = headerCells.findIndex((h) => h === 'serial number' || h.includes('serial'));
  const seqIdx = headerCells.findIndex((h) => h === 'sequence');

  if (dateIdx < 0 || glucoseIdx < 0) {
    throw new Error(
      'Could not find "Date and Time" / "Glucose Value" columns. Export a CareSens Air CSV from the official app.'
    );
  }

  const parsedRows: ParsedRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length <= Math.max(dateIdx, glucoseIdx)) continue;

    const dtRaw = cells[dateIdx]?.trim() ?? '';
    const gRaw = cells[glucoseIdx]?.replace(/^"|"$/g, '').trim() ?? '';
    const unitRaw = unitIdx >= 0 ? (cells[unitIdx]?.trim() ?? 'mg/dL') : 'mg/dL';

    if (!dtRaw || !gRaw) continue;

    const value = Number(gRaw.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) continue;

    const d = parseCareSensDateTime(dtRaw);
    const mgDl = glucoseToMgDl(value, unitRaw);
    const serial = serialIdx >= 0 ? (cells[serialIdx]?.trim() ?? '') : '';
    const seqRaw = seqIdx >= 0 ? cells[seqIdx]?.trim() : '';
    const sequence = seqRaw && /^\d+$/.test(seqRaw) ? parseInt(seqRaw, 10) : null;

    parsedRows.push({
      timestamp: d.toISOString(),
      value: mgDl,
      serial,
      sequence,
    });
  }

  parsedRows.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (parsedRows.length === 0) {
    throw new Error('No glucose rows could be parsed from this CSV.');
  }

  const sessionStarts = detectCareSensSessionStarts(parsedRows);
  const allPoints: TimePoint[] = parsedRows.map((r) => ({
    timestamp: r.timestamp,
    value: r.value,
  }));

  return { points: allPoints, sessionStarts };
}

/**
 * Parses CareSens Air export CSV — warm-up readings removed (first 24h per sensor).
 * @see sample: Device,Serial Number,Sequence,Date and Time,Glucose Value,Unit,Trend Rate
 */
export function parseCareSensAirExportCsv(text: string): TimePoint[] {
  const { points, sessionStarts } = parseCareSensAirExportWithSessions(text);
  return excludeCgmWarmupReadings(points, sessionStarts);
}

/** Parse without warm-up filter (for diagnostics). */
export function parseCareSensAirExportCsvRaw(text: string): TimePoint[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter((l) => l.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV is empty');
  const headerCells = parseCsvLine(lines[0]).map(normalizeHeader);
  const dateIdx = headerCells.findIndex((h) => h === 'date and time' || h.includes('datetime'));
  const glucoseIdx = headerCells.findIndex((h) => h.includes('glucose'));
  const unitIdx = headerCells.findIndex((h) => h === 'unit');
  const points: TimePoint[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    if (cells.length <= Math.max(dateIdx, glucoseIdx)) continue;
    const dtRaw = cells[dateIdx]?.trim() ?? '';
    const gRaw = cells[glucoseIdx]?.replace(/^"|"$/g, '').trim() ?? '';
    if (!dtRaw || !gRaw) continue;
    const value = Number(gRaw.replace(',', '.'));
    if (!Number.isFinite(value) || value <= 0) continue;
    const d = parseCareSensDateTime(dtRaw);
    const unitRaw = unitIdx >= 0 ? (cells[unitIdx]?.trim() ?? 'mg/dL') : 'mg/dL';
    points.push({ timestamp: d.toISOString(), value: glucoseToMgDl(value, unitRaw) });
  }
  points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  return points;
}
