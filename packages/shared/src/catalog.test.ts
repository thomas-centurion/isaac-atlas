import { describe, expect, it } from 'vitest';
import { SPRITE_CELL, catalogSchema, spritePosition } from './catalog';
import raw from './data/catalog.json';

describe('catalog', () => {
  const catalog = catalogSchema.parse(raw);

  it('tiene ids únicos y sprites únicos', () => {
    const itemIds = new Set(catalog.items.map((i) => i.id));
    const trinketIds = new Set(catalog.trinkets.map((t) => t.id));
    expect(itemIds.size).toBe(catalog.items.length);
    expect(trinketIds.size).toBe(catalog.trinkets.length);
    const sprites = [...catalog.items, ...catalog.trinkets].map((x) => x.sprite);
    expect(new Set(sprites).size).toBe(sprites.length);
  });

  it('contiene ítems conocidos', () => {
    expect(catalog.items.find((i) => i.id === 153)?.name.en).toBe('Mutant Spider');
    expect(catalog.items.find((i) => i.id === 153)?.pools).toContain('treasure');
    expect(catalog.trinkets.find((t) => t.id === 1)?.name.en).toBe('Swallowed Penny');
  });

  it('calcula la posición de sprites en el sheet', () => {
    expect(spritePosition(0)).toEqual({ x: 0, y: 0 });
    expect(spritePosition(33)).toEqual({ x: SPRITE_CELL, y: SPRITE_CELL });
  });
});
