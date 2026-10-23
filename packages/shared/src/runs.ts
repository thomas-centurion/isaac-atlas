import { z } from 'zod';
import { getCharacter, getItem, getTrinket } from './catalog-data';
import { isValidSeedFormat, normalizeSeed } from './seed';

export const GAME_VERSIONS = ['rep+'] as const;

/** Pisos 1-13: 1-2 Basement/Downpour, 3-4 Caves/Mines, 5-6 Depths/Mausoleum, 7-8 Womb/Corpse,
 *  9 Blue Womb, 10 Sheol/Cathedral, 11 Dark Room/Chest, 12 Void, 13 Home. */
export const FLOOR_MIN = 1;
export const FLOOR_MAX = 13;
/** Hasta este piso hay dos rutas (Sótano/Aguacero, Cuevas/Minas…); después es una sola. */
export const ALT_PATH_MAX_FLOOR = 8;
export const floorSchema = z.number().int().min(FLOOR_MIN).max(FLOOR_MAX);

export const ITEM_SOURCES = [
  'treasure',
  'shop',
  'devil',
  'angel',
  'boss',
  'secret',
  'library',
  'planetarium',
  'curse',
  'chest',
  'machine',
  /** Ítem con el que el personaje empieza la run (se autocompleta al elegirlo). */
  'innate',
  'other',
] as const;
export const itemSourceSchema = z.enum(ITEM_SOURCES);

/** Desde el Útero (piso 7) ya no aparecen salas del tesoro ni tiendas. */
export const NO_TREASURE_SHOP_FROM_FLOOR = 7;

/** ¿Puede un ítem de este origen encontrarse en este piso? */
export function isSourceAvailable(source: ItemSource, floor: number): boolean {
  if (source === 'treasure' || source === 'shop') return floor < NO_TREASURE_SHOP_FROM_FLOOR;
  return true;
}
export type ItemSource = z.infer<typeof itemSourceSchema>;

export const DIFFICULTIES = ['normal', 'hard', 'greed', 'greedier'] as const;
export const difficultySchema = z.enum(DIFFICULTIES);
export type Difficulty = z.infer<typeof difficultySchema>;

export const RUN_RESULTS = ['win', 'death', 'quit'] as const;
export const runResultSchema = z.enum(RUN_RESULTS);
export type RunResult = z.infer<typeof runResultSchema>;

export const FINAL_BOSSES = [
  'mom',
  'moms-heart',
  'satan',
  'isaac',
  'blue-baby',
  'the-lamb',
  'mega-satan',
  'hush',
  'delirium',
  'mother',
  'the-beast',
  'ultra-greed',
  'ultra-greedier',
] as const;
export const finalBossSchema = z.enum(FINAL_BOSSES);

export const MAX_RUN_ITEMS = 100;
export const MAX_RUN_TRINKETS = 20;
export const MAX_NOTES_LENGTH = 1000;

const seedSchema = z
  .string()
  .transform(normalizeSeed)
  .refine(isValidSeedFormat, { message: 'invalid seed' });

const runItemSchema = z
  .object({
    itemId: z
      .number()
      .int()
      .refine((id) => getItem(id) !== undefined, 'unknown item'),
    floor: floorSchema,
    /** Sala o pool de donde salió el ítem. */
    source: itemSourceSchema,
    /** El ítem salió de un reroll (D6, D100…): `source` sigue siendo el pool donde ocurrió. */
    rerolled: z.boolean().optional(),
    /** Ruta alterna (true) o normal (false). Sin dato: runs anteriores, o pisos sin dos rutas. */
    alt: z.boolean().optional(),
  })
  .refine(
    (i) => i.alt === undefined || i.floor <= ALT_PATH_MAX_FLOOR,
    'alt path only up to floor 8',
  );
export type RunItem = z.infer<typeof runItemSchema>;

const runTrinketSchema = z
  .object({
    trinketId: z
      .number()
      .int()
      .refine((id) => getTrinket(id) !== undefined, 'unknown trinket'),
    floor: floorSchema,
    alt: z.boolean().optional(),
  })
  .refine(
    (t) => t.alt === undefined || t.floor <= ALT_PATH_MAX_FLOOR,
    'alt path only up to floor 8',
  );
