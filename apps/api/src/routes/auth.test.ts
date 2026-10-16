import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { meResponseSchema } from '@isaac-atlas/shared';
import { createApp } from '../app.js';
import { outbox } from '../auth/mailer.js';
import { hashPassword } from '../auth/password.js';
import { User } from '../models/User.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

const credentials = {
  email: 'isaac@example.com',
  username: 'Isaac_Fan',
  password: 'correct-horse-battery',
};

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp({ sessionStore: await connectTestDb() });
});
afterAll(disconnectTestDb);
beforeEach(async () => {
  await resetTestDb();
  outbox.length = 0;
});

const tokenFromMail = () => /token=([\w-]+)/.exec(outbox.at(-1)?.text ?? '')?.[1] ?? '';

describe('registro y login', () => {
  it('registra, abre sesión y manda el mail de verificación', async () => {
    const agent = request.agent(app);
    const res = await agent.post('/api/auth/register').send(credentials);
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      username: 'Isaac_Fan',
      email: 'isaac@example.com',
      emailVerified: false,
      hasPassword: true,
    });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect(outbox).toHaveLength(1);

    const me = await agent.get('/api/auth/me');
    expect(meResponseSchema.parse(me.body).user?.username).toBe('Isaac_Fan');
  });

  it('guarda la contraseña hasheada con argon2id', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const user = await User.findOne({ email: credentials.email });
    expect(user?.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('rechaza datos inválidos', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'nope', username: 'a', password: 'short' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('validation');
    expect(res.body.issues.map((i: { path: string }) => i.path)).toEqual(
      expect.arrayContaining(['email', 'username', 'password']),
    );
  });

  it('no permite email ni username repetidos (case-insensitive)', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const sameEmail = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'ISAAC@example.com', username: 'Other' });
    expect(sameEmail.status).toBe(409);
    expect(sameEmail.body.error).toBe('email_taken');

    const sameName = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'other@example.com', username: 'isaac_fan' });
    expect(sameName.status).toBe(409);
    expect(sameName.body.error).toBe('username_taken');
  });

  it('bloquea usernames reservados', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, username: 'Admin' });
    expect(res.body.error).toBe('username_taken');
  });

  it('login correcto e incorrecto', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const bad = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: 'wrong-password' });
    expect(bad.status).toBe(401);
    expect(bad.body.error).toBe('invalid_credentials');

    const unknown = await request(app)
      .post('/api/auth/login')
      .send({ email: 'ghost@example.com', password: 'whatever-password' });
    expect(unknown.body.error).toBe('invalid_credentials');

    const agent = request.agent(app);
    const ok = await agent.post('/api/auth/login').send({
      email: credentials.email,
      password: credentials.password,
    });
    expect(ok.status).toBe(200);
    expect((await agent.get('/api/auth/me')).body.user.email).toBe(credentials.email);
  });

  it('logout cierra la sesión', async () => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send(credentials);
    expect((await agent.post('/api/auth/logout')).status).toBe(204);
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });

  it('la cookie de sesión es httpOnly y SameSite=Lax', async () => {
    const res = await request(app).post('/api/auth/register').send(credentials);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/isaac\.sid=/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
  });
});

describe('protecciones', () => {
  it('rechaza mutaciones con Origin ajeno (CSRF)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'https://evil.example')
      .send(credentials);
    expect(res.status).toBe(403);
    expect(await User.countDocuments()).toBe(0);
  });

  it('acepta el Origin del front', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .set('Origin', 'http://localhost:5173')
      .send(credentials);
    expect(res.status).toBe(201);
  });

  it('las rutas protegidas exigen sesión', async () => {
    const res = await request(app).post('/api/auth/username').send({ username: 'Someone' });
    expect(res.status).toBe(401);
  });

  it('devuelve not_found para rutas de API desconocidas', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('not_found');
  });
});

describe('verificación de email', () => {
  it('confirma el email con el token del mail y el token es de un solo uso', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    const token = tokenFromMail();
    expect(token.length).toBeGreaterThan(20);

    expect((await request(app).post('/api/auth/verify-email').send({ token })).status).toBe(204);
    expect((await User.findOne({ email: credentials.email }))?.emailVerified).toBe(true);

    const again = await request(app).post('/api/auth/verify-email').send({ token });
    expect(again.status).toBe(400);
    expect(again.body.error).toBe('invalid_token');
  });

  it('rechaza tokens inventados', async () => {
    const res = await request(app)
      .post('/api/auth/verify-email')
      .send({ token: 'x'.repeat(43) });
    expect(res.body.error).toBe('invalid_token');
  });
});

