/**
 * Lab-driven computed guidance blocks for macro revision (Tier B).
 */

import type { UserRules } from '../services/TargetService';
import {
  formatKidneyMarkersSummary,
  type GlycemicLabStatus,
  type KidneyLabStatus,
  type LipidLabStatus,
} from '../services/LabLogService';
import { kidneyProteinCapG } from './macroFiberCoupling';

export function formatKidneyGuidanceBlock(opts: {
  kidney: KidneyLabStatus | null;
  leanMassKg: number | null;
  weightKg: number | null;
}): string | null {
  const { kidney, leanMassKg, weightKg } = opts;
  if (!kidney?.creatinine && !kidney?.urea) return null;

  const cap = kidneyProteinCapG(leanMassKg, weightKg);
  const summary = formatKidneyMarkersSummary(kidney);
  const lines = [
    '## KIDNEY GUIDANCE (computed — use for JSON `protein_g`)',
    `Latest labs: ${summary}`,
  ];

  if (kidney.hasHighMarker && cap != null) {
    lines.push(
      `→ set protein_g ≤ **${cap}g** (2.2 g/kg lean mass) — enforced in post-process.`,
      'Do not raise protein above 7d eaten protein avg without strong justification.',
    );
  } else if (cap != null) {
    lines.push(`Kidney markers not flagged high — protein cap ${cap}g applies if labs worsen.`);
  }

  if (kidney.hasHighMarker) {
    lines.push(
      'If My Rules omit kidney limits: set `rules_advice` with one sentence the user can paste into My Rules.',
    );
  }

  return lines.join('\n');
}

export function formatLipidGuidanceBlock(opts: {
  lipid: LipidLabStatus | null;
  userRules: UserRules | null;
}): string | null {
  const { lipid } = opts;
  if (!lipid) return null;

  const parts: string[] = [];
  if (lipid.ldl) {
    const hi = lipid.ldl.flag === 'high' ? ' **high**' : '';
    parts.push(`LDL ${lipid.ldl.value} ${lipid.ldl.unit}${hi}`);
  }
  if (lipid.totalCholesterol) {
    const hi = lipid.totalCholesterol.flag === 'high' ? ' **high**' : '';
    parts.push(`total chol ${lipid.totalCholesterol.value} ${lipid.totalCholesterol.unit}${hi}`);
  }
  if (lipid.triglycerides) {
    const hi = lipid.triglycerides.flag === 'high' ? ' **high**' : '';
    parts.push(`TG ${lipid.triglycerides.value} ${lipid.triglycerides.unit}${hi}`);
  }
  if (lipid.hdl) {
    const lo = lipid.hdl.flag === 'low' ? ' **low**' : '';
    parts.push(`HDL ${lipid.hdl.value} ${lipid.hdl.unit}${lo}`);
  }

  if (parts.length === 0) return null;

  const lines = [
    '## LIPID GUIDANCE (computed — fat quality & fiber; not carb minimization)',
    `Latest labs: ${parts.join(' | ')}`,
  ];

  if (lipid.hasActionableMarker) {
    lines.push(
      '→ prioritize **unsaturated fats** per My Rules (fish, nuts, seeds, olive oil); limit saturated fat and dietary cholesterol foods.',
      '→ use **CARB GUIDANCE** for carb_g — high LDL does **not** justify lowering carbs below that band.',
      '→ cite these lipid values in `reasoning`; `diet_label` should center cholesterol/LDL — never keto/low-carb unless user rules say so.',
    );
  } else {
    lines.push('Lipids in range — maintain heart-healthy fat pattern per My Rules.');
  }

  return lines.join('\n');
}

export function formatGlycemicGuidanceBlock(opts: {
  glycemic: GlycemicLabStatus | null;
}): string | null {
  const { glycemic } = opts;
  if (!glycemic?.glucose && !glycemic?.hba1c) return null;

  const parts: string[] = [];
  if (glycemic.glucose) {
    const hi = glycemic.glucose.flag === 'high' ? ' **high**' : '';
    const lo = glycemic.glucose.flag === 'low' ? ' **low**' : '';
    parts.push(`fasting glucose ${glycemic.glucose.value} ${glycemic.glucose.unit}${hi}${lo}`);
  }
  if (glycemic.hba1c) {
    const hi = glycemic.hba1c.flag === 'high' ? ' **high**' : '';
    parts.push(`HbA1c ${glycemic.hba1c.value}${glycemic.hba1c.unit ? ` ${glycemic.hba1c.unit}` : ''}${hi}`);
  }

  const lines = [
    '## GLYCEMIC GUIDANCE (computed — cross-check with CGM block)',
    `Latest labs: ${parts.join(' | ')}`,
  ];

  if (glycemic.hasHighMarker) {
    lines.push(
      '→ prefer **lower end** of CARB GUIDANCE band unless CGM 7d avg is well-controlled (<100 mg/dL) and no meal spikes.',
      '→ MUST cite CGM period avg/min/max in `reasoning` when CGM data present.',
      '→ if CGM shows lows <70 on trusted days: do **not** cut kcal further.',
    );
  } else {
    lines.push('Glycemic labs in range — use CARB GUIDANCE + CGM meal data for carb_g.');
  }

  return lines.join('\n');
}
