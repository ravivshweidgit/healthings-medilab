import {
  excludeCgmWarmupReadings,
  type CgmSessionStart,
} from '../logic/cgmWarmupFilter';
import type { TimePoint } from './HealthConnectService';

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
  const s = raw.trim();
  // CareSens writes local wall clock with no TZ. Parse as local components so Hermes
  // does not treat "2026-07-24T22:33:25" as UTC and shift the series by hours.
  const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?/.exec(s);
  if (m) {
    const d = new Date(
      Number(m[1]),
      Number(m[2]) - 1,
      Number(m[3]),
      Number(m[4]),
      Number(m[5]),
      Number(m[6] ?? '0'),
    );
    if (!Number.isNaN(d.getTime())) return d;
  }
  const d2 = new Date(s.replace(' ', 'T'));
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
  /** Inclusive range of parsed rows (ISO), for import UI / truncation checks. */
  firstTimestamp: string;
  lastTimestamp: string;
};

function decodeBase64Utf8(b64: string): string {
  if (typeof globalThis.atob === 'function') {
    const bin = globalThis.atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  }
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(b64, 'base64').toString('utf8');
  }
  return '';
}

type CareSensReadAsString = (
  uri: string,
  opts?: { encoding?: 'utf8' | 'base64'; position?: number; length?: number },
) => Promise<string>;

/**
 * Read a DocumentPicker / cache URI as UTF-8 text.
 * Android sometimes returns only the first ~half of a ~1MB CareSens export via a
 * single utf8 read (import stopped at the June 6 sensor). Prefer the longest
 * successful strategy: one-shot utf8, chunked utf8, fetch, then base64.
 */
export async function readCareSensCsvText(
  uri: string,
  readAsString: CareSensReadAsString,
  getInfo?: (uri: string) => Promise<{ exists: boolean; size?: number }>,
  expectedBytes?: number | null,
  fetchText?: (uri: string) => Promise<string>,
): Promise<{ text: string; bytesRead: number; expectedBytes: number | null; truncated: boolean }> {
  let fileBytes: number | null =
    expectedBytes != null && expectedBytes > 0 ? expectedBytes : null;
  if (getInfo) {
    try {
      const info = await getInfo(uri);
      if (info.exists && typeof info.size === 'number' && info.size > 0) {
        fileBytes = fileBytes == null ? info.size : Math.max(fileBytes, info.size);
      }
    } catch {
      // Non-fatal
    }
  }

  const keepLongest = (current: string, next: string) =>
    next.length > current.length ? next : current;

  let text = '';
  try {
    text = keepLongest(text, await readAsString(uri, { encoding: 'utf8' }));
  } catch {
    // try other strategies
  }

  // Chunked read — recovers the tail when a one-shot utf8 read stops mid-file
  // even though the cached file size is complete.
  if (fileBytes != null && fileBytes > 8192 && text.length < fileBytes * 0.95) {
    try {
      const chunkSize = 256 * 1024;
      const parts: string[] = [];
      for (let pos = 0; pos < fileBytes; pos += chunkSize) {
        const length = Math.min(chunkSize, fileBytes - pos);
        parts.push(await readAsString(uri, { encoding: 'utf8', position: pos, length }));
      }
      text = keepLongest(text, parts.join(''));
    } catch {
      // optional path
    }
  }

  if (fetchText && (fileBytes == null || text.length < fileBytes * 0.95)) {
    try {
      text = keepLongest(text, await fetchText(uri));
    } catch {
      // optional path
    }
  }

  if (fileBytes == null || text.length < fileBytes * 0.95) {
    try {
      text = keepLongest(text, decodeBase64Utf8(await readAsString(uri, { encoding: 'base64' })));
    } catch {
      // optional path
    }
  }

  if (!text) {
    throw new Error('Could not read CareSens CSV from the selected file.');
  }

  const truncated =
    fileBytes != null && fileBytes > 4096 && text.length < fileBytes * 0.85;
  return {
    text,
    bytesRead: text.length,
    expectedBytes: fileBytes,
    truncated,
  };
}

function formatCareSensDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Short range label for the import toast, e.g. "Apr 4 – Jul 24, 2026". */
export function formatCareSensImportRange(firstIso: string, lastIso: string): string {
  return `${formatCareSensDay(firstIso)} → ${formatCareSensDay(lastIso)}`;
}

/**
 * CareSens filenames often embed the export instant, e.g.
 * `CareSensAir_Export_…_2026-07-24_223615.csv`. If the parsed rows end days
 * earlier, the phone copy is almost certainly truncated (e.g. 590 KB vs 1.1 MB).
 */
export function assertCareSensCsvMatchesExportName(
  fileName: string | null | undefined,
  lastTimestampIso: string,
  bytesRead: number,
): void {
  if (!fileName) return;
  const m = /(\d{4}-\d{2}-\d{2})[_-](\d{6})/.exec(fileName);
  if (!m) return;
  const [y, mo, d] = m[1].split('-').map(Number);
  const hh = Number(m[2].slice(0, 2));
  const mm = Number(m[2].slice(2, 4));
  const ss = Number(m[2].slice(4, 6));
  const exportMs = new Date(y, mo - 1, d, hh, mm, ss).getTime();
  const lastMs = new Date(lastTimestampIso).getTime();
  if (Number.isNaN(exportMs) || Number.isNaN(lastMs)) return;

  const lagDays = (exportMs - lastMs) / (24 * 60 * 60 * 1000);
  if (lagDays <= 2) return;

  const kb = Math.round(bytesRead / 1024);
  throw new Error(
    `This CSV looks incomplete (${kb} KB, last reading ${formatCareSensDay(lastTimestampIso)}, but the file name says export ${m[1]}). Copy the full CareSens export from the PC (~1.1 MB for a Jul 24 file) and import that copy.`,
  );
}

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

  return {
    points: allPoints,
    sessionStarts,
    firstTimestamp: parsedRows[0].timestamp,
    lastTimestamp: parsedRows[parsedRows.length - 1].timestamp,
  };
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
