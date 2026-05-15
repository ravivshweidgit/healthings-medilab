import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import { resolveBmrWeekTrend, withingsChartBmrKcal, type MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { WellnessColors } from '../theme/wellness';

const N = 7;
const PLOT_PAD_L = 40;
const PAD_R = 10;
const PAD_TOP = 4;
const STRIP_H = 52;
const AXIS_BOTTOM = 22;
const BMR_STROKE = '#FF7043';

type PixelPoint = { x: number; y: number };

type Props = {
  days: MetabolicTrend7dDay[];
  loading?: boolean;
};

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
    lo -= 25;
    hi += 25;
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

function legendLabelWithDelta(name: string, deltaKcal: number | null | undefined): string {
  if (deltaKcal == null || !Number.isFinite(deltaKcal)) return name;
  const sign = deltaKcal > 0 ? '+' : '';
  return `${name} (${sign}${Math.round(deltaKcal)} kcal)`;
}

export function BmrHistoryChart7d({ days, loading }: Props) {
  const { width } = useWindowDimensions();
  const chartW = Math.max(280, width - 40);

  const prepared = useMemo(() => {
    if (!days || days.length !== N) return null;

    const plotLeft = PLOT_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - PAD_R);
    const top = PAD_TOP;
    const plotBottom = top + STRIP_H;

    const chartBmr = (i: number) => withingsChartBmrKcal(days, i);
    const bmrVals = days
      .map((_, i) => chartBmr(i))
      .filter((v): v is number => v != null && Number.isFinite(v));
    const dom = domainPad(bmrVals, 1700, 2000, 0.08);

    const pts: PixelPoint[] = [];
    days.forEach((_, i) => {
      const v = chartBmr(i);
      if (v != null && Number.isFinite(v)) {
        pts.push({
          x: xAtIndex(i, plotLeft, innerW),
          y: mapY(v, dom.min, dom.max, top, STRIP_H),
        });
      }
    });

    const path = buildSmoothPath(pts);
    const grid = [dom.min, (dom.min + dom.max) / 2, dom.max].map((v) => ({
      key: `g-${v}`,
      y: mapY(v, dom.min, dom.max, top, STRIP_H),
      label: Math.round(v).toString(),
    }));

    const xTicks = days.map((d, i) => ({
      x: xAtIndex(i, plotLeft, innerW),
      label: shortDayLabel(d.dayKey),
      key: d.dayKey,
    }));

    const weekDelta = resolveBmrWeekTrend(days).deltaKcal;
    const svgH = plotBottom + AXIS_BOTTOM;

    return { chartW, svgH, plotLeft, padR: PAD_R, plotBottom, path, grid, xTicks, weekDelta };
  }, [chartW, days]);

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={BMR_STROKE} />
        <Text style={styles.loadingText}>Loading BMR history…</Text>
      </View>
    );
  }

  if (!prepared) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>BMR history will appear after refresh.</Text>
      </View>
    );
  }

  if (!prepared.path) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>No BMR readings in the last 7 days yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>BMR HISTORY</Text>

      <Svg width={prepared.chartW} height={prepared.svgH} style={styles.svg}>
        {prepared.grid.map((g) => (
          <Line
            key={g.key}
            x1={prepared.plotLeft}
            y1={g.y}
            x2={prepared.chartW - prepared.padR}
            y2={g.y}
            stroke={WellnessColors.gridLine}
            strokeWidth={1}
            opacity={0.88}
          />
        ))}
        {prepared.grid.map((g) => (
          <SvgText key={`l-${g.key}`} x={4} y={g.y + 3} fill={BMR_STROKE} fontSize={8} fontWeight="600">
            {g.label}
          </SvgText>
        ))}
        <Path d={prepared.path} fill="none" stroke={BMR_STROKE} strokeWidth={2.2} />
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

      <View style={styles.legendRow}>
        <View style={styles.legendSwatch} />
        <Text style={styles.legendLabel} numberOfLines={1}>
          {legendLabelWithDelta('BMR', prepared.weekDelta)}
        </Text>
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
  svg: {
    flex: 1,
    minWidth: 0,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
    backgroundColor: BMR_STROKE,
  },
  legendLabel: {
    fontSize: 9.35,
    fontWeight: '500',
    color: WellnessColors.textSecondary,
  },
  loadingBox: {
    minHeight: 100,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 13,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
});
