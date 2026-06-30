/**
 * Visit report — human-readable HTML for nutritionist / clinic visits.
 */

import { computeAge } from '../services/TargetService';
import type { CoachActionItem, CoachMessage, DailyMacroTarget, Gender, UserLanguage, UserRules } from '../services/TargetService';
import type { LabReport, LabResult, LabResultFlag } from '../services/LabLogService';
import { reportDateKey } from '../services/LabLogService';
import { MENTOR_EMOJI } from './mentorLabels';
import type { ClinicalSection, ClinicalTable, VisitReportClinicalNote } from './visitReportClinical';
import type { VisitReportChart } from './visitReportChartSvg';

export type VisitReportProfile = {
  age: number | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  weightMeasuredAt: string | null;
  weightTrendLine: string | null;
};

export type VisitReportContent = {
  dayCount: 7 | 14 | 30 | 90;
  exportedAt: string;
  lang?: UserLanguage | null;
  profile: VisitReportProfile;
  macroTarget: DailyMacroTarget | null;
  labs: LabReport[];
  periodReviewText: string;
  userRules: UserRules | null;
  coachMsg: CoachMessage | null;
  includeCoach: boolean;
  clinicalNote: VisitReportClinicalNote;
  chartAppendix: { title: string; intro: string; charts: VisitReportChart[] };
};

