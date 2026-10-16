import type { Run, VerdictKind } from '@isaac-atlas/shared';

export type VoteChoice = 1 | -1 | 0;

/** Estado de la run después de que el usuario vote (0 = quitar el voto). Función pura: sirve para el optimismo. */
export function withVote(run: Run, next: VoteChoice): Run {
  const prev = run.viewer?.vote ?? 0;
  if (prev === next) return run;
  return {
    ...run,
    stats: {
      ...run.stats,
      up: run.stats.up + (next === 1 ? 1 : 0) - (prev === 1 ? 1 : 0),
      down: run.stats.down + (next === -1 ? 1 : 0) - (prev === -1 ? 1 : 0),
    },
    viewer: { vote: next, verdict: run.viewer?.verdict ?? null },
  };
}

/** Igual para el veredicto (null = quitarlo). Hay uno por usuario: elegir otro mueve el contador. */
export function withVerdict(run: Run, next: VerdictKind | null): Run {
  const prev = run.viewer?.verdict ?? null;
  if (prev === next) return run;
  const stats = { ...run.stats };
  if (prev) stats[prev] -= 1;
  if (next) stats[next] += 1;
  return { ...run, stats, viewer: { vote: run.viewer?.vote ?? 0, verdict: next } };
}

/** Clic en un botón ya activo lo desactiva. */
export const toggleVote = (current: VoteChoice, clicked: 1 | -1): VoteChoice =>
  current === clicked ? 0 : clicked;

export const toggleVerdict = (current: VerdictKind | null, clicked: VerdictKind) =>
  current === clicked ? null : clicked;

type Mapper = (run: Run) => Run;

const isRun = (value: unknown): value is Run =>
  typeof value === 'object' &&
  value !== null &&
  'stats' in value &&
  'seed' in value &&
  'author' in value;

/**
 * Recorre el contenido de las cachés de TanStack Query (una run, listas, páginas infinitas,
 * el resumen de una seed, la seed del día) y aplica `fn` a la run con ese id.
 */
export function mapRunInCache(data: unknown, runId: string, fn: Mapper): unknown {
  if (Array.isArray(data)) return data.map((item) => mapRunInCache(item, runId, fn));
  if (isRun(data)) return data.id === runId ? fn(data) : data;
  if (typeof data !== 'object' || data === null) return data;

  const record = data as Record<string, unknown>;
  const next: Record<string, unknown> = { ...record };
  for (const key of ['pages', 'runs', 'run']) {
    if (key in record) next[key] = mapRunInCache(record[key], runId, fn);
  }
  return next;
}
