import React, { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import { resolveBmrWeekTrend, withingsChartBmrKcal, type MetabolicTrend7dDay } from '../logic/metabolicTrend7d';
import { WellnessColors } from '../theme/wellness';

// ── Layout constants ────────────────────────────────────────────────────────
const PLOT_PAD_L = 44;   // left gutter for Y-axis labels
const PAD_R      = 10;
const PAD_TOP    = 6;
const TITLE_H    = 15;   // strip label height
const STRIP_H    = 58;   // data area height per strip
const STRIP_UNIT = TITLE_H + STRIP_H;  // 73 px per strip
const AXIS_BOTTOM = 24;  // X-axis label zone
const NUM_STRIPS  = 3;
const SVG_H = PAD_TOP + NUM_STRIPS * STRIP_UNIT + AXIS_BOTTOM;

// ── Colours ─────────────────────────────────────────────────────────────────
const COLOR_BMR      = WellnessColors.textPrimary;  // black / near-black
const COLOR_ACTIVITY = '#42A5F5';  // medium blue
const COLOR_TOTAL    = '#4CAF50';  // green

// ── Types ────────────────────────────────────────────────────────────────────
type PixelPoint = { x: number; y: number };

type Props = {
  days: MetabolicTrend7dDay[];
  loading?: boolean;
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function axisDayLabel(dayKey: string, n: number): string {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return dayKey;
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  if (n <= 8) return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function pickTickIndices(n: number, maxTicks: number): number[] {
  if (n <= 1) return [0];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  const step = (n - 1) / (maxTicks - 1);
  for (let k = 0; k < maxTicks; k++) out.add(Math.round(k * step));
  out.add(n - 1);
  return Array.from(out).sort((a, b) => a - b);
}

function xAtIndex(i: number, plotLeft: number, innerW: number, n: number): number {
  return plotLeft + (i / Math.max(1, n - 1)) * innerW;
}

function domainPad(
  values: number[],
  fallbackMin: number,
  fallbackMax: number,
  padRatio: number
): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: fallbackMin, max: fallbackMax };
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) { lo -= 20; hi += 20; }
  const pad = (hi - lo) * padRatio;
  return { min: lo - pad, max: hi + pad };
}

function mapY(v: number, vMin: number, vMax: number, top: number, height: number): number {
  const span = Math.max(1e-6, vMax - vMin);
  return top + (1 - (v - vMin) / span) * height;
}

function buildSmoothPath(points: PixelPoint[]): string | null {
  if (points.length < 2) return null;
  const gen = line<PixelPoint>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);
  return gen(points) ?? null;
}

/** Three Y-axis tick values: bottom, mid, top. */
function yTicks(min: number, max: number): number[] {
  const mid = (min + max) / 2;
  return [max, mid, min].map(Math.round);
}

