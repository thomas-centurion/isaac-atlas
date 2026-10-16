/**
 * Genera el catálogo de ítems y el sprite sheet a partir de los recursos
 * extraídos con el ResourceExtractor oficial del juego.
 *
 *   ISAAC_EXTRACTED=<.../extracted_resources> npm run catalog
 *
 * Salidas:
 *   packages/shared/src/data/catalog.json   (se commitea: son datos)
 *   apps/web/public/sprites/items.png       (gitignored: arte del juego)
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { XMLParser } from 'fast-xml-parser';
import sharp from 'sharp';
import {
  SPRITE_CELL,
  SPRITE_COLUMNS,
  catalogSchema,
  spritePosition,
  type Catalog,
  type CatalogItem,
  type CatalogTrinket,
  type ItemKind,
} from '../packages/shared/src/catalog';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extracted = process.env.ISAAC_EXTRACTED;
if (!extracted) {
  console.error('Falta ISAAC_EXTRACTED (carpeta extracted_resources del juego).');
  process.exit(1);
}
const res = join(extracted, 'resources');

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  parseAttributeValue: false,
  isArray: (name) =>
    [
      'passive',
      'active',
      'familiar',
      'trinket',
      'item',
      'Pool',
      'Item',
      'key',
      'string',
      'language',
    ].includes(name),
});
const readXml = (file: string) => parser.parse(readFileSync(join(res, file), 'utf8'));

// --- nombres (stringtable.sta: EN + ES entre otros) ---
const st = readXml('stringtable.sta').stringtable;
const langs: { id: string; index: string; name: string }[] = st.languages.language;
const stringLangs = langs.filter((l) => l.name !== 'Key').sort((a, b) => +a.index - +b.index);
const enIdx = stringLangs.findIndex((l) => l.name === 'English');
const esIdx = stringLangs.findIndex((l) => l.name === 'Spanish');
if (enIdx < 0 || esIdx < 0) throw new Error('No encontré English/Spanish en el stringtable');

const names = new Map<string, { en: string; es: string }>();
const categories = Array.isArray(st.category) ? st.category : [st.category];
for (const cat of categories) {
  for (const key of cat.key ?? []) {
    const strings: unknown[] = key.string ?? [];
    const en = String(strings[enIdx] ?? '').trim();
    if (en) names.set(key.name, { en, es: String(strings[esIdx] ?? '').trim() || en });
  }
}
const nameFor = (ref: string) => names.get(ref.replace(/^#/, ''));

// --- metadata (calidad, tags) y pools ---
const meta = new Map<number, { quality: number; tags: string[] }>();
for (const it of readXml('items_metadata.xml').items.item ?? []) {
  meta.set(+it.id, {
    quality: +(it.quality ?? 0),
    tags: String(it.tags ?? '')
      .split(/\s+/)
      .filter(Boolean),
  });
}
const poolsByItem = new Map<number, Set<string>>();
for (const pool of readXml('itempools.xml').ItemPools.Pool ?? []) {
  for (const it of pool.Item ?? []) {
    const set = poolsByItem.get(+it.Id) ?? new Set<string>();
    set.add(String(pool.Name));
    poolsByItem.set(+it.Id, set);
  }
}

// --- items.xml ---
const itemsXml = readXml('items.xml').items;
const spriteFiles: string[] = [];
const addSprite = (dir: string, gfx: string): number | null => {
  const file = join(res, 'gfx/items', dir, gfx.toLowerCase());
  if (!existsSync(file)) return null;
  spriteFiles.push(file);
  return spriteFiles.length - 1;
};

const items: CatalogItem[] = [];
for (const kind of ['passive', 'active', 'familiar'] as ItemKind[]) {
  for (const el of itemsXml[kind] ?? []) {
    const id = +el.id;
    const name = nameFor(el.name ?? '');
    const sprite = el.gfx ? addSprite('collectibles', el.gfx) : null;
    if (!name || sprite === null) {
      console.warn(`[skip] collectible ${id} (${el.name}): ${!name ? 'sin nombre' : 'sin sprite'}`);
      continue;
    }
    const m = meta.get(id);
    items.push({
      id,
      name,
      kind,
      quality: m?.quality ?? 0,
      pools: [...(poolsByItem.get(id) ?? [])].sort(),
      tags: m?.tags ?? [],
      ...(el.maxcharges ? { maxCharges: +el.maxcharges } : {}),
      sprite,
    });
  }
}
items.sort((a, b) => a.id - b.id);

const trinkets: CatalogTrinket[] = [];
for (const el of itemsXml.trinket ?? []) {
  const id = +el.id;
  const name = nameFor(el.name ?? '');
  const sprite = el.gfx ? addSprite('trinkets', el.gfx) : null;
  if (!name || sprite === null) {
    console.warn(`[skip] trinket ${id} (${el.name}): ${!name ? 'sin nombre' : 'sin sprite'}`);
    continue;
  }
  trinkets.push({ id, name, sprite });
}
trinkets.sort((a, b) => a.id - b.id);

// --- salida ---
const catalog: Catalog = catalogSchema.parse({ gameVersion: 'rep+', items, trinkets });
const dataDir = join(root, 'packages/shared/src/data');
mkdirSync(dataDir, { recursive: true });
writeFileSync(join(dataDir, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');

const rows = Math.ceil(spriteFiles.length / SPRITE_COLUMNS);
const composites = spriteFiles.map((input, i) => ({
  input,
  left: spritePosition(i).x,
  top: spritePosition(i).y,
}));
const spriteDir = join(root, 'apps/web/public/sprites');
mkdirSync(spriteDir, { recursive: true });
await sharp({
  create: {
    width: SPRITE_COLUMNS * SPRITE_CELL,
    height: rows * SPRITE_CELL,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
})
  .composite(composites)
  .png({ compressionLevel: 9 })
  .toFile(join(spriteDir, 'items.png'));

console.log(
  `OK: ${items.length} collectibles, ${trinkets.length} trinkets, sheet ${SPRITE_COLUMNS}x${rows}`,
);
