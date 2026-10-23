import { describe, expect, it } from 'vitest';
import { runInputSchema, startItemIds, type RunDraftInput } from './runs';

const valid: RunDraftInput = {
  seed: 'abcd 1234',
  gameVersion: 'rep+',
  characterId: 0,
  difficulty: 'normal',
  fullUnlocks: true,
  items: [
    { itemId: 153, floor: 1, source: 'treasure' },
    { itemId: 105, floor: 2, source: 'shop' },
  ],
  trinkets: [{ trinketId: 1, floor: 1 }],
  outcome: { result: 'win', lastFloor: 11, finalBoss: 'the-lamb' },
  notes: '  nice run  ',
};

describe('runInputSchema', () => {
  it('normaliza la seed y recorta las notas', () => {
    const run = runInputSchema.parse(valid);
    expect(run.seed).toBe('ABCD1234');
    expect(run.notes).toBe('nice run');
  });

  it('no admite tesoro ni tienda desde el Útero (piso 7), pero sí antes', () => {
    const at = (floor: number, source: 'treasure' | 'shop' | 'devil') =>
      runInputSchema.safeParse({ ...valid, items: [{ itemId: 153, floor, source }] }).success;
    expect(at(6, 'treasure')).toBe(true);
    expect(at(6, 'shop')).toBe(true);
    expect(at(7, 'treasure')).toBe(false);
    expect(at(8, 'shop')).toBe(false);
    // Otros orígenes no cambian.
    expect(at(8, 'devil')).toBe(true);
  });

  it('rechaza seeds, personajes e ítems desconocidos', () => {
    expect(runInputSchema.safeParse({ ...valid, seed: 'ABCD 5234' }).success).toBe(false);
    expect(runInputSchema.safeParse({ ...valid, characterId: 999 }).success).toBe(false);
    expect(
      runInputSchema.safeParse({ ...valid, items: [{ itemId: 99999, floor: 1, source: 'other' }] })
        .success,
    ).toBe(false);
  });

  it('exige al menos un ítem y pisos entre 1 y 13', () => {
    expect(runInputSchema.safeParse({ ...valid, items: [] }).success).toBe(false);
    expect(
      runInputSchema.safeParse({ ...valid, items: [{ itemId: 153, floor: 14, source: 'other' }] })
        .success,
    ).toBe(false);
  });
});

describe('startItemIds', () => {
  it('devuelve los ítems del primer piso sin repetir', () => {
    const items = [
      { itemId: 153, floor: 1, source: 'treasure' as const },
      { itemId: 153, floor: 1, source: 'boss' as const },
      { itemId: 105, floor: 2, source: 'shop' as const },
    ];
    expect(startItemIds(items)).toEqual([153]);
  });
});
