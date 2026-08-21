/**
 * Full-width clinic workspace — patient dashboard, mentor chat, live rules, labs.
 */
(function (global) {
  const CGM_KEY = 'healthings:lastMetrics';
  const METRICS_KEY = 'healthings:metricsStore';
  const WITHINGS_KEY = 'healthings:withingsStore';
  const COACH_KEY = 'coach_message_today';
  const MACRO_KEY = 'daily_macro_target';
  const RULES_KEY = 'user_rules';
  const MENTOR_KEY = 'user_mentors';
  const NUTRITION_DIRECTIVES_KEY = 'nutrition_directives_v1';
  const WATER_LOG_KEY = 'water_log_v1';
  const WATER_GOAL_KEY = 'water_goal_ml_v1';
  const TREATMENT_MARKERS_KEY = 'healthings:treatmentMarkers';
  const DEFAULT_WATER_GOAL_ML = 2500;

  function t(key, vars) {
    if (global.ClinicI18n?.t) return global.ClinicI18n.t(key, vars);
    return key;
  }

  const MENTORS = [
    { id: 'doctor', labelKey: 'wsMentorDoctor', emoji: '🩺' },
    { id: 'nutritionist', labelKey: 'wsMentorNutritionist', emoji: '🥗' },
    { id: 'coach', labelKey: 'wsMentorCoach', emoji: '💪' },
  ];

  /**
   * Lucide chrome icons — mirrors app/src/theme/icons.tsx (prompt94).
   * Emoji stays on MENTORS for chat/export content only; profile chrome uses these.
   */
  function lucideSvg(inner) {
    return `<svg class="ws-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  }
  const ChromeIcons = {
    profile: lucideSvg('<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
    targets: lucideSvg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    rules: lucideSvg('<path d="m3 17 2 2 4-4"/><path d="m3 7 2 2 4-4"/><path d="M13 6h8"/><path d="M13 12h8"/><path d="M13 18h8"/>'),
    macros: lucideSvg('<path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1"/><path d="m13 12 4-4"/><path d="M12 12v1"/>'),
    /** Care team row — one mark; do not pack three mentor glyphs into the 24px slot. */
    careTeam: lucideSvg('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
    doctor: lucideSvg('<path d="M11 2v2"/><path d="M5 2v2"/><path d="M5 3H4a2 2 0 0 0-2 2v4a6 6 0 0 0 12 0V5a2 2 0 0 0-2-2h-1"/><path d="M8 15a6 6 0 0 0 12 0v-3"/><circle cx="20" cy="10" r="2"/>'),
    nutritionist: lucideSvg('<path d="M7 21h10"/><path d="M12 21a9 9 0 0 0 9-9H3a9 9 0 0 0 9 9Z"/><path d="M11.38 12a2.4 2.4 0 0 1-.4-4.77 2.4 2.4 0 0 1 3.2-2.77 2.4 2.4 0 0 1 3.47-.63 2.4 2.4 0 0 1 3.37 3.37 2.4 2.4 0 0 1-1.1 3.7 2.51 2.51 0 0 1 .03 1.1"/><path d="m13 12 4-4"/><path d="M12 12v1"/>'),
    coach: lucideSvg('<path d="M17.596 12.768a2 2 0 1 0 2.829-2.829l-1.768-1.767a2 2 0 0 0 2.828-2.829l-2.828-2.828a2 2 0 0 0-2.829 2.828l-1.767-1.768a2 2 0 1 0-2.829 2.829z"/><path d="m2.5 21.5 1.4-1.4"/><path d="m20.1 3.9 1.4-1.4"/><path d="M5.343 21.485a2 2 0 1 0 2.829-2.828l1.767 1.768a2 2 0 1 0 2.829-2.829l-6.364-6.364a2 2 0 1 0-2.829 2.829l1.768 1.767a2 2 0 0 0-2.828 2.829z"/><path d="m9.6 14.4 4.8-4.8"/>'),
  };
  const MENTOR_ICON_ORDER = ['doctor', 'nutritionist', 'coach'];

  function mentorChromeIcon(id) {
    return ChromeIcons[id] || ChromeIcons.profile;
  }

  /** Ordered row of active mentor marks — app ActiveMentorIcons. */
  function activeMentorIconsHtml(mentors) {
    const active = MENTOR_ICON_ORDER.filter((m) => (mentors || []).includes(m));
    if (!active.length) return ChromeIcons.doctor;
    return `<span class="ws-icon-row">${active.map((m) => mentorChromeIcon(m)).join('')}</span>`;
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  /** Relative freshness for clinicians; exact stamp stays in title= for support. */
  function formatRelativeSync(iso) {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms)) return t('wsSyncedUnknown');
    const mins = Math.round((Date.now() - ms) / 60000);
    if (mins < 1) return t('wsSyncedJustNow');
    if (mins < 60) return t('wsSyncedMinutesAgo', { n: mins });
    const hours = Math.round(mins / 60);
    if (hours < 48) return t('wsSyncedHoursAgo', { n: hours });
    const days = Math.round(hours / 24);
    return t('wsSyncedDaysAgo', { n: days });
  }

  function formatGender(g) {
    if (!g) return null;
    const s = String(g).toLowerCase();
    if (s === 'male') return t('wsGenderMale');
    if (s === 'female') return t('wsGenderFemale');
    return t('wsGenderOther');
  }

  function supportMetaTitle(blob) {
    if (!blob) return '';
    const when = blob.createdAt ? new Date(blob.createdAt).toLocaleString() : '';
    const kb = blob.byteSize != null ? Math.round(blob.byteSize / 1024) + ' KB' : '';
    return ['v' + blob.version, when, kb].filter(Boolean).join(' · ');
  }

  function fatPctFromBody(body) {
    if (!body) return null;
    if (body.fatPct != null && Number.isFinite(body.fatPct)) return body.fatPct;
    if (body.weightKg > 0 && body.fatMassKg != null) {
      return (body.fatMassKg / body.weightKg) * 100;
    }
    return null;
  }

  /** Count from verbatim rawText only — app no longer ships AI constraint bullets (prompt52). */
  function rulesActiveCount(rules) {
    const raw = String(rules?.rawText || '').trim();
    if (!raw) return 0;
    const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    return lines.length || 1;
  }

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function dayKeyFromMs(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /**
   * Patient app coach threads for /account/ — today only (no history pile-up).
   * Clinic renderChat never reads this (be-24).
   */
  function parseAppChatFromStore(store) {
    const today = todayKey();
    const byMentor = { doctor: [], nutritionist: [], coach: [] };
    for (const [key, raw] of Object.entries(store || {})) {
      const m = key.match(/^chat_history_(\d{4}-\d{2}-\d{2})(?:_(doctor|nutritionist|coach))?$/);
      if (!m || m[1] !== today) continue;
      const mentor = m[2] || 'nutritionist';
      try {
        const msgs = JSON.parse(raw);
        if (!Array.isArray(msgs)) continue;
        for (const msg of msgs) {
          if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) continue;
          if (!String(msg.text || '').trim()) continue;
          byMentor[mentor].push(msg);
        }
      } catch { /* */ }
    }
    for (const mentor of Object.keys(byMentor)) {
      byMentor[mentor].sort(
        (a, b) => (Date.parse(a.sentAt) || 0) - (Date.parse(b.sentAt) || 0),
      );
    }
    return byMentor;
  }

  function parseSnapshot(payload) {
    const store = payload.asyncStorage || {};
    const meals = [];

    for (const [key, raw] of Object.entries(store)) {
      const fm = key.match(/^food_log_(\d{4}-\d{2}-\d{2})$/);
      if (fm) {
        try {
          for (const meal of JSON.parse(raw)) meals.push({ day: fm[1], ...meal });
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
    try {
      const metricsRaw = store[METRICS_KEY] ?? store[WITHINGS_KEY];
      if (metricsRaw) withings = JSON.parse(metricsRaw);
    } catch { /* */ }
    try { if (store[MACRO_KEY]) macroTarget = JSON.parse(store[MACRO_KEY]); } catch { /* */ }
    try { if (store[RULES_KEY]) userRules = JSON.parse(store[RULES_KEY]); } catch { /* */ }
    try { if (store[COACH_KEY]) coachMsg = JSON.parse(store[COACH_KEY]); } catch { /* */ }
    try { if (store[MENTOR_KEY]) mentors = JSON.parse(store[MENTOR_KEY]); } catch { /* */ }

    const treatmentMarkers = parseTreatmentMarkersFromStore(store);

    const appChat = parseAppChatFromStore(store);

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
        const ms = Date.parse(profile.birthdate);
        if (!Number.isNaN(ms)) {
          const age = Math.floor((Date.now() - ms) / (365.25 * 86400000));
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
    const water = parseWater(store);

    return {
      meals,
      mealsByDay,
      todayMeals,
      eatenByDay,
      burnByDay,
      glucose: cgm?.glucose || [],
      withings,
      macroTarget,
      treatmentMarkers,
      bodyTarget,
      userRules,
      coachMsg,
      appChat,
      profile,
      mentors: Array.isArray(mentors) ? mentors : ['nutritionist'],
      labs: parseLabs(store),
      nutritionDirectives: parseNutritionDirectives(store),
      waterByDay: water.byDay,
      waterGoalMl: water.goalMl,
      /** Raw asyncStorage for prefs like lab_custom_trend_code (prompt101). */
      rawStore: store,
    };
  }

  /** Phone AsyncStorage key — same shape ClinicOverlayService writes. */
  function parseTreatmentMarkersFromStore(store) {
    try {
      const raw = store?.[TREATMENT_MARKERS_KEY];
      if (!raw) return null;
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      const list = Array.isArray(parsed?.markers)
        ? parsed.markers
        : Array.isArray(parsed)
          ? parsed
          : null;
      if (!list?.length) return null;
      return list.filter(
        (m) => m && typeof m.marker === 'string' && Number.isFinite(Number(m.dailyTarget)) && Number(m.dailyTarget) > 0,
      );
    } catch {
      return null;
    }
  }

  /**
   * Prefer this org's overlay markers; else what the phone is running (snapshot).
   * Closes the mentor gap when Profile/Food Log only showed P/C/F/Fi.
   */
  function effectiveTreatmentMarkers(parsed, overlay) {
    if (Array.isArray(overlay?.markers) && overlay.markers.length) return overlay.markers;
    if (Array.isArray(parsed?.treatmentMarkers) && parsed.treatmentMarkers.length) {
      return parsed.treatmentMarkers;
    }
    return null;
  }

  /** Snapshot already carries water_log_v1 / water_goal_ml_v1 (ShareExportService). */
  function parseWater(store) {
    let goalMl = DEFAULT_WATER_GOAL_ML;
    try {
      const raw = store[WATER_GOAL_KEY];
      if (raw != null && raw !== '') {
        const n = parseInt(String(raw).replace(/^"|"$/g, ''), 10);
        if (Number.isFinite(n) && n > 0) goalMl = n;
      }
    } catch { /* */ }

    const byDay = {};
    try {
      const raw = store[WATER_LOG_KEY];
      if (!raw) return { goalMl, byDay };
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && parsed.version === 2 && parsed.days && typeof parsed.days === 'object') {
        for (const [dk, entries] of Object.entries(parsed.days)) {
          if (!Array.isArray(entries)) continue;
          const ml = entries.reduce((s, e) => s + (Number(e?.ml) || 0), 0);
          if (ml > 0) byDay[dk] = Math.round(ml);
        }
        return { goalMl, byDay };
      }
      if (parsed && typeof parsed === 'object' && !('version' in parsed)) {
        for (const [dk, val] of Object.entries(parsed)) {
          if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
            byDay[dk] = Math.round(val);
          } else if (Array.isArray(val)) {
            const ml = val.reduce((s, e) => s + (Number(e?.ml) || 0), 0);
            if (ml > 0) byDay[dk] = Math.round(ml);
          }
        }
      }
    } catch { /* */ }
    return { goalMl, byDay };
  }

  /** Activity + BMR parts — burned total matches phone Food Log (BMR + activity). */
  function burnPartsForDay(withings, dk, totalBurn) {
    const trend = withings?.bodyTrendDays || [];
    const day = trend.find((d) => d.dayKey === dk);
    const bmrRaw = day?.bmrKcalDay ?? withings?.bodyScan?.bmrKcalDay ?? null;
    const bmr = bmrRaw != null && Number.isFinite(bmrRaw) ? Math.round(bmrRaw) : null;
    let activity = null;
    if (day?.activityKcalDay != null && Number.isFinite(day.activityKcalDay)) {
      activity = Math.round(day.activityKcalDay);
    } else if (totalBurn != null && bmr != null) {
      activity = Math.max(0, Math.round(totalBurn) - bmr);
    }
    let total = null;
    if (bmr != null && activity != null) {
      total = bmr + activity;
    } else if (totalBurn != null) {
      total = Math.round(totalBurn);
    } else if (bmr != null) {
      total = bmr;
    }
    return { bmr, activity, total };
  }

  function parseNutritionDirectives(store) {
    let activeId = null;
    let entries = [];
    try {
      if (store[NUTRITION_DIRECTIVES_KEY]) {
        const d = JSON.parse(store[NUTRITION_DIRECTIVES_KEY]);
        activeId = d.activeId ?? null;
        entries = Array.isArray(d.entries) ? d.entries : [];
      }
    } catch { /* */ }
    entries = entries
      .map((e) => normalizeNutritionEntry(e))
      .filter((e) => e.fullText.trim());
    return { activeId, entries };
  }

  function normalizeNutritionEntry(raw) {
    let fullText = String(raw.fullText ?? '').trim();
    if (!fullText && Array.isArray(raw.goals) && raw.goals.length) {
      const blocks = [];
      if (raw.goals.length) blocks.push('Goals', ...raw.goals.map((g) => `- ${g}`));
      if (Array.isArray(raw.menuTargets) && raw.menuTargets.length) {
        blocks.push('', 'Menu targets', ...raw.menuTargets.map((g) => `- ${g}`));
      }
      if (raw.macroSummary) blocks.push('', String(raw.macroSummary));
      if (raw.sampleMenu) blocks.push('', String(raw.sampleMenu));
      fullText = blocks.join('\n').trim();
    }
    const title = String(raw.title ?? '').trim() || t('wsNutritionistReportFallback');
    return {
      id: String(raw.id ?? ''),
      importedAt: String(raw.importedAt ?? ''),
      sessionDate: raw.sessionDate ?? null,
      title,
      sourceFileName: raw.sourceFileName ?? null,
      fullText,
      lang: raw.lang ?? null,
    };
  }

  function formatDirectiveDate(entry) {
    const iso = entry.sessionDate || entry.importedAt;
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return String(iso).slice(0, 10);
    return new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function directivePreviewLine(entry) {
    const lines = String(entry.fullText || '').split('\n').map((s) => s.trim()).filter(Boolean);
    if (lines.length <= 1) return null;
    return lines[1].slice(0, 80);
  }

  function directiveRtl(entry, profile) {
    if (entry.lang === 'he' || entry.lang === 'mixed') return true;
    return profileRtl(profile);
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
        fiber_g: a.fiber_g + entryFiber(e),
      }),
      { kcal: 0, protein_g: 0, carb_g: 0, fat_g: 0, fiber_g: 0 },
    );
  }

  function mealLabel(entry) {
    if (entry.note) return entry.note;
    const h = new Date(entry.timestamp).getHours();
    if (h < 10) return t('wsMealBreakfast');
    if (h < 14) return t('wsMealLunch');
    if (h < 17) return t('wsMealSnack');
    return t('wsMealDinner');
  }

  function formatDayLabel(dayKey) {
    const ms = Date.parse(dayKey + 'T12:00:00');
    const d = Number.isNaN(ms) ? new Date() : new Date(ms);
    const datePart = d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    return dayKey === todayKey() ? t('wsTodayDate', { date: datePart }) : datePart;
  }

  function shiftDayKey(dayKey, delta) {
    const ms = Date.parse(dayKey + 'T12:00:00');
    const d = new Date(ms);
    d.setDate(d.getDate() + delta);
    const next = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return next > todayKey() ? todayKey() : next;
  }

  /** unit: 'g' | 'ml' | 'mg' | '' (kcal bar has no unit suffix — label carries it). opts.goalIsFloor = no over-target red. */
  function macroBar(label, val, tgt, tone, unit, opts) {
    const u = unit === undefined ? 'g' : unit;
    const goalIsFloor = !!opts?.goalIsFloor;
    const ratio = tgt > 0 ? Math.min(1, val / tgt) : 0;
    const over = !goalIsFloor && tgt > 0 && val > tgt * 1.05;
    const text = tgt
      ? `${Math.round(val).toLocaleString()}/${Math.round(tgt).toLocaleString()}${u}`
      : `${Math.round(val).toLocaleString()}${u}`;
    const fillClass = over ? 'macro-fill-over' : 'macro-fill-' + tone;
    return `<div class="macro-row"><span>${esc(label)}</span><div class="track"><div class="fill ${fillClass}" style="width:${ratio * 100}%"></div></div><span class="${over ? 'macro-over' : ''}">${text}</span></div>`;
  }

  /** Sum meal/item treatment markers for the day (same rules as app dayMarkerTotals). */
  function dayMarkerTotals(meals, codes) {
    const totals = {};
    for (const code of codes) totals[code] = null;
    for (const meal of meals || []) {
      let amounts = meal.markers && typeof meal.markers === 'object' ? meal.markers : null;
      if (!amounts || !Object.keys(amounts).length) {
        amounts = {};
        for (const it of meal.items || []) {
          const m = it.markers;
          if (!m || typeof m !== 'object') continue;
          for (const [k, v] of Object.entries(m)) {
            const n = Number(v);
            if (!Number.isFinite(n) || n < 0) continue;
            amounts[k] = (amounts[k] || 0) + n;
          }
        }
      }
      for (const code of codes) {
        const n = Number(amounts[code]);
        if (!Number.isFinite(n)) continue;
        totals[code] = (totals[code] == null ? 0 : totals[code]) + n;
      }
    }
    const out = {};
    for (const code of codes) {
      if (totals[code] != null) out[code] = Math.round(totals[code] * 10) / 10;
    }
    return out;
  }

  function treatmentMarkerBarsHtml(meals, overlayMarkers, opts) {
    const markers = Array.isArray(overlayMarkers) ? overlayMarkers : [];
    if (!markers.length) return '';
    const codes = markers.map((m) => m.marker).filter(Boolean);
    const totals = dayMarkerTotals(meals, codes);
    const rows = markers
      .map((m) => {
        const val = totals[m.marker];
        const hasVal = val != null && Number.isFinite(val);
        return macroBar(
          markerLabel(m.marker),
          hasVal ? val : 0,
          m.dailyTarget,
          'treat',
          m.unit === 'mg' ? 'mg' : m.unit === 'mcg' ? 'mcg' : 'g',
          { goalIsFloor: m.direction === 'floor' },
        );
      })
      .join('');
    if (opts?.omitHint) return rows;
    return `${rows}<p class="treat-food-hint sub">${esc(t('wsTreatFoodHint'))}</p>`;
  }

  function entryFiber(meal) {
    if (meal.totalFiber_g != null && Number.isFinite(meal.totalFiber_g)) return meal.totalFiber_g;
    return (meal.items || []).reduce((a, i) => a + (i.fiber_g || 0), 0);
  }

  function macroSummaryMeal(meal) {
    const items = meal.items || [];
    if (items.length) {
      const tot = items.reduce(
        (a, i) => ({
          kcal: a.kcal + (i.kcal || 0),
          p: a.p + (i.protein_g || 0),
          c: a.c + (i.carb_g || 0),
          f: a.f + (i.fat_g || 0),
          fi: a.fi + (i.fiber_g || 0),
        }),
        { kcal: 0, p: 0, c: 0, f: 0, fi: 0 },
      );
      return `${Math.round(tot.kcal)} kcal · P ${tot.p.toFixed(0)}g · C ${tot.c.toFixed(0)}g · F ${tot.f.toFixed(0)}g · Fi ${tot.fi.toFixed(0)}g`;
    }
    return `${Math.round(meal.totalKcal || 0)} kcal · P ${Math.round(meal.totalProtein_g || 0)}g · C ${Math.round(meal.totalCarb_g || 0)}g · F ${Math.round(meal.totalFat_g || 0)}g · Fi ${Math.round(entryFiber(meal))}g`;
  }

  function showMealModal(panel, meal, selfView) {
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
        const name = esc(item.name_local || item.name || t('wsMealItemFallback'));
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
      : `<p class="empty" style="padding:16px">${esc(t('wsNoItemBreakdown'))}</p>
         <div class="meal-totals-only">
           <strong>${Math.round(meal.totalKcal || 0)} kcal</strong>
           · P ${Math.round(meal.totalProtein_g || 0)}g · C ${Math.round(meal.totalCarb_g || 0)}g · F ${Math.round(meal.totalFat_g || 0)}g
         </div>`;

    modalRoot.hidden = false;
    modalRoot.innerHTML = `
      <div class="meal-modal-overlay" data-close-meal>
        <div class="meal-modal-card" role="dialog" aria-label="${esc(t('wsMealDetailsAria'))}">
          <div class="meal-modal-head">
            <div>
              <div class="meal-modal-title">${esc(title)}</div>
              <div class="meal-modal-time">${esc(time)}</div>
            </div>
            <button type="button" class="meal-modal-close" data-close-meal aria-label="${esc(t('wsCloseAria'))}">✕</button>
          </div>
          ${meal.note ? `<p class="meal-modal-note">${esc(meal.note)}</p>` : ''}
          <div class="meal-items-card">${itemsHtml}
            <div class="meal-item-row meal-item-total">
              <span class="meal-item-kcal">${macroSummaryMeal(meal)}</span>
            </div>
          </div>
          <p class="meal-modal-readonly">${esc(selfView ? t('wsMealReadonlySelf') : t('wsMealReadonlyClinic'))}</p>
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
    const parts = burnPartsForDay(ctx.parsed.withings, dk, burn);
    const burnedTotal = parts.total ?? burn;
    const balance = burnedTotal != null && eaten > 0 ? eaten - burnedTotal : null;
    const isToday = dk >= todayKey();
    const fiberT = fiberTarget_g(target);
    const netEaten = Math.max(0, Math.round((macros.carb_g || 0) - (macros.fiber_g || 0)));
    const netT = netCarbTarget_g(target);
    const waterMl = ctx.parsed.waterByDay?.[dk] || 0;
    const waterGoal = ctx.parsed.waterGoalMl || DEFAULT_WATER_GOAL_ML;
    const isDeficit = balance != null && balance < 0;
    const treatMarkers = effectiveTreatmentMarkers(ctx.parsed, ctx.overlay) || [];
    const showBars = meals.length || target || waterMl > 0 || treatMarkers.length > 0;

    host.innerHTML = `
      <div class="food-log-card food-log-grid">
        <div class="food-log-summary">
          <div class="food-log-title">${esc(t('wsFoodLogTitle'))}</div>
          <div class="date-nav food-date-nav">
            <button type="button" class="nav-arrow" data-food-shift="-1" aria-label="${esc(t('wsPrevDayAria'))}">‹</button>
            <span class="date-label">${formatDayLabel(dk)}</span>
            <button type="button" class="nav-arrow" data-food-shift="1" ${isToday ? 'disabled' : ''} aria-label="${esc(t('wsNextDayAria'))}">›</button>
          </div>
          <div class="energy-lines">
            <div class="energy-row">
              <span class="energy-num">${eaten > 0 ? eaten.toLocaleString() : '—'}</span>
              <span class="energy-label">${esc(t('wsKcalEaten'))}</span>
            </div>
            ${parts.activity != null ? `
            <div class="energy-row">
              <span class="energy-num">${parts.activity.toLocaleString()}</span>
              <span class="energy-label">${esc(t('wsKcalActivity'))}</span>
            </div>` : ''}
            ${parts.total != null ? `
            <div class="energy-row">
              <span class="energy-num">${parts.total.toLocaleString()}</span>
              <span class="energy-label">${esc(t('wsKcalBurned'))}${parts.bmr != null
                ? ` <span class="energy-target">${parts.activity != null
                  ? esc(t('wsEnergyBmrPlusActivity', { n: parts.bmr.toLocaleString() }))
                  : esc(t('wsEnergyBmrDetail', { n: parts.bmr.toLocaleString() }))}</span>`
                : ''}</span>
            </div>` : ''}
            ${balance != null ? `<div class="balance-pill ${isDeficit ? 'deficit' : 'surplus'}"><span class="energy-num">${Math.abs(Math.round(balance)).toLocaleString()}</span><span class="energy-label">${isDeficit ? esc(t('wsKcalDeficit')) : esc(t('wsKcalSurplus'))}</span></div>` : ''}
          </div>
          ${showBars ? `
          <div class="macro-bars">
            ${target ? macroBar('kcal', eaten, target.kcal, 'kcal', '') : ''}
            ${(meals.length || target) ? `
            ${macroBar('P', macros.protein_g, target?.protein_g, 'p')}
            ${macroBar('C', macros.carb_g, target?.carb_g, 'c')}
            ${macroBar('F', macros.fat_g, target?.fat_g, 'f')}
            ${macroBar('Fi', macros.fiber_g || 0, target ? fiberT : null, 'fi')}
            ${macroBar('C-Fi', netEaten, netT, 'net')}
            ` : ''}
            ${treatmentMarkerBarsHtml(meals, treatMarkers)}
            ${macroBar('H2O', waterMl, waterGoal, 'h2o', 'ml')}
          </div>` : ''}
        </div>
        <div class="meal-chips-row">
          ${meals.length ? meals.map((m, i) => `
            <button type="button" class="meal-chip" data-meal-idx="${i}">
              <span class="chip-time">${new Date(m.timestamp).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</span>
              <span class="chip-label">${esc(mealLabel(m))}</span>
              <span class="chip-kcal">${Math.round(m.totalKcal || 0)} kcal</span>
              <span class="chip-view">${esc(t('wsMealView'))}</span>
            </button>`).join('') : `<p class="empty meal-chips-empty">${esc(t('wsNoMealsThisDay'))}</p>`}
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
        if (meal && panel) showMealModal(panel, meal, !!ctx.selfView);
      });
    });
  }

  function renderFoodLogTab(panel, ctx) {
    panel.innerHTML = `
      <p class="sub snapshot-note">${esc(ctx.selfView ? t('wsFoodNoteSelf') : t('wsFoodNoteClinic'))}</p>
      <div class="food-log-page">
        <div class="dash-card food-log-panel"><div id="food-log-host"></div></div>
        <div id="meal-modal-root" hidden></div>
      </div>`;
    const host = panel.querySelector('#food-log-host');
    if (host) renderFoodLog(host, ctx, panel);
  }

  function mentorMeta(id) {
    const m = MENTORS.find((x) => x.id === id);
    if (!m) return { id, label: id, emoji: '•' };
    return { id: m.id, label: t(m.labelKey), emoji: m.emoji };
  }

  function mentorsHeaderSub(mentors) {
    // App collapsed Mentors subtitle is labels-only (prompt94) — no emoji.
    return mentors.map((m) => mentorMeta(m).label).join(' · ') || t('wsNoMentorsSelected');
  }

  function fiberTarget_g(mt) {
    if (!mt) return 30;
    return mt.fiber_g ?? mt.aiSuggested?.fiber_g ?? 30;
  }

  /** Pure math: net = C − Fi (ai-judgment-not-regex). Prefer stored net_carb_g when present. */
  function netCarbTarget_g(mt) {
    if (!mt) return null;
    if (mt.net_carb_g != null && Number.isFinite(mt.net_carb_g)) {
      return Math.max(0, Math.round(mt.net_carb_g));
    }
    if (mt.aiSuggested?.net_carb_g != null && Number.isFinite(mt.aiSuggested.net_carb_g)) {
      return Math.max(0, Math.round(mt.aiSuggested.net_carb_g));
    }
    if (mt.carb_g == null) return null;
    return Math.max(0, Math.round(mt.carb_g - fiberTarget_g(mt)));
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
        <div class="clinical-profile-title">${esc(t('wsClinicalProfile'))}</div>
        <div class="clinical-profile-text">${esc(mt.clinical_profile.trim())}</div>
        ${pcfShort ? `
          <div class="clinical-pcf-row">
            <div class="clinical-pcf-label">${esc(t('wsMacroPriority'))}</div>
            <div class="clinical-pcf-short">${esc(pcfShort)}</div>
            ${pcfExpanded && pcfExpanded !== pcfShort ? `<div class="clinical-pcf-detail">${esc(pcfExpanded)}</div>` : ''}
          </div>` : ''}
        ${mt.macro_order ? `<div class="clinical-order">${esc(t('wsFullSequence', { order: mt.macro_order }))}</div>` : ''}
      </div>`;
  }

  function macroBarWithActual(label, actual, tgt, tone) {
    const hasActual = actual > 0;
    const ratio = tgt > 0 && hasActual ? Math.min(1, actual / tgt) : 0;
    const over = tgt > 0 && hasActual && actual > tgt * 1.05;
    const text = tgt ? `${hasActual ? Math.round(actual) : '—'} / ${Math.round(tgt)}g` : `${hasActual ? Math.round(actual) : '—'}g`;
    const fillClass = over ? 'macro-fill-over' : 'macro-fill-' + tone;
    return `<div class="macro-row"><span>${label}</span><div class="track"><div class="fill ${fillClass}" style="width:${ratio * 100}%"></div></div><span class="${over ? 'macro-over' : ''}">${text}</span></div>`;
  }

  function renderMacroTargetsBody(mt, ctx) {
    const today = dailyMacros(ctx.parsed.todayMeals || []);
    const eaten = today.kcal > 0 ? Math.round(today.kcal) : null;
    const treat = effectiveTreatmentMarkers(ctx.parsed, ctx.overlay) || [];
    const treatRows = treatmentMarkerBarsHtml(ctx.parsed.todayMeals || [], treat, { omitHint: true });
    if (!mt && !treat.length) {
      return `<p class="empty">${esc(t('wsNoMacroTargets'))}</p>`;
    }
    const classic = mt
      ? `
      ${renderClinicalProfileBanner(mt)}
      <div class="macro-bars profile-macros">
        ${macroBarWithActual('P', today.protein_g, mt.protein_g, 'p')}
        ${macroBarWithActual('C', today.carb_g, mt.carb_g, 'c')}
        ${macroBarWithActual('F', today.fat_g, mt.fat_g, 'f')}
        ${macroBarWithActual('Fi', today.fiber_g, fiberTarget_g(mt), 'fi')}
      </div>
      <div class="macro-kcal-row">${eaten != null ? eaten.toLocaleString() : '—'} / ${Math.round(mt.kcal).toLocaleString()} kcal</div>
      ${mt.diet_label ? `<p class="macro-diet-label">${esc(mt.diet_label)}</p>` : ''}
      ${mt.reasoning ? `<p class="reasoning-block">${esc(mt.reasoning)}</p>` : ''}`
      : '';
    const treatBlock = treat.length
      ? `
      ${mt ? `<p class="sub treat-profile-label">${esc(t('wsTreatInMacros'))}</p>` : ''}
      <div class="macro-bars profile-macros treat-profile-bars">${treatRows}</div>
      <p class="treat-food-hint sub">${esc(t('wsTreatFoodHint'))}</p>`
      : '';
    return `${classic}${treatBlock}`;
  }

  function targetsHeaderSub(bt) {
    if (!bt) return t('wsNoBodyTargets');
    const weeks = bt.targetWeeks ?? bt.estimatedWeeks;
    return `${Number(bt.targetWeight_kg).toFixed(1)} kg · ${Number(bt.targetFatPct).toFixed(1)}% fat · ${Number(bt.targetMuscleMass_kg).toFixed(1)} kg muscle${weeks ? ` · ${weeks}w` : ''}`;
  }

  function macrosHeaderSub(mt, treatMarkers) {
    const classic = mt
      ? `${mt.protein_g}P / ${mt.fat_g}F / ${mt.carb_g}C / ${fiberTarget_g(mt)}Fi`
      : '';
    const treat = Array.isArray(treatMarkers) ? treatMarkers : [];
    const treatBits = treat
      .slice(0, 3)
      .map((m) => {
        const dir = m.direction === 'floor' ? '≥' : '≤';
        return `${markerLabel(m.marker)} ${dir}${m.dailyTarget}${m.unit || 'g'}`;
      })
      .join(' · ');
    if (classic && treatBits) return `${classic} · ${treatBits}`;
    if (treatBits) return treatBits;
    if (classic) return classic;
    return t('wsNoMacroTargets');
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
    if (!items.length) return `<p class="empty">${esc(t('wsNotSetInSnapshot'))}</p>`;
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
    if (!coach) return `<p class="empty">${esc(t('wsNoCoachMessage'))}</p>`;
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
          <div class="coach-mentor-title">${mentorChromeIcon(m)} ${esc(meta.label)}</div>
          ${coach.mentorLines?.[m] ? `<p class="coach-line">${esc(coach.mentorLines[m])}</p>` : ''}
          ${wins.length ? `<div class="coach-list-label">${esc(t('wsWins'))}</div><ul>${wins.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
          ${improve.length ? `<div class="coach-list-label">${esc(t('wsImprove'))}</div><ul>${improve.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : ''}
          ${items.length ? `<ul class="action-items">${items.map((i) => `<li class="${i.done ? 'done' : ''}">${i.done ? '☑' : '☐'} ${esc(i.text)}</li>`).join('')}</ul>` : ''}
        </div>`;
    }).join('');
    const untagged = (coach.actionItems || []).filter((i) => !i.mentor || !mentors.includes(i.mentor));
    return `
      ${coach.summary ? `<p class="coach-summary">${esc(coach.summary)}</p>` : ''}
      ${coach.text && !coach.summary ? `<p class="coach-summary">${esc(coach.text)}</p>` : ''}
      ${total ? `<p class="coach-progress">${esc(t('wsActionItemsDone', { done, total }))}</p>` : ''}
      ${mentorBlocks}
      ${untagged.length ? `<ul class="action-items">${untagged.map((i) => `<li class="${i.done ? 'done' : ''}">${i.done ? '☑' : '☐'} ${esc(i.text)}</li>`).join('')}</ul>` : ''}
      ${coach.generatedAt ? `<p class="coach-meta">${esc(t('wsGenerated', { when: formatIsoShort(coach.generatedAt) }))}${coach.triggerEvent ? ` · ${esc(coach.triggerEvent)}` : ''}</p>` : ''}`;
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
    const gender = formatGender(p.gender);
    const profileSub = [gender, p.heightCm ? `${p.heightCm} cm` : null, p.age != null ? t('wsBannerAgeY', { n: p.age }) : null, p.language].filter(Boolean).join(' · ') || t('wsNotSetInSnapshot');

    const profileBody = detailList([
      [t('wsDlGender'), gender],
      [t('wsDlHeight'), p.heightCm ? `${p.heightCm} cm` : null],
      [t('wsDlBirthDate'), p.birthdate],
      [t('wsDlAge'), p.age != null ? t('wsAgeYears', { n: p.age }) : null],
      [t('wsDlLanguage'), p.language],
    ]);

    const targetsBody = bt ? `
      ${detailList([
        [t('wsDlTargetWeight'), `${Number(bt.targetWeight_kg).toFixed(1)} kg`],
        [t('wsDlTargetFat'), `${Number(bt.targetFatPct).toFixed(1)}%`],
        [t('wsDlTargetMuscle'), `${Number(bt.targetMuscleMass_kg).toFixed(1)} kg`],
        [t('wsDlTimeline'), bt.targetWeeks ?? bt.estimatedWeeks ? t('wsWeeks', { n: bt.targetWeeks ?? bt.estimatedWeeks }) : null],
        [t('wsDlStartWeight'), bt.startWeight_kg != null ? `${Number(bt.startWeight_kg).toFixed(1)} kg` : null],
        [t('wsDlStartFat'), bt.startFatPct != null ? `${Number(bt.startFatPct).toFixed(1)}%` : null],
        [t('wsDlStartMuscle'), bt.startMuscle_kg != null ? `${Number(bt.startMuscle_kg).toFixed(1)} kg` : null],
        [t('wsDlSet'), formatIsoShort(bt.analyzedAt)],
      ])}
      ${bt.reasoning ? `<p class="reasoning-block">${esc(bt.reasoning)}</p>` : ''}` : `<p class="empty">${esc(t('wsNoBodyTargets'))}</p>`;

    const mentorsBody = mentors.length
      ? `<div class="mentor-pills">${mentors.map((m) => {
          const x = mentorMeta(m);
          return `<span class="mentor-pill active">${mentorChromeIcon(m)} ${esc(x.label)}</span>`;
        }).join('')}</div>
        <p class="sub mentors-note">${esc(ctx.selfView ? t('wsMentorsNoteSelf') : t('wsMentorsNoteClinic'))}</p>`
      : `<p class="empty">${esc(t('wsNoMentors'))}</p>`;

    const rulesBody = rules?.rawText
      ? `
      <p class="rules-raw" dir="auto">${esc(rules.rawText)}</p>
      ${rules.analyzedAt ? `<p class="coach-meta">${esc(t('wsUpdated', { when: formatIsoShort(rules.analyzedAt) }))}</p>` : ''}`
      : `<p class="empty">${esc(t('wsNoDietaryRules'))}</p>`;

    const treatMarkers = effectiveTreatmentMarkers(ctx.parsed, ctx.overlay) || [];
    const macrosSub = `${esc(macrosHeaderSub(mt, treatMarkers))}${mt?.analyzedAt ? `<span class="macro-updated">${esc(t('wsUpdated', { when: formatIsoShort(mt.analyzedAt) }))}</span>` : ''}`;

    const macrosBody = renderMacroTargetsBody(mt, ctx);

    const coachSub = coach?.summary || coach?.text?.slice(0, 120) || t('wsNoCoachMessageShort');

    const leftTitle = t('wsProfileSection');
    const targetsTitle = t('wsTargetsSection');
    const mentorsTitle = ctx.selfView ? t('wsMentorsSectionSelf') : t('wsCareTeamSectionClinic');
    const rulesTitle = ctx.selfView ? t('wsRulesSectionSelf') : t('wsDietaryRulesClinic');
    const macrosTitle = ctx.selfView ? t('wsMacrosSectionSelf') : t('wsMacroTargetsClinic');
    const macrosBodyHtml = `
      ${ctx.selfView ? '' : `<p class="sub">${esc(t('wsMacroTargetsClinicHint'))}</p>`}
      ${macrosBody}`;
    const coachTitle = ctx.selfView ? t('wsCoachSectionSelf') : t('wsCoachSummaryClinic');

    host.innerHTML = `
      <div class="profile-layout">
        <div class="group-card profile-group profile-col">
          ${collapseSection('profile', ChromeIcons.profile, leftTitle, esc(profileSub), profileBody, !!ex.profile)}
          <div class="group-divider"></div>
          ${collapseSection('targets', ChromeIcons.targets, targetsTitle, esc(targetsHeaderSub(bt)), targetsBody, !!ex.targets)}
        </div>
        <div class="group-card profile-group profile-col">
          ${collapseSection(
            'mentors',
            ChromeIcons.careTeam,
            mentorsTitle,
            // Collapsed: labels in the subtitle. Expanded: pills only (no triple-list).
            ex.mentors ? '' : esc(mentorsHeaderSub(mentors)),
            mentorsBody,
            !!ex.mentors,
          )}
          <div class="group-divider"></div>
          ${collapseSection('rules', ChromeIcons.rules, rulesTitle, esc(rulesTextPreview(rules?.rawText || '')), rulesBody, !!ex.rules)}
          <div class="group-divider"></div>
          ${collapseSection('macros', ChromeIcons.macros, macrosTitle, macrosSub, macrosBodyHtml, !!ex.macros)}
          ${coach ? `
          <div class="group-divider"></div>
          ${collapseSection('coach', ChromeIcons.coach, coachTitle, esc(coachSub), renderCoachBody(coach, mentors), !!ex.coach)}` : ''}
        </div>
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
      <p class="sub snapshot-note">${esc(ctx.selfView ? t('wsProfileNoteSelf') : t('wsProfileNoteClinic'))}</p>
      <div class="profile-tab-card"><div id="profile-group-host"></div></div>`;
    const host = panel.querySelector('#profile-group-host');
    if (host) renderProfileGroup(host, ctx);
  }

  function paintDashboardCharts(panel, ctx) {
    const charts = global.ClinicCharts;
    if (!charts) return;
    const metabolicHost = panel.querySelector('#metabolic-host');
    if (metabolicHost) {
      if (ctx.chartVp == null) ctx.chartVp = 2;
      if (ctx.chartEndMs == null) ctx.chartEndMs = Date.now();
      charts.drawMetabolicChart(metabolicHost, ctx.parsed, ctx, () => paintDashboardCharts(panel, ctx));
    }
    const trendHost = panel.querySelector('#trend-host');
    const energyHost = panel.querySelector('#energy-host');
    const allDays = charts.enrichBodyTrendDays(ctx.parsed.withings);
    const pd = ctx.trendPeriod ?? 32;
    const fallbackBmr =
      ctx.parsed.withings?.bodyScan?.bmrKcalDay ??
      allDays.find((d) => d.bmrKcalDay != null && Number.isFinite(d.bmrKcalDay))?.bmrKcalDay ??
      null;
    const chartOpts = { fillHeight: true, periodDays: pd, fallbackBmrKcal: fallbackBmr };
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
    // Coach nudge is patient-phone UX (second-person + action-item counts).
    // Clinicians who want that text use Profile → Coach summary (collapsed).
    panel.innerHTML = `
      <div class="dash-card metabolic-card"><div id="metabolic-host"></div></div>
      <div class="charts-row">
        <div class="dash-card chart-half"><div id="trend-host"></div></div>
        <div class="dash-card chart-half"><div id="energy-host"></div></div>
      </div>`;
    paintDashboardCharts(panel, ctx);
  }

  function renderChat(panel, ctx) {
    const activeMentor = ctx.activeMentor || 'nutritionist';
    const selfView = !!ctx.selfView;
    // Account: patient's own app AI chat from the snapshot. Clinic: clinician overlay only.
    const thread = selfView
      ? ((ctx.parsed.appChat || {})[activeMentor] || [])
      : ((ctx.overlay?.chat || {})[activeMentor] || []);
    const draft = ctx._chatDraft || '';

    panel.innerHTML = `
      <p class="sub snapshot-note">${esc(t(selfView ? 'wsChatPrivacyNoteSelf' : 'wsChatPrivacyNote'))}</p>
      <p class="sub snapshot-note chat-rules-note">${esc(t(selfView ? 'wsChatRulesNoteSelf' : 'wsChatRulesNote'))}</p>
      <div class="chat-layout">
        <div class="mentor-nav">
          ${MENTORS.map((m) => `
            <button type="button" class="mentor-pick${m.id === activeMentor ? ' active' : ''}" data-mentor="${m.id}">
              ${mentorChromeIcon(m.id)} ${esc(t(m.labelKey))}
            </button>`).join('')}
        </div>
        <div class="chat-thread">
          <div class="chat-messages" id="chat-msgs">
            ${thread.length
              ? thread.map((m) => bubbleHtml(m, selfView)).join('')
              : `<p class="empty">${esc(t(selfView ? 'wsChatEmptySelf' : 'wsChatEmpty'))}</p>`}
          </div>
          <div class="chat-compose">
            <textarea id="chat-input" placeholder="${esc(t('wsChatPlaceholder', { mentor: mentorMeta(activeMentor).label }))}" rows="2">${esc(draft)}</textarea>
            <button type="button" class="ws-btn primary" id="chat-send">${esc(t('wsChatSend'))}</button>
          </div>
          <div id="chat-error" class="ws-inline-error" hidden role="alert"></div>
        </div>
      </div>`;

    panel.querySelectorAll('.mentor-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.activeMentor = btn.getAttribute('data-mentor');
        ctx._chatDraft = panel.querySelector('#chat-input')?.value || '';
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

  function showChatError(panel, ctx, message, retryText) {
    const err = panel.querySelector('#chat-error');
    if (!err) return;
    err.hidden = false;
    err.innerHTML = `<span>${esc(message)}</span> <button type="button" class="ws-btn secondary" id="chat-retry">${esc(t('wsChatRetry'))}</button>`;
    err.querySelector('#chat-retry')?.addEventListener('click', () => {
      const input = panel.querySelector('#chat-input');
      if (input && retryText) input.value = retryText;
      void sendChat(ctx, input, panel);
    });
  }

  /** Portal language — localStorage (be-26); patient.html may not load clinic-i18n.js. */
  function clinicPortalLocale() {
    if (typeof global.ClinicI18n?.getLocale === 'function') {
      return global.ClinicI18n.getLocale() || 'en';
    }
    try {
      const code = String(localStorage.getItem('healthings_clinic_locale') || 'en')
        .trim()
        .toLowerCase()
        .slice(0, 8);
      const ok = ['en', 'he', 'es', 'fr', 'de', 'ar', 'ru', 'pt', 'it', 'tr'];
      return ok.includes(code) ? code : 'en';
    } catch {
      return 'en';
    }
  }

  function bubbleHtml(m, selfView) {
    const cls = m.role === 'user' ? 'user' : 'assistant';
    const who = m.role === 'user'
      ? t(selfView ? 'wsBubbleYou' : 'wsBubbleClinic')
      : t('wsBubbleMentor');
    // Clinic replies follow clinicLocale; patient quotes inside may still be RTL — dir=auto.
    return `<div class="bubble ${cls}"><div dir="auto">${esc(m.text)}</div><div class="time">${who} · ${new Date(m.sentAt).toLocaleString()}</div></div>`;
  }

  function thinkingBubbleHtml() {
    return `<div class="bubble assistant thinking" id="chat-thinking" aria-live="polite"><div class="chat-thinking-row"><span class="chat-spinner" aria-hidden="true"></span><span>${esc(t('wsMentorThinking'))}</span></div></div>`;
  }

  async function sendChat(ctx, input, panel) {
    const text = input?.value?.trim();
    if (!text || !ctx.api) return;
    const selfView = !!ctx.selfView;
    const mentor = ctx.activeMentor || 'nutritionist';
    const btn = panel.querySelector('#chat-send');
    const msgs = panel.querySelector('#chat-msgs');
    const err = panel.querySelector('#chat-error');
    if (err) { err.hidden = true; err.innerHTML = ''; }
    if (btn) btn.disabled = true;
    if (input) input.disabled = true;

    const userSentAt = new Date().toISOString();
    let optimisticEl = null;
    if (msgs) {
      const empty = msgs.querySelector('.empty');
      if (empty) empty.remove();
      msgs.insertAdjacentHTML(
        'beforeend',
        bubbleHtml({ role: 'user', text, sentAt: userSentAt }, selfView),
      );
      optimisticEl = msgs.lastElementChild;
      msgs.insertAdjacentHTML('beforeend', thinkingBubbleHtml());
      msgs.scrollTop = msgs.scrollHeight;
    }
    if (input) input.value = '';
    ctx._chatDraft = '';

    try {
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/chat`, {
        method: 'POST',
        body: JSON.stringify({
          mentorType: mentor,
          message: text,
          locale: selfView ? patientAppLocale(ctx) : clinicPortalLocale(),
          ...(selfView ? { dayKey: todayKey() } : {}),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || t('wsChatFailed'));
      const data = await res.json();
      if (selfView) {
        if (!ctx.parsed.appChat) ctx.parsed.appChat = {};
        ctx.parsed.appChat[mentor] = data.thread || [];
      } else {
        if (!ctx.overlay) ctx.overlay = { chat: {} };
        ctx.overlay.chat[mentor] = data.thread;
      }
      renderChat(panel, ctx);
    } catch (e) {
      panel.querySelector('#chat-thinking')?.remove();
      optimisticEl?.remove();
      if (input) input.value = text;
      ctx._chatDraft = text;
      showChatError(panel, ctx, e instanceof Error ? e.message : t('wsChatFailed'), text);
    } finally {
      if (btn) btn.disabled = false;
      if (input) input.disabled = false;
      input?.focus();
    }
  }

  /** Account AI chat: prefer profile language from the snapshot (appLocale). */
  function patientAppLocale(ctx) {
    const lang = String(ctx.parsed?.profile?.language || '').toLowerCase();
    const map = [
      ['עבר', 'he'], ['hebrew', 'he'], ['he', 'he'],
      ['العرب', 'ar'], ['arabic', 'ar'], ['ar', 'ar'],
      ['español', 'es'], ['spanish', 'es'], ['es', 'es'],
      ['français', 'fr'], ['french', 'fr'], ['fr', 'fr'],
      ['deutsch', 'de'], ['german', 'de'], ['de', 'de'],
      ['рус', 'ru'], ['russian', 'ru'], ['ru', 'ru'],
      ['portug', 'pt'], ['pt', 'pt'],
      ['italian', 'it'], ['it', 'it'],
      ['türk', 'tr'], ['turkish', 'tr'], ['tr', 'tr'],
    ];
    for (const [needle, code] of map) {
      if (lang === code || lang.startsWith(code) || lang.includes(needle)) return code;
    }
    return clinicPortalLocale();
  }

  /** Prefer patient snapshot rules when they are newer than a clinic overlay (Refresh must surface phone edits). */
  function rulesAnalyzedMs(rules) {
    if (!rules?.analyzedAt) return 0;
    const ms = Date.parse(rules.analyzedAt);
    return Number.isFinite(ms) ? ms : 0;
  }

  function effectiveRules(parsed, overlay) {
    const fromSnap = parsed?.userRules || null;
    const fromOverlay = overlay?.rules || null;
    if (!fromOverlay) return fromSnap;
    if (!fromSnap) return fromOverlay;
    if (rulesRawEqual(fromSnap, fromOverlay)) return fromOverlay;
    return rulesAnalyzedMs(fromSnap) > rulesAnalyzedMs(fromOverlay) ? fromSnap : fromOverlay;
  }

  function rulesSourceHint(parsed, overlay) {
    const fromSnap = parsed?.userRules || null;
    const fromOverlay = overlay?.rules || null;
    if (!fromOverlay) return t('wsRulesHintSnapshotOnly');
    if (!fromSnap) return t('wsRulesHintClinicOnly');
    if (rulesRawEqual(fromSnap, fromOverlay)) {
      return t('wsRulesHintMatch');
    }
    if (rulesAnalyzedMs(fromSnap) > rulesAnalyzedMs(fromOverlay)) {
      return t('wsRulesHintPhoneNewer');
    }
    return t('wsRulesHintClinicNewer');
  }

  function formatRulesHistoryDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function rulesHistoryPreview(rules) {
    const line = (rules?.rawText || '').trim().split('\n').find(Boolean) || '';
    return line.length > 80 ? `${line.slice(0, 77)}…` : line || t('wsRulesEmptyPreview');
  }

  async function fetchRulesHistory(ctx) {
    try {
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/rules/history`);
      if (!res.ok) return [];
      const data = await res.json();
      return data.history || [];
    } catch {
      return [];
    }
  }

  function rulesRawEqual(a, b) {
    return (a?.rawText?.trim() ?? '') === (b?.rawText?.trim() ?? '');
  }

  async function restoreRulesFromHistory(ctx, panel, historyEntry) {
    const raw = historyEntry?.rules?.rawText?.trim();
    if (!raw) return;
    if (!window.confirm(t('wsRulesRestoreConfirm'))) return;
    const textarea = panel.querySelector('#rules-raw');
    if (textarea) textarea.value = raw;
    await saveRules(ctx, panel);
  }

  function rulesTextPreview(raw) {
    const line = String(raw || '').trim().split('\n').find(Boolean) || t('wsBannerNoRules');
    return line.length > 96 ? `${line.slice(0, 93)}…` : line;
  }

  function autosizeRulesTextarea(textarea) {
    if (!textarea) return;
    textarea.style.height = '0px';
    textarea.style.height = `${Math.max(120, textarea.scrollHeight)}px`;
  }

  function wireRulesFolds(panel, ctx) {
    const editorFold = panel.querySelector('.rules-editor-section');
    const editorToggle = panel.querySelector('#rules-editor-toggle');
    const editorOpen = ctx.rulesEditorExpanded !== false;
    if (editorFold) editorFold.classList.toggle('is-open', editorOpen);
    editorToggle?.setAttribute('aria-expanded', editorOpen ? 'true' : 'false');
    const editorChevron = editorToggle?.querySelector('.rules-fold-chevron');
    if (editorChevron) editorChevron.textContent = editorOpen ? '⌃' : '›';

    editorToggle?.addEventListener('click', () => {
      const open = ctx.rulesEditorExpanded === false;
      ctx.rulesEditorExpanded = open;
      editorFold?.classList.toggle('is-open', open);
      editorToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (editorChevron) editorChevron.textContent = open ? '⌃' : '›';
      if (open) autosizeRulesTextarea(panel.querySelector('#rules-raw'));
    });

    const textarea = panel.querySelector('#rules-raw');
    if (editorOpen) autosizeRulesTextarea(textarea);
    textarea?.addEventListener('input', () => autosizeRulesTextarea(textarea));

    const historyFold = panel.querySelector('.rules-history-section');
    const historyToggle = panel.querySelector('#rules-history-toggle');
    const historyOpen = !!ctx.rulesHistoryExpanded;
    if (historyFold) historyFold.classList.toggle('is-open', historyOpen);
    historyToggle?.setAttribute('aria-expanded', historyOpen ? 'true' : 'false');
    const historyChevron = historyToggle?.querySelector('.rules-fold-chevron');
    if (historyChevron) historyChevron.textContent = historyOpen ? '⌃' : '›';

    historyToggle?.addEventListener('click', () => {
      ctx.rulesHistoryExpanded = !ctx.rulesHistoryExpanded;
      const open = ctx.rulesHistoryExpanded;
      historyFold?.classList.toggle('is-open', open);
      historyToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (historyChevron) historyChevron.textContent = open ? '⌃' : '›';
    });
  }

  function renderRulesHistoryHost(host, history, ctx, panel) {
    if (!host) return;
    if (!history.length) {
      host.innerHTML = `<p class="sub rules-hint" style="margin-top:20px">${esc(t('wsRulesNoPriorVersionsHint'))}</p>`;
      return;
    }
    const liveRules = effectiveRules(ctx.parsed, ctx.overlay);
    host.innerHTML = `
      <ul class="rules-history-list">
        ${history.map((h) => `
          <li class="rules-history-item">
            <button type="button" class="rules-history-btn" data-history-id="${esc(h.id)}">
              <span class="rules-history-meta">${esc(formatRulesHistoryDate(h.savedAt))} · ${esc(h.mentorLabel || t('wsRulesHistoryClinic'))}</span>
              <span class="rules-history-preview">${esc(rulesHistoryPreview(h.rules))}</span>
            </button>
            <div class="rules-history-detail hidden" id="history-detail-${esc(h.id)}">
              <pre class="rules-raw" dir="auto">${esc(h.rules?.rawText || '')}</pre>
              ${!rulesRawEqual(h.rules, liveRules) ? `<button type="button" class="ws-btn secondary rules-restore-btn" data-restore-id="${esc(h.id)}">${esc(t('wsRulesRestore'))}</button>` : ''}
            </div>
          </li>`).join('')}
      </ul>`;
    host.querySelectorAll('.rules-history-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-history-id');
        const detail = host.querySelector(`#history-detail-${CSS.escape(id)}`);
        if (!detail) return;
        const willOpen = detail.classList.contains('hidden');
        host.querySelectorAll('.rules-history-detail').forEach((d) => d.classList.add('hidden'));
        if (willOpen) detail.classList.remove('hidden');
      });
    });
    host.querySelectorAll('.rules-restore-btn').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const id = btn.getAttribute('data-restore-id');
        const entry = history.find((h) => h.id === id);
        if (entry) void restoreRulesFromHistory(ctx, panel, entry);
      });
    });
  }

  async function loadRulesHistory(panel, ctx) {
    const host = panel.querySelector('#rules-history-host');
    const history = await fetchRulesHistory(ctx);
    if (!host || !panel.contains(host)) return;
    const meta = panel.querySelector('.rules-history-section .rules-fold-meta');
    if (meta) {
      meta.textContent = history.length
        ? t(history.length === 1 ? 'wsRulesVersionOne' : 'wsRulesVersionMany', { n: history.length })
        : t('wsRulesNoPriorVersions');
    }
    renderRulesHistoryHost(host, history, ctx, panel);
  }

  const FALLBACK_MARKER_CATALOG = [
    { code: 'SAT_FAT_G', unit: 'g', defaultDirection: 'cap', linkedLabCodes: ['CHOLESTEROL_LDL', 'CHOLESTEROL'] },
    { code: 'CHOLESTEROL_MG', unit: 'mg', defaultDirection: 'cap', linkedLabCodes: ['CHOLESTEROL_LDL', 'CHOLESTEROL'] },
    { code: 'SOLUBLE_FIBER_G', unit: 'g', defaultDirection: 'floor', linkedLabCodes: ['CHOLESTEROL_LDL'] },
    { code: 'OMEGA3_G', unit: 'g', defaultDirection: 'floor', linkedLabCodes: ['TRIGLYCERIDES'] },
    { code: 'ADDED_SUGAR_G', unit: 'g', defaultDirection: 'cap', linkedLabCodes: ['HBA1C', 'GLUCOSE', 'TRIGLYCERIDES'] },
    { code: 'SODIUM_MG', unit: 'mg', defaultDirection: 'cap', linkedLabCodes: [] },
    { code: 'POTASSIUM_MG', unit: 'mg', defaultDirection: 'cap', linkedLabCodes: ['CREATININE', 'UREA'] },
    { code: 'PHOSPHORUS_MG', unit: 'mg', defaultDirection: 'cap', linkedLabCodes: ['CREATININE', 'UREA'] },
    { code: 'IODINE_MCG', unit: 'mcg', defaultDirection: 'floor', linkedLabCodes: ['TSH'] },
    { code: 'SELENIUM_MCG', unit: 'mcg', defaultDirection: 'floor', linkedLabCodes: ['TSH'] },
  ];
  const MAX_TREAT_MARKERS = 3;

  const LAB_CODE_ALIASES = {
    CHOLESTEROL_LDL: ['CHOLESTEROL_LDL', 'LDL', 'LDL_CHOL', 'LDL_C'],
    CHOLESTEROL: ['CHOLESTEROL', 'TOTAL_CHOLESTEROL', 'CHOL'],
    CHOLESTEROL_HDL: ['CHOLESTEROL_HDL', 'HDL', 'HDL_CHOL', 'HDL_C'],
    TRIGLYCERIDES: ['TRIGLYCERIDES', 'TRIGLYCERIDE', 'TG'],
    GLUCOSE: ['GLUCOSE', 'GLUC'],
    HBA1C: ['HBA1C', 'HBA_1C', 'A1C', 'HEMOGLOBIN_A1C'],
    CREATININE: ['CREATININE', 'CREATININ'],
    UREA: ['UREA', 'BUN'],
    TSH: ['TSH'],
  };

  function normalizeTreatLabCode(code) {
    return String(code || '')
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }

  function labCodeMatchesLinked(resultCode, linkedCodes) {
    const k = normalizeTreatLabCode(resultCode);
    for (const linked of linkedCodes || []) {
      const canon = normalizeTreatLabCode(linked);
      if (k === canon) return true;
      const aliases = LAB_CODE_ALIASES[canon];
      if (aliases && aliases.includes(k)) return true;
    }
    return false;
  }

  function findLinkedLabHit(labs, linkedCodes) {
    for (const report of labs || []) {
      for (const panel of report.panels || []) {
        for (const r of panel.results || []) {
          if (!labCodeMatchesLinked(r.code, linkedCodes)) continue;
          return {
            code: normalizeTreatLabCode(r.code),
            value: r.value,
            unit: r.unit || '',
            date: String(report.collectedAt || '').slice(0, 10),
          };
        }
      }
    }
    return null;
  }

  function clinicTreatLocale() {
    return String(global.ClinicI18n?.getLocale?.() || 'en')
      .toLowerCase()
      .slice(0, 2);
  }

  function catalogOf(ctx) {
    if (Array.isArray(ctx.markerCatalog) && ctx.markerCatalog.length) return ctx.markerCatalog;
    return FALLBACK_MARKER_CATALOG;
  }

  async function ensureMarkerCatalog(ctx) {
    if (ctx.markerCatalogLoaded) return;
    ctx.markerCatalogLoaded = true;
    if (typeof ctx.api !== 'function') {
      ctx.markerCatalog = FALLBACK_MARKER_CATALOG;
      return;
    }
    try {
      const res = await ctx.api('/v1/clinic/marker-catalog');
      if (!res.ok) throw new Error('catalog');
      const data = await res.json();
      ctx.markerCatalog =
        Array.isArray(data.catalog) && data.catalog.length ? data.catalog : FALLBACK_MARKER_CATALOG;
    } catch {
      ctx.markerCatalog = FALLBACK_MARKER_CATALOG;
    }
  }

  function markerLabel(code, catalog) {
    const meta = (catalog || []).find((c) => c.code === code);
    const loc = clinicTreatLocale();
    const fromRow = meta?.labels?.[loc]?.full || meta?.labels?.en?.full;
    if (fromRow) return fromRow;
    const key = `wsTreat_${code}`;
    const i18n = t(key);
    if (i18n && i18n !== key) return i18n;
    return code;
  }

  function draftMarkersFromOverlay(ctx) {
    if (Array.isArray(ctx.markersDraft)) return ctx.markersDraft;
    const live = ctx.overlay?.markers;
    ctx.markersDraft = Array.isArray(live) ? live.map((m) => ({ ...m })) : [];
    return ctx.markersDraft;
  }

  function renderMarkers(panel, ctx) {
    if (!ctx.markerCatalogLoaded) {
      panel.innerHTML = `<p class="sub">${esc(t('wsTreatCatalogLoading'))}</p>`;
      void ensureMarkerCatalog(ctx).then(() => renderMarkers(panel, ctx));
      return;
    }
    const DIET_MARKER_CATALOG = catalogOf(ctx);
    const draft = draftMarkersFromOverlay(ctx);
    const labs = ctx.parsed.labs || [];
    const used = new Set(draft.map((m) => m.marker));
    const available = DIET_MARKER_CATALOG.filter((c) => !used.has(c.code)).sort((a, b) => {
      const aHit = findLinkedLabHit(labs, a.linkedLabCodes) ? 1 : 0;
      const bHit = findLinkedLabHit(labs, b.linkedLabCodes) ? 1 : 0;
      if (bHit !== aHit) return bHit - aHit;
      return 0;
    });
    const canAdd = draft.length < MAX_TREAT_MARKERS && available.length > 0;

    const rows = draft.length
      ? draft
          .map((m, idx) => {
            const meta = DIET_MARKER_CATALOG.find((c) => c.code === m.marker);
            const linked = m.linkedLabCodes || meta?.linkedLabCodes || [];
            const hit = findLinkedLabHit(labs, linked);
            const labLine = hit
              ? t('wsTreatLabHint', {
                  code: hit.code,
                  value: hit.value,
                  unit: hit.unit,
                  date: hit.date,
                })
              : t('wsTreatNoLab');
            const note = m.note ? `<p class="treat-note" dir="auto">${esc(m.note)}</p>` : '';
            const isPct = m.percentOfEnergy != null && m.ofEnergy === 'kcal_eaten';
            const dirSym = m.direction === 'floor' ? '>' : '<';
            const valueLine = isPct
              ? `${dirSym} ${esc(String(m.percentOfEnergy))}% ${esc(t('wsTreatOfEaten'))} · ${esc(String(m.dailyTarget))}${esc(m.unit)}`
              : `${dirSym} ${esc(String(m.dailyTarget))} ${esc(m.unit)}`;
            return `
          <div class="treat-row" data-idx="${idx}">
            <div class="treat-row-main">
              <strong>${esc(markerLabel(m.marker, DIET_MARKER_CATALOG))}</strong>
              <span class="treat-meta" dir="ltr">${esc(valueLine)}</span>
              <span class="treat-lab">${esc(labLine)}</span>
              ${note}
            </div>
            <button type="button" class="ws-btn secondary treat-remove" data-idx="${idx}">${esc(t('wsTreatRemove'))}</button>
          </div>`;
          })
          .join('')
      : `<p class="sub">${esc(t('wsTreatEmpty'))}</p>`;

    const addForm = canAdd
      ? `
      <div class="treat-add">
        <label class="treat-field">
          <span>${esc(t('wsTreatCode'))}</span>
          <select id="treat-code">
            <option value="">${esc(t('wsTreatPick'))}</option>
            ${available
              .map(
                (c) =>
                  `<option value="${esc(c.code)}" data-unit="${esc(c.unit)}" data-dir="${esc(c.defaultDirection)}">${esc(markerLabel(c.code, DIET_MARKER_CATALOG))} (${esc(c.unit)})</option>`,
              )
              .join('')}
          </select>
        </label>
        <label class="treat-field">
          <span>${esc(t('wsTreatDirection'))}</span>
          <select id="treat-dir">
            <option value="cap">${esc(t('wsMacroTypeLimit'))}</option>
            <option value="floor">${esc(t('wsMacroTypeFloor'))}</option>
          </select>
        </label>
        <label class="treat-field" id="treat-kind-wrap" hidden>
          <span>${esc(t('wsMacroUnit'))}</span>
          <select id="treat-kind">
            <option value="constant">${esc(t('wsMacroUnitG'))}</option>
            <option value="percent">${esc(t('wsMacroUnitPct'))}</option>
          </select>
        </label>
        <label class="treat-field">
          <span>${esc(t('wsTreatTarget'))}</span>
          <input type="number" id="treat-target" min="0.1" step="0.1" />
          <span id="treat-unit" class="treat-unit">g</span>
        </label>
        <label class="treat-field treat-field-wide">
          <span>${esc(t('wsTreatNote'))}</span>
          <input type="text" id="treat-note" maxlength="500" placeholder="${esc(t('wsTreatNotePlaceholder'))}" dir="auto" />
        </label>
        <p id="treat-lab-hint" class="sub treat-lab">${esc(t('wsTreatNoLab'))}</p>
        <button type="button" class="ws-btn secondary" id="treat-add-btn">${esc(t('wsTreatAdd'))}</button>
      </div>`
      : draft.length >= MAX_TREAT_MARKERS
        ? `<p class="sub">${esc(t('wsTreatMax'))}</p>`
        : '';

    panel.innerHTML = `
      <p class="sub rules-intro">${esc(t('wsTreatIntro'))}</p>
      <p class="sub rules-intro">${esc(t('wsTreatAddedSugarHint'))}</p>
      <div class="treat-list">${rows}</div>
      ${addForm}
      <div class="rules-actions" style="margin-top:16px">
        <button type="button" class="ws-btn primary" id="treat-save">${esc(t('wsTreatSave'))}</button>
        <span id="treat-status" class="sub"></span>
      </div>
      ${renderBackfillBlock(ctx, draft)}
      <div id="treat-error" class="ws-inline-error" hidden role="alert"></div>
      <p class="rules-hint">${esc(t('wsTreatAdherenceStub'))}</p>`;

    const codeSel = panel.querySelector('#treat-code');
    const dirSel = panel.querySelector('#treat-dir');
    const unitEl = panel.querySelector('#treat-unit');
    const kindWrap = panel.querySelector('#treat-kind-wrap');
    const kindSel = panel.querySelector('#treat-kind');
    const labHint = panel.querySelector('#treat-lab-hint');

    function refreshAddHint() {
      const code = codeSel?.value;
      const meta = DIET_MARKER_CATALOG.find((c) => c.code === code);
      if (!meta) {
        if (labHint) labHint.textContent = t('wsTreatNoLab');
        if (kindWrap) kindWrap.hidden = true;
        return;
      }
      if (unitEl) {
        const asPct = kindSel?.value === 'percent' && code === 'SAT_FAT_G';
        unitEl.textContent = asPct ? '%' : meta.unit;
      }
      if (kindWrap) kindWrap.hidden = code !== 'SAT_FAT_G';
      if (dirSel && !dirSel.dataset.touched) dirSel.value = meta.defaultDirection;
      const hit = findLinkedLabHit(labs, meta.linkedLabCodes);
      if (labHint) {
        labHint.textContent = hit
          ? t('wsTreatLabHint', {
              code: hit.code,
              value: hit.value,
              unit: hit.unit,
              date: hit.date,
            })
          : t('wsTreatNoLab');
      }
    }
    codeSel?.addEventListener('change', refreshAddHint);
    kindSel?.addEventListener('change', refreshAddHint);
    dirSel?.addEventListener('change', () => {
      if (dirSel) dirSel.dataset.touched = '1';
    });
    refreshAddHint();

    function showTreatError(msg) {
      const err = panel.querySelector('#treat-error');
      if (!err) return;
      err.hidden = false;
      err.innerHTML = `<span>${esc(msg)}</span>`;
    }

    /** Pending form row — must be Add'd (or flushed on Save) before it is stored. */
    function readPendingMarker() {
      const code = codeSel?.value;
      const meta = DIET_MARKER_CATALOG.find((c) => c.code === code);
      const dailyTarget = Number(panel.querySelector('#treat-target')?.value);
      if (!meta || !Number.isFinite(dailyTarget) || dailyTarget <= 0) return null;
      const note = String(panel.querySelector('#treat-note')?.value || '').trim();
      const asPct = code === 'SAT_FAT_G' && kindSel?.value === 'percent';
      const row = {
        marker: meta.code,
        direction: dirSel?.value === 'floor' ? 'floor' : 'cap',
        dailyTarget: asPct
          ? Math.max(1, Math.round((dailyTarget / 100) * 1740 * 10) / 10)
          : dailyTarget,
        unit: meta.unit,
        linkedLabCodes: [...meta.linkedLabCodes],
        ...(note ? { note } : {}),
        setAt: new Date().toISOString(),
        setBy: 'draft',
      };
      if (asPct) {
        row.percentOfEnergy = dailyTarget;
        row.ofEnergy = 'kcal_eaten';
        // Keep dailyTarget as grams fallback (~10% of 1740) until Confirm has today's kcal.
      }
      return row;
    }

    function flushPendingIntoDraft() {
      const pending = readPendingMarker();
      if (!pending) return false;
      if (draft.some((m) => m.marker === pending.marker)) return true;
      if (draft.length >= MAX_TREAT_MARKERS) return false;
      draft.push(pending);
      ctx.markersDraft = draft;
      return true;
    }

    panel.querySelector('#treat-add-btn')?.addEventListener('click', () => {
      const err = panel.querySelector('#treat-error');
      if (err) {
        err.hidden = true;
        err.innerHTML = '';
      }
      if (!flushPendingIntoDraft()) {
        showTreatError(t('wsTreatNeedFields'));
        return;
      }
      renderMarkers(panel, ctx);
    });

    panel.querySelectorAll('.treat-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        if (!Number.isFinite(idx)) return;
        draft.splice(idx, 1);
        ctx.markersDraft = draft;
        renderMarkers(panel, ctx);
      });
    });

    panel.querySelector('#treat-save')?.addEventListener('click', () => {
      const err = panel.querySelector('#treat-error');
      if (err) {
        err.hidden = true;
        err.innerHTML = '';
      }
      // Form filled but Add not clicked — include it so Save matches clinician intent.
      flushPendingIntoDraft();
      if (!draftMarkersFromOverlay(ctx).length) {
        const pendingPartial =
          Boolean(codeSel?.value) || Boolean(panel.querySelector('#treat-target')?.value);
        showTreatError(pendingPartial ? t('wsTreatNeedFields') : t('wsTreatNeedOne'));
        return;
      }
      void saveMarkers(ctx, panel);
    });
    panel.querySelector('#treat-backfill')?.addEventListener('click', () => void requestBackfill(ctx, panel));
  }

  function renderBackfillBlock(ctx, draft) {
    const bf = ctx.overlay?.markersBackfill;
    const hasMarkers = Array.isArray(draft) && draft.length > 0;
    let statusLine = '';
    if (bf?.status === 'pending') {
      statusLine = t('wsTreatBackfillPending', { days: String(bf.days || '') });
    } else if (bf?.status === 'done') {
      statusLine = t('wsTreatBackfillDone', {
        count: String(bf.mealsUpdated != null ? bf.mealsUpdated : '—'),
        days: String(bf.days || ''),
      });
    } else if (bf?.status === 'failed') {
      statusLine = t('wsTreatBackfillFailed', {
        error: bf.error || t('wsTreatBackfillFailedGeneric'),
      });
    }
    const disabled = !hasMarkers || bf?.status === 'pending';
    return `
      <div class="treat-backfill" style="margin-top:20px;padding-top:16px;border-top:1px solid var(--border, #ddd)">
        <p class="sub">${esc(t('wsTreatBackfillIntro'))}</p>
        <div class="treat-add" style="align-items:flex-end">
          <label class="treat-field">
            <span>${esc(t('wsTreatBackfillDays'))}</span>
            <select id="treat-backfill-days" ${disabled ? 'disabled' : ''}>
              ${[7, 14, 30, 60, 90]
                .map(
                  (d) =>
                    `<option value="${d}" ${d === 14 ? 'selected' : ''}>${d}</option>`,
                )
                .join('')}
            </select>
          </label>
          <button type="button" class="ws-btn secondary" id="treat-backfill" ${disabled ? 'disabled' : ''}>
            ${esc(t('wsTreatBackfillRun'))}
          </button>
        </div>
        ${statusLine ? `<p class="sub treat-lab" id="treat-backfill-status">${esc(statusLine)}</p>` : '<p class="sub treat-lab" id="treat-backfill-status"></p>'}
      </div>`;
  }

  async function requestBackfill(ctx, panel) {
    const status = panel.querySelector('#treat-backfill-status');
    const btn = panel.querySelector('#treat-backfill');
    const err = panel.querySelector('#treat-error');
    const days = Number(panel.querySelector('#treat-backfill-days')?.value || 14);
    if (err) {
      err.hidden = true;
      err.innerHTML = '';
    }
    if (btn) btn.disabled = true;
    if (status) status.textContent = t('wsTreatBackfillRequesting');
    try {
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/markers/backfill`, {
        method: 'POST',
        body: JSON.stringify({ days }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t('wsTreatBackfillFailedGeneric'));
      }
      const data = await res.json();
      if (data.overlay) ctx.overlay = data.overlay;
      renderMarkers(panel, ctx);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t('wsTreatBackfillFailedGeneric');
      if (status) status.textContent = '';
      if (err) {
        err.hidden = false;
        err.innerHTML = `<span>${esc(msg)}</span>`;
      }
      if (btn) btn.disabled = false;
    }
  }

  async function saveMarkers(ctx, panel) {
    const draft = draftMarkersFromOverlay(ctx);
    const status = panel.querySelector('#treat-status');
    const btn = panel.querySelector('#treat-save');
    const err = panel.querySelector('#treat-error');
    if (err) {
      err.hidden = true;
      err.innerHTML = '';
    }
    if (btn) btn.disabled = true;
    if (status) status.textContent = t('wsTreatSaving');
    try {
      const body = {
        markers: draft.map((m) => ({
          marker: m.marker,
          direction: m.direction,
          dailyTarget: m.dailyTarget,
          note: m.note,
          linkedLabCodes: m.linkedLabCodes,
          ...(m.percentOfEnergy != null
            ? { percentOfEnergy: m.percentOfEnergy, ofEnergy: 'kcal_eaten' }
            : {}),
        })),
      };
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/markers`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t('wsTreatSaveFailed'));
      }
      const data = await res.json();
      if (data.overlay) ctx.overlay = data.overlay;
      ctx.markersDraft = Array.isArray(data.markers)
        ? data.markers.map((m) => ({ ...m }))
        : Array.isArray(ctx.overlay?.markers)
          ? ctx.overlay.markers.map((m) => ({ ...m }))
          : [];
      renderMarkers(panel, ctx);
      const statusEl = panel.querySelector('#treat-status');
      if (statusEl) statusEl.textContent = t('wsTreatSaved');
    } catch (e) {
      if (status) status.textContent = '';
      const msg = e instanceof Error ? e.message : t('wsTreatSaveFailed');
      if (err) {
        err.hidden = false;
        err.innerHTML = `<span>${esc(msg)}</span>`;
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  const MACRO_AXES = [
    { id: 'kcal', labelKey: 'wsMacroAxisKcal' },
    { id: 'protein_g', labelKey: 'wsMacroAxisP' },
    { id: 'carb_g', labelKey: 'wsMacroAxisC' },
    { id: 'fat_g', labelKey: 'wsMacroAxisF' },
    { id: 'fiber_g', labelKey: 'wsMacroAxisFi' },
    { id: 'net_carb_g', labelKey: 'wsMacroAxisNet' },
  ];

  function axisLabel(axis) {
    const row = MACRO_AXES.find((a) => a.id === axis);
    return row ? t(row.labelKey) : axis;
  }

  function todayValueForAxis(today, axis) {
    if (axis === 'kcal') return today.kcal || 0;
    if (axis === 'protein_g') return today.protein_g || 0;
    if (axis === 'carb_g') return today.carb_g || 0;
    if (axis === 'fat_g') return today.fat_g || 0;
    if (axis === 'fiber_g') return today.fiber_g || 0;
    if (axis === 'net_carb_g') return Math.max(0, (today.carb_g || 0) - (today.fiber_g || 0));
    return 0;
  }

  /** Flatten bounds → one UI row per axis (floor+ceiling = range). */
  function macroRowsFromBounds(bounds) {
    const byAxis = new Map();
    for (const b of bounds || []) {
      const slot = byAxis.get(b.axis) || { axis: b.axis, floor: null, ceiling: null };
      if (b.direction === 'floor') slot.floor = b;
      else slot.ceiling = b;
      byAxis.set(b.axis, slot);
    }
    return [...byAxis.values()].map((slot) => {
      const floor = slot.floor;
      const ceiling = slot.ceiling;
      let type = 'flex';
      if (floor && ceiling) type = 'range';
      else if (floor) type = floor.strength === 'flex' ? 'flex' : 'floor';
      else if (ceiling) type = ceiling.strength === 'flex' ? 'flex' : 'limit';
      const primary = ceiling || floor;
      const kind = primary?.kind === 'percent' ? 'percent' : 'constant';
      return {
        axis: slot.axis,
        type,
        kind,
        lo: floor ? floor.value : '',
        hi: ceiling ? ceiling.value : floor && type === 'flex' ? floor.value : ceiling ? ceiling.value : '',
        value: type === 'range' ? '' : primary ? primary.value : '',
        resolvedValue: primary?.resolvedValue,
        of: primary?.of,
        activityAddBack: ceiling?.activityAddBack || null,
        strength: primary?.strength || 'hard',
      };
    });
  }

  function boundsFromMacroRows(rows) {
    const bounds = [];
    for (const row of rows) {
      const kind = row.kind === 'percent' ? 'percent' : 'constant';
      const unitStrength = row.type === 'flex' ? 'flex' : 'hard';
      const pushOne = (direction, value) => {
        const v = Number(value);
        if (!Number.isFinite(v) || v <= 0) return;
        const b = {
          axis: row.axis,
          direction,
          kind,
          value: v,
          strength: unitStrength,
        };
        if (kind === 'percent') {
          b.of = 'kcal_order';
          b.resolvedValue =
            row.resolvedValue != null && Number(row.resolvedValue) > 0
              ? Number(row.resolvedValue)
              : v;
        }
        if (
          direction === 'ceiling' &&
          row.axis === 'kcal' &&
          row.activityAddBack &&
          Number(row.activityAddBack.capValue) > v
        ) {
          b.activityAddBack = {
            thresholdKcal: Number(row.activityAddBack.thresholdKcal) || 0,
            capValue: Number(row.activityAddBack.capValue),
          };
          b.strength = 'hard';
        }
        bounds.push(b);
      };
      if (row.type === 'range') {
        pushOne('floor', row.lo);
        pushOne('ceiling', row.hi);
      } else if (row.type === 'floor') {
        pushOne('floor', row.value || row.lo);
      } else if (row.type === 'limit') {
        pushOne('ceiling', row.value || row.hi);
      } else {
        // FLEX guide — store as ceiling guide number if present
        const v = row.value || row.hi || row.lo;
        if (v !== '' && v != null) pushOne('ceiling', v);
      }
    }
    return bounds;
  }

  function draftMacrosFromOverlay(ctx) {
    const bounds = ctx.overlay?.macros?.bounds || [];
    const stamp = ctx.overlay?.macros?.updatedAt || '';
    // Rebuild when overlay macros change (e.g. after Rules Save). Keep local edits
    // while the same stamp is open.
    if (Array.isArray(ctx.macroDraft) && ctx.macroDraftStamp === stamp) {
      return ctx.macroDraft;
    }
    ctx.macroDraft = macroRowsFromBounds(bounds);
    ctx.macroDraftStamp = stamp;
    return ctx.macroDraft;
  }

  function setMacroDraft(ctx, rows) {
    ctx.macroDraft = rows;
    ctx.macroDraftStamp = ctx.overlay?.macros?.updatedAt || '';
  }

  function clearMacroDraft(ctx) {
    ctx.macroDraft = null;
    ctx.macroDraftStamp = null;
  }

  function formatBoundSummary(row) {
    const unit = row.kind === 'percent' ? '%' : row.axis === 'kcal' ? ' kcal' : 'g';
    if (row.type === 'range') return `${row.lo}–${row.hi}${unit}`;
    if (row.type === 'floor') return `≥ ${row.value}${unit}`;
    if (row.type === 'limit') return `≤ ${row.value}${unit}`;
    return `${row.value || '—'}${unit}`;
  }

  function renderMacros(panel, ctx) {
    const draft = draftMacrosFromOverlay(ctx);
    const today = dailyMacros(ctx.parsed.todayMeals || []);
    const macrosMeta = ctx.overlay?.macros || null;
    const used = new Set(draft.map((r) => r.axis));
    const available = MACRO_AXES.filter((a) => !used.has(a.id));
    const needs = Array.isArray(macrosMeta?.needsClinician) ? macrosMeta.needsClinician : [];
    const override = macrosMeta?.source === 'clinic_override';

    const needsHtml = needs.length
      ? `<div class="ws-inline-error" role="status" style="margin-bottom:12px">
          <strong>${esc(t('wsMacroNeedsClinician'))}</strong>
          <ul>${needs.map((n) => `<li>${esc(n.question || n.axis)}</li>`).join('')}</ul>
        </div>`
      : '';

    const badge = macrosMeta
      ? override
        ? `<p class="sub" style="color:var(--warn,#b45309)">${esc(t('wsMacroOverrideBadge'))}</p>`
        : `<p class="sub">${esc(t('wsMacroFromRules'))}${macrosMeta.updatedAt ? ` · ${esc(formatIsoShort(macrosMeta.updatedAt))}` : ''}</p>`
      : '';

    const rowsHtml = draft.length
      ? draft
          .map((row, idx) => {
            const actual = todayValueForAxis(today, row.axis);
            const isPct = row.kind === 'percent';
            const unitOpts =
              row.axis === 'kcal'
                ? `<option value="constant" selected>${esc(t('wsMacroUnitKcal'))}</option>`
                : `<option value="constant"${isPct ? '' : ' selected'}>${esc(t('wsMacroUnitG'))}</option>
                   <option value="percent"${isPct ? ' selected' : ''}>${esc(t('wsMacroUnitPct'))}</option>`;
            const valueFields =
              row.type === 'range'
                ? `<input type="number" class="macro-lo" data-idx="${idx}" min="0.1" step="0.1" value="${esc(String(row.lo ?? ''))}" dir="ltr" />
                   <span>–</span>
                   <input type="number" class="macro-hi" data-idx="${idx}" min="0.1" step="0.1" value="${esc(String(row.hi ?? ''))}" dir="ltr" />`
                : `<input type="number" class="macro-val" data-idx="${idx}" min="0.1" step="0.1" value="${esc(String(row.value ?? ''))}" dir="ltr" />`;
            const resolved =
              isPct && row.resolvedValue != null
                ? `<span class="sub" dir="ltr">${esc(t('wsMacroResolved', { n: row.resolvedValue }))}</span>`
                : isPct
                  ? `<span class="sub">${esc(t('wsMacroOfTarget'))}</span>`
                  : '';
            const training =
              row.axis === 'kcal' && (row.type === 'limit' || row.type === 'range')
                ? `<details class="macro-training"${row.activityAddBack ? ' open' : ''}>
                    <summary>${esc(t('wsMacroTraining'))}</summary>
                    <label class="treat-field">${esc(t('wsMacroTrainingAbove'))}
                      <input type="number" class="macro-thr" data-idx="${idx}" min="0" step="1" value="${esc(String(row.activityAddBack?.thresholdKcal ?? ''))}" dir="ltr" />
                    </label>
                    <label class="treat-field">${esc(t('wsMacroTrainingUpTo'))}
                      <input type="number" class="macro-cap" data-idx="${idx}" min="1" step="1" value="${esc(String(row.activityAddBack?.capValue ?? ''))}" dir="ltr" />
                    </label>
                    <p class="sub">${esc(t('wsMacroTrainingPreview', { base: row.value || row.hi || '—', cap: row.activityAddBack?.capValue || '—' }))}</p>
                  </details>`
                : '';
            const hard =
              row.type !== 'flex' ? `<span class="treat-meta">${esc(t('wsMacroHard'))}</span>` : '';
            return `
              <div class="treat-row macro-bound-row" data-idx="${idx}">
                <div class="treat-row-main">
                  <strong>${esc(axisLabel(row.axis))}</strong>
                  ${hard}
                  <div class="macro-edit-row">
                    <select class="macro-type" data-idx="${idx}">
                      <option value="flex"${row.type === 'flex' ? ' selected' : ''}>${esc(t('wsMacroTypeFlex'))}</option>
                      <option value="floor"${row.type === 'floor' ? ' selected' : ''}>${esc(t('wsMacroTypeFloor'))}</option>
                      <option value="limit"${row.type === 'limit' ? ' selected' : ''}>${esc(t('wsMacroTypeLimit'))}</option>
                      <option value="range"${row.type === 'range' ? ' selected' : ''}>${esc(t('wsMacroTypeRange'))}</option>
                    </select>
                    ${valueFields}
                    <select class="macro-kind" data-idx="${idx}"${row.axis === 'kcal' ? ' disabled' : ''}>${unitOpts}</select>
                  </div>
                  ${resolved}
                  ${training}
                  <span class="treat-lab" dir="ltr">${esc(t('wsMacroToday'))}: ${Math.round(actual)} · ${esc(formatBoundSummary(row))}</span>
                </div>
                <button type="button" class="ws-btn secondary macro-remove" data-idx="${idx}">${esc(t('wsMacroRemove'))}</button>
              </div>`;
          })
          .join('')
      : `<p class="sub">${esc(t('wsMacroOrderEmpty'))}</p>`;

    const addForm = available.length
      ? `<div class="treat-add">
          <label class="treat-field">
            <span>${esc(t('wsMacroAdd'))}</span>
            <select id="macro-add-axis">
              <option value="">${esc(t('wsMacroPickAxis'))}</option>
              ${available.map((a) => `<option value="${esc(a.id)}">${esc(t(a.labelKey))}</option>`).join('')}
            </select>
          </label>
          <button type="button" class="ws-btn secondary" id="macro-add-btn">${esc(t('wsMacroAdd'))}</button>
        </div>`
      : '';

    panel.innerHTML = `
      <p class="sub rules-intro">${esc(t('wsMacroOrderIntro'))}</p>
      ${badge}
      ${needsHtml}
      <div class="treat-list">${rowsHtml}</div>
      ${addForm}
      <p class="sub">${esc(t('wsMacroRebuildHint'))}</p>
      <div class="rules-actions" style="margin-top:16px">
        <button type="button" class="ws-btn secondary" id="macro-rebuild">${esc(t('wsMacroRebuild'))}</button>
        <button type="button" class="ws-btn primary" id="macro-save">${esc(t('wsMacroSave'))}</button>
        <span id="macro-status" class="sub"></span>
      </div>
      <div id="macro-error" class="ws-inline-error" hidden role="alert"></div>`;

    const syncDraftField = (idx, patch) => {
      const cur = draftMacrosFromOverlay(ctx);
      if (!cur[idx]) return;
      cur[idx] = { ...cur[idx], ...patch };
      setMacroDraft(ctx, cur);
    };

    panel.querySelectorAll('.macro-type').forEach((sel) => {
      sel.addEventListener('change', () => {
        const idx = Number(sel.getAttribute('data-idx'));
        syncDraftField(idx, { type: sel.value });
        renderMacros(panel, ctx);
      });
    });
    panel.querySelectorAll('.macro-kind').forEach((sel) => {
      sel.addEventListener('change', () => {
        const idx = Number(sel.getAttribute('data-idx'));
        syncDraftField(idx, { kind: sel.value });
        renderMacros(panel, ctx);
      });
    });
    panel.querySelectorAll('.macro-val').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncDraftField(Number(inp.getAttribute('data-idx')), { value: inp.value });
      });
    });
    panel.querySelectorAll('.macro-lo').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncDraftField(Number(inp.getAttribute('data-idx')), { lo: inp.value });
      });
    });
    panel.querySelectorAll('.macro-hi').forEach((inp) => {
      inp.addEventListener('change', () => {
        syncDraftField(Number(inp.getAttribute('data-idx')), { hi: inp.value });
      });
    });
    panel.querySelectorAll('.macro-thr, .macro-cap').forEach((inp) => {
      inp.addEventListener('change', () => {
        const idx = Number(inp.getAttribute('data-idx'));
        const row = draftMacrosFromOverlay(ctx)[idx];
        if (!row) return;
        const thr = panel.querySelector(`.macro-thr[data-idx="${idx}"]`)?.value;
        const cap = panel.querySelector(`.macro-cap[data-idx="${idx}"]`)?.value;
        const add =
          cap && Number(cap) > 0
            ? { thresholdKcal: Number(thr) || 0, capValue: Number(cap) }
            : null;
        syncDraftField(idx, { activityAddBack: add });
      });
    });
    panel.querySelectorAll('.macro-remove').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.getAttribute('data-idx'));
        setMacroDraft(
          ctx,
          draftMacrosFromOverlay(ctx).filter((_, i) => i !== idx),
        );
        renderMacros(panel, ctx);
      });
    });
    panel.querySelector('#macro-add-btn')?.addEventListener('click', () => {
      const axis = panel.querySelector('#macro-add-axis')?.value;
      if (!axis) return;
      const rows = draftMacrosFromOverlay(ctx);
      rows.push({
        axis,
        type: axis === 'kcal' ? 'limit' : 'range',
        kind: 'constant',
        value: '',
        lo: '',
        hi: '',
        strength: 'hard',
        activityAddBack: null,
      });
      setMacroDraft(ctx, rows);
      renderMacros(panel, ctx);
    });
    panel.querySelector('#macro-save')?.addEventListener('click', () => void saveMacros(ctx, panel));
    panel.querySelector('#macro-rebuild')?.addEventListener('click', () => void rebuildMacros(ctx, panel));
  }

  async function rebuildMacros(ctx, panel) {
    const status = panel.querySelector('#macro-status');
    const btn = panel.querySelector('#macro-rebuild');
    const err = panel.querySelector('#macro-error');
    if (err) {
      err.hidden = true;
      err.innerHTML = '';
    }
    if (btn) btn.disabled = true;
    if (status) status.textContent = t('wsMacroRebuilding');
    try {
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/macros/rebuild`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t('wsMacroRebuildFailed'));
      }
      const data = await res.json();
      if (data.overlay) ctx.overlay = data.overlay;
      clearMacroDraft(ctx);
      renderMacros(panel, ctx);
      const statusEl = panel.querySelector('#macro-status');
      if (statusEl) statusEl.textContent = t('wsMacroRebuildDone');
    } catch (e) {
      if (status) status.textContent = '';
      const msg = e instanceof Error ? e.message : t('wsMacroRebuildFailed');
      if (err) {
        err.hidden = false;
        err.innerHTML = `<span>${esc(msg)}</span>`;
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function saveMacros(ctx, panel) {
    const status = panel.querySelector('#macro-status');
    const btn = panel.querySelector('#macro-save');
    const err = panel.querySelector('#macro-error');
    if (err) {
      err.hidden = true;
      err.innerHTML = '';
    }
    if (btn) btn.disabled = true;
    if (status) status.textContent = t('wsMacroSaving');
    try {
      const rows = draftMacrosFromOverlay(ctx);
      // Flush number inputs before convert
      panel.querySelectorAll('.macro-val').forEach((inp) => {
        const idx = Number(inp.getAttribute('data-idx'));
        if (rows[idx]) rows[idx].value = inp.value;
      });
      panel.querySelectorAll('.macro-lo').forEach((inp) => {
        const idx = Number(inp.getAttribute('data-idx'));
        if (rows[idx]) rows[idx].lo = inp.value;
      });
      panel.querySelectorAll('.macro-hi').forEach((inp) => {
        const idx = Number(inp.getAttribute('data-idx'));
        if (rows[idx]) rows[idx].hi = inp.value;
      });
      const bounds = boundsFromMacroRows(rows);
      // Percent resolvedValue: if missing, leave server to 400 — compute from kcal row when possible
      const kcalRow = rows.find((r) => r.axis === 'kcal');
      const kcalBase = Number(kcalRow?.value || kcalRow?.hi || 0);
      for (const b of bounds) {
        if (b.kind === 'percent' && !(b.resolvedValue > 0) && kcalBase > 0) {
          const denom = b.axis === 'fat_g' ? 9 : 4;
          b.resolvedValue = Math.round((b.value / 100) * kcalBase / denom * 10) / 10;
        }
      }
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/macros`, {
        method: 'PUT',
        body: JSON.stringify({ bounds, source: 'clinic_override' }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t('wsMacroSaveFailed'));
      }
      const data = await res.json();
      if (data.overlay) ctx.overlay = data.overlay;
      clearMacroDraft(ctx);
      renderMacros(panel, ctx);
      const statusEl = panel.querySelector('#macro-status');
      if (statusEl) statusEl.textContent = t('wsMacroSaved');
    } catch (e) {
      if (status) status.textContent = '';
      const msg = e instanceof Error ? e.message : t('wsMacroSaveFailed');
      if (err) {
        err.hidden = false;
        err.innerHTML = `<span>${esc(msg)}</span>`;
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  function renderRules(panel, ctx) {
    const rules = effectiveRules(ctx.parsed, ctx.overlay);
    const raw = rules?.rawText || '';
    const rtl = profileRtl(ctx.parsed.profile);
    const editorOpen = ctx.rulesEditorExpanded !== false;
    const historyOpen = !!ctx.rulesHistoryExpanded;
    // Account can edit; clinic history API is mentor-only so stay hidden on selfView.
    const hideHistory = !!ctx.selfView;
    const sourceHint = ctx.selfView
      ? t('wsRulesHintSelfEdit')
      : rulesSourceHint(ctx.parsed, ctx.overlay);

    panel.innerHTML = `
      <p class="sub rules-intro">${esc(t(ctx.selfView ? 'wsRulesIntroSelf' : 'wsRulesIntro'))}</p>
      <div class="rules-layout">
        <div class="rules-fold rules-editor-section${editorOpen ? ' is-open' : ''}">
          <button type="button" class="rules-fold-toggle" id="rules-editor-toggle" aria-expanded="${editorOpen ? 'true' : 'false'}">
            <span class="rules-fold-title">${esc(t(ctx.selfView ? 'wsRulesEditorTitleSelf' : 'wsRulesEditorTitle'))}</span>
            <span class="rules-fold-preview">${esc(rulesTextPreview(raw))}</span>
            <span class="rules-fold-chevron">${editorOpen ? '⌃' : '›'}</span>
          </button>
          <div class="rules-fold-body">
            <textarea id="rules-raw"${rtl ? ' dir="rtl"' : ''} placeholder="${esc(t('wsRulesPlaceholder'))}">${esc(raw)}</textarea>
            <div class="rules-actions">
              <button type="button" class="ws-btn primary" id="rules-save">${esc(t('wsRulesSave'))}</button>
              <span id="rules-status" class="sub"></span>
            </div>
            <div id="rules-error" class="ws-inline-error" hidden role="alert"></div>
            <p class="rules-hint">${esc(sourceHint)}</p>
          </div>
        </div>
        ${hideHistory ? '' : `
        <div class="rules-fold rules-history-section${historyOpen ? ' is-open' : ''}">
          <button type="button" class="rules-fold-toggle" id="rules-history-toggle" aria-expanded="${historyOpen ? 'true' : 'false'}">
            <span class="rules-fold-title">${esc(t('wsRulesHistoryTitle'))}</span>
            <span class="rules-fold-meta">${esc(t('wsRulesTapToExpand'))}</span>
            <span class="rules-fold-chevron">${historyOpen ? '⌃' : '›'}</span>
          </button>
          <div class="rules-fold-body">
            <div id="rules-history-host" class="rules-history-panel"><p class="sub rules-hint">${esc(t('wsRulesLoadingHistory'))}</p></div>
          </div>
        </div>`}
      </div>`;

    panel.querySelector('#rules-save')?.addEventListener('click', () => void saveRules(ctx, panel));
    wireRulesFolds(panel, ctx);
    if (!hideHistory) void loadRulesHistory(panel, ctx);
  }

  async function saveRules(ctx, panel) {
    const raw = panel.querySelector('#rules-raw')?.value?.trim();
    if (!raw) return;
    const status = panel.querySelector('#rules-status');
    const btn = panel.querySelector('#rules-save');
    const err = panel.querySelector('#rules-error');
    if (err) { err.hidden = true; err.innerHTML = ''; }
    if (btn) btn.disabled = true;
    if (status) status.textContent = t('wsRulesSaving');
    try {
      // One route for clinic + account — server saveDietaryRules branches by role.
      const res = await ctx.api(`/v1/clinic/patients/${ctx.patientId}/rules`, {
        method: 'PUT',
        body: JSON.stringify({ rawText: raw }),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || t('wsRulesSaveFailedStatus', { n: res.status }));
      }
      const data = await res.json();
      if (data.rules) ctx.parsed.userRules = data.rules;
      // Account keeps overlay null (snapshot is source of truth). Clinic keeps mentor overlay.
      if (!ctx.selfView && data.overlay) {
        ctx.overlay = data.overlay;
        // Rules Save rebuilds macros — drop stale Macros · Live draft so kcal/etc. appear.
        clearMacroDraft(ctx);
      }
      renderRules(panel, ctx);
      const banner = document.getElementById('patient-banner');
      if (banner) renderPatientBanner(banner, ctx, ctx.displayName || null);
      if (!ctx.selfView) void loadRulesHistory(panel, ctx);
      const statusEl = panel.querySelector('#rules-status');
      if (statusEl) {
        statusEl.textContent = ctx.selfView ? t('wsRulesSavedSelf') : t('wsRulesSaved');
      }
    } catch (e) {
      if (status) status.textContent = '';
      const msg = e instanceof Error ? e.message : t('wsRulesSaveFailed');
      const shown =
        msg === 'Failed to fetch'
          ? t('wsRulesUnreachable')
          : msg;
      if (err) {
        err.hidden = false;
        err.innerHTML = `<span>${esc(shown)}</span> <button type="button" class="ws-btn secondary" id="rules-retry">${esc(t('wsRulesRetry'))}</button>`;
        err.querySelector('#rules-retry')?.addEventListener('click', () => void saveRules(ctx, panel));
      }
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
    const labs = ctx.parsed.labs || [];
    const pts = charts?.buildLipidPoints(labs) || [];
    const options = charts?.listLabTrendMarkerOptions?.(labs) || [];
    const drawsFrag = pts.length
      ? t(pts.length === 1 ? 'wsLipidsDrawsOne' : 'wsLipidsDrawsMany', { n: pts.length })
      : '';
    const noteKey = ctx.selfView ? 'wsLipidsNoteSelf' : 'wsLipidsNoteClinic';

    const store = ctx.parsed?.rawStore || {};
    let patientCode = '';
    try {
      const raw = store.lab_custom_trend_code;
      if (raw != null) {
        patientCode = typeof raw === 'string' ? raw.replace(/^"|"$/g, '').trim() : String(raw);
      }
    } catch { /* */ }

    const viewKey = `clinic_lab_custom_trend_${ctx.patientId || 'self'}`;
    let viewerCode = null;
    try { viewerCode = localStorage.getItem(viewKey); } catch { /* */ }
    if (viewerCode === '') viewerCode = null;
    const effectiveCode = viewerCode != null ? viewerCode : (patientCode || '');
    const series = effectiveCode && charts?.buildLabMarkerTrendSeries
      ? charts.buildLabMarkerTrendSeries(labs, effectiveCode)
      : null;

    const lipidOpen = localStorage.getItem('clinic_lipid_chart_open') !== '0';
    const markerOpen = localStorage.getItem('clinic_marker_chart_open') !== '0';

    const optionHtml = options.map((m) => {
      const sel = m.code === effectiveCode ? ' selected' : '';
      const label = `${m.name} (${m.code})${m.unit ? ` · ${m.unit}` : ''} · ${m.drawCount}`;
      return `<option value="${esc(m.code)}"${sel}>${esc(label)}</option>`;
    }).join('');

    panel.innerHTML = `
      <p class="sub snapshot-note">${esc(t(noteKey, { draws: drawsFrag }))}</p>
      <details class="lab-chart-details" id="lipid-details"${lipidOpen ? ' open' : ''}>
        <summary class="lab-chart-summary">${esc(t('wsLipidTitle'))}</summary>
        <div class="dash-card lipid-tab-card"><div id="lipid-trend-host"></div></div>
        ${pts.length >= 2 ? '' : `<p class="sub lipid-need-more">${esc(t('wsLipidNeedMore'))}</p>`}
      </details>
      <details class="lab-chart-details" id="marker-details"${markerOpen ? ' open' : ''}>
        <summary class="lab-chart-summary">${esc(t('wsMarkerTitle'))}</summary>
        <div class="dash-card lipid-tab-card marker-tab-card">
          <label class="marker-picker-label" for="marker-pick">${esc(t('wsMarkerPick'))}</label>
          <div class="marker-picker-row">
            <input type="search" id="marker-filter" class="marker-filter" placeholder="${esc(t('wsMarkerSearch'))}" autocomplete="off" />
            <select id="marker-pick" class="marker-pick">
              <option value="">${esc(t('wsMarkerPick'))}</option>
              ${optionHtml}
            </select>
          </div>
          ${!ctx.selfView && patientCode ? `<p class="sub marker-default-hint">${esc(t('wsMarkerPatientDefault', { code: patientCode }))}</p>` : ''}
          <div id="marker-trend-host"></div>
        </div>
      </details>`;

    const lipidHost = panel.querySelector('#lipid-trend-host');
    if (lipidHost && charts && pts.length >= 2) {
      charts.drawLipidChart(lipidHost, labs, {
        gender: ctx.parsed.profile?.gender || null,
        rtl: profileRtl(ctx.parsed.profile),
      });
    }

    const markerHost = panel.querySelector('#marker-trend-host');
    if (markerHost && charts) {
      if (series && series.points.length >= 2) {
        charts.drawMarkerTrendChart(markerHost, series, { rtl: profileRtl(ctx.parsed.profile) });
      } else if (effectiveCode) {
        markerHost.innerHTML = `<p class="sub lipid-need-more">${esc(t('wsMarkerNeedTwo'))}</p>`;
      } else if (!options.length) {
        markerHost.innerHTML = `<p class="sub lipid-need-more">${esc(t('wsMarkerNoOptions'))}</p>`;
      } else {
        markerHost.innerHTML = '';
      }
    }

    const lipidDetails = panel.querySelector('#lipid-details');
    const markerDetails = panel.querySelector('#marker-details');
    lipidDetails?.addEventListener('toggle', () => {
      try { localStorage.setItem('clinic_lipid_chart_open', lipidDetails.open ? '1' : '0'); } catch { /* */ }
    });
    markerDetails?.addEventListener('toggle', () => {
      try { localStorage.setItem('clinic_marker_chart_open', markerDetails.open ? '1' : '0'); } catch { /* */ }
    });

    const pick = panel.querySelector('#marker-pick');
    const filter = panel.querySelector('#marker-filter');
    const allOptions = Array.from(pick?.querySelectorAll('option') || []);

    filter?.addEventListener('input', () => {
      const q = String(filter.value || '').trim().toLowerCase();
      allOptions.forEach((opt, idx) => {
        if (idx === 0) { opt.hidden = false; return; }
        const hay = `${opt.value} ${opt.textContent || ''}`.toLowerCase();
        opt.hidden = q ? !hay.includes(q) : false;
      });
    });

    pick?.addEventListener('change', () => {
      const next = pick.value || '';
      try { localStorage.setItem(viewKey, next); } catch { /* */ }
      renderLipidsTab(panel, ctx);
    });
  }

  function renderNutritionReports(panel, ctx) {
    const store = ctx.parsed.nutritionDirectives || { activeId: null, entries: [] };
    const entries = store.entries || [];
    const intro = ctx.selfView
      ? `<p class="sub snapshot-note">${esc(t('wsNutritionNoteSelf'))}</p>`
      : `<p class="sub snapshot-note">${esc(t('wsNutritionNoteClinic'))}</p>`;

    if (!entries.length) {
      panel.innerHTML = `
        ${intro}
        <div class="nutrition-tab-wrap">
          <div class="nutrition-card">
            <p class="nutrition-section-title">${esc(t('wsNutritionReportsTitle'))}</p>
            <p class="nutrition-summary-line">${esc(t('wsNutritionEmpty'))}</p>
          </div>
        </div>`;
      return;
    }

    const effectiveActiveId = store.activeId || entries[0]?.id;
    const active = entries.find((e) => e.id === effectiveActiveId) || entries[0];
    let selectedId = ctx.nutritionSelectedId || effectiveActiveId;
    if (!entries.find((e) => e.id === selectedId)) selectedId = effectiveActiveId;
    const selected = entries.find((e) => e.id === selectedId) || active;
    const rtl = directiveRtl(selected, ctx.parsed.profile);

    const railHtml = entries.map((entry) => {
      const isActive = entry.id === effectiveActiveId;
      const isSelected = entry.id === selectedId;
      const preview = directivePreviewLine(entry);
      return `
        <button type="button" class="nutrition-chip${isActive ? ' nutrition-chip-active' : ''}${isSelected ? ' nutrition-chip-selected' : ''}" data-id="${esc(entry.id)}">
          <span class="nutrition-chip-date">${esc(formatDirectiveDate(entry))}</span>
          <span class="nutrition-chip-label">${esc(entry.title)}</span>
          ${isActive ? `<span class="nutrition-chip-badge">${esc(t('wsNutritionActive'))}</span>` : ''}
          ${preview ? `<span class="nutrition-chip-preview">${esc(preview)}</span>` : ''}
        </button>`;
    }).join('');

    const activeBadge = selected.id === effectiveActiveId
      ? ` · <span class="nutrition-chip-badge">${esc(t('wsNutritionActive'))}</span>`
      : '';

    panel.innerHTML = `
      ${intro}
      <div class="nutrition-tab-wrap">
        <div class="nutrition-card">
          <p class="nutrition-section-title">${esc(t('wsNutritionReportsTitle'))}</p>
          <p class="nutrition-summary-line">${esc(t('wsNutritionActiveSummary', { title: active.title, date: formatDirectiveDate(active) }))}</p>
          <div class="nutrition-layout">
            <div class="nutrition-rail" role="list">${railHtml}</div>
            <div class="nutrition-detail-panel${rtl ? ' nutrition-rtl' : ''}">
              <h3 class="nutrition-detail-title">${esc(selected.title)}</h3>
              <p class="nutrition-detail-meta">${esc(formatDirectiveDate(selected))}${selected.sourceFileName ? ` · ${esc(selected.sourceFileName)}` : ''}${activeBadge}</p>
              <pre class="nutrition-detail-body prose-col">${esc(selected.fullText)}</pre>
            </div>
          </div>
        </div>
      </div>`;

    panel.querySelectorAll('.nutrition-chip').forEach((btn) => {
      btn.addEventListener('click', () => {
        ctx.nutritionSelectedId = btn.getAttribute('data-id');
        renderNutritionReports(panel, ctx);
      });
    });
  }

  /**
   * A draw is a date, not a moment: these ISO strings carry local midnight, so
   * formatIsoShort would print a meaningless "12:00 AM" and drop the year that
   * actually distinguishes one report from another.
   */
  function formatLabDate(iso) {
    if (!iso) return t('wsLabReportFallback');
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function renderLabs(panel, ctx) {
    const labs = ctx.parsed.labs;
    if (!labs.length) {
      panel.innerHTML = `<p class="empty">${esc(t('wsLabsEmpty'))}</p>`;
      return;
    }
    panel.innerHTML = labs.map((report) => `
      <div class="lab-panel">
        <h3>${esc(formatLabDate(report.collectedAt))}</h3>
        <table class="data-table">
          <thead><tr><th>${esc(t('wsLabsTest'))}</th><th>${esc(t('wsLabsValue'))}</th><th>${esc(t('wsLabsFlag'))}</th></tr></thead>
          <tbody>
            ${(report.panels || []).flatMap((p) => (p.results || []).map((r) => `
              <tr>
                <td>${esc(r.name || r.code)}${r.nameOriginal && r.nameOriginal !== r.name
                  ? `<br><span class="lab-name-original" dir="ltr">${esc(r.nameOriginal)}</span>`
                  : ''}</td>
                <td>${r.value} ${esc(r.unit || '')}${Number.isFinite(r.refLow) && Number.isFinite(r.refHigh)
                  ? `<br><span class="lab-ref-range" dir="ltr">${r.refLow}&ndash;${r.refHigh}</span>`
                  : ''}</td>
                <td>${r.flag && r.flag !== 'normal' && r.flag !== 'unknown' ? esc(r.flag) : ''}</td>
              </tr>`)).join('')}
          </tbody>
        </table>
      </div>`).join('');
  }

  /* ── usage tab (/account/ self-view — be-06 two-layer billing) ────────── */

  function usageWhen(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso || '—';
    return d.toLocaleString(clinicPortalLocale(), {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  }

  function invoiceMoney(cents, currency) {
    try {
      return new Intl.NumberFormat(clinicPortalLocale(), {
        style: 'currency',
        currency: String(currency || 'usd').toUpperCase(),
      }).format(cents / 100);
    } catch {
      return (cents / 100).toFixed(2) + ' ' + String(currency || 'usd').toUpperCase();
    }
  }

  function invoiceStatusLabel(status) {
    return t({
      comped_alpha: 'invStatusComped',
      paid: 'invStatusPaid',
      failed: 'invStatusFailed',
      pending: 'invStatusPending',
    }[status] || 'invStatusPending');
  }

  /** Live fetch, not snapshot: usage and invoices happen server-side, the phone never sees them. */
  async function renderUsage(panel, ctx) {
    panel.innerHTML = `<p class="empty">${esc(t('wsUsageLoading'))}</p>`;
    if (typeof ctx.api !== 'function') {
      panel.innerHTML = `<p class="empty">${esc(t('wsUsageError'))}</p>`;
      return;
    }
    let wallet = null;
    let events = [];
    let invoices = [];
    let billingLive = false;
    try {
      const [wRes, eRes, iRes] = await Promise.all([
        ctx.api('/v1/wallet'),
        ctx.api('/v1/usage/events?limit=50'),
        ctx.api('/v1/billing/invoices'),
      ]);
      if (!eRes.ok) throw new Error('usage_http_' + eRes.status);
      events = (await eRes.json()).events || [];
      if (wRes.ok) wallet = (await wRes.json()).wallet || null;
      if (iRes.ok) {
        const inv = await iRes.json();
        invoices = inv.invoices || [];
        billingLive = Boolean(inv.billingLive);
      }
    } catch {
      panel.innerHTML = `<p class="empty">${esc(t('wsUsageError'))}</p>`;
      return;
    }

    const balance = wallet
      ? `<p class="usage-balance"><strong>${esc(t('wsUsageBalance', { n: wallet.balanceTokens }))}</strong></p>`
      : '';
    const eventsHtml = !events.length
      ? `<p class="empty">${esc(t('wsUsageEmpty'))}</p>`
      : `
        <table class="data-table">
          <thead><tr>
            <th>${esc(t('usageColWhen'))}</th>
            <th>${esc(t('usageColType'))}</th>
            <th>${esc(t('usageColModel'))}</th>
            <th>${esc(t('usageColGemini'))}</th>
            <th>${esc(t('usageColCredits'))}</th>
          </tr></thead>
          <tbody>
            ${events.map((e) => `
              <tr>
                <td>${esc(usageWhen(e.createdAt))}</td>
                <td dir="ltr">${esc(e.reason)}</td>
                <td dir="ltr">${esc(e.geminiModel || '—')}</td>
                <td dir="ltr">${e.geminiTotalTokens != null ? esc(Number(e.geminiTotalTokens).toLocaleString()) : '—'}</td>
                <td dir="ltr">${esc(e.tokens)}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    const invoicesHtml = !invoices.length
      ? `<p class="empty">${esc(t('noInvoices'))}</p>`
      : `
        <table class="data-table">
          <thead><tr>
            <th>${esc(t('invColNumber'))}</th>
            <th>${esc(t('invColDate'))}</th>
            <th>${esc(t('invColAmount'))}</th>
            <th>${esc(t('invColCharged'))}</th>
            <th>${esc(t('invColStatus'))}</th>
          </tr></thead>
          <tbody>
            ${invoices.map((inv) => `
              <tr>
                <td dir="ltr">${esc(inv.number)}</td>
                <td>${esc(usageWhen(inv.createdAt))}</td>
                <td dir="ltr">${esc(invoiceMoney(inv.amountCents, inv.currency))}</td>
                <td dir="ltr">${esc(invoiceMoney(inv.chargedCents, inv.currency))}</td>
                <td>${esc(invoiceStatusLabel(inv.status))}</td>
              </tr>`).join('')}
          </tbody>
        </table>`;
    panel.innerHTML = `
      <div class="lab-panel">
        ${balance}
        <p class="meta">${esc(t('wsUsageLead'))}</p>
        ${eventsHtml}
        <h3 style="margin-top:20px">${esc(t('billingTitle'))}</h3>
        ${billingLive ? '' : `<p class="meta">${esc(t('billingAlphaNote'))}</p>`}
        ${invoicesHtml}
      </div>`;
  }

  const ALL_TABS = [
    { id: 'dashboard', labelKey: 'wsTabDashboard', group: 'read' },
    { id: 'profile', labelKey: 'wsTabProfile', group: 'read' },
    { id: 'lipids', labelKey: 'wsTabLipids', group: 'read' },
    { id: 'foodlog', labelKey: 'wsTabFoodLog', group: 'read' },
    { id: 'nutrition', labelKey: 'wsTabNutrition', group: 'read' },
    { id: 'labs', labelKey: 'wsTabLabs', group: 'read' },
    { id: 'chat', labelKey: 'wsTabChat', labelKeySelf: 'wsTabChatSelf', group: 'write' },
    { id: 'rules', labelKey: 'wsTabRules', group: 'write', live: true },
    { id: 'markers', labelKey: 'wsTabMarkers', group: 'write', live: true, clinicOnly: true },
    { id: 'macros', labelKey: 'wsTabMacros', group: 'write', live: true, clinicOnly: true },
    // selfOnly: /v1/usage/events is payer-scoped — on the clinic patient page it
    // would show the mentor's whole-clinic ledger, not this patient's usage.
    { id: 'usage', labelKey: 'wsTabUsage', group: 'read', selfOnly: true },
  ];

  /**
   * Chat and Rules write on clinic (overlay APIs). On /account/ Rules is editable;
   * AI chat is read-only from the phone snapshot (be-15 / be-24 account exception).
   * Treatment markers are clinic-only (be-41).
   */
  function allowedTabs(ctx) {
    const base = ALL_TABS.filter((tab) => {
      if (tab.selfOnly && !ctx.selfView) return false;
      if (tab.clinicOnly && ctx.selfView) return false;
      return true;
    });
    if (!Array.isArray(ctx.tabIds)) return base;
    const allowed = base.filter((tab) => ctx.tabIds.includes(tab.id));
    return allowed.length ? allowed : base;
  }

  function tabButtonHtml(tab, activeId, selfView) {
    // Rules is live on clinic and account (both can edit / save).
    const live = tab.live ? ` <span class="ws-tab-live">${esc(t('wsTabLive'))}</span>` : '';
    const labelKey = selfView && tab.labelKeySelf ? tab.labelKeySelf : tab.labelKey;
    return `<button type="button" class="ws-tab${activeId === tab.id ? ' active' : ''}" data-tab="${tab.id}">${esc(t(labelKey))}${live}</button>`;
  }

  function formatClientLabel(platform, appVersion, build) {
    if (!platform && !appVersion && !build) return '';
    const os =
      platform === 'android'
        ? 'Android'
        : platform === 'ios'
          ? 'iOS'
          : platform
            ? String(platform)
            : '?';
    const ver = [appVersion, build ? `(${build})` : ''].filter(Boolean).join(' ').trim();
    return ver ? `${os} · ${ver}` : os;
  }

  function renderPatientBanner(el, ctx, displayName) {
    if (!el) return;
    const p = ctx.parsed?.profile || {};
    const body = ctx.parsed?.withings?.bodyScan;
    const rules = effectiveRules(ctx.parsed, ctx.overlay);
    const n = rulesActiveCount(rules);
    const gender = formatGender(p.gender);
    const identity = [
      p.age != null ? t('wsBannerAgeY', { n: p.age }) : null,
      gender,
      p.heightCm ? `${p.heightCm} cm` : null,
    ].filter(Boolean).join(' · ') || t('wsBannerProfileIncomplete');
    const fatPct = fatPctFromBody(body);
    const scanTitle = body?.measuredAt
      ? t('wsBannerMeasured', { when: new Date(body.measuredAt).toLocaleString() })
      : t('wsBannerBodyScan');
    // Same chip wording on clinic + account (“N rules”); source still decides green vs off.
    const rulesLabel = n
      ? t(n === 1 ? 'wsBannerRuleActive' : 'wsBannerRulesActive', { n })
      : t('wsBannerNoRules');
    const syncLabel = formatRelativeSync(ctx.blob?.createdAt);
    const name = displayName || (ctx.selfView ? t('wsBannerYou') : t('wsBannerPatient'));
    // Account only: muted chip after Synced (not before the name — that competed with identity).
    const readonlyChip = ctx.selfView
      ? `<span class="chip off ws-case-readonly" title="${esc(t('wsMealReadonlySelf'))}">${esc(t('wsBannerReadonly'))}</span>`
      : '';
    const clientLabel = formatClientLabel(
      ctx.client?.platform,
      ctx.client?.appVersion,
      ctx.client?.build,
    );
    const clientChip = clientLabel
      ? `<span class="chip off ws-banner-client" title="${esc(t('wsBannerClientTip'))}">${esc(clientLabel)}</span>`
      : '';

    const stats = body
      ? [
          body.weightKg != null
            ? `<div class="ws-stat"><span class="ws-stat-lbl">${esc(t('wsBannerWeight'))}</span><span class="ws-stat-val">${body.weightKg.toFixed(1)} <small>kg</small></span></div>`
            : '',
          body.muscleMassKg != null
            ? `<div class="ws-stat"><span class="ws-stat-lbl">${esc(t('wsBannerMuscle'))}</span><span class="ws-stat-val">${body.muscleMassKg.toFixed(1)} <small>kg</small></span></div>`
            : '',
          body.fatMassKg != null
            ? `<div class="ws-stat"><span class="ws-stat-lbl">${esc(t('wsBannerFat'))}</span><span class="ws-stat-val">${body.fatMassKg.toFixed(1)} <small>kg</small>${fatPct != null ? ` <small class="ws-stat-pct">${fatPct.toFixed(1)}%</small>` : ''}</span></div>`
            : '',
          body.bmrKcalDay != null
            ? `<div class="ws-stat"><span class="ws-stat-lbl">${esc(t('wsBannerBmr'))}</span><span class="ws-stat-val">${Math.round(body.bmrKcalDay)} <small>kcal</small></span></div>`
            : '',
        ].filter(Boolean).join('')
      : `<div class="ws-stat ws-stat-empty"><span class="ws-stat-lbl">${esc(t('wsBannerBody'))}</span><span class="ws-stat-val">${esc(t('wsBannerNoScan'))}</span></div>`;

    el.hidden = false;
    // One horizontal strip — name + demographics + rules + stats + sync (+ readonly on account).
    // Topbar used to repeat name/sync/rules; that also drifted two “Synced … ago” clocks.
    // Rules chip: green when any rules are active (clinic overlay or self) — same chrome language.
    el.innerHTML = `
      <div class="ws-case-header-inner">
        <h1 class="ws-banner-name" dir="auto">${esc(name)}</h1>
        <span class="ws-banner-identity">${esc(identity)}</span>
        <span class="chip ${n > 0 ? 'ok' : 'off'}">${esc(rulesLabel)}</span>
        ${clientChip}
        <div class="ws-banner-stats" title="${esc(scanTitle)}">${stats}</div>
        <span class="ws-banner-sync" title="${esc(supportMetaTitle(ctx.blob))}">${esc(syncLabel)}</span>
        ${readonlyChip}
      </div>`;
  }

  /** Legacy helper — sync now lives in the case header via renderPatientBanner. */
  function paintHeaderMeta(metaEl, rulesChipEl, ctx) {
    if (metaEl) {
      metaEl.textContent = formatRelativeSync(ctx.blob?.createdAt);
      metaEl.title = supportMetaTitle(ctx.blob);
    }
    if (rulesChipEl) {
      const show = Boolean(ctx.overlay?.rules) && !ctx.selfView;
      rulesChipEl.hidden = !show;
      if (show) rulesChipEl.textContent = t('wsClinicRulesActive');
    }
  }

  function renderWorkspace(root, ctx) {
    global.__clinicWorkspaceCtx = ctx;
    global.__clinicWorkspaceRoot = root;
    const permitted = allowedTabs(ctx);
    const tab = permitted.some((tabDef) => tabDef.id === ctx.tab) ? ctx.tab : permitted[0].id;
    const fillHeight = tab === 'rules';
    root.innerHTML = `
      <div class="ws-panel${fillHeight ? ' ws-panel-fill' : ''}">
        <div id="tab-body"${fillHeight ? ' class="rules-tab"' : ''}></div>
      </div>`;
    const body = root.querySelector('#tab-body');
    if (!body) return;
    if (tab === 'dashboard') renderDashboard(body, ctx);
    else if (tab === 'foodlog') renderFoodLogTab(body, ctx);
    else if (tab === 'nutrition') renderNutritionReports(body, ctx);
    else if (tab === 'profile') renderProfileTab(body, ctx);
    else if (tab === 'lipids') renderLipidsTab(body, ctx);
    else if (tab === 'chat') renderChat(body, ctx);
    else if (tab === 'rules') renderRules(body, ctx);
    else if (tab === 'markers') renderMarkers(body, ctx);
    else if (tab === 'macros') renderMacros(body, ctx);
    else if (tab === 'labs') renderLabs(body, ctx);
    else if (tab === 'usage') void renderUsage(body, ctx);

    const banner = document.getElementById('patient-banner');
    if (banner) renderPatientBanner(banner, ctx, ctx.displayName || null);
  }

  /** Re-paint chart tabs when Appearance flips (SVG reads CSS vars at draw time). */
  global.addEventListener('healthings-theme-change', () => {
    const ctx = global.__clinicWorkspaceCtx;
    const root = global.__clinicWorkspaceRoot;
    if (!ctx || !root) return;
    const tab = ctx.tab;
    if (tab === 'dashboard' || tab === 'lipids') renderWorkspace(root, ctx);
  });

  function initTabs(tabsEl, ctx, mainEl) {
    if (global.__clinicTab) ctx.tab = global.__clinicTab;
    const tabs = allowedTabs(ctx);
    if (!tabs.some((tabDef) => tabDef.id === ctx.tab)) ctx.tab = tabs[0].id;
    function paint() {
      const read = tabs.filter((tabDef) => tabDef.group !== 'write');
      const write = tabs.filter((tabDef) => tabDef.group === 'write');
      let html = read.map((tabDef) => tabButtonHtml(tabDef, ctx.tab, ctx.selfView)).join('');
      if (write.length) {
        html += '<span class="ws-tab-divider" aria-hidden="true"></span>';
        html += write.map((tabDef) => tabButtonHtml(tabDef, ctx.tab, ctx.selfView)).join('');
      }
      tabsEl.innerHTML = html;
      tabsEl.querySelectorAll('.ws-tab').forEach((btn) => {
        btn.addEventListener('click', () => {
          ctx.tab = btn.getAttribute('data-tab');
          global.__clinicTab = ctx.tab;
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
    effectiveRules,
    renderPatientBanner,
    paintHeaderMeta,
    formatRelativeSync,
    supportMetaTitle,
  };
})(window);