// ── Component ─────────────────────────────────────────────────────────────────
export function BmrHistoryChart7d({ days, loading }: Props) {
  const { width } = useWindowDimensions();
  const chartW = Math.max(280, width - 40);

  const prepared = useMemo(() => {
    if (!days || days.length < 2) return null;

    const n       = days.length;
    const plotLeft = PLOT_PAD_L;
    const innerW   = Math.max(1, chartW - plotLeft - PAD_R);

    // ── Raw data arrays ──────────────────────────────────────────────────────
    const bmrVals:   number[] = [];
    const actVals:   number[] = [];
    const totalVals: number[] = [];

    days.forEach((d, i) => {
      const bmr = withingsChartBmrKcal(days, i);
      const act = d.activityKcalDay;
      if (bmr != null) bmrVals.push(bmr);
      if (act != null && act > 0) actVals.push(act);
      if (bmr != null && act != null) totalVals.push(bmr + act);
    });

    // ── Domains (independent per strip) ──────────────────────────────────────
    const bmrDom  = domainPad(bmrVals,   1600, 2400, 0.06);
    const actDom  = domainPad(actVals,   0,    500,  0.06);
    actDom.min    = 0; // activity always anchored at 0
    const totDom  = domainPad(totalVals, 1800, 2800, 0.06);

    // ── Strip Y-coordinate helpers ────────────────────────────────────────────
    // Strip 0 = BMR, Strip 1 = Activity, Strip 2 = Total
    const stripDataTop = (idx: number) => PAD_TOP + idx * STRIP_UNIT + TITLE_H;
    const stripDataBot = (idx: number) => stripDataTop(idx) + STRIP_H;

    const myBmr   = (v: number) => mapY(v, bmrDom.min,  bmrDom.max,  stripDataTop(0), STRIP_H);
    const myAct   = (v: number) => mapY(v, actDom.min,  actDom.max,  stripDataTop(1), STRIP_H);
    const myTotal = (v: number) => mapY(v, totDom.min,  totDom.max,  stripDataTop(2), STRIP_H);

    // ── BMR line ─────────────────────────────────────────────────────────────
    const bmrPts: PixelPoint[] = [];
    days.forEach((_, i) => {
      const v = withingsChartBmrKcal(days, i);
      if (v != null) bmrPts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: myBmr(v) });
    });

    // ── Activity line ─────────────────────────────────────────────────────────
    const actPts: PixelPoint[] = [];
    days.forEach((d, i) => {
      const act = d.activityKcalDay;
      if (act == null || !Number.isFinite(act)) return;
      actPts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: myAct(act) });
    });

    // ── Total burn line ────────────────────────────────────────────────────────
    const totalPts: PixelPoint[] = [];
    days.forEach((d, i) => {
      const bmr = withingsChartBmrKcal(days, i);
      const act = d.activityKcalDay;
      if (bmr != null && act != null)
        totalPts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: myTotal(bmr + act) });
    });

    // ── Grid lines per strip ─────────────────────────────────────────────────
    type GridLine = { y: number; label: string; key: string };
    const makeGrid = (dom: { min: number; max: number }, stripIdx: number): GridLine[] =>
      yTicks(dom.min, dom.max).map((v, k) => ({
        y:     mapY(v, dom.min, dom.max, stripDataTop(stripIdx), STRIP_H),
        label: String(v),
        key:   `g${stripIdx}-${k}`,
      }));

    const bmrGrid  = makeGrid(bmrDom,  0);
    const actGrid  = makeGrid(actDom,  1);
    const totGrid  = makeGrid(totDom,  2);

    // ── X axis ticks (shared) ─────────────────────────────────────────────────
    const tickIdx = new Set(pickTickIndices(n, 7));
    const xAxisY  = PAD_TOP + NUM_STRIPS * STRIP_UNIT;
    const xTicks  = days
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ d, i }) => ({
        x: xAtIndex(i, plotLeft, innerW, n),
        label: axisDayLabel(d.dayKey, n),
        key: d.dayKey,
      }));

    const weekDelta = resolveBmrWeekTrend(days).deltaKcal;

    return {
      chartW, n, plotLeft, innerW,
      bmrPts, actPts, totalPts,
      bmrGrid, actGrid, totGrid,
      xTicks, xAxisY,
      weekDelta,
    };
  }, [chartW, days]);

  // ── Loading / empty states ───────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={COLOR_BMR} />
        <Text style={styles.loadingText}>Loading energy history…</Text>
      </View>
    );
  }
  if (!prepared) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>Energy history will appear after refresh.</Text>
      </View>
    );
  }
  if (!buildSmoothPath(prepared.bmrPts)) {
    return (
      <View style={styles.loadingBox}>
        <Text style={styles.loadingText}>No BMR readings in this window yet.</Text>
      </View>
    );
  }

  const renderDivider = (idx: number) => (
    <Line
      key={`div-${idx}`}
      x1={prepared.plotLeft} y1={PAD_TOP + idx * STRIP_UNIT}
      x2={prepared.chartW - PAD_R} y2={PAD_TOP + idx * STRIP_UNIT}
      stroke={WellnessColors.gridLine} strokeWidth={1} opacity={0.6}
    />
  );

  const renderStripGrid = (
    grid: { y: number; label: string; key: string }[]
  ) =>
    grid.map((g) => (
      <React.Fragment key={g.key}>
        <Line
          x1={prepared.plotLeft} y1={g.y}
          x2={prepared.chartW - PAD_R} y2={g.y}
          stroke={WellnessColors.gridLine} strokeWidth={1} opacity={0.5}
        />
        <SvgText x={3} y={g.y + 3} fill={WellnessColors.textSecondary} fontSize={8} textAnchor="start">
          {g.label}
        </SvgText>
      </React.Fragment>
    ));

  const bmrPath   = buildSmoothPath(prepared.bmrPts);
  const actPath   = buildSmoothPath(prepared.actPts);
  const totalPath = buildSmoothPath(prepared.totalPts);

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>ENERGY</Text>

      <Svg width={prepared.chartW} height={SVG_H} style={styles.svg}>

        {/* ── Strip 0: BMR ──────────────────────────────────────────────── */}
        {renderDivider(0)}
        <SvgText
          x={prepared.plotLeft + 4} y={PAD_TOP + 11}
          fill={COLOR_BMR} fontSize={9} fontWeight="700"
        >
          BMR {prepared.weekDelta != null
            ? `(${prepared.weekDelta >= 0 ? '+' : ''}${Math.round(prepared.weekDelta)} kcal/wk)`
            : ''}
        </SvgText>
        {renderStripGrid(prepared.bmrGrid)}
        {bmrPath ? (
          <Path d={bmrPath} fill="none" stroke={COLOR_BMR} strokeWidth={2.2} />
        ) : null}

        {/* ── Strip 1: Active calories ───────────────────────────────────── */}
        {renderDivider(1)}
        <SvgText
          x={prepared.plotLeft + 4} y={PAD_TOP + STRIP_UNIT + 11}
          fill={COLOR_ACTIVITY} fontSize={9} fontWeight="700"
        >
          ACTIVE CAL
        </SvgText>
        {renderStripGrid(prepared.actGrid)}
        {actPath ? (
          <Path d={actPath} fill="none" stroke={COLOR_ACTIVITY} strokeWidth={2.2} />
        ) : (
          <SvgText
            x={prepared.plotLeft + prepared.innerW / 2}
            y={PAD_TOP + STRIP_UNIT + TITLE_H + STRIP_H / 2 + 4}
            fill={WellnessColors.textSecondary} fontSize={10} textAnchor="middle"
          >
            No activity data yet
          </SvgText>
        )}

        {/* ── Strip 2: Total burn ────────────────────────────────────────── */}
        {renderDivider(2)}
        <SvgText
          x={prepared.plotLeft + 4} y={PAD_TOP + 2 * STRIP_UNIT + 11}
          fill={COLOR_TOTAL} fontSize={9} fontWeight="700"
        >
          TOTAL BURN
        </SvgText>
        {renderStripGrid(prepared.totGrid)}
        {totalPath ? (
          <Path d={totalPath} fill="none" stroke={COLOR_TOTAL} strokeWidth={2.2} />
        ) : null}
        {!totalPath ? (
          <SvgText
            x={prepared.plotLeft + prepared.innerW / 2}
            y={PAD_TOP + 2 * STRIP_UNIT + TITLE_H + STRIP_H / 2 + 4}
            fill={WellnessColors.textSecondary} fontSize={10} textAnchor="middle"
          >
            Needs BMR + activity data
          </SvgText>
        ) : null}

        {/* ── X axis ────────────────────────────────────────────────────── */}
        <Line
          x1={prepared.plotLeft} y1={prepared.xAxisY}
          x2={prepared.chartW - PAD_R} y2={prepared.xAxisY}
          stroke={WellnessColors.gridLine} strokeWidth={1} opacity={0.8}
        />
        {prepared.xTicks.map((tk) => (
          <SvgText
            key={tk.key} x={tk.x} y={SVG_H - 6}
            fill={WellnessColors.textSecondary} fontSize={9} textAnchor="middle"
          >
            {tk.label}
          </SvgText>
        ))}
      </Svg>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap:  { width: '100%', alignSelf: 'stretch' },
  title: {
    fontSize: 11, fontWeight: '600', color: WellnessColors.textSecondary,
    letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase', textAlign: 'center',
  },
  svg: { flex: 1, minWidth: 0 },
  loadingBox:   { minHeight: 120, alignItems: 'center', justifyContent: 'center', padding: 16 },
  loadingText:  { marginTop: 8, fontSize: 13, color: WellnessColors.textSecondary, textAlign: 'center', lineHeight: 19 },
});
