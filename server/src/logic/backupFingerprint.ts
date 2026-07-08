/**
 * Shared backup fingerprint type + overwrite guard (mirrored in app logic).
 */

export type BackupFingerprint = {
  earliestDay: string | null;
  latestDay: string | null;
  mealDays: number;
  glucosePoints: number;
  keyCount: number;
  byteSize: number;
};

function isEmptyish(fp: BackupFingerprint): boolean {
  return fp.mealDays === 0 && fp.glucosePoints === 0 && (fp.earliestDay == null || fp.keyCount < 5);
}

export function canOverwriteCloudBackup(
  phone: BackupFingerprint,
  cloud: BackupFingerprint | null,
): { ok: boolean; reason: string } {
  if (!cloud) return { ok: true, reason: 'No existing cloud backup.' };

  if (isEmptyish(phone) && !isEmptyish(cloud)) {
    return {
      ok: false,
      reason: 'Phone backup is empty relative to existing cloud history.',
    };
  }

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

  if (cloud.byteSize > 0 && phone.byteSize < cloud.byteSize * 0.5) {
    return {
      ok: false,
      reason: `Phone payload much smaller than cloud (${phone.byteSize} vs ${cloud.byteSize}).`,
    };
  }

  return { ok: true, reason: 'ok' };
}
