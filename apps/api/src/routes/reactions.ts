import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { verdictInputSchema, voteInputSchema, type VerdictKind } from '@isaac-atlas/shared';
import { config } from '../config.js';
import { HttpError, asyncHandler, parseBody, sendError } from '../http.js';
import { currentUser, requireAuth, requireUsername } from '../middleware.js';
import { Verdict, Vote } from '../models/Reactions.js';
import { Run, type RunDocument } from '../models/Run.js';
import { hotScore, wilsonLowerBound } from '../ranking.js';
import { attachViewer, authorDto, loadRun, toRunDto } from '../runDto.js';

// Votar es una acción de uso normal (se recorren muchas runs): límite más holgado que el de crear.
const reactionLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.RATE_LIMIT_DISABLED,
  handler: (_req, res) => sendError(res, 'rate_limited'),
});

/**
 * Suma `inc` a los contadores de la run y recalcula Wilson y hot a partir de los totales
 * que quedaron. Los `$inc` son atómicos; el recálculo parte del documento ya actualizado.
 */
async function adjustStats(runId: RunDocument['_id'], inc: Record<string, number>) {
  const changes = Object.entries(inc).filter(([, delta]) => delta !== 0);
  if (changes.length === 0) return;
  const updated = await Run.findByIdAndUpdate(
    runId,
    { $inc: Object.fromEntries(changes.map(([key, delta]) => [`stats.${key}`, delta])) },
    { new: true },
  );
  if (!updated) return;
  const up = Math.max(0, updated.stats.up);
  const down = Math.max(0, updated.stats.down);
  await Run.updateOne(
    { _id: runId },
    {
      $set: {
        'stats.wilson': wilsonLowerBound(up, down),
        'stats.hot': hotScore(up, down, updated.createdAt),
      },
    },
  );
}

/** La run existe y no es del propio usuario (no se puede votar lo que uno publicó). */
async function loadVotableRun(id: string, userId: string) {
  const { run, author } = await loadRun(id);
  if (String(author._id) === userId) throw new HttpError('forbidden');
  return { run, author };
}

async function respond(runId: string, req: Parameters<typeof currentUser>[0]) {
  const { run, author } = await loadRun(runId);
  const [dto] = await attachViewer([toRunDto(run, authorDto(author))], currentUser(req));
  return { run: dto };
}

export const reactionsRouter = Router();

reactionsRouter.put(
  '/:id/vote',
  requireAuth,
  requireUsername,
  reactionLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const { value } = parseBody(voteInputSchema, req.body);
    const { run } = await loadVotableRun(String(req.params.id), user.id);

    // new:false devuelve el voto anterior: el delta sale de ahí, así que repetir la misma
    // petición (o dos a la vez) no suma dos veces.
    const previous = await Vote.findOneAndUpdate(
      { userId: user._id, runId: run._id },
      { value },
      { upsert: true, new: false },
    );
    const before = previous?.value ?? 0;
    await adjustStats(run._id, {
      up: (value === 1 ? 1 : 0) - (before === 1 ? 1 : 0),
      down: (value === -1 ? 1 : 0) - (before === -1 ? 1 : 0),
    });
    res.json(await respond(run.id, req));
  }),
);

reactionsRouter.delete(
  '/:id/vote',
  requireAuth,
  requireUsername,
  reactionLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const { run } = await loadVotableRun(String(req.params.id), user.id);
    const previous = await Vote.findOneAndDelete({ userId: user._id, runId: run._id });
    if (previous) {
      await adjustStats(run._id, {
        up: previous.value === 1 ? -1 : 0,
        down: previous.value === -1 ? -1 : 0,
      });
    }
    res.json(await respond(run.id, req));
  }),
);

reactionsRouter.put(
  '/:id/verdict',
  requireAuth,
  requireUsername,
  reactionLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const { kind } = parseBody(verdictInputSchema, req.body);
    const { run } = await loadVotableRun(String(req.params.id), user.id);

    const previous = await Verdict.findOneAndUpdate(
      { userId: user._id, runId: run._id },
      { kind },
      { upsert: true, new: false },
    );
    if (previous?.kind !== kind) {
      const inc: Record<VerdictKind, number> = { op: 0, troll: 0, hard: 0 };
      inc[kind] += 1;
      if (previous) inc[previous.kind] -= 1;
      await adjustStats(run._id, inc);
    }
    res.json(await respond(run.id, req));
  }),
);

reactionsRouter.delete(
  '/:id/verdict',
  requireAuth,
  requireUsername,
  reactionLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const { run } = await loadVotableRun(String(req.params.id), user.id);
    const previous = await Verdict.findOneAndDelete({ userId: user._id, runId: run._id });
    if (previous) await adjustStats(run._id, { [previous.kind]: -1 });
    res.json(await respond(run.id, req));
  }),
);
