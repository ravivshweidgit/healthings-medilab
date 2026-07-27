import nodemailer from 'nodemailer';
import { config } from '../config.js';

export class OtpEmailSendError extends Error {
  constructor(cause?: unknown) {
    super('Could not send the code');
    this.name = 'OtpEmailSendError';
    this.cause = cause;
  }
}

export class InviteEmailSendError extends Error {
  constructor(cause?: unknown) {
    super('Could not send the invite email');
    this.name = 'InviteEmailSendError';
    this.cause = cause;
  }
}

/**
 * What the code authorizes. A deletion code must never arrive worded as a
 * sign-in code: this email is the only out-of-band channel the real owner has,
 * so if somebody else is holding their session it is the one chance they get to
 * notice — and "ignore this email" would be exactly the wrong advice.
 */
export type OtpPurpose = 'sign-in' | 'account-deletion';

const OTP_COPY: Record<OtpPurpose, { subject: string; body: (code: string) => string }> = {
  'sign-in': {
    subject: 'Your Healthings sign-in code',
    body: (code) =>
      `Your sign-in code is ${code}. It expires in 10 minutes.\n\n` +
      `If you did not request this, ignore this email.`,
  },
  'account-deletion': {
    subject: 'Confirm deleting your Healthings account',
    body: (code) =>
      `Your account deletion code is ${code}. It expires in 10 minutes.\n\n` +
      `Entering it permanently deletes your Healthings account and everything we ` +
      `hold on the server: any snapshot shared with a clinic, your cloud backup, ` +
      `and your clinic links. This cannot be undone. Data on your phone is not ` +
      `touched.\n\n` +
      `If you did not ask to delete your account, do NOT enter this code — ` +
      `someone may have access to your signed-in session. Reply to this email ` +
      `and we will help you secure the account.`,
  },
};

type MailPayload = { to: string; subject: string; text: string; logTag: string };

async function deliverMail(payload: MailPayload): Promise<void> {
  if (config.SMTP_MODE === 'console') {
    console.log(`[${payload.logTag}] ${payload.to} → ${payload.subject}\n${payload.text}`);
    return;
  }

  if (!config.SMTP_HOST || !config.SMTP_USER || !config.SMTP_PASS) {
    throw new Error('SMTP not configured');
  }

  const transport = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT ?? 587,
    secure: config.SMTP_SECURE ?? false,
    requireTLS: !(config.SMTP_SECURE ?? false),
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });

  await transport.sendMail({
    from: config.MAIL_FROM,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
  });
}

export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: OtpPurpose = 'sign-in',
): Promise<void> {
  const { subject, body } = OTP_COPY[purpose];
  try {
    await deliverMail({
      to: email,
      subject,
      text: body(code),
      logTag: purpose === 'account-deletion' ? 'OTP-delete' : 'OTP',
    });
  } catch (err) {
    // Never log `code` here. It is a live credential and the journal outlives it.
    console.error('[OTP email failed]', { email, err });
    throw new OtpEmailSendError(err);
  }
}

export type ClinicInviteMail = {
  /** Clinic label shown to the patient — display name, else their email. */
  clinicLabel: string;
  clinicEmail: string;
};

/**
 * Notifies the patient that a clinic invited them. Does not carry secrets —
 * accepting happens in the app after they sign in with this address.
 */
export type BillingDunningMail = {
  amountCents: number;
  currency: string;
  nextRetryAt: Date | null;
  coveragePaused: boolean;
  updateCardUrl: string;
};

/** Card failed / grace — factual dunning (be-34). Never marketing tone. */
export async function sendBillingDunningEmail(
  email: string,
  info: BillingDunningMail,
): Promise<void> {
  const amount = (info.amountCents / 100).toFixed(2);
  const currency = info.currency.toUpperCase();
  const retryLine = info.nextRetryAt
    ? `We will retry the card on ${info.nextRetryAt.toISOString().slice(0, 10)} (UTC).\n`
    : '';
  const pausedLine = info.coveragePaused
    ? `AI coverage for sponsored patients is paused until payment succeeds. ` +
      `Sponsorship links and clinical data access are unchanged.\n`
    : `AI continues during a short grace period while we retry.\n`;

  const subject = info.coveragePaused
    ? 'Healthings: payment needed — AI coverage paused'
    : 'Healthings: payment failed — please update your card';
  const text =
    `We could not charge your saved card for a Healthings AI token pack ` +
    `(${currency} ${amount}).\n\n` +
    pausedLine +
    retryLine +
    `\nUpdate your card: ${info.updateCardUrl}\n\n` +
    `— Healthings`;

  try {
    await deliverMail({ to: email, subject, text, logTag: 'billing-dunning' });
  } catch (err) {
    console.error('[billing dunning email failed]', { email, err });
  }
}

export async function sendBillingRecoveredEmail(email: string): Promise<void> {
  const subject = 'Healthings: payment recovered';
  const text =
    `Your card payment succeeded and AI coverage is active again.\n\n` +
    `— Healthings`;
  try {
    await deliverMail({ to: email, subject, text, logTag: 'billing-recovered' });
  } catch (err) {
    console.error('[billing recovered email failed]', { email, err });
  }
}

export async function sendClinicInviteEmail(
  patientEmail: string,
  invite: ClinicInviteMail,
): Promise<void> {
  const subject = `${invite.clinicLabel} invited you on Healthings`;
  const text =
    `${invite.clinicLabel} (${invite.clinicEmail}) invited you to share your Healthings ` +
    `data with their clinic.\n\n` +
    `Nothing is shared until you approve in the app:\n` +
    `1. Install Healthings from https://healthings.ai if you do not have it yet\n` +
    `2. Sign in with this email address (${patientEmail})\n` +
    `3. Open Profile → Clinic link and approve the invite\n\n` +
    `If you do not want to share, ignore this email or open the app and decline. ` +
    `No health data leaves your phone until you approve.\n\n` +
    `— Healthings`;

  try {
    await deliverMail({ to: patientEmail, subject, text, logTag: 'invite' });
  } catch (err) {
    console.error('[invite email failed]', { email: patientEmail, err });
    throw new InviteEmailSendError(err);
  }
}
