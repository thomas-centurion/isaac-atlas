import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { connectTestDb, disconnectTestDb, resetTestDb } from '../test-utils.js';

let app: ReturnType<typeof createApp>;

beforeAll(async () => {
  app = createApp({ sessionStore: await connectTestDb() });
});
afterAll(disconnectTestDb);
beforeEach(resetTestDb);

describe('visitantes', () => {
  it('arranca en 0 y cada visita nueva suma 1', async () => {
    expect((await request(app).get('/api/visits')).body).toEqual({ count: 0 });
    expect((await request(app).post('/api/visits')).body).toEqual({ count: 1 });
    expect((await request(app).post('/api/visits')).body).toEqual({ count: 2 });
    expect((await request(app).get('/api/visits')).body).toEqual({ count: 2 });
  });

  it('no crea sesión ni cookies', async () => {
    const res = await request(app).post('/api/visits');
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
