/**
 * Static SVG charts for visit report appendix — mirrors dashboard charts as embeddable SVG.
 */

import { curveMonotoneX, line } from 'd3-shape';
import { localDayKeyFromMs, type MetabolicTrend7dDay } from './metabolicTrend7d';
import type { LipidTrendPoint } from '../services/LabLogService';
import type { TimePoint } from '../services/HealthConnectService';
import type { Gender, UserLanguage } from '../services/TargetService';

export type VisitReportChart = {
  id: string;
  title: string;
  svg: string;
};

const W = 720;
const PAD_L = 44;
const PAD_R = 16;
const PAD_TOP = 8;
const PLOT_X_INSET = 26;
const STRIP_H = 80;
const TITLE_H = 20;
const LABEL_RESERVE = 16;
const STRIP_GAP = 6;
const STRIP_UNIT = TITLE_H + STRIP_H + STRIP_GAP;
const AXIS_H = 28;

type Pt = { x: number; y: number };

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function chartLabels(lang?: UserLanguage | null) {
  if (lang?.code === 'he') {
    return {
      chartsTitle: 'נספח א — גרפים',
      chartsIntro: 'גרפים כפי שמופיעים באפליקציה (נתוני wellness מקומיים).',
      lipids: 'מגמת שומנים בדם (LDL, HDL, כולסטרול, TG)',
      body: 'הרכב גוף Withings (משקל, שומן, שריר)',
      energy: 'אנרגיה יומית — נצרך מול הוצאה',
      glucose: 'ממוצע CGM יומי (mg/dL)',
      noData: 'אין מספיק נתונים לגרף',
      weight: 'משקל (kg)',
      fat: 'שומן (kg)',
      muscle: 'שריר (kg)',
      eaten: 'נצרך',
      burn: 'הוצאה',
    };
  }
  return {
    chartsTitle: 'Appendix A — Charts',
    chartsIntro: 'Visual trends matching the in-app dashboard (local wellness data).',
    lipids: 'Blood lipid trends (LDL, HDL, total cholesterol, TG)',
    body: 'Withings body composition (weight, fat, muscle)',
    energy: 'Daily energy — intake vs expenditure',
    glucose: 'Daily CGM average (mg/dL)',
    noData: 'Insufficient data for chart',
    weight: 'Weight (kg)',
    fat: 'Fat (kg)',
    muscle: 'Muscle (kg)',
    eaten: 'Eaten',
    burn: 'Burn',
  };
}

function axisDateLabel(dateKey: string): string {
  const parts = dateKey.split('-').map(Number);
  if (parts.length !== 3) return dateKey;
  const [y, mo, da] = parts;
  return new Date(y, mo - 1, da).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function xAt(i: number, n: number, innerW: number): number {
  return PAD_L + (i / Math.max(1, n - 1)) * innerW;
}

function yMap(v: number, min: number, max: number, top: number, h: number): number {
  const span = Math.max(1e-6, max - min);
  return top + (1 - (v - min) / span) * h;
}

function domain(values: number[], padRatio = 0.12): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (finite.length === 0) return { min: 0, max: 1 };
  let lo = Math.min(...finite);
  let hi = Math.max(...finite);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const pad = (hi - lo) * padRatio;
  return { min: lo - pad, max: hi + pad };
}

function smoothPath(pts: Pt[]): string {
  if (pts.length < 2) return '';
  const gen = line<Pt>()
    .x((d) => d.x)
    .y((d) => d.y)
    .curve(curveMonotoneX);
  return gen(pts) ?? '';
}

function pickTicks(n: number, max = 6): number[] {
  if (n <= 1) return [0];
  if (n <= max) return Array.from({ length: n }, (_, i) => i);
  const out = new Set<number>();
  for (let k = 0; k < max; k++) out.add(Math.round((k * (n - 1)) / (max - 1)));
  out.add(n - 1);
  return Array.from(out).sort((a, b) => a - b);
}

