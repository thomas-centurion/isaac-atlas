import { describe, expect, it } from 'vitest';
import { normalize, searchCatalog } from './itemSearch';

const names = (q: string, kind: 'item' | 'trinket' = 'item') =>
  searchCatalog(q, kind).map((r) => r.entry.name.en);

describe('normalize', () => {
  it('quita tildes, signos y mayúsculas', () => {
    expect(normalize("Cricket's  Head")).toBe('crickets head');
    expect(normalize('Araña Mutante')).toBe('arana mutante');
  });
});

describe('searchCatalog', () => {
  it('encuentra por nombre en inglés y en español', () => {
    expect(names('mutant spider')[0]).toBe('Mutant Spider');
    expect(names('araña mutante')[0]).toBe('Mutant Spider');
    expect(names('arana mut')[0]).toBe('Mutant Spider');
  });

  it('encuentra con las palabras en otro orden', () => {
    expect(names('spider mutant')).toContain('Mutant Spider');
  });

  it('prioriza nombre exacto y prefijos sobre coincidencias parciales', () => {
    const results = names('sad onion');
    expect(results[0]).toBe('The Sad Onion');
  });

  it('ignora el artículo inicial: "d6" devuelve The D6 antes que Eternal D6', () => {
    const results = names('d6');
    expect(results[0]).toBe('The D6');
    expect(results).toContain('Eternal D6');
  });

  it('encuentra por ID numérico', () => {
    expect(searchCatalog('153', 'item')[0]?.id).toBe(153);
  });

  it('busca trinkets por separado', () => {
    expect(names('swallowed', 'trinket')).toContain('Swallowed Penny');
    expect(names('swallowed penny', 'trinket')[0]).toBe('Swallowed Penny');
    expect(names('swallowed', 'item')).not.toContain('Swallowed Penny');
  });

  it('devuelve vacío sin consulta o sin coincidencias', () => {
    expect(searchCatalog('', 'item')).toEqual([]);
    expect(searchCatalog('zzzzzzzz', 'item')).toEqual([]);
  });

  it('respeta el límite', () => {
    expect(searchCatalog('a', 'item', 5).length).toBeLessThanOrEqual(5);
  });
});
