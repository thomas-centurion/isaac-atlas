import {
  type Catalog,
  type CatalogCharacter,
  type CatalogItem,
  type CatalogTrinket,
} from './catalog';
import raw from './data/catalog.json';

/**
 * Catálogo completo. Lo comparten la API y la web. No se parsea con Zod al cargar (son 237 KB que
 * el navegador tendría que validar en cada visita): `catalog.test.ts` ya valida el JSON contra
 * `catalogSchema` en CI.
 */
export const catalog = raw as unknown as Catalog;

const itemsById = new Map<number, CatalogItem>(catalog.items.map((i) => [i.id, i]));
const trinketsById = new Map<number, CatalogTrinket>(catalog.trinkets.map((t) => [t.id, t]));
const charactersById = new Map<number, CatalogCharacter>(catalog.characters.map((c) => [c.id, c]));

export const getItem = (id: number) => itemsById.get(id);
export const getTrinket = (id: number) => trinketsById.get(id);
export const getCharacter = (id: number) => charactersById.get(id);
