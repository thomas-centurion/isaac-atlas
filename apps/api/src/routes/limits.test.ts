import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// En este archivo el rate limiting SÍ está activo (en el resto de los tests se desactiva).
// Los módulos se importan después del stub porque la config se lee al cargar.
vi.stubEnv('RATE_LIMIT_DISABLED', 'false');
const { createApp } = await import('../app.js');
const { User } = await import('../models/User.js');
const { connectTestDb, disconnectTestDb, resetTestDb } = await import('../test-utils.js');

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp({ sessionStore: await connectTestDb() });
});
afterAll(disconnectTestDb);
beforeEach(resetTestDb);

const run = (seed: string) => ({
  seed,
  gameVersion: 'rep+',
  characterId: 0,
  difficulty: 'normal',
  fullUnlocks: true,
  items: [{ itemId: 153, floor: 1, source: 'treasure' }],
  trinkets: [],
  outcome: { result: 'death' },
  notes: '',
});

describe('rate limiting', () => {
  it('crear runs: el límite es por cuenta, no por IP (otro usuario desde la misma IP no se bloquea)', async () => {
    // Registrar consume el límite de auth (por IP); acá importa el de escritura.
    const alice = request.agent(app);
    await alice
      .post('/api/auth/register')
      .send({ email: 'alice@example.com', username: 'Alice', password: 'correct-horse-battery' });

    const letters = 'ABCDEFGHJKLMNPQRSTVWXYZ';
    const seedAt = (i: number) =>
      `AAA${letters[Math.floor(i / letters.length) % letters.length]}${letters[i % letters.length]}111`;

    for (let i = 0; i < 60; i++) {
      const res = await alice.post('/api/runs').send(run(seedAt(i)));
      expect(res.status, `run ${i}`).toBe(201);
    }
    const blocked = await alice.post('/api/runs').send(run(seedAt(61)));
    expect(blocked.status).toBe(429);
    expect(blocked.body.error).toBe('rate_limited');

    const bob = request.agent(app);
    await bob
      .post('/api/auth/register')
      .send({ email: 'bob@example.com', username: 'Bob', password: 'correct-horse-battery' });
    expect((await bob.post('/api/runs').send(run('BBBB2222'))).status).toBe(201);
  });

  it('reportar: máximo 20 por hora y por cuenta', async () => {
    const author = request.agent(app);
    await author
      .post('/api/auth/register')
      .send({ email: 'author@example.com', username: 'Author', password: 'correct-horse-battery' });
    const ids: string[] = [];
    const letters = 'ABCDEFGHJKLMNPQRSTVWXYZ';
    for (let i = 0; i < 21; i++) {
      const res = await author.post('/api/runs').send(run(`REPO${letters[i]}111`));
      ids.push(res.body.run.id);
    }

    const reporter = request.agent(app);
    await reporter
      .post('/api/auth/register')
      .send({ email: 'rep@example.com', username: 'Reporter', password: 'correct-horse-battery' });
    await User.updateOne({ username: 'Reporter' }, { emailVerified: true });
    for (let i = 0; i < 20; i++) {
      expect(
        (await reporter.post(`/api/runs/${ids[i]}/report`).send({ reason: 'spam' })).status,
      ).toBe(201);
    }
    expect(
      (await reporter.post(`/api/runs/${ids[20]}/report`).send({ reason: 'spam' })).status,
    ).toBe(429);
  });

  // Va al final: agota el límite de auth de esta IP, y los demás tests necesitan registrar usuarios.
  it('login: frena la fuerza bruta (30 intentos por ventana) con código estable', async () => {
    const attempt = () =>
      request(app)
        .post('/api/auth/login')
        .send({ email: 'ghost@example.com', password: 'whatever-password' });

    // El cupo (30 por 15 min) es compartido por IP entre registro, login y recuperación:
    // los registros de los tests anteriores ya consumieron parte, así que se bloquea antes.
    let blocked: request.Response | undefined;
    let attempts = 0;
    for (; attempts < 40 && !blocked; attempts++) {
      const res = await attempt();
      if (res.status === 429) blocked = res;
      else expect(res.status).toBe(401);
    }
    expect(blocked).toBeDefined();
    expect(attempts).toBeLessThanOrEqual(30);
    expect(blocked?.body.error).toBe('rate_limited');
    expect(blocked?.headers['ratelimit']).toBeDefined();
  });
});
