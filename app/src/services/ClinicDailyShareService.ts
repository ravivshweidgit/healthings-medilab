/**
 * Once-a-day clinic snapshot marker (prompt120).
 *
 * Linked clinic = daily upload on first app open. Revoke stops it; no separate toggle.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDayKeyFromMs } from '../logic/metabolicTrend7d';

/** Which local day already pushed. Ephemeral: excluded from export and backup. */
export const CLINIC_DAILY_SHARE_DAY_KEY = 'healthings:clinicDailySharedDay';

/** Local day, not UTC — "once a day" has to mean the patient's day. */
export async function clinicDailySharePending(now: number = Date.now()): Promise<boolean> {
  try {
    const done = await AsyncStorage.getItem(CLINIC_DAILY_SHARE_DAY_KEY);
    return done !== localDayKeyFromMs(now);
  } catch {
    return true;
  }
}

export async function markClinicDailyShareDone(now: number = Date.now()): Promise<void> {
  try {
    await AsyncStorage.setItem(CLINIC_DAILY_SHARE_DAY_KEY, localDayKeyFromMs(now));
  } catch (err) {
    console.warn('[ClinicDailyShare] mark day failed:', err);
  }
}
