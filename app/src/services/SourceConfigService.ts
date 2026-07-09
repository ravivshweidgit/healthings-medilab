/**
 * Per-metric data source selection (Withings vs manual vs Health Connect steps).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SOURCE_CONFIG_KEY = 'source_config';

export type GlucoseSource = 'health-connect' | 'none';
export type ActivitySource = 'withings' | 'health-connect' | 'samsung-steps' | 'none';
export type BodyCompositionSource = 'withings' | 'manual' | 'none';
export type BmrSource = 'withings' | 'manual' | 'ai-estimate';
export type HeartRateSource = 'withings' | 'health-connect' | 'none';

export type SourceConfig = {
  version: 1;
  glucose: GlucoseSource;
  activity: ActivitySource;
  bodyComposition: BodyCompositionSource;
  bmr: BmrSource;
  heartRate: HeartRateSource;
};

export type DeviceSurvey = {
  hasWithingsScale: boolean;
  hasWithingsWatch: boolean;
  tracksGlucose: boolean;
};

/** My Profile + Quick Start step 2 — three binary toggles (8 states). */
export type SetupToggles = {
  withingsScale: boolean;
  withingsWatch: boolean;
  cgm: boolean;
};

const DEFAULT_CONFIG: SourceConfig = {
  version: 1,
  glucose: 'none',
  activity: 'none',
  bodyComposition: 'none',
  bmr: 'ai-estimate',
  heartRate: 'none',
};

/** Watch off → Health Connect activity (Garmin, Samsung, Pixel, etc.). */
export function isHealthConnectActivity(activity: ActivitySource): boolean {
  return activity === 'health-connect' || activity === 'samsung-steps';
}

function normalizeActivitySource(activity: ActivitySource): ActivitySource {
  return activity === 'samsung-steps' ? 'health-connect' : activity;
}

/** Watch off → Health Connect HR (Garmin 24/7 + session samples). */
export function isHealthConnectHeartRate(heartRate: HeartRateSource): boolean {
  return heartRate === 'health-connect';
}

function normalizeHeartRateSource(
  heartRate: HeartRateSource | undefined,
  activity: ActivitySource,
): HeartRateSource {
  if (heartRate === 'withings' || heartRate === 'health-connect') return heartRate;
  if (activity === 'withings') return 'withings';
  if (isHealthConnectActivity(activity)) return 'health-connect';
  return 'none';
}

export function togglesFromSourceConfig(c: SourceConfig): SetupToggles {
  return {
    withingsScale: c.bodyComposition === 'withings',
    withingsWatch: c.activity === 'withings',
    cgm: c.glucose === 'health-connect',
  };
}

export function sourceConfigFromToggles(t: SetupToggles): SourceConfig {
  return {
    version: 1,
    glucose: t.cgm ? 'health-connect' : 'none',
    activity: t.withingsWatch ? 'withings' : 'health-connect',
    bodyComposition: t.withingsScale ? 'withings' : 'manual',
    bmr: t.withingsScale ? 'withings' : 'manual',
    heartRate: t.withingsWatch ? 'withings' : 'health-connect',
  };
}

export function sourceConfigFromDevices(survey: DeviceSurvey, usesManualWeight: boolean): SourceConfig {
  return sourceConfigFromToggles({
    withingsScale: survey.hasWithingsScale && !usesManualWeight,
    withingsWatch: survey.hasWithingsWatch,
    cgm: survey.tracksGlucose,
  });
}

export async function loadSourceConfig(): Promise<SourceConfig> {
  const raw = await AsyncStorage.getItem(SOURCE_CONFIG_KEY);
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as SourceConfig;
    if (parsed?.version === 1) {
      return {
        ...parsed,
        activity: normalizeActivitySource(parsed.activity),
        heartRate: normalizeHeartRateSource(parsed.heartRate, normalizeActivitySource(parsed.activity)),
      };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveSourceConfig(config: SourceConfig): Promise<void> {
  await AsyncStorage.setItem(SOURCE_CONFIG_KEY, JSON.stringify(config));
}
