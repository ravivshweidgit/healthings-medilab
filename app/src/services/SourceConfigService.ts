/**
 * Per-metric data source selection (Withings vs phone health vs manual).
 * Watch Yes → Withings cloud; Watch No → Health Connect (Android) / Apple Health (iOS).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SOURCE_CONFIG_KEY = 'source_config';

export type GlucoseSource = 'health-connect' | 'healthkit' | 'none';
export type ActivitySource =
  | 'withings'
  | 'health-connect'
  | 'samsung-steps'
  | 'healthkit'
  | 'healthkit-steps'
  | 'none';
export type BodyCompositionSource = 'withings' | 'manual' | 'none';
export type BmrSource = 'withings' | 'manual' | 'ai-estimate';
export type HeartRateSource = 'withings' | 'health-connect' | 'healthkit' | 'none';

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

export type AppPlatform = 'ios' | 'android';

export function getAppPlatform(): AppPlatform {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

const DEFAULT_CONFIG: SourceConfig = {
  version: 1,
  glucose: 'none',
  activity: 'none',
  bodyComposition: 'none',
  bmr: 'ai-estimate',
  heartRate: 'none',
};

/** Watch off → Health Connect activity (Android). */
export function isHealthConnectActivity(activity: ActivitySource): boolean {
  return activity === 'health-connect' || activity === 'samsung-steps';
}

/** Watch off → Apple Health activity (iOS). */
export function isHealthKitActivity(activity: ActivitySource): boolean {
  return activity === 'healthkit' || activity === 'healthkit-steps';
}

/** Phone health bus for steps/activity (HC or HealthKit) — not Withings. */
export function isPhoneHealthActivity(activity: ActivitySource): boolean {
  return isHealthConnectActivity(activity) || isHealthKitActivity(activity);
}

function normalizeActivitySource(activity: ActivitySource): ActivitySource {
  if (activity === 'samsung-steps') return 'health-connect';
  if (activity === 'healthkit-steps') return 'healthkit';
  return activity;
}

/** Watch off → Health Connect HR (Android). */
export function isHealthConnectHeartRate(heartRate: HeartRateSource): boolean {
  return heartRate === 'health-connect';
}

export function isHealthKitHeartRate(heartRate: HeartRateSource): boolean {
  return heartRate === 'healthkit';
}

export function isPhoneHealthHeartRate(heartRate: HeartRateSource): boolean {
  return isHealthConnectHeartRate(heartRate) || isHealthKitHeartRate(heartRate);
}

function normalizeHeartRateSource(
  heartRate: HeartRateSource | undefined,
  activity: ActivitySource,
): HeartRateSource {
  if (
    heartRate === 'withings' ||
    heartRate === 'health-connect' ||
    heartRate === 'healthkit'
  ) {
    return heartRate;
  }
  if (activity === 'withings') return 'withings';
  if (isHealthConnectActivity(activity)) return 'health-connect';
  if (isHealthKitActivity(activity)) return 'healthkit';
  return 'none';
}

/** Live CGM from phone health bus (HC Android / HealthKit iOS). */
export function isLiveGlucoseSource(glucose: GlucoseSource): boolean {
  return glucose === 'health-connect' || glucose === 'healthkit';
}

export function togglesFromSourceConfig(c: SourceConfig): SetupToggles {
  return {
    withingsScale: c.bodyComposition === 'withings',
    withingsWatch: c.activity === 'withings',
    cgm: isLiveGlucoseSource(c.glucose),
  };
}

export function sourceConfigFromToggles(
  t: SetupToggles,
  platform: AppPlatform = getAppPlatform(),
): SourceConfig {
  if (platform === 'ios') {
    return {
      version: 1,
      glucose: t.cgm ? 'healthkit' : 'none',
      activity: t.withingsWatch ? 'withings' : 'healthkit',
      bodyComposition: t.withingsScale ? 'withings' : 'manual',
      bmr: t.withingsScale ? 'withings' : 'manual',
      heartRate: t.withingsWatch ? 'withings' : 'healthkit',
    };
  }
  return {
    version: 1,
    glucose: t.cgm ? 'health-connect' : 'none',
    activity: t.withingsWatch ? 'withings' : 'health-connect',
    bodyComposition: t.withingsScale ? 'withings' : 'manual',
    bmr: t.withingsScale ? 'withings' : 'manual',
    heartRate: t.withingsWatch ? 'withings' : 'health-connect',
  };
}

export function sourceConfigFromDevices(
  survey: DeviceSurvey,
  usesManualWeight: boolean,
  platform: AppPlatform = getAppPlatform(),
): SourceConfig {
  return sourceConfigFromToggles(
    {
      withingsScale: survey.hasWithingsScale && !usesManualWeight,
      withingsWatch: survey.hasWithingsWatch,
      cgm: survey.tracksGlucose,
    },
    platform,
  );
}

/** Strip Android-only Health Connect enums when restoring config on iPhone (and vice versa). */
export function normalizeSourceConfigForPlatform(
  config: SourceConfig,
  platform: AppPlatform = getAppPlatform(),
): SourceConfig {
  if (platform !== 'ios') {
    let activity = normalizeActivitySource(config.activity);
    if (isHealthKitActivity(activity)) {
      activity = 'health-connect';
    }
    let heartRate = normalizeHeartRateSource(config.heartRate, activity);
    if (heartRate === 'healthkit') {
      heartRate = 'health-connect';
    }
    return {
      ...config,
      activity,
      heartRate,
    };
  }

  let activity = normalizeActivitySource(config.activity);
  // Android HC activity → Apple Health on iPhone restore.
  if (isHealthConnectActivity(activity)) {
    activity = 'healthkit';
  }
  // Legacy Watch-off used activity "none" on iOS — phone health is the default now.
  if (activity === 'none') {
    activity = 'healthkit';
  }

  let glucose = config.glucose;
  if (glucose === 'health-connect') {
    glucose = 'healthkit';
  }

  let heartRate = normalizeHeartRateSource(config.heartRate, activity);
  if (heartRate === 'health-connect') {
    heartRate = activity === 'withings' ? 'withings' : 'healthkit';
  }
  if (heartRate === 'none' && activity === 'healthkit') {
    heartRate = 'healthkit';
  }

  return {
    ...config,
    activity,
    glucose,
    heartRate,
  };
}

export async function loadSourceConfig(): Promise<SourceConfig> {
  const raw = await AsyncStorage.getItem(SOURCE_CONFIG_KEY);
  if (!raw) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as SourceConfig;
    if (parsed?.version === 1) {
      return normalizeSourceConfigForPlatform({
        ...parsed,
        activity: normalizeActivitySource(parsed.activity),
        heartRate: normalizeHeartRateSource(
          parsed.heartRate,
          normalizeActivitySource(parsed.activity),
        ),
      });
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_CONFIG };
}

export async function saveSourceConfig(config: SourceConfig): Promise<void> {
  await AsyncStorage.setItem(SOURCE_CONFIG_KEY, JSON.stringify(config));
}
