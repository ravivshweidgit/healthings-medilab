import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import type { ActivityZone } from '../logic/MetabolicLogic';
import type { WeightMetricsForDashboard } from '../services/WithingsApiService';
import { WellnessColors } from '../theme/wellness';

type Point = { timestamp: string; value: number };

/** Upper bound on series points after downsampling (memory / path complexity). */
const MAX_SERIES_POINTS_CAP = 700;
const MIN_SERIES_POINTS = 64;
/** Single Y scale for glucose (mg/dL) and heart rate (BPM) overlaid in the same vertical space. */
const SHARED_Y_MIN = 50;
const SHARED_Y_MAX = 200;
/** Horizontal grid lines (shared scale for glucose + heart rate). */
const SHARED_Y_GRID_LINES = [50, 75, 100, 125, 150, 175, 200] as const;
const SHARED_Y_AXIS_LABELS = new Set<number>([50, 100, 150, 200]);

const ACTIVITY_STRIP_PX = 10;

const Y_AXIS_WIDTH = 36;
const AXIS_HEIGHT = 30;
const CHART_PLOT_HEIGHT = 210;
const SVG_TOTAL_HEIGHT = CHART_PLOT_HEIGHT + AXIS_HEIGHT;

const SVG_PAD_L = 6;
const SVG_PAD_R = 8;
const SVG_PAD_T = 12;
const SVG_PAD_B = 8;

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

/**
 * Zoom chips set window duration (one screen width). Default view ends at **now**; horizontal pan slides
 * backward through history (same duration window).
 */
const VIEWPORT_PRESETS = [
  { label: '16D', ms: 16 * MS_DAY },
  { label: '8D', ms: 8 * MS_DAY },
  { label: '4D', ms: 4 * MS_DAY },
  { label: '2D', ms: 2 * MS_DAY },
  { label: '24H', ms: 24 * MS_HOUR },
  { label: '12H', ms: 12 * MS_HOUR },
  { label: '6H', ms: 6 * MS_HOUR },
  { label: '3H', ms: 3 * MS_HOUR },
  { label: '1H', ms: 1 * MS_HOUR },
] as const;

const DEFAULT_VIEWPORT_PRESET_INDEX = 3;

function viewportWidthPx(windowW: number): number {
  return Math.max(180, windowW - Y_AXIS_WIDTH - 44);
}

function filterPointsByTime(points: Point[], t0: number, t1: number): Point[] {
  return points.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return !Number.isNaN(t) && t >= t0 && t <= t1;
  });
}

function mergeTimeBounds(glucose: Point[], heartRate: Point[]): { tMin: number; tMax: number } | null {
  let tMin = Infinity;
  let tMax = -Infinity;
  for (const p of glucose) {
    const t = new Date(p.timestamp).getTime();
    if (!Number.isNaN(t)) {
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
  }
  for (const p of heartRate) {
    const t = new Date(p.timestamp).getTime();
    if (!Number.isNaN(t)) {
      if (t < tMin) tMin = t;
      if (t > tMax) tMax = t;
    }
  }
  if (!Number.isFinite(tMin) || !Number.isFinite(tMax)) return null;
  return { tMin, tMax };
}

function downsample<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = Math.ceil(arr.length / max);
  return arr.filter((_, i) => i % step === 0);
}

type PixelPoint = { x: number; y: number };

function buildSmoothPath(points: PixelPoint[]): string | null {
  if (points.length < 2) return null;
  const gen = line<PixelPoint>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);
  return gen(points) ?? null;
}

function toPixelPoints(
  points: Point[],
  tMin: number,
  tMax: number,
  vMin: number,
  vMax: number,
  chartW: number,
  plotH: number,
  padL: number,
  padT: number,
  padR: number,
  padB: number,
  ySlotTop: number,
  ySlotHeight: number
): PixelPoint[] {
  const innerW = Math.max(1, chartW - padL - padR);
  const spanT = Math.max(1, tMax - tMin);
  const spanV = Math.max(1e-6, vMax - vMin);

  return points.map((p) => {
    const t = new Date(p.timestamp).getTime();
    const x = padL + ((t - tMin) / spanT) * innerW;
    const ny = (p.value - vMin) / spanV;
    const y = padT + ySlotTop + (1 - ny) * ySlotHeight;
    return { x, y };
  });
}

function timeToX(tMs: number, tMin: number, spanT: number, padL: number, innerW: number): number {
  return padL + ((tMs - tMin) / Math.max(1, spanT)) * innerW;
}

