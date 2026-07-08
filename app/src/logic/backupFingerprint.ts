/**
 * Cloud backup richness fingerprint — blocks thin phones from wiping richer cloud copies.
 */

export type BackupFingerprint = {
  earliestDay: string | null;
  latestDay: string | null;
  mealDays: number;
  glucosePoints: number;
  keyCount: number;
  byteSize: number;
};

type PayloadLike = {
  asyncStorage?: Record<string, string>;
};

const FOOD_KEY = /^food_log_(\d{4}-\d{2}-\d{2})$/;
const CHAT_KEY = /^chat_history_(\d{4}-\d{2}-\d{2})/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  for (const key of Object.keys(asyncStorage)) {
    const food = key.match(FOOD_KEY);
    if (food) {
      mealDays += 1;
      pushDay(days, food[1]);
      continue;
    }
    const chat = key.match(CHAT_KEY);
    if (chat) pushDay(days, chat[1]);
  }

  daysFromWithingsStore(asyncStorage['healthings:withingsStore'], days);
  const glucosePoints = daysFromCgm(asyncStorage['healthings:lastMetrics'], days);
  daysFromManualBody(asyncStorage['manual_body_history_v1'], days);
  pushDay(days, measuredAtDay(asyncStorage['manual_body_v1']));

  days.sort();
  return {
    earliestDay: days[0] ?? null,
    latestDay: days.length ? days[days.length - 1]! : null,
    mealDays,
    glucosePoints,
    keyCount: Object.keys(asyncStorage).length,
    byteSize,
  };
}

function isEmptyish(fp: BackupFingerprint): boolean {
  return fp.mealDays === 0 && fp.glucosePoints === 0 && (fp.earliestDay == null || fp.keyCount < 5);
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
  if (!cloud) {
    return { ok: true, reason: 'No existing cloud backup.' };
  }

  if (isEmptyish(phone) && !isEmptyish(cloud)) {
    return {
      ok: false,
      reason:
        'This phone looks empty but the cloud backup has history. Restore from cloud first, or force replace only if you are sure.',
    };
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

  if (cloud.byteSize > 0 && phone.byteSize < cloud.byteSize * 0.5) {
    return {
      ok: false,
      reason: `Cloud backup is much larger (${cloud.byteSize} B vs ${phone.byteSize} B). Restore or force replace if intentional.`,
    };
  }

  return { ok: true, reason: 'Phone backup is at least as rich as cloud.' };
}
