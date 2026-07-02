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

  function drawTrendAnalysis(host, days, periodDays, onPeriodChange) {
    const slice = (days || []).slice(-(periodDays || 14));
    if (slice.length < 2) {
      host.innerHTML = '<p class="empty">Need more body trend days in snapshot</p>';
      return;
    }
    const W = host.clientWidth || 800;
    const stripH = 46;
    const gap = 5;
    const padL = 36;
    const padR = 10;
    const titleH = 15;
    const axisH = 22;
    const strips = 3;
    const H = padL / 2 + strips * (titleH + stripH + gap) + axisH;
    const innerW = W - padL - padR;
    const n = slice.length;
    const xAt = (i) => padL + (i / Math.max(1, n - 1)) * innerW;

    const weights = slice.map((d) => d.weightKg).filter((v) => v != null);
    const wLo = Math.min(...weights) - 0.3;
    const wHi = Math.max(...weights) + 0.3;
    const yW = (v, top) => top + titleH + stripH - ((v - wLo) / (wHi - wLo)) * stripH;

    const fatBase = slice.find((d) => d.fatMassKg != null)?.fatMassKg ?? 0;
    const muscleBase = slice.find((d) => d.muscleMassKg != null)?.muscleMassKg ?? 0;
    const deltas = slice.flatMap((d) => [d.fatMassKg - fatBase, d.muscleMassKg - muscleBase].filter((v) => Number.isFinite(v)));
    const dLo = Math.min(-0.5, ...deltas, 0);
    const dHi = Math.max(0.5, ...deltas, 0);
    const strip1Top = 4;
    const strip2Top = strip1Top + titleH + stripH + gap;
    const strip3Top = strip2Top + titleH + stripH + gap;
    const yD = (v, top) => top + titleH + stripH - ((v - dLo) / (dHi - dLo)) * stripH;

    const visceral = slice.map((d) => d.visceralFatIndex ?? d.visceralFat ?? null);
    const vVals = visceral.filter((v) => v != null);
    const vLo = vVals.length ? Math.min(...vVals) - 0.2 : 3;
    const vHi = vVals.length ? Math.max(...vVals) + 0.2 : 5;
    const yV = (v) => strip3Top + titleH + stripH - ((v - vLo) / (vHi - vLo)) * stripH;

    function pathFor(getter, yFn) {
      const pts = [];
      slice.forEach((d, i) => {
        const v = getter(d);
        if (v != null && Number.isFinite(v)) pts.push({ x: xAt(i), y: yFn(v, 0) });
      });
      return pts.length > 1 ? smoothPath(pts) : '';
    }

    const wPath = pathFor((d) => d.weightKg, (v, _) => yW(v, strip1Top));
    const fatPath = pathFor((d) => d.fatMassKg - fatBase, (v) => yD(v, strip2Top));
    const musclePath = (() => {
      const pts = [];
      slice.forEach((d, i) => {
        if (d.muscleMassKg != null) pts.push({ x: xAt(i), y: yD(d.muscleMassKg - muscleBase, strip2Top) });
      });
      return pts.length > 1 ? smoothPath(pts) : '';
    })();
    const vPath = (() => {
      const pts = [];
      slice.forEach((d, i) => {
        const v = d.visceralFatIndex ?? d.visceralFat;
        if (v != null) pts.push({ x: xAt(i), y: yV(v) });
      });
      return pts.length > 1 ? smoothPath(pts) : '';
    })();

    const periodChips = [7, 14, 30].map((d) =>
      `<button type="button" class="chip${d === periodDays ? ' active' : ''}" data-period="${d}">${d}D</button>`,
    ).join('');

    host.innerHTML = `
      <div class="chart-head"><strong>Trend analysis</strong><div class="chip-row">${periodChips}</div></div>
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
        <text x="${padL}" y="${strip1Top + 11}" font-size="9" font-weight="700" fill="#666">WEIGHT</text>
        ${wPath ? `<path d="${wPath}" fill="none" stroke="#2196F3" stroke-width="2.2"/>` : ''}
        <line x1="${padL}" y1="${strip2Top}" x2="${W - padR}" y2="${strip2Top}" stroke="#eee"/>
        <text x="${padL}" y="${strip2Top + 11}" font-size="9" font-weight="700" fill="#666">FAT / MUSCLE Δ</text>
        <line x1="${padL}" y1="${yD(0, strip2Top)}" x2="${W - padR}" y2="${yD(0, strip2Top)}" stroke="#bbb" stroke-dasharray="4,3"/>
        ${fatPath ? `<path d="${fatPath}" fill="none" stroke="#FF5252" stroke-width="2"/>` : ''}
        ${musclePath ? `<path d="${musclePath}" fill="none" stroke="#4CAF50" stroke-width="2"/>` : ''}
        <line x1="${padL}" y1="${strip3Top}" x2="${W - padR}" y2="${strip3Top}" stroke="#eee"/>
        <text x="${padL}" y="${strip3Top + 11}" font-size="9" font-weight="700" fill="#666">VISCERAL</text>
        ${vPath ? `<path d="${vPath}" fill="none" stroke="#7B1FA2" stroke-width="2"/>` : ''}
        ${slice.map((d, i) => i % Math.ceil(n / 6) === 0 || i === n - 1
          ? `<text x="${xAt(i)}" y="${H - 4}" font-size="9" fill="#888" text-anchor="middle">${d.dayKey?.slice(5) || ''}</text>` : '').join('')}
      </svg>
      <div class="chart-legend">
        <span class="leg" style="color:#2196F3">● Weight</span>
        <span class="leg" style="color:#FF5252">● Fat Δ</span>
        <span class="leg" style="color:#4CAF50">● Muscle Δ</span>
        <span class="leg" style="color:#7B1FA2">● Visceral</span>
      </div>`;

    host.querySelectorAll('[data-period]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = parseInt(btn.getAttribute('data-period'), 10);
        if (onPeriodChange) onPeriodChange(p);
        else drawTrendAnalysis(host, days, p, onPeriodChange);
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
