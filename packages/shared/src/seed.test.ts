import { describe, expect, it } from 'vitest';
import { SEED_ALPHABET, formatSeed, isValidSeedFormat, normalizeSeed } from './seed';

describe('seed', () => {
  it('el alfabeto tiene 32 símbolos únicos sin I, O, U ni 5', () => {
    expect(SEED_ALPHABET).toHaveLength(32);
    expect(new Set(SEED_ALPHABET).size).toBe(32);
    for (const c of 'IOU5') expect(SEED_ALPHABET).not.toContain(c);
  });

  it('normaliza espacios, minúsculas y sustituciones del juego', () => {
    expect(normalizeSeed('abcd efgh')).toBe('ABCDEFGH');
    expect(normalizeSeed('AB-CD 1O1U')).toBe('ABCD101V');
  });

  it('valida el formato', () => {
    expect(isValidSeedFormat('ABCD 1234')).toBe(true);
    expect(isValidSeedFormat('ABCD 5234')).toBe(false);
    expect(isValidSeedFormat('ABCD123')).toBe(false);
    expect(isValidSeedFormat('')).toBe(false);
  });

  it('formatea con espacio al medio', () => {
    expect(formatSeed('abcd1234')).toBe('ABCD 1234');
  });
});
