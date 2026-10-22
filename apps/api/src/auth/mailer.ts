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

function createTransport() {
  if (config.SMTP_HOST) {
    const port = Number(config.SMTP_PORT ?? 587);
    return nodemailer.createTransport({
      host: config.SMTP_HOST,
      port,
      secure: port === 465,
      auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS ?? '' } : undefined,
    });
  }
  return config.SMTP_URL ? nodemailer.createTransport(config.SMTP_URL) : null;
}

const transport = createTransport();

/** Separa "Nombre <correo>" en sus partes. */
function parseSender(from: string): { name?: string; email: string } {
  const match = /^(.*)<([^>]+)>\s*$/.exec(from);
  return match ? { name: match[1]!.trim() || undefined, email: match[2]!.trim() } : { email: from };
}

async function sendViaBrevo(mail: Mail): Promise<void> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': config.BREVO_API_KEY!, 'content-type': 'application/json' },
    body: JSON.stringify({
      sender: parseSender(config.MAIL_FROM),
      to: [{ email: mail.to }],
      subject: mail.subject,
      textContent: mail.text,
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`Brevo ${res.status}: ${await res.text()}`);
}

/** Tope diario global (el plan gratis de Brevo permite ~300): evita agotar la cuota por abuso. */
const DAILY_MAIL_LIMIT = 250;
let mailDay = '';
let mailsToday = 0;

function withinDailyLimit(): boolean {
  const day = new Date().toISOString().slice(0, 10);
  if (day !== mailDay) {
    mailDay = day;
    mailsToday = 0;
  }
  return ++mailsToday <= DAILY_MAIL_LIMIT;
}

export async function sendMail(mail: Mail): Promise<void> {
  if (config.NODE_ENV === 'test') {
    outbox.push(mail);
    return;
  }
  if (!withinDailyLimit()) throw new Error('tope diario de mails alcanzado');
  if (config.BREVO_API_KEY) return sendViaBrevo(mail);
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

/** Para registro y recuperación: si el proveedor falla, se registra el error y la petición sigue. */
export function logMailFailure(err: unknown): void {
  console.error('[mail] no se pudo enviar:', err instanceof Error ? err.message : err);
}
