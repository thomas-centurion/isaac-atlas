import { describe, expect, it } from 'vitest';
import type { Run } from '@isaac-atlas/shared';
import { mapRunInCache, toggleVerdict, toggleVote, withVerdict, withVote } from './reactions';

const makeRun = (over: Partial<Run> = {}): Run => ({
  id: 'r1',
  seed: 'ABCD1234',
  gameVersion: 'rep+',
  characterId: 0,
  difficulty: 'normal',
  fullUnlocks: true,
  items: [{ itemId: 153, floor: 1, source: 'other' }],
  trinkets: [],
  startItems: [153],
  outcome: { result: 'death' },
  notes: '',
  author: { id: 'a1', username: 'Alice' },
  createdAt: '2026-01-01T00:00:00.000Z',
  stats: { up: 2, down: 1, op: 0, troll: 0, hard: 0 },
  ...over,
});

describe('withVote', () => {
  it('suma un voto a favor y registra el voto del usuario', () => {
    const run = withVote(makeRun(), 1);
    expect(run.stats).toMatchObject({ up: 3, down: 1 });
    expect(run.viewer?.vote).toBe(1);
  });

  it('cambiar de a favor a en contra mueve el contador', () => {
    const voted = withVote(makeRun(), 1);
    const flipped = withVote(voted, -1);
    expect(flipped.stats).toMatchObject({ up: 2, down: 2 });
  });

  it('quitar el voto vuelve al estado original', () => {
    const run = makeRun();
    const back = withVote(withVote(run, -1), 0);
    expect(back.stats).toEqual(run.stats);
    expect(back.viewer?.vote).toBe(0);
  });

  it('no cambia nada si el voto es el mismo', () => {
    const voted = withVote(makeRun(), 1);
    expect(withVote(voted, 1)).toBe(voted);
  });
});

describe('withVerdict', () => {
  it('elegir otro veredicto mueve el contador del anterior al nuevo', () => {
    const op = withVerdict(makeRun(), 'op');
    expect(op.stats).toMatchObject({ op: 1, troll: 0 });
    const troll = withVerdict(op, 'troll');
    expect(troll.stats).toMatchObject({ op: 0, troll: 1 });
    expect(troll.viewer?.verdict).toBe('troll');
  });

  it('quitarlo resta y conserva el voto', () => {
    const run = withVerdict(withVote(makeRun(), 1), 'hard');
    const cleared = withVerdict(run, null);
    expect(cleared.stats.hard).toBe(0);
    expect(cleared.viewer).toEqual({ vote: 1, verdict: null });
  });
});

describe('toggle', () => {
  it('un segundo clic sobre el mismo botón lo desactiva', () => {
    expect(toggleVote(0, 1)).toBe(1);
    expect(toggleVote(1, 1)).toBe(0);
    expect(toggleVote(1, -1)).toBe(-1);
    expect(toggleVerdict(null, 'op')).toBe('op');
    expect(toggleVerdict('op', 'op')).toBeNull();
    expect(toggleVerdict('op', 'troll')).toBe('troll');
  });
});

describe('mapRunInCache', () => {
  const bump = (r: Run) => ({ ...r, notes: 'tocada' });
  const a = makeRun({ id: 'a' });
  const b = makeRun({ id: 'b' });

  it('actualiza solo la run indicada en cada forma de caché', () => {
    // una run suelta, una lista, páginas infinitas, resumen de seed y seed del día
    expect((mapRunInCache(a, 'a', bump) as Run).notes).toBe('tocada');
    expect((mapRunInCache(b, 'a', bump) as Run).notes).toBe('');

    const list = mapRunInCache([a, b], 'b', bump) as Run[];
    expect(list.map((r) => r.notes)).toEqual(['', 'tocada']);

    const infinite = mapRunInCache(
      {
        pages: [
          { runs: [a], nextCursor: 'x' },
          { runs: [b], nextCursor: null },
        ],
        pageParams: [],
      },
      'b',
      bump,
    ) as { pages: { runs: Run[]; nextCursor: string | null }[] };
    expect(infinite.pages[1]?.runs[0]?.notes).toBe('tocada');
    expect(infinite.pages[0]?.runs[0]?.notes).toBe('');
    expect(infinite.pages[0]?.nextCursor).toBe('x');

    const summary = mapRunInCache({ seed: 'ABCD1234', runs: [a, b] }, 'a', bump) as { runs: Run[] };
    expect(summary.runs[0]?.notes).toBe('tocada');

    const daily = mapRunInCache({ date: '2026-01-01', run: a }, 'a', bump) as { run: Run };
    expect(daily.run.notes).toBe('tocada');
  });

  it('deja intactos datos que no son runs (null, strings, daily sin run)', () => {
    expect(mapRunInCache(undefined, 'a', bump)).toBeUndefined();
    expect(mapRunInCache({ date: 'x', run: null }, 'a', bump)).toEqual({ date: 'x', run: null });
  });
});
