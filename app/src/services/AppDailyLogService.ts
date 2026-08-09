/**
 * Daily on-device app log — high-level perf + auth marks (prompt105).
 * Files: yyyy-mm-dd-healthings-app.log
 * Retention: 7 days + 512KB/day cap (never unbounded).
 * No meal text, rules, tokens, or emails.
 *
 * Perf `op=` values are English method/component ids only (never UI copy).
 */

import * as FileSystem from 'expo-file-system/legacy';
import { InteractionManager, Platform, Share } from 'react-native';

/** Always-safe sandbox dir. */
const LOG_DIR_INTERNAL = `${FileSystem.documentDirectory ?? ''}healthings-logs/`;
/**
 * Android mirror under app-specific external files — adb can pull this path.
 * If Expo refuses the path, we stay on internal only.
 */
const LOG_DIR_ANDROID_EXTERNAL =
  'file:///storage/emulated/0/Android/data/com.healthings.medilab/files/healthings-logs/';

export const APP_LOG_RETAIN_DAYS = 7;
export const APP_LOG_MAX_BYTES_PER_DAY = 512 * 1024;
const FILE_RE = /^(\d{4}-\d{2}-\d{2})-healthings-app\.log$/;

const WARN_STRIP_MS = 300;
const WARN_MEAL_MS = 800;
const WARN_CHART_MS = 500;
const WARN_AI_MS = 5000;
const WARN_SYNC_MS = 3000;

let prunePromise: Promise<void> | null = null;
let writeChain: Promise<void> = Promise.resolve();
let logDirResolved: string | null = null;
let todayCapDay: string | null = null;
let todayCapped = false;

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

export function localDayKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function logPathForDay(day: string, dir: string): string {
  return `${dir}${day}-healthings-app.log`;
}

async function resolveLogDir(): Promise<string> {
  if (logDirResolved) return logDirResolved;
  if (Platform.OS === 'android') {
    try {
      const info = await FileSystem.getInfoAsync(LOG_DIR_ANDROID_EXTERNAL);
      if (!info.exists) {
        await FileSystem.makeDirectoryAsync(LOG_DIR_ANDROID_EXTERNAL, { intermediates: true });
      }
      const probe = `${LOG_DIR_ANDROID_EXTERNAL}.probe`;
      await FileSystem.writeAsStringAsync(probe, 'ok', { encoding: 'utf8' });
      await FileSystem.deleteAsync(probe, { idempotent: true });
      logDirResolved = LOG_DIR_ANDROID_EXTERNAL;
      return logDirResolved;
    } catch {
      /* fall through */
    }
  }
  const info = await FileSystem.getInfoAsync(LOG_DIR_INTERNAL);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(LOG_DIR_INTERNAL, { intermediates: true });
  }
  logDirResolved = LOG_DIR_INTERNAL;
  return logDirResolved;
}

function sanitizeFields(fields: Record<string, string | number | boolean | null | undefined>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || v === null) continue;
    const key = k.replace(/[^\w.-]/g, '_').slice(0, 48);
    let val: string;
    if (typeof v === 'boolean') val = v ? '1' : '0';
    else if (typeof v === 'number') val = Number.isFinite(v) ? String(Math.round(v * 1000) / 1000) : 'nan';
    else val = String(v).replace(/[\r\n\t]+/g, ' ').slice(0, 120);
    parts.push(`${key}=${val}`);
  }
  return parts.join(' ');
}

/** English method/component id only — strips spaces and non-ASCII. */
export function sanitizeMethodName(name: string): string {
  const s = String(name ?? '')
    .trim()
    .replace(/[^A-Za-z0-9._-]/g, '')
    .slice(0, 64);
  return s || 'unknown';
}

async function ensureDir(): Promise<string> {
  return resolveLogDir();
}

export async function pruneOldAppLogs(): Promise<void> {
  try {
    const dir = await ensureDir();
    const names = await FileSystem.readDirectoryAsync(dir);
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - APP_LOG_RETAIN_DAYS);
    const cutoffKey = localDayKey(cutoff);
    await Promise.all(
      names.map(async (name) => {
        const path = `${dir}${name}`;
        const m = name.match(FILE_RE);
        if (!m) {
          await FileSystem.deleteAsync(path, { idempotent: true });
          return;
        }
        if (m[1] < cutoffKey) {
          await FileSystem.deleteAsync(path, { idempotent: true });
        }
      }),
    );
  } catch {
    /* ignore prune failures */
  }
}

function schedulePrune(): void {
  if (prunePromise) return;
  prunePromise = pruneOldAppLogs().finally(() => {
    prunePromise = null;
  });
}

