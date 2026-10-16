import { isValidObjectId, type Types } from 'mongoose';
import type { Run as RunDto } from '@isaac-atlas/shared';
import { HttpError } from './http.js';
import { Run, type RunDocument } from './models/Run.js';
import { Verdict, Vote } from './models/Reactions.js';
import type { UserDocument } from './models/User.js';

export type PopulatedAuthor = Pick<UserDocument, 'username'> & { _id: Types.ObjectId };

export const authorDto = (a: PopulatedAuthor) => ({
  id: String(a._id),
  username: a.username ?? '',
});

export function toRunDto(run: RunDocument, author: { id: string; username: string }): RunDto {
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
    stats: {
      up: run.stats?.up ?? 0,
      down: run.stats?.down ?? 0,
      op: run.stats?.op ?? 0,
      troll: run.stats?.troll ?? 0,
      hard: run.stats?.hard ?? 0,
    },
  };
}

/** Runs con el autor ya poblado → DTOs. Descarta runs cuyo autor ya no existe. */
export function populatedToDtos(runs: RunDocument[]): RunDto[] {
  return runs.flatMap((run) => {
    const author = (run as unknown as { author: PopulatedAuthor | null }).author;
    return author ? [toRunDto(run, authorDto(author))] : [];
  });
}

/**
 * Agrega a cada run lo que el usuario logueado ya votó / marcó (2 consultas para toda la página,
 * no una por run). Sin sesión devuelve las runs tal cual.
 */
export async function attachViewer(
  runs: RunDto[],
  user: UserDocument | undefined,
): Promise<RunDto[]> {
  if (!user || runs.length === 0) return runs;
  const runIds = runs.map((r) => r.id);
  const [votes, verdicts] = await Promise.all([
    Vote.find({ userId: user._id, runId: { $in: runIds } }),
    Verdict.find({ userId: user._id, runId: { $in: runIds } }),
  ]);
  const voteByRun = new Map(votes.map((v) => [String(v.runId), v.value]));
  const verdictByRun = new Map(verdicts.map((v) => [String(v.runId), v.kind]));
  return runs.map((r) => ({
    ...r,
    viewer: { vote: voteByRun.get(r.id) ?? 0, verdict: verdictByRun.get(r.id) ?? null },
  }));
}

export async function loadRun(id: string): Promise<{ run: RunDocument; author: PopulatedAuthor }> {
  if (!isValidObjectId(id)) throw new HttpError('not_found');
  const run = await Run.findById(id).populate<{ author: PopulatedAuthor }>('author', 'username');
  if (!run || !run.author) throw new HttpError('not_found');
  return { run: run as unknown as RunDocument, author: run.author };
}