function wrapSvg(title: string, innerH: number, body: string): string {
  const h = PAD_TOP + innerH + AXIS_H;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${h}" width="100%" role="img" aria-label="${esc(title)}" style="direction:ltr">${body}</svg>`;
}

function renderStrip(opts: {
  title: string;
  color: string;
  values: (number | null)[];
  labels: string[];
  stripTop: number;
  innerW: number;
  safeY?: number;
  safeH?: number;
  fixedDom?: { min: number; max: number };
}): string {
  const { title, color, values, labels, stripTop, innerW, safeY, safeH, fixedDom } = opts;
  const nums = values.filter((v): v is number => v != null && Number.isFinite(v));
  if (nums.length === 0) return '';
  const dom = fixedDom ?? domain(nums);
  const plotH = STRIP_H - 4;
  const pts: Pt[] = [];
  values.forEach((v, i) => {
    if (v == null || !Number.isFinite(v)) return;
    pts.push({ x: xAt(i, values.length, innerW), y: yMap(v, dom.min, dom.max, stripTop, plotH) });
  });
  const path = smoothPath(pts);
  const dots = pts
    .map((p, idx) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" />`)
    .join('');
  const safe =
    safeY != null && safeH != null
      ? `<rect x="${PAD_L}" y="${safeY.toFixed(1)}" width="${innerW}" height="${safeH.toFixed(1)}" fill="rgba(76,175,80,0.14)" />`
      : '';
  const yMid = yMap((dom.min + dom.max) / 2, dom.min, dom.max, stripTop, plotH);
  const yLo = yMap(dom.min, dom.min, dom.max, stripTop, plotH);
  return `
  <text x="${PAD_L - 4}" y="${stripTop + 12}" text-anchor="end" font-family="system-ui,sans-serif" font-size="10" font-weight="700" fill="${color}">${esc(title)}</text>
  ${safe}
  <line x1="${PAD_L}" y1="${yMid.toFixed(1)}" x2="${PAD_L + innerW}" y2="${yMid.toFixed(1)}" stroke="#eef2f6" stroke-width="1"/>
  ${path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2"/>` : ''}
  ${dots}
  <text x="${PAD_L - 4}" y="${(stripTop + 4).toFixed(1)}" text-anchor="end" font-family="system-ui,sans-serif" font-size="8" fill="#888">${Math.round(dom.max)}</text>
  <text x="${PAD_L - 4}" y="${yLo.toFixed(1)}" text-anchor="end" font-family="system-ui,sans-serif" font-size="8" fill="#888">${Math.round(dom.min)}</text>
  ${labels.length > 0 ? '' : ''}`;
}

const SAFE_FILL = 'rgba(76, 175, 80, 0.16)';

function hdlSafeThreshold(gender: Gender | null): number {
  return gender === 'female' ? 50 : 40;
}

function formatLabValue(v: number): string {
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Match LipidTrendChart.tsx — Y domain includes clinical threshold. */
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

/** Green safe band — below threshold (LDL/TG/TC) or above threshold (HDL). */
function safeBandRect(
  dom: { min: number; max: number },
  mode: 'below' | 'above',
  threshold: number,
  stripTop: number,
  plotH: number,
): { y: number; h: number } | null {
  if (threshold < dom.min || threshold > dom.max) return null;
  const yThreshold = yMap(threshold, dom.min, dom.max, stripTop, plotH);
  const yBottom = yMap(dom.min, dom.min, dom.max, stripTop, plotH);
  const yTop = yMap(dom.max, dom.min, dom.max, stripTop, plotH);
  if (mode === 'below') {
    const h = yBottom - yThreshold;
    return h > 1 ? { y: yThreshold, h } : null;
  }
  const h = yThreshold - yTop;
  return h > 1 ? { y: yTop, h } : null;
}

function xAtIndex(i: number, n: number, innerW: number): number {
  const plotInner = Math.max(1, innerW - PLOT_X_INSET * 2);
  return PAD_L + PLOT_X_INSET + (i / Math.max(1, n - 1)) * plotInner;
}

function clampLabelCenter(x: number, pillW: number, svgW: number): number {
  const half = pillW / 2 + 2;
  return Math.min(svgW - half, Math.max(half, x));
}

type LipidStripDef = {
  key: keyof Pick<LipidTrendPoint, 'ldl' | 'hdl' | 'totalCholesterol' | 'triglycerides'>;
  label: string;
  labelHe: string;
  color: string;
  mode: 'below' | 'above';
  threshold: number;
  thresholdLabel: string;
};

function buildLipidStripDefs(gender: Gender | null): LipidStripDef[] {
  const hdlT = hdlSafeThreshold(gender);
  return [
    { key: 'totalCholesterol', label: 'TOTAL', labelHe: 'כולסטרול כולל', color: '#1565C0', mode: 'below', threshold: 200, thresholdLabel: '<200' },
    { key: 'ldl', label: 'LDL', labelHe: 'LDL', color: '#C62828', mode: 'below', threshold: 100, thresholdLabel: '<100' },
    { key: 'triglycerides', label: 'TG', labelHe: 'TG', color: '#FF9800', mode: 'below', threshold: 150, thresholdLabel: '<150' },
    { key: 'hdl', label: 'HDL', labelHe: 'HDL', color: '#2E7D32', mode: 'above', threshold: hdlT, thresholdLabel: `≥${hdlT}` },
  ];
}

function lipidStripSvg(
  points: LipidTrendPoint[],
  def: LipidStripDef,
  stripIdx: number,
  innerW: number,
): string {
  const values: number[] = [];
  points.forEach((p) => {
    const v = p[def.key];
    if (v != null && Number.isFinite(v)) values.push(v);
  });
  if (values.length < 2) return '';

  const n = points.length;
  const dom = stripDomain(values, def.mode, def.threshold);
  const stripBlockTop = PAD_TOP + stripIdx * STRIP_UNIT;
  const stripTop = stripBlockTop + TITLE_H;
  const plotH = STRIP_H - LABEL_RESERVE;

  const pts: Array<{ x: number; y: number; value: number }> = [];
  points.forEach((p, i) => {
    const v = p[def.key];
    if (v == null || !Number.isFinite(v)) return;
    pts.push({
      x: xAtIndex(i, n, innerW),
      y: yMap(v, dom.min, dom.max, stripTop, plotH),
      value: v,
    });
  });

  const path = smoothPath(pts);
  const safe = safeBandRect(dom, def.mode, def.threshold, stripTop, plotH);
  const safeSvg = safe
    ? `<rect x="${PAD_L}" y="${safe.y.toFixed(1)}" width="${innerW}" height="${safe.h.toFixed(1)}" fill="${SAFE_FILL}" />`
    : '';

  const grid = yTicks(dom.min, dom.max)
    .map((v) => {
      const gy = yMap(v, dom.min, dom.max, stripTop, plotH);
      return `<line x1="${PAD_L}" y1="${gy.toFixed(1)}" x2="${PAD_L + innerW}" y2="${gy.toFixed(1)}" stroke="#eef2f6" stroke-width="1" opacity="0.5"/>
  <text x="${PAD_L - 4}" y="${(gy + 3).toFixed(1)}" text-anchor="end" direction="ltr" font-family="system-ui,sans-serif" font-size="8" fill="#888">${v}</text>`;
    })
    .join('\n');

  const titleY = stripBlockTop + 14;
  const divider =
    stripIdx > 0
      ? `<line x1="0" y1="${stripBlockTop.toFixed(1)}" x2="${W}" y2="${stripBlockTop.toFixed(1)}" stroke="#e8edf2" stroke-width="1"/>`
      : '';
  const plotFrame = `<rect x="${PAD_L}" y="${stripTop.toFixed(1)}" width="${innerW}" height="${plotH}" fill="#fafbfc" rx="4"/>`;
  const titleRule = `<line x1="${PAD_L}" y1="${stripTop.toFixed(1)}" x2="${PAD_L + innerW}" y2="${stripTop.toFixed(1)}" stroke="#e8edf2" stroke-width="1"/>`;

  const dots = pts
    .map(
      (p) =>
        `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${def.color}" stroke="#fff" stroke-width="1.5"/>`,
    )
    .join('\n');

  const valueLabels = pts
    .map((p) => {
      const label = formatLabValue(p.value);
      const w = Math.max(24, label.length * 5.4 + 8);
      const lx = clampLabelCenter(p.x, w, W);
      const ly = p.y + 14;
      return `<rect x="${(lx - w / 2).toFixed(1)}" y="${(ly - 9).toFixed(1)}" width="${w.toFixed(1)}" height="13" rx="3" fill="#fff" stroke="${def.color}" stroke-width="0.75"/>
  <text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" font-weight="600" fill="${def.color}">${label}</text>`;
    })
    .join('\n');

  return `<g>
  ${divider}
  <text x="8" y="${titleY.toFixed(1)}" text-anchor="start" font-family="system-ui,sans-serif" font-size="11" font-weight="800" fill="${def.color}">${esc(def.label)}</text>
  <text x="56" y="${titleY.toFixed(1)}" text-anchor="start" font-family="system-ui,sans-serif" font-size="9" font-weight="500" fill="#666">${esc(`${def.thresholdLabel} mg/dL`)}</text>
  ${titleRule}
  ${plotFrame}
  ${safeSvg}
  ${grid}
  ${path ? `<path d="${path}" fill="none" stroke="${def.color}" stroke-width="2.2"/>` : ''}
  ${dots}
  ${valueLabels}
  </g>`;
}

