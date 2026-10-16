import { Schema, model, type HydratedDocument } from 'mongoose';
import { AUTH_PROVIDERS, type AuthProvider } from '@isaac-atlas/shared';

export interface UserIdentity {
  provider: AuthProvider;
  providerId: string;
  linkedAt: Date;
}

export interface UserAttrs {
  username?: string;
  /** Minúsculas, para unicidad case-insensitive. */
  usernameLower?: string;
  email?: string;
  emailVerified: boolean;
  passwordHash?: string;
  identities: UserIdentity[];
  avatar?: string;
  createdAt: Date;
}

const identitySchema = new Schema<UserIdentity>(
  {
    provider: { type: String, enum: AUTH_PROVIDERS, required: true },
    providerId: { type: String, required: true },
    linkedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const userSchema = new Schema<UserAttrs>({
  username: String,
  usernameLower: String,
  email: String,
  emailVerified: { type: Boolean, default: false },
  passwordHash: String,
  identities: { type: [identitySchema], default: [] },
  avatar: String,
  createdAt: { type: Date, default: Date.now },
});

// Índices únicos parciales: solo aplican cuando el campo existe (las cuentas
// de Google/Steam nacen sin username y/o sin email).
userSchema.index(
  { usernameLower: 1 },
  { unique: true, partialFilterExpression: { usernameLower: { $type: 'string' } } },
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);
userSchema.index(
  { 'identities.provider': 1, 'identities.providerId': 1 },
  { unique: true, partialFilterExpression: { 'identities.providerId': { $type: 'string' } } },
);

export const User = model<UserAttrs>('User', userSchema);
export type UserDocument = HydratedDocument<UserAttrs>;
