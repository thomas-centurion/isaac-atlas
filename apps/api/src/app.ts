import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import type { HealthResponse } from '@isaac-atlas/shared';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      db: mongoose.connection.readyState === 1 ? 'up' : 'down',
    };
    res.json(body);
  });

  return app;
}
