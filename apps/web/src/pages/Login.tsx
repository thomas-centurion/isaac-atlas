import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { loginSchema } from '@isaac-atlas/shared';
import { SocialLogin } from '../auth/SocialLogin';
import styles from '../auth/auth.module.css';
import { errorMessage } from '../auth/errors';
import { useLogin, useMe } from '../auth/useAuth';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { TextField } from '../ui/TextField';

export function Login() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const login = useLogin();
  const location = useLocation();
  const [params] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';
  if (me) return <Navigate to={me.username ? redirectTo : '/welcome'} replace />;

  const oauthError = params.get('error');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = loginSchema.safeParse({ email, password });
    setInvalid(!parsed.success);
    if (parsed.success) login.mutate(parsed.data);
  };

  return (
    <Panel title={t('auth.loginTitle')} className={styles.page}>
      {oauthError ? <Notice tone="error">{errorMessage(t, oauthError)}</Notice> : null}
      {invalid ? <Notice tone="error">{errorMessage(t, 'validation')}</Notice> : null}
      {login.error ? <Notice tone="error">{errorMessage(t, login.error)}</Notice> : null}

      <form onSubmit={onSubmit} noValidate>
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <TextField
          label={t('auth.password')}
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={login.isPending}>
          {t('auth.login')}
        </Button>
      </form>

      <SocialLogin />

      <div className={styles.links}>
        <Link to="/register">{t('auth.noAccount')}</Link>
        <Link to="/forgot-password">{t('auth.forgot')}</Link>
      </div>
    </Panel>
  );
}
