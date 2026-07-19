#!/usr/bin/env node
/** Fuzzy-match workouts + check for withings userid / weight profile hints. */
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateSync } from 'node:zlib';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = readFileSync(resolve(__dirname, '../.env'), 'utf8');
const url = env.match(/^DATABASE_URL=(.+)$/m)[1].trim();
const pool = new pg.Pool({ connectionString: url });

function load(buf) {
  const p = JSON.parse(inflateSync(buf).toString('utf8'));
  const as = p.asyncStorage || {};
  const mraw = as['healthings:metricsStore'];
  const m = typeof mraw === 'string' ? JSON.parse(mraw) : mraw;
  const hints = {};
  for (const [k, v] of Object.entries(as)) {
    if (/withings|userid|oauth|token/i.test(k) && typeof v === 'string' && v.length < 800) {
      hints[k] = v;
    }
  }
  return { m, hints, bodyScan: m?.bodyScan, sampleTrend: (m?.bodyTrendDays || []).slice(-3) };
}

function fuzzyPairs(aList, bList, windowMs = 5 * 60 * 1000) {
  const used = new Set();
  const pairs = [];
  for (const a of aList) {
    let best = null;
    let bestDt = Infinity;
    for (let i = 0; i < bList.length; i++) {
      if (used.has(i)) continue;
      const dt = Math.abs(a.startMs - bList[i].startMs);
      if (dt < bestDt && dt <= windowMs && a.category === bList[i].category) {
        bestDt = dt;
        best = i;
      }
    }
    if (best != null) {
      used.add(best);
      const b = bList[best];
      pairs.push({
        cat: a.category,
        dtSec: Math.round(bestDt / 1000),
        a: {
          start: new Date(a.startMs).toISOString(),
          mins: Math.round((a.endMs - a.startMs) / 60000),
          kcal: a.kcal,
        },
        b: {
          start: new Date(b.startMs).toISOString(),
          mins: Math.round((b.endMs - b.startMs) / 60000),
          kcal: b.kcal,
        },
        ratio: a.kcal > 0 ? +(b.kcal / a.kcal).toFixed(3) : null,
        delta: Math.round(b.kcal - a.kcal),
      });
    }
  }
  return pairs;
}

try {
  const emails = ['raviv.shweid@gmail.com', 'raviv.shweid+withings-ios@gmail.com'];
  const loaded = {};
  for (const email of emails) {
    const { rows } = await pool.query(
      `SELECT u.payload_gzip FROM user_cloud_backups u JOIN users us ON us.id=u.user_id WHERE lower(us.email)=lower($1)`,
      [email],
    );
    loaded[email] = load(rows[0].payload_gzip);
  }
  const android = loaded['raviv.shweid@gmail.com'];
  const ios = loaded['raviv.shweid+withings-ios@gmail.com'];

  const days = ['2026-07-18', '2026-07-19'];
  const dayKey = (ms) =>
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Jerusalem',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(ms));

  const report = {};
  for (const dk of days) {
    const aW = (android.m.workouts || []).filter((w) => dayKey(w.startMs) === dk);
    const iW = (ios.m.workouts || []).filter((w) => dayKey(w.startMs) === dk);
    const pairs = fuzzyPairs(aW, iW);
    const sumA = pairs.reduce((s, p) => s + p.a.kcal, 0);
    const sumB = pairs.reduce((s, p) => s + p.b.kcal, 0);
    report[dk] = {
      pairs,
      pairedAndroidKcal: Math.round(sumA),
      pairedIosKcal: Math.round(sumB),
      pairedRatio: sumA > 0 ? +(sumB / sumA).toFixed(3) : null,
      pairedDeltaPct: sumA > 0 ? +(((sumB / sumA) - 1) * 100).toFixed(1) : null,
    };
  }

  console.log(
    JSON.stringify(
      {
        androidHints: android.hints,
        iosHints: ios.hints,
        androidBody: { bodyScan: android.bodyScan, trend: android.sampleTrend },
        iosBody: { bodyScan: ios.bodyScan, trend: ios.sampleTrend },
        fuzzy: report,
      },
      null,
      2,
    ),
  );
} finally {
  await pool.end();
}