export type RunTrinket = z.infer<typeof runTrinketSchema>;

const outcomeSchema = z.object({
  result: runResultSchema,
  lastFloor: floorSchema.optional(),
  finalBoss: finalBossSchema.optional(),
});
export type RunOutcome = z.infer<typeof outcomeSchema>;

/** Lo que el cliente envía para crear o reemplazar una run. */
/** Campos de una run. Sin las reglas entre campos: las respuestas leen runs viejas con esta base. */
export const runBaseSchema = z.object({
  seed: seedSchema,
  gameVersion: z.enum(GAME_VERSIONS),
  characterId: z
    .number()
    .int()
    .refine((id) => getCharacter(id) !== undefined, 'unknown character'),
  difficulty: difficultySchema,
  /** El save tenía todo desbloqueado (afecta qué ítems puede dar la seed). */
  fullUnlocks: z.boolean(),
  items: z.array(runItemSchema).min(1).max(MAX_RUN_ITEMS),
  trinkets: z.array(runTrinketSchema).max(MAX_RUN_TRINKETS),
  outcome: outcomeSchema,
  notes: z.string().trim().max(MAX_NOTES_LENGTH),
});

/** Lo que el cliente envía al crear o editar: la base más las reglas entre campos. */
export const runInputSchema = runBaseSchema.superRefine((run, ctx) => {
  run.items.forEach((item, index) => {
    if (!isSourceAvailable(item.source, item.floor)) {
      ctx.addIssue({
        code: 'custom',
        path: ['items', index, 'source'],
        message: 'source not available on this floor',
      });
    }
  });
});
export type RunInput = z.infer<typeof runInputSchema>;
/** Forma "cruda" del formulario, antes de normalizar la seed. */
export type RunDraftInput = z.input<typeof runInputSchema>;

/** Ítems del primer piso: es lo que define "empieza con X" en el buscador. */
export const startItemIds = (items: RunItem[]): number[] => [
  ...new Set(items.filter((i) => i.floor === FLOOR_MIN).map((i) => i.itemId)),
];

/** Veredictos de la comunidad: "Overpowered", "Troll" (rota o engañosa) y "Hard" (difícil). */
export const VERDICT_KINDS = ['op', 'troll', 'hard'] as const;
export const verdictKindSchema = z.enum(VERDICT_KINDS);
export type VerdictKind = z.infer<typeof verdictKindSchema>;

/** Cantidad mínima de veredictos del mismo tipo para que la run cuente como "OP", "Troll" o "Hard". */
export const MIN_VERDICT_VOTES = 1;

export const voteValueSchema = z.union([z.literal(1), z.literal(-1)]);
export type VoteValue = z.infer<typeof voteValueSchema>;
export const voteInputSchema = z.object({ value: voteValueSchema });
export const verdictInputSchema = z.object({ kind: verdictKindSchema });

export const runStatsSchema = z.object({
  up: z.number().int(),
  down: z.number().int(),
  op: z.number().int(),
  troll: z.number().int(),
  hard: z.number().int(),
});
export type RunStats = z.infer<typeof runStatsSchema>;

/** Lo que el usuario logueado ya hizo con la run (ausente si no hay sesión). */
export const runViewerSchema = z.object({
  vote: z.union([z.literal(1), z.literal(-1), z.literal(0)]),
  verdict: verdictKindSchema.nullable(),
});
export type RunViewer = z.infer<typeof runViewerSchema>;

export const runSchema = runBaseSchema.extend({
  id: z.string(),
  startItems: z.array(z.number().int()),
  author: z.object({ id: z.string(), username: z.string() }),
  createdAt: z.string(),
  /** Solo si el autor la modificó después de publicarla (quienes votaron antes lo pueden ver). */
  editedAt: z.string().optional(),
  stats: runStatsSchema,
  viewer: runViewerSchema.optional(),
});
export type Run = z.infer<typeof runSchema>;

export const runResponseSchema = z.object({ run: runSchema });
export const runsResponseSchema = z.object({ runs: z.array(runSchema) });