async function appendLine(line: string): Promise<void> {
  schedulePrune();
  const dir = await ensureDir();
  const day = localDayKey();
  if (todayCapDay !== day) {
    todayCapDay = day;
    todayCapped = false;
  }
  if (todayCapped) return;

  const path = logPathForDay(day, dir);
  const info = await FileSystem.getInfoAsync(path);
  const existingSize =
    info.exists && typeof (info as { size?: number }).size === 'number'
      ? (info as { size: number }).size
      : 0;

  if (existingSize >= APP_LOG_MAX_BYTES_PER_DAY) {
    todayCapped = true;
    return;
  }

  const nextLine = `${line}\n`;
  if (existingSize + nextLine.length > APP_LOG_MAX_BYTES_PER_DAY) {
    const notice = `${new Date().toISOString()} WARN log day_cap_reached_bytes=${APP_LOG_MAX_BYTES_PER_DAY}\n`;
    if (info.exists) {
      const prev = await FileSystem.readAsStringAsync(path, { encoding: 'utf8' });
      await FileSystem.writeAsStringAsync(path, `${prev}${notice}`, { encoding: 'utf8' });
    } else {
      await FileSystem.writeAsStringAsync(path, notice, { encoding: 'utf8' });
    }
    todayCapped = true;
    return;
  }

  if (info.exists) {
    const prev = await FileSystem.readAsStringAsync(path, { encoding: 'utf8' });
    await FileSystem.writeAsStringAsync(path, `${prev}${nextLine}`, { encoding: 'utf8' });
  } else {
    await FileSystem.writeAsStringAsync(path, nextLine, { encoding: 'utf8' });
  }
}

function enqueueWrite(line: string): void {
  console.warn(`HealthingsAppLog ${line}`);
  writeChain = writeChain
    .then(() => appendLine(line))
    .catch(() => {
      /* never throw into UI */
    });
}

/** Wait for queued appends before read/share. */
export async function flushAppLogWrites(): Promise<void> {
  await writeChain;
}

export async function readTodayAppLog(): Promise<string> {
  await flushAppLogWrites();
  const dir = await ensureDir();
  const path = logPathForDay(localDayKey(), dir);
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) return '';
  return FileSystem.readAsStringAsync(path, { encoding: 'utf8' });
}

/** Owner diagnostics — share today's file via the system sheet (prompt105 optional). */
export async function shareTodayAppLog(): Promise<void> {
  const day = localDayKey();
  const text = await readTodayAppLog();
  const body = text.trim()
    ? text
    : `(no lines yet for ${day} — expand a strip or open Meal first)`;
  await Share.share({
    message: body,
    title: `${day}-healthings-app.log`,
  });
}

export type AppLogLevel = 'INFO' | 'WARN' | 'ERROR';

export function appLog(
  level: AppLogLevel,
  tag: string,
  fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
  const iso = new Date().toISOString();
  const safeTag = tag.replace(/[^\w.-]/g, '_').slice(0, 32);
  const body = sanitizeFields(fields);
  enqueueWrite(`${iso} ${level} ${safeTag}${body ? ` ${body}` : ''}`);
}

export async function timeAsync<T>(
  method: string,
  fn: () => Promise<T>,
  extra: Record<string, string | number | boolean | null | undefined> = {},
  warnAboveMs?: number,
): Promise<T> {
  const op = sanitizeMethodName(method);
  const t0 = Date.now();
  let ok = true;
  try {
    return await fn();
  } catch (e) {
    ok = false;
    throw e;
  } finally {
    const duration_ms = Date.now() - t0;
    const level: AppLogLevel =
      warnAboveMs != null && duration_ms >= warnAboveMs ? 'WARN' : 'INFO';
    appLog(level, 'perf', { op, duration_ms, ok, ...extra });
  }
}

/** Log a completed method timing (English `op=` method name only). */
export function logMethodTiming(
  method: string,
  duration_ms: number,
  extra: Record<string, string | number | boolean | null | undefined> = {},
  warnAboveMs?: number,
): void {
  const op = sanitizeMethodName(method);
  const level: AppLogLevel =
    warnAboveMs != null && duration_ms >= warnAboveMs ? 'WARN' : 'INFO';
  appLog(level, 'perf', { op, duration_ms, ...extra });
}

/**
 * Time until ~next paint after interactions (useful for chart mount / strip expand).
 * `method` must be an English identifier, e.g. MetabolicChart.ready
 */
export function markMethodReady(
  method: string,
  extra: Record<string, string | number | boolean | null | undefined> = {},
  warnAboveMs: number = WARN_CHART_MS,
): void {
  const t0 = Date.now();
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => {
        logMethodTiming(method, Date.now() - t0, extra, warnAboveMs);
      });
    });
  });
}

/**
 * Expand/collapse — `method` is English component id (e.g. FoodMacroStrip), never UI title.
 * Logs FoodMacroStrip.toggle (interaction) and FoodMacroStrip.paint (rAF+interactions).
 */
export function logStripToggle(method: string, expanding: boolean): void {
  const base = sanitizeMethodName(method);
  const t0 = Date.now();
  const to = expanding ? 'expand' : 'collapse';
  InteractionManager.runAfterInteractions(() => {
    logMethodTiming(`${base}.toggle`, Date.now() - t0, { to }, WARN_STRIP_MS);
  });
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      InteractionManager.runAfterInteractions(() => {
        logMethodTiming(`${base}.paint`, Date.now() - t0, { to }, WARN_STRIP_MS);
      });
    });
  });
}

export const PERF_WARN_MEAL_MS = WARN_MEAL_MS;
export const PERF_WARN_STRIP_MS = WARN_STRIP_MS;
export const PERF_WARN_CHART_MS = WARN_CHART_MS;
export const PERF_WARN_AI_MS = WARN_AI_MS;
export const PERF_WARN_SYNC_MS = WARN_SYNC_MS;

export function getTodayAppLogPath(): string {
  const dir = logDirResolved ?? LOG_DIR_INTERNAL;
  return logPathForDay(localDayKey(), dir);
}

export function getAppLogDir(): string {
  return logDirResolved ?? LOG_DIR_INTERNAL;
}
