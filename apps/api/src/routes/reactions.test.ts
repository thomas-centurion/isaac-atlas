import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  dailyResponseSchema,
  runResponseSchema,
  runSearchResponseSchema,
  type RunDraftInput,
} from '@isaac-atlas/shared';
import { createApp } from '../app.js';
import { DailyPick, Verdict, Vote } from '../models/Reactions.js';
import { Run } from '../models/Run.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

const baseRun: RunDraftInput = {
  seed: 'ABCD1234',
  gameVersion: 'rep+',
  characterId: 0,
  difficulty: 'normal',
  fullUnlocks: true,
  items: [{ itemId: 153, floor: 1, source: 'treasure' }],
  trinkets: [],
  outcome: { result: 'death' },
  notes: '',
};

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp({ sessionStore: await connectTestDb() });
});
afterAll(disconnectTestDb);
beforeEach(resetTestDb);

type Agent = ReturnType<typeof request.agent>;

async function signUp(username: string): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    email: `${username.toLowerCase()}@example.com`,
    username,
    password: 'correct-horse-battery',
  });
  return agent;
}

async function publish(agent: Agent, seed: string): Promise<string> {
  const res = await agent.post('/api/runs').send({ ...baseRun, seed });
  expect(res.status).toBe(201);
  return res.body.run.id as string;
}

const vote = (agent: Agent, id: string, value: 1 | -1) =>
  agent.put(`/api/runs/${id}/vote`).send({ value });
const verdict = (agent: Agent, id: string, kind: string) =>
  agent.put(`/api/runs/${id}/verdict`).send({ kind });
const statsOf = (res: request.Response) => runResponseSchema.parse(res.body).run.stats;

describe('votos', () => {
  it('exigen sesión y una run existente', async () => {
    const author = await signUp('Author');
    const id = await publish(author, 'AAAA1111');
    expect((await request(app).put(`/api/runs/${id}/vote`).send({ value: 1 })).status).toBe(401);

    const voter = await signUp('Voter');
    expect((await vote(voter, '64b7f0f0f0f0f0f0f0f0f0f0', 1)).status).toBe(404);
    expect((await vote(voter, 'not-an-id', 1)).status).toBe(404);
  });

  it('no se puede votar la propia run', async () => {
    const author = await signUp('Author');
    const id = await publish(author, 'AAAA1111');
    expect((await vote(author, id, 1)).status).toBe(403);
    expect((await verdict(author, id, 'op')).status).toBe(403);
    expect(await Vote.countDocuments()).toBe(0);
  });

  it('suma, cambia y quita el voto; el usuario ve su propio voto', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const id = await publish(author, 'AAAA1111');

    const up = await vote(voter, id, 1);
    expect(statsOf(up)).toMatchObject({ up: 1, down: 0 });
    expect(runResponseSchema.parse(up.body).run.viewer?.vote).toBe(1);

    const down = await vote(voter, id, -1);
    expect(statsOf(down)).toMatchObject({ up: 0, down: 1 });
    expect(runResponseSchema.parse(down.body).run.viewer?.vote).toBe(-1);

    const removed = await voter.delete(`/api/runs/${id}/vote`);
    expect(statsOf(removed)).toMatchObject({ up: 0, down: 0 });
    expect(runResponseSchema.parse(removed.body).run.viewer?.vote).toBe(0);

    // Quitar un voto que no existe no rompe nada
    const again = await voter.delete(`/api/runs/${id}/vote`);
    expect(statsOf(again)).toMatchObject({ up: 0, down: 0 });
  });

  it('votar lo mismo dos veces (o a la vez) no suma dos veces', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const id = await publish(author, 'AAAA1111');

    await Promise.all([vote(voter, id, 1), vote(voter, id, 1), vote(voter, id, 1)]);
    await vote(voter, id, 1);

    const run = await Run.findById(id);
    expect(run?.stats.up).toBe(1);
    expect(await Vote.countDocuments({ runId: id })).toBe(1);
  });

  it('varios usuarios suman, y el puntaje se recalcula', async () => {
    const author = await signUp('Author');
    const id = await publish(author, 'AAAA1111');
    for (const name of ['Voter1', 'Voter2', 'Voter3']) await vote(await signUp(name), id, 1);
    await vote(await signUp('Voter4'), id, -1);

    const run = await Run.findById(id);
    expect(run?.stats).toMatchObject({ up: 3, down: 1 });
    expect(run?.stats.wilson).toBeGreaterThan(0);
    expect(run?.stats.wilson).toBeLessThan(0.75);
  });

  it('rechaza valores inválidos', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const id = await publish(author, 'AAAA1111');
    for (const value of [0, 2, 'up', null]) {
      const res = await voter.put(`/api/runs/${id}/vote`).send({ value });
      expect(res.status).toBe(400);
    }
  });

  it('borrar la run borra sus votos y veredictos', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const id = await publish(author, 'AAAA1111');
    await vote(voter, id, 1);
    await verdict(voter, id, 'op');
    expect((await author.delete(`/api/runs/${id}`)).status).toBe(204);
    expect(await Vote.countDocuments()).toBe(0);
    expect(await Verdict.countDocuments()).toBe(0);
  });
});

