/**
 * User display/input unit preferences. Canonical stores stay SI.
 * Key included in backup/clinic (not on EXCLUDED list).
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  EnergyUnit,
  GlucoseUnit,
  HeightUnit,
  MassUnit,
  WaterUnit,
} from '../logic/unitConvert';
import {
  energyUnitLabel,
  glucoseUnitLabel,
  massUnitLabel,
  waterUnitLabel,
} from '../logic/unitConvert';

export const UNITS_PREFS_KEY = 'units_prefs_v1';

export type UnitsPrefs = {
  version: 1;
  glucose: GlucoseUnit;
  mass: MassUnit;
  height: HeightUnit;
  water: WaterUnit;
  energy: EnergyUnit;
};

export const DEFAULT_UNITS_PREFS: UnitsPrefs = {
  version: 1,
  glucose: 'mgdl',
  mass: 'kg',
  height: 'cm',
  water: 'ml',
  energy: 'kcal',
};

function normalize(raw: Partial<UnitsPrefs> | null | undefined): UnitsPrefs {
  return {
    version: 1,
    glucose: raw?.glucose === 'mmol' ? 'mmol' : 'mgdl',
    mass: raw?.mass === 'lb' ? 'lb' : 'kg',
    height: raw?.height === 'ftin' ? 'ftin' : 'cm',
    water: raw?.water === 'floz' ? 'floz' : 'ml',
    energy: raw?.energy === 'kj' ? 'kj' : 'kcal',
  };
}

export async function getUnitsPrefs(): Promise<UnitsPrefs> {
  try {
    const raw = await AsyncStorage.getItem(UNITS_PREFS_KEY);
    if (!raw) return { ...DEFAULT_UNITS_PREFS };
    return normalize(JSON.parse(raw) as Partial<UnitsPrefs>);
  } catch {
    return { ...DEFAULT_UNITS_PREFS };
  }
}

export async function saveUnitsPrefs(prefs: UnitsPrefs): Promise<void> {
  const next = normalize(prefs);
  await AsyncStorage.setItem(UNITS_PREFS_KEY, JSON.stringify(next));
}

export async function patchUnitsPrefs(patch: Partial<Omit<UnitsPrefs, 'version'>>): Promise<UnitsPrefs> {
  const cur = await getUnitsPrefs();
  const next = normalize({ ...cur, ...patch });
  await saveUnitsPrefs(next);
  return next;
}

/** One-line hint for coach USER DATA (SI values still authoritative). */
export function formatUnitsDisplayHint(prefs: UnitsPrefs): string {
  const height = prefs.height === 'ftin' ? "ft'in\"" : 'cm';
  return (
    `User display units: glucose ${glucoseUnitLabel(prefs.glucose)}, ` +
    `weight ${massUnitLabel(prefs.mass)}, height ${height}, ` +
    `water ${waterUnitLabel(prefs.water)}, energy ${energyUnitLabel(prefs.energy)} ` +
    `(stored values remain mg/dL · kg · cm · ml · kcal)`
  );
}
