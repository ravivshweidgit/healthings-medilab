import nodemailer from 'nodemailer';
import { config } from '../config.js';

export class OtpEmailSendError extends Error {
  constructor(cause?: unknown) {
    super('Could not send the sign-in code');
    this.name = 'OtpEmailSendError';
    this.cause = cause;
  }
}

export async function sendOtpEmail(email: string, code: string): Promise<void> {
  const subject = 'Your Healthings sign-in code';
  const text = `Your sign-in code is ${code}. It expires in 10 minutes.\n\nIf you did not request this, ignore this email.`;

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
