import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { config } from '../config.js';
import { User } from '../models/User.js';
import type { ProviderProfile } from './accounts.js';

export const googleEnabled = Boolean(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET);
export const steamEnabled = true; // OpenID no requiere credenciales

passport.serializeUser((user, done) => done(null, (user as { id: string }).id));
passport.deserializeUser((id: string, done) => {
  User.findById(id)
    .then((user) => done(null, user ?? false))
    .catch(done);
});

if (googleEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: config.GOOGLE_CLIENT_ID!,
        clientSecret: config.GOOGLE_CLIENT_SECRET!,
        callbackURL: `${config.PUBLIC_URL}/api/auth/google/callback`,
        scope: ['profile', 'email'],
        // `state` en la sesión: protege el callback contra CSRF.
        state: true,
      },
      (_accessToken, _refreshToken, profile, done) => {
        const email = profile.emails?.[0];
        // Entregamos el perfil normalizado; la ruta decide qué cuenta le corresponde.
        const normalized: ProviderProfile = {
          provider: 'google',
          providerId: profile.id,
          emailVerified: Boolean(email?.verified),
          ...(email?.value ? { email: email.value.toLowerCase() } : {}),
          ...(profile.photos?.[0]?.value ? { avatar: profile.photos[0].value } : {}),
        };
        done(null, normalized as unknown as Express.User);
      },
    ),
  );
}

export { passport };
