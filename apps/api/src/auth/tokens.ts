import { createHash, randomBytes } from 'node:crypto';
import type { Types } from 'mongoose';
import { EmailToken, type EmailTokenKind } from '../models/EmailToken.js';

const TTL_MS: Record<EmailTokenKind, number> = {
  verify: 24 * 60 * 60 * 1000,
  reset: 60 * 60 * 1000,
};

const hash = (token: string) => createHash('sha256').update(token).digest('hex');

/** Crea un token de un solo uso y devuelve el valor en claro (para el mail). */
export async function issueToken(userId: Types.ObjectId, kind: EmailTokenKind): Promise<string> {
  // Un solo token vigente por usuario y tipo.
  await EmailToken.deleteMany({ userId, kind });
  const token = randomBytes(32).toString('base64url');
  await EmailToken.create({
    userId,
    kind,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + TTL_MS[kind]),
  });
  return token;
}

/** Consume el token (lo borra): devuelve el userId o null si no existe / venció. */
export async function consumeToken(
  token: string,
  kind: EmailTokenKind,
): Promise<Types.ObjectId | null> {
  const doc = await EmailToken.findOneAndDelete({
    tokenHash: hash(token),
    kind,
    expiresAt: { $gt: new Date() },
  });
  return doc?.userId ?? null;
}
