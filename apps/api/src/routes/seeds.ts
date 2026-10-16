import { Router } from 'express';
import { isValidSeedFormat, normalizeSeed, type SeedSummary } from '@isaac-atlas/shared';
import { HttpError, asyncHandler } from '../http.js';
import { Run, type RunDocument } from '../models/Run.js';
import { populatedToDtos, type PopulatedAuthor } from './runs.js';

const SEED_RUNS_LIMIT = 50;
const TOP_ITEMS_LIMIT = 12;

export const seedsRouter = Router();

/** Todo lo que la comunidad registró para una seed: runs, personajes y qué ítems se repiten. */
seedsRouter.get(
  '/:seed',
  asyncHandler(async (req, res) => {
    const seed = normalizeSeed(String(req.params.seed));
    if (!isValidSeedFormat(seed)) throw new HttpError('not_found');

    const [runCount, characters, topItems, runs] = await Promise.all([
      Run.countDocuments({ seed }),
      Run.aggregate<{ _id: number; count: number }>([
        { $match: { seed } },
        { $group: { _id: '$characterId', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      // Cuenta runs (no copias): un ítem repetido en una run suma una sola vez.
      Run.aggregate<{ _id: number; count: number }>([
        { $match: { seed } },
        { $project: { ids: { $setUnion: ['$items.itemId', []] } } },
        { $unwind: '$ids' },
        { $group: { _id: '$ids', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
        { $limit: TOP_ITEMS_LIMIT },
      ]),
      Run.find({ seed })
        .sort({ createdAt: -1, _id: -1 })
        .limit(SEED_RUNS_LIMIT)
        .populate<{ author: PopulatedAuthor }>('author', 'username'),
    ]);

    if (runCount === 0) throw new HttpError('not_found');

    const body: SeedSummary = {
      seed,
      runCount,
      characters: characters.map((c) => ({ characterId: c._id, count: c.count })),
      topItems: topItems.map((i) => ({ itemId: i._id, count: i.count })),
      runs: populatedToDtos(runs as unknown as RunDocument[]),
    };
    res.json(body);
  }),
);