export function buildLipidTrendChartSvg(
  points: LipidTrendPoint[],
  gender: Gender | null,
  lang?: UserLanguage | null,
): string | null {
  if (points.length < 2) return null;
  const L = chartLabels(lang);
  const innerW = W - PAD_L - PAD_R;
  const stripDefs = buildLipidStripDefs(gender);
  const strips: string[] = [];
  let stripIdx = 0;
  for (const def of stripDefs) {
    const svg = lipidStripSvg(points, def, stripIdx, innerW);
    if (!svg) continue;
    strips.push(svg);
    stripIdx += 1;
  }
  if (strips.length === 0) return null;
  const innerH = stripIdx * STRIP_UNIT;
  const axisY = PAD_TOP + innerH;
  const ticks = pickTicks(points.length);
  const axis = ticks
    .map((i) => {
      const x = xAtIndex(i, points.length, innerW);
      return `<text x="${x.toFixed(1)}" y="${axisY + 14}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#666">${esc(axisDateLabel(points[i].dateKey))}</text>`;
    })
    .join('');
  const disclaimer =
    lang?.code === 'he'
      ? '<text x="' + PAD_L + '" y="' + (axisY + 28) + '" font-family="system-ui,sans-serif" font-size="8" fill="#888">טווחי יעד לבוגרים — לא ייעוץ רפואי. הערכים על הנקודות.</text>'
      : '<text x="' + PAD_L + '" y="' + (axisY + 28) + '" font-family="system-ui,sans-serif" font-size="8" fill="#888">General adult targets — not medical advice. Values shown on dots.</text>';
  return wrapSvg(L.lipids, innerH + 14, `${strips.join('')}${axis}${disclaimer}`);
}

