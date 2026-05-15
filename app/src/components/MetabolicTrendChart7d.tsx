import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import {
  periodAnchorBaselines,
  periodAnchorDeltas,
  resolveVisceralWeekTrend,
  visceralPercentChange,
  withingsChartCompositionKg,
  type CompositionPeriodAnchor,
  type MetabolicTrend7dDay,
  type VisceralWeekTrend,
} from '../logic/metabolicTrend7d';
import { WellnessColors } from '../theme/wellness';

const N = 7;
const PLOT_PAD_L = 36;
const PAD_R = 10;
const PAD_TOP = 4;
const STRIP_H = 46;
const STRIP_GAP = 5;
const AXIS_BOTTOM = 22;

/** Minimum half-span (kg) when all fat/muscle deltas are flat. */
const DELTA_FALLBACK_HALF_SPAN_KG = 0.5;

const FAT_MASS_STROKE = '#FB8C00';
const VISCERAL_STROKE = '#7B1FA2';

type PixelPoint = { x: number; y: number };

function shortDayLabel(dayKey: string): string {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dayKey;
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

function xAtIndex(i: number, plotLeft: number, innerW: number): number {
  return plotLeft + (i / Math.max(1, N - 1)) * innerW;
}

function domainPad(values: number[], fallbackMin: number, fallbackMax: number, padRatio: number): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: fallbackMin, max: fallbackMax };
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    lo -= 0.5;
    hi += 0.5;
  }
  const span = hi - lo;
  const pad = span * padRatio;
  return { min: lo - pad, max: hi + pad };
}

function mapY(v: number, vMin: number, vMax: number, top: number, height: number): number {
  const span = Math.max(1e-6, vMax - vMin);
  const ny = (v - vMin) / span;
  return top + (1 - ny) * height;
}

function buildSmoothPath(points: PixelPoint[]): string | null {
  if (points.length < 2) return null;
  const gen = line<PixelPoint>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);
  return gen(points) ?? null;
}

function stripTop(index: number): number {
  return PAD_TOP + index * (STRIP_H + STRIP_GAP);
}

function deltaKg(value: number | null, baseline: number | null): number | null {
  if (value == null || baseline == null || !Number.isFinite(value)) return null;
  return value - baseline;
}

/** Y-axis for the shared fat/muscle strip: min/max of plotted deltas with padding. */
function deltaDomainFromValues(deltas: number[]): { min: number; max: number } {
  const dom = domainPad(
    deltas,
    -DELTA_FALLBACK_HALF_SPAN_KG,
    DELTA_FALLBACK_HALF_SPAN_KG,
    0.15
  );
  if (deltas.length === 0) return dom;
  // One-sided week: extend to 0 so the baseline line stays in the strip.
  if (dom.max <= 0) return { min: dom.min, max: 0 };
  if (dom.min >= 0) return { min: 0, max: dom.max };
  return dom;
}

function formatDeltaTick(v: number): string {
  if (Math.abs(v) < 0.05) return '0';
  const sign = v > 0 ? '+' : '';
  return `${sign}${v.toFixed(1)}`;
}

type Props = {
  days: MetabolicTrend7dDay[];
  periodAnchor?: CompositionPeriodAnchor | null;
  loading?: boolean;
};

function legendLabelWithDelta(name: string, delta: number | null | undefined): string {
  if (delta == null || !Number.isFinite(delta)) return name;
  const sign = delta > 0 ? '+' : '';
  return `${name} (${sign}${delta.toFixed(1)} kg)`;
}

