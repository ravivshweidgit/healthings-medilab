import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import type { MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { WellnessColors } from '../theme/wellness';

const N = 7;
const PLOT_PAD_L = 36;
const PAD_R = 10;
const PAD_TOP = 4;
const STRIP_H = 46;
const STRIP_GAP = 5;
const AXIS_BOTTOM = 22;

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

type Props = {
  days: MetabolicTrend7dDay[];
  loading?: boolean;
};

export function MetabolicTrendChart7d({ days, loading }: Props) {
  const { width } = useWindowDimensions();
  const chartW = Math.max(280, width - 40);

  const prepared = useMemo(() => {
    if (!days || days.length !== N) return null;

    const plotLeft = PLOT_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - PAD_R);
    const plotBottom = stripTop(3) + STRIP_H;

    const wVals = days.map((d) => d.weightKg).filter((v): v is number => v != null && Number.isFinite(v));
    const fVals = days.map((d) => d.fatMassKg).filter((v): v is number => v != null && Number.isFinite(v));
    const mVals = days.map((d) => d.muscleMassKg).filter((v): v is number => v != null && Number.isFinite(v));
    const vVals = days.map((d) => d.visceralFatIndex).filter((v): v is number => v != null && Number.isFinite(v));

    const wDom = domainPad(wVals, 76, 82, 0.08);
    const fDom = domainPad(fVals, 14, 20, 0.1);
    const mDom = domainPad(mVals, 58, 64, 0.08);
    const vDom = domainPad(vVals, 7, 11, 0.12);

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

    const wPts = mkPts((d) => d.weightKg, wDom, 0);
    const fPts = mkPts((d) => d.fatMassKg, fDom, 1);
    const mPts = mkPts((d) => d.muscleMassKg, mDom, 2);
    const vPts = mkPts((d) => d.visceralFatIndex, vDom, 3);

    const weightPath = buildSmoothPath(wPts);
    const fatPath = buildSmoothPath(fPts);
    const musclePath = buildSmoothPath(mPts);
    const visceralPath = buildSmoothPath(vPts);

    const mkGrid = (dom: { min: number; max: number }, stripIndex: number) => {
      const top = stripTop(stripIndex);
      return [dom.min, (dom.min + dom.max) / 2, dom.max].map((v) => ({
        key: `g-${stripIndex}-${v}`,
        y: mapY(v, dom.min, dom.max, top, STRIP_H),
        label: v.toFixed(1),
      }));
    };

    const gridW = mkGrid(wDom, 0);
    const gridF = mkGrid(fDom, 1);
    const gridM = mkGrid(mDom, 2);
    const gridV = mkGrid(vDom, 3);

    const xTicks = days.map((d, i) => ({
      x: xAtIndex(i, plotLeft, innerW),
      label: shortDayLabel(d.dayKey),
      key: d.dayKey,
    }));

    const svgH = stripTop(3) + STRIP_H + AXIS_BOTTOM;

    return {
      chartW,
      svgH,
      plotLeft,
      padR: PAD_R,
      innerW,
      plotBottom,
      weightPath,
      fatPath,
      musclePath,
      visceralPath,
      gridW,
      gridF,
      gridM,
      gridV,
      xTicks,
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
          {[prepared.gridW, prepared.gridF, prepared.gridM, prepared.gridV].flatMap((grid, stripIdx) =>
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

          {prepared.gridW.map((g) => (
            <SvgText key={`lw-${g.key}`} x={4} y={g.y + 3} fill={WellnessColors.accentBlue} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}
          {prepared.gridF.map((g) => (
            <SvgText key={`lf-${g.key}`} x={4} y={g.y + 3} fill={FAT_MASS_STROKE} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}
          {prepared.gridM.map((g) => (
            <SvgText key={`lm-${g.key}`} x={4} y={g.y + 3} fill={WellnessColors.accentGreen} fontSize={8} fontWeight="600">
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
        <Text style={styles.legW}>Weight (kg)</Text>
        <Text style={styles.legF}>Fat mass (kg)</Text>
        <Text style={styles.legM}>Muscle mass (kg)</Text>
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
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
    marginTop: 8,
    rowGap: 6,
  },
  legW: {
    color: WellnessColors.accentBlue,
    fontSize: 11,
    fontWeight: '500',
  },
  legF: {
    color: FAT_MASS_STROKE,
    fontSize: 11,
    fontWeight: '500',
  },
  legM: {
    color: WellnessColors.accentGreen,
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
