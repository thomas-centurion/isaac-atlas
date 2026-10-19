import { Router } from 'express';
import { isValidObjectId } from 'mongoose';
import {
  reportInputSchema,
  resolveReportSchema,
  type Report as ReportDto,
} from '@isaac-atlas/shared';
import { HttpError, asyncHandler, parseBody } from '../http.js';
import { syncReportCount } from '../services.js';
import { reportLimiter } from '../limiters.js';
import { currentUser, requireAdmin, requireAuth, requireUsername } from '../middleware.js';
import { Report } from '../models/Report.js';
import { Run, type RunDocument } from '../models/Run.js';
import { User } from '../models/User.js';
import { deleteRunCascade, loadRun, populatedToDtos, type PopulatedAuthor } from '../runDto.js';

/** POST /api/runs/:id/report — cualquier usuario con cuenta puede reportar una run ajena. */
export const reportRouter = Router();

reportRouter.post(
  '/:id/report',
  requireAuth,
  requireUsername,
  reportLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const input = parseBody(reportInputSchema, req.body);
    const { run, author } = await loadRun(String(req.params.id));
    // Reportar la propia run no tiene sentido (y permitiría ocultarla a propósito).
    if (String(author._id) === user.id) throw new HttpError('forbidden');

    try {
      await Report.create({
        userId: user._id,
        runId: run._id,
        reason: input.reason,
        details: input.details,
      });
    } catch (err) {
      if ((err as { code?: number }).code === 11000) throw new HttpError('already_reported');
      throw err;
    }
    await syncReportCount(run._id);
    res.status(201).end();
  }),
);

/** Panel de moderación (solo admin). */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);

adminRouter.get(
  '/reports',
  asyncHandler(async (_req, res) => {
    const reports = await Report.find({ status: 'open' }).sort({ createdAt: -1 }).limit(50);

    const [runs, reporters] = await Promise.all([
      Run.find({ _id: { $in: reports.map((r) => r.runId) } }).populate<{
        author: PopulatedAuthor;
      }>('author', 'username'),
      User.find({ _id: { $in: reports.map((r) => r.userId) } }, 'username'),
    ]);
    const runById = new Map(
      populatedToDtos(runs as unknown as RunDocument[]).map((dto) => [dto.id, dto]),
    );
    const reporterById = new Map(reporters.map((u) => [u.id, u.username ?? '']));

    const body: ReportDto[] = reports.flatMap((r) => {
      const run = runById.get(String(r.runId));
      return run
        ? [
            {
              id: r.id,
              reason: r.reason,
              details: r.details,
              status: r.status,
              createdAt: r.createdAt.toISOString(),
              reporter: { username: reporterById.get(String(r.userId)) ?? '' },
              run,
            },
          ]
        : [];
    });
    res.json({ reports: body });
  }),
);

/**
 * Resolver afecta a TODOS los reportes abiertos de esa run: la revisión es por run, no por
 * reporte. `dismiss` la devuelve a las listas; `remove_run` la borra.
 */
adminRouter.post(
  '/reports/:id/resolve',
  asyncHandler(async (req, res) => {
    const { action } = parseBody(resolveReportSchema, req.body);
    const id = String(req.params.id);
    const report = isValidObjectId(id) ? await Report.findById(id) : null;
    if (!report) throw new HttpError('not_found');

    if (action === 'remove_run') {
      // Se marcan como resueltos antes de borrar, así queda constancia si el borrado se interrumpe.
      await Report.updateMany({ runId: report.runId, status: 'open' }, { status: 'actioned' });
      await deleteRunCascade(report.runId, { keepReports: true });
    } else {
      await Report.updateMany({ runId: report.runId, status: 'open' }, { status: 'dismissed' });
      await syncReportCount(report.runId);
    }
    res.status(204).end();
  }),
);
