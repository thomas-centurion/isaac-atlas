import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { runResponseSchema, runsResponseSchema, type RunDraftInput } from '@isaac-atlas/shared';
import { createApp } from '../app.js';
import { hashPassword } from '../auth/password.js';
import { Run } from '../models/Run.js';
import { User } from '../models/User.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

const run: RunDraftInput = {
  seed: 'abcd 1234',
  gameVersion: 'rep+',
  characterId: 0,
  difficulty: 'normal',
  fullUnlocks: true,
  items: [
    { itemId: 153, floor: 1, source: 'treasure' },
    { itemId: 105, floor: 3, source: 'shop' },
  ],
  trinkets: [{ trinketId: 1, floor: 2 }],
  outcome: { result: 'win', lastFloor: 11, finalBoss: 'the-lamb' },
  notes: 'Mutant Spider + D6',
};

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp({ sessionStore: await connectTestDb() });
});
afterAll(disconnectTestDb);
beforeEach(resetTestDb);

async function signUp(username: string) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({
    email: `${username.toLowerCase()}@example.com`,
    username,
    password: 'correct-horse-battery',
  });
  return agent;
}

describe('POST /api/runs', () => {
  it('exige sesión', async () => {
    const res = await request(app).post('/api/runs').send(run);
    expect(res.status).toBe(401);
  });

  it('crea una run, normaliza la seed y deriva los ítems iniciales', async () => {
    const agent = await signUp('Alice');
    const res = await agent.post('/api/runs').send(run);
    expect(res.status).toBe(201);
    const { run: created } = runResponseSchema.parse(res.body);
    expect(created.seed).toBe('ABCD1234');
    expect(created.startItems).toEqual([153]);
    expect(created.author.username).toBe('Alice');
    expect(created.items).toHaveLength(2);
  });

  it('guarda la marca de reroll por ítem y no la inventa donde no está', async () => {
    const agent = await signUp('Alice');
    const items = [
      { itemId: 153, floor: 1, source: 'treasure', rerolled: true },
      { itemId: 21, floor: 2, source: 'devil' },
    ];
    const res = await agent.post('/api/runs').send({ ...run, items });
    expect(res.status).toBe(201);
    const { run: created } = runResponseSchema.parse(res.body);
    expect(created.items[0]).toMatchObject({ source: 'treasure', rerolled: true });
    expect(created.items[1]?.rerolled).toBeUndefined();

    const reread = runResponseSchema.parse((await agent.get(`/api/runs/${created.id}`)).body).run;
    expect(reread.items[0]?.rerolled).toBe(true);
  });

  it('rechaza datos inválidos (seed, ítem desconocido, sin ítems)', async () => {
    const agent = await signUp('Alice');
    const bad = [
      { ...run, seed: 'ABCD 5234' },
      { ...run, items: [{ itemId: 99999, floor: 1, source: 'other' }] },
      { ...run, items: [] },
      { ...run, characterId: 999 },
    ];
    for (const body of bad) {
      const res = await agent.post('/api/runs').send(body);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation');
    }
    expect(await Run.countDocuments()).toBe(0);
  });

  it('no deja publicar a cuentas sin username (onboarding pendiente)', async () => {
    await User.create({
      email: 'steam@example.com',
      emailVerified: true,
      passwordHash: await hashPassword('correct-horse-battery'),
    });
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: 'steam@example.com', password: 'correct-horse-battery' });
    const res = await agent.post('/api/runs').send(run);
    expect(res.status).toBe(403);
  });

  it('ignora campos que el cliente no debería poder fijar (autor, ítems iniciales)', async () => {
    const agent = await signUp('Alice');
    const other = await User.create({
      username: 'Bob',
      usernameLower: 'bob',
      emailVerified: false,
    });
    const res = await agent
      .post('/api/runs')
      .send({ ...run, author: other.id, startItems: [999], id: 'x' });
    expect(res.status).toBe(201);
    expect(res.body.run.author.username).toBe('Alice');
    expect(res.body.run.startItems).toEqual([153]);
  });
});

describe('lectura', () => {
  it('cualquiera puede ver una run, sin sesión', async () => {
    const agent = await signUp('Alice');
    const { body } = await agent.post('/api/runs').send(run);
    const res = await request(app).get(`/api/runs/${body.run.id}`);
    expect(res.status).toBe(200);
    expect(runResponseSchema.parse(res.body).run.author.username).toBe('Alice');
  });

  it('devuelve 404 para ids inexistentes o mal formados', async () => {
    expect((await request(app).get('/api/runs/not-an-id')).status).toBe(404);
    expect((await request(app).get('/api/runs/64b7f0f0f0f0f0f0f0f0f0f0')).status).toBe(404);
  });

  it('/mine lista solo las runs propias, las más nuevas primero', async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    await alice.post('/api/runs').send({ ...run, seed: 'AAAA 1111' });
    await alice.post('/api/runs').send({ ...run, seed: 'BBBB 2222' });
    await bob.post('/api/runs').send({ ...run, seed: 'CCCC 3333' });

    const res = await alice.get('/api/runs/mine');
    const { runs } = runsResponseSchema.parse(res.body);
    expect(runs.map((r) => r.seed)).toEqual(['BBBB2222', 'AAAA1111']);
    expect((await request(app).get('/api/runs/mine')).status).toBe(401);
  });
});

describe('edición y borrado', () => {
  it('el autor puede editar y borrar su run', async () => {
    const agent = await signUp('Alice');
    const { body } = await agent.post('/api/runs').send(run);
    const id = body.run.id;

    const edited = await agent
      .put(`/api/runs/${id}`)
      .send({ ...run, notes: 'editado', items: [{ itemId: 105, floor: 1, source: 'other' }] });
    expect(edited.status).toBe(200);
    // Una run recién publicada no figura como editada; después de editarla, sí.
    expect(body.run.editedAt).toBeUndefined();
    expect(Date.parse(edited.body.run.editedAt)).toBeGreaterThan(0);
    expect((await request(app).get(`/api/runs/${id}`)).body.run.editedAt).toBe(
      edited.body.run.editedAt,
    );
    expect(edited.body.run.notes).toBe('editado');
    expect(edited.body.run.startItems).toEqual([105]);

    expect((await agent.delete(`/api/runs/${id}`)).status).toBe(204);
    expect((await request(app).get(`/api/runs/${id}`)).status).toBe(404);
  });

  it('otro usuario no puede editar ni borrar', async () => {
    const alice = await signUp('Alice');
    const mallory = await signUp('Mallory');
    const { body } = await alice.post('/api/runs').send(run);
    const id = body.run.id;

    expect((await mallory.put(`/api/runs/${id}`).send({ ...run, notes: 'hack' })).status).toBe(403);
    expect((await mallory.delete(`/api/runs/${id}`)).status).toBe(403);
    expect((await request(app).get(`/api/runs/${id}`)).body.run.notes).toBe('Mutant Spider + D6');
  });
});
