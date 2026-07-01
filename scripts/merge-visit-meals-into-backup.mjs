/**
 * Recover meals from visit-report HTML into a healthings backup JSON.
 *
 * Usage:
 *   node scripts/merge-visit-meals-into-backup.mjs \
 *     app/healthings-backup/healthings_visit_90d_2026-07-01.html \
 *     app/healthings-backup/healthings-backup_2026-07-02.json
 *
 * Writes: <backup>-merged.json next to the backup file.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const TZ = '+03:00'; // Israel — matches export locale for this user

function decodeHtml(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"');
}

function parseMealTimestamp(dayKey, timeLabel) {
  const normalized = timeLabel.replace(/\u202f/g, ' ').trim();
  const m = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) throw new Error(`Bad meal time "${timeLabel}" on ${dayKey}`);
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const ampm = m[3].toUpperCase();
  if (ampm === 'PM' && hour !== 12) hour += 12;
  if (ampm === 'AM' && hour === 12) hour = 0;
  const iso = `${dayKey}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00${TZ}`;
  return new Date(iso).getTime();
}

function parseItemLine(line) {
  const m = line.match(
    /^\s*•\s*(.+):\s*(\d+(?:\.\d+)?)g,\s*(\d+(?:\.\d+)?)\s*kcal,\s*P(\d+(?:\.\d+)?)g\s*C(\d+(?:\.\d+)?)g\s*F(\d+(?:\.\d+)?)g(?:\s*Fi(\d+(?:\.\d+)?)g)?/,
  );
  if (!m) return null;
  const name = m[1].trim();
  return {
    name,
    name_local: name,
    grams: Number(m[2]),
    kcal: Number(m[3]),
    protein_g: Number(m[4]),
    carb_g: Number(m[5]),
    fat_g: Number(m[6]),
    fiber_g: m[7] != null ? Number(m[7]) : 0,
    rule_conflict: false,
  };
}

function parseTotalLine(line) {
  const m = line.match(
    /^\s*Total:\s*(\d+(?:\.\d+)?)\s*kcal\s*\|\s*P(\d+(?:\.\d+)?)g\s*C(\d+(?:\.\d+)?)g\s*F(\d+(?:\.\d+)?)g(?:\s*Fi(\d+(?:\.\d+)?)g)?/,
  );
  if (!m) return null;
  return {
    totalKcal: Math.round(Number(m[1])),
    totalProtein_g: Number(m[2]),
    totalCarb_g: Number(m[3]),
    totalFat_g: Number(m[4]),
    totalFiber_g: m[5] != null ? Number(m[5]) : 0,
  };
}

function parseMealsFromHtml(html) {
  const text = decodeHtml(html);
  const preMatch = text.match(/<div class="preblock">([\s\S]*?)<\/div>/);
  if (!preMatch) throw new Error('No preblock daily log found in visit HTML');
  const log = preMatch[1];

  const byDay = new Map();
  const dayChunks = log.split(/\n--- (\d{4}-\d{2}-\d{2}) ---\n/);
  // split yields: [preamble, date1, body1, date2, body2, ...]
  for (let i = 1; i < dayChunks.length; i += 2) {
    const dayKey = dayChunks[i];
    const body = dayChunks[i + 1] ?? '';
    const foodIdx = body.indexOf('FOOD & MEALS:');
    if (foodIdx < 0) continue;

    let section = body.slice(foodIdx);
    const endMarkers = ['MEAL GLUCOSE:', 'WORKOUTS', '--- '];
    let end = section.length;
    for (const marker of endMarkers) {
      const pos = section.indexOf('\n' + marker);
      if (pos >= 0) end = Math.min(end, pos);
    }
    section = section.slice(0, end);

    const summary = section.match(
      /(\d+) kcal eaten \| P(\d+(?:\.\d+)?)g C(\d+(?:\.\d+)?)g F(\d+(?:\.\d+)?)g(?: Fi(\d+(?:\.\d+)?)g)? \| (\d+) meals/,
    );
    if (!summary || Number(summary[6]) === 0) continue;

    const lines = section.split('\n');
    const meals = [];
    let current = null;

    for (const line of lines) {
      const mealHead = line.match(/^Meal (\d+) at (.+):$/);
      if (mealHead) {
        if (current?.items.length) meals.push(current);
        current = {
          mealIndex: Number(mealHead[1]),
          timeLabel: mealHead[2].trim(),
          items: [],
        };
        continue;
      }
      if (!current) continue;
      const item = parseItemLine(line);
      if (item) {
        current.items.push(item);
        continue;
      }
      const total = parseTotalLine(line);
      if (total) Object.assign(current, total);
    }
    if (current?.items.length) meals.push(current);

    if (meals.length === 0) continue;

    const entries = meals.map((m, idx) => {
      const timestamp = parseMealTimestamp(dayKey, m.timeLabel);
      const itemFiber = m.items.reduce((s, it) => s + (it.fiber_g ?? 0), 0);
      return {
        id: `html-${dayKey}-${idx + 1}-${timestamp}`,
        timestamp,
        items: m.items,
        totalKcal: m.totalKcal ?? Math.round(m.items.reduce((s, it) => s + it.kcal, 0)),
        totalProtein_g: m.totalProtein_g ?? m.items.reduce((s, it) => s + it.protein_g, 0),
        totalCarb_g: m.totalCarb_g ?? m.items.reduce((s, it) => s + it.carb_g, 0),
        totalFat_g: m.totalFat_g ?? m.items.reduce((s, it) => s + it.fat_g, 0),
        totalFiber_g: m.totalFiber_g ?? itemFiber,
        source: 'manual',
      };
    });

    byDay.set(dayKey, entries);
  }

  return byDay;
}

function mergeIntoBackup(backup, mealsByDay, { afterDay = null } = {}) {
  const out = structuredClone(backup);
  let addedDays = 0;
  let addedMeals = 0;
  let skippedDays = 0;

  for (const [dayKey, entries] of [...mealsByDay.entries()].sort()) {
    if (afterDay && dayKey <= afterDay) {
      skippedDays += 1;
      continue;
    }
    const key = `food_log_${dayKey}`;
    const existingRaw = out.asyncStorage[key];
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      if (existing.length > 0) {
        skippedDays += 1;
        continue;
      }
    }
    out.asyncStorage[key] = JSON.stringify(entries);
    addedDays += 1;
    addedMeals += entries.length;
  }

  const dayKeys = Object.keys(out.asyncStorage)
    .filter((k) => /^food_log_\d{4}-\d{2}-\d{2}$/.test(k))
    .map((k) => k.replace('food_log_', ''))
    .sort();
  out.asyncStorage.food_log_days = JSON.stringify(dayKeys);
  out.exportedAt = new Date().toISOString();

  return { out, addedDays, addedMeals, skippedDays, totalFoodDays: dayKeys.length };
}

function main() {
  const htmlPath = resolve(process.argv[2] ?? 'app/healthings-backup/healthings_visit_90d_2026-07-01.html');
  const backupPath = resolve(process.argv[3] ?? 'app/healthings-backup/healthings-backup_2026-07-02.json');
  const afterDay = process.argv[4] ?? '2026-06-18';

  const html = readFileSync(htmlPath, 'utf8');
  const backup = JSON.parse(readFileSync(backupPath, 'utf8'));
  const mealsByDay = parseMealsFromHtml(html);
  const { out, addedDays, addedMeals, skippedDays, totalFoodDays } = mergeIntoBackup(
    backup,
    mealsByDay,
    { afterDay },
  );

  const outPath = backupPath.replace(/\.json$/i, '_merged.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');

  console.log('Visit HTML meals parsed:', mealsByDay.size, 'days with food');
  console.log('Merged into backup:');
  console.log('  added days :', addedDays);
  console.log('  added meals:', addedMeals);
  console.log('  skipped    :', skippedDays, `(already had food or <= ${afterDay})`);
  console.log('  total food days in backup:', totalFoodDays);
  console.log('Output:', outPath);
  console.log('');
  console.log('Phone: Import all data -> pick the *_merged.json file');
}

main();