describe('recuperar contraseña', () => {
  it('responde igual exista o no el email', async () => {
    await request(app).post('/api/auth/register').send(credentials);
    outbox.length = 0;
    const known = await request(app).post('/api/auth/forgot').send({ email: credentials.email });
    expect(known.status).toBe(204);
    expect(outbox).toHaveLength(1);

    outbox.length = 0;
    const unknown = await request(app)
      .post('/api/auth/forgot')
      .send({ email: 'ghost@example.com' });
    expect(unknown.status).toBe(204);
    expect(outbox).toHaveLength(0);
  });

  it('resetea la clave, verifica el email y cierra las sesiones abiertas', async () => {
    const victim = request.agent(app);
    await victim.post('/api/auth/register').send(credentials);
    expect((await victim.get('/api/auth/me')).body.user).not.toBeNull();

    await request(app).post('/api/auth/forgot').send({ email: credentials.email });
    const token = tokenFromMail();
    const newPassword = 'a-brand-new-password';
    const res = await request(app).post('/api/auth/reset').send({ token, password: newPassword });
    expect(res.status).toBe(204);

    // La sesión vieja ya no sirve
    expect((await victim.get('/api/auth/me')).body.user).toBeNull();
    // La clave vieja no entra; la nueva sí
    const old = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    expect(old.status).toBe(401);
    const fresh = await request(app)
      .post('/api/auth/login')
      .send({ email: credentials.email, password: newPassword });
    expect(fresh.status).toBe(200);
    expect(fresh.body.user.emailVerified).toBe(true);

    // El token no se reutiliza
    const reuse = await request(app).post('/api/auth/reset').send({ token, password: newPassword });
    expect(reuse.body.error).toBe('invalid_token');
  });
});

describe('onboarding de username', () => {
  // Las cuentas de Google/Steam nacen sin username; usamos una con clave para poder iniciar sesión.
  async function loginWithoutUsername() {
    await User.create({
      email: credentials.email,
      emailVerified: true,
      passwordHash: await hashPassword(credentials.password),
    });
    const agent = request.agent(app);
    await agent
      .post('/api/auth/login')
      .send({ email: credentials.email, password: credentials.password });
    return agent;
  }

  it('permite elegir username una sola vez', async () => {
    const agent = await loginWithoutUsername();
    expect((await agent.get('/api/auth/me')).body.user.username).toBeNull();

    const first = await agent.post('/api/auth/username').send({ username: 'SteamPlayer' });
    expect(first.status).toBe(200);
    expect(first.body.user.username).toBe('SteamPlayer');

    const second = await agent.post('/api/auth/username').send({ username: 'Another' });
    expect(second.status).toBe(403);
  });

  it('rechaza un username ya usado', async () => {
    await request(app)
      .post('/api/auth/register')
      .send({ ...credentials, email: 'other@example.com' });
    const agent = await loginWithoutUsername();
    const res = await agent.post('/api/auth/username').send({ username: 'isaac_fan' });
    expect(res.status).toBe(409);
    expect(res.body.error).toBe('username_taken');
  });
});

describe('proveedores', () => {
  it('lista qué proveedores están disponibles', async () => {
    const res = await request(app).get('/api/auth/providers');
    expect(res.body).toEqual({ google: false, steam: true });
  });

  it('Google responde provider_unavailable sin credenciales', async () => {
    const res = await request(app).get('/api/auth/google');
    expect(res.status).toBe(501);
  });

  it('Steam redirige a steamcommunity.com con return_to y state', async () => {
    const res = await request(app).get('/api/auth/steam');
    expect(res.status).toBe(302);
    const url = new URL(res.headers.location as string);
    expect(url.origin + url.pathname).toBe('https://steamcommunity.com/openid/login');
    const returnTo = new URL(url.searchParams.get('openid.return_to') as string);
    expect(returnTo.pathname).toBe('/api/auth/steam/callback');
    expect(returnTo.searchParams.get('s')).toBeTruthy();
  });

  it('el callback de Steam sin state válido vuelve al login con error', async () => {
    const res = await request(app).get('/api/auth/steam/callback?s=forged&openid.mode=id_res');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('/login?error=oauth_failed');
  });

  it('vincular exige estar logueado', async () => {
    const res = await request(app).get('/api/auth/steam?link=1');
    expect(res.status).toBe(401);
  });
});
