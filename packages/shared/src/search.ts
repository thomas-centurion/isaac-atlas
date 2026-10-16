import { z } from 'zod';
import {
  difficultySchema,
  runResultSchema,
  runSchema,
  verdictKindSchema,
  type Difficulty,
  type RunResult,
  type VerdictKind,
} from './runs';
import { isValidSeedFormat, normalizeSeed } from './seed';

export const MAX_FILTER_ITEMS = 10;
export const MAX_PAGE_SIZE = 50;
export const DEFAULT_PAGE_SIZE = 20;

/** hot: votos con peso en lo reciente · top: mejor valoradas (Wilson) · new: más nuevas. */
export const SORT_MODES = ['hot', 'top', 'new'] as const;
export const sortModeSchema = z.enum(SORT_MODES);
export type SortMode = z.infer<typeof sortModeSchema>;
export const DEFAULT_SORT: SortMode = 'hot';

/** "153,105" → [153, 105]. Cualquier otra cosa (p. ej. un array por parámetro repetido) no valida. */
const idList = z
  .preprocess(
    (v) =>
      typeof v === 'string' ? v.split(',').filter(Boolean).map(Number) : v === undefined ? [] : v,
    z.array(z.number().int().positive()).max(MAX_FILTER_ITEMS),
  )
  .default([]);

/** Parámetros de GET /api/runs (todos vienen como strings en la query). */
export const runSearchSchema = z.object({
  character: z.coerce.number().int().nonnegative().optional(),
  difficulty: difficultySchema.optional(),
  result: runResultSchema.optional(),
  fullUnlocks: z
    .enum(['true', 'false'])
    .transform((v) => v === 'true')
    .optional(),
  /** El ítem aparece entre los del primer piso: "empieza con X". */
  startItems: idList,
  /** La run incluyó todos estos ítems en algún momento. */
  items: idList,
  /** La run no incluyó ninguno de estos ítems. */
  exclude: idList,
  seed: z
    .string()
    .transform(normalizeSeed)
    .refine(isValidSeedFormat, { message: 'invalid seed' })
    .optional(),
  /** Solo runs que la comunidad marcó como OP / Troll / Hard. */
  verdict: verdictKindSchema.optional(),
  sort: sortModeSchema.default(DEFAULT_SORT),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
});
export type RunSearchQuery = z.infer<typeof runSearchSchema>;

export const runSearchResponseSchema = z.object({
  runs: z.array(runSchema),
  nextCursor: z.string().nullable(),
});
export type RunSearchResponse = z.infer<typeof runSearchResponseSchema>;

/** Resumen de una seed: todas las runs que la usaron y qué ítems se repiten. */
export const seedSummarySchema = z.object({
  seed: z.string(),
  runCount: z.number().int(),
  characters: z.array(z.object({ characterId: z.number().int(), count: z.number().int() })),
  topItems: z.array(z.object({ itemId: z.number().int(), count: z.number().int() })),
  runs: z.array(runSchema),
});
export type SeedSummary = z.infer<typeof seedSummarySchema>;

/** Seed del día: una run elegida por fecha UTC (null si todavía no hay runs). */
export const dailyResponseSchema = z.object({
  date: z.string(),
  run: runSchema.nullable(),
});
export type DailyResponse = z.infer<typeof dailyResponseSchema>;

/** Filtros del buscador tal como los maneja la web (y como viajan en la URL). */
export interface SearchFilters {
  character?: number;
  difficulty?: Difficulty;
  result?: RunResult;
  fullUnlocks?: boolean;
  startItems: number[];
  items: number[];
  exclude: number[];
  seed?: string;
  verdict?: VerdictKind;
  sort: SortMode;
}

export const EMPTY_FILTERS: SearchFilters = {
  startItems: [],
  items: [],
  exclude: [],
  sort: DEFAULT_SORT,
};

export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.character !== undefined) params.set('character', String(filters.character));
  if (filters.difficulty) params.set('difficulty', filters.difficulty);
  if (filters.result) params.set('result', filters.result);
  if (filters.fullUnlocks !== undefined) params.set('fullUnlocks', String(filters.fullUnlocks));
  if (filters.startItems.length) params.set('startItems', filters.startItems.join(','));
  if (filters.items.length) params.set('items', filters.items.join(','));
  if (filters.exclude.length) params.set('exclude', filters.exclude.join(','));
  if (filters.seed) params.set('seed', filters.seed);
  if (filters.verdict) params.set('verdict', filters.verdict);
  // El orden por defecto no viaja en la URL.
  if (filters.sort !== DEFAULT_SORT) params.set('sort', filters.sort);
  return params;
}

/** Lee filtros de una URL; una URL con basura da filtros vacíos en vez de romper la página. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  const parsed = runSearchSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success) return EMPTY_FILTERS;
  const {
    character,
    difficulty,
    result,
    fullUnlocks,
    startItems,
    items,
    exclude,
    seed,
    verdict,
    sort,
  } = parsed.data;
  return {
    ...(character !== undefined ? { character } : {}),
    ...(difficulty ? { difficulty } : {}),
    ...(result ? { result } : {}),
    ...(fullUnlocks !== undefined ? { fullUnlocks } : {}),
    startItems,
    items,
    exclude,
    ...(seed ? { seed } : {}),
    ...(verdict ? { verdict } : {}),
    sort,
  };
}

/** ¿Hay algún filtro aplicado? El orden no cuenta: no restringe resultados. */
export const hasActiveFilters = (f: SearchFilters): boolean =>
  filtersToParams({ ...f, sort: DEFAULT_SORT }).toString() !== '';
