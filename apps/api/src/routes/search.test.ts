import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runSearchResponseSchema, seedSummarySchema, startItemIds } from '@isaac-atlas/shared';
import { createApp } from '../app.js';
import { Run, type RunAttrs } from '../models/Run.js';
import { User } from '../models/User.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

// IDs reales del catálogo
const MUTANT_SPIDER = 153;
const D6 = 105;
const SPOON_BENDER = 3;
const SAD_ONION = 1;

let app: ReturnType<typeof createApp>;
let author: InstanceType<typeof User>;
let clock = Date.UTC(2026, 0, 1);

beforeAll(async () => {
  app = createApp({ sessionStore: await connectTestDb() });
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await resetTestDb();
  const [alice] = await User.create([
    { username: 'Alice', usernameLower: 'alice', emailVerified: false },
  ]);
  author = alice!;
  clock = Date.UTC(2026, 0, 1);
});

interface Spec {
  seed?: string;
  characterId?: number;
  difficulty?: RunAttrs['difficulty'];
  fullUnlocks?: boolean;
  /** [itemId, floor] */
  items?: [number, number][];
  result?: RunAttrs['outcome']['result'];
  createdAt?: Date;
}

async function makeRun(spec: Spec = {}) {
  const items = (spec.items ?? [[MUTANT_SPIDER, 1]]).map(([itemId, floor]) => ({
    itemId,
    floor,
    source: 'other' as const,
  }));
  // Cada run sale 1s después de la anterior salvo que se indique: orden predecible.
  clock += 1000;
  return Run.create({
    seed: spec.seed ?? 'ABCD1234',
    gameVersion: 'rep+',
    characterId: spec.characterId ?? 0,
    difficulty: spec.difficulty ?? 'normal',
    fullUnlocks: spec.fullUnlocks ?? true,
    items,
    trinkets: [],
    startItems: startItemIds(items),
    outcome: { result: spec.result ?? 'death' },
    notes: '',
    author: author._id,
    createdAt: spec.createdAt ?? new Date(clock),
  });
}

async function search(query: Record<string, string | number> = {}) {
  const res = await request(app).get('/api/runs').query(query);
  expect(res.status).toBe(200);
  return runSearchResponseSchema.parse(res.body);
}

const seedsOf = (r: { runs: { seed: string }[] }) => r.runs.map((x) => x.seed);

describe('GET /api/runs — filtros', () => {
  it('es público y devuelve primero las más nuevas', async () => {
    await makeRun({ seed: 'AAAA1111' });
    await makeRun({ seed: 'BBBB2222' });
    const { runs, nextCursor } = await search();
    expect(runs.map((r) => r.seed)).toEqual(['BBBB2222', 'AAAA1111']);
    expect(runs[0]?.author.username).toBe('Alice');
    expect(nextCursor).toBeNull();
  });

  it('filtra por personaje, dificultad, resultado y unlocks', async () => {
    await makeRun({ seed: 'AAAA1111', characterId: 0 });
    await makeRun({ seed: 'BBBB2222', characterId: 2, difficulty: 'hard' });
    await makeRun({ seed: 'CCCC3333', characterId: 2, result: 'win', fullUnlocks: false });

    expect(seedsOf(await search({ character: 0 }))).toEqual(['AAAA1111']);
    expect(seedsOf(await search({ character: 2 }))).toEqual(['CCCC3333', 'BBBB2222']);
    expect(seedsOf(await search({ difficulty: 'hard' }))).toEqual(['BBBB2222']);
    expect(seedsOf(await search({ result: 'win' }))).toEqual(['CCCC3333']);
    expect(seedsOf(await search({ fullUnlocks: 'false' }))).toEqual(['CCCC3333']);
  });

  it('"Isaac con el D6 que empieza con Mutant Spider" (startItems + items + personaje)', async () => {
    await makeRun({
      seed: 'MATCH111',
      characterId: 0,
      items: [
        [MUTANT_SPIDER, 1],
        [D6, 3],
      ],
    });
    // D6 pero no empieza con Mutant Spider (lo agarró en el piso 2)
    await makeRun({
      seed: 'LATE2222',
      characterId: 0,
      items: [
        [D6, 1],
        [MUTANT_SPIDER, 2],
      ],
    });
    // Empieza con Mutant Spider pero otro personaje
    await makeRun({
      seed: 'THER3333',
      characterId: 2,
      items: [
        [MUTANT_SPIDER, 1],
        [D6, 2],
      ],
    });
    // Sin D6
    await makeRun({ seed: 'N0D64444', characterId: 0, items: [[MUTANT_SPIDER, 1]] });

    const result = await search({ character: 0, startItems: MUTANT_SPIDER, items: D6 });
    expect(seedsOf(result)).toEqual(['MATCH111']);
  });

  it('startItems exige todos los ítems pedidos entre los del primer piso', async () => {
    await makeRun({
      seed: 'B0TH1111',
      items: [
        [MUTANT_SPIDER, 1],
        [SPOON_BENDER, 1],
      ],
    });
    await makeRun({ seed: 'ANE22222', items: [[MUTANT_SPIDER, 1]] });
    const both = await search({ startItems: `${MUTANT_SPIDER},${SPOON_BENDER}` });
    expect(seedsOf(both)).toEqual(['B0TH1111']);
  });

  it('exclude descarta runs que tengan alguno de esos ítems, en cualquier piso', async () => {
    await makeRun({ seed: 'CLEAN111', items: [[MUTANT_SPIDER, 1]] });
    await makeRun({
      seed: 'TR0LL222',
      items: [
        [MUTANT_SPIDER, 1],
        [SAD_ONION, 5],
      ],
    });
    expect(seedsOf(await search({ exclude: SAD_ONION }))).toEqual(['CLEAN111']);
  });

  it('items y exclude se pueden combinar', async () => {
    await makeRun({
      seed: 'HASD6111',
      items: [
        [MUTANT_SPIDER, 1],
        [D6, 2],
      ],
    });
    await makeRun({
      seed: 'HASB0TH2',
      items: [
        [MUTANT_SPIDER, 1],
        [D6, 2],
        [SAD_ONION, 3],
      ],
    });
    const result = await search({ items: D6, exclude: SAD_ONION });
    expect(seedsOf(result)).toEqual(['HASD6111']);
  });

  it('busca por seed (aunque llegue en minúsculas y con espacio)', async () => {
    await makeRun({ seed: 'ABCD1234' });
    await makeRun({ seed: 'WXYZ6789' });
    expect(seedsOf(await search({ seed: 'abcd 1234' }))).toEqual(['ABCD1234']);
  });

  it('sin coincidencias devuelve lista vacía', async () => {
    await makeRun();
    const result = await search({ startItems: SAD_ONION });
    expect(result).toEqual({ runs: [], nextCursor: null });
  });

  it('rechaza parámetros inválidos', async () => {
    for (const query of [
      { startItems: 'abc' },
      { seed: 'NOPE' },
      { limit: 500 },
      { difficulty: 'nightmare' },
      { cursor: 'garbage' },
    ]) {
      const res = await request(app).get('/api/runs').query(query);
      expect(res.status, JSON.stringify(query)).toBe(400);
      expect(res.body.error).toBe('validation');
    }
  });
});

