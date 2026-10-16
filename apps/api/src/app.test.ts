import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { healthResponseSchema } from '@isaac-atlas/shared';
import { createApp } from './app.js';

describe('GET /api/health', () => {
  it('responde ok con el estado de la DB', async () => {
    const res = await request(createApp()).get('/api/health');
    expect(res.status).toBe(200);
    expect(healthResponseSchema.parse(res.body).status).toBe('ok');
  });
});
