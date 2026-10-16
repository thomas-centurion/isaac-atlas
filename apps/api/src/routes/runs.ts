import { Router } from 'express';
import type { FilterQuery, SortOrder } from 'mongoose';
import { rateLimit } from 'express-rate-limit';
import {
  MIN_VERDICT_VOTES,
  runInputSchema,
  runSearchSchema,
  startItemIds,
  type RunInput,
  type RunSearchResponse,
} from '@isaac-atlas/shared';
import { config } from '../config.js';
import { decodeCursor, encodeCursor } from '../cursor.js';
import { HttpError, asyncHandler, parseBody, sendError } from '../http.js';
import { currentUser, requireAuth, requireUsername } from '../middleware.js';
import { Verdict, Vote } from '../models/Reactions.js';
import { Run, type RunAttrs, type RunDocument } from '../models/Run.js';
import { hotScore } from '../ranking.js';
import {
  attachViewer,
  authorDto,
  loadRun,
  populatedToDtos,
  toRunDto,
  type PopulatedAuthor,
} from '../runDto.js';

const writeLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 60,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => config.RATE_LIMIT_DISABLED,
  handler: (_req, res) => sendError(res, 'rate_limited'),
});

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

runsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const q = parseBody(runSearchSchema, req.query);

    const filter: FilterQuery<RunAttrs> = {};
    if (q.character !== undefined) filter.characterId = q.character;
    if (q.difficulty) filter.difficulty = q.difficulty;
    if (q.result) filter['outcome.result'] = q.result;
    if (q.fullUnlocks !== undefined) filter.fullUnlocks = q.fullUnlocks;
    if (q.seed) filter.seed = q.seed;
    if (q.startItems.length) filter.startItems = { $all: q.startItems };
    if (q.items.length || q.exclude.length) {
      filter['items.itemId'] = {
        ...(q.items.length ? { $all: q.items } : {}),
        ...(q.exclude.length ? { $nin: q.exclude } : {}),
      };
    }
    if (q.verdict) filter[`stats.${q.verdict}`] = { $gte: MIN_VERDICT_VOTES };

    // hot y top ordenan por puntaje y desempatan por (createdAt, _id); new, solo por fecha.
    const scoreField = q.sort === 'hot' ? 'stats.hot' : q.sort === 'top' ? 'stats.wilson' : null;
    const sort: Record<string, SortOrder> = {
      ...(scoreField ? { [scoreField]: -1 } : {}),
      createdAt: -1,
      _id: -1,
    };

    if (q.cursor) {
      const { createdAt, id, value } = decodeCursor(q.cursor);
      const afterTie = [{ createdAt: { $lt: createdAt } }, { createdAt, _id: { $lt: id } }];
      if (scoreField) {
        // Un cursor de otro orden (sin puntaje) no sirve para este.
        if (value === undefined) {
          throw new HttpError('validation', [
            { path: 'cursor', message: 'cursor from another sort' },
          ]);
        }
        filter.$or = [
          { [scoreField]: { $lt: value } },
          ...afterTie.map((cond) => ({ [scoreField]: value, ...cond })),
        ];
      } else {
        filter.$or = afterTie;
      }
    }

    // Se pide una de más para saber si hay otra página sin hacer un count.
    const found = await Run.find(filter)
      .sort(sort)
      .limit(q.limit + 1)
      .populate<{ author: PopulatedAuthor }>('author', 'username');
    const page = found.slice(0, q.limit) as unknown as RunDocument[];
    const last = page.at(-1);

    const body: RunSearchResponse = {
      runs: await attachViewer(populatedToDtos(page), currentUser(req)),
      nextCursor:
        found.length > q.limit && last
          ? encodeCursor({
              createdAt: last.createdAt,
              id: last._id,
              ...(scoreField
                ? { value: q.sort === 'hot' ? last.stats.hot : last.stats.wilson }
                : {}),
            })
          : null,
    };
    res.json(body);
  }),
);

runsRouter.post(
  '/',
  requireAuth,
  requireUsername,
  writeLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const input = parseBody(runInputSchema, req.body);
    const createdAt = new Date();
    const run = await Run.create({
      ...fieldsFrom(input),
      author: user._id,
      createdAt,
      // Sin votos, "hot" es solo la antigüedad: las runs nuevas entran arriba.
      stats: { hot: hotScore(0, 0, createdAt) },
    });
    const [dto] = await attachViewer(
      [toRunDto(run, { id: user.id, username: user.username! })],
      user,
    );
    res.status(201).json({ run: dto });
  }),
);

runsRouter.get(
  '/mine',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const runs = await Run.find({ author: user._id }).sort({ createdAt: -1 }).limit(100);
    const author = { id: user.id, username: user.username ?? '' };
    res.json({
      runs: await attachViewer(
        runs.map((r) => toRunDto(r, author)),
        user,
      ),
    });
  }),
);

runsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { run, author } = await loadRun(String(req.params.id));
    const [dto] = await attachViewer([toRunDto(run, authorDto(author))], currentUser(req));
    res.json({ run: dto });
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
    const [dto] = await attachViewer([toRunDto(run, authorDto(author))], user);
    res.json({ run: dto });
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
    await Promise.all([
      run.deleteOne(),
      // Los votos y veredictos de una run borrada no deben quedar huérfanos.
      Vote.deleteMany({ runId: run._id }),
      Verdict.deleteMany({ runId: run._id }),
    ]);
    res.status(204).end();
  }),
);
