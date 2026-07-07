/**
 * English chrome labels for source_config summary (read-only hints).
 */

import type { SourceConfig } from '../services/SourceConfigService';

export type SetupChip = { key: string; label: string; value: string };

export function buildSetupChips(config: SourceConfig): SetupChip[] {
  return [
    { key: 'body', label: 'Body', value: bodyChip(config) },
    { key: 'activity', label: 'Activity', value: activityChip(config) },
    { key: 'glucose', label: 'Glucose', value: glucoseChip(config) },
  ];
}

function bodyChip(config: SourceConfig): string {
  if (config.bodyComposition === 'manual') return 'Manual weigh-in';
  if (config.bodyComposition === 'withings') return 'Withings scale';
  return 'Not set';
}

function activityChip(config: SourceConfig): string {
  if (config.activity === 'withings') return 'Withings watch';
  if (config.activity === 'samsung-steps') return 'Health Connect steps';
  return 'Off';
}

function glucoseChip(config: SourceConfig): string {
  if (config.glucose === 'health-connect') return 'Health Connect';
  return 'Off';
}
