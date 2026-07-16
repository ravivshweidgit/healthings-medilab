import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
} from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import type { ActivityZone } from '../logic/MetabolicLogic';
import type { WithingsCaloriePoint, WorkoutSession } from '../services/WithingsApiService';
import type { FoodEntry } from '../services/FoodLogService';
import { WellnessColors } from '../theme/wellness';
import { formatEnergy, formatGlucose, kcalToDisplay, type EnergyUnit } from '../logic/unitConvert';

type Point = { timestamp: string; value: number };

/** Upper bound on series points after downsampling (memory / path complexity). */
const MAX_SERIES_POINTS_CAP = 1000;
const MIN_SERIES_POINTS = 64;
/** Default Y band (mg/dL / BPM shared scale) — expands when visible data exceeds 175 or drops below 50. */
const DEFAULT_Y_MIN = 50;
const DEFAULT_Y_MAX = 175;
const Y_HARD_MIN = 40;
const Y_HARD_MAX = 250;
/** Grid lines every 10 mg/dL; axis labels every 10 in the default band, coarser when auto-expanded. */
const Y_GRID_STEP = 10;
const Y_MIN_SPAN = 100;
/** In-range glucose band (mg/dL) — light green backdrop on the chart. */
const GLUCOSE_TARGET_MIN = 70;
const GLUCOSE_TARGET_MAX = 100;
const GLUCOSE_TARGET_FILL = 'rgba(76, 175, 80, 0.16)';

/** Thin walk-zone lines are replaced by the calorie bar strip; kept for Health-Connect overlay. */
const ACTIVITY_STRIP_PX = 6;

const Y_AXIS_WIDTH = 36;
const AXIS_HEIGHT = 30;
/** Glucose/HR plot height — ~30% taller than original 210px for finer Y resolution. */
const CHART_PLOT_HEIGHT = 273;

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
  { label: '1H', ms: 1 * MS_HOUR },
  { label: '3H', ms: 3 * MS_HOUR },
  { label: '6H', ms: 6 * MS_HOUR },
  { label: '12H', ms: 12 * MS_HOUR },
  { label: '24H', ms: 24 * MS_HOUR },
  { label: '2D', ms: 2 * MS_DAY },
  { label: '4D', ms: 4 * MS_DAY },
  { label: '8D', ms: 8 * MS_DAY },
  { label: '16D', ms: 16 * MS_DAY },
] as const;

const DEFAULT_VIEWPORT_PRESET_INDEX = 3; // 12H

function viewportWidthPx(windowW: number): number {
  return Math.max(180, windowW - Y_AXIS_WIDTH - 44);
}

function filterPointsByTime(points: Point[], t0: number, t1: number): Point[] {
  return points.filter((p) => {
    const t = new Date(p.timestamp).getTime();
    return !Number.isNaN(t) && t >= t0 && t <= t1;
  });
}

type YGridLine = { value: number; showAxisLabel: boolean };

function computeSharedYDomain(glucose: Point[], heartRate: Point[]): { yMin: number; yMax: number; gridLines: YGridLine[] } {
  const values = [...glucose, ...heartRate].map((p) => p.value).filter((v) => v > 0);
  let yMin = DEFAULT_Y_MIN;
  let yMax = DEFAULT_Y_MAX;

  if (values.length > 0) {
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    const pad = Math.max(10, (dataMax - dataMin) * 0.1);
    if (dataMax + pad > DEFAULT_Y_MAX) {
      yMax = Math.ceil((dataMax + pad) / Y_GRID_STEP) * Y_GRID_STEP;
    }
    if (dataMin - pad < DEFAULT_Y_MIN) {
      yMin = Math.floor((dataMin - pad) / Y_GRID_STEP) * Y_GRID_STEP;
    }
  }

  yMin = Math.max(Y_HARD_MIN, yMin);
  yMax = Math.min(Y_HARD_MAX, yMax);
  if (yMax - yMin < Y_MIN_SPAN) {
    yMax = Math.min(Y_HARD_MAX, yMin + Y_MIN_SPAN);
  }

  const gridValues: number[] = [];
  for (let v = Math.ceil(yMin / Y_GRID_STEP) * Y_GRID_STEP; v <= yMax; v += Y_GRID_STEP) {
    gridValues.push(v);
  }
  const span = yMax - yMin;
  const labelEvery = span <= 140 ? 10 : span <= 180 ? 20 : 30;
  const gridLines = gridValues.map((value) => ({
    value,
    showAxisLabel: value % labelEvery === 0,
  }));

  return { yMin, yMax, gridLines };
}

