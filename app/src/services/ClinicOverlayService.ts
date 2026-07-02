import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './AuthApiService';
import { saveUserRulesWithHistory } from './UserRulesHistoryService';
import { getUserRules, type UserRules } from './TargetService';

const CLINIC_RULES_SYNC_AT_KEY = 'healthings:clinicRulesSyncedAt';

type ClinicOverlayRules = UserRules & { updatedByClinic?: boolean };

type ClinicOverlayResponse = {
  overlay: {
    rules: ClinicOverlayRules | null;
    updatedAt: string;
  } | null;
};

/** Pull mentor-edited rules from server (clinic overlay). Returns saved rules when applied. */
export async function pullClinicOverlays(): Promise<UserRules | null> {
  try {
    const res = await authFetch('/v1/clinic/overlays');
    if (!res.ok) return null;
    const data = (await res.json()) as ClinicOverlayResponse;
    const overlay = data.overlay;
    const rules = overlay?.rules;
    if (!rules?.rawText || !overlay?.updatedAt) return null;

    const serverOverlayAt = Date.parse(overlay.updatedAt);
    if (Number.isNaN(serverOverlayAt)) return null;

    const lastSyncedRaw = await AsyncStorage.getItem(CLINIC_RULES_SYNC_AT_KEY);
    const lastSyncedAt = lastSyncedRaw ? Date.parse(lastSyncedRaw) : 0;

    // Clinic portal edits use overlay.updatedAt — not rules.analyzedAt (local phone edits can be newer).
    const shouldApply =
      rules.updatedByClinic === true
        ? serverOverlayAt > lastSyncedAt
        : await shouldApplyNonClinicRules(rules, serverOverlayAt, lastSyncedAt);

    if (!shouldApply) return null;

    const saved: UserRules = {
      rawText: rules.rawText,
      summary: rules.summary,
      constraints: rules.constraints ?? [],
      aiContext: rules.aiContext ?? '',
      analyzedAt: rules.analyzedAt || overlay.updatedAt,
    };
    await saveUserRulesWithHistory(saved, { source: 'clinic', clinicLabel: 'Clinic' });
    await AsyncStorage.setItem(CLINIC_RULES_SYNC_AT_KEY, overlay.updatedAt);
    return saved;
  } catch {
    return null;
  }
}

async function shouldApplyNonClinicRules(
  rules: ClinicOverlayRules,
  serverOverlayAt: number,
  lastSyncedAt: number,
): Promise<boolean> {
  if (serverOverlayAt <= lastSyncedAt) return false;
  const local = await getUserRules();
  const localAt = local ? Date.parse(local.analyzedAt) : 0;
  return serverOverlayAt > localAt;
}
