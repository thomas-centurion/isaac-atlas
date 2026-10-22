import { randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import type { Types } from 'mongoose';
import {
  authProviderSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  setUsernameSchema,
  verifyEmailSchema,
  type MeResponse,
  type ProvidersResponse,
} from '@isaac-atlas/shared';
import {
  createLocalUser,
  resolveProviderLogin,
  setUsername,
  toPublicUser,
  unlinkIdentity,
  type ProviderProfile,
} from '../auth/accounts.js';
import { logMailFailure, sendResetMail, sendVerificationMail } from '../auth/mailer.js';
import { googleEnabled, passport, steamEnabled } from '../auth/passport.js';
import { burnPasswordCheck, hashPassword, verifyPassword } from '../auth/password.js';
import {
  buildSteamLoginUrl,
  fetchSteamAvatar,
  steamProfile,
  verifySteamAssertion,
} from '../auth/steam.js';
import { consumeToken, issueToken } from '../auth/tokens.js';
import { config } from '../config.js';
import { HttpError, asyncHandler, parseBody } from '../http.js';
import { authLimiter } from '../limiters.js';
import { invalidateUserSessions } from '../services.js';
import { currentUser, requireAuth } from '../middleware.js';
import { User, type UserDocument } from '../models/User.js';

const SESSION_COOKIE = 'isaac.sid';

declare module 'express-session' {
  interface SessionData {
    oauthIntent?: 'link';
    steamState?: string;
  }
}

const logIn = (req: Request, user: UserDocument) =>
  new Promise<void>((resolve, reject) => {
    // passport regenera el id de sesión al loguear (previene session fixation).
    req.login(user, (err) => (err ? reject(err) : resolve()));
  });

const logOut = (req: Request) =>
  new Promise<void>((resolve, reject) => {
    req.logout((err) => (err ? reject(err) : resolve()));
  });

const webUrl = (path: string) => `${config.WEB_ORIGIN}${path}`;

export const authRouter = Router();

/**
 * Emite el token y manda el mail sin esperar al proveedor (un mail lento no debe colgar la
 * respuesta). Si ya se emitió uno hace poco, no se manda otro: frena el spam a terceros.
 */
async function queueMail(
  userId: Types.ObjectId,
  kind: 'verify' | 'reset',
  send: (token: string) => Promise<void>,
) {
  const token = await issueToken(userId, kind);
  if (token) void send(token).catch(logMailFailure);
}

authRouter.get('/providers', (_req, res) => {
  const body: ProvidersResponse = { google: googleEnabled, steam: steamEnabled };
  res.json(body);
});

authRouter.get('/me', (req, res) => {
  const user = currentUser(req);
  const body: MeResponse = { user: user ? toPublicUser(user) : null };
  res.json(body);
});

// ---------- Email + contraseña ----------

authRouter.post(
  '/register',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, username, password, locale } = parseBody(registerSchema, req.body);
    const user = await createLocalUser({
      email,
      username,
      passwordHash: await hashPassword(password),
    });
    // Sin esperar al proveedor: un mail lento no debe colgar el registro.
    await queueMail(user._id, 'verify', (token) => sendVerificationMail(email, token, locale));
    await logIn(req, user);
    res.status(201).json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  '/login',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = parseBody(loginSchema, req.body);
    const user = await User.findOne({ email });
    if (!user?.passwordHash) {
      await burnPasswordCheck(password);
      throw new HttpError('invalid_credentials');
    }
    if (!(await verifyPassword(user.passwordHash, password))) {
      throw new HttpError('invalid_credentials');
    }
    await logIn(req, user);
    res.json({ user: toPublicUser(user) });
  }),
);

authRouter.post(
  '/logout',
  asyncHandler(async (req, res) => {
    await logOut(req);
    req.session.destroy(() => {
      res.clearCookie(SESSION_COOKIE);
      res.status(204).end();
    });
  }),
);

authRouter.post(
  '/verify-email',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token } = parseBody(verifyEmailSchema, req.body);
    const userId = await consumeToken(token, 'verify');
    if (!userId) throw new HttpError('invalid_token');
    await User.updateOne({ _id: userId }, { emailVerified: true });
    res.status(204).end();
  }),
);

authRouter.post(
  '/resend-verification',
  authLimiter,
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = currentUser(req)!;
    if (user.email && !user.emailVerified) {
      const to = user.email;
      const { locale } = parseBody(forgotPasswordSchema.pick({ locale: true }), req.body ?? {});
      await queueMail(user._id, 'verify', (token) => sendVerificationMail(to, token, locale));
    }
    res.status(204).end();
  }),
);

authRouter.post(
  '/forgot',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { email, locale } = parseBody(forgotPasswordSchema, req.body);
    const user = await User.findOne({ email });
    // Misma respuesta exista o no el email: no revelamos qué cuentas hay.
    if (user?.email) {
      const to = user.email;
      await queueMail(user._id, 'reset', (token) => sendResetMail(to, token, locale));
    }
    res.status(204).end();
  }),
);

