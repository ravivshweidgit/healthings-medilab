/**
 * Read-only clinic mirror of patient phone dashboard (from gzip snapshot).
 */
(function (global) {
  const CGM_KEY = 'healthings:lastMetrics';
  const METRICS_KEY = 'healthings:metricsStore';
  const WITHINGS_KEY = 'healthings:withingsStore';
  const COACH_KEY = 'coach_message_today';
  const MACRO_KEY = 'daily_macro_target';
  const MENTOR_KEY = 'user_mentors';

  const MENTOR_EMOJI = { doctor: '🩺', nutritionist: '🥗', coach: '💪' };
  const MS_HOUR = 3600000;
  const MS_DAY = 86400000;
  const VIEWPORT_PRESETS = [
    { label: '1H', ms: MS_HOUR },
    { label: '3H', ms: 3 * MS_HOUR },
    { label: '6H', ms: 6 * MS_HOUR },
    { label: '12H', ms: 12 * MS_HOUR },
    { label: '24H', ms: MS_DAY },
    { label: '2D', ms: 2 * MS_DAY },
    { label: '4D', ms: 4 * MS_DAY },
    { label: '8D', ms: 8 * MS_DAY },
    { label: '16D', ms: 16 * MS_DAY },
    { label: '32D', ms: 32 * MS_DAY },
  ];
  const DEFAULT_VIEWPORT = 3; // 12H

  const GLUCOSE_TARGET_MIN = 70;
  const GLUCOSE_TARGET_MAX = 100;
  const DEFAULT_Y_MIN = 50;
  const DEFAULT_Y_MAX = 175;

  function escapeHtml(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayKeyFromMs(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function parseSnapshot(payload) {
    const store = payload.asyncStorage || {};
    const meals = [];
    for (const [key, raw] of Object.entries(store)) {
      const m = key.match(/^food_log_(\d{4}-\d{2}-\d{2})$/);
      if (!m) continue;
      try {
        for (const meal of JSON.parse(raw)) meals.push({ day: m[1], ...meal });
      } catch { /* skip */ }
    }
    meals.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let cgm = null;
    if (store[CGM_KEY]) {
      try { cgm = JSON.parse(store[CGM_KEY]); } catch { /* */ }
    }

    let withings = null;
    const metricsRaw = store[METRICS_KEY] ?? store[WITHINGS_KEY];
    if (metricsRaw) {
      try { withings = JSON.parse(metricsRaw); } catch { /* */ }
    }

    let macroTarget = null;
    let coachMsg = null;
    let mentors = ['nutritionist'];
    try { if (store[MACRO_KEY]) macroTarget = JSON.parse(store[MACRO_KEY]); } catch { /* */ }
    try { if (store[COACH_KEY]) coachMsg = JSON.parse(store[COACH_KEY]); } catch { /* */ }
    try { if (store[MENTOR_KEY]) mentors = JSON.parse(store[MENTOR_KEY]); } catch { /* */ }

    const today = todayKey();
    const todayMeals = meals.filter((m) => m.day === today || dayKeyFromMs(m.timestamp) === today);

    return {
      meals,
      todayMeals,
      todayKey: today,
      glucose: cgm?.glucose || [],
      withings,
      macroTarget,
      coachMsg,
      mentors: Array.isArray(mentors) ? mentors : ['nutritionist'],
      exportedAt: payload.exportedAt,
      lookbackMode: payload.lookbackMode,
    };
  }

  function dailyMacros(entries) {
    return entries.reduce(
      (acc, e) => ({
        kcal: acc.kcal + (e.totalKcal || 0),
        protein_g: acc.protein_g + (e.totalProtein_g || 0),
        carb_g: acc.carb_g + (e.totalCarb_g || 0),
        fat_g: acc.fat_g + (e.totalFat_g || 0),
        fiber_g: acc.fiber_g + (e.totalFiber_g || 0),
      }),
      { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 },
    );
  }

  function mealLabel(entry) {
    if (entry.note) return entry.note;
    const h = new Date(entry.timestamp).getHours();
    if (h < 10) return 'Breakfast';
    if (h < 14) return 'Lunch';
    if (h < 17) return 'Snack';
    return 'Dinner';
  }

  function formatKg(v) {
    if (v == null || Number.isNaN(v)) return '—';
    return `${Number(v).toFixed(1)} kg`;
  }

  function formatKcal(v) {
    if (v == null || Number.isNaN(v)) return '—';
    return `${Math.round(v)} kcal`;
  }

  function computeYDomain(glucose, heartRate) {
    const values = [...glucose, ...heartRate].map((p) => p.value).filter((v) => v > 0);
    let yMin = DEFAULT_Y_MIN;
    let yMax = DEFAULT_Y_MAX;
    if (values.length) {
      const lo = Math.min(...values);
      const hi = Math.max(...values);
      const pad = Math.max(10, (hi - lo) * 0.1);
      if (hi + pad > yMax) yMax = Math.ceil((hi + pad) / 10) * 10;
      if (lo - pad < yMin) yMin = Math.floor((lo - pad) / 10) * 10;
    }
    yMin = Math.max(40, yMin);
    yMax = Math.min(250, yMax);
    if (yMax - yMin < 100) yMax = Math.min(250, yMin + 100);
    return { yMin, yMax };
  }

  function drawMetabolicChart(container, data, viewportIndex) {
    const preset = VIEWPORT_PRESETS[viewportIndex] || VIEWPORT_PRESETS[DEFAULT_VIEWPORT];
    const t1 = Date.now();
    const t0 = t1 - preset.ms;

    const glucose = data.glucose.filter((p) => {
      const t = Date.parse(p.timestamp);
      return !Number.isNaN(t) && t >= t0 && t <= t1;
    });
    const heartRate = (data.withings?.heartRate || []).filter((p) => {
      const t = Date.parse(p.timestamp);
      return !Number.isNaN(t) && t >= t0 && t <= t1;
    }).map((p) => ({ timestamp: p.timestamp, value: p.bpm || p.value || 0 }));

    const calories = (data.withings?.calories || []).filter((p) => {
      const t = Date.parse(p.timestamp);
      return !Number.isNaN(t) && t >= t0 && t <= t1;
    });

    const workouts = (data.withings?.workouts || []).filter((w) => w.startMs >= t0 && w.startMs <= t1);

    const chartMeals = data.meals.filter((m) => m.timestamp >= t0 && m.timestamp <= t1);

    const W = container.clientWidth || 358;
    const plotH = 220;
    const axisH = 28;
    const calH = 36;
    const H = plotH + axisH;
    const padL = 36;
    const padR = 8;
    const padT = 12;
    const padB = 8;
    const innerW = W - padL - padR;
    const dataH = plotH - padT - padB - calH;

    const { yMin, yMax } = computeYDomain(glucose, heartRate);
    const xOf = (t) => padL + ((t - t0) / (t1 - t0)) * innerW;
    const yOf = (v) => padT + dataH - ((v - yMin) / (yMax - yMin)) * dataH;
    const calYMax = 150;

    let svg = `<svg class="metabolic-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">`;

    // target band
    const bandTop = yOf(GLUCOSE_TARGET_MAX);
    const bandBot = yOf(GLUCOSE_TARGET_MIN);
    svg += `<rect x="${padL}" y="${bandTop}" width="${innerW}" height="${bandBot - bandTop}" fill="rgba(76,175,80,0.16)"/>`;

    // grid
    for (let v = Math.ceil(yMin / 10) * 10; v <= yMax; v += 10) {
      const y = yOf(v);
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8e8e8" stroke-width="1"/>`;
      if (v % 20 === 0) {
        svg += `<text x="4" y="${y + 4}" font-size="9" fill="#7c7c7c">${v}</text>`;
      }
    }

    // calorie bars (30-min buckets)
    const bucketMs = 30 * 60 * 1000;
    const calMap = new Map();
    for (const c of calories) {
      const t = Date.parse(c.timestamp);
      const b = Math.floor(t / bucketMs) * bucketMs;
      calMap.set(b, (calMap.get(b) || 0) + (c.kcal || c.value || 0));
    }
    for (const w of workouts) {
      const b = Math.floor(w.startMs / bucketMs) * bucketMs;
      calMap.set(b, (calMap.get(b) || 0) + (w.kcal || 0));
    }
    const barW = Math.max(2, innerW / Math.max(1, preset.ms / bucketMs) - 1);
    for (const [b, kcal] of calMap) {
      if (b < t0 || b > t1) continue;
      const x = xOf(b) - barW / 2;
      const h = (kcal / calYMax) * calH;
      const y = padT + dataH + calH - h;
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${h}" fill="#42A5F5" rx="1"/>`;
    }

    function pathFromPoints(points, color, width) {
      if (points.length < 2) return '';
      const sorted = [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      let d = '';
      sorted.forEach((p, i) => {
        const t = Date.parse(p.timestamp);
        const x = xOf(t);
        const y = yOf(p.value);
        d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      });
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round"/>`;
    }

    svg += pathFromPoints(heartRate, '#90CAF9', 1.5);
    svg += pathFromPoints(glucose, '#4CAF50', 2.2);

    // meal markers
    for (const m of chartMeals) {
      const x = xOf(m.timestamp);
      const y = padT + 6;
      svg += `<circle cx="${x}" cy="${y}" r="4" fill="#FF9800" stroke="#fff" stroke-width="1"/>`;
    }

    // x axis labels
    const axisY = plotH - 4;
    const ticks = 4;
    for (let i = 0; i <= ticks; i++) {
      const t = t0 + (i / ticks) * (t1 - t0);
      const x = xOf(t);
      const lbl = new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
      svg += `<text x="${x}" y="${axisY}" font-size="9" fill="#7c7c7c" text-anchor="middle">${lbl}</text>`;
    }

    svg += '</svg>';

    const dateStr = new Date(t0).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    const chips = VIEWPORT_PRESETS.map((p, i) =>
      `<button type="button" class="chip${i === viewportIndex ? ' active' : ''}" data-vp="${i}">${p.label}</button>`,
    ).join('');

    container.innerHTML = `
      <div class="chart-head">
        <span class="chart-title">${dateStr} · ${preset.label} window</span>
        <div class="chart-viewport-chips">${chips}</div>
      </div>
      ${svg}
      <div style="padding:4px 16px 10px;font-size:0.72rem;color:#7c7c7c">
        Green line = glucose · light blue = heart rate · bars = calories · orange dots = meals
      </div>`;

    container.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        drawMetabolicChart(container, data, parseInt(btn.getAttribute('data-vp'), 10));
      });
    });
  }

  function drawTrendChart(container, days) {
    if (!days || !days.length) {
      container.innerHTML = '<p class="empty-state">No body trend data</p>';
      return;
    }
    const slice = days.slice(-14);
    const W = container.clientWidth || 340;
    const H = 120;
    const padL = 36;
    const padR = 10;
    const innerW = W - padL - padR;
    const weights = slice.map((d) => d.weightKg).filter((v) => v != null);
    const fats = slice.map((d) => d.fatMassKg).filter((v) => v != null);
    const all = [...weights, ...fats];
    let lo = Math.min(...all) - 0.5;
    let hi = Math.max(...all) + 0.5;
    if (!Number.isFinite(lo)) { lo = 60; hi = 100; }
    const yOf = (v) => 16 + (H - 36) - ((v - lo) / (hi - lo)) * (H - 36);
    const xOf = (i) => padL + (i / Math.max(1, slice.length - 1)) * innerW;

    let pathW = '';
    let pathF = '';
    slice.forEach((d, i) => {
      if (d.weightKg != null) {
        const x = xOf(i);
        const y = yOf(d.weightKg);
        pathW += pathW ? ` L ${x} ${y}` : `M ${x} ${y}`;
      }
    });
    slice.forEach((d, i) => {
      if (d.fatMassKg != null) {
        const x = xOf(i);
        const y = yOf(d.fatMassKg);
        pathF += pathF ? ` L ${x} ${y}` : `M ${x} ${y}`;
      }
    });

    container.innerHTML = `
      <h3>Body trend (${slice.length}d)</h3>
      <svg viewBox="0 0 ${W} ${H}" width="100%" height="${H}">
        <path d="${pathW}" fill="none" stroke="#2196F3" stroke-width="2"/>
        <path d="${pathF}" fill="none" stroke="#FF5252" stroke-width="2"/>
        <text x="4" y="14" font-size="9" fill="#7c7c7c">kg</text>
      </svg>
      <div style="font-size:0.72rem;color:#7c7c7c;padding:0 8px 4px">
        <span style="color:#2196F3">●</span> weight &nbsp;
        <span style="color:#FF5252">●</span> fat mass
      </div>`;
  }

  function renderMacroBars(target, actual) {
    const rows = [
      { label: 'P', key: 'protein_g', color: '#42A5F5' },
      { label: 'C', key: 'carb_g', color: '#FF9800' },
      { label: 'F', key: 'fat_g', color: '#EF5350' },
    ];
    return rows.map((r) => {
      const val = actual[r.key] || 0;
      const tgt = target ? (target[r.key] || 0) : 0;
      const ratio = tgt > 0 ? Math.min(1, val / tgt) : 0;
      const text = tgt ? `${Math.round(val)}/${Math.round(tgt)}g` : `${Math.round(val)}g`;
      return `<div class="macro-row">
        <span>${r.label}</span>
        <div class="track"><div class="fill" style="width:${ratio * 100}%;background:${r.color}"></div></div>
        <span class="val">${text}</span>
      </div>`;
    }).join('');
  }

  function renderPhoneDashboard(screenEl, parsed, meta) {
    const body = parsed.withings?.bodyScan;
    const macros = dailyMacros(parsed.todayMeals);
    const mentorEmojis = parsed.mentors.map((m) => MENTOR_EMOJI[m] || '👤').join('');
    const coachActions = parsed.coachMsg?.actionItems || [];
    const doneCount = coachActions.filter((i) => i.done).length;

    const snapshotLine = meta
      ? `Snapshot v${meta.version} · shared ${new Date(meta.createdAt).toLocaleString()}`
      : `Exported ${parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString() : '—'}`;

    screenEl.innerHTML = `
      <div class="phone-scroll">
        <div class="brand-header">
          <div class="brand-text">HEALTHINGS.AI</div>
        </div>
        <div class="snapshot-banner">
          <strong>Read-only clinic view</strong> — ${escapeHtml(snapshotLine)}.
          Data is a patient snapshot, not live phone access.
        </div>
        ${parsed.coachMsg ? `
        <div class="nudge-strip">
          <span class="icons">${mentorEmojis}</span>
          <span class="count">${doneCount}/${coachActions.length}</span>
          <span style="flex:1;font-size:0.82rem;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
            ${escapeHtml(parsed.coachMsg.summary || parsed.coachMsg.text?.slice(0, 80) || 'Coach update')}
          </span>
          <span class="chevron">›</span>
        </div>` : ''}

        <div class="card chart-card">
          <div id="metabolic-chart-host"></div>
        </div>

        <div class="card body-card">
          <div class="body-card-head">
            <span class="logo-pill">Withings</span>
            <span class="status-ok">OK</span>
            <span style="margin-left:auto;font-size:0.75rem;color:#7c7c7c">from snapshot</span>
          </div>
          ${body ? `
          <div class="body-metrics">
            <div><div class="label">Weight</div><div class="value">${formatKg(body.weightKg)}</div></div>
            <div><div class="label">Muscle</div><div class="value">${formatKg(body.muscleMassKg)}</div></div>
            <div><div class="label">Fat</div><div class="value">${formatKg(body.fatMassKg)}</div></div>
          </div>
          ${body.bmrKcalDay != null ? `
          <div class="body-bmr">
            <span><span style="color:#7c7c7c;font-size:0.75rem">BMR</span> <strong>${formatKcal(body.bmrKcalDay)}</strong></span>
            <span style="color:#7c7c7c;font-size:0.75rem">${body.measuredAt ? new Date(body.measuredAt).toLocaleString() : ''}</span>
          </div>` : ''}` : '<p class="empty-state">No body scan in snapshot</p>'}
        </div>

        <div class="card trend-card">
          <div id="trend-chart-host"></div>
        </div>

        <div class="card food-card">
          <h3>Today's food</h3>
          <div class="food-day-label">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
          <div style="font-weight:800;font-size:1.1rem;margin-bottom:8px">${Math.round(macros.kcal)} kcal eaten</div>
          ${renderMacroBars(parsed.macroTarget, macros)}
          <div class="meal-list">
            ${parsed.todayMeals.length ? parsed.todayMeals.map((m) => `
              <div class="meal-item">
                <div>
                  <div>${escapeHtml(mealLabel(m))}</div>
                  <div class="time">${new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</div>
                </div>
                <div class="kcal">${Math.round(m.totalKcal || 0)} kcal</div>
              </div>`).join('') : '<p class="empty-state" style="padding:12px 0">No meals logged today in snapshot</p>'}
          </div>
        </div>

        ${parsed.coachMsg ? `
        <div class="card coach-card">
          <h3>AI coach</h3>
          <p>${escapeHtml(parsed.coachMsg.text || parsed.coachMsg.summary || '')}</p>
          ${coachActions.length ? `<div class="coach-actions">${doneCount} of ${coachActions.length} action items done</div>` : ''}
        </div>` : ''}
      </div>`;

    const chartHost = screenEl.querySelector('#metabolic-chart-host');
    const trendHost = screenEl.querySelector('#trend-chart-host');
    if (chartHost) drawMetabolicChart(chartHost, parsed, DEFAULT_VIEWPORT);
    if (trendHost) drawTrendChart(trendHost, parsed.withings?.bodyTrendDays || []);
  }

  global.ClinicDashboard = {
    parseSnapshot,
    renderPhoneDashboard,
  };
})(window);