describe('veredictos', () => {
  it('se puede elegir uno, cambiarlo y quitarlo (uno por usuario)', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const id = await publish(author, 'AAAA1111');

    const op = await verdict(voter, id, 'op');
    expect(statsOf(op)).toMatchObject({ op: 1, troll: 0, hard: 0 });
    expect(runResponseSchema.parse(op.body).run.viewer?.verdict).toBe('op');

    // Mismo veredicto otra vez: no cambia nada
    expect(statsOf(await verdict(voter, id, 'op'))).toMatchObject({ op: 1 });

    const troll = await verdict(voter, id, 'troll');
    expect(statsOf(troll)).toMatchObject({ op: 0, troll: 1, hard: 0 });

    const removed = await voter.delete(`/api/runs/${id}/verdict`);
    expect(statsOf(removed)).toMatchObject({ op: 0, troll: 0, hard: 0 });
    expect(runResponseSchema.parse(removed.body).run.viewer?.verdict).toBeNull();
  });

  it('el voto y el veredicto son independientes', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const id = await publish(author, 'AAAA1111');
    await vote(voter, id, 1);
    await verdict(voter, id, 'hard');
    const run = await Run.findById(id);
    expect(run?.stats).toMatchObject({ up: 1, hard: 1 });
  });

  it('rechaza un veredicto desconocido', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const id = await publish(author, 'AAAA1111');
    expect((await verdict(voter, id, 'meh')).status).toBe(400);
  });
});

describe('orden y filtros del buscador', () => {
  async function scenario() {
    const author = await signUp('Author');
    const [v1, v2] = [await signUp('Voter1'), await signUp('Voter2')];
    const old = await publish(author, 'OLDD1111'); // 2 votos a favor
    const mid = await publish(author, 'MIDD2222'); // sin votos
    const bad = await publish(author, 'BADD3333'); // 1 voto en contra
    await vote(v1, old, 1);
    await vote(v2, old, 1);
    await vote(v1, bad, -1);
    return { old, mid, bad, v1, v2 };
  }

  const ids = async (query: Record<string, string | number>, agent?: Agent) => {
    const res = await (agent ?? request(app)).get('/api/runs').query(query);
    expect(res.status).toBe(200);
    return runSearchResponseSchema.parse(res.body).runs.map((r) => r.id);
  };

  it('new ordena por fecha', async () => {
    const { old, mid, bad } = await scenario();
    expect(await ids({ sort: 'new' })).toEqual([bad, mid, old]);
  });

  it('top ordena por Wilson: los votos a favor suben, los sin votos empatan por fecha', async () => {
    const { old, mid, bad } = await scenario();
    expect(await ids({ sort: 'top' })).toEqual([old, bad, mid]);
  });

  it('hot (el orden por defecto) sube las votadas y baja las criticadas', async () => {
    const { old, mid, bad } = await scenario();
    expect(await ids({})).toEqual([old, mid, bad]);
  });

  it('filtra por veredicto de la comunidad', async () => {
    const { old, mid, v1 } = await scenario();
    await verdict(v1, old, 'op');
    await verdict(v1, mid, 'troll');
    expect(await ids({ verdict: 'op' })).toEqual([old]);
    expect(await ids({ verdict: 'troll' })).toEqual([mid]);
    expect(await ids({ verdict: 'hard' })).toEqual([]);
  });

  it('la búsqueda trae el voto del usuario logueado (y nada sin sesión)', async () => {
    const { old, v1 } = await scenario();
    const mine = await v1.get('/api/runs').query({ sort: 'new' });
    const byId = new Map(
      runSearchResponseSchema.parse(mine.body).runs.map((r) => [r.id, r.viewer?.vote]),
    );
    expect(byId.get(old)).toBe(1);

    const anon = runSearchResponseSchema.parse((await request(app).get('/api/runs')).body);
    expect(anon.runs.every((r) => r.viewer === undefined)).toBe(true);
  });

  it('pagina por puntaje sin repetir ni saltear, aun con puntajes empatados', async () => {
    const author = await signUp('Author');
    const created: string[] = [];
    for (let i = 0; i < 7; i++) created.push(await publish(author, `PAGE000${'ABCDEFG'[i]}`));
    // Puntajes con empates: 3 con 0.5, 2 con 0.3 y 2 con 0
    const scores = [0.5, 0.5, 0.5, 0.3, 0.3, 0, 0];
    await Promise.all(
      created.map((id, i) => Run.updateOne({ _id: id }, { 'stats.wilson': scores[i] })),
    );

    const seen: string[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const res = await request(app)
        .get('/api/runs')
        .query({ sort: 'top', limit: 3, ...(cursor ? { cursor } : {}) });
      const page = runSearchResponseSchema.parse(res.body);
      seen.push(...page.runs.map((r) => r.id));
      cursor = page.nextCursor ?? undefined;
      pages++;
    } while (cursor && pages < 10);

    expect(pages).toBe(3);
    expect(new Set(seen).size).toBe(7);
    // Los de mayor puntaje van primero
    const scoreOf = (id: string) => scores[created.indexOf(id)] ?? 0;
    expect(seen.map(scoreOf)).toEqual([...seen.map(scoreOf)].sort((a, b) => b - a));
  });

  it('un cursor de otro orden no sirve', async () => {
    const author = await signUp('Author');
    for (let i = 0; i < 3; i++) await publish(author, `CURS000${'ABC'[i]}`);
    const page = runSearchResponseSchema.parse(
      (await request(app).get('/api/runs').query({ sort: 'new', limit: 1 })).body,
    );
    const res = await request(app)
      .get('/api/runs')
      .query({ sort: 'top', cursor: page.nextCursor ?? '' });
    expect(res.status).toBe(400);
  });
});

