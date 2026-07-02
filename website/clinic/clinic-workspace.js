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

    let profile = { gender: null, heightCm: null, birthdate: null, age: null, language: null };
    try {
      if (store.user_gender) profile.gender = JSON.parse(store.user_gender);
      else if (store.user_gender) profile.gender = store.user_gender;
    } catch { profile.gender = store.user_gender || null; }
    try {
      const h = store.user_height_cm;
      if (h) profile.heightCm = parseInt(h, 10);
    } catch { /* */ }
    try {
      if (store.user_birthdate) {
        profile.birthdate = store.user_birthdate.replace(/^"|"$/g, '');
        const t = Date.parse(profile.birthdate);
        if (!Number.isNaN(t)) {
          const age = Math.floor((Date.now() - t) / (365.25 * 86400000));
          profile.age = age;
        }
      }
    } catch { /* */ }
    try {
      if (store.user_language) {
        const lang = JSON.parse(store.user_language);
        profile.language = lang.label || lang.code || null;
      }
    } catch { /* */ }

    let bodyTarget = null;
    try { if (store.body_target) bodyTarget = JSON.parse(store.body_target); } catch { /* */ }

    const mealsByDay = {};
    for (const m of meals) {
      const dk = m.day || dayKeyFromMs(m.timestamp);
      if (!mealsByDay[dk]) mealsByDay[dk] = [];
      mealsByDay[dk].push(m);
    }

    const today = todayKey();
    const todayMeals = meals.filter((m) => m.day === today || dayKeyFromMs(m.timestamp) === today);
    const eatenByDay = {};
    for (const m of meals) {
      const dk = m.day || dayKeyFromMs(m.timestamp);
      eatenByDay[dk] = (eatenByDay[dk] || 0) + (m.totalKcal || 0);
    }
    const burnByDay = withings && global.ClinicCharts ? global.ClinicCharts.computeBurnByDay(withings) : {};

    return {
      meals,
      mealsByDay,
      todayMeals,
      eatenByDay,
      burnByDay,
      chatFromSnapshot,
      glucose: cgm?.glucose || [],
      withings,
      macroTarget,
      bodyTarget,
      userRules,
      coachMsg,
      profile,
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
        fiber_g: a.fiber_g + (e.totalFiber_g || 0),
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

  function formatDayLabel(dayKey) {
    const t = Date.parse(dayKey + 'T12:00:00');
    const d = Number.isNaN(t) ? new Date() : new Date(t);
    const datePart = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return dayKey === todayKey() ? `Today - ${datePart}` : datePart;
  }

  function shiftDayKey(dayKey, delta) {
    const t = Date.parse(dayKey + 'T12:00:00');
    const d = new Date(t);
    d.setDate(d.getDate() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return next > todayKey() ? todayKey() : next;
  }

  function macroBar(label, val, tgt, color) {
    const ratio = tgt > 0 ? Math.min(1, val / tgt) : 0;
    const text = tgt ? `${Math.round(val)}/${Math.round(tgt)}g` : `${Math.round(val)}g`;
    return `<div class="macro-row"><span>${label}</span><div class="track"><div class="fill" style="width:${ratio * 100}%;background:${color}"></div></div><span>${text}</span></div>`;
  }

  function renderFoodLog(host, ctx) {
    const dk = ctx.foodDayKey || todayKey();
    const meals = ctx.parsed.mealsByDay[dk] || [];
    const macros = dailyMacros(meals);
    const target = ctx.parsed.macroTarget;
    const eaten = Math.round(macros.kcal);
    const burn = ctx.parsed.burnByDay[dk] ?? null;
    const balance = burn != null && eaten > 0 ? eaten - burn : null;
    const isToday = dk >= todayKey();
    const fiberT = target?.fiber_g ?? 30;

    host.innerHTML = `
      <div class="food-log-card">
        <div class="food-log-title">FOOD LOG</div>
        <div class="date-nav">
          <button type="button" class="nav-arrow" data-food-shift="-1">‹</button>
          <span class="date-label">${formatDayLabel(dk)}</span>
          <button type="button" class="nav-arrow" data-food-shift="1" ${isToday ? 'disabled' : ''}>›</button>
        </div>
        <div class="energy-lines">
          <div class="energy-row">${target
            ? `<span><strong>${eaten > 0 ? eaten.toLocaleString() : '—'}</strong> kcal eaten / <span class="muted">${target.kcal.toLocaleString()}</span></span>`
            : `<span><strong>${eaten > 0 ? eaten.toLocaleString() : '—'}</strong> kcal eaten</span>`}</div>
          ${burn != null ? `<div class="energy-row"><strong>${Math.round(burn).toLocaleString()}</strong> kcal burned</div>` : ''}
          ${balance != null ? `<div class="energy-row balance ${balance < 0 ? 'deficit' : 'surplus'}"><strong>${Math.abs(balance).toLocaleString()}</strong> kcal ${balance < 0 ? 'deficit' : 'surplus'}</div>` : ''}
        </div>
        ${macroBar('P', macros.protein_g, target?.protein_g, '#42A5F5')}
        ${macroBar('C', macros.carb_g, target?.carb_g, '#FF9800')}
        ${macroBar('F', macros.fat_g, target?.fat_g, '#EF5350')}
        ${macroBar('Fi', macros.fiber_g || 0, fiberT, '#66BB6A')}
        <div class="meal-list">${meals.length ? meals.map((m) => `
            <div class="meal-row">
              <span>${esc(mealLabel(m))} <span class="muted">${new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span></span>
              <strong>${Math.round(m.totalKcal || 0)} kcal</strong>
            </div>`).join('') : '<p class="empty">No meals this day</p>'}</div>
      </div>`;

    host.querySelector('[data-food-shift="-1"]')?.addEventListener('click', () => {
      ctx.foodDayKey = shiftDayKey(dk, -1);
      renderFoodLog(host, ctx);
    });
    host.querySelector('[data-food-shift="1"]')?.addEventListener('click', () => {
      if (!isToday) { ctx.foodDayKey = shiftDayKey(dk, 1); renderFoodLog(host, ctx); }
    });
  }

  function renderProfileTargets(host, ctx) {
    const p = ctx.parsed.profile || {};
    const parts = [p.gender, p.heightCm ? `${p.heightCm} cm` : null, p.age != null ? `${p.age} y` : null, p.language].filter(Boolean);
    const mt = ctx.parsed.macroTarget;
    const bt = ctx.parsed.bodyTarget;
    const coach = ctx.parsed.coachMsg;
    const mentors = ctx.parsed.mentors.map((m) => MENTORS.find((x) => x.id === m)?.emoji || m).join(' ');
    const bodyTargetLine = bt
      ? `${bt.targetWeight_kg?.toFixed?.(1) ?? bt.targetWeight_kg} kg · fat ${bt.targetFatPct}% · muscle ${bt.targetMuscleMass_kg?.toFixed?.(1) ?? bt.targetMuscleMass_kg} kg`
      : null;
    host.innerHTML = `
      <div class="group-card">
        <div class="collapse-row"><span class="row-icon">👤</span><div><strong>My Profile</strong><div class="sub">${parts.join(' · ') || 'Not set in snapshot'}</div></div></div>
        <div class="collapse-row"><span class="row-icon">🎯</span><div><strong>My Targets</strong>
          ${mt ? `<div class="sub">${esc(mt.diet_label || 'Macros')}: ${mt.kcal} kcal · P${mt.protein_g} C${mt.carb_g} F${mt.fat_g}g</div>` : '<div class="sub">No macro targets</div>'}
          ${bodyTargetLine ? `<div class="sub">Body: ${esc(bodyTargetLine)}</div>` : ''}
        </div></div>
        ${coach ? `<div class="collapse-row"><span class="row-icon">${mentors}</span><div><strong>Coach</strong><div class="sub">${esc(coach.summary || coach.text?.slice(0, 120) || '')}</div></div></div>` : ''}
      </div>`;
  }

  function paintDashboardCharts(panel, ctx) {
    const charts = global.ClinicCharts;
    if (!charts) return;
    const metabolicHost = panel.querySelector('#metabolic-host');
    if (metabolicHost) {
      if (ctx.chartVp == null) ctx.chartVp = 1;
      if (ctx.chartEndMs == null) ctx.chartEndMs = Date.now();
      charts.drawMetabolicChart(metabolicHost, ctx.parsed, ctx, () => paintDashboardCharts(panel, ctx));
    }
    const trendHost = panel.querySelector('#trend-host');
    if (trendHost) {
      const allDays = ctx.parsed.withings?.bodyTrendDays || [];
      const pd = ctx.trendPeriod ?? 32;
      charts.drawTrendAnalysis(
        trendHost,
        allDays,
        ctx.parsed.withings?.bodyTrendSessions || [],
        pd,
        allDays.length,
        (p) => {
          ctx.trendPeriod = p;
          paintDashboardCharts(panel, ctx);
        },
      );
    }
    const energyHost = panel.querySelector('#energy-host');
    if (energyHost) charts.drawEnergyChart(energyHost, ctx.parsed.withings?.bodyTrendDays || [], ctx.parsed.eatenByDay, ctx.parsed.burnByDay);
    const foodHost = panel.querySelector('#food-host');
    if (foodHost) renderFoodLog(foodHost, ctx);
    const profileHost = panel.querySelector('#profile-host');
    if (profileHost) renderProfileTargets(profileHost, ctx);
    const lipidHost = panel.querySelector('#lipid-host');
    if (lipidHost) charts.drawLipidChart(lipidHost, ctx.parsed.labs);
  }

  function renderDashboard(panel, ctx) {
    const body = ctx.parsed.withings?.bodyScan;
    const coach = ctx.parsed.coachMsg;
    const mentors = ctx.parsed.mentors.map((m) => MENTORS.find((x) => x.id === m)?.emoji || '').join('');
    panel.innerHTML = `
      <p class="snapshot-note">Read-only snapshot · patient phone data · v${ctx.blob.version}</p>
      ${coach ? `<div class="nudge-strip"><span>${mentors}</span><span class="nudge-count">${(coach.actionItems || []).filter((i) => i.done).length}/${(coach.actionItems || []).length}</span><span class="nudge-text">${esc(coach.summary || '')}</span></div>` : ''}
      <div class="dash-card metabolic-card"><div id="metabolic-host"></div></div>
      <div class="dash-card withings-card">
        <div class="withings-head"><span class="withings-logo">Withings</span><span class="status-ok">OK</span><span class="muted">snapshot</span></div>
        ${body ? `<div class="body-metrics-row">
          <div><div class="lbl">Weight</div><div class="val">${body.weightKg != null ? body.weightKg.toFixed(1) + ' kg' : '—'}</div></div>
          <div><div class="lbl">Muscle</div><div class="val">${body.muscleMassKg != null ? body.muscleMassKg.toFixed(1) + ' kg' : '—'}</div></div>
          <div><div class="lbl">Fat</div><div class="val">${body.fatMassKg != null ? body.fatMassKg.toFixed(1) + ' kg' : '—'}</div></div>
        </div>${body.bmrKcalDay ? `<div class="bmr-row">BMR <strong>${Math.round(body.bmrKcalDay)} kcal</strong></div>` : ''}` : '<p class="empty">No body scan</p>'}
      </div>
      <div class="dash-card"><div id="trend-host"></div></div>
      <div class="dash-card"><div id="energy-host"></div></div>
      <div class="grid-2">
        <div class="dash-card"><div id="food-host"></div></div>
        <div class="dash-card"><div id="profile-host"></div><div id="lipid-host" style="margin-top:16px"></div></div>
      </div>`;
    paintDashboardCharts(panel, ctx);
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
