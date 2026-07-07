/**
 * Per-metric data source selection (Withings vs manual vs Health Connect steps).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const SOURCE_CONFIG_KEY = 'source_config';

export type GlucoseSource = 'health-connect' | 'none';
export type ActivitySource = 'withings' | 'samsung-steps' | 'none';
export type BodyCompositionSource = 'withings' | 'manual' | 'none';
export type BmrSource = 'withings' | 'manual' | 'ai-estimate';
export type HeartRateSource = 'withings' | 'none';

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

const DEFAULT_CONFIG: SourceConfig = {
  version: 1,
  glucose: 'none',
  activity: 'none',
  bodyComposition: 'none',
  bmr: 'ai-estimate',
  heartRate: 'none',
};

export function sourceConfigFromDevices(survey: DeviceSurvey, usesManualWeight: boolean): SourceConfig {
  return {
    version: 1,
    glucose: survey.tracksGlucose ? 'health-connect' : 'none',
    activity: survey.hasWithingsWatch ? 'withings' : 'samsung-steps',
    bodyComposition: survey.hasWithingsScale && !usesManualWeight ? 'withings' : usesManualWeight ? 'manual' : 'none',
    bmr: survey.hasWithingsScale && !usesManualWeight ? 'withings' : 'ai-estimate',
    heartRate: survey.hasWithingsWatch ? 'withings' : 'none',
  };
}

export async function loadSourceConfig(): Promise<SourceConfig> {
  const raw = await AsyncStorage.getItem(SOURCE_CONFIG_KEY);
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as SourceConfig;
    if (parsed?.version === 1) return parsed;
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveSourceConfig(config: SourceConfig): Promise<void> {
  await AsyncStorage.setItem(SOURCE_CONFIG_KEY, JSON.stringify(config));
}

/** After OAuth link — upgrade routing without re-running Quick Start. */
export async function applyWithingsLinkToSourceConfig(): Promise<SourceConfig> {
  const config = await loadSourceConfig();
  const next: SourceConfig = { ...config };
  if (config.bodyComposition !== 'manual') {
    next.bodyComposition = 'withings';
    next.bmr = 'withings';
  }
  if (config.heartRate === 'none') next.heartRate = 'withings';
  if (config.activity === 'none') next.activity = 'withings';
  await saveSourceConfig(next);
  return next;
}
