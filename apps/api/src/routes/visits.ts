import { Router } from 'express';
import { asyncHandler } from '../http.js';
import { visitLimiter } from '../limiters.js';
import { Counter } from '../models/Counter.js';

const VISITORS = 'visitors';

export const visitsRouter = Router();

/** Cantidad de visitantes contados hasta ahora. */
visitsRouter.get(
  '/',
  asyncHandler(async (_req, res) => {
    const counter = await Counter.findById(VISITORS);
    res.json({ count: counter?.n ?? 0 });
  }),
);

/**
 * Cuenta un visitante nuevo. El navegador lo pide una sola vez (guarda una marca local), así que
 * el número aproxima navegadores distintos sin guardar ningún dato de quién es cada uno.
 */
visitsRouter.post(
  '/',
  visitLimiter,
  asyncHandler(async (_req, res) => {
    const counter = await Counter.findByIdAndUpdate(
      VISITORS,
      { $inc: { n: 1 } },
      { upsert: true, new: true },
    );
    res.status(201).json({ count: counter.n });
  }),
);