function valueToY(
  value: number,
  vMin: number,
  vMax: number,
  padT: number,
  chartSlotTop: number,
  chartSlotH: number
): number {
  const spanV = Math.max(1e-6, vMax - vMin);
  const ny = (value - vMin) / spanV;
  return padT + chartSlotTop + (1 - ny) * chartSlotH;
}

function nearestPointByTime(points: Point[], targetMs: number, maxDeltaMs: number): Point | null {
  let best: Point | null = null;
  let bestD = Infinity;
  for (const p of points) {
    const t = new Date(p.timestamp).getTime();
    if (Number.isNaN(t)) continue;
    const d = Math.abs(t - targetMs);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  if (!best || bestD > maxDeltaMs) return null;
  return best;
}

function formatScrubTime(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
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

/**
 * Break the series when consecutive samples are farther apart than this fraction of the
 * visible window (floored by a minimum). Fixed 30‑min breaks shattered Withings HR history
 * (samples are often 10–60+ min apart) into hundreds of orphan dots that flash then vanish.
 * Multi-day sync holes still break on 8D because viewport*frac ≫ a few hours.
 */
const HR_GAP_BREAK_VIEWPORT_FRAC = 1 / 12; // ~2h on 24H, ~16h on 8D
const HR_GAP_BREAK_MIN_MS = 3 * 60 * 60 * 1000; // never break under 3h
const GLUCOSE_GAP_BREAK_VIEWPORT_FRAC = 1 / 24;
const GLUCOSE_GAP_BREAK_MIN_MS = 20 * 60 * 1000;
/** Cap orphan HR dots so a sparse series cannot flood the SVG. */
const MAX_HR_ORPHAN_DOTS = 48;

function gapBreakMs(viewportMs: number, frac: number, minMs: number): number {
  return Math.max(minMs, Math.floor(viewportMs * frac));
}

/** Split a time series into contiguous segments (no path drawn across gaps). */
function splitByTimeGap(points: Point[], maxGapMs: number): Point[][] {
  if (points.length === 0) return [];
  const segments: Point[][] = [];
  let cur: Point[] = [points[0]!];
  for (let i = 1; i < points.length; i++) {
    const prevMs = Date.parse(points[i - 1]!.timestamp);
    const nextMs = Date.parse(points[i]!.timestamp);
    if (
      !Number.isFinite(prevMs) ||
      !Number.isFinite(nextMs) ||
      nextMs - prevMs > maxGapMs
    ) {
      segments.push(cur);
      cur = [points[i]!];
    } else {
      cur.push(points[i]!);
    }
  }
  segments.push(cur);
  return segments;
}

/**
 * Min/max envelope downsample — preserves peaks and valleys on long windows
 * (every-Nth sampling crushed overnight HR variation on 8D).
 * Emits up to ~maxPoints by taking both min and max per bucket in time order.
 */
function downsampleMinMax(points: Point[], maxPoints: number): Point[] {
  if (points.length <= maxPoints) return points;
  const bucketCount = Math.max(1, Math.floor(maxPoints / 2));
  const n = points.length;
  const out: Point[] = [];
  const pushUnique = (p: Point) => {
    const last = out[out.length - 1];
    if (last && last.timestamp === p.timestamp && last.value === p.value) return;
    out.push(p);
  };
  for (let b = 0; b < bucketCount; b++) {
    const start = Math.floor((b * n) / bucketCount);
    const end = Math.floor(((b + 1) * n) / bucketCount);
    if (start >= end) continue;
    let minP = points[start]!;
    let maxP = points[start]!;
    for (let i = start + 1; i < end; i++) {
      const p = points[i]!;
      if (p.value < minP.value) minP = p;
      if (p.value > maxP.value) maxP = p;
    }
    const minMs = Date.parse(minP.timestamp);
    const maxMs = Date.parse(maxP.timestamp);
    if (minMs <= maxMs) {
      pushUnique(minP);
      if (minP !== maxP) pushUnique(maxP);
    } else {
      pushUnique(maxP);
      if (minP !== maxP) pushUnique(minP);
    }
  }
  const last = points[n - 1]!;
  pushUnique(last);
  return out;
}

/** Distribute a point budget across segments proportional to their sizes. */
function downsampleSegments(segments: Point[][], totalBudget: number): Point[][] {
  if (segments.length === 0) return [];
  const totalLen = segments.reduce((s, seg) => s + seg.length, 0);
  if (totalLen === 0) return segments;
  return segments.map((seg) => {
    if (seg.length <= 2) return seg;
    const share = Math.max(4, Math.floor((totalBudget * seg.length) / totalLen));
    return downsampleMinMax(seg, share);
  });
}

type PixelPoint = { x: number; y: number };

/** d3 monotone curve requires strictly increasing x — nudge ties / drop non-finite. */
function ensureStrictIncreasingX(points: PixelPoint[]): PixelPoint[] {
  const out: PixelPoint[] = [];
  for (const p of points) {
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) continue;
    const last = out[out.length - 1];
    if (last && p.x <= last.x) {
      out.push({ x: last.x + 0.05, y: p.y });
    } else {
      out.push(p);
    }
  }
  return out;
}

function buildSmoothPath(points: PixelPoint[]): string | null {
  const pts = ensureStrictIncreasingX(points);
  if (pts.length < 2) return null;
  const gen = line<PixelPoint>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);
  return gen(pts) ?? null;
}

