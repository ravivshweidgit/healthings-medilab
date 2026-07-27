/**
 * Single entry for dietary-rules saves from clinic portal and patient /account/.
 * Mentors write the org overlay; patients patch their sync blob and mirror to overlays
 * so the phone's existing clinic-overlay pull receives the edit.
 */
import type { PublicUser } from './jwt.js';
import {
  ClinicError,
  saveRulesForPatient as saveRulesOverlayForMentor,
  type ClinicOverlay,
  type ClinicUserRules,
} from './clinicOverlay.js';
import { SyncError, updatePatientRulesInLatestBlob } from './sync.js';

export type SaveDietaryRulesResult = {
  overlay: ClinicOverlay;
  rules: ClinicUserRules;
};

function toClinicError(err: unknown): never {
  if (err instanceof ClinicError) throw err;
  if (err instanceof SyncError) throw new ClinicError(err.message, err.status);
  throw err;
}

export async function saveDietaryRules(
  actor: PublicUser,
  patientId: string,
  rules: ClinicUserRules,
): Promise<SaveDietaryRulesResult> {
  if (actor.role === 'patient') {
    if (actor.id !== patientId) {
      throw new ClinicError('Patients can only edit their own rules', 403);
    }
    try {
      const saved = await updatePatientRulesInLatestBlob(actor, rules.rawText);
      return {
        rules: saved,
        // Same response shape as clinic so the workspace has one apply path.
        overlay: {
          patientId,
          rules: saved,
          chat: {},
          updatedAt: saved.analyzedAt,
          updatedBy: actor.id,
        },
      };
    } catch (err) {
      toClinicError(err);
    }
  }

  try {
    const overlay = await saveRulesOverlayForMentor(actor, patientId, rules);
    return { overlay, rules };
  } catch (err) {
    toClinicError(err);
  }
}
