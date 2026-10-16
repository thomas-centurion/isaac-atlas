import { z } from 'zod';

export * from './seed';
export * from './catalog';
export * from './catalog-data';
export * from './auth';
export * from './runs';
export * from './search';
export * from './community';

export const healthResponseSchema = z.object({
  status: z.literal('ok'),
  db: z.enum(['up', 'down']),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
