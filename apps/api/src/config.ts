import { z } from 'zod';

const DEV_SECRET = 'dev-only-insecure-secret-change-me';

/** Variables opcionales: un string vacío en el .env cuenta como "no definida". */
const optional = z
  .string()
  .optional()
  .transform((v) => (v ? v : undefined));

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().default(4000),
    MONGODB_URI: z.string().default('mongodb://localhost:27017/isaac-atlas'),
    /** Origen del front (único origen permitido en mutaciones). */
    WEB_ORIGIN: z.string().default('http://localhost:5173'),
    /** URL pública base para callbacks OAuth y links de mails. Por defecto, WEB_ORIGIN. */
    PUBLIC_URL: optional,
    SESSION_SECRET: z.string().min(16).default(DEV_SECRET),
    GOOGLE_CLIENT_ID: optional,
    GOOGLE_CLIENT_SECRET: optional,
    /** Solo para traer avatar/nombre de Steam; el login no la necesita. */
    STEAM_API_KEY: optional,
    SMTP_URL: optional,
    MAIL_FROM: z.string().default('Isaac Atlas <no-reply@isaac-atlas.local>'),
    RATE_LIMIT_DISABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV === 'production' && env.SESSION_SECRET === DEV_SECRET) {
      ctx.addIssue({ code: 'custom', message: 'SESSION_SECRET es obligatorio en producción' });
    }
  })
  .transform((env) => ({ ...env, PUBLIC_URL: env.PUBLIC_URL ?? env.WEB_ORIGIN }));

export const config = envSchema.parse(process.env);
export type Config = typeof config;
