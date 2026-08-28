import AsyncStorage from '@react-native-async-storage/async-storage';
import { authFetch } from './AuthApiService';
import { SessionExpiredError } from './GeminiProxyService';
import { saveUserRulesWithHistory } from './UserRulesHistoryService';
import { getUserRules, type UserRules } from './TargetService';
import { adoptWalletCredits, assertCanSpendCredits, OutOfCreditsError } from './UsageQueueService';
import {
  applyClinicMarkersFromOverlay,
  type MarkersBackfillRequest,
  type TreatmentMarker,
  type TreatmentMarkersStore,
} from './TreatmentMarkerService';
import {
  applyClinicMacrosFromOverlay,
  type ClinicMacroBoundsStore,
} from './ClinicMacroBoundsService';
import { runPendingMarkersBackfill } from './MarkersBackfillService';
import {
  saveActiveTrainingProgram,
  type TrainingProgramPrescription,
} from './TrainingDirectiveService';

const CLINIC_RULES_SYNC_AT_KEY = 'healthings:clinicRulesSyncedAt';

type ClinicOverlayRules = UserRules & { updatedByClinic?: boolean };

type ClinicOverlayResponse = {
  overlay: {
    rules: ClinicOverlayRules | null;
    markers?: TreatmentMarker[] | null;
    markersHistory?: Array<{ updatedAt: string; markers: TreatmentMarker[] }> | null;
    markersUpdatedAt?: string | null;
    markersBackfill?: MarkersBackfillRequest | null;
    macros?: {
      bounds?: unknown[];
      updatedAt?: string;
      rulesHash?: string;
      reasoning?: string;
    } | null;
    updatedAt: string;
  } | null;
};

export type ClinicOverlayPullResult = {
  rules: UserRules | null;
  markers: TreatmentMarkersStore | null;
  markersBackfill: MarkersBackfillRequest | null;
  macros: ClinicMacroBoundsStore | null;
  /** Set when a pending backfill was executed during this pull. */
  backfillResult?: { mealsUpdated: number; error?: string };
};

/** Pull mentor-edited rules + treatment markers from server (clinic overlay). */
export async function pullClinicOverlays(): Promise<UserRules | null> {
  const full = await pullClinicOverlaysFull();
  return full.rules;
}

