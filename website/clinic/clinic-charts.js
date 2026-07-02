/**
 * Clinic dashboard charts — mirrors phone MetabolicChart, trend, energy, lipids.
 */
(function (global) {
  const BUCKET_MS = 30 * 60 * 1000;
  const GLUCOSE_GREEN = '#4CAF50';
  const HR_RED = '#FF5252';
  const CAL_BMR = '#90CAF9';
  const CAL_STEPS = '#42A5F5';
  const CAL_WORKOUT = '#1565C0';
  const MEAL_ORANGE = '#FF9800';
  const VIEWPORT_PRESETS = [
    { label: '1H', ms: 3600000 },
    { label: '3H', ms: 3 * 3600000 },
    { label: '6H', ms: 6 * 3600000 },
    { label: '12H', ms: 12 * 3600000 },
    { label: '24H', ms: 86400000 },
    { label: '2D', ms: 2 * 86400000 },
  ];

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

  function computeBurnByDay(withings) {
    const fallbackBmr = withings?.bodyScan?.bmrKcalDay;
    const trend = withings?.bodyTrendDays || [];
    const calories = withings?.calories || [];
    const workouts = withings?.workouts || [];
    const bmrByDay = new Map();
    for (const d of trend) {
      if (d.bmrKcalDay != null) bmrByDay.set(d.dayKey, d.bmrKcalDay);
      else if (d.activityKcalDay != null && d.bmrKcalDay == null && fallbackBmr) bmrByDay.set(d.dayKey, fallbackBmr);
    }
    const passiveByDay = new Map();
    for (const pt of calories) {
      const t = Date.parse(pt.timestamp);
      const dk = dayKeyFromMs(t);
      if (!passiveByDay.has(dk)) passiveByDay.set(dk, new Map());
      const bk = Math.floor(t / BUCKET_MS) * BUCKET_MS;
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
    const keys = new Set([dayKeyFromMs(Date.now()), ...bmrByDay.keys(), ...passiveByDay.keys(), ...workoutKcalByDay.keys()]);
    const result = {};
    for (const dk of keys) {
      const bmr = bmrByDay.get(dk) ?? fallbackBmr;
      if (!bmr) continue;
      const wktBuckets = workoutBucketsByDay.get(dk) || new Set();
      let passive = 0;
      for (const [bk, kcal] of passiveByDay.get(dk) || []) {
        if (!wktBuckets.has(bk)) passive += kcal;
      }
      result[dk] = Math.round(bmr + passive + (workoutKcalByDay.get(dk) || 0));
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

  function scanLipids(report) {
    const out = { ldl: null, hdl: null, totalCholesterol: null, triglycerides: null };
    for (const panel of report.panels || []) {
      for (const r of panel.results || []) {
        const c = (r.code || '').toUpperCase();
        const n = r.name?.toUpperCase() || '';
        if (c.includes('LDL') || n.includes('LDL')) out.ldl = r.value;
        if (c.includes('HDL') || n.includes('HDL')) out.hdl = r.value;
        if (c.includes('CHOLESTEROL') && !c.includes('LDL') && !c.includes('HDL')) out.totalCholesterol = r.value;
        if (c.includes('TRIG') || n.includes('TRIG')) out.triglycerides = r.value;
      }
    }
    return out;
  }

  function buildLipidPoints(labs) {
    return labs
      .slice()
      .sort((a, b) => (a.collectedAt || '').localeCompare(b.collectedAt || ''))
      .map((report) => {
        const lip = scanLipids(report);
        if (lip.ldl == null && lip.totalCholesterol == null && lip.hdl == null) return null;
        return { date: (report.collectedAt || '').slice(0, 10), ...lip };
      })
      .filter(Boolean);
  }

  function drawMetabolicChart(host, data, ctx, onChange) {
    const vpIdx = ctx.chartVp ?? 2;
    const preset = VIEWPORT_PRESETS[vpIdx] || VIEWPORT_PRESETS[2];
    const chartEnd = ctx.chartEndMs ?? Date.now();
    const t1 = chartEnd;
    const t0 = t1 - preset.ms;

    const glucose = (data.glucose || []).filter((p) => {
      const t = Date.parse(p.timestamp);
      return t >= t0 && t <= t1;
    });
    const heartRate = (data.withings?.heartRate || []).filter((p) => {
      const t = Date.parse(p.timestamp);
      return t >= t0 && t <= t1;
    }).map((p) => ({ timestamp: p.timestamp, value: p.bpm || p.value || 0 }));

    const calories = (data.withings?.calories || []).filter((p) => {
      const t = Date.parse(p.timestamp);
      return t >= t0 && t <= t1;
    });
    const workouts = (data.withings?.workouts || []).filter((w) => w.endMs >= t0 && w.startMs <= t1);
    const chartMeals = (data.meals || []).filter((m) => m.timestamp >= t0 && m.timestamp <= t1);
    const bmrDay = data.withings?.bodyScan?.bmrKcalDay;
    const bmrPerSlot = bmrDay > 0 ? bmrDay / 48 : null;

    const W = Math.max(320, host.clientWidth || 900);
    const plotH = 273;
    const axisH = 30;
    const H = plotH + axisH;
    const padL = 36;
    const padR = 8;
    const padT = 12;
    const padB = 8;
    const calH = 42;
    const dataH = plotH - padT - padB - calH;
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
    const calStripTop = padT + dataH;
    const calStripBottom = calStripTop + calH;

    const passiveMap = new Map();
    for (const c of calories) {
      const t = Date.parse(c.timestamp);
      const bk = Math.floor(t / BUCKET_MS) * BUCKET_MS;
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

    let svg = `<svg class="metabolic-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}">`;
    svg += `<rect x="${padL}" y="${calStripTop}" width="${innerW}" height="${calH}" fill="#E3F2FD" opacity="0.7"/>`;
    svg += `<rect x="${padL}" y="${yOf(100)}" width="${innerW}" height="${Math.max(0, yOf(70) - yOf(100))}" fill="rgba(76,175,80,0.16)"/>`;

    for (let v = Math.ceil(yMin / 10) * 10; v <= yMax; v += 10) {
      const y = yOf(v);
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8e8e8"/>`;
      if (v % 20 === 0) svg += `<text x="4" y="${y + 4}" font-size="9" fill="#7c7c7c">${v}</text>`;
    }
    svg += `<line x1="${padL}" y1="${calStripTop}" x2="${W - padR}" y2="${calStripTop}" stroke="#e8e8e8"/>`;

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

    for (const m of chartMeals) {
      const x = xOf(m.timestamp);
      svg += `<line x1="${x}" y1="${calStripTop - 18}" x2="${x}" y2="${calStripTop - 4}" stroke="${MEAL_ORANGE}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
      svg += `<text x="${x}" y="${calStripTop - 20}" fill="${MEAL_ORANGE}" font-size="10" text-anchor="middle">▼</text>`;
      if (m.totalKcal) svg += `<text x="${x}" y="${padT + 8}" fill="${MEAL_ORANGE}" font-size="8" text-anchor="middle">${Math.round(m.totalKcal)}</text>`;
    }

    for (let i = 0; i <= 4; i++) {
      const t = t0 + (i / 4) * (t1 - t0);
      const x = xOf(t);
      const lbl = new Date(t).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      svg += `<line x1="${x}" y1="${plotH - 8}" x2="${x}" y2="${plotH - 2}" stroke="#999" stroke-width="1"/>`;
      svg += `<text x="${x}" y="${H - 6}" font-size="9" fill="#7c7c7c" text-anchor="middle">${lbl}</text>`;
    }
    svg += '</svg>';

    const dateLabel = new Date(t0).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' });
    const chips = VIEWPORT_PRESETS.map((p, i) =>
      `<button type="button" class="chip${i === vpIdx ? ' active' : ''}" data-vp="${i}">${p.label}</button>`,
    ).join('');
    const bmrLbl = bmrDay ? ` (${Math.round(bmrDay / 48)} kcal)` : '';

    host.innerHTML = `
      <div class="chart-toolbar">
        <div class="chip-row">${chips}</div>
        <div class="date-nav">
          <button type="button" class="nav-arrow" data-shift="-1" aria-label="Earlier">‹</button>
          <span class="date-label">${dateLabel}</span>
          <button type="button" class="nav-arrow" data-shift="1" aria-label="Later">›</button>
        </div>
      </div>
      <div class="chart-wrap">${svg}</div>
      <div class="chart-legend">
        <span class="leg glucose">Glucose</span>
        <span class="leg hr">Heart rate</span>
        <span class="leg bmr">BMR${bmrLbl}</span>
        <span class="leg steps">Steps cal</span>
        <span class="leg workout">Workout</span>
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
  const TREND_BLUE = '#2196F3';
  const TREND_GREEN = '#4CAF50';
  const TREND_FAT = '#FF5252';
  const TREND_VISCERAL = '#7B1FA2';
  const TREND_GRID = '#e8eaed';
  const TREND_MUTED = '#6b7280';
  const TREND_PAD_L = 36;
  const TREND_PAD_R = 10;
  const TREND_PAD_TOP = 4;
  const TREND_STRIP_H = 46;
  const TREND_STRIP_GAP = 5;
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

  function stripTop(index) {
    return TREND_PAD_TOP + index * (TREND_STRIP_H + TREND_STRIP_GAP);
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

  function drawTrendAnalysis(host, allDays, sessions, periodDays, availableDays, onPeriodChange) {
    const period = periodDays || DEFAULT_TREND_PERIOD;
    const avail = availableDays ?? (allDays || []).length;
    const slice = (allDays || []).slice(-Math.min(period, avail));
    if (slice.length < 2) {
      host.innerHTML = `
        <div class="trend-wrap">
          <div class="trend-title">TREND ANALYSIS</div>
          <p class="empty">Need more body trend days in snapshot</p>
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
    const plotBottom = stripTop(2) + TREND_STRIP_H;
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
    const zeroLineY = mapY(0, deltaDom.min, deltaDom.max, stripTop(1), TREND_STRIP_H);

    function mkPts(getter, dom, stripIndex) {
      const top = stripTop(stripIndex);
      const pts = [];
      slice.forEach((d, i) => {
        const v = getter(d, i);
        if (v != null && Number.isFinite(v)) {
          pts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: mapY(v, dom.min, dom.max, top, TREND_STRIP_H) });
        }
      });
      return pts;
    }

    function mkDeltaPts(getter, baseline, stripIndex) {
      const top = stripTop(stripIndex);
      const pts = [];
      slice.forEach((_, i) => {
        if (!compBase || baseline == null) return;
        const raw = getter(i);
        if (raw == null) return;
        const v = raw - baseline;
        pts.push({ x: xAtIndex(i, plotLeft, innerW, n), y: mapY(v, deltaDom.min, deltaDom.max, top, TREND_STRIP_H) });
      });
      return pts;
    }

    const wPts = mkPts((d) => d.weightKg, wDom, 0);
    const fPts = mkDeltaPts((i) => withingsChartCompositionKg(slice, i, 'fatMassKg'), fatBaseline, 1);
    const mPts = mkDeltaPts((i) => withingsChartCompositionKg(slice, i, 'muscleMassKg'), muscleBaseline, 1);
    const vPts = mkPts((_, i) => withingsChartVisceralIndex(slice, i), vDom, 2);

    function mkGrid(dom, stripIndex, labelFn, labelColor, opacity) {
      const top = stripTop(stripIndex);
      return [dom.min, (dom.min + dom.max) / 2, dom.max].map((v) => ({
        y: mapY(v, dom.min, dom.max, top, TREND_STRIP_H),
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

    let svg = `<svg class="trend-svg" viewBox="0 0 ${W} ${svgH}" width="100%" height="${svgH}">`;
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
        <div class="trend-title">TREND ANALYSIS</div>
        <div class="chip-row trend-chips">${periodChips}</div>
        <div class="chart-wrap">${svg}</div>
        <div class="trend-legend">
          <div class="trend-legend-row">
            <span class="trend-leg"><i style="background:${TREND_BLUE}"></i>${legendDeltaKg('Weight', weightWeekDelta)}</span>
            <span class="trend-leg"><i style="background:${TREND_FAT}"></i>${legendDeltaKg('Fat', anchorDeltas?.fatKg)}</span>
          </div>
          <div class="trend-legend-row">
            <span class="trend-leg"><i style="background:${TREND_GREEN}"></i>${legendDeltaKg('Muscle', anchorDeltas?.muscleKg)}</span>
            <span class="trend-leg"><i style="background:${TREND_VISCERAL}"></i>${legendVisceral('Visceral', visceralWeekTrend)}</span>
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

  function drawEnergyChart(host, days, eatenByDay, burnByDay) {
    const slice = (days || []).slice(-14);
    if (!slice.length) {
      host.innerHTML = '<p class="empty">No energy history in snapshot</p>';
      return;
    }
    const W = host.clientWidth || 800;
    const stripH = 40;
    const padL = 44;
    const padR = 10;
    const titleH = 14;
    const strips = 4;
    const H = 8 + strips * (titleH + stripH + 4) + 20;
    const innerW = W - padL - padR;
    const n = slice.length;
    const xAt = (i) => padL + (i / Math.max(1, n - 1)) * innerW;

    const bmrVals = slice.map((d) => d.bmrKcalDay ?? burnByDay[d.dayKey] ?? null);
    const actVals = slice.map((d) => d.activityKcalDay ?? null);
    const eatenVals = slice.map((d) => eatenByDay[d.dayKey] ?? 0);
    const totalVals = slice.map((d, i) => {
      const b = burnByDay[d.dayKey];
      return b ?? ((bmrVals[i] || 0) + (actVals[i] || 0));
    });
    const balVals = eatenVals.map((e, i) => (totalVals[i] ? e - totalVals[i] : null));

    function stripPath(vals, top, lo, hi) {
      const pts = [];
      vals.forEach((v, i) => {
        if (v != null && Number.isFinite(v)) {
          pts.push({ x: xAt(i), y: top + titleH + stripH - ((v - lo) / (hi - lo)) * stripH });
        }
      });
      return pts.length > 1 ? smoothPath(pts) : '';
    }

    const kcalMax = Math.max(500, ...totalVals.filter(Boolean), ...eatenVals, 2000);
    const balMax = Math.max(500, ...balVals.filter((v) => v != null).map((v) => Math.abs(v)), 500);

    let top = 6;
    const configs = [
      { label: 'BMR', color: '#1A1A1A', vals: bmrVals, lo: 0, hi: kcalMax },
      { label: 'ACTIVITY', color: '#42A5F5', vals: actVals, lo: 0, hi: kcalMax },
      { label: 'TOTAL BURN', color: '#4CAF50', vals: totalVals, lo: 0, hi: kcalMax },
      { label: 'EATEN', color: '#FF9800', vals: eatenVals, lo: 0, hi: kcalMax },
    ];

    let svg = `<svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">`;
    for (const cfg of configs) {
      svg += `<text x="${padL}" y="${top + 10}" font-size="9" font-weight="700" fill="${cfg.color}">${cfg.label}</text>`;
      const p = stripPath(cfg.vals, top, cfg.lo, cfg.hi);
      if (p) svg += `<path d="${p}" fill="none" stroke="${cfg.color}" stroke-width="2"/>`;
      top += titleH + stripH + 4;
      svg += `<line x1="${padL}" y1="${top - 4}" x2="${W - padR}" y2="${top - 4}" stroke="#f0f0f0"/>`;
    }
    svg += `<text x="${padL}" y="${top + 10}" font-size="9" font-weight="700" fill="#37474F">BALANCE</text>`;
    const balTop = top;
    const balPath = stripPath(balVals.map((v) => (v != null ? v + balMax : null)), balTop, 0, balMax * 2);
    if (balPath) svg += `<path d="${balPath}" fill="none" stroke="#37474F" stroke-width="2.2"/>`;
    svg += `<line x1="${padL}" y1="${balTop + titleH + stripH / 2}" x2="${W - padR}" y2="${balTop + titleH + stripH / 2}" stroke="#ccc" stroke-dasharray="4,3"/>`;
    slice.forEach((d, i) => {
      if (i % Math.ceil(n / 5) === 0 || i === n - 1) {
        svg += `<text x="${xAt(i)}" y="${H - 2}" font-size="9" fill="#888" text-anchor="middle">${d.dayKey?.slice(5) || ''}</text>`;
      }
    });
    svg += '</svg>';
    host.innerHTML = `<div class="chart-head"><strong>Energy (kcal)</strong></div>${svg}`;
  }

  function drawLipidChart(host, labs) {
    const pts = buildLipidPoints(labs);
    if (pts.length < 1) {
      host.innerHTML = '<p class="empty">No lipid labs in snapshot</p>';
      return;
    }
    const W = host.clientWidth || 600;
    const H = 180;
    const padL = 40;
    const innerW = W - padL - 10;
    const n = pts.length;
    const xAt = (i) => padL + (i / Math.max(1, n - 1)) * innerW;
    const all = pts.flatMap((p) => [p.ldl, p.hdl, p.totalCholesterol, p.triglycerides].filter((v) => v != null));
    const lo = Math.min(...all) * 0.9;
    const hi = Math.max(...all) * 1.1;
    const yOf = (v) => 20 + (H - 40) - ((v - lo) / (hi - lo)) * (H - 40);

    function lineFor(key, color) {
      const arr = [];
      pts.forEach((p, i) => {
        if (p[key] != null) arr.push({ x: xAt(i), y: yOf(p[key]) });
      });
      return arr.length > 1 ? `<path d="${smoothPath(arr)}" fill="none" stroke="${color}" stroke-width="2"/>` : '';
    }

    host.innerHTML = `
      <div class="chart-head"><strong>Lipid trend</strong></div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
        ${lineFor('ldl', '#FF5252')}
        ${lineFor('hdl', '#4CAF50')}
        ${lineFor('totalCholesterol', '#2196F3')}
        ${lineFor('triglycerides', '#FF9800')}
        ${pts.map((p, i) => `<text x="${xAt(i)}" y="${H - 6}" font-size="9" fill="#888" text-anchor="middle">${p.date?.slice(5) || ''}</text>`).join('')}
      </svg>
      <div class="chart-legend">
        <span class="leg" style="color:#FF5252">LDL</span>
        <span class="leg" style="color:#4CAF50">HDL</span>
        <span class="leg" style="color:#2196F3">Total chol</span>
        <span class="leg" style="color:#FF9800">Triglycerides</span>
      </div>`;
  }

  global.ClinicCharts = {
    computeBurnByDay,
    eatenByDay,
    drawMetabolicChart,
    drawTrendAnalysis,
    drawEnergyChart,
    drawLipidChart,
    buildLipidPoints,
  };
})(window);
