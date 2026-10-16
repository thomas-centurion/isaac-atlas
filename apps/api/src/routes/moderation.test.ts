import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  REPORT_HIDE_THRESHOLD,
  dailyResponseSchema,
  meResponseSchema,
  reportsResponseSchema,
  runSearchResponseSchema,
  type RunDraftInput,
} from '@isaac-atlas/shared';
import { createApp } from '../app.js';
import { Report } from '../models/Report.js';
import { Run } from '../models/Run.js';
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

async function signUpAdmin(username: string): Promise<Agent> {
  const agent = await signUp(username);
  await User.updateOne({ username }, { role: 'admin' });
  return agent;
}

async function publish(agent: Agent, seed: string): Promise<string> {
  const res = await agent.post('/api/runs').send({ ...baseRun, seed });
  expect(res.status).toBe(201);
  return res.body.run.id as string;
}

const report = (agent: Agent, id: string, reason = 'spam', details?: string) =>
  agent.post(`/api/runs/${id}/report`).send({ reason, ...(details ? { details } : {}) });

const search = async (query: Record<string, string> = {}) =>
  runSearchResponseSchema.parse((await request(app).get('/api/runs').query(query)).body).runs;

/** Deja una run con REPORT_HIDE_THRESHOLD reportes abiertos (oculta). */
async function reportUntilHidden(id: string) {
  for (let i = 0; i < REPORT_HIDE_THRESHOLD; i++) {
    expect((await report(await signUp(`Reporter${i}`), id)).status).toBe(201);
  }
}

describe('reportar una run', () => {
  it('exige sesión y una run existente', async () => {
    const author = await signUp('Author');
    const id = await publish(author, 'AAAA1111');
    expect(
      (await request(app).post(`/api/runs/${id}/report`).send({ reason: 'spam' })).status,
    ).toBe(401);
    const reporter = await signUp('Reporter');
    expect((await report(reporter, '64b7f0f0f0f0f0f0f0f0f0f0')).status).toBe(404);
  });

  it('no se puede reportar la propia run', async () => {
    const author = await signUp('Author');
    const id = await publish(author, 'AAAA1111');
    expect((await report(author, id)).status).toBe(403);
    expect(await Report.countDocuments()).toBe(0);
  });

  it('valida el motivo y el largo del detalle', async () => {
    const author = await signUp('Author');
    const reporter = await signUp('Reporter');
    const id = await publish(author, 'AAAA1111');
    expect((await report(reporter, id, 'because')).status).toBe(400);
    expect((await report(reporter, id, 'other', 'x'.repeat(501))).status).toBe(400);
    expect((await report(reporter, id, 'other', 'No es la seed real')).status).toBe(201);
  });

  it('un usuario solo puede reportar una vez la misma run', async () => {
    const author = await signUp('Author');
    const reporter = await signUp('Reporter');
    const id = await publish(author, 'AAAA1111');
    expect((await report(reporter, id)).status).toBe(201);
    const again = await report(reporter, id, 'offensive');
    expect(again.status).toBe(409);
    expect(again.body.error).toBe('already_reported');
    expect((await Run.findById(id))?.reportCount).toBe(1);
  });
});

describe('ocultar runs muy reportadas', () => {
  it('con pocos reportes la run sigue visible', async () => {
    const author = await signUp('Author');
    const id = await publish(author, 'AAAA1111');
    for (let i = 0; i < REPORT_HIDE_THRESHOLD - 1; i++) await report(await signUp(`Rep${i}`), id);
    expect((await search()).map((r) => r.id)).toEqual([id]);
  });

  it('al llegar al umbral sale del buscador, de la seed y de la seed del día', async () => {
    const author = await signUp('Author');
    const bad = await publish(author, 'BADD1111');
    const good = await publish(author, 'GOOD2222');
    await reportUntilHidden(bad);

    expect((await search()).map((r) => r.id)).toEqual([good]);
    expect((await request(app).get('/api/seeds/BADD1111')).status).toBe(404);
    const daily = dailyResponseSchema.parse((await request(app).get('/api/daily')).body);
    expect(daily.run?.id).toBe(good);
  });

  it('sigue accesible por link directo y en "mis runs" (el autor se entera)', async () => {
    const author = await signUp('Author');
    const id = await publish(author, 'BADD1111');
    await reportUntilHidden(id);
    expect((await request(app).get(`/api/runs/${id}`)).status).toBe(200);
    const mine = await author.get('/api/runs/mine');
    expect(mine.body.runs.map((r: { id: string }) => r.id)).toEqual([id]);
  });

  it('si la seed del día queda oculta, se elige otra', async () => {
    const author = await signUp('Author');
    const a = await publish(author, 'AAAA1111');
    const b = await publish(author, 'BBBB2222');
    const first = dailyResponseSchema.parse((await request(app).get('/api/daily')).body).run?.id;
    const hidden = first === a ? a : b;
    await reportUntilHidden(hidden);
    const next = dailyResponseSchema.parse((await request(app).get('/api/daily')).body).run?.id;
    expect(next).toBe(hidden === a ? b : a);
  });
});

