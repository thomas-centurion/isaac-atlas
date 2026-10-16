import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import session from 'express-session';
import type { HealthResponse } from '@isaac-atlas/shared';
import { passport } from './auth/passport.js';
import { config } from './config.js';
import { HttpError, errorHandler } from './http.js';
import { originCheck } from './middleware.js';
import { authRouter } from './routes/auth.js';
import { runsRouter } from './routes/runs.js';
import { seedsRouter } from './routes/seeds.js';
import { dailyRouter } from './routes/daily.js';
import { reactionsRouter } from './routes/reactions.js';

interface AppDeps {
  /** Store de sesiones (connect-mongo en runtime). Sin store: MemoryStore, solo para tests simples. */
  sessionStore?: session.Store;
}

export function createApp({ sessionStore }: AppDeps = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Detrás de un proxy (Render, Railway…) para que cookies `secure` e IPs funcionen.
  if (config.NODE_ENV === 'production') app.set('trust proxy', 1);

  app.use(helmet());
  app.use(express.json({ limit: '100kb' }));
  app.use(
    session({
      name: 'isaac.sid',
      secret: config.SESSION_SECRET,
      store: sessionStore,
      resave: false,
      saveUninitialized: false,
      rolling: true,
      cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/api/health', (_req, res) => {
    const body: HealthResponse = {
      status: 'ok',
      db: mongoose.connection.readyState === 1 ? 'up' : 'down',
    };
    res.json(body);
  });

  app.use('/api', originCheck);
  app.use('/api/auth', authRouter);
  app.use('/api/runs', reactionsRouter);
  app.use('/api/runs', runsRouter);
  app.use('/api/daily', dailyRouter);
  app.use('/api/seeds', seedsRouter);
  app.use('/api', (_req, _res, next) => next(new HttpError('not_found')));

  app.use(errorHandler);
  return app;
}
