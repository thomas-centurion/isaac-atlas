import { Router, type RequestHandler } from 'express';
import { isValidObjectId, type Types } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import {
  runInputSchema,
  startItemIds,
  type Run as RunDto,
  type RunInput,
} from '@isaac-atlas/shared';
import { config } from '../config.js';
import { HttpError, asyncHandler, parseBody, sendError } from '../http.js';
import { currentUser, requireAuth } from '../middleware.js';
import { Run, type RunDocument } from '../models/Run.js';
import type { UserDocument } from '../models/User.js';

/** Las cuentas nuevas de Google/Steam deben elegir username antes de publicar. */
const requireUsername: RequestHandler = (req, _res, next) => {
  if (!currentUser(req)?.username) return next(new HttpError('forbidden'));
  next();
};

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.RATE_LIMIT_DISABLED,
  handler: (_req, res) => sendError(res, 'rate_limited'),
});

function toRunDto(run: RunDocument, author: { id: string; username: string }): RunDto {
  return {
    id: run.id,
    seed: run.seed,
    gameVersion: run.gameVersion,
    characterId: run.characterId,
    difficulty: run.difficulty,
    fullUnlocks: run.fullUnlocks,
    items: run.items.map((i) => ({ itemId: i.itemId, floor: i.floor, source: i.source })),
    trinkets: run.trinkets.map((t) => ({ trinketId: t.trinketId, floor: t.floor })),
    startItems: run.startItems,
    outcome: {
      result: run.outcome.result,
      ...(run.outcome.lastFloor ? { lastFloor: run.outcome.lastFloor } : {}),
      ...(run.outcome.finalBoss
        ? { finalBoss: run.outcome.finalBoss as NonNullable<RunDto['outcome']['finalBoss']> }
        : {}),
    },
    notes: run.notes,
    author,
    createdAt: run.createdAt.toISOString(),
  };
}

type PopulatedAuthor = Pick<UserDocument, 'username'> & { _id: Types.ObjectId };

async function loadRun(id: string): Promise<{ run: RunDocument; author: PopulatedAuthor }> {
  if (!isValidObjectId(id)) throw new HttpError('not_found');
  const run = await Run.findById(id).populate<{ author: PopulatedAuthor }>('author', 'username');
  if (!run || !run.author) throw new HttpError('not_found');
  return { run: run as unknown as RunDocument, author: run.author };
}

const authorDto = (a: PopulatedAuthor) => ({ id: String(a._id), username: a.username ?? '' });

const fieldsFrom = (input: RunInput) => ({
  seed: input.seed,
  gameVersion: input.gameVersion,
  characterId: input.characterId,
  difficulty: input.difficulty,
  fullUnlocks: input.fullUnlocks,
  items: input.items,
  trinkets: input.trinkets,
  startItems: startItemIds(input.items),
  outcome: input.outcome,
  notes: input.notes,
});

export const runsRouter = Router();

runsRouter.post(
  '/',
  requireAuth,
  requireUsername,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const input = parseBody(runInputSchema, req.body);
    const run = await Run.create({ ...fieldsFrom(input), author: user._id });
    res.status(201).json({
      run: toRunDto(run, { id: user.id, username: user.username! }),
    });
  }),
);

runsRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const runs = await Run.find({ author: user._id }).sort({ createdAt: -1 }).limit(100);
    const author = { id: user.id, username: user.username ?? '' };
    res.json({ runs: runs.map((r) => toRunDto(r, author)) });
  }),
);

runsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { run, author } = await loadRun(String(req.params.id));
    res.json({ run: toRunDto(run, authorDto(author)) });
  }),
);

runsRouter.put(
  '/:id',
  requireAuth,
  requireUsername,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const { run, author } = await loadRun(String(req.params.id));
    if (String(author._id) !== user.id) throw new HttpError('forbidden');
    run.set(fieldsFrom(parseBody(runInputSchema, req.body)));
    await run.save();
    res.json({ run: toRunDto(run, authorDto(author)) });
  }),
);

runsRouter.delete(
  '/:id',
  requireAuth,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const { run, author } = await loadRun(String(req.params.id));
    if (String(author._id) !== user.id) throw new HttpError('forbidden');
    await run.deleteOne();
    res.status(204).end();
  }),
);
