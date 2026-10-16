import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { HttpError, sendError } from './http.js';
import type { UserDocument } from './models/User.js';

export const currentUser = (req: Request) => req.user as UserDocument | undefined;

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!currentUser(req)) return next(new HttpError('unauthorized'));
  next();
};

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Defensa CSRF en capas: cookie SameSite=Lax + verificación del header Origin
 * en toda mutación. Los navegadores siempre lo envían en POST/PUT/PATCH/DELETE.
 */
export const originCheck: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const origin = req.get('origin');
  const allowed = new Set([config.WEB_ORIGIN, config.PUBLIC_URL]);
  if (origin && !allowed.has(origin)) return next(new HttpError('forbidden'));
  next();
};

/** Límite para endpoints sensibles (login, registro, reset). */
export const authLimiter: RequestHandler = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.RATE_LIMIT_DISABLED,
  handler: (_req, res) => sendError(res, 'rate_limited'),
});
