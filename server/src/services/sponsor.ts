import { getSponsorshipForPatient } from './sponsorships.js';
import { isCoveragePaused } from './payments.js';

export type AiPayer = {
  payerUserId: string;
  sponsored: boolean;
};

/**
 * Resolve who pays for phone AI.
 * If the clinic sponsor's wallet has coverage_paused (be-34), fall back to the
 * patient's own wallet without touching the sponsorship row.
 */
export async function resolveAiPayer(patientId: string): Promise<AiPayer> {
  const sponsorship = await getSponsorshipForPatient(patientId);
  if (sponsorship) {
    const paused = await isCoveragePaused(sponsorship.mentorId);
    if (!paused) {
      return { payerUserId: sponsorship.mentorId, sponsored: true };
    }
  }
  return { payerUserId: patientId, sponsored: false };
}

export async function getSponsorDisplayName(patientId: string): Promise<string | null> {
  const sponsorship = await getSponsorshipForPatient(patientId);
  if (!sponsorship) return null;
  return sponsorship.mentorDisplayName?.trim() || sponsorship.mentorEmail;
}
