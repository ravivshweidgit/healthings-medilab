import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

const OTP_COPY: Record<OtpPurpose, { subject: (code: string) => string; body: (code: string) => string }> = {
  'sign-in': {
    // Code in subject so Gmail threads don't make you copy an older mail.
    subject: (code) => `Healthings sign-in code ${code}`,
    body: (code) =>
      `Your sign-in code is ${code}. It expires in 10 minutes.\n\n` +
      `This replaces any earlier code — use only this newest one.\n\n` +
      `If you did not request this, ignore this email.`,
  },
  'account-deletion': {
    subject: () => 'Confirm deleting your Healthings account',
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

type MailAttachment = {
  filename: string;
  content: Buffer;
  cid?: string;
  contentType?: string;
};

type MailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  logTag: string;
  attachments?: MailAttachment[];
};

async function deliverMail(payload: MailPayload): Promise<void> {
  if (config.SMTP_MODE === 'console') {
    // Never print TOTP secrets / QR payloads — journal outlives the credential.
    console.log(`[${payload.logTag}] ${payload.to} → ${payload.subject}`);
    if (payload.logTag !== 'totp-enroll') {
      console.log(payload.text);
    }
    const png = payload.attachments?.[0];
    if (png && config.isDev) {
      const dest = join(process.cwd(), 'tmp', png.filename);
      mkdirSync(dirname(dest), { recursive: true });
      writeFileSync(dest, png.content);
      console.log(`[${payload.logTag}] QR PNG (dev) → ${dest}`);
    }
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
    html: payload.html,
    attachments: payload.attachments?.map((a) => ({
      filename: a.filename,
      content: a.content,
      cid: a.cid,
      contentType: a.contentType,
    })),
  });
}

export class TotpEmailSendError extends Error {
  constructor(cause?: unknown) {
    super('Could not send the authenticator barcode');
    this.name = 'TotpEmailSendError';
    this.cause = cause;
  }
}

/**
 * Enroll mail: PNG barcode to scan in Google Authenticator, plus the setup key
 * if the image is blocked. Never log `secret`.
 */
export async function sendTotpEnrollEmail(
  email: string,
  png: Buffer,
  setupKey: string,
): Promise<void> {
  const grouped = setupKey.replace(/(.{4})/g, '$1 ').trim();
  const subject = 'Healthings authenticator barcode';
  const text =
    `Scan the attached barcode with Google Authenticator (or Authy / 1Password).\n\n` +
    `If the image does not show, add a code manually:\n` +
    `Account: HEALTHINGS.AI\n` +
    `Key: ${grouped}\n` +
    `Time-based, 6 digits.\n\n` +
    `Then open Healthings → Account and enter a 6-digit code from the app to finish.\n` +
    `Authenticator is not on until you confirm.\n\n` +
    `If you did not ask for this, ignore this email.`;
  const html =
    `<p>Scan this barcode with <strong>Google Authenticator</strong> (or Authy / 1Password).</p>` +
    `<p><img src="cid:totp-qr" alt="Healthings authenticator barcode" width="280" height="280" /></p>` +
    `<p>If the image does not show, add a code manually:<br/>` +
    `Account: HEALTHINGS.AI<br/>Key: ${grouped}<br/>Time-based, 6 digits.</p>` +
    `<p>Then open Healthings → Account and enter a 6-digit code from the app to finish. ` +
    `Authenticator is not on until you confirm.</p>` +
    `<p>If you did not ask for this, ignore this email.</p>`;
  try {
    await deliverMail({
      to: email,
      subject,
      text,
      html,
      logTag: 'totp-enroll',
      attachments: [
        {
          filename: 'healthings-authenticator.png',
          content: png,
          cid: 'totp-qr',
          contentType: 'image/png',
        },
      ],
    });
  } catch (err) {
    console.error('[TOTP enroll email failed]', { email, err });
    throw new TotpEmailSendError(err);
  }
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
      subject: subject(code),
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
