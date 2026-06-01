import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ActivityZone } from '../logic/MetabolicLogic';
import type { WithingsCaloriePoint, WorkoutSession } from '../services/WithingsApiService';
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

/** Thin walk-zone lines are replaced by the calorie bar strip; kept for Health-Connect overlay. */
const ACTIVITY_STRIP_PX = 6;

const Y_AXIS_WIDTH = 36;
const AXIS_HEIGHT = 30;
const CHART_PLOT_HEIGHT = 210;

/**
 * Calorie bar strip sits INSIDE the chart area, above the X axis.
 * Glucose/HR data occupies the remaining upper portion of CHART_PLOT_HEIGHT.
 * Layout (bottom-up from axisY):
 *   padB (8) → calorie bars (CALORIE_STRIP_INNER) → activity lane (ACTIVITY_STRIP_PX) → glucose/HR data
 */
const CALORIE_STRIP_INNER = 42;
/** Y-max for the calorie scale (kcal/30-min slot). BMR/48 ≈ 39; brisk walk ≈ 80-120. */
const CALORIE_Y_MAX_FIXED = 150;
const CALORIE_BMR_COLOR     = '#90CAF9'; // light blue  — BMR resting baseline bars
const CALORIE_ACTIVE_COLOR  = '#42A5F5'; // medium blue — steps / passive activity calories
const CALORIE_WORKOUT_COLOR = '#1565C0'; // dark blue   — explicit workout session calories
const BUCKET_MS = 30 * 60 * 1000;

const SVG_TOTAL_HEIGHT = CHART_PLOT_HEIGHT + AXIS_HEIGHT;

const SVG_PAD_L = 6;
const SVG_PAD_R = 8;
const SVG_PAD_T = 12;
const SVG_PAD_B = 8;

const MS_HOUR = 60 * 60 * 1000;
const MS_DAY = 24 * MS_HOUR;

/** Space for the visible-range date line above the SVG chart. */
const DATE_HEADER_HEIGHT = 22;
/** Lucide chevrons in day nav — sized to fit the short pill without clipping. */
const DAY_NAV_CHEVRON_PX = 15;
/** Treat “no movement” when shifting by a day if the clamped end is within this of the current end. */
const TIME_SHIFT_EPS_MS = 60_000;
/** Swipe on the date label: distance (px) or velocity to commit a ±1 day step. */
const DATE_SWIPE_DX = 48;
const DATE_SWIPE_VX = 0.42;

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

