import { Router, type Request } from 'express';
import { deleteAccountSchema } from '@isaac-atlas/shared';
import { verifyPassword } from '../auth/password.js';
import { HttpError, asyncHandler, parseBody } from '../http.js';
import { authLimiter, exportLimiter } from '../limiters.js';
import { currentUser, requireAuth } from '../middleware.js';
import { Verdict, Vote } from '../models/Reactions.js';
import { Report } from '../models/Report.js';
import { Run } from '../models/Run.js';
import { toRunDto } from '../runDto.js';
import { eraseUser } from '../services.js';

const SESSION_COOKIE = 'isaac.sid';

const logOut = (req: Request) =>
  new Promise<void>((resolve, reject) => {
    req.logout((err) => (err ? reject(err) : resolve()));
  });

export const accountRouter = Router();
accountRouter.use(requireAuth);

/**
 * GET /api/account/export — todos los datos de la cuenta en un JSON descargable (portabilidad).
 * Incluye lo que el usuario cargó y dejó en la comunidad; nunca hashes, tokens ni sesiones.
 */
accountRouter.get(
  '/export',
  exportLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const [runs, votes, verdicts, reports] = await Promise.all([
      Run.find({ author: user._id }).sort({ createdAt: -1 }),
      Vote.find({ userId: user._id }),
      Verdict.find({ userId: user._id }),
      Report.find({ userId: user._id }),
    ]);
    const author = { id: user.id, username: user.username ?? '' };

    const body = {
      exportedAt: new Date().toISOString(),
      account: {
        id: user.id,
        username: user.username ?? null,
        email: user.email ?? null,
        emailVerified: user.emailVerified,
        role: user.role,
        createdAt: user.createdAt.toISOString(),
        hasPassword: Boolean(user.passwordHash),
        identities: user.identities.map((i) => ({
          provider: i.provider,
          providerId: i.providerId,
          linkedAt: i.linkedAt.toISOString(),
        })),
      },
      runs: runs.map((r) => ({ ...toRunDto(r, author), editedAt: r.editedAt?.toISOString() })),
      votes: votes.map((v) => ({ runId: String(v.runId), value: v.value })),
      verdicts: verdicts.map((v) => ({ runId: String(v.runId), kind: v.kind })),
      reports: reports.map((r) => ({
        runId: String(r.runId),
        reason: r.reason,
        details: r.details,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      })),
    };

    const day = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="isaac-atlas-${user.username ?? 'cuenta'}-${day}.json"`,
    );
    res.setHeader('Cache-Control', 'no-store');
    res.type('application/json').send(JSON.stringify(body, null, 2));
  }),
);

/**
 * DELETE /api/account — borra la cuenta y todo lo suyo (irreversible). Se confirma con la
 * contraseña; las cuentas sin contraseña (solo Google/Steam) escriben su username.
 */
accountRouter.delete(
  '/',
  authLimiter,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    const { confirm } = parseBody(deleteAccountSchema, req.body);

    const confirmed = user.passwordHash
      ? await verifyPassword(user.passwordHash, confirm)
      : user.username !== undefined && confirm === user.username;
    if (!confirmed) throw new HttpError('confirmation_failed');

    await eraseUser(user);
    await logOut(req);
    req.session.destroy(() => {
      res.clearCookie(SESSION_COOKIE);
      res.status(204).end();
    });
  }),
);
