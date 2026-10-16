import { z } from 'zod';
import { runSchema } from './runs';

// --- Reportes ---

export const REPORT_REASONS = ['spam', 'offensive', 'wrong_seed', 'other'] as const;
export const reportReasonSchema = z.enum(REPORT_REASONS);
export type ReportReason = z.infer<typeof reportReasonSchema>;

export const MAX_REPORT_DETAILS = 500;

/** Cuántos reportes abiertos hacen falta para ocultar una run del buscador hasta que se revise. */
export const REPORT_HIDE_THRESHOLD = 3;

export const reportInputSchema = z.object({
  reason: reportReasonSchema,
  details: z.string().trim().max(MAX_REPORT_DETAILS).default(''),
});
export type ReportInput = z.input<typeof reportInputSchema>;

export const REPORT_STATUSES = ['open', 'dismissed', 'actioned'] as const;
export const reportStatusSchema = z.enum(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

/** Reporte tal como lo ve un moderador. */
export const reportSchema = z.object({
  id: z.string(),
  reason: reportReasonSchema,
  details: z.string(),
  status: reportStatusSchema,
  createdAt: z.string(),
  reporter: z.object({ username: z.string() }),
  run: runSchema,
});
export type Report = z.infer<typeof reportSchema>;
export const reportsResponseSchema = z.object({ reports: z.array(reportSchema) });

export const RESOLVE_ACTIONS = ['dismiss', 'remove_run'] as const;
export const resolveReportSchema = z.object({ action: z.enum(RESOLVE_ACTIONS) });
export type ResolveAction = (typeof RESOLVE_ACTIONS)[number];

// --- Perfil público ---

/**
 * Perfil público: nada de email ni avatar (la foto de Google/Steam es un dato personal que el
 * usuario no eligió publicar acá).
 */
export const profileSchema = z.object({
  username: z.string(),
  createdAt: z.string(),
  runCount: z.number().int(),
  /** Totales recibidos en todas sus runs. */
  totals: z.object({
    up: z.number().int(),
    op: z.number().int(),
    troll: z.number().int(),
    hard: z.number().int(),
  }),
});
export type Profile = z.infer<typeof profileSchema>;
