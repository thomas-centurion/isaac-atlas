import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInputSchema } from '@isaac-atlas/shared';
import { EMPTY_DRAFT, draftReducer, draftToInput, loadDraft, type Draft } from './draft';

const KEY = 'isaac-atlas:run-draft:v1';

// Vitest corre en node: simulamos localStorage con un Map.
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: Storage }).localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => void store.set(k, v),
    removeItem: (k) => void store.delete(k),
  } as Storage;
});
afterEach(() => {
  delete (globalThis as { localStorage?: Storage }).localStorage;
});

const reduce = (state: Draft, ...actions: Parameters<typeof draftReducer>[1][]) =>
  actions.reduce(draftReducer, state);

describe('draftReducer', () => {
  it('agrega ítems al piso actual y permite cambiar de piso', () => {
    const s = reduce(
      EMPTY_DRAFT,
      { type: 'addItem', itemId: 153 },
      { type: 'changeFloor', delta: 1 },
      { type: 'addItem', itemId: 105 },
    );
    expect(s.items.map((i) => [i.itemId, i.floor])).toEqual([
      [153, 1],
      [105, 2],
    ]);
  });

  it('limita el piso entre 1 y 13', () => {
    const down = reduce(EMPTY_DRAFT, { type: 'changeFloor', delta: -1 });
    expect(down.floor).toBe(1);
    let s = EMPTY_DRAFT;
    for (let i = 0; i < 20; i++) s = reduce(s, { type: 'changeFloor', delta: 1 });
    expect(s.floor).toBe(13);
  });

  it('quita ítems y cambia su origen', () => {
    const s = reduce(
      EMPTY_DRAFT,
      { type: 'addItem', itemId: 153 },
      { type: 'addItem', itemId: 105 },
      { type: 'setItemSource', index: 1, source: 'shop' },
      { type: 'removeItem', index: 0 },
    );
    expect(s.items).toEqual([{ itemId: 105, floor: 1, source: 'shop' }]);
  });
});

describe('draftToInput', () => {
  it('genera un payload que pasa la validación compartida', () => {
    const draft: Draft = {
      ...EMPTY_DRAFT,
      seed: 'abcd 1234',
      characterId: 0,
      items: [{ itemId: 153, floor: 1, source: 'treasure' }],
      result: 'win',
      finalBoss: 'the-lamb',
    };
    const parsed = runInputSchema.safeParse(draftToInput(draft));
    expect(parsed.success).toBe(true);
  });

  it('un borrador sin personaje no valida', () => {
    expect(runInputSchema.safeParse(draftToInput(EMPTY_DRAFT)).success).toBe(false);
  });
});

describe('loadDraft', () => {
  it('devuelve el borrador vacío si no hay nada guardado o está corrupto', () => {
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
    store.set(KEY, '{not json');
    expect(loadDraft()).toEqual(EMPTY_DRAFT);
  });

  it('recupera lo válido y descarta ítems desconocidos o campos rotos', () => {
    store.set(
      KEY,
      JSON.stringify({
        seed: 'ABCD1234',
        characterId: 2,
        difficulty: 'nope',
        items: [
          { itemId: 153, floor: 2, source: 'shop' },
          { itemId: 99999, floor: 1, source: 'other' },
          'garbage',
        ],
        trinkets: [{ trinketId: 1, floor: 1 }],
      }),
    );
    const d = loadDraft();
    expect(d.seed).toBe('ABCD1234');
    expect(d.characterId).toBe(2);
    expect(d.difficulty).toBe('normal');
    expect(d.items).toEqual([{ itemId: 153, floor: 2, source: 'shop' }]);
    expect(d.trinkets).toHaveLength(1);
  });
});
