import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import type { MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { WellnessColors } from '../theme/wellness';

const N = 7;
const PAD_L = 8;
const PAD_R = 10;
const PAD_T = 8;
const PAD_B = 26;
const TOP_SLOT_FRAC = 0.52;
const PLOT_H = 200;
const SVG_H = PAD_T + PLOT_H + PAD_B;

const VISCERAL_STROKE = '#7B1FA2';

type PixelPoint = { x: number; y: number };

function shortDayLabel(dayKey: string): string {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dayKey;
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
}

function xAtIndex(i: number, padL: number, innerW: number): number {
  return padL + (i / Math.max(1, N - 1)) * innerW;
}

function domainPad(values: number[], fallbackMin: number, fallbackMax: number, padRatio: number): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: fallbackMin, max: fallbackMax };
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
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

type Props = {
  days: MetabolicTrend7dDay[];
  loading?: boolean;
};

export function MetabolicTrendChart7d({ days, loading }: Props) {
  const { width } = useWindowDimensions();
  const chartW = Math.max(280, width - 40);

  const prepared = useMemo(() => {
    if (!days || days.length !== N) return null;

    const padL = PAD_L;
    const padR = PAD_R;
    const padT = PAD_T;
    const innerW = Math.max(1, chartW - padL - padR);
    const topSlotH = PLOT_H * TOP_SLOT_FRAC;
    const bottomSlotTop = padT + topSlotH + 6;
    const bottomSlotH = PLOT_H - topSlotH - 6;

    const gVals = days.map((d) => d.avgGlucoseMgDl).filter((v): v is number => v != null && Number.isFinite(v));
    const wVals = days.map((d) => d.weightKg).filter((v): v is number => v != null && Number.isFinite(v));
    const vVals = days.map((d) => d.visceralFatIndex).filter((v): v is number => v != null && Number.isFinite(v));

    const gDom = domainPad(gVals, 85, 130, 0.12);
    const wDom = domainPad(wVals, 76, 82, 0.08);
    const vDom = domainPad(vVals, 7, 11, 0.12);

    const gPts: PixelPoint[] = [];
    const wPts: PixelPoint[] = [];
    const vPts: PixelPoint[] = [];

    days.forEach((d, i) => {
      const x = xAtIndex(i, padL, innerW);
      if (d.avgGlucoseMgDl != null && Number.isFinite(d.avgGlucoseMgDl)) {
        gPts.push({
          x,
          y: mapY(d.avgGlucoseMgDl, gDom.min, gDom.max, padT, topSlotH),
        });
      }
      if (d.weightKg != null && Number.isFinite(d.weightKg)) {
        wPts.push({
          x,
          y: mapY(d.weightKg, wDom.min, wDom.max, bottomSlotTop, bottomSlotH),
        });
      }
      if (d.visceralFatIndex != null && Number.isFinite(d.visceralFatIndex)) {
        vPts.push({
          x,
          y: mapY(d.visceralFatIndex, vDom.min, vDom.max, bottomSlotTop, bottomSlotH),
        });
      }
    });

    const glucosePath = buildSmoothPath(gPts);
    const weightPath = buildSmoothPath(wPts);
    const visceralPath = buildSmoothPath(vPts);

    const xTicks = days.map((d, i) => ({
      x: xAtIndex(i, padL, innerW),
      label: shortDayLabel(d.dayKey),
      key: d.dayKey,
    }));

    const gridG = [gDom.min, (gDom.min + gDom.max) / 2, gDom.max].map((mg) => ({
      key: `gg-${mg}`,
      y: mapY(mg, gDom.min, gDom.max, padT, topSlotH),
      label: Math.round(mg),
    }));

    const gridW = [wDom.min, (wDom.min + wDom.max) / 2, wDom.max].map((kg) => ({
      key: `wg-${kg}`,
      y: mapY(kg, wDom.min, wDom.max, bottomSlotTop, bottomSlotH),
      label: kg.toFixed(1),
    }));

    return {
      chartW,
      svgH: SVG_H,
      padL,
      padR,
      padT,
      innerW,
      plotBottom: padT + PLOT_H,
      glucosePath,
      weightPath,
      visceralPath,
      xTicks,
      gridG,
      gridW,
    };
  }, [chartW, days]);

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

  const hasAny = Boolean(prepared.glucosePath || prepared.weightPath || prepared.visceralPath);
  if (!hasAny) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Not enough data for a 7-day overlay yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>TREND ANALYSIS</Text>
      <Text style={styles.subtitle}>
        Average daily glucose (CareSens / Health Connect) with Withings weight and visceral fat — last 7 local days.
        Long walks (e.g. 7.2 km) should show up alongside glucose stability and composition drift.
      </Text>

      <View style={styles.chartRow}>
        <View style={[styles.yAxis, { height: PLOT_H }]}>
          {prepared.gridG.map((g) => (
            <Text key={g.key} style={[styles.yLab, styles.yLabGlucose, { top: g.y - 7 }]}>
              {g.label}
            </Text>
          ))}
          {prepared.gridW.map((g) => (
            <Text key={g.key} style={[styles.yLab, styles.yLabWeight, { top: g.y - 7 }]}>
              {g.label}
            </Text>
          ))}
        </View>
        <Svg width={prepared.chartW} height={prepared.svgH} style={styles.svg}>
          {prepared.gridG.map((g) => (
            <Line
              key={g.key}
              x1={prepared.padL}
              y1={g.y}
              x2={prepared.chartW - prepared.padR}
              y2={g.y}
              stroke={WellnessColors.gridLine}
              strokeWidth={1}
              opacity={0.85}
            />
          ))}
          {prepared.gridW.map((g) => (
            <Line
              key={g.key}
              x1={prepared.padL}
              y1={g.y}
              x2={prepared.chartW - prepared.padR}
              y2={g.y}
              stroke={WellnessColors.gridLine}
              strokeWidth={1}
              opacity={0.45}
            />
          ))}

          {prepared.weightPath ? (
            <Path d={prepared.weightPath} fill="none" stroke={WellnessColors.accentBlue} strokeWidth={2.2} />
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
          {prepared.glucosePath ? (
            <Path d={prepared.glucosePath} fill="none" stroke={WellnessColors.accentGreen} strokeWidth={2.6} />
          ) : null}

          <Line
            x1={prepared.padL}
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
        <Text style={styles.legG}>Avg glucose (mg/dL)</Text>
        <Text style={styles.legW}>Weight (kg)</Text>
        <Text style={styles.legV}>Visceral fat index</Text>
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
    marginBottom: 6,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 12,
    color: WellnessColors.textSecondary,
    lineHeight: 18,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  yAxis: {
    width: 36,
    marginRight: 4,
    position: 'relative',
  },
  yLab: {
    position: 'absolute',
    right: 0,
    fontSize: 9,
    fontVariant: ['tabular-nums'],
    color: WellnessColors.textSecondary,
    textAlign: 'right',
    width: 36,
  },
  yLabGlucose: {
    color: WellnessColors.accentGreen,
    opacity: 0.95,
  },
  yLabWeight: {
    color: WellnessColors.accentBlue,
    opacity: 0.9,
  },
  svg: {
    flex: 1,
    minWidth: 0,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
    rowGap: 6,
  },
  legG: {
    color: WellnessColors.accentGreen,
    fontSize: 11,
    fontWeight: '500',
  },
  legW: {
    color: WellnessColors.accentBlue,
    fontSize: 11,
    fontWeight: '500',
  },
  legV: {
    color: VISCERAL_STROKE,
    fontSize: 11,
    fontWeight: '500',
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
