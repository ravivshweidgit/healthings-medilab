/**
 * English chrome labels for source_config summary chips (My Profile).
 */

import type { SourceConfig } from '../services/SourceConfigService';

export type SetupChip = { key: string; label: string; value: string };

export function buildSetupChips(config: SourceConfig, withingsLinked: boolean): SetupChip[] {
  return [
    { key: 'body', label: 'Body', value: bodyChip(config, withingsLinked) },
    { key: 'activity', label: 'Activity', value: activityChip(config, withingsLinked) },
    { key: 'glucose', label: 'Glucose', value: glucoseChip(config) },
  ];
}

function bodyChip(config: SourceConfig, withingsLinked: boolean): string {
  if (config.bodyComposition === 'manual') return 'Manual weigh-in';
  if (config.bodyComposition === 'withings' || withingsLinked) return 'Withings scale';
  return 'Not set';
}

function activityChip(config: SourceConfig, withingsLinked: boolean): string {
  if (config.activity === 'withings') return 'Withings watch';
  if (config.activity === 'samsung-steps') return 'Phone steps';
  if (withingsLinked && config.activity === 'none') return 'Withings watch';
  return 'Off';
}

function glucoseChip(config: SourceConfig): string {
  if (config.glucose === 'health-connect') return 'Health Connect';
  return 'Off';
}
