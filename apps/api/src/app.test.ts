import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@isaac-atlas/shared';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('responde con el estado de la DB: 200 si está arriba, 503 si no', async () => {
    const res = await request(createApp()).get('/api/health');
    const body = healthResponseSchema.parse(res.body);
    expect(body.status).toBe('ok');
    expect(res.status).toBe(body.db === 'up' ? 200 : 503);
  });
});
