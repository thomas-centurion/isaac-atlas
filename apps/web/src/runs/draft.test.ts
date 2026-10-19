import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { runInputSchema, type Run } from '@isaac-atlas/shared';
import {
  EMPTY_DRAFT,
  draftReducer,
  draftToInput,
  loadDraft,
  runToDraft,
  type Draft,
} from './draft';

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

describe('ítems iniciales del personaje', () => {
  const itemsOf = (d: Draft) => d.items.map((i) => [i.itemId, i.source]);

  it('al elegir personaje se agregan sus ítems iniciales en el piso 1', () => {
    const s = reduce(EMPTY_DRAFT, { type: 'setCharacter', characterId: 0 });
    expect(s.items).toEqual([{ itemId: 105, floor: 1, source: 'innate' }]);
    expect(s.characterId).toBe(0);
  });

  it('sin todo desbloqueado no se asume lo que depende de un logro (D6 de Isaac)', () => {
    const s = reduce(
      EMPTY_DRAFT,
      { type: 'setFullUnlocks', value: false },
      { type: 'setCharacter', characterId: 0 },
    );
    expect(s.items).toEqual([]);
    // ...pero sí lo que no depende de logros (Yum Heart de Magdalene)
    expect(itemsOf(reduce(s, { type: 'setCharacter', characterId: 1 }))).toEqual([[45, 'innate']]);
  });

  it('marcar "todo desbloqueado" después agrega lo que faltaba', () => {
    const s = reduce(
      EMPTY_DRAFT,
      { type: 'setFullUnlocks', value: false },
      { type: 'setCharacter', characterId: 0 },
      { type: 'setFullUnlocks', value: true },
    );
    expect(itemsOf(s)).toEqual([[105, 'innate']]);
  });

  it('cambiar de personaje reemplaza los iniciales y respeta lo cargado a mano', () => {
    const s = reduce(
      EMPTY_DRAFT,
      { type: 'setCharacter', characterId: 0 },
      { type: 'addItem', itemId: 153 },
      { type: 'setCharacter', characterId: 3 },
    );
    expect(itemsOf(s)).toEqual([
      [34, 'innate'],
      [153, 'other'],
    ]);
  });

  it('volver a "sin personaje" quita los iniciales', () => {
    const s = reduce(
      EMPTY_DRAFT,
      { type: 'setCharacter', characterId: 1 },
      { type: 'setCharacter', characterId: null },
    );
    expect(s.items).toEqual([]);
  });

  it('no duplica un ítem que ya se cargó a mano', () => {
    const s = reduce(
      EMPTY_DRAFT,
      { type: 'addItem', itemId: 105 },
      { type: 'setCharacter', characterId: 0 },
    );
    expect(itemsOf(s)).toEqual([[105, 'other']]);
  });

  it('también maneja los trinkets iniciales (Cain) y los quita al cambiar', () => {
    const cain = reduce(EMPTY_DRAFT, { type: 'setCharacter', characterId: 2 });
    expect(cain.trinkets).toEqual([{ trinketId: 19, floor: 1 }]);
    const isaac = reduce(cain, { type: 'setCharacter', characterId: 0 });
    expect(isaac.trinkets).toEqual([]);
  });

  it('personajes sin ítems iniciales (Eden) no agregan nada', () => {
    expect(reduce(EMPTY_DRAFT, { type: 'setCharacter', characterId: 9 }).items).toEqual([]);
  });

  it('el borrador con ítems iniciales pasa la validación compartida', () => {
    const s = reduce(
      { ...EMPTY_DRAFT, seed: 'ABCD1234' },
      { type: 'setCharacter', characterId: 0 },
    );
    expect(runInputSchema.safeParse(draftToInput(s)).success).toBe(true);
  });
});

describe('runToDraft', () => {
  const run: Run = {
    id: 'r1',
    seed: 'ABCD1234',
    gameVersion: 'rep+',
    characterId: 2,
    difficulty: 'hard',
    fullUnlocks: false,
    items: [
      { itemId: 153, floor: 1, source: 'treasure' },
      { itemId: 105, floor: 4, source: 'shop' },
    ],
    trinkets: [{ trinketId: 1, floor: 2 }],
    startItems: [153],
    outcome: { result: 'win', lastFloor: 11, finalBoss: 'the-lamb' },
    notes: 'nota',
    author: { id: 'a', username: 'Alice' },
    createdAt: '2026-01-01T00:00:00.000Z',
    stats: { up: 0, down: 0, op: 0, troll: 0, hard: 0 },
  };

  it('convierte una run publicada en un borrador editable', () => {
    const d = runToDraft(run);
    expect(d).toMatchObject({
      seed: 'ABCD 1234',
      characterId: 2,
      difficulty: 'hard',
      fullUnlocks: false,
      floor: 4,
      result: 'win',
      lastFloor: 11,
      finalBoss: 'the-lamb',
      notes: 'nota',
    });
    expect(d.items).toHaveLength(2);
  });

  it('ida y vuelta: el borrador genera el mismo contenido que la run', () => {
    const parsed = runInputSchema.parse(draftToInput(runToDraft(run)));
    expect(parsed.seed).toBe('ABCD1234');
    expect(parsed.items).toEqual(run.items);
    expect(parsed.trinkets).toEqual(run.trinkets);
    expect(parsed.outcome).toEqual(run.outcome);
  });

  it('editar no vuelve a autocompletar ítems iniciales por sí solo', () => {
    // Las runs publicadas ya traen sus ítems: cambiar notas no toca el inventario.
    const d = draftReducer(runToDraft(run), { type: 'set', patch: { notes: 'otra' } });
    expect(d.items).toEqual(run.items);
  });
});
