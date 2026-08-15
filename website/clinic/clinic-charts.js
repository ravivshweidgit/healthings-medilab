/**
 * Clinic dashboard charts — mirrors phone MetabolicChart, trend, energy, lipids.
 */
(function (global) {
  const BUCKET_MS = 30 * 60 * 1000;
  const MS_DAY = 86400000;

  /** Chart colours from CSS vars (clinic-theme / workspace) so Appearance flips SVG too. */
  function cssVar(name, fallback) {
    try {
      const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      return v || fallback;
    } catch {
      return fallback;
    }
  }

  /** Opaque plot+scale backdrop (dark → black; light → transparent over card). */
  function plotBackdrop(w, h, fill) {
    if (!fill || fill === 'transparent') return '';
    return `<rect x="0" y="0" width="${w}" height="${h}" fill="${fill}"/>`;
  }

  function chartPalette() {
    return {
      plotBg: cssVar('--ws-chart-plot-bg', 'transparent'),
      glucose: cssVar('--ws-chart-glucose', '#4CAF50'),
      hr: cssVar('--ws-chart-hr', '#FF5252'),
      bmr: cssVar('--ws-chart-bmr', '#90CAF9'),
      steps: cssVar('--ws-chart-steps', '#42A5F5'),
      workout: cssVar('--ws-chart-workout', '#1565C0'),
      eaten: cssVar('--ws-chart-eaten', '#FF9800'),
      total: cssVar('--ws-chart-total', '#4CAF50'),
      balance: cssVar('--ws-chart-balance', '#37474F'),
      fat: cssVar('--ws-chart-fat', '#FF5252'),
      muscle: cssVar('--ws-chart-muscle', '#4CAF50'),
      weight: cssVar('--ws-chart-weight', '#2196F3'),
      visceral: cssVar('--ws-chart-visceral', '#7B1FA2'),
      ldl: cssVar('--ws-chart-ldl', '#C62828'),
      tg: cssVar('--ws-chart-tg', '#FF9800'),
      hdl: cssVar('--ws-chart-hdl', '#2E7D32'),
      totalChol: cssVar('--ws-chart-total-chol', '#1565C0'),
      grid: cssVar('--ws-chart-grid', '#e8eaed'),
      muted: cssVar('--ws-chart-muted', '#6b7280'),
      glucoseBand: cssVar('--ws-chart-glucose-band', '#E3F2FD'),
      surplusZone: cssVar('--ws-chart-surplus-zone', '#FFEBEE'),
      deficitZone: cssVar('--ws-chart-deficit-zone', '#E8F5E9'),
      deficitDot: cssVar('--ws-chart-deficit-dot', '#2E7D32'),
      surplusDot: cssVar('--ws-chart-surplus-dot', '#C62828'),
      meal: cssVar('--ws-chart-meal', '#FF9800'),
      axis: cssVar('--ws-chart-axis', '#7c7c7c'),
    };
  }
  // Sub-6H chips are phone CGM-watching; clinic case review starts at 6H (be-28).
  const VIEWPORT_PRESETS = [
    { label: '6H', ms: 6 * 3600000 },
    { label: '12H', ms: 12 * 3600000 },
    { label: '24H', ms: MS_DAY },
    { label: '2D', ms: 2 * MS_DAY },
    { label: '4D', ms: 4 * MS_DAY },
    { label: '8D', ms: 8 * MS_DAY },
    { label: '16D', ms: 16 * MS_DAY },
    { label: '32D', ms: 32 * MS_DAY },
  ];
  const DEFAULT_VIEWPORT_INDEX = 2; // 24H
  const CHARTS_ROW_HEIGHT = 520;
  const MAX_ACTIVITY_KCAL_DAY = 5000;

  function t(key, vars) {
    if (global.ClinicI18n?.t) return global.ClinicI18n.t(key, vars);
    return key;
  }

  function smoothPath(points) {
    if (points.length < 2) return '';
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) d += ` L ${points[i].x} ${points[i].y}`;
    return d;
  }

  function dayKeyFromMs(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Vendor-supplied text (workout names) is interpolated into SVG markup. */
  function escapeXml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Half a rendered label's width in SVG units, including a breathing gap. */
  function labelHalfWidth(text, fontSize) {
    return (String(text).length * fontSize * 0.55) / 2 + 3;
  }

  /**
   * Keep the labels that fit on one baseline, biggest kcal first, and drop any that
   * would overprint a label already placed. Returns them in left-to-right order.
   * Dropped labels lose only text — the bar or ▼ they annotate stays drawn, and
   * zooming in frees the room to bring them back.
   */
  function placeLabelsInLane(candidates, fontSize) {
    const placed = [];
    for (const c of [...candidates].sort((a, b) => b.kcal - a.kcal)) {
      const halfW = labelHalfWidth(c.label, fontSize);
      const clashes = placed.some(
        (p) => Math.abs(p.x - c.x) < halfW + labelHalfWidth(p.label, fontSize),
      );
      if (!clashes) placed.push(c);
    }
    return placed.sort((a, b) => a.x - b.x);
  }

  /** Round tick step (1H → 6H → 12H → whole days) targeting ~7 ticks across the window. */
  function computeTimeTickStepMs(spanMs) {
    const H = 3600000;
    const step = spanMs / 7;
    if (step <= H) return H;
    if (step <= 6 * H) return 6 * H;
    if (step <= 12 * H) return 12 * H;
    if (step <= MS_DAY) return MS_DAY;
    return Math.ceil(step / MS_DAY) * MS_DAY;
  }

  function computeBurnByDay(withings) {
    const fallbackBmr = withings?.bodyScan?.bmrKcalDay;
    const trend = withings?.bodyTrendDays || [];
    const calories = withings?.calories || [];
    const workouts = withings?.workouts || [];
    const bmrByDay = new Map();
    const activityByDay = new Map();
    for (const d of trend) {
      if (d.bmrKcalDay != null) bmrByDay.set(d.dayKey, d.bmrKcalDay);
      else if (d.activityKcalDay != null && d.bmrKcalDay == null && fallbackBmr) bmrByDay.set(d.dayKey, fallbackBmr);
      if (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay)) {
        activityByDay.set(d.dayKey, d.activityKcalDay);
      }
    }
    const passiveByDay = new Map();
    for (const pt of calories) {
      const ms = Date.parse(pt.timestamp);
      if (!Number.isFinite(ms)) continue;
      const dk = dayKeyFromMs(ms);
      if (!passiveByDay.has(dk)) passiveByDay.set(dk, new Map());
      const bk = Math.floor(ms / BUCKET_MS) * BUCKET_MS;
      const m = passiveByDay.get(dk);
      m.set(bk, (m.get(bk) || 0) + (pt.kcal || 0));
    }
    const workoutKcalByDay = new Map();
    const workoutBucketsByDay = new Map();
    for (const w of workouts) {
      const dk = dayKeyFromMs(w.startMs);
      workoutKcalByDay.set(dk, (workoutKcalByDay.get(dk) || 0) + (w.kcal || 0));
      if (!workoutBucketsByDay.has(dk)) workoutBucketsByDay.set(dk, new Set());
      const set = workoutBucketsByDay.get(dk);
      const firstBk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS;
      for (let bk = firstBk; bk < w.endMs; bk += BUCKET_MS) set.add(bk);
    }
    const keys = new Set([
      dayKeyFromMs(Date.now()),
      ...bmrByDay.keys(),
      ...activityByDay.keys(),
      ...passiveByDay.keys(),
      ...workoutKcalByDay.keys(),
    ]);
    const result = {};
    for (const dk of keys) {
      const bmr = bmrByDay.get(dk) ?? fallbackBmr;
      if (!bmr) continue;
      const wktBuckets = workoutBucketsByDay.get(dk) || new Set();
      let passive = 0;
      for (const [bk, kcal] of passiveByDay.get(dk) || []) {
        if (!wktBuckets.has(bk)) passive += kcal;
      }
      const fromSeries = passive + (workoutKcalByDay.get(dk) || 0);
      // Phone Food Log: burned = BMR + activityKcalDay when the trend carries activity.
      const trendAct = activityByDay.get(dk);
      const activity =
        trendAct != null && Number.isFinite(trendAct)
          ? Math.round(trendAct)
          : Math.round(fromSeries);
      result[dk] = Math.round(bmr + activity);
    }
    return result;
  }

  function eatenByDay(meals) {
    const m = {};
    for (const meal of meals) {
      const dk = meal.day || dayKeyFromMs(meal.timestamp);
      m[dk] = (m[dk] || 0) + (meal.totalKcal || 0);
    }
    return m;
  }

  function lipidResultBlob(r) {
    return `${r.code || ''} ${r.name || ''} ${r.nameOriginal || ''}`.toUpperCase();
  }

  function isNonHdlResult(r) {
    return /NON[_\s-]?HDL/i.test(lipidResultBlob(r));
  }

  function isLdlResult(r) {
    if (isNonHdlResult(r)) return false;
    return /CHOLESTEROL.?LDL|LDL.?CHOL|\bLDL\b/i.test(lipidResultBlob(r));
  }

  function isHdlResult(r) {
    if (isNonHdlResult(r)) return false;
    const b = lipidResultBlob(r);
    if (/RATIO|\/|יחס/i.test(b)) return false;
    const code = (r.code || '').toUpperCase();
    if (code === 'CHOLESTEROL_HDL' || /^CHOLESTEROL[_-]HDL$/i.test(code)) return true;
    return /CHOLESTEROL.?HDL|\bHDL\b/i.test(b);
  }

  function isTotalCholResult(r) {
    if (isNonHdlResult(r)) return false;
    const b = lipidResultBlob(r);
    return /\bCHOLESTEROL\b/i.test(b) && !/LDL|HDL|NON/i.test(b);
  }

  function isTriglycerideResult(r) {
    return /TRIGLYCERID|\bTG\b/i.test(lipidResultBlob(r));
  }

  function scanLipids(report) {
    let ldl = null;
    let hdl = null;
    let totalCholesterol = null;
    let triglycerides = null;
    for (const panel of report.panels || []) {
      for (const r of panel.results || []) {
        if (ldl == null && isLdlResult(r)) ldl = r.value;
        if (hdl == null && isHdlResult(r)) hdl = r.value;
        if (totalCholesterol == null && isTotalCholResult(r)) totalCholesterol = r.value;
        if (triglycerides == null && isTriglycerideResult(r)) triglycerides = r.value;
      }
    }
    return { ldl, hdl, totalCholesterol, triglycerides };
  }

  function buildLipidPoints(labs) {
    return labs
      .slice()
      .sort((a, b) => (a.collectedAt || '').localeCompare(b.collectedAt || ''))
      .map((report) => {
        const lip = scanLipids(report);
        if (lip.ldl == null && lip.totalCholesterol == null && lip.hdl == null && lip.triglycerides == null) return null;
        const dateKey = (report.collectedAt || '').slice(0, 10);
        return { dateKey, date: dateKey, ...lip };
      })
      .filter(Boolean);
  }

  const LIPID_PAD_L = 36;
  const LIPID_PAD_R = 12;
  const LIPID_X_INSET = 26;
  const LIPID_PAD_TOP = 4;
  const LIPID_TITLE_H = 18;
  /** Doubled vs phone (88) — clinic/account have more vertical room (prompt101 follow-up). */
  const LIPID_STRIP_H = 176;
  const LIPID_STRIP_UNIT = LIPID_TITLE_H + LIPID_STRIP_H;
  const LIPID_LABEL_RESERVE = 24;
  const LIPID_PLOT_H = LIPID_STRIP_H - LIPID_LABEL_RESERVE;
  const LIPID_AXIS_BOTTOM = 28;
  function lipidTheme() {
    const pal = chartPalette();
    return {
      safeFill: pal.hdl,
      safeOpacity: '0.16',
      grid: pal.grid,
      muted: pal.muted,
      total: pal.totalChol,
      ldl: pal.ldl,
      tg: pal.tg,
      hdl: pal.hdl,
    };
  }

  function hdlSafeThreshold(gender) {
    return gender === 'female' ? 50 : 40;
  }

  function buildLipidStripDefs(gender) {
    const hdlT = hdlSafeThreshold(gender);
    const lt = lipidTheme();
    return [
      { key: 'totalCholesterol', label: 'TOTAL', color: lt.total, mode: 'below', threshold: 200, thresholdLabel: '<200' },
      { key: 'ldl', label: 'LDL', color: lt.ldl, mode: 'below', threshold: 100, thresholdLabel: '<100' },
      { key: 'triglycerides', label: 'TG', color: lt.tg, mode: 'below', threshold: 150, thresholdLabel: '<150' },
      { key: 'hdl', label: 'HDL', color: lt.hdl, mode: 'above', threshold: hdlT, thresholdLabel: `≥${hdlT}` },
    ];
  }

  function lipidAxisDateLabel(dateKey) {
    const parts = dateKey.split('-').map(Number);
    if (parts.length !== 3 || parts.some((v) => !Number.isFinite(v))) return dateKey;
    const [y, mo, da] = parts;
    return new Date(y, mo - 1, da).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function lipidPickTickIndices(n, maxTicks) {
    if (n <= 1) return [0];
    if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
    const out = new Set();
    const step = (n - 1) / (maxTicks - 1);
    for (let k = 0; k < maxTicks; k++) out.add(Math.round(k * step));
    out.add(n - 1);
    return Array.from(out).sort((a, b) => a - b);
  }

  function lipidXAtIndex(i, plotLeft, innerW, n) {
    const plotInner = Math.max(1, innerW - LIPID_X_INSET * 2);
    return plotLeft + LIPID_X_INSET + (i / Math.max(1, n - 1)) * plotInner;
  }

  function lipidClampLabelCenter(x, pillW, svgW) {
    const half = pillW / 2 + 2;
    return Math.min(svgW - half, Math.max(half, x));
  }

  function lipidMapY(v, vMin, vMax, top, height) {
    const span = Math.max(1e-6, vMax - vMin);
    return top + (1 - (v - vMin) / span) * height;
  }

  function lipidStripDomain(values, mode, threshold) {
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (mode === 'below') {
      hi = Math.max(hi, threshold);
      lo = Math.min(lo, 0);
    } else {
      lo = Math.min(lo, Math.max(0, threshold - 15));
      hi = Math.max(hi, threshold + 15);
    }
    if (lo === hi) { lo -= 8; hi += 8; }
    const pad = (hi - lo) * 0.1;
    return { min: Math.max(0, lo - pad), max: hi + pad };
  }

  function lipidYTicks(min, max) {
    return [max, (min + max) / 2, min].map((v) => Math.round(v));
  }

  function formatLabValue(v) {
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  }

  function lipidSafeBandRect(dom, mode, threshold, stripTop) {
    if (threshold < dom.min || threshold > dom.max) return null;
    const yThreshold = lipidMapY(threshold, dom.min, dom.max, stripTop, LIPID_PLOT_H);
    const yBottom = lipidMapY(dom.min, dom.min, dom.max, stripTop, LIPID_PLOT_H);
    const yTop = lipidMapY(dom.max, dom.min, dom.max, stripTop, LIPID_PLOT_H);
    if (mode === 'below') {
      const h = yBottom - yThreshold;
      return h > 1 ? { y: yThreshold, h } : null;
    }
    const h = yThreshold - yTop;
    return h > 1 ? { y: yTop, h } : null;
  }

  /** Phone: activityKcalDay from Withings, else sum workouts for that day only. */
  function enrichBodyTrendDays(withings) {
    const days = (withings?.bodyTrendDays || []).map((d) => ({ ...d }));
    const workoutByDay = new Map();
    for (const w of withings?.workouts || []) {
      const dk = dayKeyFromMs(w.startMs);
      workoutByDay.set(dk, (workoutByDay.get(dk) || 0) + (w.kcal || 0));
    }
    return days.map((d) => {
      if (d.activityKcalDay != null && Number.isFinite(d.activityKcalDay)) {
        if (d.activityKcalDay > MAX_ACTIVITY_KCAL_DAY) return { ...d, activityKcalDay: null };
        return d;
      }
      const wkt = workoutByDay.get(d.dayKey);
      if (wkt != null && wkt > 0) return { ...d, activityKcalDay: Math.round(wkt) };
      return d;
    });
  }

  function positiveBmrKcal(v) {
    return v != null && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
  }

  /**
   * Phone ManualTrendService.fillcale gaps: carry last measured BMR (or seed from
   * body scan) across days so total burn + balance exist wherever activity/meals do.
   */
  function fillBmrGaps(days, opts) {
    const list = days || [];
    let last = positiveBmrKcal(opts?.seedBmrKcal);
    if (last == null) {
      for (const d of list) {
        const bmr = positiveBmrKcal(d.bmrKcalDay);
        if (bmr != null) {
          last = bmr;
          break;
        }
      }
    }
    if (last == null) return list;
    return list.map((d) => {
      const measured = positiveBmrKcal(d.bmrKcalDay);
      if (measured != null) {
        last = measured;
        return { ...d, bmrKcalDay: measured };
      }
      return { ...d, bmrKcalDay: last };
    });
  }

  function chartActivityKcal(d) {
    const v = d.activityKcalDay;
    if (v == null || !Number.isFinite(v) || v <= 0 || v > MAX_ACTIVITY_KCAL_DAY) return null;
    return v;
  }

  /**
   * Time only unless the tick *step* is a day or more. Testing the whole window span
   * instead printed "26 Jul" on every tick of a 24H view.
   */
  function formatMetabolicAxisLabel(ms, stepMs) {
    if (stepMs >= MS_DAY * 0.9) {
      return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }
    return new Date(ms).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  }

  function drawMetabolicChart(host, data, ctx, onChange) {
    const pal = chartPalette();
    const GLUCOSE_GREEN = pal.glucose;
    const HR_RED = pal.hr;
    const CAL_BMR = pal.bmr;
    const CAL_STEPS = pal.steps;
    const CAL_WORKOUT = pal.workout;
    const MEAL_ORANGE = pal.meal;
    const vpIdx = ctx.chartVp ?? DEFAULT_VIEWPORT_INDEX;
    const preset = VIEWPORT_PRESETS[vpIdx] || VIEWPORT_PRESETS[DEFAULT_VIEWPORT_INDEX];
    const chartEnd = ctx.chartEndMs ?? Date.now();
    const t1 = chartEnd;
    const t0 = t1 - preset.ms;

    const glucose = (data.glucose || []).filter((p) => {
      const ms = Date.parse(p.timestamp);
      return ms >= t0 && ms <= t1;
    });
    const heartRate = (data.withings?.heartRate || []).filter((p) => {
      const ms = Date.parse(p.timestamp);
      return ms >= t0 && ms <= t1;
    }).map((p) => ({ timestamp: p.timestamp, value: p.bpm || p.value || 0 }));

    const calories = (data.withings?.calories || []).filter((p) => {
      const ms = Date.parse(p.timestamp);
      return ms >= t0 && ms <= t1;
    });
    const workouts = (data.withings?.workouts || []).filter((w) => w.endMs >= t0 && w.startMs <= t1);
    const chartMeals = (data.meals || []).filter((m) => m.timestamp >= t0 && m.timestamp <= t1);
    const bmrDay = data.withings?.bodyScan?.bmrKcalDay;
    const bmrPerSlot = bmrDay > 0 ? bmrDay / 48 : null;

    const W = Math.max(320, host.clientWidth || 900);
    // Desktop has vertical room the phone does not; a 273px plot squeezed the whole
    // 40–180 mg/dL range into a letterbox and flattened every excursion.
    const plotH = 340;
    const axisH = 30;
    const H = plotH + axisH;
    const padL = 36;
    const padR = 8;
    const padT = 12;
    const padB = 8;
    const calH = 42;
    // Workout names and meal kcal each own a baseline just above the calorie strip,
    // so neither collides with the other and both sit next to what they annotate.
    const workoutLaneH = 12;
    const mealLaneH = 22;
    const labelLaneH = workoutLaneH + mealLaneH;
    const dataH = plotH - padT - padB - calH - labelLaneH;
    const innerW = W - padL - padR;

    let yMin = 50;
    let yMax = 175;
    const vals = [...glucose, ...heartRate].map((p) => p.value).filter((v) => v > 0);
    if (vals.length) {
      const lo = Math.min(...vals);
      const hi = Math.max(...vals);
      if (hi + 10 > yMax) yMax = Math.ceil((hi + 10) / 10) * 10;
      if (lo - 10 < yMin) yMin = Math.floor((lo - 10) / 10) * 10;
    }

    const xOf = (t) => padL + ((t - t0) / (t1 - t0)) * innerW;
    const yOf = (v) => padT + dataH - ((v - yMin) / (yMax - yMin)) * dataH;
    const calStripTop = padT + dataH + labelLaneH;
    const calStripBottom = calStripTop + calH;
    const mealTriangleY = calStripTop - 4;
    const mealLabelY = calStripTop - 14;
    const workoutLabelY = calStripTop - mealLaneH - 4;

    const passiveMap = new Map();
    for (const c of calories) {
      const ms = Date.parse(c.timestamp);
      const bk = Math.floor(ms / BUCKET_MS) * BUCKET_MS;
      passiveMap.set(bk, (passiveMap.get(bk) || 0) + (c.kcal || 0));
    }
    const workoutMap = new Map();
    for (const w of workouts) {
      const dur = Math.max(1, w.endMs - w.startMs);
      const kpm = w.kcal / dur;
      for (let bk = Math.floor(w.startMs / BUCKET_MS) * BUCKET_MS; bk < w.endMs; bk += BUCKET_MS) {
        const oStart = Math.max(bk, w.startMs);
        const oEnd = Math.min(bk + BUCKET_MS, w.endMs);
        workoutMap.set(bk, (workoutMap.get(bk) || 0) + kpm * (oEnd - oStart));
      }
    }
    const workoutBuckets = new Set(workoutMap.keys());

    let calYMax = 150;
    for (let b = Math.floor(t0 / BUCKET_MS) * BUCKET_MS; b <= t1; b += BUCKET_MS) {
      const passive = workoutBuckets.has(b) ? 0 : (passiveMap.get(b) || 0);
      const wkt = workoutMap.get(b) || 0;
      const bmr = bmrPerSlot || 0;
      calYMax = Math.max(calYMax, bmr + passive + wkt);
    }
    calYMax = Math.min(200, Math.ceil(calYMax * 1.15));

    let svg = `<svg class="metabolic-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}" direction="ltr">`;
    svg += plotBackdrop(W, H, pal.plotBg);
    svg += `<rect x="${padL}" y="${calStripTop}" width="${innerW}" height="${calH}" fill="${pal.glucoseBand}" opacity="0.7"/>`;
    svg += `<rect x="${padL}" y="${yOf(100)}" width="${innerW}" height="${Math.max(0, yOf(70) - yOf(100))}" fill="${pal.glucose}" opacity="0.16"/>`;

    for (let v = Math.ceil(yMin / 10) * 10; v <= yMax; v += 10) {
      const y = yOf(v);
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="${pal.grid}"/>`;
      if (v % 20 === 0) svg += `<text x="4" y="${y + 4}" font-size="9" fill="${pal.axis}">${v}</text>`;
    }
    svg += `<line x1="${padL}" y1="${calStripTop}" x2="${W - padR}" y2="${calStripTop}" stroke="${pal.grid}"/>`;

    const barW = Math.max(2, innerW / Math.max(1, preset.ms / BUCKET_MS) * 0.85);
    for (let b = Math.floor(t0 / BUCKET_MS) * BUCKET_MS; b <= t1; b += BUCKET_MS) {
      const passive = workoutBuckets.has(b) ? 0 : (passiveMap.get(b) || 0);
      const wkt = workoutMap.get(b) || 0;
      const bmr = bmrPerSlot || 0;
      const x = xOf(b) - barW / 2;
      let yBase = calStripBottom;
      if (bmr > 0) {
        const h = (bmr / calYMax) * calH;
        yBase -= h;
        svg += `<rect x="${x}" y="${yBase}" width="${barW}" height="${h}" fill="${CAL_BMR}" opacity="0.72" rx="1"/>`;
      }
      if (passive > 0) {
        const h = (passive / calYMax) * calH;
        yBase -= h;
        svg += `<rect x="${x}" y="${yBase}" width="${barW}" height="${h}" fill="${CAL_STEPS}" opacity="0.9" rx="1"/>`;
      }
      if (wkt > 0) {
        const h = (wkt / calYMax) * calH;
        yBase -= h;
        svg += `<rect x="${x}" y="${yBase}" width="${barW}" height="${h}" fill="${CAL_WORKOUT}" opacity="0.88" rx="1"/>`;
      }
    }

    const gPts = glucose.map((p) => ({ x: xOf(Date.parse(p.timestamp)), y: yOf(p.value) }));
    const hPts = heartRate.map((p) => ({ x: xOf(Date.parse(p.timestamp)), y: yOf(p.value) }));
    if (hPts.length > 1) svg += `<path d="${smoothPath(hPts)}" fill="none" stroke="${HR_RED}" stroke-width="2" opacity="0.95"/>`;
    if (gPts.length > 1) svg += `<path d="${smoothPath(gPts)}" fill="none" stroke="${GLUCOSE_GREEN}" stroke-width="2.2"/>`;

    const mealLabels = placeLabelsInLane(
      chartMeals
        .filter((m) => m.totalKcal)
        .map((m) => ({ x: xOf(m.timestamp), label: String(Math.round(m.totalKcal)), kcal: m.totalKcal })),
      9,
    );
    for (const m of chartMeals) {
      const x = xOf(m.timestamp);
      svg += `<text x="${x}" y="${mealTriangleY}" fill="${MEAL_ORANGE}" font-size="9" text-anchor="middle">▼</text>`;
    }
    for (const lbl of mealLabels) {
      svg += `<text x="${lbl.x}" y="${mealLabelY}" fill="${MEAL_ORANGE}" font-size="9" text-anchor="middle">${escapeXml(lbl.label)}</text>`;
    }

    const workoutLabels = placeLabelsInLane(
      workouts
        .filter((w) => w.kcal > 0)
        .map((w) => {
          const label = w.activityLabel
            ? t('wsWorkoutLabelKcal', { name: w.activityLabel, n: Math.round(w.kcal) })
            : `${t('wsWorkoutFallback')} ${Math.round(w.kcal)} kcal`;
          const halfW = labelHalfWidth(label, 8);
          const mid = xOf((Math.max(w.startMs, t0) + Math.min(w.endMs, t1)) / 2);
          // A session at either edge would otherwise run its name off the canvas.
          const x = Math.min(Math.max(mid, padL + halfW), W - padR - halfW);
          return { x, label, kcal: w.kcal };
        }),
      8,
    );
    for (const lbl of workoutLabels) {
      svg += `<text x="${lbl.x}" y="${workoutLabelY}" fill="${CAL_WORKOUT}" font-size="8" font-weight="600" text-anchor="middle">${escapeXml(lbl.label)}</text>`;
    }

    const tickStepMs = computeTimeTickStepMs(preset.ms);
    let labelRightEdge = -Infinity;
    for (let t = Math.ceil(t0 / tickStepMs) * tickStepMs, i = 0; t <= t1 && i < 32; t += tickStepMs, i += 1) {
      const x = xOf(t);
      if (x < padL - 1 || x > W - padR + 1) continue;
      svg += `<line x1="${x}" y1="${plotH - 8}" x2="${x}" y2="${plotH - 2}" stroke="${pal.muted}" stroke-width="1"/>`;
      const lbl = formatMetabolicAxisLabel(t, tickStepMs);
      const halfW = labelHalfWidth(lbl, 9);
      // Tick marks all stay; only the text thins out, so dropped ones read as minor gridlines.
      if (x - halfW < labelRightEdge) continue;
      labelRightEdge = x + halfW;
      svg += `<text x="${x}" y="${H - 6}" font-size="9" fill="${pal.axis}" text-anchor="middle">${lbl}</text>`;
    }
    svg += '</svg>';

    const dateLabel = preset.ms >= MS_DAY
      ? `${new Date(t0).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} – ${new Date(t1).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`
      : new Date(t0).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const chips = VIEWPORT_PRESETS.map((p, i) =>
      `<button type="button" class="chip${i === vpIdx ? ' active' : ''}" data-vp="${i}">${p.label}</button>`,
    ).join('');
    const bmrLbl = bmrDay ? ` (${t('wsLegendBmrWithSlot', { n: Math.round(bmrDay / 48) })})` : '';

    host.innerHTML = `
      <div class="chart-toolbar">
        <div class="chip-row metabolic-chips">${chips}</div>
        <div class="date-nav">
          <button type="button" class="nav-arrow" data-shift="-1" aria-label="${escapeXml(t('wsChartEarlierAria'))}">‹</button>
          <span class="date-label">${dateLabel}</span>
          <button type="button" class="nav-arrow" data-shift="1" aria-label="${escapeXml(t('wsChartLaterAria'))}">›</button>
        </div>
      </div>
      <div class="chart-wrap">${svg}</div>
      <div class="chart-legend">
        <span class="leg glucose">${escapeXml(t('wsLegendGlucose'))}</span>
        <span class="leg hr">${escapeXml(t('wsLegendHeartRate'))}</span>
        <span class="leg bmr">${escapeXml(t('wsLegendBmr'))}${bmrLbl}</span>
        <span class="leg steps">${escapeXml(t('wsLegendStepsCal'))}</span>
        <span class="leg workout">${escapeXml(t('wsLegendWorkout'))}</span>
      </div>`;

    host.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.chartVp = parseInt(btn.getAttribute('data-vp'), 10);
        onChange();
      });
    });
    host.querySelectorAll('.nav-arrow').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shift = parseInt(btn.getAttribute('data-shift'), 10);
        ctx.chartEndMs = (ctx.chartEndMs ?? Date.now()) + shift * preset.ms;
        if (ctx.chartEndMs > Date.now()) ctx.chartEndMs = Date.now();
        onChange();
      });
    });
  }

  const TREND_PERIOD_OPTIONS = [8, 16, 32, 64, 128];
  const DEFAULT_TREND_PERIOD = 32;
  const TREND_PAD_L = 36;
  const TREND_PAD_R = 10;
  const TREND_PAD_TOP = 4;
  const TREND_STRIP_H = 46;
  const TREND_STRIP_GAP = 5;
  /** Caption band above each strip (WEIGHT / FAT-MUSCLE / VISCERAL). */
  const TREND_TITLE_H = 11;
  const TREND_AXIS_BOTTOM = 22;
  const DELTA_FALLBACK_HALF_SPAN_KG = 0.5;

  function isCompositionDay(d) {
    return d.fatMassKg != null && d.muscleMassKg != null
      && Number.isFinite(d.fatMassKg) && Number.isFinite(d.muscleMassKg);
  }

  function compositionDayIndices(days) {
    const out = [];
    days.forEach((d, i) => { if (isCompositionDay(d)) out.push(i); });
    return out;
  }

  function withingsChartCompositionKg(days, dayIndex, field) {
    const compIdx = compositionDayIndices(days);
    const rank = compIdx.indexOf(dayIndex);
    if (rank < 0) return null;
    if (rank === 0 && compIdx.length >= 2) {
      const second = days[compIdx[1]][field];
      return second != null && Number.isFinite(second) ? second : null;
    }
    const v = days[dayIndex][field];
    return v != null && Number.isFinite(v) ? v : null;
  }

  function visceralDayIndices(days) {
    const out = [];
    days.forEach((d, i) => {
      if (d.visceralFatIndex != null && Number.isFinite(d.visceralFatIndex)) out.push(i);
    });
    return out;
  }

  function withingsChartVisceralIndex(days, dayIndex) {
    const vIdx = visceralDayIndices(days);
    const rank = vIdx.indexOf(dayIndex);
    if (rank < 0) return null;
    if (rank === 0 && vIdx.length >= 2) {
      const second = days[vIdx[1]].visceralFatIndex;
      return second != null && Number.isFinite(second) ? second : null;
    }
    const v = days[dayIndex].visceralFatIndex;
    return v != null && Number.isFinite(v) ? v : null;
  }

  function bmrDayIndices(days) {
    const out = [];
    days.forEach((d, i) => {
      if (d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay)) out.push(i);
    });
    return out;
  }

  function withingsChartBmrKcal(days, dayIndex) {
    const bmrIdx = bmrDayIndices(days);
    const rank = bmrIdx.indexOf(dayIndex);
    if (rank < 0) return null;
    if (rank === 0 && bmrIdx.length >= 2) {
      const second = days[bmrIdx[1]].bmrKcalDay;
      return second != null && Number.isFinite(second) ? second : null;
    }
    const v = days[dayIndex].bmrKcalDay;
    return v != null && Number.isFinite(v) ? v : null;
  }

  function resolveBmrWeekTrend(days) {
    const idx = bmrDayIndices(days);
    if (!idx.length) return { deltaKcal: null };
    const endIdx = idx[idx.length - 1];
    const startIdx = idx.length >= 2 ? idx[1] : idx[0];
    const start = days[startIdx].bmrKcalDay;
    const end = days[endIdx].bmrKcalDay;
    if (start == null || end == null) return { deltaKcal: null };
    return { deltaKcal: end - start };
  }

  function yTicks(min, max) {
    const mid = (min + max) / 2;
    return [max, mid, min].map(Math.round);
  }

  function balanceDomain(values) {
    const dom = domainPad(values.length > 0 ? values : [-200, 200], -400, 400, 0.12);
    dom.min = Math.min(dom.min, 0);
    dom.max = Math.max(dom.max, 0);
    return dom;
  }

  function avgRounded(values) {
    if (!values.length) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }

  function stripAvgLabel(avg) {
    if (avg == null) return '';
    return ` (avg ${avg.toLocaleString()} kcal)`;
  }

  function dayKeyStartMs(dayKey) {
    const parts = dayKey.split('-').map(Number);
    if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) return NaN;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function compositionSessionsPerDayInWindow(sessions, windowDayKeys) {
    if (!windowDayKeys.length) return [];
    const windowStart = dayKeyStartMs(windowDayKeys[0]);
    const windowEndExclusive = dayKeyStartMs(windowDayKeys[windowDayKeys.length - 1]) + 86400000;
    if (!Number.isFinite(windowStart)) return [];
    const inWindow = (sessions || []).filter((s) => s.dateMs >= windowStart && s.dateMs < windowEndExclusive);
    const latestByDay = new Map();
    for (const s of inWindow) {
      const prev = latestByDay.get(s.dayKey);
      if (!prev || s.dateMs >= prev.dateMs) latestByDay.set(s.dayKey, s);
    }
    const ordered = [];
    for (const dk of windowDayKeys) {
      const s = latestByDay.get(dk);
      if (s) ordered.push(s);
    }
    return ordered;
  }

  function resolveCompositionPeriodAnchor(sessions, windowDayKeys) {
    const perDay = compositionSessionsPerDayInWindow(sessions, windowDayKeys);
    if (!perDay.length) return null;
    const end = perDay[perDay.length - 1];
    const start = perDay.length >= 2 ? perDay[1] : perDay[0];
    return { start, end };
  }

  function resolveAnchorFromDays(days) {
    const comp = days.filter(isCompositionDay);
    if (!comp.length) return null;
    const end = comp[comp.length - 1];
    const start = comp.length >= 2 ? comp[1] : comp[0];
    const toSession = (d) => ({
      dateMs: dayKeyStartMs(d.dayKey),
      dayKey: d.dayKey,
      weightKg: d.weightKg ?? 0,
      fatMassKg: d.fatMassKg ?? 0,
      muscleMassKg: d.muscleMassKg ?? 0,
      visceralFatIndex: d.visceralFatIndex,
    });
    return { start: toSession(start), end: toSession(end) };
  }

  function periodAnchorBaselines(anchor) {
    if (!anchor) return null;
    return { fatKg: anchor.start.fatMassKg, muscleKg: anchor.start.muscleMassKg };
  }

  function periodAnchorDeltas(anchor) {
    if (!anchor) return null;
    return {
      fatKg: anchor.end.fatMassKg - anchor.start.fatMassKg,
      muscleKg: anchor.end.muscleMassKg - anchor.start.muscleMassKg,
    };
  }

  function resolveVisceralWeekTrend(days) {
    const idx = visceralDayIndices(days);
    if (!idx.length) return { deltaIndex: null, baselineIndex: null };
    const endIdx = idx[idx.length - 1];
    const startIdx = idx.length >= 2 ? idx[1] : idx[0];
    const start = days[startIdx].visceralFatIndex;
    const end = days[endIdx].visceralFatIndex;
    if (start == null || end == null) return { deltaIndex: null, baselineIndex: null };
    return { deltaIndex: end - start, baselineIndex: start };
  }

  function visceralPercentChange(deltaIndex, baselineIndex) {
    if (!Number.isFinite(deltaIndex) || !Number.isFinite(baselineIndex) || baselineIndex === 0) return null;
    return (deltaIndex / baselineIndex) * 100;
  }

  function domainPad(values, fallbackMin, fallbackMax, padRatio) {
    const finite = values.filter((v) => Number.isFinite(v));
    if (!finite.length) return { min: fallbackMin, max: fallbackMax };
    let lo = Math.min(...finite);
    let hi = Math.max(...finite);
    if (lo === hi) { lo -= 0.5; hi += 0.5; }
    const pad = (hi - lo) * padRatio;
    return { min: lo - pad, max: hi + pad };
  }

  function mapY(v, vMin, vMax, top, height) {
    const span = Math.max(1e-6, vMax - vMin);
    return top + (1 - (v - vMin) / span) * height;
  }

  function deltaDomainFromValues(deltas) {
    const dom = domainPad(deltas, -DELTA_FALLBACK_HALF_SPAN_KG, DELTA_FALLBACK_HALF_SPAN_KG, 0.15);
    if (!deltas.length) return dom;
    if (dom.max <= 0) return { min: dom.min, max: 0 };
    if (dom.min >= 0) return { min: 0, max: dom.max };
    return dom;
  }

  function formatDeltaTick(v) {
    if (Math.abs(v) < 0.05) return '0';
    return `${v > 0 ? '+' : ''}${v.toFixed(1)}`;
  }

  function axisDayLabel(dayKey, n) {
    const parts = dayKey.split('-').map(Number);
    if (parts.length !== 3) return dayKey;
    const d = new Date(parts[0], parts[1] - 1, parts[2]);
    if (n <= 8) return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  }

  function pickTickIndices(n, maxTicks) {
    if (n <= 1) return [0];
    if (n <= maxTicks) return Array.from({ length: n }, (_, i) => i);
    const out = new Set();
    const step = (n - 1) / (maxTicks - 1);
    for (let k = 0; k < maxTicks; k += 1) out.add(Math.round(k * step));
    out.add(n - 1);
    return Array.from(out).sort((a, b) => a - b);
  }

  function xAtIndex(i, plotLeft, innerW, n) {
    return plotLeft + (i / Math.max(1, n - 1)) * innerW;
  }

  function legendDeltaKg(name, delta) {
    if (delta == null || !Number.isFinite(delta)) return name;
    return `${name} (${delta > 0 ? '+' : ''}${delta.toFixed(1)} kg)`;
  }

  function legendVisceral(name, trend) {
    const { deltaIndex, baselineIndex } = trend;
    if (deltaIndex == null || !Number.isFinite(deltaIndex)) return name;
    if (baselineIndex != null) {
      const pct = visceralPercentChange(deltaIndex, baselineIndex);
      if (pct != null) return `${name} (${pct > 0 ? '+' : ''}${pct.toFixed(1)}%)`;
    }
    return `${name} (${deltaIndex > 0 ? '+' : ''}${deltaIndex.toFixed(2)})`;
  }

  function resolveStripHeight(numStrips, minStripH, chromeH) {
    const available = CHARTS_ROW_HEIGHT - chromeH;
    if (available < numStrips * minStripH) return minStripH;
    return Math.floor(available / numStrips);
  }

  function trendWindowSlice(allDays, periodDays) {
    const days = allDays || [];
    const period = periodDays || DEFAULT_TREND_PERIOD;
    return days.slice(-Math.min(period, days.length));
  }

  function drawTrendAnalysis(host, allDays, sessions, periodDays, availableDays, onPeriodChange, opts) {
    const pal = chartPalette();
    const TREND_BLUE = pal.weight;
    const TREND_GREEN = pal.muscle;
    const TREND_FAT = pal.fat;
    const TREND_VISCERAL = pal.visceral;
    const TREND_GRID = pal.grid;
    const TREND_MUTED = pal.muted;
    const fill = opts?.fillHeight !== false;
    const stripH = fill
      ? resolveStripHeight(3, TREND_STRIP_H, 175 + 3 * TREND_TITLE_H)
      : TREND_STRIP_H * (opts?.tall ? 2 : 1);
    const stripTopAt = (index) =>
      TREND_PAD_TOP + TREND_TITLE_H + index * (stripH + TREND_STRIP_GAP + TREND_TITLE_H);
    const period = periodDays || DEFAULT_TREND_PERIOD;
    const avail = availableDays ?? (allDays || []).length;
    const slice = trendWindowSlice(allDays, period);
    if (slice.length < 2) {
      host.innerHTML = `
        <div class="trend-wrap">
          <div class="trend-title">${escapeXml(t('wsTrendTitle'))}</div>
          <p class="empty">${escapeXml(t('wsTrendEmpty'))}</p>
        </div>`;
      return;
    }

    const windowDayKeys = slice.map((d) => d.dayKey);
    const anchor = resolveCompositionPeriodAnchor(sessions, windowDayKeys)
      || resolveAnchorFromDays(slice);
    const compBase = periodAnchorBaselines(anchor);
    const fatBaseline = compBase?.fatKg ?? null;
    const muscleBaseline = compBase?.muscleKg ?? null;

    const W = Math.max(320, host.clientWidth || 800);
    const plotLeft = TREND_PAD_L;
    const innerW = Math.max(1, W - plotLeft - TREND_PAD_R);
    const n = slice.length;
    const plotBottom = stripTopAt(2) + stripH;
    const svgH = plotBottom + TREND_AXIS_BOTTOM;

    const wVals = slice.map((d) => d.weightKg).filter((v) => v != null && Number.isFinite(v));
    const vVals = slice.map((_, i) => withingsChartVisceralIndex(slice, i)).filter((v) => v != null);
    const wDom = domainPad(wVals, 76, 82, 0.08);
    const vDom = domainPad(vVals, 3.5, 4.5, 0.12);

    const compositionDeltas = [];
    if (compBase && fatBaseline != null && muscleBaseline != null) {
      slice.forEach((_, i) => {
        const f = withingsChartCompositionKg(slice, i, 'fatMassKg');
        const m = withingsChartCompositionKg(slice, i, 'muscleMassKg');
        if (f != null && fatBaseline != null) compositionDeltas.push(f - fatBaseline);
        if (m != null && muscleBaseline != null) compositionDeltas.push(m - muscleBaseline);
      });
    }
    const deltaDom = deltaDomainFromValues(compositionDeltas);
    const zeroLineY = mapY(0, deltaDom.min, deltaDom.max, stripTopAt(1), stripH);

    function mkPts(getter, dom, stripIndex) {
      const top = stripTopAt(stripIndex);
      const pts = [];
      slice.forEach((d, i) => {
        const v = getter(d, i);
        if (v != null && Number.isFinite(v)) {
          pts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: mapY(v, dom.min, dom.max, top, stripH) });
        }
      });
      return pts;
    }

    function mkDeltaPts(getter, baseline, stripIndex) {
      const top = stripTopAt(stripIndex);
      const pts = [];
      slice.forEach((_, i) => {
        if (!compBase || baseline == null) return;
        const raw = getter(i);
        if (raw == null) return;
        const v = raw - baseline;
        pts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: mapY(v, deltaDom.min, deltaDom.max, top, stripH) });
      });
      return pts;
    }

    const wPts = mkPts((d) => d.weightKg, wDom, 0);
    const fPts = mkDeltaPts((i) => withingsChartCompositionKg(slice, i, 'fatMassKg'), fatBaseline, 1);
    const mPts = mkDeltaPts((i) => withingsChartCompositionKg(slice, i, 'muscleMassKg'), muscleBaseline, 1);
    const vPts = mkPts((_, i) => withingsChartVisceralIndex(slice, i), vDom, 2);

    function mkGrid(dom, stripIndex, labelFn, labelColor, opacity) {
      const top = stripTopAt(stripIndex);
      return [dom.min, (dom.min + dom.max) / 2, dom.max].map((v) => ({
        y: mapY(v, dom.min, dom.max, top, stripH),
        label: labelFn(v),
        color: labelColor,
        opacity: opacity ?? 0.5,
      }));
    }

    const gridW = mkGrid(wDom, 0, (v) => v.toFixed(1), TREND_BLUE, 0.88);
    const gridFM = mkGrid(deltaDom, 1, formatDeltaTick, TREND_MUTED, 0.5);
    const gridV = mkGrid(vDom, 2, (v) => v.toFixed(1), TREND_VISCERAL, 0.5);

    const tickIdx = new Set(pickTickIndices(n, 7));
    const xTicks = slice
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ d, i }) => ({
        x: xAtIndex(i, plotLeft, innerW, n),
        label: axisDayLabel(d.dayKey, n),
      }));

    const anchorDeltas = periodAnchorDeltas(anchor);
    const weightWeekDelta = anchor ? anchor.end.weightKg - anchor.start.weightKg : null;
    const visceralWeekTrend = resolveVisceralWeekTrend(slice);

    let svg = `<svg class="trend-svg" viewBox="0 0 ${W} ${svgH}" width="100%" height="${svgH}" direction="ltr">`;
    svg += plotBackdrop(W, svgH, pal.plotBg);
    // Three unrelated scales share one 36px gutter. Without a caption per band the
    // numbers read as a single collapsing column and no one can tell kg from Δkg.
    for (const s of [
      { i: 0, label: t('wsTrendStripWeight'), color: TREND_BLUE },
      { i: 1, label: t('wsTrendStripFatMuscle'), color: TREND_MUTED },
      { i: 2, label: t('wsTrendStripVisceral'), color: TREND_VISCERAL },
    ]) {
      const bandTop = stripTopAt(s.i) - TREND_TITLE_H;
      svg += `<line x1="${plotLeft}" y1="${bandTop}" x2="${W - TREND_PAD_R}" y2="${bandTop}" stroke="${TREND_GRID}" stroke-width="1" opacity="0.6"/>`;
      svg += `<text x="${plotLeft + 2}" y="${bandTop + 9}" font-size="8" font-weight="700" fill="${s.color}">${s.label}</text>`;
    }
    for (const g of [...gridW, ...gridFM, ...gridV]) {
      svg += `<line x1="${plotLeft}" y1="${g.y}" x2="${W - TREND_PAD_R}" y2="${g.y}" stroke="${TREND_GRID}" stroke-width="1" opacity="${g.opacity}"/>`;
    }
    svg += `<line x1="${plotLeft}" y1="${zeroLineY}" x2="${W - TREND_PAD_R}" y2="${zeroLineY}" stroke="${TREND_MUTED}" stroke-width="1" opacity="0.35"/>`;
    for (const g of gridW) {
      svg += `<text x="4" y="${g.y + 3}" font-size="8" font-weight="600" fill="${TREND_BLUE}">${g.label}</text>`;
    }
    for (const g of gridFM) {
      svg += `<text x="4" y="${g.y + 3}" font-size="8" font-weight="600" fill="${TREND_MUTED}">${g.label}</text>`;
    }
    for (const g of gridV) {
      svg += `<text x="4" y="${g.y + 3}" font-size="8" font-weight="600" fill="${TREND_VISCERAL}">${g.label}</text>`;
    }
    if (wPts.length > 1) svg += `<path d="${smoothPath(wPts)}" fill="none" stroke="${TREND_BLUE}" stroke-width="2.2"/>`;
    if (fPts.length > 1) svg += `<path d="${smoothPath(fPts)}" fill="none" stroke="${TREND_FAT}" stroke-width="2.1"/>`;
    if (mPts.length > 1) svg += `<path d="${smoothPath(mPts)}" fill="none" stroke="${TREND_GREEN}" stroke-width="2.1"/>`;
    if (vPts.length > 1) {
      svg += `<path d="${smoothPath(vPts)}" fill="none" stroke="${TREND_VISCERAL}" stroke-width="2" stroke-dasharray="6 4"/>`;
    }
    svg += `<line x1="${plotLeft}" y1="${plotBottom}" x2="${W - TREND_PAD_R}" y2="${plotBottom}" stroke="${TREND_GRID}" stroke-width="1"/>`;
    for (const tk of xTicks) {
      svg += `<text x="${tk.x}" y="${svgH - 8}" font-size="9" fill="${TREND_MUTED}" text-anchor="middle">${tk.label}</text>`;
    }
    svg += '</svg>';

    const periodChips = TREND_PERIOD_OPTIONS.map((opt) => {
      const selected = opt === period;
      const disabled = avail > 0 && opt > avail;
      return `<button type="button" class="chip trend-chip${selected ? ' active' : ''}${disabled ? ' disabled' : ''}" data-period="${opt}" ${disabled ? 'disabled' : ''}>${opt}D</button>`;
    }).join('');

    host.innerHTML = `
      <div class="trend-wrap">
        <div class="trend-title">${escapeXml(t('wsTrendTitle'))}</div>
        <div class="chip-row trend-chips">${periodChips}</div>
        <div class="chart-wrap">${svg}</div>
        <div class="trend-legend">
          <div class="trend-legend-row">
            <span class="trend-leg"><i style="background:${TREND_BLUE}"></i>${legendDeltaKg(t('wsLegendWeight'), weightWeekDelta)}</span>
            <span class="trend-leg"><i style="background:${TREND_FAT}"></i>${legendDeltaKg(t('wsLegendFat'), anchorDeltas?.fatKg)}</span>
          </div>
          <div class="trend-legend-row">
            <span class="trend-leg"><i style="background:${TREND_GREEN}"></i>${legendDeltaKg(t('wsLegendMuscle'), anchorDeltas?.muscleKg)}</span>
            <span class="trend-leg"><i style="background:${TREND_VISCERAL}"></i>${legendVisceral(t('wsLegendVisceral'), visceralWeekTrend)}</span>
          </div>
        </div>
      </div>`;

    host.querySelectorAll('[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (btn.disabled) return;
        const p = parseInt(btn.getAttribute('data-period'), 10);
        if (onPeriodChange) onPeriodChange(p);
      });
    });
  }

  function drawEnergyChart(host, days, eatenByDay, opts) {
    const pal = chartPalette();
    const fill = opts?.fillHeight !== false;
    const ENERGY_BASE_STRIP_H = 58;
    const ENERGY_STRIP_H = fill
      ? resolveStripHeight(5, ENERGY_BASE_STRIP_H, 95)
      : ENERGY_BASE_STRIP_H * (opts?.tall ? 2 : 1);
    const ENERGY_PAD_L = 44;
    const ENERGY_PAD_R = 10;
    const ENERGY_PAD_TOP = 6;
    const ENERGY_TITLE_H = 15;
    const ENERGY_STRIP_UNIT = ENERGY_TITLE_H + ENERGY_STRIP_H;
    const ENERGY_AXIS_BOTTOM = 24;
    const ENERGY_NUM_STRIPS = 5;
    const COLOR_BMR = cssVar('--text', '#1A1A1A');
    const COLOR_ACTIVITY = pal.steps;
    const COLOR_TOTAL = pal.total;
    const COLOR_EATEN = pal.eaten;
    const COLOR_BALANCE_LINE = pal.balance;
    const COLOR_DEFICIT_ZONE = pal.deficitZone;
    const COLOR_SURPLUS_ZONE = pal.surplusZone;
    const COLOR_DEFICIT_DOT = pal.deficitDot;
    const COLOR_SURPLUS_DOT = pal.surplusDot;
    const COLOR_GRID = pal.grid;
    const TREND_MUTED = pal.muted;

    const todayKey = dayKeyFromMs(Date.now());
    const slice = fillBmrGaps(days || [], { seedBmrKcal: opts?.fallbackBmrKcal })
      .map((d) => (d.dayKey > todayKey ? { ...d, bmrKcalDay: null } : d));
    if (slice.length < 2) {
      host.innerHTML = `
        <div class="energy-wrap">
          <div class="energy-title">${escapeXml(t('wsEnergyTitle'))}</div>
          <p class="empty">${escapeXml(t('wsEnergyEmpty'))}</p>
        </div>`;
      return;
    }

    const W = Math.max(280, host.clientWidth || 400);
    const n = slice.length;
    const plotLeft = ENERGY_PAD_L;
    const innerW = Math.max(1, W - plotLeft - ENERGY_PAD_R);
    const svgH = ENERGY_PAD_TOP + ENERGY_NUM_STRIPS * ENERGY_STRIP_UNIT + ENERGY_AXIS_BOTTOM;

    const bmrVals = [];
    const actVals = [];
    const totalVals = [];
    const eatenVals = [];
    const balanceVals = [];

    slice.forEach((d, i) => {
      const bmr = withingsChartBmrKcal(slice, i);
      const act = chartActivityKcal(d);
      const eaten = eatenByDay?.[d.dayKey] ?? 0;
      const chartBurn = bmr != null && act != null ? bmr + act : null;
      if (bmr != null) bmrVals.push(bmr);
      if (act != null && act > 0) actVals.push(act);
      if (chartBurn != null) totalVals.push(chartBurn);
      if (eaten > 0) eatenVals.push(eaten);
      if (chartBurn != null && eaten > 0) balanceVals.push(eaten - chartBurn);
    });

    const bmrDom = domainPad(bmrVals, 1600, 2400, 0.06);
    const actDom = domainPad(actVals, 0, 500, 0.06);
    actDom.min = 0;
    const totDom = domainPad(totalVals, 1800, 2800, 0.06);
    const eatenDom = domainPad(eatenVals, 1200, 2200, 0.06);
    eatenDom.min = 0;
    const balDom = balanceDomain(balanceVals);

    const stripDataTop = (idx) => ENERGY_PAD_TOP + idx * ENERGY_STRIP_UNIT + ENERGY_TITLE_H;
    const myBmr = (v) => mapY(v, bmrDom.min, bmrDom.max, stripDataTop(0), ENERGY_STRIP_H);
    const myAct = (v) => mapY(v, actDom.min, actDom.max, stripDataTop(1), ENERGY_STRIP_H);
    const myTotal = (v) => mapY(v, totDom.min, totDom.max, stripDataTop(2), ENERGY_STRIP_H);
    const myEaten = (v) => mapY(v, eatenDom.min, eatenDom.max, stripDataTop(3), ENERGY_STRIP_H);
    const myBalance = (v) => mapY(v, balDom.min, balDom.max, stripDataTop(4), ENERGY_STRIP_H);

    function mkLinePts(getter) {
      const pts = [];
      slice.forEach((d, i) => {
        const v = getter(d, i);
        if (v != null && Number.isFinite(v)) {
          pts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: v });
        }
      });
      return pts;
    }

    const bmrPts = mkLinePts((_, i) => {
      const v = withingsChartBmrKcal(slice, i);
      return v != null ? myBmr(v) : null;
    });
    const actPts = mkLinePts((d) => {
      const act = chartActivityKcal(d);
      return act != null ? myAct(act) : null;
    });
    const totalPts = mkLinePts((d, i) => {
      const bmr = withingsChartBmrKcal(slice, i);
      const act = chartActivityKcal(d);
      return bmr != null && act != null ? myTotal(bmr + act) : null;
    });
    const eatenPts = mkLinePts((d) => {
      const eaten = eatenByDay?.[d.dayKey] ?? 0;
      return eaten > 0 ? myEaten(eaten) : null;
    });
    const balancePts = mkLinePts((d, i) => {
      const bmr = withingsChartBmrKcal(slice, i);
      const act = chartActivityKcal(d);
      const chartBurn = bmr != null && act != null ? bmr + act : null;
      const eaten = eatenByDay?.[d.dayKey] ?? 0;
      return chartBurn != null && eaten > 0 ? myBalance(eaten - chartBurn) : null;
    });

    const balanceDots = [];
    slice.forEach((d, i) => {
      const bmr = withingsChartBmrKcal(slice, i);
      const act = chartActivityKcal(d);
      const chartBurn = bmr != null && act != null ? bmr + act : null;
      const eaten = eatenByDay?.[d.dayKey] ?? 0;
      if (chartBurn != null && eaten > 0) {
        const value = eaten - chartBurn;
        balanceDots.push({
          x: xAtIndex(i, plotLeft, innerW, n),
          y: myBalance(value),
          value,
        });
      }
    });

    function renderStripGrid(dom, stripIdx) {
      let out = '';
      for (const v of yTicks(dom.min, dom.max)) {
        const y = mapY(v, dom.min, dom.max, stripDataTop(stripIdx), ENERGY_STRIP_H);
        out += `<line x1="${plotLeft}" y1="${y}" x2="${W - ENERGY_PAD_R}" y2="${y}" stroke="${COLOR_GRID}" stroke-width="1" opacity="0.5"/>`;
        out += `<text x="3" y="${y + 3}" font-size="8" fill="${TREND_MUTED}">${v}</text>`;
      }
      return out;
    }

    const balanceStripTop = stripDataTop(4);
    const balanceStripBottom = balanceStripTop + ENERGY_STRIP_H;
    const balanceZeroY = myBalance(0);
    const surplusZoneH = Math.max(0, balanceZeroY - balanceStripTop);
    const deficitZoneH = Math.max(0, balanceStripBottom - balanceZeroY);

    const tickIdx = new Set(pickTickIndices(n, 7));
    const xAxisY = ENERGY_PAD_TOP + ENERGY_NUM_STRIPS * ENERGY_STRIP_UNIT;
    const xTicks = slice
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ d, i }) => ({
        x: xAtIndex(i, plotLeft, innerW, n),
        label: axisDayLabel(d.dayKey, n),
      }));

    const weekDelta = resolveBmrWeekTrend(slice).deltaKcal;
    const avgBmr = avgRounded(bmrVals);
    const avgActivity = avgRounded(actVals);
    const avgTotalBurn = avgRounded(totalVals);
    const avgEaten = avgRounded(eatenVals);
    const avgBalance = avgRounded(balanceVals);

    let svg = `<svg class="energy-svg" viewBox="0 0 ${W} ${svgH}" width="100%" height="${svgH}" direction="ltr">`;
    svg += plotBackdrop(W, svgH, pal.plotBg);

    for (let div = 0; div < ENERGY_NUM_STRIPS; div += 1) {
      const y = ENERGY_PAD_TOP + div * ENERGY_STRIP_UNIT;
      svg += `<line x1="${plotLeft}" y1="${y}" x2="${W - ENERGY_PAD_R}" y2="${y}" stroke="${COLOR_GRID}" stroke-width="1" opacity="0.6"/>`;
    }

    svg += `<text x="${plotLeft + 4}" y="${ENERGY_PAD_TOP + 11}" font-size="9" font-weight="700" fill="${COLOR_BMR}">${escapeXml(t('wsEnergyStripBmr'))}${stripAvgLabel(avgBmr)}${weekDelta != null ? ` · Δ${weekDelta >= 0 ? '+' : ''}${Math.round(weekDelta)} kcal` : ''}</text>`;
    svg += renderStripGrid(bmrDom, 0);
    if (bmrPts.length > 1) svg += `<path d="${smoothPath(bmrPts)}" fill="none" stroke="${COLOR_BMR}" stroke-width="2.2"/>`;

    svg += `<text x="${plotLeft + 4}" y="${ENERGY_PAD_TOP + ENERGY_STRIP_UNIT + 11}" font-size="9" font-weight="700" fill="${COLOR_ACTIVITY}">${escapeXml(t('wsEnergyStripActivity'))}${stripAvgLabel(avgActivity)}</text>`;
    svg += renderStripGrid(actDom, 1);
    if (actPts.length > 1) svg += `<path d="${smoothPath(actPts)}" fill="none" stroke="${COLOR_ACTIVITY}" stroke-width="2.2"/>`;

    svg += `<text x="${plotLeft + 4}" y="${ENERGY_PAD_TOP + 2 * ENERGY_STRIP_UNIT + 11}" font-size="9" font-weight="700" fill="${COLOR_TOTAL}">${escapeXml(t('wsEnergyStripTotalBurn'))}${stripAvgLabel(avgTotalBurn)}</text>`;
    svg += renderStripGrid(totDom, 2);
    if (totalPts.length > 1) svg += `<path d="${smoothPath(totalPts)}" fill="none" stroke="${COLOR_TOTAL}" stroke-width="2.2"/>`;

    svg += `<text x="${plotLeft + 4}" y="${ENERGY_PAD_TOP + 3 * ENERGY_STRIP_UNIT + 11}" font-size="9" font-weight="700" fill="${COLOR_EATEN}">${escapeXml(t('wsEnergyStripEaten'))}${stripAvgLabel(avgEaten)}</text>`;
    svg += renderStripGrid(eatenDom, 3);
    if (eatenPts.length > 1) svg += `<path d="${smoothPath(eatenPts)}" fill="none" stroke="${COLOR_EATEN}" stroke-width="2.2"/>`;

    svg += `<text x="${plotLeft + 4}" y="${ENERGY_PAD_TOP + 4 * ENERGY_STRIP_UNIT + 11}" font-size="9" font-weight="700" fill="${COLOR_BALANCE_LINE}">${escapeXml(t('wsEnergyStripBalance'))}${avgBalance != null ? ` (avg ${avgBalance >= 0 ? '+' : ''}${avgBalance.toLocaleString()} kcal)` : ''}</text>`;
    if (surplusZoneH > 12) {
      svg += `<rect x="${plotLeft}" y="${balanceStripTop}" width="${innerW}" height="${surplusZoneH}" fill="${COLOR_SURPLUS_ZONE}" opacity="0.95"/>`;
    }
    if (deficitZoneH > 12) {
      svg += `<rect x="${plotLeft}" y="${balanceZeroY}" width="${innerW}" height="${deficitZoneH}" fill="${COLOR_DEFICIT_ZONE}" opacity="0.95"/>`;
    }
    svg += `<line x1="${plotLeft}" y1="${balanceZeroY}" x2="${W - ENERGY_PAD_R}" y2="${balanceZeroY}" stroke="${COLOR_BALANCE_LINE}" stroke-width="1.2" opacity="0.45"/>`;
    svg += renderStripGrid(balDom, 4);
    if (balancePts.length > 1) svg += `<path d="${smoothPath(balancePts)}" fill="none" stroke="${COLOR_BALANCE_LINE}" stroke-width="2.4"/>`;
    for (const dot of balanceDots) {
      const fill = dot.value < 0 ? COLOR_DEFICIT_DOT : dot.value > 0 ? COLOR_SURPLUS_DOT : COLOR_BALANCE_LINE;
      svg += `<circle cx="${dot.x}" cy="${dot.y}" r="4" fill="${fill}" stroke="${cssVar('--surface', '#fff')}" stroke-width="1.5"/>`;
    }

    svg += `<line x1="${plotLeft}" y1="${xAxisY}" x2="${W - ENERGY_PAD_R}" y2="${xAxisY}" stroke="${COLOR_GRID}" stroke-width="1" opacity="0.8"/>`;
    for (const tk of xTicks) {
      svg += `<text x="${tk.x}" y="${svgH - 6}" font-size="9" fill="${TREND_MUTED}" text-anchor="middle">${tk.label}</text>`;
    }
    svg += '</svg>';

    host.innerHTML = `
      <div class="energy-wrap">
        <div class="energy-title">${escapeXml(t('wsEnergyTitle'))}</div>
        ${opts?.periodDays ? `<div class="energy-subtitle">${escapeXml(t('wsEnergySubtitle', { n: opts.periodDays }))}</div>` : ''}
        <div class="chart-wrap">${svg}</div>
      </div>`;
  }

  function drawLipidChart(host, labs, opts) {
    const lt = lipidTheme();
    const LIPID_SAFE_FILL = lt.safeFill;
    const LIPID_SAFE_OPACITY = lt.safeOpacity;
    const LIPID_GRID = lt.grid;
    const LIPID_MUTED = lt.muted;
    const gender = opts?.gender || null;
    const rtl = !!opts?.rtl;
    const pts = buildLipidPoints(labs);
    if (pts.length < 2) {
      host.innerHTML = `<p class="empty">${escapeXml(t('wsLipidEmptyNeedTwo'))}</p>`;
      return;
    }

    const chartW = Math.min(600, Math.max(280, host.clientWidth || 640));
    const stripDefs = buildLipidStripDefs(gender);
    const n = pts.length;
    const plotLeft = LIPID_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - LIPID_PAD_R);
    const chartRight = chartW - LIPID_PAD_R;

    const visible = [];
    let stripIdx = 0;
    for (const def of stripDefs) {
      const values = [];
      pts.forEach((p) => {
        const v = p[def.key];
        if (v != null && Number.isFinite(v)) values.push(v);
      });
      if (values.length < 2) continue;

      const dom = lipidStripDomain(values, def.mode, def.threshold);
      const stripTop = LIPID_PAD_TOP + stripIdx * LIPID_STRIP_UNIT + LIPID_TITLE_H;
      const plotPts = [];
      pts.forEach((p, i) => {
        const v = p[def.key];
        if (v == null || !Number.isFinite(v)) return;
        plotPts.push({
          x: lipidXAtIndex(i, plotLeft, innerW, n),
          y: lipidMapY(v, dom.min, dom.max, stripTop, LIPID_PLOT_H),
          value: v,
          dataIndex: i,
        });
      });

      visible.push({
        def,
        stripIdx,
        dom,
        pts: plotPts,
        path: smoothPath(plotPts),
        grid: lipidYTicks(dom.min, dom.max).map((v, k) => ({
          y: lipidMapY(v, dom.min, dom.max, stripTop, LIPID_PLOT_H),
          label: String(v),
          key: `${def.key}-g-${k}`,
        })),
        safeRect: lipidSafeBandRect(dom, def.mode, def.threshold, stripTop),
        stripTop,
      });
      stripIdx += 1;
    }

    if (!visible.length) {
      host.innerHTML = `<p class="empty">${escapeXml(t('wsLipidEmptyNoSeries'))}</p>`;
      return;
    }

    const tickIdx = new Set(lipidPickTickIndices(n, 5));
    const xTicks = pts
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ p, i }) => ({
        x: lipidXAtIndex(i, plotLeft, innerW, n),
        label: lipidAxisDateLabel(p.dateKey || p.date),
        key: p.dateKey || p.date,
      }));

    const svgH = LIPID_PAD_TOP + visible.length * LIPID_STRIP_UNIT + LIPID_AXIS_BOTTOM;
    const xAxisY = LIPID_PAD_TOP + visible.length * LIPID_STRIP_UNIT + 14;
    const title = t('wsLipidTitle');
    const disclaimer = t('wsLipidDisclaimer');

    let svg = plotBackdrop(chartW, svgH, chartPalette().plotBg);
    for (const strip of visible) {
      if (strip.stripIdx > 0) {
        svg += `<line x1="${plotLeft}" y1="${LIPID_PAD_TOP + strip.stripIdx * LIPID_STRIP_UNIT}" x2="${chartRight}" y2="${LIPID_PAD_TOP + strip.stripIdx * LIPID_STRIP_UNIT}" stroke="${LIPID_GRID}" stroke-width="1" opacity="0.6"/>`;
      }
      const label = strip.def.label;
      const titleX = (plotLeft + chartRight) / 2;
      // direction=ltr + middle: portal RTL was anchoring start on the right and
      // painting the title off the left edge (clipped to "00 mg/dL").
      svg += `<text x="${titleX}" y="${LIPID_PAD_TOP + strip.stripIdx * LIPID_STRIP_UNIT + 12}" fill="${strip.def.color}" font-size="10" font-weight="700" text-anchor="middle" direction="ltr">${label} · ${strip.def.thresholdLabel} mg/dL</text>`;
      if (strip.safeRect) {
        svg += `<rect x="${plotLeft}" y="${strip.safeRect.y}" width="${chartRight - plotLeft}" height="${strip.safeRect.h}" fill="${LIPID_SAFE_FILL}" opacity="${LIPID_SAFE_OPACITY}"/>`;
      }
      for (const g of strip.grid) {
        svg += `<line x1="${plotLeft}" y1="${g.y}" x2="${chartRight}" y2="${g.y}" stroke="${LIPID_GRID}" stroke-width="1" opacity="0.5"/>`;
        svg += `<text x="${plotLeft - 4}" y="${g.y + 3}" font-size="8" fill="${LIPID_MUTED}" text-anchor="end">${g.label}</text>`;
      }
      if (strip.path) svg += `<path d="${strip.path}" fill="none" stroke="${strip.def.color}" stroke-width="2.2"/>`;
      for (const pt of strip.pts) {
        svg += `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="${strip.def.color}"/>`;
        const lab = formatLabValue(pt.value);
        const w = Math.max(24, lab.length * 5.4 + 8);
        const lx = lipidClampLabelCenter(pt.x, w, chartW);
        const ly = pt.y + 14;
        svg += `<rect x="${lx - w / 2}" y="${ly - 9}" width="${w}" height="13" rx="3" fill="${cssVar('--surface', '#fff')}" stroke="${strip.def.color}" stroke-width="0.75"/>`;
        svg += `<text x="${lx}" y="${ly}" font-size="9" font-weight="600" fill="${strip.def.color}" text-anchor="middle">${lab}</text>`;
      }
    }
    for (const tick of xTicks) {
      svg += `<text x="${tick.x}" y="${xAxisY}" font-size="9" fill="${LIPID_MUTED}" text-anchor="middle">${tick.label}</text>`;
    }

    host.innerHTML = `
      <div class="lipid-wrap${rtl ? ' rtl' : ''}">
        <div class="lipid-title">${escapeXml(title)}</div>
        <div class="lipid-chart-box">
          <svg viewBox="0 0 ${chartW} ${svgH}" width="100%" height="${svgH}" direction="ltr" role="img" aria-label="${title}">
            ${svg}
          </svg>
        </div>
        <div class="lipid-disclaimer">${escapeXml(disclaimer)}</div>
      </div>`;
  }

  // ─── Custom lab marker trend (prompt101) ───────────────────────────────────

  const LIPID_EXCLUDE_CODES = new Set([
    'CHOLESTEROL_LDL', 'LDL', 'LDL_CHOL', 'LDL_C',
    'CHOLESTEROL', 'TOTAL_CHOLESTEROL', 'CHOL',
    'CHOLESTEROL_HDL', 'HDL', 'HDL_CHOL', 'HDL_C',
    'TRIGLYCERIDES', 'TRIGLYCERIDE', 'TG',
  ]);
  const CREATININE_CODES = new Set(['CREATININE', 'CREATININ']);
  const UREA_CODES = new Set(['UREA', 'BUN']);
  const GLUCOSE_CODES = new Set(['GLUCOSE', 'GLUC']);
  const HBA1C_CODES = new Set(['HBA1C', 'HBA_1C', 'A1C', 'HEMOGLOBIN_A1C']);

  function normalizeLabCode(code) {
    const s = String(code || '').trim().toUpperCase();
    let out = '';
    let sep = false;
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      const ok = (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9');
      if (ok) { out += ch; sep = false; }
      else if (out.length > 0 && !sep) { out += '_'; sep = true; }
    }
    if (out.endsWith('_')) out = out.slice(0, -1);
    return out;
  }

  function isLipidChartCode(code) {
    return LIPID_EXCLUDE_CODES.has(normalizeLabCode(code));
  }

  function canonicalLabTrendCode(code) {
    const k = normalizeLabCode(code);
    if (!k || isLipidChartCode(k)) return null;
    if (CREATININE_CODES.has(k)) return 'CREATININE';
    if (UREA_CODES.has(k)) return 'UREA';
    if (GLUCOSE_CODES.has(k)) return 'GLUCOSE';
    if (HBA1C_CODES.has(k)) return 'HBA1C';
    return k;
  }

  function labDateKey(collectedAt) {
    return String(collectedAt || '').slice(0, 10);
  }

  function listLabTrendMarkerOptions(labs) {
    const byCode = new Map();
    for (const report of labs || []) {
      const dateKey = labDateKey(report.collectedAt);
      for (const panel of report.panels || []) {
        for (const r of panel.results || []) {
          const code = canonicalLabTrendCode(r.code);
          if (!code) continue;
          const cur = byCode.get(code);
          if (!cur) {
            byCode.set(code, { name: r.name || code, unit: r.unit || '', dates: new Set([dateKey]) });
          } else {
            cur.dates.add(dateKey);
            if (!cur.name && r.name) cur.name = r.name;
            if (!cur.unit && r.unit) cur.unit = r.unit;
          }
        }
      }
    }
    return Array.from(byCode.entries())
      .map(([code, v]) => ({ code, name: v.name, unit: v.unit, drawCount: v.dates.size }))
      .sort((a, b) => a.name.localeCompare(b.name) || a.code.localeCompare(b.code));
  }

  function resultMatchesTrendCode(r, selectedCode) {
    const canon = canonicalLabTrendCode(r.code);
    const selected = canonicalLabTrendCode(selectedCode);
    return !!canon && !!selected && canon === selected;
  }

  function buildLabMarkerTrendSeries(labs, selectedCode) {
    const selected = canonicalLabTrendCode(selectedCode);
    if (!selected) return null;
    const sorted = (labs || []).slice().sort((a, b) => (a.collectedAt || '').localeCompare(b.collectedAt || ''));
    const points = [];
    let name = selected;
    let unit = '';
    let refLow = null;
    let refHigh = null;

    for (let i = sorted.length - 1; i >= 0; i--) {
      const report = sorted[i];
      for (const panel of report.panels || []) {
        for (const r of panel.results || []) {
          if (!resultMatchesTrendCode(r, selected)) continue;
          if (
            refLow == null && refHigh == null
            && Number.isFinite(r.refLow) && Number.isFinite(r.refHigh)
          ) {
            refLow = r.refLow;
            refHigh = r.refHigh;
          }
          if (!unit && r.unit) unit = r.unit;
          if (name === selected && r.name) name = r.name;
        }
      }
    }

    for (const report of sorted) {
      let value = null;
      for (const panel of report.panels || []) {
        for (const r of panel.results || []) {
          if (!resultMatchesTrendCode(r, selected)) continue;
          if (Number.isFinite(r.value)) {
            value = r.value;
            if (r.name) name = r.name;
            if (r.unit) unit = r.unit;
            break;
          }
        }
        if (value != null) break;
      }
      if (value == null) continue;
      points.push({ dateKey: labDateKey(report.collectedAt), collectedAt: report.collectedAt, value });
    }
    if (!points.length) return null;
    return { code: selected, name, unit, points, refLow, refHigh };
  }

  function markerRangeDomain(values, refLow, refHigh) {
    let lo = Math.min(...values);
    let hi = Math.max(...values);
    if (Number.isFinite(refLow)) lo = Math.min(lo, refLow);
    if (Number.isFinite(refHigh)) hi = Math.max(hi, refHigh);
    if (lo === hi) { lo -= 8; hi += 8; }
    const pad = (hi - lo) * 0.1;
    return { min: lo - pad, max: hi + pad };
  }

  function markerRangeBandRect(dom, refLow, refHigh, stripTop) {
    if (!Number.isFinite(refLow) || !Number.isFinite(refHigh)) return null;
    const lo = Math.min(refLow, refHigh);
    const hi = Math.max(refLow, refHigh);
    const yTop = lipidMapY(Math.min(hi, dom.max), dom.min, dom.max, stripTop, LIPID_PLOT_H);
    const yBottom = lipidMapY(Math.max(lo, dom.min), dom.min, dom.max, stripTop, LIPID_PLOT_H);
    const h = yBottom - yTop;
    return h > 1 ? { y: yTop, h } : null;
  }

  function drawMarkerTrendChart(host, series, opts) {
    const lt = lipidTheme();
    const rtl = !!opts?.rtl;
    if (!series || !series.points || series.points.length < 2) {
      host.innerHTML = `<p class="empty">${escapeXml(t('wsMarkerNeedTwo'))}</p>`;
      return;
    }
    const pts = series.points;
    const chartW = Math.min(600, Math.max(280, host.clientWidth || 640));
    const n = pts.length;
    const plotLeft = LIPID_PAD_L;
    const innerW = Math.max(1, chartW - plotLeft - LIPID_PAD_R);
    const chartRight = chartW - LIPID_PAD_R;
    const values = pts.map((p) => p.value);
    const dom = markerRangeDomain(values, series.refLow, series.refHigh);
    const stripTop = LIPID_PAD_TOP + LIPID_TITLE_H;
    const plotPts = pts.map((p, i) => ({
      x: lipidXAtIndex(i, plotLeft, innerW, n),
      y: lipidMapY(p.value, dom.min, dom.max, stripTop, LIPID_PLOT_H),
      value: p.value,
      dataIndex: i,
    }));
    const path = smoothPath(plotPts);
    const grid = lipidYTicks(dom.min, dom.max).map((v, k) => ({
      y: lipidMapY(v, dom.min, dom.max, stripTop, LIPID_PLOT_H),
      label: String(v),
      key: `g-${k}`,
    }));
    const safeRect = markerRangeBandRect(dom, series.refLow, series.refHigh, stripTop);
    const tickIdx = new Set(lipidPickTickIndices(n, 5));
    const xTicks = pts
      .map((p, i) => ({ p, i }))
      .filter(({ i }) => tickIdx.has(i))
      .map(({ p, i }) => ({
        x: lipidXAtIndex(i, plotLeft, innerW, n),
        label: lipidAxisDateLabel(p.dateKey),
        key: p.dateKey,
      }));
    const svgH = LIPID_PAD_TOP + LIPID_TITLE_H + LIPID_STRIP_H + LIPID_AXIS_BOTTOM;
    const xAxisY = LIPID_PAD_TOP + LIPID_TITLE_H + LIPID_STRIP_H + 14;
    const color = lt.total;
    const rangeLabel =
      Number.isFinite(series.refLow) && Number.isFinite(series.refHigh)
        ? `${formatLabValue(series.refLow)}–${formatLabValue(series.refHigh)}`
        : null;
    const unitSuffix = series.unit ? ` ${series.unit}` : '';
    const stripTitle = rangeLabel
      ? `${series.code} · ${rangeLabel}${unitSuffix}`
      : `${series.code}${unitSuffix}`;

    let svg = plotBackdrop(chartW, svgH, chartPalette().plotBg);
    const titleX = (plotLeft + chartRight) / 2;
    svg += `<text x="${titleX}" y="${LIPID_PAD_TOP + 12}" fill="${color}" font-size="10" font-weight="700" text-anchor="middle" direction="ltr">${escapeXml(stripTitle)}</text>`;
    if (safeRect) {
      svg += `<rect x="${plotLeft}" y="${safeRect.y}" width="${chartRight - plotLeft}" height="${safeRect.h}" fill="${lt.safeFill}" opacity="${lt.safeOpacity}"/>`;
    }
    for (const g of grid) {
      svg += `<line x1="${plotLeft}" y1="${g.y}" x2="${chartRight}" y2="${g.y}" stroke="${lt.grid}" stroke-width="1" opacity="0.5"/>`;
      svg += `<text x="${plotLeft - 4}" y="${g.y + 3}" font-size="8" fill="${lt.muted}" text-anchor="end">${g.label}</text>`;
    }
    if (path) svg += `<path d="${path}" fill="none" stroke="${color}" stroke-width="2.2"/>`;
    for (const pt of plotPts) {
      svg += `<circle cx="${pt.x}" cy="${pt.y}" r="3.5" fill="${color}"/>`;
      const lab = formatLabValue(pt.value);
      const w = Math.max(24, lab.length * 5.4 + 8);
      const lx = lipidClampLabelCenter(pt.x, w, chartW);
      const ly = pt.y + 14;
      svg += `<rect x="${lx - w / 2}" y="${ly - 9}" width="${w}" height="13" rx="3" fill="${cssVar('--surface', '#fff')}" stroke="${color}" stroke-width="0.75"/>`;
      svg += `<text x="${lx}" y="${ly}" font-size="9" font-weight="600" fill="${color}" text-anchor="middle">${lab}</text>`;
    }
    for (const tick of xTicks) {
      svg += `<text x="${tick.x}" y="${xAxisY}" font-size="9" fill="${lt.muted}" text-anchor="middle">${tick.label}</text>`;
    }

    host.innerHTML = `
      <div class="lipid-wrap${rtl ? ' rtl' : ''}">
        <div class="lipid-chart-box">
          <svg viewBox="0 0 ${chartW} ${svgH}" width="100%" height="${svgH}" direction="ltr" role="img" aria-label="${escapeXml(series.name || series.code)}">
            ${svg}
          </svg>
        </div>
        <div class="lipid-disclaimer">${escapeXml(t('wsMarkerDisclaimer'))}</div>
      </div>`;
  }

  global.ClinicCharts = {
    computeBurnByDay,
    eatenByDay,
    enrichBodyTrendDays,
    fillBmrGaps,
    trendWindowSlice,
    drawMetabolicChart,
    drawTrendAnalysis,
    drawEnergyChart,
    drawLipidChart,
    buildLipidPoints,
    listLabTrendMarkerOptions,
    buildLabMarkerTrendSeries,
    drawMarkerTrendChart,
    isLipidChartCode,
  };
})(window);
