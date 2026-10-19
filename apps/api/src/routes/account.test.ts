import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { REPORT_HIDE_THRESHOLD, type RunDraftInput } from '@isaac-atlas/shared';
import { createApp } from '../app.js';
import { EmailToken } from '../models/EmailToken.js';
import { Verdict, Vote } from '../models/Reactions.js';
import { Report } from '../models/Report.js';
import { Run } from '../models/Run.js';
import { User } from '../models/User.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

const PASSWORD = 'correct-horse-battery';

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
  await agent
    .post('/api/auth/register')
    .send({ email: `${username.toLowerCase()}@example.com`, username, password: PASSWORD });
  return agent;
}

const publish = async (agent: Agent, seed: string) =>
  (await agent.post('/api/runs').send({ ...baseRun, seed })).body.run.id as string;

describe('GET /api/account/export', () => {
  it('exige sesión', async () => {
    expect((await request(app).get('/api/account/export')).status).toBe(401);
  });

  it('descarga un JSON con los datos de la cuenta y nada más', async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    const aliceRun = await publish(alice, 'AAAA1111');
    const bobRun = await publish(bob, 'BBBB2222');
    await alice.put(`/api/runs/${bobRun}/vote`).send({ value: 1 });
    await alice.put(`/api/runs/${bobRun}/verdict`).send({ kind: 'op' });
    await alice.post(`/api/runs/${bobRun}/report`).send({ reason: 'spam', details: 'meh' });
    await bob.put(`/api/runs/${aliceRun}/vote`).send({ value: -1 });

    const res = await alice.get('/api/account/export');
    expect(res.status).toBe(200);
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="isaac-atlas-Alice-\d{4}-\d{2}-\d{2}\.json"$/,
    );
    expect(res.headers['cache-control']).toBe('no-store');

    const data = JSON.parse(res.text);
    expect(data.account).toMatchObject({
      username: 'Alice',
      email: 'alice@example.com',
      hasPassword: true,
      role: 'user',
    });
    expect(data.runs.map((r: { id: string }) => r.id)).toEqual([aliceRun]);
    expect(data.runs[0].stats.down).toBe(1);
    expect(data.votes).toEqual([{ runId: bobRun, value: 1 }]);
    expect(data.verdicts).toEqual([{ runId: bobRun, kind: 'op' }]);
    expect(data.reports).toMatchObject([
      { runId: bobRun, reason: 'spam', details: 'meh', status: 'open' },
    ]);
  });

  it('nunca incluye hashes, tokens ni datos de otros usuarios', async () => {
    const alice = await signUp('Alice');
    await signUp('Bob');
    const res = await alice.get('/api/account/export');
    for (const secret of ['passwordHash', 'argon2', 'tokenHash', 'bob@example.com', 'sessions']) {
      expect(res.text, secret).not.toContain(secret);
    }
  });
});

