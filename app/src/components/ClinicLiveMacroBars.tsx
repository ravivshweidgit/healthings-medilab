/**
 * Read-only clinic live macro meters (same ≥ ≤ bars as Food Log).
 * Does not invent a leftover point target.
 */
import React from 'react';
import { MacroMeterBar } from './MacroMeterBar';
import type { ResolvedAxisMeter } from '../services/ClinicMacroBoundsService';
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
}: {
  meters: ResolvedAxisMeter[];
  eaten?: ClinicLiveEaten | null;
  energyUnit?: UnitsPrefs['energy'];
}) {
  if (!meters.length) return null;
  const energyU = energyUnit === 'kj' ? 'kj' : 'kcal';
  const energyLabel = energyU === 'kj' ? 'kJ' : 'kcal';
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

  return (
    <>
      {kcalM ? (
        <MacroMeterBar
          label={energyLabel}
          value={kcalToDisplay(eatenKcal, energyU)}
          target={kcalToDisplay(kcalM.ceiling ?? kcalM.floor ?? 0, energyU)}
          color={COLOR_KCAL}
          showTarget
          unit={energyU}
          clinicFloor={kcalM.floor != null ? kcalToDisplay(kcalM.floor, energyU) : undefined}
          clinicCeiling={kcalM.ceiling != null ? kcalToDisplay(kcalM.ceiling, energyU) : undefined}
          clinicCaption={kcalM.caption}
        />
      ) : null}
      <MacroMeterBar
        label="P"
        value={protein}
        target={p?.ceiling ?? p?.floor ?? 0}
        color={COLOR_PROTEIN}
        showTarget={!!p}
        clinicFloor={p?.floor}
        clinicCeiling={p?.ceiling}
        clinicCaption={p?.caption}
      />
      <MacroMeterBar
        label="C"
        value={carb}
        target={c?.ceiling ?? c?.floor ?? 0}
        color={COLOR_CARB}
        showTarget={!!c}
        clinicFloor={c?.floor}
        clinicCeiling={c?.ceiling}
        clinicCaption={c?.caption}
      />
      <MacroMeterBar
        label="F"
        value={fat}
        target={f?.ceiling ?? f?.floor ?? 0}
        color={COLOR_FAT}
        showTarget={!!f}
        clinicFloor={f?.floor}
        clinicCeiling={f?.ceiling}
        clinicCaption={f?.caption}
      />
      <MacroMeterBar
        label="Fi"
        value={fiber}
        target={fi?.ceiling ?? fi?.floor ?? 0}
        color={COLOR_FIBER}
        showTarget={!!fi}
        goalIsFloor
        clinicFloor={fi?.floor}
        clinicCeiling={fi?.ceiling}
      />
      <MacroMeterBar
        label="C-Fi"
        value={netEaten}
        target={net?.ceiling ?? net?.floor ?? 0}
        color={COLOR_NET_CARB}
        showTarget={!!net}
        clinicFloor={net?.floor}
        clinicCeiling={net?.ceiling}
      />
    </>
  );
}
