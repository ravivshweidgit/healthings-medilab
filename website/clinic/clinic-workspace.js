/**
 * Full-width clinic workspace — patient dashboard, mentor chat, live rules, labs.
 */
(function (global) {
  const CGM_KEY = 'healthings:lastMetrics';
  const WITHINGS_KEY = 'healthings:withingsStore';
  const COACH_KEY = 'coach_message_today';
  const MACRO_KEY = 'daily_macro_target';
  const RULES_KEY = 'user_rules';
  const MENTOR_KEY = 'user_mentors';

  const MENTORS = [
    { id: 'doctor', label: 'Doctor', emoji: '🩺' },
    { id: 'nutritionist', label: 'Nutritionist', emoji: '🥗' },
    { id: 'coach', label: 'Coach', emoji: '💪' },
  ];

  const MS_HOUR = 3600000;
  const MS_DAY = 86400000;
  const VIEWPORT_PRESETS = [
    { label: '6H', ms: 6 * MS_HOUR },
    { label: '12H', ms: 12 * MS_HOUR },
    { label: '24H', ms: MS_DAY },
    { label: '2D', ms: 2 * MS_DAY },
    { label: '7D', ms: 7 * MS_DAY },
  ];

  function esc(s) {
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
    const chatFromSnapshot = {};

    for (const [key, raw] of Object.entries(store)) {
      const fm = key.match(/^food_log_(\d{4}-\d{2}-\d{2})$/);
      if (fm) {
        try {
          for (const meal of JSON.parse(raw)) meals.push({ day: fm[1], ...meal });
        } catch { /* */ }
        continue;
      }
      const cm = key.match(/^chat_history_(\d{4}-\d{2}-\d{2})(?:_(doctor|nutritionist|coach))?$/);
      if (cm) {
        const mentor = cm[2] || 'nutritionist';
        try {
          const rows = JSON.parse(raw);
          if (!chatFromSnapshot[mentor]) chatFromSnapshot[mentor] = [];
          for (const m of rows) {
            chatFromSnapshot[mentor].push({
              role: m.role === 'user' ? 'user' : 'assistant',
              text: m.text,
              sentAt: m.sentAt,
              fromSnapshot: true,
            });
          }
        } catch { /* */ }
      }
    }

    meals.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    let cgm = null;
    let withings = null;
    let macroTarget = null;
    let userRules = null;
    let coachMsg = null;
    let mentors = ['nutritionist'];

    try { if (store[CGM_KEY]) cgm = JSON.parse(store[CGM_KEY]); } catch { /* */ }
    try { if (store[WITHINGS_KEY]) withings = JSON.parse(store[WITHINGS_KEY]); } catch { /* */ }
    try { if (store[MACRO_KEY]) macroTarget = JSON.parse(store[MACRO_KEY]); } catch { /* */ }
    try { if (store[RULES_KEY]) userRules = JSON.parse(store[RULES_KEY]); } catch { /* */ }
    try { if (store[COACH_KEY]) coachMsg = JSON.parse(store[COACH_KEY]); } catch { /* */ }
    try { if (store[MENTOR_KEY]) mentors = JSON.parse(store[MENTOR_KEY]); } catch { /* */ }

    const today = todayKey();
    const todayMeals = meals.filter((m) => m.day === today || dayKeyFromMs(m.timestamp) === today);

    return {
      meals,
      todayMeals,
      chatFromSnapshot,
      glucose: cgm?.glucose || [],
      withings,
      macroTarget,
      userRules,
      coachMsg,
      mentors: Array.isArray(mentors) ? mentors : ['nutritionist'],
      labs: parseLabs(store),
    };
  }

  function parseLabs(store) {
    const labs = [];
    for (const [key, raw] of Object.entries(store)) {
      if (!key.startsWith('lab_report_')) continue;
      try { labs.push(JSON.parse(raw)); } catch { /* */ }
    }
    return labs.sort((a, b) => (b.collectedAt || '').localeCompare(a.collectedAt || ''));
  }

  function dailyMacros(entries) {
    return entries.reduce(
      (a, e) => ({
        kcal: a.kcal + (e.totalKcal || 0),
        protein_g: a.protein_g + (e.totalProtein_g || 0),
        carb_g: a.carb_g + (e.totalCarb_g || 0),
        fat_g: a.fat_g + (e.totalFat_g || 0),
      }),
      { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0 },
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

  function mergeChat(snapshotChat, overlayChat, mentorId) {
    const a = snapshotChat[mentorId] || [];
    const b = overlayChat[mentorId] || [];
    const all = [...a, ...b].sort((x, y) => x.sentAt.localeCompare(y.sentAt));
    const seen = new Set();
    return all.filter((m) => {
      const k = `${m.sentAt}|${m.role}|${m.text}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  function drawMetabolicChart(host, data, viewportIndex) {
    const preset = VIEWPORT_PRESETS[viewportIndex] ?? VIEWPORT_PRESETS[1];
    const t1 = Date.now();
    const t0 = t1 - preset.ms;
    const W = host.clientWidth || 900;
    const plotH = 280;
    const axisH = 28;
    const calH = 40;
    const H = plotH + axisH;
    const padL = 44;
    const padR = 12;
    const padT = 14;
    const padB = 8;
    const innerW = W - padL - padR;
    const dataH = plotH - padT - padB - calH;

    const glucose = data.glucose.filter((p) => {
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
    const workouts = (data.withings?.workouts || []).filter((w) => w.startMs >= t0 && w.startMs <= t1);
    const chartMeals = data.meals.filter((m) => m.timestamp >= t0 && m.timestamp <= t1);

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

    let svg = `<svg class="metabolic-svg" viewBox="0 0 ${W} ${H}" width="100%" height="${H}">`;
    svg += `<rect x="${padL}" y="${yOf(100)}" width="${innerW}" height="${yOf(70) - yOf(100)}" fill="rgba(76,175,80,0.14)"/>`;

    for (let v = Math.ceil(yMin / 10) * 10; v <= yMax; v += 10) {
      const y = yOf(v);
      svg += `<line x1="${padL}" y1="${y}" x2="${W - padR}" y2="${y}" stroke="#e8e8e8"/>`;
      if (v % 20 === 0) svg += `<text x="6" y="${y + 4}" font-size="10" fill="#888">${v}</text>`;
    }

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
    const barW = Math.max(3, innerW / Math.max(1, preset.ms / bucketMs) - 1);
    for (const [b, kcal] of calMap) {
      if (b < t0 || b > t1) continue;
      const h = (kcal / 150) * calH;
      svg += `<rect x="${xOf(b) - barW / 2}" y="${padT + dataH + calH - h}" width="${barW}" height="${h}" fill="#42A5F5" rx="1"/>`;
    }

    function path(points, color, w) {
      if (points.length < 2) return '';
      const sorted = [...points].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
      let d = '';
      sorted.forEach((p, i) => {
        const x = xOf(Date.parse(p.timestamp));
        const y = yOf(p.value);
        d += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
      });
      return `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}"/>`;
    }

    svg += path(heartRate, '#90CAF9', 1.5);
    svg += path(glucose, '#4CAF50', 2.5);
    for (const m of chartMeals) {
      svg += `<circle cx="${xOf(m.timestamp)}" cy="${padT + 8}" r="5" fill="#FF9800" stroke="#fff" stroke-width="1"/>`;
    }
    for (let i = 0; i <= 5; i++) {
      const t = t0 + (i / 5) * (t1 - t0);
      svg += `<text x="${xOf(t)}" y="${plotH - 2}" font-size="10" fill="#888" text-anchor="middle">${new Date(t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</text>`;
    }
    svg += '</svg>';

    const chips = VIEWPORT_PRESETS.map((p, i) =>
      `<button type="button" class="chip${i === viewportIndex ? ' active' : ''}" data-vp="${i}">${p.label}</button>`,
    ).join('');

    host.innerHTML = `
      <div class="chart-head">
        <strong>Metabolic chart</strong>
        <div>${chips}</div>
      </div>
      <div class="chart-wrap">${svg}</div>
      <p class="sub">Glucose (green) · heart rate (blue) · calories (bars) · meals (orange dots). From patient snapshot.</p>`;

    host.querySelectorAll('.chip').forEach((btn) => {
      btn.addEventListener('click', () => drawMetabolicChart(host, data, parseInt(btn.getAttribute('data-vp'), 10)));
    });
  }

  function renderDashboard(panel, ctx) {
    const { parsed, blob } = ctx;
    const body = parsed.withings?.bodyScan;
    const macros = dailyMacros(parsed.todayMeals);
    const coach = parsed.coachMsg;

    panel.innerHTML = `
      <div class="card" style="margin-bottom:20px;background:#fff">
        <div id="metabolic-host"></div>
      </div>
      <div class="grid-3" style="margin-bottom:20px">
        <div class="card">
          <h3>Body (Withings)</h3>
          ${body ? `
          <div class="metric-grid" style="grid-template-columns:1fr 1fr">
            <div class="metric-box"><div class="lbl">Weight</div><div class="val">${body.weightKg != null ? body.weightKg.toFixed(1) + ' kg' : '—'}</div></div>
            <div class="metric-box"><div class="lbl">Muscle</div><div class="val">${body.muscleMassKg != null ? body.muscleMassKg.toFixed(1) + ' kg' : '—'}</div></div>
            <div class="metric-box"><div class="lbl">Fat</div><div class="val">${body.fatMassKg != null ? body.fatMassKg.toFixed(1) + ' kg' : '—'}</div></div>
            <div class="metric-box"><div class="lbl">BMR</div><div class="val">${body.bmrKcalDay != null ? Math.round(body.bmrKcalDay) + '' : '—'}</div></div>
          </div>` : '<p class="empty">No body data in snapshot</p>'}
        </div>
        <div class="card">
          <h3>Today's nutrition</h3>
          <p style="font-size:1.4rem;font-weight:800;margin:0 0 12px">${Math.round(macros.kcal)} kcal</p>
          ${macroBar('P', macros.protein_g, parsed.macroTarget?.protein_g, '#42A5F5')}
          ${macroBar('C', macros.carb_g, parsed.macroTarget?.carb_g, '#FF9800')}
          ${macroBar('F', macros.fat_g, parsed.macroTarget?.fat_g, '#EF5350')}
          <div style="margin-top:12px">
            ${parsed.todayMeals.slice(0, 6).map((m) => `
              <div class="meal-row">
                <span>${esc(mealLabel(m))} <span style="color:#888;font-size:0.8rem">${new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></span>
                <strong>${Math.round(m.totalKcal || 0)} kcal</strong>
              </div>`).join('') || '<p class="sub">No meals today in snapshot</p>'}
          </div>
        </div>
        <div class="card">
          <h3>AI coach (snapshot)</h3>
          ${coach ? `<p style="line-height:1.5;font-size:0.92rem">${esc(coach.summary || coach.text || '')}</p>
            <p class="sub">${coach.actionItems?.length || 0} action items in patient app</p>` : '<p class="empty">No coach message in snapshot</p>'}
          <p class="sub" style="margin-top:12px">Snapshot v${blob.version} · ${blob.summary?.lookbackMode === 'full' ? 'full history' : (blob.summary?.lookbackDays || 90) + ' days'}</p>
        </div>
      </div>`;

    const host = panel.querySelector('#metabolic-host');
    if (host) drawMetabolicChart(host, parsed, 1);
  }

  function macroBar(label, val, tgt, color) {
    const ratio = tgt > 0 ? Math.min(1, val / tgt) : 0;
    const text = tgt ? `${Math.round(val)}/${Math.round(tgt)}g` : `${Math.round(val)}g`;
    return `<div class="macro-row"><span>${label}</span><div class="track"><div class="fill" style="width:${ratio * 100}%;background:${color}"></div></div><span>${text}</span></div>`;
  }

  function renderChat(panel, ctx) {
    const activeMentor = ctx.activeMentor || 'nutritionist';
    const thread = mergeChat(ctx.parsed.chatFromSnapshot, ctx.overlay?.chat || {}, activeMentor);

    panel.innerHTML = `
      <p class="sub" style="margin:0 0 16px">Chat with the patient's AI mentors using snapshot data. Messages are saved for the clinic and synced to the patient's rules context.</p>
      <div class="chat-layout">
        <div class="mentor-nav">
          ${MENTORS.map((m) => `
            <button type="button" class="mentor-pick${m.id === activeMentor ? ' active' : ''}" data-mentor="${m.id}">
              ${m.emoji} ${m.label}
            </button>`).join('')}
        </div>
        <div class="chat-thread">
          <div class="chat-messages" id="chat-msgs">
            ${thread.length ? thread.map((m) => bubbleHtml(m)).join('') : '<p class="empty">No messages yet — ask about meals, glucose, or goals.</p>'}
          </div>
          <div class="chat-compose">
            <textarea id="chat-input" placeholder="Message ${MENTORS.find((m) => m.id === activeMentor)?.label}…" rows="2"></textarea>
            <button type="button" class="ws-btn primary" id="chat-send">Send</button>
          </div>
        </div>
      </div>`;

    panel.querySelectorAll('.mentor-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.activeMentor = btn.getAttribute('data-mentor');
        renderChat(panel, ctx);
      });
    });

    const send = panel.querySelector('#chat-send');
    const input = panel.querySelector('#chat-input');
    send?.addEventListener('click', () => void sendChat(ctx, input, panel));
    input?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void sendChat(ctx, input, panel);
      }
    });

    const msgs = panel.querySelector('#chat-msgs');
    if (msgs) msgs.scrollTop = msgs.scrollHeight;
  }

  function bubbleHtml(m) {
    const cls = m.role === 'user' ? 'user' : 'assistant';
    const who = m.role === 'user' ? (m.fromClinic ? 'Clinic' : 'Patient') : 'Mentor';
    return `<div class="bubble ${cls}"><div>${esc(m.text)}</div><div class="time">${who} · ${new Date(m.sentAt).toLocaleString()}</div></div>`;
  }

  async function sendChat(ctx, input, panel) {
    const text = input?.value?.trim();
    if (!text || !ctx.api) return;
    const btn = panel.querySelector('#chat-send');
    if (btn) btn.disabled = true;
    try {
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/chat`, {
        method: 'POST',
        body: JSON.stringify({ mentorType: ctx.activeMentor || 'nutritionist', message: text }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Chat failed');
      const data = await res.json();
      if (!ctx.overlay) ctx.overlay = { chat: {} };
      ctx.overlay.chat[ctx.activeMentor || 'nutritionist'] = data.thread;
      input.value = '';
      renderChat(panel, ctx);
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Chat failed');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function effectiveRules(parsed, overlay) {
    if (overlay?.rules) return overlay.rules;
    return parsed.userRules;
  }

  function renderRules(panel, ctx) {
    const rules = effectiveRules(ctx.parsed, ctx.overlay);
    const raw = rules?.rawText || '';

    panel.innerHTML = `
      <p class="sub" style="margin:0 0 16px"><strong>Live rules</strong> — edits save to the server and sync to the patient's phone when they open the app.</p>
      <div class="rules-editor">
        <label for="rules-raw"><strong>Patient dietary rules</strong></label>
        <textarea id="rules-raw" placeholder="e.g. Low cholesterol, carbs at least 130g, avoid red meat…">${esc(raw)}</textarea>
        <div style="margin-top:12px;display:flex;gap:10px;align-items:center">
          <button type="button" class="ws-btn primary" id="rules-save">Save &amp; analyse with AI</button>
          <span id="rules-status" class="sub"></span>
        </div>
        ${rules?.constraints?.length ? `
        <div class="rules-constraints">
          <strong>AI understood:</strong>
          <ul>${rules.constraints.map((c) => `<li>✓ ${esc(c)}</li>`).join('')}</ul>
          ${rules.summary ? `<p class="sub">Summary: ${esc(rules.summary)}</p>` : ''}
        </div>` : ''}
        <p class="rules-hint">Snapshot rules are shown until you save. After save, clinic rules override on the server.</p>
      </div>`;

    panel.querySelector('#rules-save')?.addEventListener('click', () => void saveRules(ctx, panel));
  }

  async function saveRules(ctx, panel) {
    const raw = panel.querySelector('#rules-raw')?.value?.trim();
    if (!raw) return;
    const status = panel.querySelector('#rules-status');
    const btn = panel.querySelector('#rules-save');
    if (btn) btn.disabled = true;
    if (status) status.textContent = 'Saving…';
    try {
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/rules`, {
        method: 'PUT',
        body: JSON.stringify({ rawText: raw }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Save failed');
      const data = await res.json();
      ctx.overlay = data.overlay;
      if (status) status.textContent = 'Saved — patient will receive on next app open';
      renderRules(panel, ctx);
    } catch (e) {
      if (status) status.textContent = '';
      alert(e instanceof Error ? e.message : 'Save failed');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderLabs(panel, ctx) {
    const labs = ctx.parsed.labs;
    if (!labs.length) {
      panel.innerHTML = '<p class="empty">No lab reports in this snapshot.</p>';
      return;
    }
    panel.innerHTML = labs.map((report) => `
      <div class="lab-panel">
        <h3>${esc(report.collectedAt || 'Lab report')}</h3>
        <table class="data-table">
          <thead><tr><th>Test</th><th>Value</th><th>Flag</th></tr></thead>
          <tbody>
            ${(report.panels || []).flatMap((p) => (p.results || []).map((r) => `
              <tr>
                <td>${esc(r.name || r.code)}</td>
                <td>${r.value} ${esc(r.unit || '')}</td>
                <td>${r.flag && r.flag !== 'normal' ? esc(r.flag) : ''}</td>
              </tr>`)).join('')}
          </tbody>
        </table>
      </div>`).join('');
  }

  function renderWorkspace(root, ctx) {
    const tab = ctx.tab || 'dashboard';
    root.innerHTML = `
      <div class="ws-panel">
        <div id="tab-body"></div>
      </div>`;
    const body = root.querySelector('#tab-body');
    if (!body) return;
    if (tab === 'dashboard') renderDashboard(body, ctx);
    else if (tab === 'chat') renderChat(body, ctx);
    else if (tab === 'rules') renderRules(body, ctx);
    else if (tab === 'labs') renderLabs(body, ctx);
  }

  function initTabs(tabsEl, ctx, mainEl) {
    const tabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'chat', label: 'Mentors & chat' },
      { id: 'rules', label: 'Rules (live)' },
      { id: 'labs', label: 'Labs' },
    ];
    function paint() {
      tabsEl.innerHTML = tabs.map((t) =>
        `<button type="button" class="ws-tab${ctx.tab === t.id ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`,
      ).join('');
      tabsEl.querySelectorAll('.ws-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          ctx.tab = btn.getAttribute('data-tab');
          paint();
          renderWorkspace(mainEl, ctx);
        });
      });
    }
    paint();
  }

  global.ClinicWorkspace = {
    parseSnapshot,
    initTabs,
    renderWorkspace,
    mergeChat,
    effectiveRules,
  };
})(window);
