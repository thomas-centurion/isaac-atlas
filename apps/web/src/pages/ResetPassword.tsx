import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { passwordSchema } from '@isaac-atlas/shared';
import styles from '../auth/auth.module.css';
import { errorMessage } from '../auth/errors';
import { useResetPassword } from '../auth/useAuth';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { TextField } from '../ui/TextField';

export function ResetPassword() {
  const { t } = useTranslation();
  usePageTitle(t('auth.resetTitle'));
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [invalid, setInvalid] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const ok = passwordSchema.safeParse(password).success;
    setInvalid(!ok);
    if (ok) reset.mutate({ token, password });
  };

  return (
    <Panel as="h1" title={t('auth.resetTitle')} className={styles.page}>
      {reset.isSuccess ? (
        <>
          <Notice tone="success">{t('auth.resetDone')}</Notice>
          <Link to="/login">{t('auth.backToLogin')}</Link>
        </>
      ) : (
        <>
          {!token ? <Notice tone="error">{errorMessage(t, 'invalid_token')}</Notice> : null}
          {reset.error ? <Notice tone="error">{errorMessage(t, reset.error)}</Notice> : null}
          <form onSubmit={onSubmit} noValidate>
            <TextField
              label={t('auth.newPassword')}
              hint={t('auth.passwordHint')}
              type="password"
              autoComplete="new-password"
              value={password}
              error={invalid ? t('fieldErrors.password') : undefined}
              onChange={(e) => setPassword(e.target.value)}
            />
            <Button type="submit" disabled={reset.isPending || !token}>
              {t('auth.resetSubmit')}
            </Button>
          </form>
        </>
      )}
    </Panel>
  );
}