describe('seed del día', () => {
  const daily = async () => dailyResponseSchema.parse((await request(app).get('/api/daily')).body);
  const today = () => new Date().toISOString().slice(0, 10);

  it('sin runs devuelve null', async () => {
    expect((await daily()).run).toBeNull();
  });

  it('elige la mejor run (Wilson) y la mantiene todo el día aunque cambien los votos', async () => {
    const author = await signUp('Author');
    const [v1, v2] = [await signUp('Voter1'), await signUp('Voter2')];
    await publish(author, 'AAAA1111');
    const best = await publish(author, 'BBBB2222');
    await vote(v1, best, 1);
    await vote(v2, best, 1);

    const first = await daily();
    expect(first.date).toBe(today());
    expect(first.run?.id).toBe(best);

    // Aparece una run con más puntaje, pero la seed del día ya está fija
    const rival = await publish(author, 'CCCC3333');
    for (const name of ['Voter3', 'Voter4', 'Voter5']) await vote(await signUp(name), rival, 1);
    expect((await daily()).run?.id).toBe(best);
    expect(await DailyPick.countDocuments({ date: today() })).toBe(1);
  });

  it('no repite una run que fue seed del día hace poco', async () => {
    const author = await signUp('Author');
    const voter = await signUp('Voter');
    const best = await publish(author, 'AAAA1111');
    const second = await publish(author, 'BBBB2222');
    await vote(voter, best, 1);

    const yesterday = new Date(Date.now() - 24 * 3600_000).toISOString().slice(0, 10);
    await DailyPick.create({ date: yesterday, runId: best });
    expect((await daily()).run?.id).toBe(second);
  });

  it('si la run elegida se borra, elige otra', async () => {
    const author = await signUp('Author');
    const a = await publish(author, 'AAAA1111');
    const b = await publish(author, 'BBBB2222');
    const first = (await daily()).run?.id;
    expect([a, b]).toContain(first);

    await author.delete(`/api/runs/${first}`);
    const next = (await daily()).run?.id;
    expect(next).toBe(first === a ? b : a);
  });

  it('muchas peticiones simultáneas dan una única elección', async () => {
    const author = await signUp('Author');
    for (const s of ['AAAA1111', 'BBBB2222', 'CCCC3333']) await publish(author, s);
    const results = await Promise.all([daily(), daily(), daily(), daily()]);
    expect(new Set(results.map((r) => r.run?.id)).size).toBe(1);
    expect(await DailyPick.countDocuments({ date: today() })).toBe(1);
  });
});