authRouter.post(
  '/reset',
  authLimiter,
  asyncHandler(async (req, res) => {
    const { token, password } = parseBody(resetPasswordSchema, req.body);
    const userId = await consumeToken(token, 'reset');
    if (!userId) throw new HttpError('invalid_token');
    // Recibir el mail prueba control del email → queda verificado. Si todavía no lo estaba, quien
    // creó la cuenta pudo vincular identidades propias: se descartan.
    const passwordHash = await hashPassword(password);
    await User.updateOne({ _id: userId, emailVerified: false }, { identities: [] });
    await User.updateOne({ _id: userId }, { passwordHash, emailVerified: true });
    await invalidateUserSessions(String(userId));
    res.status(204).end();
  }),
);

// ---------- Cuenta ----------

authRouter.post(
  '/username',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { username } = parseBody(setUsernameSchema, req.body);
    const user = await setUsername(currentUser(req)!._id, username);
    res.json({ user: toPublicUser(user) });
  }),
);

authRouter.delete(
  '/identities/:provider',
  requireAuth,
  asyncHandler(async (req, res) => {
    const provider = authProviderSchema.safeParse(req.params.provider);
    if (!provider.success) throw new HttpError('not_found');
    const user = await unlinkIdentity(currentUser(req)!, provider.data);
    res.json({ user: toPublicUser(user) });
  }),
);

// ---------- OAuth / OpenID ----------

/** Login o vinculación: define qué hacer con el perfil que vuelve del proveedor. */
async function finishProviderLogin(req: Request, res: Response, profile: ProviderProfile) {
  const linking = req.session.oauthIntent === 'link';
  const current = linking ? currentUser(req) : undefined;
  const provider = profile.provider;
  try {
    const { user, created } = await resolveProviderLogin(profile, current?._id);
    if (linking) return res.redirect(webUrl(`/account?linked=${provider}`));
    await logIn(req, user);
    res.redirect(webUrl(created || !user.username ? '/welcome' : '/'));
  } catch (err) {
    const code = err instanceof HttpError ? err.code : 'internal';
    res.redirect(webUrl(linking ? `/account?error=${code}` : `/login?error=${code}`));
  }
}

const ANONYMOUS_SESSION_MS = 10 * 60 * 1000;

function startIntent(req: Request) {
  if (req.query.link === '1') {
    const user = currentUser(req);
    if (!user) throw new HttpError('unauthorized');
    // Quien registró un email sin probar que es suyo no puede colgarle identidades a la cuenta.
    if (user.email && !user.emailVerified) throw new HttpError('email_unverified');
    req.session.oauthIntent = 'link';
  } else {
    delete req.session.oauthIntent;
    // Sesión previa al login (solo guarda el state): vence rápido para que no se acumulen.
    if (!currentUser(req)) req.session.cookie.maxAge = ANONYMOUS_SESSION_MS;
  }
}

authRouter.get('/google', authLimiter, (req, res, next) => {
  if (!googleEnabled) return next(new HttpError('provider_unavailable'));
  try {
    startIntent(req);
  } catch (err) {
    return next(err);
  }
  passport.authenticate('google', { session: false })(req, res, next);
});

authRouter.get('/google/callback', authLimiter, (req, res, next) => {
  if (!googleEnabled) return next(new HttpError('provider_unavailable'));
  passport.authenticate('google', { session: false }, (err: unknown, profile: unknown) => {
    if (err || !profile) return res.redirect(webUrl('/login?error=oauth_failed'));
    finishProviderLogin(req, res, profile as ProviderProfile).catch(next);
  })(req, res, next);
});

const steamReturnTo = (state: string) =>
  `${config.PUBLIC_URL}/api/auth/steam/callback?s=${encodeURIComponent(state)}`;

authRouter.get('/steam', authLimiter, (req, res, next) => {
  try {
    startIntent(req);
  } catch (err) {
    return next(err);
  }
  // OpenID 2.0 no trae `state`: lo agregamos al return_to y lo validamos al volver.
  const state = randomBytes(16).toString('base64url');
  req.session.steamState = state;
  res.redirect(buildSteamLoginUrl(steamReturnTo(state), config.PUBLIC_URL));
});

authRouter.get(
  '/steam/callback',
  authLimiter,
  asyncHandler(async (req, res) => {
    const state = req.session.steamState;
    delete req.session.steamState;
    const sent = typeof req.query.s === 'string' ? req.query.s : undefined;
    const steamId =
      state && sent === state
        ? await verifySteamAssertion(req.query as Record<string, unknown>, steamReturnTo(state))
        : null;
    if (!steamId) return res.redirect(webUrl('/login?error=oauth_failed'));
    await finishProviderLogin(req, res, steamProfile(steamId, await fetchSteamAvatar(steamId)));
  }),
);
