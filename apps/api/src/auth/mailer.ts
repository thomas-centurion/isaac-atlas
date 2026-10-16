import nodemailer from 'nodemailer';
import type { Locale } from '@isaac-atlas/shared';
import { config } from '../config.js';

export interface Mail {
  to: string;
  subject: string;
  text: string;
}

/** En tests guardamos los mails acá en vez de enviarlos. */
export const outbox: Mail[] = [];

const transport = config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;

export async function sendMail(mail: Mail): Promise<void> {
  if (config.NODE_ENV === 'test') {
    outbox.push(mail);
    return;
  }
  if (!transport) {
    // Desarrollo sin SMTP: el mail se imprime en consola.
    console.log(`\n[mail] to=${mail.to}\n[mail] ${mail.subject}\n${mail.text}\n`);
    return;
  }
  await transport.sendMail({ from: config.MAIL_FROM, ...mail });
}

const COPY = {
  es: {
    verifySubject: 'Confirmá tu email en Isaac Atlas',
    verifyBody: (url: string) =>
      `¡Bienvenido a Isaac Atlas!\n\nConfirmá tu email entrando acá (vence en 24 horas):\n${url}\n\nSi no creaste la cuenta, ignorá este mensaje.`,
    resetSubject: 'Restablecé tu contraseña de Isaac Atlas',
    resetBody: (url: string) =>
      `Pediste restablecer tu contraseña. Entrá acá (vence en 1 hora):\n${url}\n\nSi no fuiste vos, ignorá este mensaje.`,
  },
  en: {
    verifySubject: 'Confirm your Isaac Atlas email',
    verifyBody: (url: string) =>
      `Welcome to Isaac Atlas!\n\nConfirm your email here (expires in 24 hours):\n${url}\n\nIf you did not create the account, ignore this message.`,
    resetSubject: 'Reset your Isaac Atlas password',
    resetBody: (url: string) =>
      `You asked to reset your password. Go here (expires in 1 hour):\n${url}\n\nIf this was not you, ignore this message.`,
  },
} as const;

export function sendVerificationMail(to: string, token: string, locale: Locale = 'es') {
  const url = `${config.PUBLIC_URL}/verify-email?token=${token}`;
  return sendMail({ to, subject: COPY[locale].verifySubject, text: COPY[locale].verifyBody(url) });
}

export function sendResetMail(to: string, token: string, locale: Locale = 'es') {
  const url = `${config.PUBLIC_URL}/reset-password?token=${token}`;
  return sendMail({ to, subject: COPY[locale].resetSubject, text: COPY[locale].resetBody(url) });
}
