/**
 * Stores manual kcal burn corrections per day.
 * Applied on top of Health Connect / Withings data.
 * Key: "burn_correction_YYYY-MM-DD", value: delta kcal (can be negative).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'burn_correction_';

export async function getBurnCorrection(dayKey: string): Promise<number> {
  const raw = await AsyncStorage.getItem(PREFIX + dayKey);
  if (!raw) return 0;
  const n = parseInt(raw, 10);
  return isNaN(n) ? 0 : n;
}

export async function setBurnCorrection(dayKey: string, delta: number): Promise<void> {
  if (delta === 0) {
    await AsyncStorage.removeItem(PREFIX + dayKey);
  } else {
    await AsyncStorage.setItem(PREFIX + dayKey, String(delta));
  }
}