/** Join contiguous segments into one SVG `d` (each segment starts with its own `M`). */
function buildSmoothPaths(segments: PixelPoint[][]): string | null {
  const parts: string[] = [];
  for (const seg of segments) {
    const d = buildSmoothPath(seg);
    if (d) parts.push(d);
  }
  return parts.length > 0 ? parts.join('') : null;
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


const MEAL_MARKER_COLOR = '#FF9800';

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
  /** Logged food entries — rendered as meal markers (▼) on the time axis. */
  foodEntries?: FoodEntry[];
  /**
   * Scrubber / badge display only. Plot + green band stay mg/dL so HR (bpm) shares the Y scale.
   */
  glucoseDisplayUnit?: 'mgdl' | 'mmol';
  /** Workout / BMR / meal label display only — bar heights stay kcal. */
  energyDisplayUnit?: EnergyUnit;
};

export function MetabolicChart({
  glucose,
  heartRate,
  activityZones,
  calorieBurns,
  workoutSessions,
  bmrKcalDay,
  foodEntries,
  glucoseDisplayUnit = 'mgdl',
  energyDisplayUnit = 'kcal',
}: Props) {
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
  /** Selected instant for touch scrub tooltip (ms). Cleared on horizontal pan / zoom change. */
  const [scrubMs, setScrubMs] = useState<number | null>(null);
  const chartTouchRef = useRef({ x0: 0, y0: 0, tapPending: false });
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
    const { yMin, yMax, gridLines: yGridDefs } = computeSharedYDomain(gWin, hWin);

    const seriesBudget = Math.min(
      MAX_SERIES_POINTS_CAP,
      Math.max(MIN_SERIES_POINTS, Math.floor(chartW / 8))
    );
    // Gap-break first so multi-day sync holes don't draw as a continuous flat line;
    // threshold scales with viewport so normal Withings spacing (10–60+ min) stays connected.
    // Then min/max-downsample each segment so overnight peaks survive on 8D.
    const hrGapMs = gapBreakMs(viewportMs, HR_GAP_BREAK_VIEWPORT_FRAC, HR_GAP_BREAK_MIN_MS);
    const gluGapMs = gapBreakMs(viewportMs, GLUCOSE_GAP_BREAK_VIEWPORT_FRAC, GLUCOSE_GAP_BREAK_MIN_MS);
    const gSegs = downsampleSegments(splitByTimeGap(gWin, gluGapMs), seriesBudget);
    const hSegs = downsampleSegments(splitByTimeGap(hWin, hrGapMs), seriesBudget);

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

    const toPx = (pts: Point[]) =>
      toPixelPoints(
        pts,
        mapTMin,
        mapTMax,
        yMin,
        yMax,
        chartW,
        plotH,
        padL,
        padT,
        padR,
        padB,
        chartSlotTop,
        chartSlotH
      );

    const gPxSegs = gSegs.map(toPx);
    const hPxSegs = hSegs.map(toPx);
    const glucosePath = buildSmoothPaths(gPxSegs);
    const heartRatePath = buildSmoothPaths(hPxSegs);
    // Isolated single samples as dots — capped so a shattered series cannot flood the SVG.
    const orphanDots = hPxSegs.filter((seg) => seg.length === 1).map((seg) => seg[0]!);
    const heartRateDots =
      orphanDots.length <= MAX_HR_ORPHAN_DOTS
        ? orphanDots
        : orphanDots.filter((_, i) => i % Math.ceil(orphanDots.length / MAX_HR_ORPHAN_DOTS) === 0).slice(0, MAX_HR_ORPHAN_DOTS);

    const innerW = Math.max(1, chartW - padL - padR);
    const spanT = Math.max(1, mapTMax - mapTMin);

    const spanY = yMax - yMin;
    const gridLines = yGridDefs.map((gl) => {
      const ny = (gl.value - yMin) / Math.max(1e-6, spanY);
      const y = padT + chartSlotTop + (1 - ny) * chartSlotH;
      return {
        value: gl.value,
        y,
        key: `grid-${gl.value}`,
        showAxisLabel: gl.showAxisLabel,
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

    const targetBandTopY = valueToY(
      Math.min(GLUCOSE_TARGET_MAX, yMax),
      yMin,
      yMax,
      padT,
      chartSlotTop,
      chartSlotH
    );
    const targetBandBottomY = valueToY(
      Math.max(GLUCOSE_TARGET_MIN, yMin),
      yMin,
      yMax,
      padT,
      chartSlotTop,
      chartSlotH
    );
    const targetBandVisible =
      GLUCOSE_TARGET_MAX >= yMin &&
      GLUCOSE_TARGET_MIN <= yMax &&
      targetBandBottomY - targetBandTopY > 1;

    return {
      glucosePath,
      heartRatePath,
      heartRateDots,
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
      padT,
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
      gWin,
      hWin,
      yMin,
      yMax,
      chartSlotTop,
      chartSlotH,
      targetBandTopY,
      targetBandBottomY,
      targetBandVisible,
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
      if (durationMs <= 0) {
        if (w.kcal > 0) {
          const bk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
          workoutBucketMap.set(bk, (workoutBucketMap.get(bk) ?? 0) + w.kcal);
        }
        continue;
      }
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

    // Auto-scale Y-max from the visible window only (global peaks were shrinking bars to invisibility).
    let maxTotal = CALORIE_Y_MAX_FIXED;
    const visibleFirstBk = Math.floor(mapTMin / BUCKET_MS) * BUCKET_MS;
    for (let bMs = visibleFirstBk; bMs <= mapTMax; bMs += BUCKET_MS) {
      const passive = workoutBuckets.has(bMs) ? 0 : (passiveBucketMap.get(bMs) ?? 0);
      const total   = (bmrPerSlot ?? 0) + passive + (workoutBucketMap.get(bMs) ?? 0);
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
      const actH = actKcal > 0 && actTotalBarH > bmrH ? Math.max(2, actTotalBarH - bmrH) : 0;
      const wktH = wktKcal > 0 && wktTotalBarH > actTotalBarH ? Math.max(2, wktTotalBarH - actTotalBarH) : 0;

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
      workoutLabels.push({
        x,
        label: `${w.activityLabel} ${formatEnergy(w.kcal, energyDisplayUnit)}`,
      });
    }

    return { bars, calStripTop, calStripBottom, calYMax, workoutLabels };
  }, [prepared, calorieBurns, workoutSessions, bmrKcalDay, energyDisplayUnit]);

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
    setScrubMs(null);
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

  const scrub = useMemo(() => {
    if (scrubMs == null || !prepared) return null;
    const {
      mapTMin,
      mapTMax,
      spanT,
      padL,
      padT,
      innerW,
      gWin,
      hWin,
      yMin,
      yMax,
      chartSlotTop,
      chartSlotH,
      calStripTop,
    } = prepared;
    if (scrubMs < mapTMin - 1000 || scrubMs > mapTMax + 1000) return null;

    const xPx = padL + ((scrubMs - mapTMin) / Math.max(1, spanT)) * innerW;
    const glucoseTolerance = Math.max(15 * 60 * 1000, prepared.viewportMs / 48);
    const hrTolerance = Math.max(30 * 60 * 1000, prepared.viewportMs / 12);
    const gPt = nearestPointByTime(gWin, scrubMs, glucoseTolerance);
    const hPt = nearestPointByTime(hWin, scrubMs, hrTolerance);

    return {
      ms: scrubMs,
      xPx,
      glucose: gPt?.value ?? null,
      hr: hPt?.value ?? null,
      glucoseYPx: gPt ? valueToY(gPt.value, yMin, yMax, padT, chartSlotTop, chartSlotH) : null,
      hrYPx: hPt ? valueToY(hPt.value, yMin, yMax, padT, chartSlotTop, chartSlotH) : null,
      dataTopY: padT + chartSlotTop,
      dataBottomY: calStripTop,
    };
  }, [prepared, scrubMs]);

  const applyScrubFromX = useCallback((locationX: number) => {
    if (!prepared) return;
    const x = Math.min(
      prepared.chartW - prepared.padL - SVG_PAD_R,
      Math.max(prepared.padL, locationX)
    );
    const ms = prepared.mapTMin + ((x - prepared.padL) / Math.max(1, prepared.innerW)) * prepared.spanT;
    setScrubMs(ms);
  }, [prepared]);

  /** When scrub is visible, capture horizontal drag in the glucose/HR band to move the crosshair. */
  const scrubDragPan = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (e) => {
          applyScrubFromX(e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => {
          applyScrubFromX(e.nativeEvent.locationX);
        },
      }),
    [applyScrubFromX]
  );

  const handleChartTouchStart = useCallback(
    (e: GestureResponderEvent) => {
      if (!prepared || scrubMs != null) return;
      const { locationX, locationY } = e.nativeEvent;
      if (locationY > prepared.calStripTop) return;
      chartTouchRef.current = { x0: locationX, y0: locationY, tapPending: true };
    },
    [prepared, scrubMs]
  );

  const handleChartTouchMove = useCallback(
    (e: GestureResponderEvent) => {
      if (!prepared || !chartTouchRef.current.tapPending || scrubMs != null) return;
      const { locationX, locationY } = e.nativeEvent;
      const dx = locationX - chartTouchRef.current.x0;
      const dy = locationY - chartTouchRef.current.y0;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        chartTouchRef.current.tapPending = false;
      }
    },
    [prepared, scrubMs]
  );

  const handleChartTouchEnd = useCallback(
    (e: GestureResponderEvent) => {
      if (!prepared || scrubMs != null) return;
      const { locationX, locationY } = e.nativeEvent;
      if (chartTouchRef.current.tapPending && locationY <= prepared.calStripTop) {
        applyScrubFromX(locationX);
      }
      chartTouchRef.current.tapPending = false;
    },
    [applyScrubFromX, prepared, scrubMs]
  );

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
      {prepared.targetBandVisible ? (
        <Rect
          x={prepared.padL}
          y={prepared.targetBandTopY}
          width={prepared.chartW - prepared.padL - SVG_PAD_R}
          height={prepared.targetBandBottomY - prepared.targetBandTopY}
          fill={GLUCOSE_TARGET_FILL}
        />
      ) : null}
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
      {(prepared.heartRateDots ?? []).map((dot, i) => (
        <Circle
          key={`hr-dot-${i}`}
          cx={dot.x}
          cy={dot.y}
          r={2.5}
          fill={WellnessColors.accentRed}
          opacity={0.95}
        />
      ))}
      {prepared.glucosePath ? (
        <Path d={prepared.glucosePath} fill="none" stroke={WellnessColors.accentGreen} strokeWidth={2.5} />
      ) : null}

      {scrub ? (
        <>
          <Line
            x1={scrub.xPx}
            y1={scrub.dataTopY}
            x2={scrub.xPx}
            y2={scrub.dataBottomY}
            stroke={WellnessColors.textSecondary}
            strokeWidth={1}
            strokeDasharray="4,3"
            opacity={0.85}
          />
          {scrub.glucoseYPx != null ? (
            <Circle
              cx={scrub.xPx}
              cy={scrub.glucoseYPx}
              r={5}
              fill={WellnessColors.accentGreen}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ) : null}
          {scrub.hrYPx != null ? (
            <Circle
              cx={scrub.xPx}
              cy={scrub.hrYPx}
              r={4.5}
              fill={WellnessColors.accentRed}
              stroke="#fff"
              strokeWidth={1.5}
            />
          ) : null}
        </>
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

      {/* Meal markers — orange ▼ above the time axis for each logged food entry */}
      {foodEntries?.map((entry) => {
        const x = timeToX(entry.timestamp, prepared.mapTMin, prepared.spanT, prepared.padL, prepared.innerW);
        if (x < prepared.padL - 4 || x > prepared.padL + prepared.innerW + 4) return null;
        const energyLabel = Math.round(kcalToDisplay(entry.totalKcal, energyDisplayUnit));
        return (
          <React.Fragment key={`meal-${entry.id}`}>
            {/* Vertical dashed line from axis up */}
            <Line
              x1={x} y1={prepared.axisY - 20}
              x2={x} y2={prepared.axisY - 4}
              stroke={MEAL_MARKER_COLOR} strokeWidth={1.5} strokeDasharray="3,2" opacity={0.8}
            />
            {/* Downward triangle marker */}
            <SvgText
              x={x} y={prepared.axisY - 22}
              fill={MEAL_MARKER_COLOR} fontSize={10} textAnchor="middle" fontWeight="700"
            >
              ▼
            </SvgText>
            {/* energy label */}
            <SvgText
              x={x} y={prepared.axisY - 32}
              fill={MEAL_MARKER_COLOR} fontSize={8} textAnchor="middle"
            >
              {energyLabel}
            </SvgText>
          </React.Fragment>
        );
      })}
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
          {scrub ? (
            <View
              pointerEvents="none"
              style={[
                styles.scrubBadge,
                {
                  left: Math.min(Math.max(scrub.xPx - 28, 4), prepared.chartW - 60),
                  top: 4,
                },
              ]}
            >
              <Text style={styles.scrubBadgeGlucose}>
                {scrub.glucose != null
                  ? formatGlucose(scrub.glucose, glucoseDisplayUnit)
                  : '—'}
              </Text>
              <Text style={styles.scrubBadgeHr}>
                {scrub.hr != null ? `${Math.round(scrub.hr)} bpm` : '— bpm'}
              </Text>
              <Text style={styles.scrubBadgeTime}>{formatScrubTime(scrub.ms)}</Text>
            </View>
          ) : null}
          {scrubMs != null ? (
            <View
              style={[styles.scrubDragLayer, { height: prepared.calStripTop }]}
              collapsable={false}
              {...scrubDragPan.panHandlers}
            />
          ) : null}
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
            onTouchStart={handleChartTouchStart}
            onTouchMove={handleChartTouchMove}
            onTouchEnd={handleChartTouchEnd}
            onScrollBeginDrag={() => setScrubMs(null)}
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
                ? ` (${formatEnergy(bmrKcalDay / 48, energyDisplayUnit)})`
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
  scrubDragLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 3,
    elevation: 5,
    backgroundColor: 'transparent',
  },
  scrubBadge: {
    position: 'absolute',
    zIndex: 2,
    alignItems: 'center',
    paddingVertical: 1,
    paddingHorizontal: 3,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.42)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(76, 175, 80, 0.16)',
  },
  scrubBadgeGlucose: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: WellnessColors.accentGreen,
    fontVariant: ['tabular-nums'],
  },
  scrubBadgeHr: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: WellnessColors.accentRed,
    fontVariant: ['tabular-nums'],
  },
  scrubBadgeTime: {
    fontSize: 9,
    lineHeight: 11,
    fontWeight: '500',
    color: WellnessColors.textSecondary,
    fontVariant: ['tabular-nums'],
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