/** Full pull: rules and/or markers may apply independently (be-41 / prompt110). */
export async function pullClinicOverlaysFull(): Promise<ClinicOverlayPullResult> {
  const out: ClinicOverlayPullResult = {
    rules: null,
    markers: null,
    markersBackfill: null,
    macros: null,
  };
  try {
    const res = await authFetch('/v1/clinic/overlays');
    if (!res.ok) return out;
    const data = (await res.json()) as ClinicOverlayResponse;
    const overlay = data.overlay;
    if (!overlay?.updatedAt) return out;

    const serverOverlayAt = Date.parse(overlay.updatedAt);
    if (Number.isNaN(serverOverlayAt)) return out;

    const pending = overlay.markersBackfill?.status === 'pending' ? overlay.markersBackfill : null;
    out.markersBackfill = pending;

    // Markers — apply even when rules are absent.
    try {
      out.markers = await applyClinicMarkersFromOverlay(
        overlay.markers ?? null,
        overlay.updatedAt,
        {
          markersUpdatedAt: overlay.markersUpdatedAt ?? null,
          history: overlay.markersHistory ?? null,
        },
      );
    } catch {
      /* keep null */
    }

    // Macros — sibling of markers (be-45). Explicit empty bounds clears;
    // omitted macros keep the local live order.
    try {
      out.macros = await applyClinicMacrosFromOverlay(
        overlay.macros === undefined ? null : overlay.macros,
        overlay.updatedAt,
      );
    } catch {
      /* keep null */
    }

    if (pending) {
      const bf = await runPendingMarkersBackfill(pending);
      if (bf.ran) {
        out.backfillResult = {
          mealsUpdated: bf.mealsUpdated,
          ...(bf.error ? { error: bf.error } : {}),
        };
      }
    }

    // Sync active trainer program & workout split (be-58)
    try {
      const trainRes = await authFetch('/v1/patient/training/active');
      if (trainRes.ok) {
        const trainData = (await trainRes.json()) as { assignment?: { program?: TrainingProgramPrescription } | null };
        if (trainData?.assignment?.program) {
          await saveActiveTrainingProgram(trainData.assignment.program);
        }
      }
    } catch {
      /* non-blocking */
    }

    const rules = overlay.rules;
    if (!rules?.rawText) return out;

    const lastSyncedRaw = await AsyncStorage.getItem(CLINIC_RULES_SYNC_AT_KEY);
    const lastSyncedAt = lastSyncedRaw ? Date.parse(lastSyncedRaw) : 0;

    const shouldApply =
      rules.updatedByClinic === true
        ? serverOverlayAt > lastSyncedAt
        : await shouldApplyNonClinicRules(rules, serverOverlayAt, lastSyncedAt);

    if (!shouldApply) return out;

    const saved: UserRules = {
      rawText: rules.rawText,
      summary: rules.summary,
      constraints: rules.constraints ?? [],
      aiContext: rules.aiContext ?? '',
      analyzedAt: rules.analyzedAt || overlay.updatedAt,
    };
    await saveUserRulesWithHistory(saved, { source: 'clinic', clinicLabel: 'Clinic' });
    await AsyncStorage.setItem(CLINIC_RULES_SYNC_AT_KEY, overlay.updatedAt);
    out.rules = saved;
    return out;
  } catch {
    return out;
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

type AccountRulesResponse = {
  rules: UserRules | null;
};

/**
 * Pull My Rules edited on /account/ when newer than local.
 * Without this, the next phone upload would wipe web edits.
 */
export async function pullAccountRulesIfNewer(): Promise<UserRules | null> {
  try {
    const res = await authFetch('/v1/account/rules');
    if (!res.ok) return null;
    const data = (await res.json()) as AccountRulesResponse;
    const rules = data.rules;
    if (!rules?.rawText?.trim() || !rules.analyzedAt) return null;

    const serverAt = Date.parse(rules.analyzedAt);
    if (Number.isNaN(serverAt)) return null;

    const local = await getUserRules();
    const localAt = local?.analyzedAt ? Date.parse(local.analyzedAt) : 0;
    if (Number.isFinite(localAt) && serverAt <= localAt) return null;
    if (local && (local.rawText?.trim() ?? '') === rules.rawText.trim()) return null;

    const saved: UserRules = {
      rawText: rules.rawText,
      summary: rules.summary ?? '',
      constraints: rules.constraints ?? [],
      aiContext: rules.aiContext ?? '',
      analyzedAt: rules.analyzedAt,
    };
    await saveUserRulesWithHistory(saved, { source: 'web' });
    return saved;
  } catch {
    return null;
  }
}

const REBUILD_MACROS_TIMEOUT_MS = 180_000;

/**
 * Phone Analyze / weigh-in — same Propose as clinic Rules Save.
 * Applies returned bounds locally even when the patient has no clinic org yet.
 */
export async function rebuildLiveMacrosFromMyRules(
  rawText: string,
): Promise<ClinicMacroBoundsStore> {
  await assertCanSpendCredits('ai_macro');
  const res = await authFetch(
    '/v1/account/macros/rebuild',
    {
      method: 'POST',
      body: JSON.stringify({ rawText }),
    },
    { timeoutMs: REBUILD_MACROS_TIMEOUT_MS },
  );
  if (res.status === 402) throw new OutOfCreditsError();
  if (res.status === 401) throw new SessionExpiredError();
  if (!res.ok) {
    let msg = 'Failed to rebuild live macros';
    try {
      const err = (await res.json()) as { error?: string };
      if (err?.error) msg = err.error;
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  const data = (await res.json()) as {
    macros?: {
      bounds?: unknown[];
      updatedAt?: string;
      rulesHash?: string;
      reasoning?: string;
    } | null;
    wallet?: { balanceTokens: number; sponsored: boolean };
  };
  if (data.wallet) {
    void adoptWalletCredits(data.wallet).catch(() => {
      /* non-fatal */
    });
  }
  const applied = await applyClinicMacrosFromOverlay(
    data.macros ?? null,
    data.macros?.updatedAt || new Date().toISOString(),
  );
  if (!applied) throw new Error('Propose returned no macro bounds');
  return applied;
}
