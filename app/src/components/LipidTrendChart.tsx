/**
 * Lipid trends — four stacked strips (Total, LDL, TG, HDL), each auto-scaled with a green safe band.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import type { LipidTrendPoint } from '../services/LabLogService';
import type { Gender } from '../services/TargetService';
import { formatShortDate } from '../i18n/dateLocale';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

const PLOT_PAD_L = 36;
const PAD_R = 12;
/** Horizontal inset so first/last value pills stay inside the plot. */
const PLOT_X_INSET = 26;
const PAD_TOP = 4;
const TITLE_H = 14;
const STRIP_H = 88;
const STRIP_UNIT = TITLE_H + STRIP_H;
/** Room under the line for value labels below each dot. */
const LABEL_RESERVE = 16;
const PLOT_H = STRIP_H - LABEL_RESERVE;
const AXIS_BOTTOM = 22;

const SAFE_FILL = 'rgba(76, 175, 80, 0.16)';

const SAFE_TOTAL = 200;
const SAFE_LDL = 100;
const SAFE_TG = 150;
const SAFE_HDL_MALE = 40;
const SAFE_HDL_FEMALE = 50;

type SeriesKey = 'totalCholesterol' | 'ldl' | 'triglycerides' | 'hdl';

type StripDef = {
  key: SeriesKey;
  label: string;
  labelHe: string;
  color: string;
  mode: 'below' | 'above';
  threshold: number;
  thresholdLabel: string;
};

type PixelPoint = { x: number; y: number };
type LabeledPoint = PixelPoint & { value: number; dataIndex: number };

type PreparedStrip = {
  def: StripDef;
  stripIdx: number;
  dom: { min: number; max: number };
  pts: LabeledPoint[];
  path: string | null;
  grid: { y: number; label: string; key: string }[];
  safeRect: { y: number; h: number } | null;
  stripTop: number;
};

type Props = {
  points: LipidTrendPoint[];
  rtl?: boolean;
  gender?: Gender | null;
  langCode?: string | null;
};

function hdlSafeThreshold(gender?: Gender | null): number {
  return gender === 'female' ? SAFE_HDL_FEMALE : SAFE_HDL_MALE;
}

function buildStripDefs(c: ThemeColors, gender?: Gender | null): StripDef[] {
  const hdlT = hdlSafeThreshold(gender);
  return [
    {
      key: 'totalCholesterol',
      label: 'TOTAL',
      labelHe: 'כולסטרול כולל',
      color: c.accentBlue,
      mode: 'below',
      threshold: SAFE_TOTAL,
      thresholdLabel: `<${SAFE_TOTAL}`,
    },
    {
      key: 'ldl',
      label: 'LDL',
      labelHe: 'LDL',
      color: c.chart.ldl,
      mode: 'below',
      threshold: SAFE_LDL,
      thresholdLabel: `<${SAFE_LDL}`,
    },
    {
      key: 'triglycerides',
      label: 'TG',
      labelHe: 'TG',
      color: c.chart.tg,
      mode: 'below',
      threshold: SAFE_TG,
      thresholdLabel: `<${SAFE_TG}`,
    },
    {
      key: 'hdl',
      label: 'HDL',
      labelHe: 'HDL',
      color: c.chart.hdl,
      mode: 'above',
      threshold: hdlT,
      thresholdLabel: `≥${hdlT}`,
    },
  ];
}

function axisDateLabel(dateKey: string, langCode?: string | null): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return dateKey;
  const [y, mo, da] = parts;
  return formatShortDate(new Date(y, mo - 1, da), langCode);
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
  const plotInner = Math.max(1, innerW - PLOT_X_INSET * 2);
  return plotLeft + PLOT_X_INSET + (i / Math.max(1, n - 1)) * plotInner;
}

function clampLabelCenter(x: number, pillW: number, svgW: number): number {
  const half = pillW / 2 + 2;
  return Math.min(svgW - half, Math.max(half, x));
}

function mapY(v: number, vMin: number, vMax: number, top: number, height: number): number {
  const span = Math.max(1e-6, vMax - vMin);
  return top + (1 - (v - vMin) / span) * height;
}