function isRtl(lang?: UserLanguage | null): boolean {
  return lang?.code === 'he' || lang?.code === 'ar';
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function preblock(text: string): string {
  return `<div class="preblock" dir="auto">${escapeHtml(text)}</div>`;
}

function ui(lang?: UserLanguage | null) {
  if (lang?.code === 'he') {
    return {
      pageTitle: 'דוח ביקור — Healthings Medilab',
      title: 'דוח ביקור — Healthings',
      subtitle: 'סיכום wellness לשיתוף עם תזונאית/מטפל — לא ייעוץ רפואי',
      exportedLabel: 'יוצא',
      windowLabel: 'חלון',
      daysUnit: 'ימים',
      profileSection: 'פרופיל',
      ageLabel: 'גיל',
      genderLabel: 'מין',
      heightLabel: 'גובה',
      weightLabel: 'משקל',
      weightTrendLabel: 'מגמת משקל',
      macroSection: 'יעדי מקרו',
      noMacro: '(לא הוגדרו יעדי מקרו)',
      labsSection: 'בדיקות מעבדה',
      noLabs: '(אין תוצאות מעבדה שמורות)',
      flaggedLabel: 'חריג',
      periodSection: 'סיכום תקופה (CGM, ארוחות, פעילות)',
      rulesSection: 'הכללים שלי',
      noRules: '(לא הוגדרו כללים)',
      coachSection: 'סיכום מנטור תזונה (היום)',
      noCoach: '(אין סיכום מנטור פעיל)',
      winsLabel: 'מה הולך טוב',
      improveLabel: 'מה לשפר',
      disclaimer:
        'מסמך זה נוצר מנתוני wellness מקומיים באפליקציה. הוא אינו אבחון רפואי, אינו תחליף לייעוץ מקצועי, ואינו מכיל המלצות טיפול.',
    };
  }
  if (lang?.code === 'ar') {
    return {
      pageTitle: 'تقرير الزيارة — Healthings Medilab',
      title: 'تقرير الزيارة — Healthings',
      subtitle: 'ملخص wellness للمشاركة مع أخصائي التغذية — ليس نصيحة طبية',
      exportedLabel: 'تاريخ التصدير',
      windowLabel: 'الفترة',
      daysUnit: 'أيام',
      profileSection: 'الملف',
      ageLabel: 'العمر',
      genderLabel: 'الجنس',
      heightLabel: 'الطول',
      weightLabel: 'الوزن',
      weightTrendLabel: 'اتجاه الوزن',
      macroSection: 'أهداف الماكرو',
      noMacro: '(لا أهداف ماكرو)',
      labsSection: 'نتائج المختبر',
      noLabs: '(لا نتائج مختبر محفوظة)',
      flaggedLabel: 'خارج النطاق',
      periodSection: 'ملخص الفترة (CGM، وجبات، نشاط)',
      rulesSection: 'قواعدي',
      noRules: '(لا قواعد)',
      coachSection: 'ملخص مرشد التغذية (اليوم)',
      noCoach: '(لا رسالة مرشد نشطة)',
      winsLabel: 'ما يسير جيداً',
      improveLabel: 'ما يمكن تحسينه',
      disclaimer:
        'تم إنشاء هذا المستند من بيانات wellness محلية. ليس تشخيصاً طبياً ولا بديلاً عن استشارة متخصص.',
    };
  }
  return {
    pageTitle: 'Visit report — Healthings Medilab',
    title: 'Visit report — Healthings',
    subtitle: 'Wellness summary to share with your nutritionist — not medical advice',
    exportedLabel: 'Exported',
    windowLabel: 'Window',
    daysUnit: 'days',
    profileSection: 'Profile',
    ageLabel: 'Age',
    genderLabel: 'Gender',
    heightLabel: 'Height',
    weightLabel: 'Weight',
    weightTrendLabel: 'Weight trend',
    macroSection: 'Macro targets',
    noMacro: '(no macro targets set)',
    labsSection: 'Lab results',
    noLabs: '(no lab results saved)',
    flaggedLabel: 'flagged',
    periodSection: 'Period summary (CGM, meals, activity)',
    rulesSection: 'My rules',
    noRules: '(no rules set)',
    coachSection: 'Nutrition coach summary (today)',
    noCoach: '(no active coach message)',
    winsLabel: "What's going well",
    improveLabel: 'What to improve',
    disclaimer:
      'This document was generated from local wellness data in the app. It is not a medical diagnosis and does not replace professional advice.',
  };
}

function formatGender(gender: string | null, lang?: UserLanguage | null): string {
  if (!gender) return '—';
  if (lang?.code === 'he') {
    if (gender === 'male') return 'זכר';
    if (gender === 'female') return 'נקבה';
    return 'אחר';
  }
  if (lang?.code === 'ar') {
    if (gender === 'male') return 'ذكر';
    if (gender === 'female') return 'أنثى';
    return 'آخر';
  }
  return gender;
}

function formatMeasuredAt(iso: string | null): string | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  try {
    return new Date(t).toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function flagClass(flag: LabResultFlag): string {
  if (flag === 'high') return 'flag-high';
  if (flag === 'low') return 'flag-low';
  return '';
}

function formatLabResultCell(r: LabResult, flaggedLabel: string): string {
  const cls = flagClass(r.flag);
  const flagNote =
    r.flag === 'high' || r.flag === 'low' ? ` <span class="${cls}">(${flaggedLabel}: ${r.flag})</span>` : '';
  const ref = r.referenceText ? `<span class="ref">${escapeHtml(r.referenceText)}</span>` : '';
  return `<tr class="${cls}">
  <td>${escapeHtml(r.code)}</td>
  <td>${escapeHtml(r.name)}</td>
  <td><strong>${r.value}</strong> ${escapeHtml(r.unit)}${flagNote}</td>
  <td>${ref}</td>
</tr>`;
}

function formatLabsHtml(reports: LabReport[], flaggedLabel: string, noLabs: string): string {
  if (reports.length === 0) return `<p class="muted">${escapeHtml(noLabs)}</p>`;
  const sorted = [...reports].sort((a, b) => b.collectedAt.localeCompare(a.collectedAt));
  return sorted
    .map((report) => {
      const date = reportDateKey(report.collectedAt);
      const provider = report.labProvider === 'clalit' ? 'Clalit' : 'Lab';
      const rows = report.panels
        .flatMap((panel) => panel.results.map((r) => formatLabResultCell(r, flaggedLabel)))
        .join('\n');
      return `<div class="lab-draw">
  <h3>${escapeHtml(`${date} (${provider})`)}</h3>
  <table class="lab-table">
    <thead><tr><th>Code</th><th>Test</th><th>Result</th><th>Reference</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</div>`;
    })
    .join('\n');
}

function formatMacroHtml(target: DailyMacroTarget | null, noMacro: string): string {
  if (!target) return `<p class="muted">${escapeHtml(noMacro)}</p>`;
  const fiber = target.fiber_g != null ? ` · Fiber ${target.fiber_g}g` : '';
  return `<p><strong>${escapeHtml(target.diet_label || 'Targets')}</strong></p>
<ul class="kv-list">
  <li>${target.kcal} kcal · P ${target.protein_g}g · C ${target.carb_g}g · F ${target.fat_g}g${fiber}</li>
</ul>`;
}

function formatProfileHtml(
  profile: VisitReportProfile,
  labels: ReturnType<typeof ui>,
  lang?: UserLanguage | null,
): string {
  const rows: string[] = [];
  if (profile.age != null) rows.push(`<tr><th>${escapeHtml(labels.ageLabel)}</th><td>${profile.age}</td></tr>`);
  rows.push(
    `<tr><th>${escapeHtml(labels.genderLabel)}</th><td>${escapeHtml(formatGender(profile.gender, lang))}</td></tr>`,
  );
  if (profile.heightCm != null) {
    rows.push(
      `<tr><th>${escapeHtml(labels.heightLabel)}</th><td>${profile.heightCm} cm</td></tr>`,
    );
  }
  if (profile.weightKg != null) {
    const measured = formatMeasuredAt(profile.weightMeasuredAt);
    const suffix = measured ? ` <span class="muted">(${escapeHtml(measured)})</span>` : '';
    rows.push(
      `<tr><th>${escapeHtml(labels.weightLabel)}</th><td>${profile.weightKg.toFixed(1)} kg${suffix}</td></tr>`,
    );
  }
  if (profile.weightTrendLine) {
    rows.push(
      `<tr><th>${escapeHtml(labels.weightTrendLabel)}</th><td>${escapeHtml(profile.weightTrendLine)}</td></tr>`,
    );
  }
  return `<table class="profile-table"><tbody>${rows.join('\n')}</tbody></table>`;
}

function nutritionistCoachItems(items: CoachActionItem[]): CoachActionItem[] {
  return items.filter(
    (i) =>
      i.mentor === 'nutritionist' ||
      (i.autoCheckType != null && !i.mentor),
  );
}

function formatCoachHtml(
  coachMsg: CoachMessage | null,
  includeCoach: boolean,
  labels: ReturnType<typeof ui>,
): string {
  if (!includeCoach || !coachMsg) {
    return `<p class="muted">${escapeHtml(labels.noCoach)}</p>`;
  }
  const parts: string[] = [];
  const summary =
    coachMsg.mentorLines?.nutritionist?.trim() ||
    coachMsg.summary?.trim() ||
    coachMsg.text.trim();
  if (summary) {
    parts.push(`<div class="coach-summary">${preblock(summary)}</div>`);
  }
  const wins = coachMsg.wins?.nutritionist;
  if (wins?.length) {
    const bullets = wins.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
    parts.push(
      `<div class="coach-sub"><div class="coach-sub-label">${escapeHtml(labels.winsLabel)}</div><ul>${bullets}</ul></div>`,
    );
  }
  const improve = coachMsg.improve?.nutritionist;
  if (improve?.length) {
    const bullets = improve.map((w) => `<li>${escapeHtml(w)}</li>`).join('');
    parts.push(
      `<div class="coach-sub"><div class="coach-sub-label">${escapeHtml(labels.improveLabel)}</div><ul>${bullets}</ul></div>`,
    );
  }
  const items = nutritionistCoachItems(coachMsg.actionItems);
  if (items.length > 0) {
    const rows = items
      .map((item) => {
        const mark = item.done ? '☑' : '☐';
        return `<li>${mark} ${escapeHtml(item.text)}</li>`;
      })
      .join('');
    parts.push(`<ul class="action-list">${rows}</ul>`);
  }
  if (parts.length === 0) {
    return `<p class="muted">${escapeHtml(labels.noCoach)}</p>`;
  }
  return `<div class="coach-block">${parts.join('\n')}</div>`;
}

function formatRulesHtml(userRules: UserRules | null, noRules: string): string {
  if (!userRules) return `<p class="muted">${escapeHtml(noRules)}</p>`;
  const parts: string[] = [];
  if (userRules.summary?.trim()) {
    parts.push(`<p><strong>${escapeHtml(userRules.summary)}</strong></p>`);
  }
  if (userRules.constraints?.length) {
    const bullets = userRules.constraints.map((c) => `<li>${escapeHtml(c)}</li>`).join('');
    parts.push(`<ul>${bullets}</ul>`);
  } else if (userRules.rawText?.trim()) {
    parts.push(preblock(userRules.rawText.trim()));
  }
  return parts.join('\n') || `<p class="muted">${escapeHtml(noRules)}</p>`;
}

function formatClinicalTable(table: ClinicalTable): string {
  const head = table.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = table.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('\n');
  return `<table class="clinical-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function formatClinicalSection(section: ClinicalSection): string {
  const paragraphs = section.paragraphs
    .map((p) => `<p class="clinical-p">${escapeHtml(p)}</p>`)
    .join('\n');
  const bullets =
    section.bullets && section.bullets.length > 0
      ? `<ul class="clinical-ul">${section.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
      : '';
  const table = section.table ? formatClinicalTable(section.table) : '';
  return `<section class="clinical-section">
  <h2>${escapeHtml(section.title)}</h2>
  ${paragraphs}
  ${bullets}
  ${table}
</section>`;
}

export function formatVisitReportHtml(content: VisitReportContent): string {
  const { lang, labs, periodReviewText, clinicalNote, chartAppendix } = content;
  const rtl = isRtl(lang);
  const dir = rtl ? 'rtl' : 'ltr';
  const htmlLang = lang?.code ?? 'en';

  const headerMeta = clinicalNote.headerLines
    .map((line) => `<div>${escapeHtml(line)}</div>`)
    .join('\n');

  const sectionsHtml = clinicalNote.sections.map(formatClinicalSection).join('\n');

  const impressionHtml = `<section class="clinical-section impression">
  <h2>${escapeHtml(clinicalNote.impressionTitle)}</h2>
  ${clinicalNote.impressionParagraphs.map((p) => `<p class="clinical-p">${escapeHtml(p)}</p>`).join('\n')}
</section>`;

  const chartsHtml =
    chartAppendix.charts.length > 0
      ? `<details class="appendix charts-appendix" open>
      <summary>${escapeHtml(chartAppendix.title)}</summary>
      <p class="clinical-p">${escapeHtml(chartAppendix.intro)}</p>
      ${chartAppendix.charts
        .map(
          (c) => `<div class="chart-block">
        <h3>${escapeHtml(c.title)}</h3>
        <div class="chart-svg">${c.svg}</div>
      </div>`,
        )
        .join('\n')}
    </details>`
      : '';

  const appendixLabs =
    labs.length > 0
      ? `<h3>${escapeHtml(lang?.code === 'he' ? 'טבלאות מעבדה מלאות' : 'Full laboratory tables')}</h3>${formatLabsHtml(labs, lang?.code === 'he' ? 'חריג' : 'flagged', lang?.code === 'he' ? '(אין)' : '(none)')}`
      : '';

  return `<!DOCTYPE html>
<html lang="${escapeHtml(htmlLang)}" dir="${dir}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(clinicalNote.documentTitle)}</title>
  <style>
    :root { color-scheme: light; }
    body {
      font-family: Georgia, "Times New Roman", "Noto Serif Hebrew", serif;
      line-height: 1.6;
      margin: 0;
      padding: 24px;
      background: #fafafa;
      color: #1a1a1a;
    }
    .wrap { max-width: 780px; margin: 0 auto; }
    h1 {
      font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans Hebrew", sans-serif;
      font-size: 1.4rem;
      margin: 0 0 8px;
      color: #1a472a;
      letter-spacing: -0.02em;
    }
    .doc-meta {
      font-family: system-ui, sans-serif;
      color: #555;
      font-size: 0.88rem;
      margin-bottom: 24px;
      padding-bottom: 16px;
      border-bottom: 2px solid #2E7D5A;
    }
    .clinical-section {
      background: #fff;
      border: 1px solid #dde3ea;
      border-radius: 8px;
      padding: 18px 20px;
      margin-bottom: 14px;
    }
    .clinical-section.impression {
      border-color: #2E7D5A;
      border-width: 2px;
      background: #f8fcf9;
    }
    h2 {
      font-family: system-ui, sans-serif;
      font-size: 0.95rem;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #2E7D5A;
      margin: 0 0 12px;
    }
    h3 {
      font-family: system-ui, sans-serif;
      font-size: 0.9rem;
      margin: 16px 0 8px;
    }
    .clinical-p { margin: 0 0 10px; }
    .clinical-ul {
      margin: 8px 0 0;
      padding-inline-start: 22px;
    }
    .clinical-ul li { margin-bottom: 4px; }
    .clinical-table {
      width: 100%;
      border-collapse: collapse;
      font-family: system-ui, sans-serif;
      font-size: 0.85rem;
      margin-top: 12px;
    }
    .clinical-table th, .clinical-table td {
      border: 1px solid #dde3ea;
      padding: 6px 8px;
      text-align: start;
    }
    .clinical-table th { background: #f0f4f8; font-weight: 700; }
    .chart-block { margin: 16px 0 24px; }
    .chart-block h3 {
      font-family: system-ui, sans-serif;
      font-size: 0.88rem;
      font-weight: 700;
      color: #444;
      margin: 0 0 8px;
    }
    .chart-svg {
      direction: ltr;
      background: #fff;
      border: 1px solid #eef2f6;
      border-radius: 8px;
      padding: 8px;
      overflow-x: auto;
    }
    details.charts-appendix { border-color: #2E7D5A; }
    details.charts-appendix summary { color: #2E7D5A; }
    details.appendix {
      margin-top: 20px;
      background: #fff;
      border: 1px solid #dde3ea;
      border-radius: 8px;
      padding: 12px 16px;
    }
    details.appendix summary {
      font-family: system-ui, sans-serif;
      font-weight: 700;
      cursor: pointer;
      color: #444;
    }
    .preblock {
      white-space: pre-wrap;
      word-wrap: break-word;
      font-family: ui-monospace, monospace;
      font-size: 0.75rem;
      line-height: 1.4;
      background: #f8fafc;
      border: 1px solid #eef2f6;
      border-radius: 6px;
      padding: 12px;
      margin-top: 12px;
    }
    .lab-table { width: 100%; border-collapse: collapse; font-size: 0.82rem; margin-bottom: 16px; }
    .lab-table th, .lab-table td { border-bottom: 1px solid #eef2f6; padding: 5px 6px; text-align: start; }
    .flag-high { color: #c62828; font-weight: 600; }
    .flag-low { color: #1565c0; font-weight: 600; }
    .ref { color: #777; font-size: 0.85em; }
    .muted { color: #777; font-style: italic; }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>${escapeHtml(clinicalNote.documentTitle)}</h1>
    <div class="doc-meta">${headerMeta}</div>
    ${sectionsHtml}
    ${impressionHtml}
    ${chartsHtml}
    <details class="appendix">
      <summary>${escapeHtml(clinicalNote.appendixTitle)}</summary>
      <p class="clinical-p">${escapeHtml(clinicalNote.appendixIntro)}</p>
      ${appendixLabs}
      <div class="preblock">${escapeHtml(periodReviewText)}</div>
    </details>
  </div>
</body>
</html>`;
}

export function buildVisitReportProfile(params: {
  birthdate: string | null;
  gender: string | null;
  heightCm: number | null;
  weightKg: number | null;
  weightMeasuredAt: string | null;
  weightTrendLine: string | null;
}): VisitReportProfile {
  return {
    age: params.birthdate ? computeAge(params.birthdate) : null,
    gender: params.gender,
    heightCm: params.heightCm,
    weightKg: params.weightKg,
    weightMeasuredAt: params.weightMeasuredAt,
    weightTrendLine: params.weightTrendLine,
  };
}
