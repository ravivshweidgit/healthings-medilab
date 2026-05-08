import React, { useCallback, useLayoutEffect, useMemo, useRef } from 'react';
import { Dimensions, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import type { ActivityZone } from '../logic/MetabolicLogic';
import { WellnessColors } from '../theme/wellness';

type Point = { timestamp: string; value: number };

const MAX_POINTS = 400;
const REFERENCE_MG_DL = [70, 100, 140] as const;

/** Soft accent for activity zones on white background */
const ZONE_STROKE = '#FFB74D';

const Y_AXIS_WIDTH = 36;
const AXIS_HEIGHT = 30;
const CHART_PLOT_HEIGHT = 210;
const SVG_TOTAL_HEIGHT = CHART_PLOT_HEIGHT + AXIS_HEIGHT;

const SVG_PAD_L = 10;
const SVG_PAD_R = 12;
const SVG_PAD_T = 12;
const SVG_PAD_B = 8;

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

type Props = {
  glucose: Point[];
  steps: Point[];
  activityZones: ActivityZone[];
};

export function MetabolicChart({ glucose, steps, activityZones }: Props) {
  const { width: windowW } = useWindowDimensions();

  const plotH = CHART_PLOT_HEIGHT;
  const svgH = SVG_TOTAL_HEIGHT;
  const scrollRef = useRef<ScrollView>(null);

  const scrollToLatest = useCallback(() => {
    scrollRef.current?.scrollToEnd({ animated: false });
  }, []);

  const prepared = useMemo(() => {
    const chartW = Dimensions.get('window').width * 3;

    const g = downsample(glucose, MAX_POINTS);
    const s = downsample(steps, MAX_POINTS);
    const times = [
      ...g.map((p) => new Date(p.timestamp).getTime()),
      ...s.map((p) => new Date(p.timestamp).getTime()),
    ].filter((n) => !Number.isNaN(n));

    if (!times.length) {
      return null;
    }

    let tMin = Math.min(...times);
    let tMax = Math.max(...times);
    if (tMin === tMax) {
      tMax = tMin + 60 * 60 * 1000;
    }

    const gVals = g.map((p) => p.value).filter((v) => Number.isFinite(v));
    const sVals = s.map((p) => p.value).filter((v) => Number.isFinite(v));

    const gDataMin = gVals.length ? Math.min(...gVals) : 70;
    const gDataMax = gVals.length ? Math.max(...gVals) : 140;
    const gDomainMin = Math.min(70, gDataMin);
    const gDomainMax = Math.max(140, gDataMax);

    let sMin = sVals.length ? Math.min(...sVals) : 0;
    let sMax = sVals.length ? Math.max(...sVals) : 1;
    if (sMax <= sMin) sMax = sMin + 1;

    const padL = SVG_PAD_L;
    const padR = SVG_PAD_R;
    const padT = SVG_PAD_T;
    const padB = SVG_PAD_B;

    const glucoseSlotTop = 0;
    const glucoseSlotH = plotH * 0.55;
    const stepsSlotTop = plotH * 0.58;
    const stepsSlotH = plotH - padT - padB - stepsSlotTop;

    const gPx = toPixelPoints(g, tMin, tMax, gDomainMin, gDomainMax, chartW, plotH, padL, padT, padR, padB, glucoseSlotTop, glucoseSlotH);
    const sPx = toPixelPoints(s, tMin, tMax, sMin, sMax, chartW, plotH, padL, padT, padR, padB, stepsSlotTop, stepsSlotH);

    const glucosePath = buildSmoothPath(gPx);
    const stepsPath = buildSmoothPath(sPx);

    const innerW = Math.max(1, chartW - padL - padR);
    const spanT = Math.max(1, tMax - tMin);

    const gridLines = REFERENCE_MG_DL.map((mg) => {
      const clamped = Math.min(gDomainMax, Math.max(gDomainMin, mg));
      const ny = (clamped - gDomainMin) / Math.max(1e-6, gDomainMax - gDomainMin);
      const y = padT + glucoseSlotTop + (1 - ny) * glucoseSlotH;
      return { mg, y, key: `grid-${mg}` };
    });

    const zoneLines = activityZones.flatMap((zone, zoneIdx) => {
      const start = new Date(zone.startTime).getTime();
      const end = new Date(zone.endTime).getTime();
      const xStart = padL + ((start - tMin) / spanT) * innerW;
      const xEnd = padL + ((end - tMin) / spanT) * innerW;
      return [
        { x: xStart, key: `zs-${zoneIdx}-${start}` },
        { x: xEnd, key: `ze-${zoneIdx}-${end}` },
      ];
    });

    const axisY = plotH - padB;
    const timeTicks = buildTimeTicks(tMin, tMax, padL, innerW);

    return {
      glucosePath,
      stepsPath,
      gridLines,
      zoneLines,
      timeTicks,
      axisY,
      chartW,
      plotH,
      svgH,
      padL,
      padT,
      scrollContentWidth: chartW,
    };
  }, [activityZones, glucose, plotH, steps, windowW]);

  useLayoutEffect(() => {
    if (!prepared) return;
    const id = requestAnimationFrame(() => scrollToLatest());
    return () => cancelAnimationFrame(id);
  }, [prepared, scrollToLatest]);

  if (!prepared) {
    return (
      <View style={[styles.empty, styles.sideInset, { minHeight: plotH }]}>
        <Text style={styles.emptyText}>Your trends will appear after you refresh.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.chartTitle, styles.sideInset]}>HISTORY</Text>

      <View style={[styles.chartRow, { minHeight: svgH }]}>
        <View style={[styles.yAxis, { height: plotH }]}>
          {prepared.gridLines.map((gl) => (
            <Text key={`y-${gl.mg}`} style={[styles.yAxisLabel, { top: gl.y - 8 }]}>
              {gl.mg}
            </Text>
          ))}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          nestedScrollEnabled
          directionalLockEnabled
          showsHorizontalScrollIndicator={false}
          scrollEventThrottle={16}
          style={styles.hScroll}
          contentContainerStyle={{ width: prepared.scrollContentWidth }}
          onContentSizeChange={scrollToLatest}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.graphCanvas, { width: prepared.scrollContentWidth, height: prepared.svgH }]}>
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
                    opacity={0.95}
                  />
                ))}
                {prepared.zoneLines.map((zl) => (
                  <Line
                    key={zl.key}
                    x1={zl.x}
                    y1={prepared.padT}
                    x2={zl.x}
                    y2={prepared.axisY}
                    stroke={ZONE_STROKE}
                    strokeWidth={1}
                    strokeDasharray="5,5"
                    opacity={0.75}
                  />
                ))}
                {prepared.stepsPath ? (
                  <Path d={prepared.stepsPath} fill="none" stroke={WellnessColors.accentBlue} strokeWidth={2} opacity={0.9} />
                ) : null}
                {prepared.glucosePath ? (
                  <Path d={prepared.glucosePath} fill="none" stroke={WellnessColors.accentGreen} strokeWidth={2.5} />
                ) : null}

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
                    <SvgText
                      x={tk.x}
                      y={prepared.svgH - 6}
                      fill={WellnessColors.textSecondary}
                      fontSize={9}
                      textAnchor="middle"
                    >
                      {tk.label}
                    </SvgText>
                  </React.Fragment>
                ))}
              </Svg>
          </View>
        </ScrollView>
      </View>

      <Text style={[styles.tapHint, styles.sideInset]}>
        Swipe sideways — newer data starts on the right; scroll left for earlier dates and times.
      </Text>
      <View style={[styles.legend, styles.sideInset]}>
        <Text style={styles.legendGlucose}>Glucose</Text>
        <Text style={styles.legendSteps}>Activity</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignSelf: 'stretch',
    minHeight: SVG_TOTAL_HEIGHT + 80,
  },
  sideInset: {
    paddingHorizontal: 20,
  },
  chartTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: WellnessColors.textSecondary,
    letterSpacing: 1,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    width: '100%',
    paddingLeft: 12,
  },
  yAxis: {
    width: Y_AXIS_WIDTH,
    marginRight: 4,
    position: 'relative',
  },
  yAxisLabel: {
    position: 'absolute',
    right: 2,
    fontSize: 10,
    fontVariant: ['tabular-nums'],
    color: WellnessColors.textSecondary,
  },
  hScroll: {
    flex: 1,
    minWidth: 0,
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
  tapHint: {
    fontSize: 11,
    color: WellnessColors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 10,
  },
  legendGlucose: {
    color: WellnessColors.accentGreen,
    fontSize: 12,
    fontWeight: '500',
  },
  legendSteps: {
    color: WellnessColors.accentBlue,
    fontSize: 12,
    fontWeight: '500',
  },
});
