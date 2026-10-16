import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { profileSchema, runSearchResponseSchema, type RunDraftInput } from '@isaac-atlas/shared';
import { createApp } from '../app.js';
import { User } from '../models/User.js';
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

const publish = async (agent: Agent, seed: string) =>
  (await agent.post('/api/runs').send({ ...baseRun, seed })).body.run.id as string;

describe('GET /api/users/:username', () => {
  it('muestra totales recibidos y es público', async () => {
    const alice = await signUp('Alice');
    const [one, two] = [await publish(alice, 'AAAA1111'), await publish(alice, 'BBBB2222')];
    const fan = await signUp('Fan');
    await fan.put(`/api/runs/${one}/vote`).send({ value: 1 });
    await fan.put(`/api/runs/${two}/vote`).send({ value: 1 });
    await fan.put(`/api/runs/${one}/verdict`).send({ kind: 'op' });
    await (await signUp('Other')).put(`/api/runs/${two}/verdict`).send({ kind: 'troll' });

    const res = await request(app).get('/api/users/alice');
    expect(res.status).toBe(200);
    expect(profileSchema.parse(res.body)).toMatchObject({
      username: 'Alice',
      runCount: 2,
      totals: { up: 2, op: 1, troll: 1, hard: 0 },
    });
  });

  it('no expone email, avatar ni identidades', async () => {
    await signUp('Alice');
    await User.updateOne({ username: 'Alice' }, { avatar: 'https://example.com/me.png' });
    const res = await request(app).get('/api/users/Alice');
    const text = JSON.stringify(res.body);
    expect(text).not.toContain('alice@example.com');
    expect(text).not.toContain('me.png');
    expect(Object.keys(res.body).sort()).toEqual(['createdAt', 'runCount', 'totals', 'username']);
  });

  it('un usuario sin runs tiene totales en cero', async () => {
    await signUp('Newbie');
    const res = await request(app).get('/api/users/Newbie');
    expect(profileSchema.parse(res.body)).toMatchObject({
      runCount: 0,
      totals: { up: 0, op: 0, troll: 0, hard: 0 },
    });
  });

  it('404 para usuarios inexistentes, sin username o con nombre inválido', async () => {
    await User.create({ email: 'nameless@example.com', emailVerified: true });
    expect((await request(app).get('/api/users/ghost')).status).toBe(404);
    expect((await request(app).get('/api/users/x')).status).toBe(404);
    expect((await request(app).get('/api/users/bad%20name')).status).toBe(404);
  });
});

describe('GET /api/runs?author=', () => {
  const seedsFor = async (author: string) =>
    runSearchResponseSchema
      .parse((await request(app).get('/api/runs').query({ author })).body)
      .runs.map((r) => r.seed);

  it('lista solo las runs de ese usuario (sin importar mayúsculas)', async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    await publish(alice, 'AAAA1111');
    await publish(bob, 'BBBB2222');
    expect(await seedsFor('alice')).toEqual(['AAAA1111']);
    expect(await seedsFor('BOB')).toEqual(['BBBB2222']);
  });

  it('un autor inexistente devuelve lista vacía, no error', async () => {
    await publish(await signUp('Alice'), 'AAAA1111');
    expect(await seedsFor('nobody')).toEqual([]);
  });
});