function formatTimeTick(ms: number, rangeMs: number): string {
  const d = new Date(ms);
  if (rangeMs > 48 * 60 * 60 * 1000) {
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  if (rangeMs > 24 * 60 * 60 * 1000) {
    return d.toLocaleString(undefined, {
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
  return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function buildTimeTicks(tMin: number, tMax: number, padL: number, innerW: number): { x: number; label: string; key: string }[] {
  const spanT = Math.max(1, tMax - tMin);
  const spanMs = tMax - tMin;
  const target = 7;
  let stepMs = spanMs / target;

  const H = 60 * 60 * 1000;
  const H6 = 6 * H;
  const H12 = 12 * H;
  const D = 24 * 60 * 60 * 1000;

  if (stepMs <= H) stepMs = H;
  else if (stepMs <= H6) stepMs = H6;
  else if (stepMs <= H12) stepMs = H12;
  else if (stepMs <= D) stepMs = D;
  else stepMs = Math.ceil(stepMs / D) * D;

  const ticks: { x: number; label: string; key: string }[] = [];
  let t = Math.ceil(tMin / stepMs) * stepMs;
  let i = 0;
  while (t <= tMax + stepMs * 0.01 && i < 24) {
    const x = timeToX(t, tMin, spanT, padL, innerW);
    if (x >= padL - 1 && x <= padL + innerW + 1) {
      ticks.push({
        x,
        label: formatTimeTick(t, spanMs),
        key: `t-${t}-${i}`,
      });
    }
    t += stepMs;
    i += 1;
  }
  return ticks;
}

type WithingsSnapshot = Pick<WeightMetricsForDashboard, 'muscleMassKg' | 'fatMassKg' | 'weightKg'>;

function formatKgSnapshot(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value.toFixed(1)} kg`;
}

type Props = {
  glucose: Point[];
  heartRate: Point[];
  activityZones: ActivityZone[];
  /** Latest Withings body metrics (shown under chart legend). */
  withingsSnapshot?: WithingsSnapshot | null;
};

export function MetabolicChart({ glucose, heartRate, activityZones, withingsSnapshot }: Props) {
  const { width: windowW } = useWindowDimensions();
  const [viewportPresetIndex, setViewportPresetIndex] = useState(DEFAULT_VIEWPORT_PRESET_INDEX);
  const [nowAnchor, setNowAnchor] = useState(() => Date.now());
  /** Horizontal pan offset (px). `null` until synced — treat as “live” end position in useMemo. */
  const [scrollX, setScrollX] = useState<number | null>(null);
  const chartScrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef<number | null>(null);
  scrollXRef.current = scrollX;
  /**
   * Native `scrollTo({ x: max })` often runs before horizontal content width is measured — it no-ops or
   * clamps to 0. Then the first `onScroll` reports x=0 while React still maps the chart as “live”
   * (`scrollX === null` → p=1), which breaks pan until something retriggers scroll (e.g. cycling zoom chips).
   * We only apply `onScroll` offsets after we’ve snapped the native offset in `onContentSizeChange` /
   * deferred retries (see viewport effect).
   */
  const chartPanReadyRef = useRef(false);
  /** After a zoom-chip change we must snap once native content width is known; avoid snapping on every clock tick (slide range drift). */
  const forceSnapChartScrollRef = useRef(true);

  const plotH = CHART_PLOT_HEIGHT;
  const svgH = SVG_TOTAL_HEIGHT;

  useEffect(() => {
    setNowAnchor(Date.now());
  }, [glucose, heartRate]);

  useEffect(() => {
    const id = setInterval(() => setNowAnchor(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const prepared = useMemo(() => {
    const bounds = mergeTimeBounds(glucose, heartRate);
    if (!bounds) return null;

    const dataTMin = bounds.tMin;
    const vpPx = viewportWidthPx(windowW);
    const viewportMs = VIEWPORT_PRESETS[viewportPresetIndex]?.ms ?? VIEWPORT_PRESETS[DEFAULT_VIEWPORT_PRESET_INDEX].ms;
    const viewportLabel = VIEWPORT_PRESETS[viewportPresetIndex]?.label ?? '2D';

    /** How far the window’s end time can move from “oldest” [dataTMin + viewportMs] to “live” [now]. */
    const slideMs = Math.max(0, nowAnchor - dataTMin - viewportMs);
    const pxPerMs = vpPx / viewportMs;
    const maxScrollPx = slideMs * pxPerMs;
    const totalW = vpPx + maxScrollPx;
    const hPanEnabled = maxScrollPx > 2;

    const p =
      scrollX === null || maxScrollPx <= 0 ? 1 : Math.min(1, Math.max(0, scrollX / maxScrollPx));

    let mapTMin: number;
    let mapTMax: number;
    if (slideMs <= 0) {
      mapTMax = nowAnchor;
      mapTMin = Math.max(dataTMin, nowAnchor - viewportMs);
    } else {
      const endT = dataTMin + viewportMs + slideMs * p;
      mapTMax = endT;
      mapTMin = endT - viewportMs;
    }

    const chartW = vpPx;

    const gWin = filterPointsByTime(glucose, mapTMin, mapTMax);
    const hWin = filterPointsByTime(heartRate, mapTMin, mapTMax);

    const seriesBudget = Math.min(
      MAX_SERIES_POINTS_CAP,
      Math.max(MIN_SERIES_POINTS, Math.floor(chartW / 8))
    );
    const g = downsample(gWin, seriesBudget);
    const h = downsample(hWin, seriesBudget);

    const padL = SVG_PAD_L;
    const padR = SVG_PAD_R;
    const padT = SVG_PAD_T;
    const padB = SVG_PAD_B;

    const chartSlotTop = 0;
    const chartSlotH = plotH - padT - padB - ACTIVITY_STRIP_PX;
    const axisY = plotH - padB;

    const gPx = toPixelPoints(
      g,
      mapTMin,
      mapTMax,
      SHARED_Y_MIN,
      SHARED_Y_MAX,
      chartW,
      plotH,
      padL,
      padT,
      padR,
      padB,
      chartSlotTop,
      chartSlotH
    );
    const hPx = toPixelPoints(
      h,
      mapTMin,
      mapTMax,
      SHARED_Y_MIN,
      SHARED_Y_MAX,
      chartW,
      plotH,
      padL,
      padT,
      padR,
      padB,
      chartSlotTop,
      chartSlotH
    );

    const glucosePath = buildSmoothPath(gPx);
    const heartRatePath = buildSmoothPath(hPx);

    const innerW = Math.max(1, chartW - padL - padR);
    const spanT = Math.max(1, mapTMax - mapTMin);

    const spanY = SHARED_Y_MAX - SHARED_Y_MIN;
    const gridLines = SHARED_Y_GRID_LINES.map((v) => {
      const ny = (v - SHARED_Y_MIN) / Math.max(1e-6, spanY);
      const y = padT + chartSlotTop + (1 - ny) * chartSlotH;
      return {
        value: v,
        y,
        key: `grid-${v}`,
        showAxisLabel: SHARED_Y_AXIS_LABELS.has(v),
      };
    });

    const activityLaneY = axisY - ACTIVITY_STRIP_PX / 2;
    const activitySegments = activityZones.flatMap((zone, zoneIdx) => {
      const start = new Date(zone.startTime).getTime();
      const end = new Date(zone.endTime).getTime();
      if (end < mapTMin || start > mapTMax) return [];
      const clipStart = Math.max(start, mapTMin);
      const clipEnd = Math.min(end, mapTMax);
      const x1 = padL + ((clipStart - mapTMin) / spanT) * innerW;
      const x2 = padL + ((clipEnd - mapTMin) / spanT) * innerW;
      if (Math.abs(x2 - x1) < 0.5) return [];
      return [
        {
          x1,
          x2,
          y: activityLaneY,
          key: `act-${zoneIdx}-${start}`,
        },
      ];
    });

    const timeTicks = buildTimeTicks(mapTMin, mapTMax, padL, innerW);

    return {
      glucosePath,
      heartRatePath,
      gridLines,
      activitySegments,
      timeTicks,
      axisY,
      chartW,
      plotH,
      svgH,
      padL,
      viewportLabel,
      maxScrollPx,
      totalW,
      hPanEnabled,
    };
  }, [activityZones, glucose, heartRate, nowAnchor, plotH, scrollX, viewportPresetIndex, windowW]);

  const snapChartScrollToLive = () => {
    if (!prepared) return;
    const max = prepared.maxScrollPx;
    if (max <= 0) {
      setScrollX(0);
      chartPanReadyRef.current = true;
      return;
    }
    chartScrollRef.current?.scrollTo({ x: max, animated: false });
    setScrollX(max);
    chartPanReadyRef.current = true;
  };

  /** Chip change → jump back to “live” (scroll end). Retries help when `scrollTo` runs before content is measured. */
  useLayoutEffect(() => {
    if (!prepared) return;
    chartPanReadyRef.current = false;
    forceSnapChartScrollRef.current = true;
    const max = prepared.maxScrollPx;
    if (max <= 0) {
      setScrollX(0);
      chartPanReadyRef.current = true;
      forceSnapChartScrollRef.current = false;
      return;
    }
    const apply = () => {
      chartScrollRef.current?.scrollTo({ x: max, animated: false });
      setScrollX(max);
    };
    apply();
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        apply();
        chartPanReadyRef.current = true;
      });
    });
    return () => cancelAnimationFrame(id);
  }, [viewportPresetIndex]);

  /** If the scrollable range shrinks, don’t leave offset past the end. */
  useEffect(() => {
    if (!prepared) return;
    setScrollX((sx) => {
      if (sx === null) return sx;
      return Math.min(sx, Math.max(0, prepared.maxScrollPx));
    });
  }, [prepared?.maxScrollPx]);

  if (!prepared) {
    return (
      <View style={[styles.empty, { minHeight: CHART_PLOT_HEIGHT }]}>
        <Text style={styles.emptyText}>Your trends will appear after you refresh.</Text>
      </View>
    );
  }

  const chartSvg = (
    <Svg width={prepared.chartW} height={prepared.svgH}>
      {prepared.gridLines.map((gl) => (
        <Line
          key={gl.key}
          x1={prepared.padL}
          y1={gl.y}
          x2={prepared.chartW - SVG_PAD_R}
          y2={gl.y}
          stroke={WellnessColors.gridLine}
          strokeWidth={1}
          opacity={gl.showAxisLabel ? 0.95 : 0.62}
        />
      ))}
      {prepared.heartRatePath ? (
        <Path d={prepared.heartRatePath} fill="none" stroke={WellnessColors.accentRed} strokeWidth={2} opacity={0.95} />
      ) : null}
      {prepared.glucosePath ? (
        <Path d={prepared.glucosePath} fill="none" stroke={WellnessColors.accentGreen} strokeWidth={2.5} />
      ) : null}

      {prepared.activitySegments.map((seg) => (
        <Line
          key={seg.key}
          x1={seg.x1}
          y1={seg.y}
          x2={seg.x2}
          y2={seg.y}
          stroke={WellnessColors.accentBlue}
          strokeWidth={3}
          strokeLinecap="round"
          opacity={0.95}
        />
      ))}

      <Line
        x1={prepared.padL}
        y1={prepared.axisY}
        x2={prepared.chartW - SVG_PAD_R}
        y2={prepared.axisY}
        stroke={WellnessColors.gridLine}
        strokeWidth={1}
        opacity={0.8}
      />
      {prepared.timeTicks.map((tk) => (
        <React.Fragment key={tk.key}>
          <Line
            x1={tk.x}
            y1={prepared.axisY - 5}
            x2={tk.x}
            y2={prepared.axisY + 4}
            stroke={WellnessColors.textSecondary}
            strokeWidth={1}
            opacity={0.7}
          />
          <SvgText x={tk.x} y={prepared.svgH - 6} fill={WellnessColors.textSecondary} fontSize={9} textAnchor="middle">
            {tk.label}
          </SvgText>
        </React.Fragment>
      ))}
    </Svg>
  );

  return (
    <View style={styles.wrap}>

      <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator={false} contentContainerStyle={styles.viewportPresetRow}>
        {VIEWPORT_PRESETS.map((preset, index) => {
          const selected = index === viewportPresetIndex;
          return (
            <Pressable
              key={preset.label}
              onPress={() => setViewportPresetIndex(index)}
              style={[styles.viewportChip, selected && styles.viewportChipSelected]}
              accessibilityLabel={`Viewport ${preset.label}`}
            >
              <Text style={[styles.viewportChipText, selected && styles.viewportChipTextSelected]}>{preset.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={[styles.chartRow, styles.chartRowLtr, { minHeight: svgH }]}>
        <View style={[styles.yAxis, { height: plotH }]}>
          {prepared.gridLines
            .filter((gl) => gl.showAxisLabel)
            .map((gl) => (
              <Text key={`y-${gl.value}`} style={[styles.yAxisLabel, { top: gl.y - 8 }]}>
                {gl.value}
              </Text>
            ))}
        </View>

        <View style={[styles.chartPlot, { height: prepared.svgH }]}>
          {/* Chart underneath; horizontal pan capture on top (transparent) so swipes always hit ScrollView. */}
          <View style={[styles.chartUnderlay, { height: prepared.svgH }]} pointerEvents="none">
            <View style={[styles.graphCanvas, { width: prepared.chartW, height: prepared.svgH }]}>{chartSvg}</View>
          </View>
          <ScrollView
            ref={chartScrollRef}
            horizontal
            style={styles.chartPanScroll}
            contentContainerStyle={{
              width: Math.max(prepared.totalW, prepared.chartW),
              height: prepared.svgH,
            }}
            scrollEnabled={prepared.hPanEnabled}
            showsHorizontalScrollIndicator={false}
            scrollEventThrottle={16}
            nestedScrollEnabled
            directionalLockEnabled
            onContentSizeChange={() => {
              if (!prepared) return;
              chartPanReadyRef.current = true;
              const max = prepared.maxScrollPx;
              if (max <= 0) {
                setScrollX(0);
                forceSnapChartScrollRef.current = false;
                return;
              }
              const mustSnapToLive = scrollXRef.current === null || forceSnapChartScrollRef.current;
              if (forceSnapChartScrollRef.current) {
                forceSnapChartScrollRef.current = false;
              }
              if (!mustSnapToLive) return;
              snapChartScrollToLive();
            }}
            onScroll={(e) => {
              if (!chartPanReadyRef.current && prepared.maxScrollPx > 0) return;
              const x = e.nativeEvent.contentOffset.x;
              const max = prepared.maxScrollPx;
              setScrollX(Math.min(Math.max(0, x), max));
            }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ width: Math.max(prepared.totalW, prepared.chartW), height: prepared.svgH, backgroundColor: 'transparent' }} />
          </ScrollView>
        </View>
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendGlucose}>Glucose</Text>
        <Text style={styles.legendHeartRate}>Heart rate</Text>
        <Text style={styles.legendActivity}>Walk / activity</Text>
      </View>

      <View style={styles.legendWithingsBlock}>
        <Text
          style={styles.legendWithingsLine}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.78}
        >
          Muscle{' '}
          <Text style={styles.legendWithingsValue}>{formatKgSnapshot(withingsSnapshot?.muscleMassKg)}</Text>
          {' · Fat '}
          <Text style={styles.legendWithingsValue}>{formatKgSnapshot(withingsSnapshot?.fatMassKg)}</Text>
          {' · Weight '}
          <Text style={styles.legendWithingsValue}>{formatKgSnapshot(withingsSnapshot?.weightKg)}</Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: SVG_TOTAL_HEIGHT + 52,
  },
  viewportPresetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 2,
    marginBottom: 4,
    paddingRight: 4,
  },
  viewportChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: WellnessColors.progressTrack,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
  },
  viewportChipSelected: {
    backgroundColor: WellnessColors.iconTintBlue,
    borderColor: WellnessColors.accentBlue,
  },
  viewportChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  viewportChipTextSelected: {
    color: WellnessColors.accentBlue,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
  },
  chartRowLtr: {
    direction: 'ltr',
  },
  chartPlot: {
    flex: 1,
    minWidth: 0,
    minHeight: SVG_TOTAL_HEIGHT,
    position: 'relative',
    overflow: 'hidden',
    direction: 'ltr',
  },
  chartUnderlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-start',
    alignItems: 'flex-start',
    zIndex: 0,
  },
  chartPanScroll: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
    zIndex: 1,
    elevation: 3,
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    marginRight: 2,
    position: 'relative',
  },
  yAxisLabel: {
    position: 'absolute',
    right: 2,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    color: WellnessColors.textSecondary,
  },
  graphCanvas: {
    backgroundColor: WellnessColors.surface,
    borderRadius: 0,
    overflow: 'hidden',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: '#FFFFFF',
    padding: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  emptyText: {
    color: WellnessColors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 16,
    marginTop: 6,
    rowGap: 8,
  },
  legendGlucose: {
    color: WellnessColors.accentGreen,
    fontSize: 12,
    fontWeight: '500',
  },
  legendHeartRate: {
    color: WellnessColors.accentRed,
    fontSize: 12,
    fontWeight: '500',
  },
  legendActivity: {
    color: WellnessColors.accentBlue,
    fontSize: 12,
    fontWeight: '500',
  },
  legendWithingsBlock: {
    marginTop: 4,
    alignItems: 'center',
    alignSelf: 'stretch',
    paddingHorizontal: 4,
  },
  legendWithingsLine: {
    width: '100%',
    fontSize: 9,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    lineHeight: 12,
    fontVariant: ['tabular-nums'],
  },
  legendWithingsValue: {
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    color: WellnessColors.textSecondary,
  },
});
