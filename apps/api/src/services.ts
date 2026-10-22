import mongoose, { type Types } from 'mongoose';
import { hotScore, wilsonLowerBound } from './ranking.js';
import { EmailToken } from './models/EmailToken.js';
import { Verdict, Vote } from './models/Reactions.js';
import { Report } from './models/Report.js';
import { Run } from './models/Run.js';
import { User, type UserDocument } from './models/User.js';

/**
 * Suma `inc` a los contadores de la run y recalcula Wilson y hot a partir de los totales
 * que quedaron. Los `$inc` son atómicos; el recálculo parte del documento ya actualizado.
 */
export async function adjustStats(runId: Types.ObjectId, inc: Record<string, number>) {
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

/** Recalcula cuántos reportes abiertos tiene una run (fuente de verdad: la colección Report). */
export async function syncReportCount(runId: Types.ObjectId) {
  const open = await Report.countDocuments({ runId, status: 'open' });
  await Run.updateOne({ _id: runId }, { reportCount: open });
}

/** Cierra todas las sesiones de un usuario (connect-mongo guarda el JSON como string). */
export async function invalidateUserSessions(userId: string) {
  if (!/^[0-9a-f]{24}$/.test(userId)) return;
  await mongoose.connection
    .collection('sessions')
    .deleteMany({ session: { $regex: `"passport":\\{"user":"${userId}"\\}` } });
}

/**
 * Recalcula los contadores de una run desde los votos y veredictos que existen de verdad.
 * A diferencia de `adjustStats` (que suma/resta), es idempotente: se puede repetir sin riesgo, que
 * es lo que se necesita al borrar una cuenta (si se corta a mitad, se reintenta y queda bien).
 */
export async function recomputeRunStats(runId: Types.ObjectId) {
  const run = await Run.findById(runId);
  if (!run) return;
  const [votes, verdicts] = await Promise.all([
    Vote.aggregate<{ _id: number; n: number }>([
      { $match: { runId } },
      { $group: { _id: '$value', n: { $sum: 1 } } },
    ]),
    Verdict.aggregate<{ _id: string; n: number }>([
      { $match: { runId } },
      { $group: { _id: '$kind', n: { $sum: 1 } } },
    ]),
  ]);
  const count = <K extends string | number>(rows: { _id: K; n: number }[], key: K) =>
    rows.find((r) => r._id === key)?.n ?? 0;
  const up = count(votes, 1);
  const down = count(votes, -1);
  await Run.updateOne(
    { _id: runId },
    {
      $set: {
        'stats.up': up,
        'stats.down': down,
        'stats.op': count(verdicts, 'op'),
        'stats.troll': count(verdicts, 'troll'),
        'stats.hard': count(verdicts, 'hard'),
        'stats.wilson': wilsonLowerBound(up, down),
        'stats.hot': hotScore(up, down, run.createdAt),
      },
    },
  );
}

const CHUNK = 20;

/**
 * Borra una cuenta y todo lo suyo: sus runs (con votos, veredictos y reportes de esas runs), los
 * votos, veredictos y reportes que dejó en runs ajenas (los contadores de esas runs se corrigen),
 * tokens de email y sesiones.
 */
export async function eraseUser(user: UserDocument): Promise<void> {
  const userId = user._id;

  // 0. Cerrar sesiones antes que nada: una pestaña abierta no puede crear runs mientras se borra.
  await invalidateUserSessions(user.id);

  // 1. Sus runs y todo lo que cuelga de ellas.
  const ownRunIds = (await Run.find({ author: userId }, '_id')).map((r) => r._id);
  await Promise.all([
    Run.deleteMany({ _id: { $in: ownRunIds } }),
    Vote.deleteMany({ runId: { $in: ownRunIds } }),
    Verdict.deleteMany({ runId: { $in: ownRunIds } }),
    Report.deleteMany({ runId: { $in: ownRunIds } }),
  ]);

  // 2. Lo que dejó en runs ajenas. Se borra primero y se recalcula después desde los datos que
  //    quedan (idempotente).
  const [votes, verdicts, reports] = await Promise.all([
    Vote.find({ userId }, 'runId'),
    Verdict.find({ userId }, 'runId'),
    Report.find({ userId }, 'runId'),
  ]);
  await Promise.all([
    Vote.deleteMany({ userId }),
    Verdict.deleteMany({ userId }),
    Report.deleteMany({ userId }),
  ]);

  const statRuns = unique([...votes, ...verdicts].map((d) => d.runId));
  const reportRuns = unique(reports.map((d) => d.runId));
  for (const ids of chunks(statRuns, CHUNK)) await Promise.all(ids.map(recomputeRunStats));
  for (const ids of chunks(reportRuns, CHUNK)) await Promise.all(ids.map(syncReportCount));

  // 3. La cuenta en sí.
  await EmailToken.deleteMany({ userId });
  await invalidateUserSessions(user.id);
  await User.deleteOne({ _id: userId });
}

const unique = (ids: Types.ObjectId[]) => [...new Map(ids.map((id) => [String(id), id])).values()];

function chunks<T>(list: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}
