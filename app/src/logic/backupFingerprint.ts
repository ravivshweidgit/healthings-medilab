/**
 * Cloud backup richness fingerprint — blocks thin phones from wiping richer cloud copies.
 */

export type BackupFingerprint = {
  earliestDay: string | null;
  latestDay: string | null;
  mealDays: number;
  glucosePoints: number;
  /** Intraday HR samples in metricsStore (Withings / phone health). */
  heartRatePoints: number;
  /** Earliest local calendar day that has an HR sample, if any. */
  hrEarliestDay: string | null;
  /** Days with ≥1 manual/favorite activity_log entry. */
  activityDays: number;
  /** Total manual/favorite activity sessions. */
  activityEntries: number;
  /** User activity favorites count. */
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

function measuredAtDay(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const snap = JSON.parse(raw) as { measuredAt?: string };
    const d = snap.measuredAt?.slice(0, 10);
    return d && DAY_RE.test(d) ? d : null;
  } catch {
    return null;
  }
}

function daysFromWithingsStore(raw: string | undefined, days: string[]) {
  if (!raw) return;
  try {
    const store = JSON.parse(raw) as {
      bodyTrendDays?: Array<{ dayKey?: string }>;
      bodyScan?: { measuredAt?: string };
    };
    for (const d of store.bodyTrendDays ?? []) pushDay(days, d.dayKey);
    pushDay(days, store.bodyScan?.measuredAt?.slice(0, 10));
  } catch {
    /* ignore */
  }
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

function daysFromManualBody(raw: string | undefined, days: string[]) {
  if (!raw) return;
  try {
    const list = JSON.parse(raw) as Array<{ measuredAt?: string }> | { measuredAt?: string };
    if (Array.isArray(list)) {
      for (const s of list) pushDay(days, s.measuredAt?.slice(0, 10));
    }
  } catch {
    /* ignore */
  }
}

/** Build fingerprint from backup payload JSON (gzip byte size known). */
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
  daysFromWithingsStore(metricsRaw, days);
  const { heartRatePoints, hrEarliestDay } = heartRateFromMetricsStore(metricsRaw);
  const glucosePoints = daysFromCgm(asyncStorage['healthings:lastMetrics'], days);
  daysFromManualBody(asyncStorage['manual_body_history_v1'], days);
  pushDay(days, measuredAtDay(asyncStorage['manual_body_v1']));

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
  // Settings / profile keys alone (often 30–50) must not count as history.
  // An empty new phone can still have earliestDay from chat or trend stubs.
  return (
    fp.mealDays === 0 &&
    fp.glucosePoints === 0 &&
    fp.activityDays === 0 &&
    fp.activityFavorites === 0 &&
    fp.heartRatePoints === 0
  );
}

export type OverwriteDecision = {
  ok: boolean;
  reason: string;
};

/**
 * Phone may replace cloud only if at least as rich.
 * Smaller earliestDay = older history (more depth).
 */
export function canOverwriteCloudBackup(
  phone: BackupFingerprint,
  cloud: BackupFingerprint | null,
): OverwriteDecision {
  if (isEmptyish(phone)) {
    return {
      ok: false,
      reason:
        'Nothing to back up — this phone has no meals, glucose, activity, or heart rate. Use the old phone (Back up now) or log data first. An empty copy is never stored.',
    };
  }

  if (!cloud) {
    return { ok: true, reason: 'No existing cloud backup.' };
  }

  if (cloud.earliestDay && phone.earliestDay) {
    if (phone.earliestDay > cloud.earliestDay) {
      return {
        ok: false,
        reason: `Cloud history starts ${cloud.earliestDay}; this phone starts ${phone.earliestDay}. Restore or force replace if intentional.`,
      };
    }
  } else if (cloud.earliestDay && !phone.earliestDay) {
    return {
      ok: false,
      reason: 'Cloud has dated history; this phone has none. Restore from cloud first.',
    };
  }

  if (phone.mealDays < cloud.mealDays) {
    return {
      ok: false,
      reason: `Cloud has ${cloud.mealDays} meal days; this phone has ${phone.mealDays}. Never overwrite with fewer meals — restore or force replace if intentional.`,
    };
  }

  if (phone.activityDays < (cloud.activityDays ?? 0)) {
    return {
      ok: false,
      reason: `Cloud has ${cloud.activityDays} activity days; this phone has ${phone.activityDays}. Never overwrite with less activity history — restore or force replace if intentional.`,
    };
  }

  if (phone.activityEntries < (cloud.activityEntries ?? 0)) {
    return {
      ok: false,
      reason: `Cloud has ${cloud.activityEntries} activity sessions; this phone has ${phone.activityEntries}. Never overwrite with fewer sessions — restore or force replace if intentional.`,
    };
  }

  if (phone.activityFavorites < (cloud.activityFavorites ?? 0)) {
    return {
      ok: false,
      reason: `Cloud has ${cloud.activityFavorites} activity favorites; this phone has ${phone.activityFavorites}. Never overwrite with fewer favorites — restore or force replace if intentional.`,
    };
  }

  if (phone.heartRatePoints < cloud.heartRatePoints) {
    return {
      ok: false,
      reason: `Cloud has ${cloud.heartRatePoints} heart-rate samples; this phone has ${phone.heartRatePoints}. Never overwrite with less HR — restore or force replace if intentional.`,
    };
  }

  if (cloud.hrEarliestDay && phone.hrEarliestDay) {
    if (phone.hrEarliestDay > cloud.hrEarliestDay) {
      return {
        ok: false,
        reason: `Cloud heart-rate history starts ${cloud.hrEarliestDay}; this phone starts ${phone.hrEarliestDay}. Restore or force replace if intentional.`,
      };
    }
  } else if (cloud.hrEarliestDay && !phone.hrEarliestDay && cloud.heartRatePoints > 0) {
    return {
      ok: false,
      reason: 'Cloud has heart-rate history; this phone has none. Restore or force replace if intentional.',
    };
  }

  if (cloud.byteSize > 0 && phone.byteSize < cloud.byteSize * 0.5) {
    return {
      ok: false,
      reason: `Cloud backup is much larger (${cloud.byteSize} B vs ${phone.byteSize} B). Restore or force replace if intentional.`,
    };
  }

  return { ok: true, reason: 'Phone backup is at least as rich as cloud.' };
}
