/**
 * Shared backup fingerprint type + overwrite guard (mirrored in app logic).
 */

export type BackupFingerprint = {
  earliestDay: string | null;
  latestDay: string | null;
  mealDays: number;
  glucosePoints: number;
  heartRatePoints: number;
  hrEarliestDay: string | null;
  activityDays: number;
  activityEntries: number;
  activityFavorites: number;
  keyCount: number;
  byteSize: number;
};

type PayloadLike = {
  asyncStorage?: Record<string, string>;
};

const FOOD_KEY = /^food_log_(\d{4}-\d{2}-\d{2})$/;
const ACTIVITY_KEY = /^activity_log_(\d{4}-\d{2}-\d{2})$/;
const CHAT_KEY = /^chat_history_(\d{4}-\d{2}-\d{2})/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const ACTIVITY_FAVORITES_KEY = 'healthings:activityFavorites';

function pushDay(days: string[], raw: string | null | undefined) {
  if (raw && DAY_RE.test(raw)) days.push(raw);
}

function heartRateFromMetricsStore(raw: string | undefined): {
  heartRatePoints: number;
  hrEarliestDay: string | null;
} {
  if (!raw) return { heartRatePoints: 0, hrEarliestDay: null };
  try {
    const store = JSON.parse(raw) as { heartRate?: Array<{ timestamp?: string }> };
    const hr = store.heartRate ?? [];
    const hrDays: string[] = [];
    for (const p of hr) pushDay(hrDays, p.timestamp?.slice(0, 10));
    hrDays.sort();
    return {
      heartRatePoints: hr.length,
      hrEarliestDay: hrDays[0] ?? null,
    };
  } catch {
    return { heartRatePoints: 0, hrEarliestDay: null };
  }
}

function daysFromCgm(raw: string | undefined, days: string[]): number {
  if (!raw) return 0;
  try {
    const data = JSON.parse(raw) as { glucose?: Array<{ timestamp?: string }> };
    const glucose = data.glucose ?? [];
    for (const p of glucose) pushDay(days, p.timestamp?.slice(0, 10));
    return glucose.length;
  } catch {
    return 0;
  }
}

/** Recompute fingerprint from a stored backup payload (for legacy rows missing HR fields). */
export function fingerprintFromBackupPayload(
  payload: PayloadLike,
  byteSize: number,
): BackupFingerprint {
  const asyncStorage = payload.asyncStorage ?? {};
  const days: string[] = [];
  let mealDays = 0;
  let activityDays = 0;
  let activityEntries = 0;

  for (const key of Object.keys(asyncStorage)) {
    const food = key.match(FOOD_KEY);
    if (food) {
      mealDays += 1;
      pushDay(days, food[1]);
      continue;
    }
    const act = key.match(ACTIVITY_KEY);
    if (act) {
      activityDays += 1;
      pushDay(days, act[1]);
      try {
        const list = JSON.parse(asyncStorage[key] ?? '[]') as unknown[];
        if (Array.isArray(list)) activityEntries += list.length;
      } catch {
        /* ignore */
      }
      continue;
    }
    const chat = key.match(CHAT_KEY);
    if (chat) pushDay(days, chat[1]);
  }

  let activityFavorites = 0;
  try {
    const favs = JSON.parse(asyncStorage[ACTIVITY_FAVORITES_KEY] ?? '[]') as unknown[];
    if (Array.isArray(favs)) activityFavorites = favs.length;
  } catch {
    /* ignore */
  }

  const metricsRaw =
    asyncStorage['healthings:metricsStore'] ?? asyncStorage['healthings:withingsStore'];
  const { heartRatePoints, hrEarliestDay } = heartRateFromMetricsStore(metricsRaw);
  const glucosePoints = daysFromCgm(asyncStorage['healthings:lastMetrics'], days);

  // Body / meal calendar depth (same signals as app; kept lean on server).
  try {
    const store = metricsRaw ? JSON.parse(metricsRaw) : null;
    for (const d of store?.bodyTrendDays ?? []) pushDay(days, d.dayKey);
    pushDay(days, store?.bodyScan?.measuredAt?.slice(0, 10));
  } catch {
    /* ignore */
  }

  days.sort();
  return {
    earliestDay: days[0] ?? null,
    latestDay: days.length ? days[days.length - 1]! : null,
    mealDays,
    glucosePoints,
    heartRatePoints,
    hrEarliestDay,
    activityDays,
    activityEntries,
    activityFavorites,
    keyCount: Object.keys(asyncStorage).length,
    byteSize,
  };
}

