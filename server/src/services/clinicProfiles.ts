import { pool } from '../db/pool.js';

export interface ClinicProfile {
  accountId: string;
  clinicName: string;
  canNutrition: boolean;
  canTraining: boolean;
  canMedical: boolean;
  licenseNumber: string | null;
  issuingBody: string | null;
  specialty: string | null;
  hasCredentialDoc: boolean;
  credentialFilename: string | null;
  credentialContentType: string | null;
  credentialSize: number | null;
  showCredentialsToPatient: boolean;
  updatedAt: string;
}

export interface ClinicCredentialBlob {
  filename: string;
  contentType: string;
  bytes: Buffer;
  size: number;
}

export async function getClinicProfile(mentorId: string): Promise<ClinicProfile> {
  const res = await pool.query(
    `SELECT account_id, clinic_name, can_nutrition, can_training, can_medical,
            license_number, issuing_body, specialty,
            credential_filename, credential_content_type, credential_size,
            (credential_bytes IS NOT NULL) as has_credential_doc,
            show_credentials_to_patient, updated_at
     FROM clinic_profiles
     WHERE account_id = $1`,
    [mentorId],
  );

  if (res.rowCount === 0) {
    // Return default profile if not yet created in DB
    return {
      accountId: mentorId,
      clinicName: '',
      canNutrition: true,
      canTraining: false,
      canMedical: false,
      licenseNumber: null,
      issuingBody: null,
      specialty: null,
      hasCredentialDoc: false,
      credentialFilename: null,
      credentialContentType: null,
      credentialSize: null,
      showCredentialsToPatient: true,
      updatedAt: new Date().toISOString(),
    };
  }

  const row = res.rows[0];
  return {
    accountId: row.account_id,
    clinicName: row.clinic_name || '',
    canNutrition: Boolean(row.can_nutrition),
    canTraining: Boolean(row.can_training),
    canMedical: Boolean(row.can_medical),
    licenseNumber: row.license_number || null,
    issuingBody: row.issuing_body || null,
    specialty: row.specialty || null,
    hasCredentialDoc: Boolean(row.has_credential_doc),
    credentialFilename: row.credential_filename || null,
    credentialContentType: row.credential_content_type || null,
    credentialSize: row.credential_size != null ? Number(row.credential_size) : null,
    showCredentialsToPatient: Boolean(row.show_credentials_to_patient),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString(),
  };
}

export async function upsertClinicProfile(
  mentorId: string,
  input: {
    clinicName?: string;
    canNutrition?: boolean;
    canTraining?: boolean;
    canMedical?: boolean;
    licenseNumber?: string | null;
    issuingBody?: string | null;
    specialty?: string | null;
    showCredentialsToPatient?: boolean;
  },
): Promise<ClinicProfile> {
  const current = await getClinicProfile(mentorId);

  const clinicName = input.clinicName !== undefined ? input.clinicName.trim() : current.clinicName;
  const canNutrition = input.canNutrition !== undefined ? input.canNutrition : current.canNutrition;
  const canTraining = input.canTraining !== undefined ? input.canTraining : current.canTraining;
  const canMedical = input.canMedical !== undefined ? input.canMedical : current.canMedical;
  const licenseNumber = input.licenseNumber !== undefined ? (input.licenseNumber ? input.licenseNumber.trim() : null) : current.licenseNumber;
  const issuingBody = input.issuingBody !== undefined ? (input.issuingBody ? input.issuingBody.trim() : null) : current.issuingBody;
  const specialty = input.specialty !== undefined ? (input.specialty ? input.specialty.trim() : null) : current.specialty;
  const showCredentialsToPatient = input.showCredentialsToPatient !== undefined ? input.showCredentialsToPatient : current.showCredentialsToPatient;

  await pool.query(
    `INSERT INTO clinic_profiles (
       account_id, clinic_name, can_nutrition, can_training, can_medical,
       license_number, issuing_body, specialty, show_credentials_to_patient, updated_at
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
     ON CONFLICT (account_id) DO UPDATE SET
       clinic_name = EXCLUDED.clinic_name,
       can_nutrition = EXCLUDED.can_nutrition,
       can_training = EXCLUDED.can_training,
       can_medical = EXCLUDED.can_medical,
       license_number = EXCLUDED.license_number,
       issuing_body = EXCLUDED.issuing_body,
       specialty = EXCLUDED.specialty,
       show_credentials_to_patient = EXCLUDED.show_credentials_to_patient,
       updated_at = NOW()`,
    [
      mentorId,
      clinicName,
      canNutrition,
      canTraining,
      canMedical,
      licenseNumber,
      issuingBody,
      specialty,
      showCredentialsToPatient,
    ],
  );

  return getClinicProfile(mentorId);
}

export async function saveClinicCredentialDoc(
  mentorId: string,
  filename: string,
  contentType: string,
  bytes: Buffer,
): Promise<ClinicProfile> {
  // Ensure profile row exists
  await upsertClinicProfile(mentorId, {});

  await pool.query(
    `UPDATE clinic_profiles
     SET credential_filename = $1,
         credential_content_type = $2,
         credential_bytes = $3,
         credential_size = $4,
         updated_at = NOW()
     WHERE account_id = $5`,
    [filename.slice(0, 255), contentType.slice(0, 100), bytes, bytes.length, mentorId],
  );

  return getClinicProfile(mentorId);
}

export async function deleteClinicCredentialDoc(mentorId: string): Promise<ClinicProfile> {
  await pool.query(
    `UPDATE clinic_profiles
     SET credential_filename = NULL,
         credential_content_type = NULL,
         credential_bytes = NULL,
         credential_size = NULL,
         updated_at = NOW()
     WHERE account_id = $1`,
    [mentorId],
  );

  return getClinicProfile(mentorId);
}

export async function getClinicCredentialBlob(mentorId: string): Promise<ClinicCredentialBlob | null> {
  const res = await pool.query(
    `SELECT credential_filename, credential_content_type, credential_bytes, credential_size
     FROM clinic_profiles
     WHERE account_id = $1 AND credential_bytes IS NOT NULL`,
    [mentorId],
  );

  if (res.rowCount === 0) return null;
  const row = res.rows[0];
  return {
    filename: row.credential_filename || 'credential_document.pdf',
    contentType: row.credential_content_type || 'application/pdf',
    bytes: row.credential_bytes,
    size: Number(row.credential_size || row.credential_bytes.length),
  };
}