function legendLabelWithVisceralPercent(name: string, trend: VisceralWeekTrend): string {
  const { deltaIndex, baselineIndex } = trend;
  if (deltaIndex == null || !Number.isFinite(deltaIndex)) return name;
  if (baselineIndex != null) {
    const pct = visceralPercentChange(deltaIndex, baselineIndex);
    if (pct != null) {
      const sign = pct > 0 ? '+' : '';
      return `${name} (${sign}${pct.toFixed(1)}%)`;
    }
  }
  const sign = deltaIndex > 0 ? '+' : '';
  return `${name} (${sign}${deltaIndex.toFixed(2)})`;
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

export function MetabolicTrendChart7d({ days, periodAnchor, loading }: Props) {
  const { width } = useWindowDimensions();
  const chartW = Math.max(280, width - 40);

  const prepared = useMemo(() => {
    if (!days || days.length !== N) return null;

    const plotLeft = PLOT_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - PAD_R);
    const plotBottom = stripTop(2) + STRIP_H;

    const compBase = periodAnchorBaselines(periodAnchor);
    const fatBaseline = compBase?.fatKg ?? null;
    const muscleBaseline = compBase?.muscleKg ?? null;
    const chartFatKg = (i: number) => withingsChartCompositionKg(days, i, 'fatMassKg');
    const chartMuscleKg = (i: number) => withingsChartCompositionKg(days, i, 'muscleMassKg');

    const wVals = days.map((d) => d.weightKg).filter((v): v is number => v != null && Number.isFinite(v));
    const vVals = days.map((d) => d.visceralFatIndex).filter((v): v is number => v != null && Number.isFinite(v));

    const wDom = domainPad(wVals, 76, 82, 0.08);
    const vDom = domainPad(vVals, 7, 11, 0.12);

    const compositionDeltas: number[] = [];
    if (compBase && fatBaseline != null && muscleBaseline != null) {
      days.forEach((_, i) => {
        const f = deltaKg(chartFatKg(i), fatBaseline);
        const m = deltaKg(chartMuscleKg(i), muscleBaseline);
        if (f != null) compositionDeltas.push(f);
        if (m != null) compositionDeltas.push(m);
      });
    }
    const deltaDom = deltaDomainFromValues(compositionDeltas);

    const mkPts = (getter: (d: MetabolicTrend7dDay) => number | null, dom: { min: number; max: number }, stripIndex: number) => {
      const top = stripTop(stripIndex);
      const pts: PixelPoint[] = [];
      days.forEach((d, i) => {
        const v = getter(d);
        if (v != null && Number.isFinite(v)) {
          pts.push({
            x: xAtIndex(i, plotLeft, innerW),
            y: mapY(v, dom.min, dom.max, top, STRIP_H),
          });
        }
      });
      return pts;
    };

    const mkDeltaPts = (getter: (i: number) => number | null, baseline: number | null, stripIndex: number) => {
      const top = stripTop(stripIndex);
      const pts: PixelPoint[] = [];
      days.forEach((_, i) => {
        if (!compBase || baseline == null) return;
        const v = deltaKg(getter(i), baseline);
        if (v == null) return;
        pts.push({
          x: xAtIndex(i, plotLeft, innerW),
          y: mapY(v, deltaDom.min, deltaDom.max, top, STRIP_H),
        });
      });
      return pts;
    };

    const wPts = mkPts((d) => d.weightKg, wDom, 0);
    const fPts = mkDeltaPts(chartFatKg, fatBaseline, 1);
    const mPts = mkDeltaPts(chartMuscleKg, muscleBaseline, 1);
    const vPts = mkPts((d) => d.visceralFatIndex, vDom, 2);

    const weightPath = buildSmoothPath(wPts);
    const fatPath = buildSmoothPath(fPts);
    const musclePath = buildSmoothPath(mPts);
    const visceralPath = buildSmoothPath(vPts);

    const mkGrid = (dom: { min: number; max: number }, stripIndex: number, labelFn: (v: number) => string) => {
      const top = stripTop(stripIndex);
      return [dom.min, (dom.min + dom.max) / 2, dom.max].map((v) => ({
        key: `g-${stripIndex}-${v}`,
        y: mapY(v, dom.min, dom.max, top, STRIP_H),
        label: labelFn(v),
      }));
    };

    const gridW = mkGrid(wDom, 0, (v) => v.toFixed(1));
    const gridFM = mkGrid(deltaDom, 1, formatDeltaTick);
    const gridV = mkGrid(vDom, 2, (v) => v.toFixed(1));

    const zeroLineY = mapY(0, deltaDom.min, deltaDom.max, stripTop(1), STRIP_H);

    const xTicks = days.map((d, i) => ({
      x: xAtIndex(i, plotLeft, innerW),
      label: shortDayLabel(d.dayKey),
      key: d.dayKey,
    }));

    const svgH = stripTop(2) + STRIP_H + AXIS_BOTTOM;

    const anchorDeltas = periodAnchorDeltas(periodAnchor);
    const fatWeekDelta = anchorDeltas?.fatKg ?? null;
    const muscleWeekDelta = anchorDeltas?.muscleKg ?? null;
    const weightWeekDelta =
      periodAnchor != null ? periodAnchor.end.weightKg - periodAnchor.start.weightKg : null;
    const visceralWeekTrend = resolveVisceralWeekTrend(days, periodAnchor);

    return {
      chartW,
      svgH,
      plotLeft,
      padR: PAD_R,
      plotBottom,
      weightPath,
      fatPath,
      musclePath,
      visceralPath,
      gridW,
      gridFM,
      gridV,
      zeroLineY,
      xTicks,
      fatWeekDelta,
      muscleWeekDelta,
      weightWeekDelta,
      visceralWeekTrend,
    };
  }, [chartW, days, periodAnchor]);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={WellnessColors.accentBlue} />
        <Text style={styles.loadingText}>Loading 7-day trend…</Text>
      </View>
    );
  }

  if (!prepared) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Trend data will appear after refresh.</Text>
      </View>
    );
  }

  const hasAny = Boolean(
    prepared.weightPath || prepared.fatPath || prepared.musclePath || prepared.visceralPath
  );
  if (!hasAny) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Not enough Withings body data for a 7-day view yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>TREND ANALYSIS</Text>

      <View style={styles.chartRow}>
        <Svg width={prepared.chartW} height={prepared.svgH} style={styles.svg}>
          {[prepared.gridW, prepared.gridFM, prepared.gridV].flatMap((grid, stripIdx) =>
            grid.map((g) => (
              <Line
                key={g.key}
                x1={prepared.plotLeft}
                y1={g.y}
                x2={prepared.chartW - prepared.padR}
                y2={g.y}
                stroke={WellnessColors.gridLine}
                strokeWidth={1}
                opacity={stripIdx === 0 ? 0.88 : 0.5}
              />
            ))
          )}

          <Line
            x1={prepared.plotLeft}
            y1={prepared.zeroLineY}
            x2={prepared.chartW - prepared.padR}
            y2={prepared.zeroLineY}
            stroke={WellnessColors.textSecondary}
            strokeWidth={1}
            opacity={0.35}
          />

          {prepared.gridW.map((g) => (
            <SvgText key={`lw-${g.key}`} x={4} y={g.y + 3} fill={WellnessColors.accentBlue} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}
          {prepared.gridFM.map((g) => (
            <SvgText key={`lfm-${g.key}`} x={4} y={g.y + 3} fill={WellnessColors.textSecondary} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}
          {prepared.gridV.map((g) => (
            <SvgText key={`lv-${g.key}`} x={4} y={g.y + 3} fill={VISCERAL_STROKE} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}

          {prepared.weightPath ? (
            <Path d={prepared.weightPath} fill="none" stroke={WellnessColors.accentBlue} strokeWidth={2.2} />
          ) : null}
          {prepared.fatPath ? (
            <Path d={prepared.fatPath} fill="none" stroke={FAT_MASS_STROKE} strokeWidth={2.1} />
          ) : null}
          {prepared.musclePath ? (
            <Path d={prepared.musclePath} fill="none" stroke={WellnessColors.accentGreen} strokeWidth={2.1} />
          ) : null}
          {prepared.visceralPath ? (
            <Path
              d={prepared.visceralPath}
              fill="none"
              stroke={VISCERAL_STROKE}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ) : null}

          <Line
            x1={prepared.plotLeft}
            y1={prepared.plotBottom}
            x2={prepared.chartW - prepared.padR}
            y2={prepared.plotBottom}
            stroke={WellnessColors.gridLine}
            strokeWidth={1}
          />
          {prepared.xTicks.map((tk) => (
            <SvgText
              key={tk.key}
              x={tk.x}
              y={prepared.svgH - 8}
              fill={WellnessColors.textSecondary}
              fontSize={9}
              textAnchor="middle"
            >
              {tk.label}
            </SvgText>
          ))}
        </Svg>
      </View>

      <View style={styles.legend}>
        <View style={styles.legendRow}>
          <LegendItem color={WellnessColors.accentBlue} label={legendLabelWithDelta('Weight', prepared.weightWeekDelta)} />
          <LegendItem color={FAT_MASS_STROKE} label={legendLabelWithDelta('Fat', prepared.fatWeekDelta)} />
        </View>
        <View style={styles.legendRow}>
          <LegendItem color={WellnessColors.accentGreen} label={legendLabelWithDelta('Muscle', prepared.muscleWeekDelta)} />
          <LegendItem color={VISCERAL_STROKE} label={legendLabelWithVisceralPercent('Visceral', prepared.visceralWeekTrend)} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  svg: {
    flex: 1,
    minWidth: 0,
  },
  legend: {
    marginTop: 8,
    gap: 6,
    alignSelf: 'stretch',
    paddingHorizontal: 2,
  },
  legendRow: {
    flexDirection: 'row',
    gap: 10,
  },
  legendItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendLabel: {
    flex: 1,
    fontSize: 9.35,
    fontWeight: '500',
    color: WellnessColors.textSecondary,
  },
  loadingBox: {
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 13,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
