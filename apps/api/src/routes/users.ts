import { Router } from 'express';
import { usernameSchema, type Profile } from '@isaac-atlas/shared';
import { HttpError, asyncHandler } from '../http.js';
import { Run } from '../models/Run.js';
import { User } from '../models/User.js';
import { VISIBLE_RUNS } from '../runDto.js';

export const usersRouter = Router();

/**
 * Perfil público de un usuario: solo username, fecha de alta y totales. No se expone email ni
 * avatar. Las runs del usuario se listan con GET /api/runs?author=<username>.
 */
usersRouter.get(
  '/:username',
  asyncHandler(async (req, res) => {
    const parsed = usernameSchema.safeParse(req.params.username);
    if (!parsed.success) throw new HttpError('not_found');
    const user = await User.findOne({ usernameLower: parsed.data.toLowerCase() });
    if (!user?.username) throw new HttpError('not_found');

    const [totals] = await Run.aggregate<{
      runCount: number;
      up: number;
      op: number;
      troll: number;
      hard: number;
    }>([
      { $match: { author: user._id, ...VISIBLE_RUNS } },
      {
        $group: {
          _id: null,
          runCount: { $sum: 1 },
          up: { $sum: '$stats.up' },
          op: { $sum: '$stats.op' },
          troll: { $sum: '$stats.troll' },
          hard: { $sum: '$stats.hard' },
        },
      },
    ]);

    const body: Profile = {
      username: user.username,
      createdAt: user.createdAt.toISOString(),
      runCount: totals?.runCount ?? 0,
      totals: {
        up: totals?.up ?? 0,
        op: totals?.op ?? 0,
        troll: totals?.troll ?? 0,
        hard: totals?.hard ?? 0,
      },
    };
    res.json(body);
  }),
);
