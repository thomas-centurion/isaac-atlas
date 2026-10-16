import {
  catalogSchema,
  type CatalogCharacter,
  type CatalogItem,
  type CatalogTrinket,
} from './catalog';
import raw from './data/catalog.json';

/** Catálogo completo, validado al cargar. Lo comparten la API y la web. */
export const catalog = catalogSchema.parse(raw);

const itemsById = new Map<number, CatalogItem>(catalog.items.map((i) => [i.id, i]));
const trinketsById = new Map<number, CatalogTrinket>(catalog.trinkets.map((t) => [t.id, t]));
const charactersById = new Map<number, CatalogCharacter>(catalog.characters.map((c) => [c.id, c]));

export const getItem = (id: number) => itemsById.get(id);
export const getTrinket = (id: number) => trinketsById.get(id);
export const getCharacter = (id: number) => charactersById.get(id);
