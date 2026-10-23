import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import session from 'express-session';
import type { HealthResponse } from '@isaac-atlas/shared';
import { passport } from './auth/passport.js';
import { config } from './config.js';
import { HttpError, errorHandler } from './http.js';
import { originCheck } from './middleware.js';
import { accountRouter } from './routes/account.js';
import { authRouter } from './routes/auth.js';
import { runsRouter } from './routes/runs.js';
import { seedsRouter } from './routes/seeds.js';
import { dailyRouter } from './routes/daily.js';
import { adminRouter, reportRouter } from './routes/moderation.js';
import { reactionsRouter } from './routes/reactions.js';
import { usersRouter } from './routes/users.js';
import { visitsRouter } from './routes/visits.js';
import { apiLimiter } from './limiters.js';
import { serveWeb } from './web.js';

interface AppDeps {
  /** Store de sesiones (connect-mongo en runtime). Sin store: MemoryStore, solo para tests simples. */
  sessionStore?: session.Store;
}

export function createApp({ sessionStore }: AppDeps = {}) {
  const app = express();
  app.disable('x-powered-by');
  // Detrás de un proxy (Render, Railway…) para que cookies `secure` e IPs funcionen.
  if (config.NODE_ENV === 'production') app.set('trust proxy', config.TRUST_PROXY);

  app.use(
    helmet({
      contentSecurityPolicy: {
        // useDefaults (por defecto): default-src 'self', scripts propios, etc. Solo se amplía img-src
        // para los avatares de Google y Steam que se muestran en la cuenta.
        directives: {
          'img-src': [
            "'self'",
            'data:',
            'https://*.googleusercontent.com',
            'https://*.steamstatic.com',
            'https://*.akamaihd.net',
          ],
        },
      },
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  // Sesión y passport solo para la API: los assets estáticos no deben costar consultas a Mongo.
  app.use(
    '/api',
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
        secure: config.COOKIE_SECURE ?? config.NODE_ENV === 'production',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      },
    }),
  );
  app.use('/api', passport.initialize());
  app.use('/api', passport.session());

  app.get('/api/health', (req, res) => {
    if (config.DEBUG_IP === 'true') {
      console.log('[debug-ip]', { ip: req.ip, ips: req.ips, xff: req.get('x-forwarded-for') });
    }
    const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
    const body: HealthResponse = { status: 'ok', db };
    // 503 con la base caída: así el hosting no manda tráfico a una instancia que no puede servirlo.
    res.status(db === 'up' ? 200 : 503).json(body);
  });

  app.use('/api', apiLimiter, originCheck);
  app.use('/api/auth', authRouter);
  app.use('/api/account', accountRouter);
  app.use('/api/runs', reactionsRouter);
  app.use('/api/runs', reportRouter);
  app.use('/api/runs', runsRouter);
  app.use('/api/daily', dailyRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/admin', adminRouter);
  app.use('/api/seeds', seedsRouter);
  app.use('/api/visits', visitsRouter);
  app.use('/api', (_req, _res, next) => next(new HttpError('not_found')));

  serveWeb(app);

  app.use(errorHandler);
  return app;
}
