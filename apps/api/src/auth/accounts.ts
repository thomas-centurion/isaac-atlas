import type { Types } from 'mongoose';
import type { AuthProvider, PublicUser } from '@isaac-atlas/shared';
import { HttpError } from '../http.js';
import { User, type UserDocument } from '../models/User.js';

const RESERVED_USERNAMES = new Set([
  'admin',
  'administrator',
  'root',
  'moderator',
  'mod',
  'support',
  'isaac',
  'isaacatlas',
  'system',
  'null',
  'undefined',
]);

const isDuplicateKey = (
  err: unknown,
): err is { code: 11000; keyPattern?: Record<string, number> } =>
  typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;

export function toPublicUser(user: UserDocument): PublicUser {
  return {
    id: user.id,
    username: user.username ?? null,
    email: user.email ?? null,
    emailVerified: user.emailVerified,
    avatar: user.avatar ?? null,
    hasPassword: Boolean(user.passwordHash),
    identities: user.identities.map((i) => ({
      provider: i.provider,
      linkedAt: i.linkedAt.toISOString(),
    })),
  };
}

export function assertUsernameAllowed(username: string) {
  if (RESERVED_USERNAMES.has(username.toLowerCase())) throw new HttpError('username_taken');
}

/** Traduce los errores de índice único de Mongo a errores de dominio. */
function rethrowDuplicate(err: unknown): never {
  if (isDuplicateKey(err)) {
    const key = Object.keys(err.keyPattern ?? {})[0] ?? '';
    if (key === 'email') throw new HttpError('email_taken');
    if (key === 'usernameLower') throw new HttpError('username_taken');
    if (key.startsWith('identities')) throw new HttpError('identity_in_use');
  }
  throw err;
}

export async function createLocalUser(input: {
  email: string;
  username: string;
  passwordHash: string;
}): Promise<UserDocument> {
  assertUsernameAllowed(input.username);
  try {
    return await User.create({
      email: input.email,
      emailVerified: false,
      username: input.username,
      usernameLower: input.username.toLowerCase(),
      passwordHash: input.passwordHash,
    });
  } catch (err) {
    rethrowDuplicate(err);
  }
}

export async function setUsername(userId: Types.ObjectId, username: string): Promise<UserDocument> {
  assertUsernameAllowed(username);
  try {
    const user = await User.findOneAndUpdate(
      // Solo se puede elegir una vez (onboarding); cambiarlo después es otra feature.
      { _id: userId, username: { $exists: false } },
      { username, usernameLower: username.toLowerCase() },
      { new: true },
    );
    if (!user) throw new HttpError('forbidden');
    return user;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    rethrowDuplicate(err);
  }
}

export interface ProviderProfile {
  provider: AuthProvider;
  providerId: string;
  email?: string;
  emailVerified: boolean;
  avatar?: string;
}

export interface ProviderResult {
  user: UserDocument;
  /** Cuenta nueva: hay que pasar por el onboarding para elegir username. */
  created: boolean;
}

/**
 * Resuelve a qué cuenta corresponde un login de Google/Steam:
 *  1. identidad ya vinculada → esa cuenta
 *  2. hay sesión (intención "vincular") → se agrega a la cuenta actual
 *  3. email verificado por el proveedor que coincide con una cuenta → se vincula
 *  4. si no, se crea una cuenta nueva sin username
 */
export async function resolveProviderLogin(
  profile: ProviderProfile,
  currentUserId?: Types.ObjectId,
): Promise<ProviderResult> {
  const identity = { provider: profile.provider, providerId: profile.providerId };
  const existing = await User.findOne({ identities: { $elemMatch: identity } });

  if (existing) {
    if (currentUserId && !existing._id.equals(currentUserId))
      throw new HttpError('identity_in_use');
    return { user: existing, created: false };
  }

  if (currentUserId) {
    const current = await User.findById(currentUserId);
    if (!current) throw new HttpError('unauthorized');
    return { user: await attachIdentity(current, profile), created: false };
  }

  if (profile.email && profile.emailVerified) {
    const byEmail = await User.findOne({ email: profile.email });
    if (byEmail) {
      if (!byEmail.emailVerified) {
        // Alguien pudo registrar este email sin ser su dueño y fijar una clave.
        // El dueño real acaba de probar el email vía el proveedor: le quitamos esa clave.
        byEmail.emailVerified = true;
        byEmail.passwordHash = undefined;
      }
      return { user: await attachIdentity(byEmail, profile), created: false };
    }
  }

  try {
    const user = await User.create({
      ...(profile.email && profile.emailVerified
        ? { email: profile.email, emailVerified: true }
        : {}),
      ...(profile.avatar ? { avatar: profile.avatar } : {}),
      identities: [{ ...identity, linkedAt: new Date() }],
    });
    return { user, created: true };
  } catch (err) {
    rethrowDuplicate(err);
  }
}

async function attachIdentity(user: UserDocument, profile: ProviderProfile): Promise<UserDocument> {
  user.identities.push({
    provider: profile.provider,
    providerId: profile.providerId,
    linkedAt: new Date(),
  });
  if (!user.avatar && profile.avatar) user.avatar = profile.avatar;
  if (!user.email && profile.email && profile.emailVerified) {
    user.email = profile.email;
    user.emailVerified = true;
  }
  try {
    return await user.save();
  } catch (err) {
    rethrowDuplicate(err);
  }
}

export async function unlinkIdentity(
  user: UserDocument,
  provider: AuthProvider,
): Promise<UserDocument> {
  const remaining = user.identities.filter((i) => i.provider !== provider);
  if (remaining.length === user.identities.length) throw new HttpError('not_found');
  // Siempre debe quedar al menos una forma de entrar.
  if (!user.passwordHash && remaining.length === 0) throw new HttpError('last_login_method');
  user.identities.splice(0, user.identities.length, ...remaining);
  return user.save();
}
