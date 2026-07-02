import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import { findUserByEmail, findUserById } from './users.js';
import { config } from '../config.js';

export type PublicSponsorship = {
  mentorId: string;
  mentorEmail: string;
  mentorDisplayName: string | null;
  patientId: string;
  patientEmail: string;
  expiresAt: string;
  active: boolean;
};

export class SponsorshipError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'SponsorshipError';
    this.status = status;
  }
}

type SponsorshipRow = {
  patient_id: string;
  patient_email: string;
  mentor_id: string;
  mentor_email: string;
  mentor_display_name: string | null;
  expires_at: Date;
};

const sponsorshipSelect = `
  SELECT sp.patient_id,
         p.email AS patient_email,
         sp.sponsor_id AS mentor_id,
         m.email AS mentor_email,
         m.display_name AS mentor_display_name,
         sp.expires_at
  FROM ai_sponsorships sp
  JOIN users p ON p.id = sp.patient_id
  JOIN users m ON m.id = sp.sponsor_id
`;

function isActive(expiresAt: Date): boolean {
  return expiresAt.getTime() > Date.now();
}

function toPublic(row: SponsorshipRow): PublicSponsorship {
  return {
    patientId: row.patient_id,
    patientEmail: row.patient_email,
    mentorId: row.mentor_id,
    mentorEmail: row.mentor_email,
    mentorDisplayName: row.mentor_display_name,
    expiresAt: row.expires_at.toISOString(),
    active: isActive(row.expires_at),
  };
}

function defaultExpiresAt(): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + config.SPONSORSHIP_DEFAULT_DAYS);
  return d;
}

function parseExpiresAt(raw?: string): Date {
  if (!raw) return defaultExpiresAt();
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) {
    throw new SponsorshipError('Invalid expiresAt', 400);
  }
  if (d.getTime() <= Date.now()) {
    throw new SponsorshipError('expiresAt must be in the future', 400);
  }
  return d;
}

/** Active sponsor only (respects expiration). */
export async function getSponsorshipForPatient(patientId: string): Promise<PublicSponsorship | null> {
  const { rows } = await query<SponsorshipRow>(
    `${sponsorshipSelect}
     WHERE sp.patient_id = $1 AND sp.expires_at > NOW()`,
    [patientId],
  );
  return rows[0] ? toPublic(rows[0]) : null;
}

/** Mentor dashboard — includes expired rows for renewal. */
export async function listSponsoredPatientsForMentor(mentorId: string): Promise<PublicSponsorship[]> {
  const { rows } = await query<SponsorshipRow>(
    `${sponsorshipSelect} WHERE sp.sponsor_id = $1 ORDER BY sp.expires_at DESC, p.email`,
    [mentorId],
  );
  return rows.map(toPublic);
}

export async function removeSponsorshipForMentor(patientId: string, mentorId: string): Promise<void> {
  await query(`DELETE FROM ai_sponsorships WHERE patient_id = $1 AND sponsor_id = $2`, [patientId, mentorId]);
}

export async function removeSponsorshipForPatient(patientId: string): Promise<void> {
  await query(`DELETE FROM ai_sponsorships WHERE patient_id = $1`, [patientId]);
}

async function resolvePatient(patientId?: string, patientEmail?: string): Promise<PublicUser> {
  let patient: PublicUser | null = null;
  if (patientId) patient = await findUserById(patientId);
  else if (patientEmail) patient = await findUserByEmail(patientEmail.trim().toLowerCase());

  if (!patient) throw new SponsorshipError('Patient not found', 404);
  if (patient.role !== 'patient') throw new SponsorshipError('Target must be a patient account', 400);
  return patient;
}

export async function enableSponsorship(
  mentor: PublicUser,
  opts: { patientId?: string; patientEmail?: string; expiresAt?: string },
): Promise<PublicSponsorship> {
  if (mentor.role !== 'mentor') {
    throw new SponsorshipError('Requires mentor role', 403);
  }

  const patient = await resolvePatient(opts.patientId, opts.patientEmail);
  if (patient.id === mentor.id) {
    throw new SponsorshipError('Cannot sponsor yourself', 400);
  }

  const expiresAt = parseExpiresAt(opts.expiresAt);

  await query(`DELETE FROM ai_sponsorships WHERE patient_id = $1`, [patient.id]);
  await query(
    `INSERT INTO ai_sponsorships (patient_id, sponsor_id, share_pct, expires_at)
     VALUES ($1, $2, 100, $3)`,
    [patient.id, mentor.id, expiresAt.toISOString()],
  );

  const row = await getSponsorshipForPatient(patient.id);
  if (!row) throw new SponsorshipError('Failed to enable sponsorship', 500);
  return row;
}

export async function disableSponsorship(
  mentor: PublicUser,
  opts: { patientId?: string; patientEmail?: string },
): Promise<void> {
  if (mentor.role !== 'mentor') {
    throw new SponsorshipError('Requires mentor role', 403);
  }

  const patient = await resolvePatient(opts.patientId, opts.patientEmail);
  const { rows } = await query<{ sponsor_id: string }>(
    `SELECT sponsor_id FROM ai_sponsorships WHERE patient_id = $1`,
    [patient.id],
  );
  if (!rows[0] || rows[0].sponsor_id !== mentor.id) {
    throw new SponsorshipError('You are not the sponsor for this patient', 404);
  }

  await removeSponsorshipForMentor(patient.id, mentor.id);
}

/** Patient read-only — active sponsor or latest expired row for display. */
export async function getSponsorshipViewForPatient(patientId: string): Promise<PublicSponsorship | null> {
  const active = await getSponsorshipForPatient(patientId);
  if (active) return active;

  const { rows } = await query<SponsorshipRow>(
    `${sponsorshipSelect} WHERE sp.patient_id = $1 ORDER BY sp.expires_at DESC LIMIT 1`,
    [patientId],
  );
  return rows[0] ? toPublic(rows[0]) : null;
}
