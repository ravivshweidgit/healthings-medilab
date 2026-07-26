import nodemailer from 'nodemailer';
import { config } from '../config.js';

export class OtpEmailSendError extends Error {
  constructor(cause?: unknown) {
    super('Could not send the code');
    this.name = 'OtpEmailSendError';
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

export async function sendOtpEmail(
  email: string,
  code: string,
  purpose: OtpPurpose = 'sign-in',
): Promise<void> {
  const { subject, body } = OTP_COPY[purpose];
  const text = body(code);

  if (config.SMTP_MODE === 'console') {
    console.log(`[OTP] ${email} → ${code}`);
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

  try {
    await transport.sendMail({
      from: config.MAIL_FROM,
      to: email,
      subject,
      text,
    });
  } catch (err) {
    // Never log `code` here. It is a live credential and the journal outlives it.
    console.error('[OTP email failed]', { email, err });
    throw new OtpEmailSendError(err);
  }
}
