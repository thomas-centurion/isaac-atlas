/**
 * Seeds de The Binding of Isaac: 8 caracteres, alfabeto de 32 símbolos
 * (A-Z sin I, O, U + 0-9 sin 5). El juego reemplaza I→1, O→0, U→V al tipear.
 *
 * TODO: el último carácter(es) llevan un checksum que todavía no verificamos
 * (no hay documentación pública; se puede deducir con seeds reales o con
 * Seeds.String2Seed del LuaDocs). Hasta entonces solo validamos formato.
 */
export const SEED_ALPHABET = 'ABCDEFGHJKLMNPQRSTVWXYZ012346789';
export const SEED_LENGTH = 8;

const SUBSTITUTIONS: Record<string, string> = { I: '1', O: '0', U: 'V' };

/** Quita espacios/guiones, pasa a mayúsculas y aplica las sustituciones del juego. */
export function normalizeSeed(input: string): string {
  return input
    .toUpperCase()
    .replace(/[\s-]/g, '')
    .replace(/[IOU]/g, (c) => SUBSTITUTIONS[c] ?? c);
}

export function isValidSeedFormat(input: string): boolean {
  const seed = normalizeSeed(input);
  return seed.length === SEED_LENGTH && [...seed].every((c) => SEED_ALPHABET.includes(c));
}

/** "ABCD1234" → "ABCD 1234" */
export function formatSeed(input: string): string {
  const seed = normalizeSeed(input);
  return `${seed.slice(0, 4)} ${seed.slice(4)}`;
}
