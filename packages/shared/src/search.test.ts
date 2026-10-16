import { describe, expect, it } from 'vitest';
import {
  EMPTY_FILTERS,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  runSearchSchema,
  type SearchFilters,
} from './search';

describe('runSearchSchema', () => {
  it('parsea listas de IDs separadas por coma y aplica defaults', () => {
    const q = runSearchSchema.parse({ startItems: '153,105', exclude: '3' });
    expect(q.startItems).toEqual([153, 105]);
    expect(q.exclude).toEqual([3]);
    expect(q.items).toEqual([]);
    expect(q.limit).toBe(20);
  });

  it('normaliza la seed y convierte fullUnlocks a boolean', () => {
    const q = runSearchSchema.parse({ seed: 'abcd 1234', fullUnlocks: 'false', character: '2' });
    expect(q.seed).toBe('ABCD1234');
    expect(q.fullUnlocks).toBe(false);
    expect(q.character).toBe(2);
  });

  it('rechaza valores inválidos', () => {
    for (const bad of [
      { startItems: 'abc' },
      { items: '1,2,3,4,5,6,7,8,9,10,11' },
      { seed: 'ABCD 5234' },
      { limit: '1000' },
      { difficulty: 'impossible' },
      { items: ['1', '2'] },
    ]) {
      expect(runSearchSchema.safeParse(bad).success).toBe(false);
    }
  });
});

describe('filtros ⇄ URL', () => {
  const filters: SearchFilters = {
    character: 0,
    difficulty: 'hard',
    fullUnlocks: true,
    startItems: [153],
    items: [105, 3],
    exclude: [],
    verdict: 'op',
    sort: 'top',
  };

  it('ida y vuelta sin pérdida (incluido character=0)', () => {
    expect(filtersFromParams(filtersToParams(filters))).toEqual(filters);
  });

  it('una URL inválida da filtros vacíos', () => {
    expect(filtersFromParams(new URLSearchParams('startItems=zzz'))).toEqual(EMPTY_FILTERS);
  });

  it('el orden por defecto (hot) no viaja en la URL, los demás sí', () => {
    expect(filtersToParams(EMPTY_FILTERS).toString()).toBe('');
    expect(filtersToParams({ ...EMPTY_FILTERS, sort: 'new' }).get('sort')).toBe('new');
    expect(filtersFromParams(new URLSearchParams('sort=top')).sort).toBe('top');
    expect(filtersFromParams(new URLSearchParams()).sort).toBe('hot');
  });

  it('cambiar solo el orden no cuenta como filtro activo', () => {
    expect(hasActiveFilters({ ...EMPTY_FILTERS, sort: 'top' })).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, verdict: 'troll' })).toBe(true);
  });

  it('detecta si hay filtros activos', () => {
    expect(hasActiveFilters(EMPTY_FILTERS)).toBe(false);
    expect(hasActiveFilters({ ...EMPTY_FILTERS, character: 0 })).toBe(true);
  });
});