describe('GET /api/runs — paginación por cursor', () => {
  it('recorre todas las runs sin repetir ni saltear, incluso con el mismo createdAt', async () => {
    const same = new Date(Date.UTC(2026, 5, 1));
    for (let i = 0; i < 7; i++) {
      await makeRun({ seed: `SEED000${'ABCDEFG'[i]}`, createdAt: i < 4 ? same : undefined });
    }

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const page = await search({ limit: 3, ...(cursor ? { cursor } : {}) });
      seen.push(...seedsOf(page));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(seen).toHaveLength(7);
    expect(new Set(seen).size).toBe(7);
  });

  it('no devuelve cursor cuando la última página queda justa', async () => {
    await makeRun({ seed: 'AAAA1111' });
    await makeRun({ seed: 'BBBB2222' });
    const page = await search({ limit: 2 });
    expect(page.runs).toHaveLength(2);
    expect(page.nextCursor).toBeNull();
  });

  it('los filtros se mantienen entre páginas', async () => {
    for (let i = 0; i < 5; i++) await makeRun({ seed: `PAGE000${i}`, characterId: 0 });
    for (let i = 0; i < 3; i++) await makeRun({ seed: `NAYS000${i}`, characterId: 2 });
    const first = await search({ character: 0, limit: 3 });
    const second = await search({ character: 0, limit: 3, cursor: first.nextCursor ?? '' });
    expect([...seedsOf(first), ...seedsOf(second)].every((s) => s.startsWith('PAGE'))).toBe(true);
    expect(second.runs).toHaveLength(2);
  });
});

describe('GET /api/seeds/:seed', () => {
  it('resume las runs de una seed: personajes y ítems que se repiten', async () => {
    await makeRun({
      seed: 'SEED1111',
      characterId: 0,
      items: [
        [MUTANT_SPIDER, 1],
        [D6, 2],
        [D6, 3], // repetido en la misma run: cuenta una vez
      ],
    });
    await makeRun({ seed: 'SEED1111', characterId: 2, items: [[MUTANT_SPIDER, 1]] });
    await makeRun({ seed: 'THER2222', characterId: 0 });

    const res = await request(app).get('/api/seeds/SEED1111');
    expect(res.status).toBe(200);
    const summary = seedSummarySchema.parse(res.body);
    expect(summary.runCount).toBe(2);
    expect(summary.runs.map((r) => r.characterId).sort()).toEqual([0, 2]);
    expect(summary.characters).toEqual(
      expect.arrayContaining([
        { characterId: 0, count: 1 },
        { characterId: 2, count: 1 },
      ]),
    );
    expect(summary.topItems[0]).toEqual({ itemId: MUTANT_SPIDER, count: 2 });
    expect(summary.topItems).toContainEqual({ itemId: D6, count: 1 });
  });

  it('acepta la seed en minúsculas y con espacio', async () => {
    await makeRun({ seed: 'ABCD1234' });
    const res = await request(app).get('/api/seeds/abcd%201234');
    expect(res.status).toBe(200);
    expect(res.body.seed).toBe('ABCD1234');
  });

  it('404 para seeds sin runs o con formato inválido', async () => {
    expect((await request(app).get('/api/seeds/ZZZZ9999')).status).toBe(404);
    expect((await request(app).get('/api/seeds/nope')).status).toBe(404);
  });
});
