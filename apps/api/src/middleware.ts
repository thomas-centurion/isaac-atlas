import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { config } from './config.js';
import { HttpError } from './http.js';
import type { UserDocument } from './models/User.js';

export const currentUser = (req: Request) => req.user as UserDocument | undefined;

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!currentUser(req)) return next(new HttpError('unauthorized'));
  next();
};

/** Las cuentas nuevas de Google/Steam deben elegir username antes de publicar o votar. */
export const requireUsername: RequestHandler = (req, _res, next) => {
  if (!currentUser(req)?.username) return next(new HttpError('forbidden'));
  next();
};

/**
 * Votar y reportar exigen una cuenta que probó quién es (email verificado o Google/Steam):
 * si no, cuentas descartables podrían manipular rankings y ocultar runs ajenas.
 */
export const requireVerified: RequestHandler = (req, _res, next) => {
  const user = currentUser(req);
  if (!user || (!user.emailVerified && user.identities.length === 0)) {
    return next(new HttpError('email_unverified'));
  }
  next();
};

/** Moderación: solo cuentas con rol `admin` (se asigna a mano en la base). */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const user = currentUser(req);
  if (!user) return next(new HttpError('unauthorized'));
  if (user.role !== 'admin') return next(new HttpError('forbidden'));
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