function stripDomain(values: number[], mode: 'below' | 'above', threshold: number): { min: number; max: number } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (mode === 'below') {
    hi = Math.max(hi, threshold);
    lo = Math.min(lo, 0);
  } else {
    lo = Math.min(lo, Math.max(0, threshold - 15));
    hi = Math.max(hi, threshold + 15);
  }
  if (lo === hi) {
    lo -= 8;
    hi += 8;
  }
  const pad = (hi - lo) * 0.1;
  return { min: Math.max(0, lo - pad), max: hi + pad };
}

function yTicks(min: number, max: number): number[] {
  return [max, (min + max) / 2, min].map((v) => Math.round(v));
}

function formatLabValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function buildSmoothPath(points: PixelPoint[]): string | null {
  if (points.length < 2) return null;
  const gen = line<PixelPoint>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);
  return gen(points) ?? null;
}

function safeBandRect(
  dom: { min: number; max: number },
  mode: 'below' | 'above',
  threshold: number,
  stripTop: number,
): { y: number; h: number } | null {
  const clamped =
    mode === 'below'
      ? threshold >= dom.min && threshold <= dom.max
      : threshold >= dom.min && threshold <= dom.max;
  if (!clamped) return null;

  const yThreshold = mapY(threshold, dom.min, dom.max, stripTop, PLOT_H);
  const yBottom = mapY(dom.min, dom.min, dom.max, stripTop, PLOT_H);
  const yTop = mapY(dom.max, dom.min, dom.max, stripTop, PLOT_H);

  if (mode === 'below') {
    const y = yThreshold;
    const h = yBottom - yThreshold;
    return h > 1 ? { y, h } : null;
  }
  const y = yTop;
  const h = yThreshold - yTop;
  return h > 1 ? { y, h } : null;
}