export function isEmptyish(fp: BackupFingerprint): boolean {
  return (
    fp.mealDays === 0 &&
    fp.glucosePoints === 0 &&
    fp.activityDays === 0 &&
    fp.activityFavorites === 0 &&
    (fp.heartRatePoints ?? 0) === 0
  );
}

export function canOverwriteCloudBackup(
  phone: BackupFingerprint,
  cloud: BackupFingerprint | null,
): { ok: boolean; reason: string } {
  if (isEmptyish(phone)) {
    return {
      ok: false,
      reason:
        'Nothing to back up — this phone has no meals, glucose, activity, or heart rate. An empty copy is never stored.',
    };
  }

  if (!cloud) return { ok: true, reason: 'No existing cloud backup.' }

  if (cloud.earliestDay && phone.earliestDay) {
    if (phone.earliestDay > cloud.earliestDay) {
      return {
        ok: false,
        reason: `Cloud history starts earlier (${cloud.earliestDay} vs ${phone.earliestDay}).`,
      };
    }
  } else if (cloud.earliestDay && !phone.earliestDay) {
    return { ok: false, reason: 'Cloud has dated history; phone fingerprint has none.' };
  }

  if (phone.mealDays < cloud.mealDays) {
    return {
      ok: false,
      reason: `Cloud has more meal days (${cloud.mealDays} vs ${phone.mealDays}).`,
    };
  }

  if (phone.activityDays < (cloud.activityDays ?? 0)) {
    return {
      ok: false,
      reason: `Cloud has more activity days (${cloud.activityDays} vs ${phone.activityDays}).`,
    };
  }

  if (phone.activityEntries < (cloud.activityEntries ?? 0)) {
    return {
      ok: false,
      reason: `Cloud has more activity sessions (${cloud.activityEntries} vs ${phone.activityEntries}).`,
    };
  }

  if (phone.activityFavorites < (cloud.activityFavorites ?? 0)) {
    return {
      ok: false,
      reason: `Cloud has more activity favorites (${cloud.activityFavorites} vs ${phone.activityFavorites}).`,
    };
  }

  if (phone.heartRatePoints < cloud.heartRatePoints) {
    return {
      ok: false,
      reason: `Cloud has more heart-rate samples (${cloud.heartRatePoints} vs ${phone.heartRatePoints}).`,
    };
  }

  if (cloud.hrEarliestDay && phone.hrEarliestDay) {
    if (phone.hrEarliestDay > cloud.hrEarliestDay) {
      return {
        ok: false,
        reason: `Cloud heart-rate history starts earlier (${cloud.hrEarliestDay} vs ${phone.hrEarliestDay}).`,
      };
    }
  } else if (cloud.hrEarliestDay && !phone.hrEarliestDay && cloud.heartRatePoints > 0) {
    return {
      ok: false,
      reason: 'Cloud has heart-rate history; phone fingerprint has none.',
    };
  }

  if (cloud.byteSize > 0 && phone.byteSize < cloud.byteSize * 0.5) {
    return {
      ok: false,
      reason: `Phone payload much smaller than cloud (${phone.byteSize} vs ${cloud.byteSize}).`,
    };
  }

  return { ok: true, reason: 'ok' };
}
