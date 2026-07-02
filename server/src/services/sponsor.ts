import { getSponsorshipForPatient } from './sponsorships.js';

export type AiPayer = {
  payerUserId: string;
  sponsored: boolean;
};

export async function resolveAiPayer(patientId: string): Promise<AiPayer> {
  const sponsorship = await getSponsorshipForPatient(patientId);
  if (sponsorship) {
    return { payerUserId: sponsorship.mentorId, sponsored: true };
  }
  return { payerUserId: patientId, sponsored: false };
}

export async function getSponsorDisplayName(patientId: string): Promise<string | null> {
  const sponsorship = await getSponsorshipForPatient(patientId);
  if (!sponsorship) return null;
  return sponsorship.mentorDisplayName?.trim() || sponsorship.mentorEmail;
}
