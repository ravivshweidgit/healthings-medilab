/**
 * English chrome labels for source_config summary (read-only hints).
 */

import {
  isHealthConnectActivity,
  isLiveGlucoseSource,
  type SourceConfig,
} from '../services/SourceConfigService';

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
  if (config.activity === 'health-connect' || config.activity === 'samsung-steps') {
    return 'Health Connect activity';
  }
  return 'Off';
}

function glucoseChip(config: SourceConfig): string {
  if (config.glucose === 'health-connect') return 'Health Connect';
  if (config.glucose === 'healthkit') return 'Apple Health';
  return 'Off';
}

export type MetabolicChartHeader = {
  show: boolean;
  /** Section title — GLUCOSE when CGM on, else ACTIVITY. */
  title: string;
  /** Collapsed one-line subtitle. */
  compactSub: string;
  a11yExpand: string;
  a11yCollapse: string;
};

/**
 * Dashboard metabolic chart card: show for CGM and/or watch activity (Withings / HC).
 * CGM off + Garmin/HC still gets the chart so workouts/HR/calories are visible.
 */
export function metabolicChartHeader(
  config: SourceConfig | null | undefined,
  glucoseSummaryLine: string | null,
): MetabolicChartHeader {
  const glucoseOn = isLiveGlucoseSource(config?.glucose ?? 'none');
  const activityWithings = config?.activity === 'withings';
  const activityHc = isHealthConnectActivity(config?.activity ?? 'none');
  const activityOn = activityWithings || activityHc;
  const show = Boolean(glucoseOn || activityOn);

  if (!show) {
    return {
      show: false,
      title: 'GLUCOSE',
      compactSub: '',
      a11yExpand: 'Expand chart',
      a11yCollapse: 'Collapse chart',
    };
  }

  if (glucoseOn) {
    const activityHint = activityWithings
      ? 'Withings watch'
      : activityHc
        ? 'Health Connect activity'
        : null;
    const glucoseBus =
      config?.glucose === 'healthkit' ? 'Apple Health' : 'Health Connect';
    const compactSub =
      glucoseSummaryLine ??
      (activityHint ? `No reading · ${activityHint}` : `No reading · ${glucoseBus}`);
    return {
      show: true,
      title: 'GLUCOSE',
      compactSub,
      a11yExpand: 'Expand glucose chart',
      a11yCollapse: 'Collapse glucose chart',
    };
  }

  // Activity-only (CGM off) — same MetabolicChart, empty glucose series.
  const activityLabel = activityWithings ? 'Withings watch' : 'Health Connect activity';
  return {
    show: true,
    title: 'ACTIVITY',
    compactSub: `${activityLabel} · no CGM`,
    a11yExpand: 'Expand activity chart',
    a11yCollapse: 'Collapse activity chart',
  };
}
