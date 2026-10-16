import { catalogSchema, type CatalogItem, type CatalogTrinket } from '@isaac-atlas/shared';
import raw from '@isaac-atlas/shared/catalog.json';

export const catalog = catalogSchema.parse(raw);

const itemsById = new Map<number, CatalogItem>(catalog.items.map((i) => [i.id, i]));
const trinketsById = new Map<number, CatalogTrinket>(catalog.trinkets.map((t) => [t.id, t]));

export const getItem = (id: number) => itemsById.get(id);
export const getTrinket = (id: number) => trinketsById.get(id);