export function buildBodyTrendChartSvg(
  days: MetabolicTrend7dDay[],
  lang?: UserLanguage | null,
): string | null {
  const L = chartLabels(lang);
  if (days.length < 2) return null;
  const innerW = W - PAD_L - PAD_R;
  const w = days.map((d) => d.weightKg);
  const f = days.map((d) => d.fatMassKg);
  const m = days.map((d) => d.muscleMassKg);
  if (!w.some((v) => v != null) && !f.some((v) => v != null) && !m.some((v) => v != null)) return null;
  const strips = [
    renderStrip({ title: L.weight, color: '#37474F', values: w, labels: days.map((d) => d.dayKey), stripTop: PAD_TOP + TITLE_H, innerW }),
    renderStrip({ title: L.fat, color: '#C62828', values: f, labels: days.map((d) => d.dayKey), stripTop: PAD_TOP + TITLE_H + STRIP_H + 6, innerW }),
    renderStrip({ title: L.muscle, color: '#2E7D32', values: m, labels: days.map((d) => d.dayKey), stripTop: PAD_TOP + TITLE_H + 2 * (STRIP_H + 6), innerW }),
  ].filter(Boolean);
  if (strips.length === 0) return null;
  const innerH = 3 * (STRIP_H + 6) + TITLE_H;
  const axisY = PAD_TOP + innerH;
  const ticks = pickTicks(days.length);
  const axis = ticks
    .map((i) => {
      const x = xAt(i, days.length, innerW);
      return `<text x="${x.toFixed(1)}" y="${axisY + 14}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#666">${esc(axisDateLabel(days[i].dayKey))}</text>`;
    })
    .join('');
  return wrapSvg(L.body, innerH, `${strips.join('')}${axis}`);
}