describe('moderación (admin)', () => {
  it('solo un admin puede ver y resolver reportes', async () => {
    const user = await signUp('Plain');
    expect((await request(app).get('/api/admin/reports')).status).toBe(401);
    expect((await user.get('/api/admin/reports')).status).toBe(403);
    expect(
      (
        await user
          .post('/api/admin/reports/64b7f0f0f0f0f0f0f0f0f0f0/resolve')
          .send({ action: 'dismiss' })
      ).status,
    ).toBe(403);
  });

  it('/me informa el rol', async () => {
    const user = await signUp('Plain');
    const admin = await signUpAdmin('Boss');
    expect(meResponseSchema.parse((await user.get('/api/auth/me')).body).user?.role).toBe('user');
    expect(meResponseSchema.parse((await admin.get('/api/auth/me')).body).user?.role).toBe('admin');
  });

  it('lista los reportes abiertos con la run y quién reportó', async () => {
    const author = await signUp('Author');
    const admin = await signUpAdmin('Boss');
    const id = await publish(author, 'AAAA1111');
    await report(await signUp('Reporter'), id, 'wrong_seed', 'Esta seed no da eso');

    const { reports } = reportsResponseSchema.parse((await admin.get('/api/admin/reports')).body);
    expect(reports).toHaveLength(1);
    expect(reports[0]).toMatchObject({
      reason: 'wrong_seed',
      details: 'Esta seed no da eso',
      status: 'open',
      reporter: { username: 'Reporter' },
    });
    expect(reports[0]?.run.id).toBe(id);
    expect(reports[0]?.run.author.username).toBe('Author');
  });

  it('descartar devuelve la run al buscador y marca todos sus reportes', async () => {
    const author = await signUp('Author');
    const admin = await signUpAdmin('Boss');
    const id = await publish(author, 'AAAA1111');
    await reportUntilHidden(id);
    expect(await search()).toHaveLength(0);

    const { reports } = reportsResponseSchema.parse((await admin.get('/api/admin/reports')).body);
    const res = await admin
      .post(`/api/admin/reports/${reports[0]!.id}/resolve`)
      .send({ action: 'dismiss' });
    expect(res.status).toBe(204);

    expect((await search()).map((r) => r.id)).toEqual([id]);
    expect((await Run.findById(id))?.reportCount).toBe(0);
    expect(await Report.countDocuments({ status: 'dismissed' })).toBe(REPORT_HIDE_THRESHOLD);
    expect(await Report.countDocuments({ status: 'open' })).toBe(0);
  });

  it('quitar la run la borra con sus votos y conserva los reportes como constancia', async () => {
    const author = await signUp('Author');
    const admin = await signUpAdmin('Boss');
    const id = await publish(author, 'AAAA1111');
    await (await signUp('Voter')).put(`/api/runs/${id}/vote`).send({ value: 1 });
    await report(await signUp('Reporter'), id);

    const { reports } = reportsResponseSchema.parse((await admin.get('/api/admin/reports')).body);
    const res = await admin
      .post(`/api/admin/reports/${reports[0]!.id}/resolve`)
      .send({ action: 'remove_run' });
    expect(res.status).toBe(204);

    expect(await Run.countDocuments()).toBe(0);
    expect((await request(app).get(`/api/runs/${id}`)).status).toBe(404);
    expect(await Report.countDocuments({ status: 'actioned' })).toBe(1);
  });

  it('rechaza reportes inexistentes y acciones desconocidas', async () => {
    const admin = await signUpAdmin('Boss');
    const missing = '64b7f0f0f0f0f0f0f0f0f0f0';
    expect(
      (await admin.post(`/api/admin/reports/${missing}/resolve`).send({ action: 'dismiss' }))
        .status,
    ).toBe(404);
    expect(
      (await admin.post(`/api/admin/reports/${missing}/resolve`).send({ action: 'nuke' })).status,
    ).toBe(400);
  });
});
