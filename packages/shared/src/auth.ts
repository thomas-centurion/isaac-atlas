import { z } from 'zod';

export const AUTH_PROVIDERS = ['google', 'steam'] as const;
export const authProviderSchema = z.enum(AUTH_PROVIDERS);
export type AuthProvider = z.infer<typeof authProviderSchema>;

export const usernameSchema = z
  .string()
  .trim()
  .min(3)
  .max(20)
  .regex(/^[A-Za-z0-9_]+$/, 'letters, numbers and underscore only');

export const emailSchema = z.string().trim().toLowerCase().email().max(254);

export const passwordSchema = z.string().min(10).max(128);

export const localeSchema = z.enum(['es', 'en']);
export type Locale = z.infer<typeof localeSchema>;

export const registerSchema = z.object({
  email: emailSchema,
  username: usernameSchema,
  password: passwordSchema,
  locale: localeSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  // No aplicamos la política de largo al login: solo evitamos strings absurdos.
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const forgotPasswordSchema = z.object({
  email: emailSchema,
  locale: localeSchema.optional(),
});
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  password: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

export const verifyEmailSchema = z.object({ token: z.string().min(20).max(200) });

/** Borrar la cuenta exige confirmar: la contraseña, o el username si la cuenta no tiene contraseña. */
export const deleteAccountSchema = z.object({ confirm: z.string().min(1).max(128) });

export const setUsernameSchema = z.object({ username: usernameSchema });
export type SetUsernameInput = z.infer<typeof setUsernameSchema>;

export const publicUserSchema = z.object({
  id: z.string(),
  /** null hasta completar el onboarding (cuentas creadas vía Google/Steam). */
  username: z.string().nullable(),
  email: z.string().nullable(),
  emailVerified: z.boolean(),
  avatar: z.string().nullable(),
  hasPassword: z.boolean(),
  role: z.enum(['user', 'admin']),
  identities: z.array(z.object({ provider: authProviderSchema, linkedAt: z.string() })),
});
export type PublicUser = z.infer<typeof publicUserSchema>;

export const meResponseSchema = z.object({ user: publicUserSchema.nullable() });
export type MeResponse = z.infer<typeof meResponseSchema>;

export const providersResponseSchema = z.object({
  google: z.boolean(),
  steam: z.boolean(),
});
export type ProvidersResponse = z.infer<typeof providersResponseSchema>;

/** Códigos de error estables que la web traduce a mensajes. */
export const API_ERROR_CODES = [
  'validation',
  'invalid_credentials',
  'email_taken',
  'username_taken',
  'unauthorized',
  'forbidden',
  'invalid_token',
  'identity_in_use',
  'provider_unavailable',
  'last_login_method',
  'rate_limited',
  'not_found',
  'already_reported',
  'confirmation_failed',
  'internal',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const apiErrorSchema = z.object({
  error: z.enum(API_ERROR_CODES),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
export type ApiError = z.infer<typeof apiErrorSchema>;
