import nodemailer from 'nodemailer';
import { config } from '../config.js';

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
    port: config.SMTP_PORT ?? 465,
    secure: config.SMTP_SECURE ?? true,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_PASS,
    },
  });

  await transport.sendMail({
    from: config.MAIL_FROM,
    to: email,
    subject,
    text,
  });
}