function formatViewportDateHeader(tMin: number, tMax: number): string {
  const d0 = new Date(tMin);
  const d1 = new Date(tMax);
  const sameLocalDay =
    d0.getFullYear() === d1.getFullYear() && d0.getMonth() === d1.getMonth() && d0.getDate() === d1.getDate();
  if (sameLocalDay) {
    return d0.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
  }
  const y0 = d0.getFullYear();
  const y1 = d1.getFullYear();
  if (y0 === y1) {
    const a = d0.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const b = d1.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    return `${a} – ${b} · ${y0}`;
  }
  return `${d0.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} – ${d1.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
}

function computeTimeTickStepMs(spanMs: number): number {
  const target = 7;
  let stepMs = spanMs / target;
  const H = 60 * 60 * 1000;
  const H6 = 6 * H;
  const H12 = 12 * H;
  const D = MS_DAY;
  if (stepMs <= H) stepMs = H;
  else if (stepMs <= H6) stepMs = H6;
  else if (stepMs <= H12) stepMs = H12;
  else if (stepMs <= D) stepMs = D;
  else stepMs = Math.ceil(stepMs / D) * D;
  return stepMs;
}

/** Bottom axis: time only unless tick spacing is a day or more (then compact date). */
function formatAxisTickLabel(ms: number, stepMs: number): string {
  if (stepMs >= MS_DAY * 0.9) {
    return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

/** Move the right edge of the window by `deltaDays` (local timeline), clamped to data and “now”. */
function shiftViewportEnd(
  mapTMax: number,
  deltaDays: number,
  dataTMin: number,
  viewportMs: number,
  nowAnchor: number
): number {
  let end = Math.min(nowAnchor, mapTMax + deltaDays * MS_DAY);
  let start = end - viewportMs;
  if (start < dataTMin) {
    start = dataTMin;
    end = Math.min(nowAnchor, start + viewportMs);
  }
  return end;
}

function buildTimeTicks(
  tMin: number,
  tMax: number,
  padL: number,
  innerW: number
): { x: number; label: string; key: string }[] {
  const spanT = Math.max(1, tMax - tMin);
  const spanMs = tMax - tMin;
  const stepMs = computeTimeTickStepMs(spanMs);

  const ticks: { x: number; label: string; key: string }[] = [];
  let t = Math.ceil(tMin / stepMs) * stepMs;
  let i = 0;
  while (t <= tMax + stepMs * 0.01 && i < 24) {
    const x = timeToX(t, tMin, spanT, padL, innerW);
    if (x >= padL - 1 && x <= padL + innerW + 1) {
      ticks.push({
        x,
        label: formatAxisTickLabel(t, stepMs),
        key: `t-${t}-${i}`,
      });
    }
    t += stepMs;
    i += 1;
  }
  return ticks;
}


type Props = {
  glucose: Point[];
  heartRate: Point[];
  activityZones: ActivityZone[];
  /** Intraday calorie burn points from Withings (one entry per activity interval). */
  calorieBurns?: WithingsCaloriePoint[];
  /** Explicit workout sessions from Withings getworkouts (bike, run, etc.). */
  workoutSessions?: WorkoutSession[];
  /** BMR kcal/day from Withings body scan — used to compute the 30-min resting baseline bar. */
  bmrKcalDay?: number | null;
};

export function MetabolicChart({ glucose, heartRate, activityZones, calorieBurns, workoutSessions, bmrKcalDay }: Props) {
  const { width: windowW } = useWindowDimensions();
  const [viewportPresetIndex, setViewportPresetIndex] = useState(DEFAULT_VIEWPORT_PRESET_INDEX);
  const [nowAnchor, setNowAnchor] = useState(() => Date.now());
  /** Horizontal pan offset (px). `null` until synced — treat as “live” end position in useMemo. */
  const [scrollX, setScrollX] = useState<number | null>(null);
  /**
   * When all history fits on screen (`slideMs <= 0`), horizontal scroll cannot move the window.
   * Day-step arrows then move the visible range by setting the window’s end time explicitly.
   */
  const [endTimeOverrideMs, setEndTimeOverrideMs] = useState<number | null>(null);
  const chartScrollRef = useRef<ScrollView>(null);
  const scrollXRef = useRef<number | null>(null);
  scrollXRef.current = scrollX;
  /** Latest day-step actions for the stable date-header `PanResponder`. */
  const dateSwipeRef = useRef<{
    shiftDay: (delta: number) => void;
    canEarlier: boolean;
    canLater: boolean;
  }>({
    shiftDay: () => {},
    canEarlier: false,
    canLater: false,
  });
  const dateHeaderSwipePan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_, g) =>
          Math.abs(g.dx) > 14 && Math.abs(g.dx) > Math.abs(g.dy) * 1.25,
        onPanResponderTerminationRequest: () => true,
        onPanResponderRelease: (_, g) => {
          const { shiftDay, canEarlier, canLater } = dateSwipeRef.current;
          if ((g.dx > DATE_SWIPE_DX || g.vx > DATE_SWIPE_VX) && canEarlier) shiftDay(-1);
          else if ((g.dx < -DATE_SWIPE_DX || g.vx < -DATE_SWIPE_VX) && canLater) shiftDay(1);
        },
      }),
    []
  );
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
      if (endTimeOverrideMs == null) {
        mapTMax = nowAnchor;
        mapTMin = Math.max(dataTMin, nowAnchor - viewportMs);
      } else {
        mapTMax = Math.min(nowAnchor, endTimeOverrideMs);
        mapTMin = mapTMax - viewportMs;
        if (mapTMin < dataTMin) {
          mapTMin = dataTMin;
          mapTMax = Math.min(nowAnchor, mapTMin + viewportMs);
        }
      }
    } else {
      const endT = dataTMin + viewportMs + slideMs * p;
      mapTMax = endT;
      mapTMin = endT - viewportMs;
    }

    const endEarlier = shiftViewportEnd(mapTMax, -1, dataTMin, viewportMs, nowAnchor);
    const endLater = shiftViewportEnd(mapTMax, 1, dataTMin, viewportMs, nowAnchor);
    const canShiftEarlier = endEarlier < mapTMax - TIME_SHIFT_EPS_MS;
    const canShiftLater = endLater > mapTMax + TIME_SHIFT_EPS_MS;

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
    // Glucose/HR data area is the top portion; calorie bars + activity lane sit just above the X axis.
    const chartSlotH = plotH - padT - padB - ACTIVITY_STRIP_PX - CALORIE_STRIP_INNER;
    const axisY = plotH - padB;
    // Calorie bar strip: from top of the strip to the X axis line.
    const calStripBottom = axisY;
    const calStripTop = calStripBottom - CALORIE_STRIP_INNER;
    // Activity (walk) lane sits between the calorie strip and the glucose/HR area.
    const activityLaneBaseY = calStripTop;

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

    const activityLaneY = activityLaneBaseY - ACTIVITY_STRIP_PX / 2;
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
    const dateHeaderLabel = formatViewportDateHeader(mapTMin, mapTMax);

    return {
      glucosePath,
      heartRatePath,
      gridLines,
      activitySegments,
      timeTicks,
      dateHeaderLabel,
      axisY,
      calStripTop,
      calStripBottom,
      chartW,
      plotH,
      svgH,
      padL,
      innerW,
      spanT,
      viewportLabel,
      maxScrollPx,
      totalW,
      hPanEnabled,
      dataTMin,
      viewportMs,
      slideMs,
      mapTMin,
      mapTMax,
      canShiftEarlier,
      canShiftLater,
    };
  }, [activityZones, endTimeOverrideMs, glucose, heartRate, nowAnchor, plotH, scrollX, viewportPresetIndex, windowW]);

  /** Compute 30-min calorie bars for the currently visible time window. */
  const caloriePrepared = useMemo(() => {
    if (!prepared) return null;
    const { padL, chartW, mapTMin, mapTMax, innerW, spanT, calStripTop, calStripBottom } = prepared;
    const bmrPerSlot = bmrKcalDay != null && bmrKcalDay > 0 ? bmrKcalDay / 48 : null;
    const hasBmr = bmrPerSlot != null;
    const hasCal = calorieBurns != null && calorieBurns.length > 0;
    const hasWorkouts = workoutSessions != null && workoutSessions.length > 0;
    if (!hasBmr && !hasCal && !hasWorkouts) return null;

    const stripH = calStripBottom - calStripTop;

    // Bucket passive intraday calories into 30-min windows
    const passiveBucketMap = new Map<number, number>();
    for (const pt of (calorieBurns ?? [])) {
      const t = new Date(pt.timestamp).getTime();
      const bucket = Math.floor(t / BUCKET_MS) * BUCKET_MS;
      passiveBucketMap.set(bucket, (passiveBucketMap.get(bucket) ?? 0) + pt.kcal);
    }

    // Spread workout calories proportionally across the 30-min buckets they overlap
    const workoutBucketMap = new Map<number, number>();
    for (const w of (workoutSessions ?? [])) {
      const durationMs = w.endMs - w.startMs;
      if (durationMs <= 0) continue;
      const kcalPerMs = w.kcal / durationMs;
      // Find all 30-min buckets this workout overlaps
      const firstBk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
      for (let bk = firstBk; bk < w.endMs; bk += BUCKET_MS) {
        const overlapStart = Math.max(bk, w.startMs);
        const overlapEnd   = Math.min(bk + BUCKET_MS, w.endMs);
        const overlapMs    = overlapEnd - overlapStart;
        if (overlapMs <= 0) continue;
        const bkKcal = kcalPerMs * overlapMs;
        workoutBucketMap.set(bk, (workoutBucketMap.get(bk) ?? 0) + bkKcal);
      }
    }

    // Buckets that contain an explicit workout: suppress passive calories to avoid double-counting.
    // (getintradayactivity calories during a workout already reflect elevated activity.)
    const workoutBuckets = new Set(workoutBucketMap.keys());

    // Auto-scale Y-max: at least CALORIE_Y_MAX_FIXED, or highest non-double-counted total in view
    let maxTotal = CALORIE_Y_MAX_FIXED;
    const allBuckets = new Set([...passiveBucketMap.keys(), ...workoutBucketMap.keys()]);
    for (const bk of allBuckets) {
      const passive = workoutBuckets.has(bk) ? 0 : (passiveBucketMap.get(bk) ?? 0);
      const total   = (bmrPerSlot ?? 0) + passive + (workoutBucketMap.get(bk) ?? 0);
      if (total > maxTotal) maxTotal = total;
    }
    // Round up to nearest 50 for a clean axis label (avoids odd numbers like 237)
    const calYMax = Math.ceil(maxTotal / 50) * 50;

    type CalBar = {
      x: number; w: number;
      bmrY: number; bmrH: number;
      actY: number; actH: number;
      wktY: number; wktH: number;
    };
    const bars: CalBar[] = [];

    const firstBucket = Math.floor(mapTMin / BUCKET_MS) * BUCKET_MS;
    for (let bMs = firstBucket; bMs <= mapTMax; bMs += BUCKET_MS) {
      const rawX1 = padL + ((bMs - mapTMin) / spanT) * innerW;
      const rawX2 = padL + ((bMs + BUCKET_MS - mapTMin) / spanT) * innerW;
      const x1 = Math.max(padL, rawX1);
      const x2 = Math.min(chartW - SVG_PAD_R, rawX2);
      const w = x2 - x1 - 1;
      if (w < 1) continue;

      const bmrKcal  = bmrPerSlot ?? 0;
      // Suppress passive data in workout buckets (workout is the authoritative source)
      const actKcal  = workoutBuckets.has(bMs) ? 0 : (passiveBucketMap.get(bMs) ?? 0);
      const wktKcal  = workoutBucketMap.get(bMs) ?? 0;

      const bmrH = hasBmr ? Math.max(2, Math.min(stripH, (bmrKcal / calYMax) * stripH)) : 0;
      const totalWithAct = bmrKcal + actKcal;
      const totalWithWkt = totalWithAct + wktKcal;
      const actTotalBarH = Math.max(0, Math.min(stripH, (totalWithAct / calYMax) * stripH));
      const wktTotalBarH = Math.max(0, Math.min(stripH, (totalWithWkt / calYMax) * stripH));
      const actH = Math.max(0, actTotalBarH - bmrH);
      const wktH = Math.max(0, wktTotalBarH - actTotalBarH);

      bars.push({
        x: x1, w,
        bmrY: calStripBottom - bmrH,   bmrH,
        actY: calStripBottom - bmrH - actH, actH,
        wktY: calStripBottom - bmrH - actH - wktH, wktH,
      });
    }

    // Workout label overlays (shown on the strip for named sessions in the window)
    const workoutLabels: { x: number; label: string }[] = [];
    for (const w of (workoutSessions ?? [])) {
      if (w.endMs < mapTMin || w.startMs > mapTMax) continue;
      const midMs = (w.startMs + w.endMs) / 2;
      const x = padL + ((midMs - mapTMin) / spanT) * innerW;
      workoutLabels.push({ x, label: `${w.activityLabel} ${Math.round(w.kcal)} kcal` });
    }

    return { bars, calStripTop, calStripBottom, calYMax, workoutLabels };
  }, [prepared, calorieBurns, workoutSessions, bmrKcalDay]);

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
    setEndTimeOverrideMs(null);
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

  /** Pan-capable range: override is only meaningful when `slideMs <= 0`; clear it once the chart becomes scrollable. */
  useEffect(() => {
    if (!prepared || prepared.slideMs <= 0) return;
    setEndTimeOverrideMs((v) => (v != null ? null : v));
  }, [prepared?.slideMs]);

  if (!prepared) {
    return (
      <View style={[styles.empty, { minHeight: CHART_PLOT_HEIGHT }]}>
        <Text style={styles.emptyText}>Your trends will appear after you refresh.</Text>
      </View>
    );
  }

  const shiftDay = (delta: number) => {
    const newEnd = shiftViewportEnd(prepared.mapTMax, delta, prepared.dataTMin, prepared.viewportMs, nowAnchor);
    if (Math.abs(newEnd - prepared.mapTMax) < TIME_SHIFT_EPS_MS) return;
    if (prepared.slideMs > 0) {
      setEndTimeOverrideMs(null);
      const p = (newEnd - prepared.dataTMin - prepared.viewportMs) / prepared.slideMs;
      const x = Math.min(prepared.maxScrollPx, Math.max(0, p * prepared.maxScrollPx));
      chartScrollRef.current?.scrollTo({ x, animated: true });
      setScrollX(x);
    } else {
      setEndTimeOverrideMs(newEnd);
    }
  };

  dateSwipeRef.current = {
    shiftDay,
    canEarlier: prepared.canShiftEarlier,
    canLater: prepared.canShiftLater,
  };

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
      {/* ── Calorie bar strip (BMR baseline + activity) inside chart area ── */}
      {caloriePrepared ? (
        <>
          {/* Subtle amber-tinted background to mark the calorie strip as a separate scale */}
          <Rect
            x={prepared.padL} y={caloriePrepared.calStripTop}
            width={prepared.chartW - prepared.padL - SVG_PAD_R}
            height={caloriePrepared.calStripBottom - caloriePrepared.calStripTop}
            fill="#E3F2FD" opacity={0.70}
          />
          {/* Divider line between glucose/HR zone and calorie strip */}
          <Line
            x1={prepared.padL} y1={caloriePrepared.calStripTop}
            x2={prepared.chartW - SVG_PAD_R} y2={caloriePrepared.calStripTop}
            stroke={WellnessColors.gridLine} strokeWidth={1} opacity={0.8}
          />
          {/* BMR baseline bars */}
          {caloriePrepared.bars.map((bar, idx) =>
            bar.bmrH > 0 ? (
              <Rect key={`cbmr-${idx}`} x={bar.x} y={bar.bmrY}
                width={bar.w} height={bar.bmrH}
                fill={CALORIE_BMR_COLOR} opacity={0.72} rx={1} />
            ) : null
          )}
          {/* Steps/passive calories stacked above BMR */}
          {caloriePrepared.bars.map((bar, idx) =>
            bar.actH > 0 ? (
              <Rect key={`cact-${idx}`} x={bar.x} y={bar.actY}
                width={bar.w} height={bar.actH}
                fill={CALORIE_ACTIVE_COLOR} opacity={0.9} rx={1} />
            ) : null
          )}
          {/* Workout session calories stacked on top (red) */}
          {caloriePrepared.bars.map((bar, idx) =>
            bar.wktH > 0 ? (
              <Rect key={`cwkt-${idx}`} x={bar.x} y={bar.wktY}
                width={bar.w} height={bar.wktH}
                fill={CALORIE_WORKOUT_COLOR} opacity={0.88} rx={1} />
            ) : null
          )}
          {/* Workout labels pinned at the middle of each session */}
          {caloriePrepared.workoutLabels.map((lbl, idx) => (
            <SvgText
              key={`wlbl-${idx}`}
              x={lbl.x} y={caloriePrepared.calStripTop + 10}
              fill={WellnessColors.textPrimary} fontSize={8} fontWeight="700" textAnchor="middle"
            >
              {lbl.label}
            </SvgText>
          ))}
        </>
      ) : null}

      {/* Time axis ticks + labels */}
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

      <View style={[styles.chartRow, styles.chartRowLtr, { minHeight: DATE_HEADER_HEIGHT + svgH }]}>
        <View style={[styles.yAxis, { height: DATE_HEADER_HEIGHT + prepared.svgH }]}>
          {/* Glucose / HR scale labels (BPM / mg·dL) */}
          {prepared.gridLines
            .filter((gl) => gl.showAxisLabel)
            .map((gl) => (
              <Text
                key={`y-${gl.value}`}
                style={[styles.yAxisLabel, { top: DATE_HEADER_HEIGHT + gl.y - 8 }]}
              >
                {gl.value}
              </Text>
            ))}
        </View>

        <View style={[styles.chartPlot, { height: DATE_HEADER_HEIGHT + prepared.svgH }]}>
          <View style={styles.chartDateHeaderOuter}>
            <View style={styles.chartDateHeaderRow}>
              <View style={styles.chartDateNavCol}>
                <Pressable
                  onPress={() => shiftDay(-1)}
                  disabled={!prepared.canShiftEarlier}
                  style={({ pressed }) => [
                    styles.chartDayNavBtn,
                    !prepared.canShiftEarlier && styles.chartDayNavBtnDisabled,
                    pressed && prepared.canShiftEarlier && styles.chartDayNavBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Previous day"
                  hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
                >
                  <ChevronLeft
                    size={DAY_NAV_CHEVRON_PX}
                    color={WellnessColors.textSecondary}
                    strokeWidth={2.25}
                  />
                </Pressable>
              </View>
              <View
                style={[styles.chartDateHeaderSwipeArea, styles.chartDateHeaderTextFlex]}
                collapsable={false}
                {...dateHeaderSwipePan.panHandlers}
              >
                <Text
                  style={styles.chartDateHeaderText}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  accessibilityRole="header"
                  accessibilityLabel={`Chart date range: ${prepared.dateHeaderLabel}`}
                  accessibilityHint="Swipe right for the previous day, swipe left for the next day"
                >
                  {prepared.dateHeaderLabel}
                </Text>
              </View>
              <View style={styles.chartDateNavCol}>
                <Pressable
                  onPress={() => shiftDay(1)}
                  disabled={!prepared.canShiftLater}
                  style={({ pressed }) => [
                    styles.chartDayNavBtn,
                    !prepared.canShiftLater && styles.chartDayNavBtnDisabled,
                    pressed && prepared.canShiftLater && styles.chartDayNavBtnPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="Next day"
                  hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
                >
                  <ChevronRight
                    size={DAY_NAV_CHEVRON_PX}
                    color={WellnessColors.textSecondary}
                    strokeWidth={2.25}
                  />
                </Pressable>
              </View>
            </View>
          </View>
          <View style={{ height: prepared.svgH, position: 'relative' }}>
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
      </View>

      <View style={styles.legend}>
        <Text style={styles.legendGlucose}>Glucose</Text>
        <Text style={styles.legendHeartRate}>Heart rate</Text>
        {caloriePrepared ? (
          <View style={styles.legendCalorieGroup}>
            <Text style={styles.legendBmr}>
              {'BMR'}
              {bmrKcalDay != null && bmrKcalDay > 0
                ? ` (${Math.round(bmrKcalDay / 48)} kcal)`
                : ' (÷48)'}
            </Text>
            <Text style={styles.legendStepsCal}>Steps cal</Text>
            <Text style={styles.legendWorkout}>Workout</Text>
          </View>
        ) : (
          <Text style={styles.legendActivity}>Walk / activity</Text>
        )}
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: SVG_TOTAL_HEIGHT + DATE_HEADER_HEIGHT + 40,
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
  chartDateHeaderOuter: {
    width: '100%',
    paddingHorizontal: 6,
    overflow: 'hidden',
  },
  chartDateHeaderRow: {
    height: DATE_HEADER_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  chartDateNavCol: {
    width: 34,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chartDateHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    textAlign: 'center',
  },
  chartDateHeaderTextFlex: {
    flex: 1,
    minWidth: 0,
  },
  chartDateHeaderSwipeArea: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    minHeight: DATE_HEADER_HEIGHT - 2,
    paddingHorizontal: 2,
  },
  chartDayNavBtn: {
    width: 28,
    height: DATE_HEADER_HEIGHT - 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WellnessColors.progressTrack,
    borderWidth: 1,
    borderColor: WellnessColors.gridLine,
    overflow: 'hidden',
  },
  chartDayNavBtnPressed: {
    opacity: 0.88,
  },
  chartDayNavBtnDisabled: {
    opacity: 0.32,
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
    marginTop: 4,
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
  legendCalorieGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendBmr: {
    color: CALORIE_BMR_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },
  legendStepsCal: {
    color: CALORIE_ACTIVE_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },
  legendWorkout: {
    color: CALORIE_WORKOUT_COLOR,
    fontSize: 12,
    fontWeight: '600',
  },
  legendWithingsBlock: {
    marginTop: 2,
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