export function buildEnergyChartSvg(
  dayKeys: string[],
  eatenByDay: Map<string, number>,
  burnByDay: Map<string, number>,
  lang?: UserLanguage | null,
): string | null {
  const L = chartLabels(lang);
  const eaten = dayKeys.map((dk) => {
    const v = eatenByDay.get(dk);
    return v != null && v > 0 ? v : null;
  });
  const burn = dayKeys.map((dk) => {
    const v = burnByDay.get(dk);
    return v != null && v > 0 ? v : null;
  });
  if (!eaten.some((v) => v != null) && !burn.some((v) => v != null)) return null;

  const innerW = W - PAD_L - PAD_R;
  const innerH = STRIP_H + TITLE_H + 20;
  const stripTop = PAD_TOP + TITLE_H;
  const plotH = STRIP_H;
  const all = [...eaten, ...burn].filter((v): v is number => v != null);
  const dom = domain(all);

  const series = (vals: (number | null)[], color: string, dashed: boolean) => {
    const pts: Pt[] = [];
    vals.forEach((v, i) => {
      if (v == null) return;
      pts.push({ x: xAt(i, dayKeys.length, innerW), y: yMap(v, dom.min, dom.max, stripTop, plotH) });
    });
    if (pts.length === 0) return '';
    const path = smoothPath(pts);
    const dots = pts.map((p) => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}"/>`).join('');
    return `${path ? `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2"${dashed ? ' stroke-dasharray="6 4"' : ''}/>` : ''}${dots}`;
  };

  const axisY = PAD_TOP + innerH;
  const ticks = pickTicks(dayKeys.length);
  const axis = ticks
    .map((i) => {
      const x = xAt(i, dayKeys.length, innerW);
      return `<text x="${x.toFixed(1)}" y="${axisY + 14}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#666">${esc(axisDateLabel(dayKeys[i]))}</text>`;
    })
    .join('');
  const yMid = yMap((dom.min + dom.max) / 2, dom.min, dom.max, stripTop, plotH);
  const grid = `<line x1="${PAD_L}" y1="${yMid.toFixed(1)}" x2="${PAD_L + innerW}" y2="${yMid.toFixed(1)}" stroke="#eef2f6" stroke-width="1"/>`;
  const legend = `<text x="${PAD_L}" y="${PAD_TOP + 6}" font-family="system-ui,sans-serif" font-size="10" fill="#FF9800">● ${esc(L.eaten)}</text>
  <text x="${PAD_L + 72}" y="${PAD_TOP + 6}" font-family="system-ui,sans-serif" font-size="10" fill="#42A5F5">● ${esc(L.burn)}</text>`;

  return wrapSvg(
    L.energy,
    innerH,
    `${legend}${grid}${series(eaten, '#FF9800', false)}${series(burn, '#42A5F5', true)}${axis}`,
  );
}

