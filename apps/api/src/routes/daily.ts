import { Router } from 'express';
import type { Types } from 'mongoose';
import type { DailyResponse } from '@isaac-atlas/shared';
import { asyncHandler } from '../http.js';
import { currentUser } from '../middleware.js';
import { DailyPick } from '../models/Reactions.js';
import { Run, type RunDocument } from '../models/Run.js';
import { attachViewer, populatedToDtos, type PopulatedAuthor } from '../runDto.js';

const CANDIDATE_WINDOW_DAYS = 30;
const NO_REPEAT_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const utcDate = (d: Date) => d.toISOString().slice(0, 10);

const loadPopulated = (id: Types.ObjectId) =>
  Run.findById(id).populate<{ author: PopulatedAuthor }>(
    'author',
    'username',
  ) as unknown as Promise<RunDocument | null>;

/** La mejor run reciente (Wilson) que no haya sido seed del día hace poco. */
async function choose(now: Date): Promise<Types.ObjectId | null> {
  const recentPicks = await DailyPick.find({
    date: { $gte: utcDate(new Date(now.getTime() - NO_REPEAT_DAYS * DAY_MS)) },
  });
  const recentIds = recentPicks.map((p) => p.runId);
  const best = { 'stats.wilson': -1, createdAt: -1, _id: -1 } as const;

  const fresh = await Run.findOne({
    _id: { $nin: recentIds },
    createdAt: { $gte: new Date(now.getTime() - CANDIDATE_WINDOW_DAYS * DAY_MS) },
  }).sort(best);
  if (fresh) return fresh._id;

  // Poca actividad: se amplía a runs más viejas y, si ya se usaron todas, se repite alguna.
  const older = await Run.findOne({ _id: { $nin: recentIds } }).sort(best);
  if (older) return older._id;
  const any = await Run.findOne().sort(best);
  return any?._id ?? null;
}

async function dailyRun(date: string, now: Date): Promise<RunDocument | null> {
  const existing = await DailyPick.findOne({ date });
  if (existing) {
    const run = await loadPopulated(existing.runId);
    if (run) return run;
    // La run elegida fue borrada: se vuelve a elegir.
    await DailyPick.deleteOne({ date });
  }

  const chosen = await choose(now);
  if (!chosen) return null;
  // El índice único por fecha hace que, si dos peticiones compiten, gane una sola elección.
  const pick = await DailyPick.findOneAndUpdate(
    { date },
    { $setOnInsert: { runId: chosen } },
    { upsert: true, new: true },
  );
  return loadPopulated(pick.runId);
}

export const dailyRouter = Router();

/**
 * Seed del día: se elige la primera vez que alguien la pide en la fecha UTC y queda fija
 * todo el día (aunque cambien los votos).
 */
dailyRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const now = new Date();
    const date = utcDate(now);
    const doc = await dailyRun(date, now);
    const [run] = doc ? await attachViewer(populatedToDtos([doc]), currentUser(req)) : [];
    const body: DailyResponse = { date, run: run ?? null };
    res.json(body);
  }),
);
