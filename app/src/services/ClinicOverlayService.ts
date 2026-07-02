import { authFetch } from './AuthApiService';
import { getUserRules, saveUserRules, type UserRules } from './TargetService';

/** Pull mentor-edited rules from server (clinic overlay). */
export async function pullClinicOverlays(): Promise<boolean> {
  try {
    const res = await authFetch('/v1/clinic/overlays');
    if (!res.ok) return false;
    const data = (await res.json()) as { overlay: { rules: UserRules | null; updatedAt: string } | null };
    const rules = data.overlay?.rules;
    if (!rules?.rawText) return false;

    const local = await getUserRules();
    const serverAt = Date.parse(rules.analyzedAt || data.overlay?.updatedAt || '');
    const localAt = local ? Date.parse(local.analyzedAt) : 0;
    if (!Number.isNaN(serverAt) && serverAt > localAt) {
      await saveUserRules({
        rawText: rules.rawText,
        summary: rules.summary,
        constraints: rules.constraints ?? [],
        aiContext: rules.aiContext ?? '',
        analyzedAt: rules.analyzedAt,
      });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