describe('DELETE /api/account', () => {
  const del = (agent: Agent, confirm: unknown) => agent.delete('/api/account').send({ confirm });

  it('exige sesión y una confirmación', async () => {
    expect((await request(app).delete('/api/account').send({ confirm: PASSWORD })).status).toBe(
      401,
    );
    const alice = await signUp('Alice');
    expect((await alice.delete('/api/account').send({})).status).toBe(400);
  });

  it('con la contraseña equivocada no borra nada', async () => {
    const alice = await signUp('Alice');
    await publish(alice, 'AAAA1111');
    const res = await del(alice, 'wrong-password-123');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('confirmation_failed');
    expect(await User.countDocuments()).toBe(1);
    expect(await Run.countDocuments()).toBe(1);
  });

  it('borra la cuenta, sus runs y cierra la sesión', async () => {
    const alice = await signUp('Alice');
    const id = await publish(alice, 'AAAA1111');
    await alice.post('/api/auth/resend-verification'); // deja un token de email

    const res = await del(alice, PASSWORD);
    expect(res.status).toBe(204);
    expect(await User.countDocuments()).toBe(0);
    expect(await Run.countDocuments()).toBe(0);
    expect(await EmailToken.countDocuments()).toBe(0);
    expect((await request(app).get(`/api/runs/${id}`)).status).toBe(404);
    expect((await alice.get('/api/auth/me')).body.user).toBeNull();
    expect((await request(app).get('/api/users/Alice')).status).toBe(404);
  });

  it('se puede volver a registrar con el mismo email y username', async () => {
    const alice = await signUp('Alice');
    await del(alice, PASSWORD);
    const again = await request(app)
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', username: 'Alice', password: PASSWORD });
    expect(again.status).toBe(201);
  });

  it('borra también lo que otros dejaron en sus runs (votos, veredictos, reportes)', async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    const aliceRun = await publish(alice, 'AAAA1111');
    await bob.put(`/api/runs/${aliceRun}/vote`).send({ value: 1 });
    await bob.put(`/api/runs/${aliceRun}/verdict`).send({ kind: 'hard' });
    await bob.post(`/api/runs/${aliceRun}/report`).send({ reason: 'spam' });

    await del(alice, PASSWORD);
    expect(await Vote.countDocuments()).toBe(0);
    expect(await Verdict.countDocuments()).toBe(0);
    expect(await Report.countDocuments()).toBe(0);
    expect(await User.countDocuments()).toBe(1);
  });

  it('corrige los contadores de las runs ajenas donde había votado', async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    const carol = await signUp('Carol');
    const bobRun = await publish(bob, 'BBBB2222');
    await alice.put(`/api/runs/${bobRun}/vote`).send({ value: 1 });
    await alice.put(`/api/runs/${bobRun}/verdict`).send({ kind: 'op' });
    await carol.put(`/api/runs/${bobRun}/vote`).send({ value: 1 });
    await carol.put(`/api/runs/${bobRun}/verdict`).send({ kind: 'troll' });
    const before = await Run.findById(bobRun);
    expect(before?.stats).toMatchObject({ up: 2, op: 1, troll: 1 });

    await del(alice, PASSWORD);

    const after = await Run.findById(bobRun);
    expect(after?.stats).toMatchObject({ up: 1, down: 0, op: 0, troll: 1, hard: 0 });
    // El puntaje de ranking se recalcula con los votos que quedan
    expect(after?.stats.wilson).toBeGreaterThan(0);
    expect(after?.stats.wilson).toBeLessThan(before!.stats.wilson);
    // Los votos de otros siguen
    expect(await Vote.countDocuments({ runId: bobRun })).toBe(1);
  });

  it('sus reportes dejan de contar: una run oculta por reportes vuelve a mostrarse', async () => {
    const author = await signUp('Author');
    const run = await publish(author, 'AAAA1111');
    const reporters: Agent[] = [];
    for (let i = 0; i < REPORT_HIDE_THRESHOLD; i++) {
      const r = await signUp(`Reporter${i}`);
      await r.post(`/api/runs/${run}/report`).send({ reason: 'spam' });
      reporters.push(r);
    }
    expect((await Run.findById(run))?.reportCount).toBe(REPORT_HIDE_THRESHOLD);
    expect((await request(app).get('/api/runs')).body.runs).toHaveLength(0);

    await del(reporters[0]!, PASSWORD);
    expect((await Run.findById(run))?.reportCount).toBe(REPORT_HIDE_THRESHOLD - 1);
    expect((await request(app).get('/api/runs')).body.runs).toHaveLength(1);
  });

  it('las cuentas sin contraseña (Google/Steam) confirman escribiendo su username', async () => {
    const alice = await signUp('Alice');
    await User.updateOne({ username: 'Alice' }, { $unset: { passwordHash: 1 } });

    const wrong = await del(alice, 'alice-no-es-el-username');
    expect(wrong.status).toBe(403);
    expect(await User.countDocuments()).toBe(1);

    // La contraseña vieja ya no sirve como confirmación
    expect((await del(alice, PASSWORD)).status).toBe(403);

    expect((await del(alice, 'Alice')).status).toBe(204);
    expect(await User.countDocuments()).toBe(0);
  });

  it('no toca a los demás usuarios ni a sus runs', async () => {
    const alice = await signUp('Alice');
    const bob = await signUp('Bob');
    await publish(alice, 'AAAA1111');
    const bobRun = await publish(bob, 'BBBB2222');

    await del(alice, PASSWORD);
    expect((await request(app).get(`/api/runs/${bobRun}`)).status).toBe(200);
    expect((await bob.get('/api/auth/me')).body.user.username).toBe('Bob');
  });

  it('un segundo intento tras borrar ya no tiene sesión', async () => {
    const alice = await signUp('Alice');
    await del(alice, PASSWORD);
    expect((await del(alice, PASSWORD)).status).toBe(401);
  });
});
