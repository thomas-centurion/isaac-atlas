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
  runResultSchema,
  type Difficulty,
  type ItemSource,
  type RunDraftInput,
  type RunItem,
  type RunResult,
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
  | { type: 'changeFloor'; delta: 1 | -1 }
  | { type: 'reset' };

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
