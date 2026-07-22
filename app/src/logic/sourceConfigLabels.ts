/**
 * English chrome labels for source_config summary (read-only hints).
 * Metabolic chart strip titles/status follow coach language (prompt87).
 */

import { getMetabolicStripCopy } from '../i18n/metabolicStripCopy';
import {
  isHealthConnectActivity,
  isHealthKitActivity,
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
  if (isHealthConnectActivity(config.activity)) return 'Health Connect';
  if (isHealthKitActivity(config.activity)) return 'Apple Health';
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
 * Dashboard metabolic chart card: show for CGM and/or watch activity (Withings / phone health).
 * Titles + status phrases use coach language; brand names stay English.
 */
export function metabolicChartHeader(
  config: SourceConfig | null | undefined,
  glucoseSummaryLine: string | null,
  langCode?: string | null,
): MetabolicChartHeader {
  const t = getMetabolicStripCopy(langCode);
  const glucoseOn = isLiveGlucoseSource(config?.glucose ?? 'none');
  const activityWithings = config?.activity === 'withings';
  const activityHc = isHealthConnectActivity(config?.activity ?? 'none');
  const activityHk = isHealthKitActivity(config?.activity ?? 'none');
  const activityOn = activityWithings || activityHc || activityHk;
  const show = Boolean(glucoseOn || activityOn);

  if (!show) {
    return {
      show: false,
      title: t.glucoseTitle,
      compactSub: '',
      a11yExpand: t.a11yExpandGlucose,
      a11yCollapse: t.a11yCollapseGlucose,
    };
  }

  const phoneHealthLabel = activityHk ? 'Apple Health' : 'Health Connect';

  if (glucoseOn) {
    const activityHint = activityWithings
      ? 'Withings watch'
      : activityHc || activityHk
        ? phoneHealthLabel
        : null;
    const glucoseBus =
      config?.glucose === 'healthkit' ? 'Apple Health' : 'Health Connect';
    const compactSub =
      glucoseSummaryLine ??
      (activityHint
        ? `${t.noReading} · ${activityHint}`
        : `${t.noReading} · ${glucoseBus}`);
    return {
      show: true,
      title: t.glucoseTitle,
      compactSub,
      a11yExpand: t.a11yExpandGlucose,
      a11yCollapse: t.a11yCollapseGlucose,
    };
  }

  const activityLabel = activityWithings ? 'Withings watch' : phoneHealthLabel;
  return {
    show: true,
    title: t.activityTitle,
    compactSub: `${activityLabel} · ${t.noCgm}`,
    a11yExpand: t.a11yExpandActivity,
    a11yCollapse: t.a11yCollapseActivity,
  };
}
