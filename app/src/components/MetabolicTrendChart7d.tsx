import React, { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import {
  buildVisceralTrendDebug,
  periodAnchorBaselines,
  periodAnchorDeltas,
  resolveVisceralWeekTrend,
  visceralDayIndices,
  visceralPercentChange,
  withingsChartCompositionKg,
  withingsChartVisceralIndex,
  localDayKeyFromMs,
  type CompositionPeriodAnchor,
  type MetabolicTrend7dDay,
  type VisceralTrendDebug,
  type VisceralWeekTrend,
} from '../logic/metabolicTrend7d';
import { getBodyMetricsCopy } from '../i18n/bodyMetricsCopy';
import { formatAxisDayLabel, formatLocalizedDate } from '../i18n/dateLocale';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';
import { kgToDisplay, massUnitLabel, type MassUnit } from '../logic/unitConvert';

const PLOT_PAD_L = 36;
const PAD_R = 10;
const PAD_TOP = 6;
// Titled mini-panels (audit F3) — each strip gets a label band above its data area
// so adjacent y-axis min/max labels never collide (mirrors the ENERGY chart layout).
const TITLE_H = 15;
const STRIP_H = 46;
const STRIP_UNIT = TITLE_H + STRIP_H;
const AXIS_BOTTOM = 24;

/** Minimum half-span (kg) when all fat/muscle deltas are flat. */
const DELTA_FALLBACK_HALF_SPAN_KG = 0.5;


type PixelPoint = { x: number; y: number };

function shortDayLabel(dayKey: string, langCode?: string | null): string {
  const parts = dayKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return dayKey;
  const [y, mo, da] = parts;
  const d = new Date(y, mo - 1, da);
  return formatLocalizedDate(d, langCode, { weekday: 'short', day: 'numeric' });
}

/** Axis label: weekday + day for short windows, month + day for longer ones. */
function axisDayLabel(dayKey: string, n: number, langCode?: string | null): string {
  return formatAxisDayLabel(dayKey, langCode, n);
}

/** Evenly spaced tick indices (always includes first and last) to avoid crowding wide windows. */
function pickTickIndices(n: number, maxTicks: number): number[] {
  if (n <= 1) return [0];
  if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  const step = (n - 1) / (maxTicks - 1);
  for (let k = 0; k < maxTicks; k += 1) out.add(Math.round(k * step));
  out.add(n - 1);
  return Array.from(out).sort((a, b) => a - b);
}

function xAtIndex(i: number, plotLeft: number, innerW: number, n: number): number {
  return plotLeft + (i / Math.max(1, n - 1)) * innerW;
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

/** Data-area top for a strip (below its title band). */
function stripTop(index: number): number {
  return PAD_TOP + index * STRIP_UNIT + TITLE_H;
}

/** Top of a strip's title band (where the divider + caption sit). */
function stripBandTop(index: number): number {
  return PAD_TOP + index * STRIP_UNIT;
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
  /** Selected window length (days). Drives the highlighted chip. */
  periodDays?: number;
  /** Selectable window lengths shown as chips (e.g. [8, 16, 32, 64, 128]). */
  periodOptions?: readonly number[];
  /** Total days currently available; chips beyond this are disabled. */
  availableDays?: number;
  onPeriodChange?: (days: number) => void;
  showVisceralDebug?: boolean;
  loading?: boolean;
  /** Manual mode: weight strip only — no Withings BIA composition. */
  weightOnly?: boolean;
  /** Distinct manual weigh-in days; used for honest copy when < 2. */
  weighInDayCount?: number;
  /** When parent already shows a section header (dashboard collapse). */
  hideTitle?: boolean;
  massUnit?: MassUnit;
  /** Coach language — axis date labels. */
  langCode?: string | null;
};

function formatIndexCell(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—';
  return value.toFixed(1);
}

function legendLabelWithDelta(
  name: string,
  deltaKg: number | null | undefined,
  massUnit: MassUnit = 'kg',
): string {
  if (deltaKg == null || !Number.isFinite(deltaKg)) return name;
  const delta = kgToDisplay(deltaKg, massUnit);
  const sign = delta > 0 ? '+' : '';
  return `${name} (${sign}${delta.toFixed(1)} ${massUnitLabel(massUnit)})`;
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

function VisceralDebugPanel({
  days,
  debug,
  shortDayLabel,
}: {
  days: MetabolicTrend7dDay[];
  debug: VisceralTrendDebug;
  shortDayLabel: (dayKey: string) => string;
}) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const vIdx = visceralDayIndices(days);
  const legendLine =
    debug.legendDeltaIndex != null
      ? debug.legendPercent != null
        ? `${debug.legendDeltaIndex >= 0 ? '+' : ''}${debug.legendDeltaIndex.toFixed(2)} (${debug.legendPercent >= 0 ? '+' : ''}${debug.legendPercent.toFixed(1)}%)`
        : `${debug.legendDeltaIndex >= 0 ? '+' : ''}${debug.legendDeltaIndex.toFixed(2)}`
      : '—';

  return (
    <View style={styles.debugBox}>
      <Text style={styles.debugTitle}>Debug · visceral fat index (type 170, not 88 bone kg)</Text>
      <Text style={styles.debugLine}>
        Legend: {legendLine} · days w/ data: {debug.daysWithVisceral}/7
      </Text>
      <Text style={styles.debugLine}>
        Baseline (2nd day w/ data): {debug.baselineDayKey ?? '—'} {formatIndexCell(debug.baselineIndex)} →{' '}
        {debug.endDayKey ?? '—'} {formatIndexCell(debug.endIndex)}
      </Text>
      <View style={styles.debugTableHeader}>
        <Text style={[styles.debugCell, styles.debugCellDay]}>Day</Text>
        <Text style={[styles.debugCell, styles.debugCellVisceral]}>Raw</Text>
        <Text style={[styles.debugCell, styles.debugCellVisceral]}>Chart</Text>
      </View>
      {debug.perDay.map((row, i) => {
        const isShiftedFirst = vIdx.length >= 2 && vIdx[0] === i;
        return (
          <View key={row.dayKey} style={styles.debugTableRow}>
            <Text style={[styles.debugCell, styles.debugCellDay]}>
              {shortDayLabel(row.dayKey)} · {row.dayKey}
              {isShiftedFirst ? ' · chart=2nd' : ''}
            </Text>
            <Text style={[styles.debugCell, styles.debugCellVisceral]}>{formatIndexCell(row.visceralFatIndex)}</Text>
            <Text style={[styles.debugCell, styles.debugCellVisceral]}>{formatIndexCell(row.chartVisceralIndex)}</Text>
          </View>
        );
      })}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={styles.legendLabel} numberOfLines={1} ellipsizeMode="tail">
        {label}
      </Text>
    </View>
  );
}

export function MetabolicTrendChart7d({
  days,
  periodAnchor,
  periodDays,
  periodOptions,
  availableDays,
  onPeriodChange,
  showVisceralDebug,
  loading,
  weightOnly,
  weighInDayCount,
  hideTitle = false,
  massUnit = 'kg',
  langCode,
}: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { width: windowWidth } = useWindowDimensions();
  /** Measured plot width — avoids `windowWidth - 40` under-sizing inside the padded card (right trim). */
  const [layoutW, setLayoutW] = useState(0);
  const chartW = Math.max(280, layoutW > 0 ? layoutW : Math.max(280, windowWidth - 68));
  const bodyLabels = useMemo(() => getBodyMetricsCopy(langCode), [langCode]);

  const weightOnlyPrepared = useMemo(() => {
    if (!weightOnly || !days || days.length < 2) return null;

    const n = days.length;
    const plotLeft = PLOT_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - PAD_R);
    const plotBottom = stripTop(0) + STRIP_H;

    const wVals = days
      .map((d) => (d.weightKg != null ? kgToDisplay(d.weightKg, massUnit) : null))
      .filter((v): v is number => v != null && Number.isFinite(v));
    if (wVals.length === 0) return null;

    const wDom = domainPad(wVals, wVals[0] - 1, wVals[0] + 1, 0.08);

    const wPts: PixelPoint[] = [];
    let holdW: number | null = null;
    const todayKey = localDayKeyFromMs(Date.now());
    days.forEach((d, i) => {
      if (d.dayKey > todayKey) return;
      if (d.weightKg != null && Number.isFinite(d.weightKg)) {
        holdW = kgToDisplay(d.weightKg, massUnit);
      }
      if (holdW != null) {
        wPts.push({
          x: xAtIndex(i, plotLeft, innerW, n),
          y: mapY(holdW, wDom.min, wDom.max, stripTop(0), STRIP_H),
        });
      }
    });

    const weightPath = buildSmoothPath(wPts);
    const gridW = [wDom.min, (wDom.min + wDom.max) / 2, wDom.max].map((v) => ({
      key: `gw-${v}`,
      y: mapY(v, wDom.min, wDom.max, stripTop(0), STRIP_H),
      label: v.toFixed(1),
    }));

    const tickIdx = new Set(pickTickIndices(n, 7));
    const xTicks = days
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ d, i }) => ({
        x: xAtIndex(i, plotLeft, innerW, n),
        label: axisDayLabel(d.dayKey, n, langCode),
        key: d.dayKey,
      }));

    const svgH = stripTop(0) + STRIP_H + AXIS_BOTTOM;
    const firstW = days.find((d) => d.weightKg != null)?.weightKg ?? null;
    const lastW = [...days].reverse().find((d) => d.weightKg != null)?.weightKg ?? null;
    const weightWeekDelta =
      firstW != null && lastW != null ? lastW - firstW : null;

    return {
      chartW,
      svgH,
      plotLeft,
      padR: PAD_R,
      plotBottom,
      weightPath,
      gridW,
      xTicks,
      weightWeekDelta,
    };
  }, [chartW, days, langCode, weightOnly, massUnit]);

  const prepared = useMemo(() => {
    if (weightOnly) return null;
    if (!days || days.length < 2) return null;

    const n = days.length;
    const plotLeft = PLOT_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - PAD_R);
    const plotBottom = stripTop(2) + STRIP_H;

    const compBase = periodAnchorBaselines(periodAnchor);
    const fatBaseline = compBase?.fatKg ?? null;
    const muscleBaseline = compBase?.muscleKg ?? null;
    const chartFatKg = (i: number) => withingsChartCompositionKg(days, i, 'fatMassKg');
    const chartMuscleKg = (i: number) => withingsChartCompositionKg(days, i, 'muscleMassKg');

    const chartVisceral = (i: number) => withingsChartVisceralIndex(days, i);

    const wVals = days
      .map((d) => (d.weightKg != null ? kgToDisplay(d.weightKg, massUnit) : null))
      .filter((v): v is number => v != null && Number.isFinite(v));
    const vVals = days
      .map((_, i) => chartVisceral(i))
      .filter((v): v is number => v != null && Number.isFinite(v));

    const wDom = domainPad(wVals, kgToDisplay(76, massUnit), kgToDisplay(82, massUnit), 0.08);
    const vDom = domainPad(vVals, 3.5, 4.5, 0.12);

    const compositionDeltas: number[] = [];
    if (compBase && fatBaseline != null && muscleBaseline != null) {
      days.forEach((_, i) => {
        const f = deltaKg(chartFatKg(i), fatBaseline);
        const m = deltaKg(chartMuscleKg(i), muscleBaseline);
        if (f != null) compositionDeltas.push(kgToDisplay(f, massUnit));
        if (m != null) compositionDeltas.push(kgToDisplay(m, massUnit));
      });
    }
    const deltaDom = deltaDomainFromValues(compositionDeltas);

    const todayKey = localDayKeyFromMs(Date.now());

    const mkPts = (
      getter: (d: MetabolicTrend7dDay, i: number) => number | null,
      dom: { min: number; max: number },
      stripIndex: number,
      opts?: { holdLast?: boolean },
    ) => {
      const top = stripTop(stripIndex);
      const pts: PixelPoint[] = [];
      let last: number | null = null;
      days.forEach((d, i) => {
        // Future pad slot(s) — leave empty so the line keeps a small right gap.
        if (d.dayKey > todayKey) return;
        const v = getter(d, i);
        if (v != null && Number.isFinite(v)) last = v;
        const plot = opts?.holdLast ? last : v;
        if (plot != null && Number.isFinite(plot)) {
          pts.push({
            x: xAtIndex(i, plotLeft, innerW, n),
            y: mapY(plot, dom.min, dom.max, top, STRIP_H),
          });
        }
      });
      return pts;
    };

    const mkDeltaPts = (getter: (i: number) => number | null, baseline: number | null, stripIndex: number) => {
      const top = stripTop(stripIndex);
      const pts: PixelPoint[] = [];
      let last: number | null = null;
      days.forEach((d, i) => {
        if (d.dayKey > todayKey) return;
        if (!compBase || baseline == null) return;
        const vKg = deltaKg(getter(i), baseline);
        if (vKg != null) last = kgToDisplay(vKg, massUnit);
        if (last == null) return;
        pts.push({
          x: xAtIndex(i, plotLeft, innerW, n),
          y: mapY(last, deltaDom.min, deltaDom.max, top, STRIP_H),
        });
      });
      return pts;
    };

    const wPts = mkPts(
      (d) => (d.weightKg != null ? kgToDisplay(d.weightKg, massUnit) : null),
      wDom,
      0,
      { holdLast: true },
    );
    const fPts = mkDeltaPts(chartFatKg, fatBaseline, 1);
    const mPts = mkDeltaPts(chartMuscleKg, muscleBaseline, 1);
    const vPts = mkPts((_, i) => chartVisceral(i), vDom, 2, { holdLast: true });

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

    const tickIdx = new Set(pickTickIndices(n, 7));
    const xTicks = days
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ d, i }) => ({
        x: xAtIndex(i, plotLeft, innerW, n),
        label: axisDayLabel(d.dayKey, n, langCode),
        key: d.dayKey,
      }));

    const svgH = stripTop(2) + STRIP_H + AXIS_BOTTOM;

    const anchorDeltas = periodAnchorDeltas(periodAnchor);
    const fatWeekDelta = anchorDeltas?.fatKg ?? null;
    const muscleWeekDelta = anchorDeltas?.muscleKg ?? null;
    const weightWeekDelta =
      periodAnchor != null ? periodAnchor.end.weightKg - periodAnchor.start.weightKg : null;
    const visceralWeekTrend = resolveVisceralWeekTrend(days);
    const visceralDebug = buildVisceralTrendDebug(days);

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
      visceralDebug,
    };
  }, [chartW, days, langCode, periodAnchor, weightOnly, massUnit]);

  const activePrepared = weightOnly ? weightOnlyPrepared : prepared;

  const selector =
    periodOptions && periodOptions.length > 0 ? (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.periodRow}
      >
        {periodOptions.map((opt) => {
          const selected = opt === periodDays;
          const disabled = availableDays != null && availableDays > 0 && opt > availableDays;
          return (
            <Pressable
              key={opt}
              onPress={() => onPeriodChange?.(opt)}
              disabled={disabled}
              style={[
                styles.periodChip,
                selected && styles.periodChipSelected,
                disabled && styles.periodChipDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel={`Trend window ${opt} days`}
            >
              <Text style={[styles.periodChipText, selected && styles.periodChipTextSelected]}>
                {opt}D
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    ) : null;

  if (loading) {
    return (
      <View style={styles.loadingBox}>
        <ActivityIndicator color={colors.accentBlue} />
        <Text style={styles.loadingText}>Loading trend…</Text>
      </View>
    );
  }

  const emptyCopy = weightOnly
    ? 'Log weigh-ins in Profile to see your weight trend. Fat and muscle need a Withings scale.'
    : 'Trend data will appear after refresh.';

  if (!activePrepared) {
    return (
      <View style={styles.wrap}>
        {hideTitle ? null : <Text style={styles.title}>TREND ANALYSIS</Text>}
        {selector}
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>{emptyCopy}</Text>
        </View>
      </View>
    );
  }

  const hasAny = weightOnly
    ? Boolean(activePrepared.weightPath)
    : Boolean(
        prepared?.weightPath || prepared?.fatPath || prepared?.musclePath || prepared?.visceralPath
      );
  if (!hasAny) {
    return (
      <View style={styles.wrap}>
        {hideTitle ? null : <Text style={styles.title}>TREND ANALYSIS</Text>}
        {selector}
        <View style={styles.loadingBox}>
          <Text style={styles.loadingText}>
            {weightOnly
              ? emptyCopy
              : 'Not enough Withings body data for this window yet.'}
          </Text>
        </View>
      </View>
    );
  }

  if (weightOnly && weightOnlyPrepared) {
    const p = weightOnlyPrepared;
    return (
      <View style={styles.wrap}>
        {hideTitle ? null : <Text style={styles.title}>TREND ANALYSIS</Text>}
        {selector}
        {weighInDayCount != null && weighInDayCount < 2 ? (
          <Text style={styles.weightOnlyHint}>
            One weigh-in logged — line is flat until you log again.
          </Text>
        ) : null}
        <View
          style={[styles.chartRow, styles.chartCanvas]}
          onLayout={(e) => {
            const w = Math.floor(e.nativeEvent.layout.width);
            if (w > 0 && w !== layoutW) setLayoutW(w);
          }}
        >
          <Svg width={p.chartW} height={p.svgH}>
            <Line
              x1={p.plotLeft}
              y1={stripBandTop(0)}
              x2={p.chartW - p.padR}
              y2={stripBandTop(0)}
              stroke={colors.gridLine}
              strokeWidth={1}
              opacity={0.6}
            />
            <SvgText
              x={p.plotLeft + 2}
              y={stripBandTop(0) + 11}
              fill={colors.accentBlue}
              fontSize={9}
              fontWeight="700"
            >
              {bodyLabels.weight.toUpperCase()}
            </SvgText>
            {p.gridW.map((g) => (
              <Line
                key={g.key}
                x1={p.plotLeft}
                y1={g.y}
                x2={p.chartW - p.padR}
                y2={g.y}
                stroke={colors.gridLine}
                strokeWidth={1}
                opacity={0.88}
              />
            ))}
            {p.gridW.map((g) => (
              <SvgText key={`lw-${g.key}`} x={4} y={g.y + 3} fill={colors.accentBlue} fontSize={8} fontWeight="600">
                {g.label}
              </SvgText>
            ))}
            {p.weightPath ? (
              <Path d={p.weightPath} fill="none" stroke={colors.accentBlue} strokeWidth={2.2} />
            ) : null}
            <Line
              x1={p.plotLeft}
              y1={p.plotBottom}
              x2={p.chartW - p.padR}
              y2={p.plotBottom}
              stroke={colors.gridLine}
              strokeWidth={1}
            />
            {p.xTicks.map((tk) => (
              <SvgText
                key={tk.key}
                x={tk.x}
                y={p.svgH - 8}
                fill={colors.textSecondary}
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
            <LegendItem
              color={colors.accentBlue}
              label={legendLabelWithDelta(bodyLabels.weight, p.weightWeekDelta, massUnit)}
            />
          </View>
        </View>
      </View>
    );
  }

  if (!prepared) return null;

  return (
    <View style={styles.wrap}>
      {hideTitle ? null : <Text style={styles.title}>TREND ANALYSIS</Text>}
      {selector}

      <View
        style={[styles.chartRow, styles.chartCanvas]}
        onLayout={(e) => {
          const w = Math.floor(e.nativeEvent.layout.width);
          if (w > 0 && w !== layoutW) setLayoutW(w);
        }}
      >
        <Svg width={prepared.chartW} height={prepared.svgH}>
          {[
            { i: 0, label: bodyLabels.weight.toUpperCase(), color: colors.accentBlue },
            { i: 1, label: `${bodyLabels.fat} / ${bodyLabels.muscle} (Δ)`.toUpperCase(), color: colors.textSecondary },
            { i: 2, label: 'VISCERAL', color: colors.chart.visceral },
          ].map((s) => (
            <React.Fragment key={`strip-hd-${s.i}`}>
              <Line
                x1={prepared.plotLeft}
                y1={stripBandTop(s.i)}
                x2={prepared.chartW - prepared.padR}
                y2={stripBandTop(s.i)}
                stroke={colors.gridLine}
                strokeWidth={1}
                opacity={0.6}
              />
              <SvgText
                x={prepared.plotLeft + 2}
                y={stripBandTop(s.i) + 11}
                fill={s.color}
                fontSize={9}
                fontWeight="700"
              >
                {s.label}
              </SvgText>
            </React.Fragment>
          ))}
          {[prepared.gridW, prepared.gridFM, prepared.gridV].flatMap((grid, stripIdx) =>
            grid.map((g) => (
              <Line
                key={g.key}
                x1={prepared.plotLeft}
                y1={g.y}
                x2={prepared.chartW - prepared.padR}
                y2={g.y}
                stroke={colors.gridLine}
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
            stroke={colors.textSecondary}
            strokeWidth={1}
            opacity={0.35}
          />

          {prepared.gridW.map((g) => (
            <SvgText key={`lw-${g.key}`} x={4} y={g.y + 3} fill={colors.accentBlue} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}
          {prepared.gridFM.map((g) => (
            <SvgText key={`lfm-${g.key}`} x={4} y={g.y + 3} fill={colors.textSecondary} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}
          {prepared.gridV.map((g) => (
            <SvgText key={`lv-${g.key}`} x={4} y={g.y + 3} fill={colors.chart.visceral} fontSize={8} fontWeight="600">
              {g.label}
            </SvgText>
          ))}

          {prepared.weightPath ? (
            <Path d={prepared.weightPath} fill="none" stroke={colors.accentBlue} strokeWidth={2.2} />
          ) : null}
          {prepared.fatPath ? (
            <Path d={prepared.fatPath} fill="none" stroke={colors.accentRed} strokeWidth={2.1} />
          ) : null}
          {prepared.musclePath ? (
            <Path d={prepared.musclePath} fill="none" stroke={colors.accentGreen} strokeWidth={2.1} />
          ) : null}
          {prepared.visceralPath ? (
            <Path
              d={prepared.visceralPath}
              fill="none"
              stroke={colors.chart.visceral}
              strokeWidth={2}
              strokeDasharray="6 4"
            />
          ) : null}

          <Line
            x1={prepared.plotLeft}
            y1={prepared.plotBottom}
            x2={prepared.chartW - prepared.padR}
            y2={prepared.plotBottom}
            stroke={colors.gridLine}
            strokeWidth={1}
          />
          {prepared.xTicks.map((tk) => (
            <SvgText
              key={tk.key}
              x={tk.x}
              y={prepared.svgH - 8}
              fill={colors.textSecondary}
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
          <LegendItem color={colors.accentBlue} label={legendLabelWithDelta(bodyLabels.weight, prepared.weightWeekDelta, massUnit)} />
          <LegendItem color={colors.accentRed} label={legendLabelWithDelta(bodyLabels.fat, prepared.fatWeekDelta, massUnit)} />
        </View>
        <View style={styles.legendRow}>
          <LegendItem color={colors.accentGreen} label={legendLabelWithDelta(bodyLabels.muscle, prepared.muscleWeekDelta, massUnit)} />
          <LegendItem color={colors.chart.visceral} label={legendLabelWithVisceralPercent('Visceral', prepared.visceralWeekTrend)} />
        </View>
      </View>

      {showVisceralDebug && prepared.visceralDebug ? (
        <VisceralDebugPanel days={days} debug={prepared.visceralDebug} shortDayLabel={(k) => shortDayLabel(k, langCode)} />
      ) : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
  },
  title: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.textSecondary,
    letterSpacing: 1,
    marginBottom: 10,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
    flexGrow: 1,
    paddingBottom: 10,
    paddingHorizontal: 4,
  },
  periodChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: isDark ? colors.background : colors.progressTrack,
    borderWidth: 1,
    borderColor: colors.gridLine,
  },
  periodChipSelected: {
    backgroundColor: isDark ? colors.background : colors.iconTintBlue,
    borderColor: colors.accentBlue,
  },
  periodChipDisabled: {
    opacity: 0.35,
  },
  periodChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  periodChipTextSelected: {
    color: colors.accentBlue,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  chartCanvas: {
    backgroundColor: isDark ? colors.background : undefined,
    borderRadius: isDark ? 12 : 0,
    overflow: 'hidden',
    paddingVertical: isDark ? 4 : 0,
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
    color: colors.textSecondary,
  },
  debugBox: {
    marginTop: 10,
    padding: 10,
    borderRadius: 10,
    backgroundColor: isDark ? colors.background : colors.progressTrack,
    borderWidth: 1,
    borderColor: colors.gridLine,
  },
  debugTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  debugLine: {
    fontSize: 10,
    color: colors.textSecondary,
    lineHeight: 14,
    marginBottom: 4,
  },
  debugTableHeader: {
    flexDirection: 'row',
    marginTop: 6,
    marginBottom: 4,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.gridLine,
  },
  debugTableRow: {
    flexDirection: 'row',
    paddingVertical: 3,
  },
  debugCell: {
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    color: colors.textPrimary,
  },
  debugCellDay: {
    flex: 1.2,
    fontWeight: '600',
  },
  debugCellVisceral: {
    flex: 1,
    color: colors.chart.visceral,
    textAlign: 'right',
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
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
  },
  weightOnlyHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 17,
    paddingHorizontal: 8,
  },
  });
