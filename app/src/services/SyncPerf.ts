/**
 * Lightweight sync timing for pull-refresh / Withings investigation.
 * Nested `track()` calls build a tree; `formatReport()` is phone-friendly.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export type SyncPerfEntry = {
  label: string;
  ms: number;
  children: SyncPerfEntry[];
};

type Session = {
  label: string;
  startedAt: number;
  children: SyncPerfEntry[];
};

const SYNC_PERF_LAST_KEY = 'healthings:syncPerfLast';

let session: Session | null = null;
let stack: SyncPerfEntry[][] = [];
let lastReport: SyncPerfEntry | null = null;

/** When true, pull-refresh shows an Alert with the timing tree (investigation). */
export const SYNC_PERF_ALERT = false;

export function syncPerfStart(label: string): void {
  session = { label, startedAt: Date.now(), children: [] };
  stack = [session.children];
}

export function syncPerfEnd(): SyncPerfEntry | null {
  if (!session) return null;
  const root: SyncPerfEntry = {
    label: session.label,
    ms: Date.now() - session.startedAt,
    children: session.children,
  };
  lastReport = root;
  session = null;
  stack = [];
  // Always log — useful when Metro / logcat is connected.
  console.warn('[sync-perf]\n' + formatSyncPerfReport(root));
  void AsyncStorage.setItem(
    SYNC_PERF_LAST_KEY,
    JSON.stringify({ at: new Date().toISOString(), report: root }),
  ).catch(() => {});
  return root;
}

export function getLastSyncPerfReport(): SyncPerfEntry | null {
  return lastReport;
}

export async function loadLastSyncPerfReport(): Promise<SyncPerfEntry | null> {
  try {
    const raw = await AsyncStorage.getItem(SYNC_PERF_LAST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { report?: SyncPerfEntry };
    return parsed.report ?? null;
  } catch {
    return null;
  }
}

/**
 * Time a step. Safe for sequential nesting.
 * For Promise.all siblings, prefer `syncPerfTrackSibling` so parallel races do not nest under each other.
 */
export async function syncPerfTrack<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const entry: SyncPerfEntry = { label, ms: 0, children: [] };
  const parent = stack[stack.length - 1];
  if (parent) parent.push(entry);
  else if (session) session.children.push(entry);

  const saved = stack;
  stack = [...saved, entry.children];
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    entry.ms = Date.now() - t0;
    stack = saved;
  }
}

/** Attach under current stack bucket without changing stack (safe inside Promise.all). */
export async function syncPerfParallel<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const entry: SyncPerfEntry = { label, ms: 0, children: [] };
  const bucket = stack[stack.length - 1] ?? session?.children;
  if (bucket) bucket.push(entry);
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    entry.ms = Date.now() - t0;
  }
}

/** Parallel leg under session root with isolated nest stack (pull-refresh top-level tasks). */
export async function syncPerfTrackSibling<T>(label: string, fn: () => Promise<T>): Promise<T> {
  const entry: SyncPerfEntry = { label, ms: 0, children: [] };
  if (session) session.children.push(entry);
  const saved = stack;
  stack = [entry.children];
  const t0 = Date.now();
  try {
    return await fn();
  } finally {
    entry.ms = Date.now() - t0;
    stack = saved;
  }
}

export function formatSyncPerfReport(root: SyncPerfEntry = lastReport!): string {
  if (!root) return '(no sync timing yet)';
  const lines: string[] = [];
  const walk = (e: SyncPerfEntry, depth: number) => {
    const pad = '  '.repeat(depth);
    lines.push(`${pad}${e.label}: ${e.ms} ms`);
    const kids = [...e.children].sort((a, b) => b.ms - a.ms);
    for (const c of kids) walk(c, depth + 1);
  };
  walk(root, 0);
  return lines.join('\n');
}
