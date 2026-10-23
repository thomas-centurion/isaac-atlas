import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';
import { config } from './config.js';
import { sendError } from './http.js';
import { currentUser } from './middleware.js';

interface LimiterOptions {
  windowMs: number;
  limit: number;
  /**
   * `user`: el límite es por cuenta (así una IP compartida —un campus, un NAT— no se bloquea
   * entre sí); los anónimos caen a IP. `ip`: por IP, para lo que se hace sin sesión.
   */
  by?: 'ip' | 'user';
}

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function limiter({ windowMs, limit, by = 'ip' }: LimiterOptions): RequestHandler {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => config.RATE_LIMIT_DISABLED,
    keyGenerator: (req) => {
      const user = by === 'user' ? currentUser(req) : undefined;
      // ipKeyGenerator agrupa las IPv6 por /56: una sola máquina no esquiva el límite rotando.
      return user ? `user:${user.id}` : ipKeyGenerator(req.ip ?? '');
    },
    handler: (_req, res) => sendError(res, 'rate_limited'),
  });
}

/** Techo general para toda la API: frena scrapers sin molestar a un uso normal de la web. */
export const apiLimiter = limiter({ windowMs: MINUTE, limit: 300 });

/** Login, registro, olvidé mi contraseña, verificar email: lo que se puede atacar por fuerza bruta. */
export const authLimiter = limiter({ windowMs: 15 * MINUTE, limit: 30 });

/** Contar visitantes: cada navegador lo hace una vez; el tope frena a quien intente inflar el número. */
export const visitLimiter = limiter({ windowMs: HOUR, limit: 10 });

/** Crear, editar y borrar runs. */
export const writeLimiter = limiter({ windowMs: HOUR, limit: 60, by: 'user' });

/** Votos y veredictos: se recorren muchas runs, así que el margen es amplio. */
export const reactionLimiter = limiter({ windowMs: HOUR, limit: 600, by: 'user' });

/** Exportar los datos de la cuenta: se arma con varias consultas, no tiene sentido repetirlo seguido. */
export const exportLimiter = limiter({ windowMs: HOUR, limit: 10, by: 'user' });

/** Reportes: pocos y deliberados; frena el uso para acosar. */
export const reportLimiter = limiter({ windowMs: HOUR, limit: 20, by: 'user' });
