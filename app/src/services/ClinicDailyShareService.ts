/**
 * Daily clinic snapshot preference + once-a-day marker (prompt119).
 *
 * The clinic used to see only as far as the last snapshot it happened to pull,
 * so a patient logging every day still showed "3 of 7 days" on the macro report.
 * That was a scheduling artifact, not a logging gap.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import { localDayKeyFromMs } from '../logic/metabolicTrend7d';

/** Patient preference — travels with backups. */
export const CLINIC_DAILY_SHARE_KEY = 'healthings:clinicDailyShare';

/** Which local day already pushed. Ephemeral: excluded from export and backup. */
export const CLINIC_DAILY_SHARE_DAY_KEY = 'healthings:clinicDailySharedDay';

/**
 * On unless the patient turned it off. An approved clinic share is already the
 * consent, and the clinic can pull the same snapshot with Refresh at any time —
 * this changes when it arrives, not who may read it.
 */
export async function isClinicDailyShareOn(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(CLINIC_DAILY_SHARE_KEY)) !== 'off';
  } catch {
    return true;
  }
}

export async function setClinicDailyShareOn(on: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(CLINIC_DAILY_SHARE_KEY, on ? 'on' : 'off');
  } catch (err) {
    console.warn('[ClinicDailyShare] save preference failed:', err);
  }
}

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

/** Turning it back on should not wait for tomorrow. */
export async function clearClinicDailyShareDay(): Promise<void> {
  try {
    await AsyncStorage.removeItem(CLINIC_DAILY_SHARE_DAY_KEY);
  } catch (err) {
    console.warn('[ClinicDailyShare] clear day failed:', err);
  }
}
