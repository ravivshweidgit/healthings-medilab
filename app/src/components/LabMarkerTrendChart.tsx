/**
 * Single-marker lab trend — one strip with green from–to (refLow–refHigh) band.
 */

import React, { useMemo } from 'react';
import { StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import { curveMonotoneX, line } from 'd3-shape';
import type { LabMarkerTrendSeries } from '../services/LabLogService';
import { formatShortDate } from '../i18n/dateLocale';
import { useTheme } from '../theme/ThemeProvider';
import type { ThemeColors } from '../theme/tokens';

const PLOT_PAD_L = 36;
const PAD_R = 12;
const PLOT_X_INSET = 26;
const PAD_TOP = 4;
const TITLE_H = 14;
const STRIP_H = 88;
const LABEL_RESERVE = 16;
const PLOT_H = STRIP_H - LABEL_RESERVE;
const AXIS_BOTTOM = 22;
const SAFE_FILL = 'rgba(76, 175, 80, 0.16)';

type PixelPoint = { x: number; y: number };
type LabeledPoint = PixelPoint & { value: number; dataIndex: number };

type Props = {
  series: LabMarkerTrendSeries;
  rtl?: boolean;
  langCode?: string | null;
  /** When nested under DashboardCollapseHeader, hide internal title. */
  hideTitle?: boolean;
};

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

function rangeDomain(
  values: number[],
  refLow: number | null,
  refHigh: number | null,
): { min: number; max: number } {
  let lo = Math.min(...values);
  let hi = Math.max(...values);
  if (refLow != null && Number.isFinite(refLow)) lo = Math.min(lo, refLow);
  if (refHigh != null && Number.isFinite(refHigh)) hi = Math.max(hi, refHigh);
  if (lo === hi) {
    lo -= 8;
    hi += 8;
  }
  const pad = (hi - lo) * 0.1;
  return { min: lo - pad, max: hi + pad };
}

function yTicks(min: number, max: number): number[] {
  return [max, (min + max) / 2, min].map((v) => Math.round(v * 10) / 10);
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

function rangeBandRect(
  dom: { min: number; max: number },
  refLow: number | null,
  refHigh: number | null,
  stripTop: number,
): { y: number; h: number } | null {
  if (refLow == null || refHigh == null || !Number.isFinite(refLow) || !Number.isFinite(refHigh)) {
    return null;
  }
  const lo = Math.min(refLow, refHigh);
  const hi = Math.max(refLow, refHigh);
  const yTop = mapY(Math.min(hi, dom.max), dom.min, dom.max, stripTop, PLOT_H);
  const yBottom = mapY(Math.max(lo, dom.min), dom.min, dom.max, stripTop, PLOT_H);
  const h = yBottom - yTop;
  return h > 1 ? { y: yTop, h } : null;
}

export function LabMarkerTrendChart({ series, rtl, langCode, hideTitle }: Props) {
  const { colors, isDark } = useTheme();
  const styles = useMemo(() => makeStyles(colors, isDark), [colors, isDark]);
  const { width } = useWindowDimensions();
  const chartW = Math.max(248, width - 76);

  const prepared = useMemo(() => {
    if (series.points.length < 2) return null;

    const n = series.points.length;
    const plotLeft = PLOT_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - PAD_R);
    const values = series.points.map((p) => p.value);
    const dom = rangeDomain(values, series.refLow, series.refHigh);
    const stripTop = PAD_TOP + TITLE_H;

    const pts: LabeledPoint[] = series.points.map((p, i) => ({
      x: xAtIndex(i, plotLeft, innerW, n),
      y: mapY(p.value, dom.min, dom.max, stripTop, PLOT_H),
      value: p.value,
      dataIndex: i,
    }));

    const grid = yTicks(dom.min, dom.max).map((v, k) => ({
      y: mapY(v, dom.min, dom.max, stripTop, PLOT_H),
      label: String(v),
      key: `g-${k}`,
    }));

    const tickIdx = new Set(pickTickIndices(n, 5));
    const xTicks = series.points
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ p, i }) => ({
        x: xAtIndex(i, plotLeft, innerW, n),
        label: axisDateLabel(p.dateKey, langCode),
        key: p.dateKey,
      }));

    const svgH = PAD_TOP + TITLE_H + STRIP_H + AXIS_BOTTOM;
    const xAxisY = PAD_TOP + TITLE_H + STRIP_H + 14;
    const rangeLabel =
      series.refLow != null && series.refHigh != null
        ? `${formatLabValue(series.refLow)}–${formatLabValue(series.refHigh)}`
        : null;

    return {
      chartW,
      svgH,
      plotLeft,
      pts,
      path: buildSmoothPath(pts),
      grid,
      safeRect: rangeBandRect(dom, series.refLow, series.refHigh, stripTop),
      xTicks,
      xAxisY,
      rangeLabel,
      color: colors.accentBlue,
    };
  }, [chartW, colors.accentBlue, langCode, series]);

  if (!prepared) return null;

  const unitSuffix = series.unit ? ` ${series.unit}` : '';
  const stripTitle = prepared.rangeLabel
    ? `${series.code} · ${prepared.rangeLabel}${unitSuffix}`
    : `${series.code}${unitSuffix}`;

  return (
    <View style={styles.wrap}>
      {hideTitle ? null : (
        <Text style={styles.title}>{rtl ? 'מגמת מעבדה' : 'Lab trend'}</Text>
      )}
      <View style={styles.chartBox}>
        <Svg width={prepared.chartW} height={prepared.svgH}>
          <SvgText
            x={prepared.plotLeft + 4}
            y={PAD_TOP + 11}
            fill={prepared.color}
            fontSize={9}
            fontWeight="700"
          >
            {stripTitle}
          </SvgText>

          {prepared.safeRect ? (
            <Rect
              x={prepared.plotLeft}
              y={prepared.safeRect.y}
              width={prepared.chartW - prepared.plotLeft - PAD_R}
              height={prepared.safeRect.h}
              fill={SAFE_FILL}
            />
          ) : null}

          {prepared.grid.map((g) => (
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

          {prepared.path ? (
            <Path d={prepared.path} stroke={prepared.color} strokeWidth={2.2} fill="none" />
          ) : null}

          {prepared.pts.map((pt) => (
            <Circle key={`dot-${pt.dataIndex}`} cx={pt.x} cy={pt.y} r={3.5} fill={prepared.color} />
          ))}

          {prepared.pts.map((pt) => {
            const label = formatLabValue(pt.value);
            const w = Math.max(24, label.length * 5.4 + 8);
            const lx = clampLabelCenter(pt.x, w, prepared.chartW);
            const ly = pt.y + 14;
            return (
              <React.Fragment key={`lbl-${pt.dataIndex}`}>
                <Rect
                  x={lx - w / 2}
                  y={ly - 9}
                  width={w}
                  height={13}
                  rx={3}
                  fill={isDark ? colors.background : colors.surface}
                  stroke={prepared.color}
                  strokeWidth={0.75}
                />
                <SvgText
                  x={lx}
                  y={ly}
                  fontSize={9}
                  fontWeight="600"
                  fill={prepared.color}
                  textAnchor="middle"
                >
                  {label}
                </SvgText>
              </React.Fragment>
            );
          })}

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
      <Text style={styles.refNote}>
        {rtl ? 'טווח ייחוס מהדוח — לא ייעוץ רפואי' : 'Reference range from report — not medical advice'}
      </Text>
    </View>
  );
}

const makeStyles = (c: ThemeColors, isDark: boolean) =>
  StyleSheet.create({
    wrap: {
      marginTop: 4,
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
      backgroundColor: isDark ? c.background : undefined,
      borderRadius: isDark ? 12 : 0,
      paddingVertical: isDark ? 6 : 0,
    },
    refNote: {
      fontSize: 9,
      color: c.textSecondary,
      textAlign: 'center',
      marginTop: 6,
    },
  });