function glucoseOnDayKey(glucose: TimePoint[], dayKey: string): number[] {
  return glucose
    .filter((p) => localDayKeyFromMs(new Date(p.timestamp).getTime()) === dayKey)
    .map((p) => p.value)
    .filter((v) => Number.isFinite(v) && v > 0);
}

export function buildDailyGlucoseChartSvg(
  dayKeys: string[],
  glucose: TimePoint[],
  lang?: UserLanguage | null,
): string | null {
  const L = chartLabels(lang);
  const avgs = dayKeys.map((dk) => {
    const vals = glucoseOnDayKey(glucose, dk);
    if (vals.length === 0) return null;
    return vals.reduce((a, b) => a + b, 0) / vals.length;
  });
  if (!avgs.some((v) => v != null)) return null;
  const innerW = W - PAD_L - PAD_R;
  const stripTop = PAD_TOP + TITLE_H;
  const innerH = STRIP_H + TITLE_H;
  const finiteAvgs = avgs.filter((v): v is number => v != null);
  let domMin = Math.min(...finiteAvgs);
  let domMax = Math.max(...finiteAvgs);
  domMin = Math.min(domMin, 70);
  domMax = Math.max(domMax, 100);
  if (domMin === domMax) {
    domMin -= 5;
    domMax += 5;
  }
  const pad = (domMax - domMin) * 0.1;
  const dom = { min: domMin - pad, max: domMax + pad };
  const plotH = STRIP_H;
  const safeTop = yMap(100, dom.min, dom.max, stripTop, plotH);
  const safeBot = yMap(70, dom.min, dom.max, stripTop, plotH);
  const body = renderStrip({
    title: 'CGM avg',
    color: '#2E7D5A',
    values: avgs,
    labels: dayKeys,
    stripTop,
    innerW,
    fixedDom: dom,
    safeY: Math.min(safeTop, safeBot),
    safeH: Math.abs(safeBot - safeTop),
  });
  const axisY = PAD_TOP + innerH;
  const ticks = pickTicks(dayKeys.length);
  const axis = ticks
    .map((i) => {
      const x = xAt(i, dayKeys.length, innerW);
      return `<text x="${x.toFixed(1)}" y="${axisY + 14}" text-anchor="middle" font-family="system-ui,sans-serif" font-size="9" fill="#666">${esc(axisDateLabel(dayKeys[i]))}</text>`;
    })
    .join('');
  return wrapSvg(L.glucose, innerH, `${body}${axis}`);
}

export function buildVisitReportCharts(input: {
  dayCount: number;
  dayKeys: string[];
  lipidPoints: LipidTrendPoint[];
  gender: Gender | null;
  bodyTrendDays: MetabolicTrend7dDay[];
  eatenByDay: Map<string, number>;
  burnByDay: Map<string, number>;
  glucose: TimePoint[];
  lang?: UserLanguage | null;
}): { title: string; intro: string; charts: VisitReportChart[] } {
  const L = chartLabels(input.lang);
  const windowSet = new Set(input.dayKeys);
  const bodyDays = input.bodyTrendDays.filter((d) => windowSet.has(d.dayKey));
  const charts: VisitReportChart[] = [];

  const lipidSvg = buildLipidTrendChartSvg(input.lipidPoints, input.gender, input.lang);
  if (lipidSvg) charts.push({ id: 'lipids', title: L.lipids, svg: lipidSvg });

  const bodySvg = buildBodyTrendChartSvg(bodyDays, input.lang);
  if (bodySvg) charts.push({ id: 'body', title: L.body, svg: bodySvg });

  const energySvg = buildEnergyChartSvg(input.dayKeys, input.eatenByDay, input.burnByDay, input.lang);
  if (energySvg) charts.push({ id: 'energy', title: L.energy, svg: energySvg });

  const glucoseSvg = buildDailyGlucoseChartSvg(input.dayKeys, input.glucose, input.lang);
  if (glucoseSvg) charts.push({ id: 'glucose', title: L.glucose, svg: glucoseSvg });

  return { title: L.chartsTitle, intro: L.chartsIntro, charts };
}

export { chartLabels as visitReportChartLabels };
