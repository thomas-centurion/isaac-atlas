import { useCallback, useEffect, useReducer } from 'react';
import {
  FLOOR_MAX,
  FLOOR_MIN,
  difficultySchema,
  finalBossSchema,
  floorSchema,
  getItem,
  getTrinket,
  itemSourceSchema,
  formatSeed,
  runResultSchema,
  startingKit,
  type Difficulty,
  type ItemSource,
  type RunDraftInput,
  type RunItem,
  type RunResult,
  type Run,
  type RunTrinket,
} from '@isaac-atlas/shared';
import { z } from 'zod';

export interface Draft {
  seed: string;
  characterId: number | null;
  difficulty: Difficulty;
  fullUnlocks: boolean;
  /** Piso actual: los ítems que se agregan quedan asignados a este piso. */
  floor: number;
  items: RunItem[];
  trinkets: RunTrinket[];
  result: RunResult;
  lastFloor: number | null;
  finalBoss: string | null;
  notes: string;
}

export const EMPTY_DRAFT: Draft = {
  seed: '',
  characterId: null,
  difficulty: 'normal',
  fullUnlocks: true,
  floor: FLOOR_MIN,
  items: [],
  trinkets: [],
  result: 'death',
  lastFloor: null,
  finalBoss: null,
  notes: '',
};

export type DraftAction =
  | { type: 'set'; patch: Partial<Draft> }
  | { type: 'addItem'; itemId: number }
  | { type: 'removeItem'; index: number }
  | { type: 'setItemSource'; index: number; source: ItemSource }
  | { type: 'addTrinket'; trinketId: number }
  | { type: 'removeTrinket'; index: number }
  | { type: 'setCharacter'; characterId: number | null }
  | { type: 'setFullUnlocks'; value: boolean }
  | { type: 'changeFloor'; delta: 1 | -1 }
  | { type: 'reset' };

/**
 * Cambia personaje y/o desbloqueos y recalcula los ítems iniciales: quita los que se autocompletaron
 * antes (source 'innate', y los trinkets del piso 1 del kit anterior) y agrega los del kit nuevo.
 * Lo que el usuario cargó a mano no se toca.
 */
function withStartingKit(state: Draft, characterId: number | null, fullUnlocks: boolean): Draft {
  const previous =
    state.characterId === null
      ? { items: [], trinkets: [] }
      : startingKit(state.characterId, state.fullUnlocks);
  const next =
    characterId === null ? { items: [], trinkets: [] } : startingKit(characterId, fullUnlocks);

  const items = state.items.filter((i) => i.source !== 'innate');
  const trinkets = state.trinkets.filter(
    (t) => !(t.floor === FLOOR_MIN && previous.trinkets.includes(t.trinketId)),
  );
  const haveItems = new Set(items.map((i) => i.itemId));
  const haveTrinkets = new Set(trinkets.map((t) => t.trinketId));

  return {
    ...state,
    characterId,
    fullUnlocks,
    items: [
      ...next.items
        .filter((id) => !haveItems.has(id))
        .map((itemId) => ({ itemId, floor: FLOOR_MIN, source: 'innate' as const })),
      ...items,
    ],
    trinkets: [
      ...next.trinkets
        .filter((id) => !haveTrinkets.has(id))
        .map((trinketId) => ({ trinketId, floor: FLOOR_MIN })),
      ...trinkets,
    ],
  };
}

export function draftReducer(state: Draft, action: DraftAction): Draft {
  switch (action.type) {
    case 'set':
      return { ...state, ...action.patch };
    case 'addItem':
      return {
        ...state,
        items: [...state.items, { itemId: action.itemId, floor: state.floor, source: 'other' }],
      };
    case 'removeItem':
      return { ...state, items: state.items.filter((_, i) => i !== action.index) };
    case 'setItemSource':
      return {
        ...state,
        items: state.items.map((it, i) =>
          i === action.index ? { ...it, source: action.source } : it,
        ),
      };
    case 'addTrinket':
      return {
        ...state,
        trinkets: [...state.trinkets, { trinketId: action.trinketId, floor: state.floor }],
      };
    case 'removeTrinket':
      return { ...state, trinkets: state.trinkets.filter((_, i) => i !== action.index) };
    case 'setCharacter':
      return withStartingKit(state, action.characterId, state.fullUnlocks);
    case 'setFullUnlocks':
      return withStartingKit(state, state.characterId, action.value);
    case 'changeFloor':
      return {
        ...state,
        floor: Math.min(FLOOR_MAX, Math.max(FLOOR_MIN, state.floor + action.delta)),
      };
    case 'reset':
      return EMPTY_DRAFT;
  }
}

