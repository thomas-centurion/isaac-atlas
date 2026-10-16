import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().default('mongodb://localhost:27017/isaac-atlas'),
  WEB_ORIGIN: z.string().default('http://localhost:5173'),
});

export const config = envSchema.parse(process.env);
