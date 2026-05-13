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

/**
 * Parses CareSens Air export CSV (columns like `Date and Time`, `Glucose Value`, `Unit`).
 * @see sample: Device,Serial Number,Sequence,Date and Time,Glucose Value,Unit,Trend Rate
 */
export function parseCareSensAirExportCsv(text: string): TimePoint[] {
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

  if (dateIdx < 0 || glucoseIdx < 0) {
    throw new Error(
      'Could not find "Date and Time" / "Glucose Value" columns. Export a CareSens Air CSV from the official app.'
    );
  }

  const points: TimePoint[] = [];
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

    points.push({
      timestamp: d.toISOString(),
      value: mgDl,
    });
  }

  points.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (points.length === 0) {
    throw new Error('No glucose rows could be parsed from this CSV.');
  }

  return points;
}
