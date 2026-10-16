import { z } from 'zod';

export const SPRITE_CELL = 32;
export const SPRITE_COLUMNS = 32;

export const itemKindSchema = z.enum(['passive', 'active', 'familiar']);
export type ItemKind = z.infer<typeof itemKindSchema>;

const localizedNameSchema = z.object({ en: z.string(), es: z.string() });
export type LocalizedName = z.infer<typeof localizedNameSchema>;

export const catalogItemSchema = z.object({
  id: z.number().int().positive(),
  name: localizedNameSchema,
  kind: itemKindSchema,
  /** 0-4, tal como lo define el juego (items_metadata.xml). */
  quality: z.number().int().min(0).max(4),
  /** Pools en los que puede aparecer (treasure, devil, angel, ...). */
  pools: z.array(z.string()),
  tags: z.array(z.string()),
  maxCharges: z.number().int().optional(),
  /** Índice dentro del sprite sheet (ver SPRITE_CELL / SPRITE_COLUMNS). */
  sprite: z.number().int().nonnegative(),
});
export type CatalogItem = z.infer<typeof catalogItemSchema>;

export const catalogTrinketSchema = z.object({
  id: z.number().int().positive(),
  name: localizedNameSchema,
  sprite: z.number().int().nonnegative(),
});
export type CatalogTrinket = z.infer<typeof catalogTrinketSchema>;

export const catalogCharacterSchema = z.object({
  /** ID del jugador en players.xml (estable entre versiones del juego). */
  id: z.number().int().nonnegative(),
  /** Slug estable para URLs y filtros: "isaac", "tainted-isaac". */
  key: z.string(),
  /** Nombre base; en las variantes Tainted la UI antepone "T.". */
  name: localizedNameSchema,
  tainted: z.boolean(),
});
export type CatalogCharacter = z.infer<typeof catalogCharacterSchema>;

export const catalogSchema = z.object({
  gameVersion: z.literal('rep+'),
  items: z.array(catalogItemSchema),
  trinkets: z.array(catalogTrinketSchema),
  characters: z.array(catalogCharacterSchema),
});
export type Catalog = z.infer<typeof catalogSchema>;

/** Posición en px de un sprite dentro del sheet. */
export function spritePosition(index: number): { x: number; y: number } {
  return {
    x: (index % SPRITE_COLUMNS) * SPRITE_CELL,
    y: Math.floor(index / SPRITE_COLUMNS) * SPRITE_CELL,
  };
}
