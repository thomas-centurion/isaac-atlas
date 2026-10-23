/**
 * Genera el sprite sheet de caras de personajes a partir de los recursos extraídos del juego
 * (la misma carpeta que usa build-catalog).
 *
 *   ISAAC_EXTRACTED=<.../extracted_resources> npm run faces
 *
 * Salida (gitignored: es arte del juego):
 *   apps/web/public/sprites/characters.png
 *
 * Una fila de celdas de 32px, en el orden de `catalog.characters`: la cara de un personaje está en
 * la celda de su posición en ese arreglo. Las caras salen de `gfx/ui/coop menu.png`; el orden de
 * sus cuadros lo define `coop menu.anm2`.
 */
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { SPRITE_CELL, catalogSchema } from '../packages/shared/src/catalog';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const extracted = process.env.ISAAC_EXTRACTED;
if (!extracted) {
  console.error('Falta ISAAC_EXTRACTED (carpeta extracted_resources del juego).');
  process.exit(1);
}
const ui = join(extracted, 'resources', 'gfx', 'ui');

const catalog = catalogSchema.parse(
  JSON.parse(readFileSync(join(root, 'packages/shared/src/data/catalog.json'), 'utf8')),
);

// Cuadros de la animación "Main" (capa 0): el cuadro 0 es el "?", luego una cara por cuadro.
const anm2 = readFileSync(join(ui, 'coop menu.anm2'), 'utf8');
const main = anm2.split('<Animation Name="Arrows"')[0]!;
const layer = main.split('<LayerAnimation LayerId="0"')[1]!.split('</LayerAnimation>')[0]!;
const frames = [...layer.matchAll(/XCrop="(\d+)" YCrop="(\d+)"/g)].map((m) => ({
  left: Number(m[1]),
  top: Number(m[2]),
}));

/** Los personajes normales usan el cuadro id+1; los Tainted (id ≥ 21), el cuadro id. */
const frameFor = (id: number, tainted: boolean) => frames[tainted ? id : id + 1];

const sheet = sharp({
  create: {
    width: SPRITE_CELL * catalog.characters.length,
    height: SPRITE_CELL,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  },
});

const source = join(ui, 'coop menu.png');
const composites = await Promise.all(
  catalog.characters.map(async (c, index) => {
    const frame = frameFor(c.id, c.tainted);
    if (!frame) throw new Error(`Sin cuadro para ${c.name.en} (id ${c.id})`);
    const face = await sharp(source)
      .extract({ left: frame.left, top: frame.top, width: SPRITE_CELL, height: SPRITE_CELL })
      .toBuffer();
    return { input: face, left: index * SPRITE_CELL, top: 0 };
  }),
);

const out = join(root, 'apps/web/public/sprites');
mkdirSync(out, { recursive: true });
await sheet.composite(composites).png().toFile(join(out, 'characters.png'));
console.log(`characters.png: ${catalog.characters.length} caras`);
