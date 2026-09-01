/**
 * Read-only clinic live macro meters (same chrome as Food Log).
 * HARD axes get a target; missing / FLEX axes still show eaten when `eaten` is passed.
 */
import React from 'react';
import { MacroMeterBar } from './MacroMeterBar';
import type { MeterCaption, ResolvedAxisMeter } from '../services/ClinicMacroBoundsService';
import { getFoodLogUiCopy } from '../i18n/foodLogUiCopy';
import { kcalToDisplay } from '../logic/unitConvert';
import type { UnitsPrefs } from '../services/UnitsPreferenceService';

const COLOR_KCAL = '#5C6BC0';
const COLOR_PROTEIN = '#42A5F5';
const COLOR_CARB = '#FF9800';
const COLOR_FAT = '#EF5350';
const COLOR_FIBER = '#66BB6A';
const COLOR_NET_CARB = '#FB8C00';

export type ClinicLiveEaten = {
  kcal?: number;
  protein_g?: number;
  carb_g?: number;
  fat_g?: number;
  fiber_g?: number;
};

function meter(meters: ResolvedAxisMeter[], axis: ResolvedAxisMeter['axis']) {
  return meters.find((m) => m.axis === axis);
}

export function ClinicLiveMacroBars({
  meters,
  eaten,
  energyUnit = 'kcal',
  langCode,
}: {
  meters: ResolvedAxisMeter[];
  eaten?: ClinicLiveEaten | null;
  energyUnit?: UnitsPrefs['energy'];
  /** `appLocale` — target wording and caption language. */
  langCode?: string | null;
}) {
  if (!meters.length && !eaten) return null;
  const energyU = energyUnit === 'kj' ? 'kj' : 'kcal';
  const energyLabel = energyU === 'kj' ? 'kJ' : 'kcal';
  const copy = getFoodLogUiCopy(langCode);
  const caption = (info?: MeterCaption): string | undefined => {
    if (!info) return undefined;
    const n = (kcal: number) => String(Math.round(kcalToDisplay(kcal, energyU)));
    if (info.kind === 'activityAdded') return copy.activityAdded(n(info.base), n(info.extra));
    if (info.kind === 'activityNotCounted') return copy.activityNotCounted(n(info.base));
    return copy.percentOfTarget(String(info.percent), n(info.base));
  };
  const kcalM = meter(meters, 'kcal');
  const p = meter(meters, 'protein_g');
  const c = meter(meters, 'carb_g');
  const f = meter(meters, 'fat_g');
  const fi = meter(meters, 'fiber_g');
  const net = meter(meters, 'net_carb_g');
  const protein = eaten?.protein_g ?? 0;
  const carb = eaten?.carb_g ?? 0;
  const fat = eaten?.fat_g ?? 0;
  const fiber = eaten?.fiber_g ?? 0;
  const netEaten = Math.max(0, carb - fiber);
  const eatenKcal = eaten?.kcal ?? 0;
  const fill = Math.max(protein, carb, fat, fiber, netEaten, 1);

  // Always list the core axes when we have eaten totals — FLEX = eaten only, no target.
  const showCore = eaten != null || meters.length > 0;

  return (
    <>
      {kcalM || eaten != null ? (
        <MacroMeterBar
          label={energyLabel}
          value={kcalToDisplay(eatenKcal, energyU)}
          target={
            kcalM
              ? kcalToDisplay(kcalM.ceiling ?? kcalM.floor ?? 0, energyU)
              : Math.max(kcalToDisplay(eatenKcal, energyU), 1)
          }
          color={COLOR_KCAL}
          showTarget={!!kcalM}
          unit={energyU}
          langCode={langCode}
          clinicFloor={kcalM?.floor != null ? kcalToDisplay(kcalM.floor, energyU) : undefined}
          clinicCeiling={kcalM?.ceiling != null ? kcalToDisplay(kcalM.ceiling, energyU) : undefined}
          clinicCaption={caption(kcalM?.captionInfo)}
        />
      ) : null}
      {showCore ? (
        <MacroMeterBar
          label={copy.barProtein}
          value={protein}
          target={p?.ceiling ?? p?.floor ?? fill}
          color={COLOR_PROTEIN}
          showTarget={!!p}
          langCode={langCode}
          clinicFloor={p?.floor}
          clinicCeiling={p?.ceiling}
          clinicCaption={caption(p?.captionInfo)}
        />
      ) : null}
      {showCore ? (
        <MacroMeterBar
          label={copy.barCarb}
          value={carb}
          target={c?.ceiling ?? c?.floor ?? fill}
          color={COLOR_CARB}
          showTarget={!!c}
          langCode={langCode}
          clinicFloor={c?.floor}
          clinicCeiling={c?.ceiling}
          clinicCaption={caption(c?.captionInfo)}
        />
      ) : null}
      {showCore ? (
        <MacroMeterBar
          label={copy.barFat}
          value={fat}
          target={f?.ceiling ?? f?.floor ?? fill}
          color={COLOR_FAT}
          showTarget={!!f}
          langCode={langCode}
          clinicFloor={f?.floor}
          clinicCeiling={f?.ceiling}
          clinicCaption={caption(f?.captionInfo)}
        />
      ) : null}
      {showCore ? (
        <MacroMeterBar
          label={copy.barFiber}
          value={fiber}
          target={fi?.ceiling ?? fi?.floor ?? fill}
          color={COLOR_FIBER}
          showTarget={!!fi}
          goalIsFloor
          langCode={langCode}
          clinicFloor={fi?.floor}
          clinicCeiling={fi?.ceiling}
        />
      ) : null}
      {showCore ? (
        <MacroMeterBar
          label={copy.barNetCarb}
          value={netEaten}
          target={net?.ceiling ?? net?.floor ?? fill}
          color={COLOR_NET_CARB}
          showTarget={!!net}
          langCode={langCode}
          clinicFloor={net?.floor}
          clinicCeiling={net?.ceiling}
        />
      ) : null}
    </>
  );
}