/** Convierte el borrador al payload de la API (la validación final la hace runInputSchema). */
export function draftToInput(draft: Draft): RunDraftInput {
  return {
    seed: draft.seed,
    gameVersion: 'rep+',
    characterId: draft.characterId ?? -1,
    difficulty: draft.difficulty,
    fullUnlocks: draft.fullUnlocks,
    items: draft.items,
    trinkets: draft.trinkets,
    outcome: {
      result: draft.result,
      ...(draft.lastFloor ? { lastFloor: draft.lastFloor } : {}),
      ...(draft.finalBoss && finalBossSchema.safeParse(draft.finalBoss).success
        ? { finalBoss: finalBossSchema.parse(draft.finalBoss) }
        : {}),
    },
    notes: draft.notes,
  };
}

// --- persistencia: la web queda abierta de fondo, el borrador no se puede perder ---

const STORAGE_KEY = 'isaac-atlas:run-draft:v1';

const storedItemSchema = z.object({
  itemId: z.number(),
  floor: floorSchema,
  source: itemSourceSchema,
});
const storedTrinketSchema = z.object({ trinketId: z.number(), floor: floorSchema });

// `.catch` en cada campo: un borrador viejo o corrupto se recupera parcialmente en vez de fallar.
const storedSchema = z.object({
  seed: z.string().catch(EMPTY_DRAFT.seed),
  characterId: z.number().int().nullable().catch(null),
  difficulty: difficultySchema.catch(EMPTY_DRAFT.difficulty),
  fullUnlocks: z.boolean().catch(EMPTY_DRAFT.fullUnlocks),
  floor: floorSchema.catch(FLOOR_MIN),
  // Entradas inválidas (o ítems que ya no existen en el catálogo) se descartan una por una.
  items: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list.flatMap((x) => {
        const r = storedItemSchema.safeParse(x);
        return r.success && getItem(r.data.itemId) ? [r.data] : [];
      }),
    ),
  trinkets: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list.flatMap((x) => {
        const r = storedTrinketSchema.safeParse(x);
        return r.success && getTrinket(r.data.trinketId) ? [r.data] : [];
      }),
    ),
  result: runResultSchema.catch(EMPTY_DRAFT.result),
  lastFloor: floorSchema.nullable().catch(null),
  finalBoss: z.string().nullable().catch(null),
  notes: z.string().catch(''),
});

export function loadDraft(): Draft {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_DRAFT;
    return storedSchema.parse(JSON.parse(raw));
  } catch {
    return EMPTY_DRAFT;
  }
}

/** Borrador a partir de una run publicada (para editarla). */
export function runToDraft(run: Run): Draft {
  return {
    seed: formatSeed(run.seed),
    characterId: run.characterId,
    difficulty: run.difficulty,
    fullUnlocks: run.fullUnlocks,
    // El piso actual arranca en el último donde hay algo cargado: lo nuevo suele ser lo siguiente.
    floor: Math.max(
      FLOOR_MIN,
      ...run.items.map((i) => i.floor),
      ...run.trinkets.map((t) => t.floor),
    ),
    items: run.items,
    trinkets: run.trinkets,
    result: run.outcome.result,
    lastFloor: run.outcome.lastFloor ?? null,
    finalBoss: run.outcome.finalBoss ?? null,
    notes: run.notes,
  };
}

export function isDraftEmpty(draft: Draft): boolean {
  return (
    !draft.seed &&
    draft.characterId === null &&
    draft.items.length === 0 &&
    draft.trinkets.length === 0 &&
    !draft.notes
  );
}

export function useRunDraft() {
  const [draft, dispatch] = useReducer(draftReducer, undefined, loadDraft);

  useEffect(() => {
    try {
      if (isDraftEmpty(draft)) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
    } catch {
      // Sin almacenamiento (modo privado, cuota): el formulario sigue funcionando.
    }
  }, [draft]);

  /**
   * Vacía el borrador y su copia guardada. Borra el almacenamiento de forma explícita porque, si
   * después de guardar la run se navega a otra página en el mismo render, el efecto de arriba no
   * llega a correr y el borrador viejo reaparecería al volver a "Nueva run".
   */
  const clear = useCallback(() => {
    clearStoredDraft();
    dispatch({ type: 'reset' });
  }, []);

  return [draft, dispatch, clear] as const;
}

export function clearStoredDraft() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignorar
  }
}