export function LipidTrendChart({ points, rtl, gender, langCode }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  /** Scroll (20×2) + lab card padding (18×2) — chart uses full card inner width. */
  const chartW = Math.max(248, width - 76);

  const prepared = useMemo(() => {
    if (points.length < 2) return null;

    const stripDefs = buildStripDefs(colors, gender);
    const n = points.length;
    const plotLeft = PLOT_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - PAD_R);
    const chartRight = chartW - PAD_R;

    const visible: PreparedStrip[] = [];
    let stripIdx = 0;

    for (const def of stripDefs) {
      const values: number[] = [];
      points.forEach((p) => {
        const v = p[def.key];
        if (v != null && Number.isFinite(v)) values.push(v);
      });
      if (values.length < 2) continue;

      const dom = stripDomain(values, def.mode, def.threshold);
      const stripTop = PAD_TOP + stripIdx * STRIP_UNIT + TITLE_H;

      const pts: LabeledPoint[] = [];
      points.forEach((p, i) => {
        const v = p[def.key];
        if (v == null || !Number.isFinite(v)) return;
        pts.push({
          x: xAtIndex(i, plotLeft, innerW, n),
          y: mapY(v, dom.min, dom.max, stripTop, PLOT_H),
          value: v,
          dataIndex: i,
        });
      });

      const grid = yTicks(dom.min, dom.max).map((v, k) => ({
        y: mapY(v, dom.min, dom.max, stripTop, PLOT_H),
        label: String(v),
        key: `${def.key}-g-${k}`,
      }));

      visible.push({
        def,
        stripIdx,
        dom,
        pts,
        path: buildSmoothPath(pts),
        grid,
        safeRect: safeBandRect(dom, def.mode, def.threshold, stripTop),
        stripTop,
      });
      stripIdx += 1;
    }

    if (visible.length === 0) return null;

    const tickIdx = new Set(pickTickIndices(n, 5));
    const xTicks = points
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ p, i }) => ({
        x: xAtIndex(i, plotLeft, innerW, n),
        label: axisDateLabel(p.dateKey, langCode),
        key: p.dateKey,
      }));

    const svgH = PAD_TOP + visible.length * STRIP_UNIT + AXIS_BOTTOM;
    const xAxisY = PAD_TOP + visible.length * STRIP_UNIT + 14;

    return { chartW, svgH, plotLeft, chartRight, visible, xTicks, xAxisY };
  }, [chartW, colors, gender, langCode, points]);

  if (!prepared) return null;

  const title = rtl ? 'מגמת כולסטרול' : 'Cholesterol trends';
  const disclaimer = rtl
    ? 'טווחי יעד לבוגרים — לא ייעוץ רפואי'
    : 'General adult targets — not medical advice';

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.chartBox}>
        <Svg width={prepared.chartW} height={prepared.svgH}>
        {prepared.visible.map((strip) => (
          <React.Fragment key={strip.def.key}>
            {strip.stripIdx > 0 ? (
              <Line
                x1={prepared.plotLeft}
                x2={prepared.chartW - PAD_R}
                y1={PAD_TOP + strip.stripIdx * STRIP_UNIT}
                y2={PAD_TOP + strip.stripIdx * STRIP_UNIT}
                stroke={colors.gridLine}
                strokeWidth={1}
                opacity={0.6}
              />
            ) : null}

            <SvgText
              x={prepared.plotLeft + 4}
              y={PAD_TOP + strip.stripIdx * STRIP_UNIT + 11}
              fill={strip.def.color}
              fontSize={9}
              fontWeight="700"
            >
              {rtl ? strip.def.labelHe : strip.def.label} · {strip.def.thresholdLabel} mg/dL
            </SvgText>

            {strip.safeRect ? (
              <Rect
                x={prepared.plotLeft}
                y={strip.safeRect.y}
                width={prepared.chartW - prepared.plotLeft - PAD_R}
                height={strip.safeRect.h}
                fill={SAFE_FILL}
              />
            ) : null}

            {strip.grid.map((g) => (
              <React.Fragment key={g.key}>
                <Line
                  x1={prepared.plotLeft}
                  x2={prepared.chartW - PAD_R}
                  y1={g.y}
                  y2={g.y}
                  stroke={colors.gridLine}
                  strokeWidth={1}
                  opacity={0.5}
                />
                <SvgText
                  x={prepared.plotLeft - 4}
                  y={g.y + 3}
                  fontSize={8}
                  fill={colors.textSecondary}
                  textAnchor="end"
                >
                  {g.label}
                </SvgText>
              </React.Fragment>
            ))}

            {strip.path ? (
              <Path d={strip.path} stroke={strip.def.color} strokeWidth={2.2} fill="none" />
            ) : null}

            {strip.pts.map((pt) => (
              <Circle key={`${strip.def.key}-dot-${pt.dataIndex}`} cx={pt.x} cy={pt.y} r={3.5} fill={strip.def.color} />
            ))}

            {strip.pts.map((pt) => {
              const label = formatLabValue(pt.value);
              const w = Math.max(24, label.length * 5.4 + 8);
              const lx = clampLabelCenter(pt.x, w, prepared.chartW);
              const ly = pt.y + 14;
              return (
                <React.Fragment key={`${strip.def.key}-lbl-${pt.dataIndex}`}>
                  <Rect
                    x={lx - w / 2}
                    y={ly - 9}
                    width={w}
                    height={13}
                    rx={3}
                    fill={colors.surface}
                    stroke={strip.def.color}
                    strokeWidth={0.75}
                  />
                  <SvgText
                    x={lx}
                    y={ly}
                    fontSize={9}
                    fontWeight="600"
                    fill={strip.def.color}
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </React.Fragment>
        ))}

        {prepared.xTicks.map((t) => (
          <SvgText
            key={t.key}
            x={t.x}
            y={prepared.xAxisY}
            fontSize={9}
            fill={colors.textSecondary}
            textAnchor="middle"
          >
            {t.label}
          </SvgText>
        ))}
        </Svg>
      </View>
      <Text style={styles.refNote}>{disclaimer}</Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors) =>
  StyleSheet.create({
    wrap: {
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: c.gridLine,
    },
    title: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.5,
      color: c.textSecondary,
      textAlign: 'center',
      marginBottom: 6,
    },
    chartBox: {
      width: '100%',
      alignItems: 'center',
      overflow: 'hidden',
      marginHorizontal: -4,
    },
    refNote: {
      fontSize: 9,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
  });
