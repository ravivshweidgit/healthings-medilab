import { query } from '../db/pool.js';
import type { PublicUser } from './jwt.js';
import { hasApprovedShare } from './shares.js';

export type ClinicChatMessage = {
  role: 'user' | 'assistant';
  text: string;
  sentAt: string;
  fromClinic?: boolean;
};

export type ClinicUserRules = {
  rawText: string;
  summary: string;
  constraints: string[];
  aiContext?: string;
  analyzedAt: string;
  updatedByClinic?: boolean;
};

export type ClinicOverlay = {
  patientId: string;
  rules: ClinicUserRules | null;
  chat: Record<string, ClinicChatMessage[]>;
  updatedAt: string;
  updatedBy: string | null;
};

type OverlayRow = {
  patient_id: string;
  rules_json: ClinicUserRules | null;
  chat_json: Record<string, ClinicChatMessage[]>;
  updated_at: Date;
  updated_by: string | null;
};

export class ClinicError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ClinicError';
    this.status = status;
  }
}

const MENTOR_TYPES = new Set(['doctor', 'nutritionist', 'coach']);

export function assertMentorType(v: string): asserts v is 'doctor' | 'nutritionist' | 'coach' {
  if (!MENTOR_TYPES.has(v)) {
    throw new ClinicError('Invalid mentor type', 400);
  }
}

async function assertMentorPatientAccess(mentor: PublicUser, patientId: string): Promise<void> {
  if (mentor.role !== 'mentor') {
    throw new ClinicError('Requires mentor role', 403);
  }
  const ok = await hasApprovedShare(patientId, mentor.id);
  if (!ok) {
    throw new ClinicError('No approved share with this patient', 403);
  }
}

function rowToOverlay(row: OverlayRow): ClinicOverlay {
  return {
    patientId: row.patient_id,
    rules: row.rules_json,
    chat: row.chat_json ?? {},
    updatedAt: row.updated_at.toISOString(),
    updatedBy: row.updated_by,
  };
}

export async function getOverlayForMentor(mentor: PublicUser, patientId: string): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId);
  const { rows } = await query<OverlayRow>(
    `SELECT * FROM clinic_patient_overlays WHERE patient_id = $1`,
    [patientId],
  );
  if (!rows[0]) {
    return {
      patientId,
      rules: null,
      chat: {},
      updatedAt: new Date(0).toISOString(),
      updatedBy: null,
    };
  }
  return rowToOverlay(rows[0]);
}

export async function getOverlayForPatient(patient: PublicUser): Promise<ClinicOverlay | null> {
  if (patient.role !== 'patient') {
    throw new ClinicError('Requires patient role', 403);
  }
  const { rows } = await query<OverlayRow>(
    `SELECT * FROM clinic_patient_overlays WHERE patient_id = $1`,
    [patient.id],
  );
  if (!rows[0]) return null;
  return rowToOverlay(rows[0]);
}

export async function saveRulesForPatient(
  mentor: PublicUser,
  patientId: string,
  rules: ClinicUserRules,
): Promise<ClinicOverlay> {
  await assertMentorPatientAccess(mentor, patientId);
  const { rows } = await query<OverlayRow>(
    `INSERT INTO clinic_patient_overlays (patient_id, rules_json, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (patient_id) DO UPDATE
       SET rules_json = EXCLUDED.rules_json,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by
     RETURNING *`,
    [patientId, { ...rules, updatedByClinic: true }, mentor.id],
  );
  return rowToOverlay(rows[0]!);
}

export async function appendChatMessages(
  mentor: PublicUser,
  patientId: string,
  mentorType: string,
  userMsg: ClinicChatMessage,
  assistantMsg: ClinicChatMessage,
): Promise<ClinicChatMessage[]> {
  await assertMentorPatientAccess(mentor, patientId);
  assertMentorType(mentorType);

  const existing = await getOverlayForMentor(mentor, patientId);
  const thread = [...(existing.chat[mentorType] ?? []), userMsg, assistantMsg];
  const chatJson = { ...existing.chat, [mentorType]: thread };

  await query(
    `INSERT INTO clinic_patient_overlays (patient_id, chat_json, updated_at, updated_by)
     VALUES ($1, $2, NOW(), $3)
     ON CONFLICT (patient_id) DO UPDATE
       SET chat_json = EXCLUDED.chat_json,
           updated_at = NOW(),
           updated_by = EXCLUDED.updated_by`,
    [patientId, chatJson, mentor.id],
  );

  return thread;
}
