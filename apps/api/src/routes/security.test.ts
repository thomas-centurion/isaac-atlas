import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { resolveProviderLogin } from '../auth/accounts.js';
import { outbox } from '../auth/mailer.js';
import { EmailToken } from '../models/EmailToken.js';
import { User } from '../models/User.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp({ sessionStore: await connectTestDb() });
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await resetTestDb();
  outbox.length = 0;
});

const credentials = {
  email: 'victima@example.com',
  username: 'Atacante',
  password: 'correct-horse-battery',
};

describe('pre-registro de un email ajeno', () => {
  it('al unir la cuenta con Google se descartan la clave, las identidades y las sesiones', async () => {
    const attacker = request.agent(app);
    await attacker.post('/api/auth/register').send(credentials).expect(201);
    // El atacante tenía una identidad propia vinculada.
    await User.updateOne(
      { email: credentials.email },
      { identities: [{ provider: 'steam', providerId: '7656', linkedAt: new Date() }] },
    );
    expect((await attacker.get('/api/auth/me')).body.user).not.toBeNull();

    // La víctima real entra con Google (email verificado por el proveedor).
    const { user } = await resolveProviderLogin({
      provider: 'google',
      providerId: 'g-1',
      email: credentials.email,
      emailVerified: true,
    });

    expect(user.passwordHash).toBeUndefined();
    expect(user.identities.map((i) => i.provider)).toEqual(['google']);
    expect((await attacker.get('/api/auth/me')).body.user).toBeNull();
  });

  it('no deja vincular proveedores mientras el email no esté verificado', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(credentials).expect(201);
    const res = await agent.get('/api/auth/steam?link=1');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('email_unverified');
  });
});

describe('votar y reportar', () => {
  it('exigen email verificado', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(credentials).expect(201);
    const id = '64b000000000000000000000';
    const vote = await agent.put(`/api/runs/${id}/vote`).send({ value: 1 });
    expect(vote.status).toBe(403);
    expect(vote.body.error).toBe('email_unverified');
    const rep = await agent.post(`/api/runs/${id}/report`).send({ reason: 'spam' });
    expect(rep.body.error).toBe('email_unverified');
  });
});

describe('JSON malformado', () => {
  it('responde 400 y no es un error interno', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .set('content-type', 'application/json')
      .send('{"email":"a@b.co","password":"x",}');
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
  });
});

describe('mails', () => {
  it('no se reenvía el mismo tipo de mail dentro del enfriamiento', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(credentials).expect(201);
    expect(outbox).toHaveLength(1);
    await agent.post('/api/auth/resend-verification').expect(204);
    expect(outbox).toHaveLength(1);

    // Pasado el enfriamiento, sí.
    await EmailToken.updateMany({}, { createdAt: new Date(Date.now() - 10 * 60 * 1000) });
    await agent.post('/api/auth/resend-verification').expect(204);
    expect(outbox).toHaveLength(2);
  });
});
