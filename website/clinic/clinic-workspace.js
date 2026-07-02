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
    const over = tgt > 0 && val > tgt * 1.05;
    const text = tgt ? `${Math.round(val)}/${Math.round(tgt)}g` : `${Math.round(val)}g`;
    const fillColor = over ? '#EF5350' : color;
    return `<div class="macro-row"><span>${label}</span><div class="track"><div class="fill" style="width:${ratio * 100}%;background:${fillColor}"></div></div><span class="${over ? 'macro-over' : ''}">${text}</span></div>`;
  }

  function entryFiber(meal) {
    if (meal.totalFiber_g != null && Number.isFinite(meal.totalFiber_g)) return meal.totalFiber_g;
    return (meal.items || []).reduce((a, i) => a + (i.fiber_g || 0), 0);
  }

  function macroSummaryMeal(meal) {
    const items = meal.items || [];
    if (items.length) {
      const t = items.reduce(
        (a, i) => ({
          kcal: a.kcal + (i.kcal || 0),
          p: a.p + (i.protein_g || 0),
          c: a.c + (i.carb_g || 0),
          f: a.f + (i.fat_g || 0),
          fi: a.fi + (i.fiber_g || 0),
        }),
        { kcal: 0, p: 0, c: 0, f: 0, fi: 0 },
      );
      return `${Math.round(t.kcal)} kcal · P ${t.p.toFixed(0)}g · C ${t.c.toFixed(0)}g · F ${t.f.toFixed(0)}g · Fi ${t.fi.toFixed(0)}g`;
    }
    return `${Math.round(meal.totalKcal || 0)} kcal · P ${Math.round(meal.totalProtein_g || 0)}g · C ${Math.round(meal.totalCarb_g || 0)}g · F ${Math.round(meal.totalFat_g || 0)}g · Fi ${Math.round(entryFiber(meal))}g`;
  }

  function showMealModal(panel, meal) {
    const modalRoot = panel.querySelector('#meal-modal-root');
    if (!modalRoot) return;
    const items = meal.items || [];
    const title = mealLabel(meal);
    const time = new Date(meal.timestamp).toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
    const itemsHtml = items.length
      ? items.map((item, i) => {
        const flagged = item.rule_conflict;
        const name = esc(item.name_local || item.name || 'Item');
        return `
          <div class="meal-item-row${flagged ? ' flagged' : ''}">
            <div class="meal-item-name">${flagged ? '⚠ ' : ''}${name}</div>
            ${flagged && item.rule_message ? `<div class="meal-item-rule">${esc(item.rule_message)}</div>` : ''}
            <div class="meal-item-grams">${Math.round(item.grams || 0)}g</div>
            <div class="meal-item-metrics">
              <span class="meal-item-kcal">${Math.round(item.kcal || 0)} kcal</span>
              <span class="meal-item-macros">P ${item.protein_g ?? 0}g · C ${item.carb_g ?? 0}g · F ${item.fat_g ?? 0}g · Fi ${item.fiber_g ?? 0}g</span>
            </div>
          </div>`;
      }).join('')
      : `<p class="empty" style="padding:16px">No item breakdown in snapshot (totals only).</p>
         <div class="meal-totals-only">
           <strong>${Math.round(meal.totalKcal || 0)} kcal</strong>
           · P ${Math.round(meal.totalProtein_g || 0)}g · C ${Math.round(meal.totalCarb_g || 0)}g · F ${Math.round(meal.totalFat_g || 0)}g
         </div>`;

    modalRoot.hidden = false;
    modalRoot.innerHTML = `
      <div class="meal-modal-overlay" data-close-meal>
        <div class="meal-modal-card" role="dialog" aria-label="Meal details">
          <div class="meal-modal-head">
            <div>
              <div class="meal-modal-title">${esc(title)}</div>
              <div class="meal-modal-time">${esc(time)}</div>
            </div>
            <button type="button" class="meal-modal-close" data-close-meal aria-label="Close">✕</button>
          </div>
          ${meal.note ? `<p class="meal-modal-note">${esc(meal.note)}</p>` : ''}
          <div class="meal-items-card">${itemsHtml}
            <div class="meal-item-row meal-item-total">
              <span class="meal-item-kcal">${macroSummaryMeal(meal)}</span>
            </div>
          </div>
          <p class="meal-modal-readonly">Read-only snapshot from patient app</p>
        </div>
      </div>`;

    modalRoot.querySelector('.meal-modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.classList.contains('meal-modal-overlay')) {
        modalRoot.hidden = true;
        modalRoot.innerHTML = '';
      }
    });
    modalRoot.querySelector('.meal-modal-card')?.addEventListener('click', (e) => e.stopPropagation());
    modalRoot.querySelector('.meal-modal-close')?.addEventListener('click', () => {
      modalRoot.hidden = true;
      modalRoot.innerHTML = '';
    });
  }

  function renderFoodLog(host, ctx, panel) {
    const dk = ctx.foodDayKey || todayKey();
    const meals = [...(ctx.parsed.mealsByDay[dk] || [])].sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));
    const macros = dailyMacros(meals);
    const target = ctx.parsed.macroTarget;
    const eaten = Math.round(macros.kcal);
    const burn = ctx.parsed.burnByDay[dk] ?? null;
    const balance = burn != null && eaten > 0 ? eaten - burn : null;
    const isToday = dk >= todayKey();
    const fiberT = target?.fiber_g ?? 30;
    const isDeficit = balance != null && balance < 0;

    host.innerHTML = `
      <div class="food-log-card">
        <div class="food-log-title">FOOD LOG</div>
        <div class="date-nav food-date-nav">
          <button type="button" class="nav-arrow" data-food-shift="-1" aria-label="Previous day">‹</button>
          <span class="date-label">${formatDayLabel(dk)}</span>
          <button type="button" class="nav-arrow" data-food-shift="1" ${isToday ? 'disabled' : ''} aria-label="Next day">›</button>
        </div>
        <div class="energy-lines">
          <div class="energy-row">
            ${target
              ? `<span class="energy-num">${eaten > 0 ? eaten.toLocaleString() : '—'}</span><span class="energy-label">kcal eaten <span class="energy-target">/ ${target.kcal.toLocaleString()}</span></span>`
              : `<span class="energy-num">${eaten > 0 ? eaten.toLocaleString() : '—'}</span><span class="energy-label">kcal eaten</span>`}
          </div>
          ${burn != null ? `<div class="energy-row"><span class="energy-num">${Math.round(burn).toLocaleString()}</span><span class="energy-label">kcal burned</span></div>` : ''}
          ${balance != null ? `<div class="balance-pill ${isDeficit ? 'deficit' : 'surplus'}"><span class="energy-num">${Math.abs(balance).toLocaleString()}</span><span class="energy-label">kcal ${isDeficit ? 'deficit' : 'surplus'}</span></div>` : ''}
        </div>
        ${(meals.length || target) ? `
        <div class="macro-bars">
          ${macroBar('P', macros.protein_g, target?.protein_g, '#42A5F5')}
          ${macroBar('C', macros.carb_g, target?.carb_g, '#FF9800')}
          ${macroBar('F', macros.fat_g, target?.fat_g, '#EF5350')}
          ${macroBar('Fi', macros.fiber_g || 0, fiberT, '#66BB6A')}
        </div>` : ''}
        <div class="meal-chips-row">
          ${meals.length ? meals.map((m, i) => `
            <button type="button" class="meal-chip" data-meal-idx="${i}">
              <span class="chip-time">${new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
              <span class="chip-label">${esc(mealLabel(m))}</span>
              <span class="chip-kcal">${Math.round(m.totalKcal || 0)} kcal</span>
              <span class="chip-view">✎ view</span>
            </button>`).join('') : '<p class="empty" style="padding:12px 0">No meals this day</p>'}
        </div>
      </div>`;

    const rerender = () => {
      if (panel) renderFoodLog(host, ctx, panel);
      else renderFoodLog(host, ctx);
    };

    host.querySelector('[data-food-shift="-1"]')?.addEventListener('click', () => {
      ctx.foodDayKey = shiftDayKey(dk, -1);
      rerender();
    });
    host.querySelector('[data-food-shift="1"]')?.addEventListener('click', () => {
      if (!isToday) { ctx.foodDayKey = shiftDayKey(dk, 1); rerender(); }
    });
    host.querySelectorAll('.meal-chip').forEach((chip) => {
      chip.addEventListener('click', () => {
        const idx = parseInt(chip.getAttribute('data-meal-idx'), 10);
        const meal = meals[idx];
        if (meal && panel) showMealModal(panel, meal);
      });
    });
  }

  function renderFoodLogTab(panel, ctx) {
    panel.innerHTML = `
      <p class="sub snapshot-note" style="margin:0 0 16px">Patient food log from snapshot — read-only. Click a meal card to see items like on the phone.</p>
      <div class="food-log-page">
        <div class="dash-card food-log-panel"><div id="food-log-host"></div></div>
        <div id="meal-modal-root" hidden></div>
      </div>`;
    const host = panel.querySelector('#food-log-host');
    if (host) renderFoodLog(host, ctx, panel);
  }

  function mentorMeta(id) {
    return MENTORS.find((x) => x.id === id) || { id, label: id, emoji: '•' };
  }

  function mentorsHeaderSub(mentors) {
    return mentors.map((m) => {
      const x = mentorMeta(m);
      return `${x.emoji} ${x.label}`;
    }).join(' · ') || 'No mentors selected';
  }

  function fiberTarget_g(mt) {
    if (!mt) return 30;
    return mt.fiber_g ?? mt.aiSuggested?.fiber_g ?? 30;
  }

  function expandPcfPriority(pcfPriority) {
    const map = {
      'P (cap) → C+Fi → F (remainder)': 'Protein (cap) → Carbohydrate + fiber → Fat (fills remaining kcal)',
      'P → C+Fi → F (remainder)': 'Protein → Carbohydrate + fiber → Fat (fills remaining kcal)',
      'C+Fi → P → F (remainder)': 'Carbohydrate + fiber → Protein → Fat (fills remaining kcal)',
      'C (cap) → P → F (remainder)': 'Carbohydrate (cap) → Protein → Fat (fills remaining kcal)',
      'P (cap) → C+Fi → F (fill)': 'Protein (cap) → Carbohydrate + fiber → Fat (fills remaining kcal)',
      'P → C+Fi → F (fill)': 'Protein → Carbohydrate + fiber → Fat (fills remaining kcal)',
      'C+Fi → P → F (fill)': 'Carbohydrate + fiber → Protein → Fat (fills remaining kcal)',
      'C (cap) → P → F (fill)': 'Carbohydrate (cap) → Protein → Fat (fills remaining kcal)',
      'P (cap) → C+Fi → F (suppl.)': 'Protein (cap) → Carbohydrate + fiber → Fat (fills remaining kcal)',
      'P → C+Fi → F (suppl.)': 'Protein → Carbohydrate + fiber → Fat (fills remaining kcal)',
      'C+Fi → P → F (suppl.)': 'Carbohydrate + fiber → Protein → Fat (fills remaining kcal)',
      'C (cap) → P → F (suppl.)': 'Carbohydrate (cap) → Protein → Fat (fills remaining kcal)',
    };
    return map[pcfPriority] ?? pcfPriority;
  }

  function renderClinicalProfileBanner(mt) {
    if (!mt?.clinical_profile?.trim()) return '';
    const pcfShort = mt.pcf_priority?.trim() || null;
    const pcfExpanded = pcfShort ? expandPcfPriority(pcfShort) : null;
    return `
      <div class="clinical-profile-banner">
        <div class="clinical-profile-title">Clinical profile</div>
        <div class="clinical-profile-text">${esc(mt.clinical_profile.trim())}</div>
        ${pcfShort ? `
          <div class="clinical-pcf-row">
            <div class="clinical-pcf-label">Macro priority (P → C → F)</div>
            <div class="clinical-pcf-short">${esc(pcfShort)}</div>
            ${pcfExpanded && pcfExpanded !== pcfShort ? `<div class="clinical-pcf-detail">${esc(pcfExpanded)}</div>` : ''}
          </div>` : ''}
        ${mt.macro_order ? `<div class="clinical-order">Full sequence: ${esc(mt.macro_order)}</div>` : ''}
      </div>`;
  }

  function macroBarWithActual(label, actual, tgt, color) {
    const hasActual = actual > 0;
    const ratio = tgt > 0 && hasActual ? Math.min(1, actual / tgt) : 0;
    const over = tgt > 0 && hasActual && actual > tgt * 1.05;
    const text = tgt ? `${hasActual ? Math.round(actual) : '—'} / ${Math.round(tgt)}g` : `${hasActual ? Math.round(actual) : '—'}g`;
    const fillColor = over ? '#EF5350' : color;
    return `<div class="macro-row"><span>${label}</span><div class="track"><div class="fill" style="width:${ratio * 100}%;background:${fillColor}"></div></div><span class="${over ? 'macro-over' : ''}">${text}</span></div>`;
  }

  function renderMacroTargetsBody(mt, ctx) {
    const today = dailyMacros(ctx.parsed.todayMeals || []);
    const eaten = today.kcal > 0 ? Math.round(today.kcal) : null;
    return `
      ${renderClinicalProfileBanner(mt)}
      <div class="macro-bars profile-macros">
        ${macroBarWithActual('P', today.protein_g, mt.protein_g, '#4CAF50')}
        ${macroBarWithActual('C', today.carb_g, mt.carb_g, '#FF9800')}
        ${macroBarWithActual('F', today.fat_g, mt.fat_g, '#2196F3')}
        ${macroBarWithActual('Fi', today.fiber_g, fiberTarget_g(mt), '#66BB6A')}
      </div>
      <div class="macro-kcal-row">${eaten != null ? eaten.toLocaleString() : '—'} / ${Math.round(mt.kcal).toLocaleString()} kcal</div>
      ${mt.diet_label ? `<p class="macro-diet-label">${esc(mt.diet_label)}</p>` : ''}
      ${mt.reasoning ? `<p class="reasoning-block">${esc(mt.reasoning)}</p>` : ''}`;
  }

  function targetsHeaderSub(bt) {
    if (!bt) return 'No body targets in snapshot';
    const weeks = bt.targetWeeks ?? bt.estimatedWeeks;
    return `${Number(bt.targetWeight_kg).toFixed(1)} kg · ${Number(bt.targetFatPct).toFixed(1)}% fat · ${Number(bt.targetMuscleMass_kg).toFixed(1)} kg muscle${weeks ? ` · ${weeks}w` : ''}`;
  }

  function macrosHeaderSub(mt) {
    if (!mt) return 'No macro targets in snapshot';
    return `${mt.protein_g}P / ${mt.fat_g}F / ${mt.carb_g}C / ${fiberTarget_g(mt)}Fi`;
  }

  function formatIsoShort(iso) {
    if (!iso) return '';
    try {
      return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch {
      return iso;
    }
  }

  function detailList(rows) {
    const items = rows.filter((r) => r[1] != null && r[1] !== '');
    if (!items.length) return '<p class="empty">Not set in snapshot</p>';
    return `<dl class="profile-dl">${items.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join('')}</dl>`;
  }

  function collapseSection(key, icon, title, sub, bodyHtml, expanded) {
    return `
      <button type="button" class="collapse-header${expanded ? ' open' : ''}" data-collapse="${key}" aria-expanded="${expanded ? 'true' : 'false'}">
        <span class="row-icon">${icon}</span>
        <span class="collapse-info">
          <span class="collapse-title">${esc(title)}</span>
          <span class="sub">${sub}</span>
        </span>
        <span class="collapse-chevron" aria-hidden="true">${expanded ? '⌃' : '›'}</span>
      </button>
      ${expanded ? `<div class="collapse-body">${bodyHtml}</div>` : ''}`;
  }

  function renderCoachBody(coach, mentors) {
    if (!coach) return '<p class="empty">No coach message in snapshot</p>';
    const done = (coach.actionItems || []).filter((i) => i.done).length;
    const total = (coach.actionItems || []).length;
    const mentorBlocks = mentors.map((m) => {
      const meta = mentorMeta(m);
      const wins = coach.wins?.[m] || [];
      const improve = coach.improve?.[m] || [];
      const items = (coach.actionItems || []).filter((i) => i.mentor === m);
      if (!wins.length && !improve.length && !items.length && !coach.mentorLines?.[m]) return '';
      return `
        <div class="coach-mentor-block">
          <div class="coach-mentor-title">${meta.emoji} ${esc(meta.label)}</div>
          ${coach.mentorLines?.[m] ? `<p class="coach-line">${esc(coach.mentorLines[m])}</p>` : ''}
          ${wins.length ? `<div class="coach-list-label">Wins</div><ul>${wins.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
          ${improve.length ? `<div class="coach-list-label">Improve</div><ul>${improve.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
          ${items.length ? `<ul class="action-items">${items.map((i) => `<li class="${i.done ? 'done' : ''}">${i.done ? '☑' : '☐'} ${esc(i.text)}</li>`).join('')}</ul>` : ''}
        </div>`;
    }).join('');
    const untagged = (coach.actionItems || []).filter((i) => !i.mentor || !mentors.includes(i.mentor));
    return `
      ${coach.summary ? `<p class="coach-summary">${esc(coach.summary)}</p>` : ''}
      ${coach.text && !coach.summary ? `<p class="coach-summary">${esc(coach.text)}</p>` : ''}
      ${total ? `<p class="coach-progress">${done}/${total} action items done</p>` : ''}
      ${mentorBlocks}
      ${untagged.length ? `<ul class="action-items">${untagged.map((i) => `<li class="${i.done ? 'done' : ''}">${i.done ? '☑' : '☐'} ${esc(i.text)}</li>`).join('')}</ul>` : ''}
      ${coach.generatedAt ? `<p class="coach-meta">Generated ${esc(formatIsoShort(coach.generatedAt))}${coach.triggerEvent ? ` · ${esc(coach.triggerEvent)}` : ''}</p>` : ''}`;
  }

  function renderProfileGroup(host, ctx) {
    if (!ctx.profileExpand) ctx.profileExpand = {};
    const ex = ctx.profileExpand;
    const p = ctx.parsed.profile || {};
    const bt = ctx.parsed.bodyTarget;
    const mt = ctx.parsed.macroTarget;
    const rules = ctx.parsed.userRules;
    const coach = ctx.parsed.coachMsg;
    const mentors = ctx.parsed.mentors || [];
    const gender = p.gender ? String(p.gender).charAt(0).toUpperCase() + String(p.gender).slice(1) : null;
    const profileSub = [gender, p.heightCm ? `${p.heightCm} cm` : null, p.age != null ? `${p.age} y` : null, p.language].filter(Boolean).join(' · ') || 'Not set in snapshot';

    const profileBody = detailList([
      ['Gender', gender],
      ['Height', p.heightCm ? `${p.heightCm} cm` : null],
      ['Birth date', p.birthdate],
      ['Age', p.age != null ? `${p.age} years` : null],
      ['Language', p.language],
    ]);

    const targetsBody = bt ? `
      ${detailList([
        ['Target weight', `${Number(bt.targetWeight_kg).toFixed(1)} kg`],
        ['Target fat', `${Number(bt.targetFatPct).toFixed(1)}%`],
        ['Target muscle', `${Number(bt.targetMuscleMass_kg).toFixed(1)} kg`],
        ['Timeline', bt.targetWeeks ?? bt.estimatedWeeks ? `${bt.targetWeeks ?? bt.estimatedWeeks} weeks` : null],
        ['Start weight', bt.startWeight_kg != null ? `${Number(bt.startWeight_kg).toFixed(1)} kg` : null],
        ['Start fat', bt.startFatPct != null ? `${Number(bt.startFatPct).toFixed(1)}%` : null],
        ['Start muscle', bt.startMuscle_kg != null ? `${Number(bt.startMuscle_kg).toFixed(1)} kg` : null],
        ['Set', formatIsoShort(bt.analyzedAt)],
      ])}
      ${bt.reasoning ? `<p class="reasoning-block">${esc(bt.reasoning)}</p>` : ''}` : '<p class="empty">No body targets in snapshot</p>';

    const mentorsBody = `
      <div class="mentor-pills">${mentors.map((m) => {
        const x = mentorMeta(m);
        return `<span class="mentor-pill active">${x.emoji} ${esc(x.label)}</span>`;
      }).join('')}</div>
      <p class="sub" style="margin-top:12px">Active mentors from patient app snapshot (read-only).</p>`;

    const rulesBody = rules ? `
      ${rules.summary ? `<p class="rules-summary">${esc(rules.summary)}</p>` : ''}
      ${(rules.constraints || []).length ? `<div class="coach-list-label">AI understood</div><ul class="rules-list">${rules.constraints.map((c) => `<li>✓ ${esc(c)}</li>`).join('')}</ul>` : ''}
      ${rules.rawText ? `<p class="rules-raw">${esc(rules.rawText)}</p>` : ''}
      ${rules.analyzedAt ? `<p class="coach-meta">Updated ${esc(formatIsoShort(rules.analyzedAt))}</p>` : ''}` : '<p class="empty">No dietary rules in snapshot</p>';

    const macrosSub = `${esc(macrosHeaderSub(mt))}${mt?.analyzedAt ? `<span class="macro-updated">Updated ${esc(formatIsoShort(mt.analyzedAt))}</span>` : ''}`;

    const macrosBody = mt ? renderMacroTargetsBody(mt, ctx) : '<p class="empty">No macro targets in snapshot</p>';

    const coachSub = coach?.summary || coach?.text?.slice(0, 120) || 'No coach message';
    const coachIcons = mentors.map((m) => mentorMeta(m).emoji).join(' ');

    host.innerHTML = `
      <div class="group-card profile-group">
        ${collapseSection('profile', '👤', 'My Profile', esc(profileSub), profileBody, !!ex.profile)}
        <div class="group-divider"></div>
        ${collapseSection('targets', '🎯', 'My Targets', esc(targetsHeaderSub(bt)), targetsBody, !!ex.targets)}
        <div class="group-divider"></div>
        ${collapseSection('mentors', '🧑‍⚕️', 'My Mentors', esc(mentorsHeaderSub(mentors)), mentorsBody, !!ex.mentors)}
        <div class="group-divider"></div>
        ${collapseSection('rules', '📋', 'My Rules', esc(rules?.summary || 'No dietary rules'), rulesBody, !!ex.rules)}
        <div class="group-divider"></div>
        ${collapseSection('macros', '🥗', 'My Macros', macrosSub, macrosBody, !!ex.macros)}
        ${coach ? `
        <div class="group-divider"></div>
        ${collapseSection('coach', coachIcons || '💬', 'Coach', esc(coachSub), renderCoachBody(coach, mentors), !!ex.coach)}` : ''}
      </div>`;

    host.querySelectorAll('[data-collapse]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const k = btn.getAttribute('data-collapse');
        if (!k) return;
        ex[k] = !ex[k];
        renderProfileGroup(host, ctx);
      });
    });
  }

  function renderProfileTab(panel, ctx) {
    panel.innerHTML = `
      <p class="sub snapshot-note" style="margin:0 0 16px">Patient profile, targets, and mentor context from snapshot — read-only. Tap a row to expand like on the phone.</p>
      <div class="dash-card profile-tab-card"><div id="profile-group-host"></div></div>`;
    const host = panel.querySelector('#profile-group-host');
    if (host) renderProfileGroup(host, ctx);
  }

  function paintDashboardCharts(panel, ctx) {
    const charts = global.ClinicCharts;
    if (!charts) return;
    const metabolicHost = panel.querySelector('#metabolic-host');
    if (metabolicHost) {
      if (ctx.chartVp == null) ctx.chartVp = 3;
      if (ctx.chartEndMs == null) ctx.chartEndMs = Date.now();
      charts.drawMetabolicChart(metabolicHost, ctx.parsed, ctx, () => paintDashboardCharts(panel, ctx));
    }
    const trendHost = panel.querySelector('#trend-host');
    const energyHost = panel.querySelector('#energy-host');
    const allDays = charts.enrichBodyTrendDays(ctx.parsed.withings);
    const pd = ctx.trendPeriod ?? 32;
    const chartOpts = { fillHeight: true, periodDays: pd };
    const windowDays = charts.trendWindowSlice(allDays, pd);
    if (energyHost) {
      charts.drawEnergyChart(energyHost, windowDays, ctx.parsed.eatenByDay, chartOpts);
    }
    if (trendHost) {
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
        chartOpts,
      );
    }
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
      <div class="charts-row">
        <div class="dash-card chart-half"><div id="trend-host"></div></div>
        <div class="dash-card chart-half"><div id="energy-host"></div></div>
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

  function profileRtl(profile) {
    const lang = String(profile?.language || '').toLowerCase();
    return lang.includes('עבר') || lang === 'hebrew' || lang === 'he' || lang.startsWith('he');
  }

  function renderLipidsTab(panel, ctx) {
    const charts = global.ClinicCharts;
    const pts = charts?.buildLipidPoints(ctx.parsed.labs) || [];
    panel.innerHTML = `
      <p class="sub snapshot-note" style="margin:0 0 16px">Lipid trends from lab reports in snapshot${pts.length ? ` — ${pts.length} draw${pts.length === 1 ? '' : 's'}` : ''}. Patient must tap <strong>Share data with clinic</strong> on the phone after new labs; then use Reload snapshot here.</p>
      <div class="dash-card lipid-tab-card"><div id="lipid-trend-host"></div></div>
      ${pts.length >= 2 ? '' : '<p class="sub" style="margin-top:12px;text-align:center">Need at least 2 lipid lab draws in the snapshot to show trend charts.</p>'}`;
    const host = panel.querySelector('#lipid-trend-host');
    if (host && charts) {
      charts.drawLipidChart(host, ctx.parsed.labs, {
        gender: ctx.parsed.profile?.gender || null,
        rtl: profileRtl(ctx.parsed.profile),
      });
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
    else if (tab === 'foodlog') renderFoodLogTab(body, ctx);
    else if (tab === 'profile') renderProfileTab(body, ctx);
    else if (tab === 'lipids') renderLipidsTab(body, ctx);
    else if (tab === 'chat') renderChat(body, ctx);
    else if (tab === 'rules') renderRules(body, ctx);
    else if (tab === 'labs') renderLabs(body, ctx);
  }

  function initTabs(tabsEl, ctx, mainEl) {
    const tabs = [
      { id: 'dashboard', label: 'Dashboard' },
      { id: 'profile', label: 'Profile' },
      { id: 'lipids', label: 'Lipids' },
      { id: 'foodlog', label: 'Food log' },
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
