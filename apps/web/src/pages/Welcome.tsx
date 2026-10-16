import { useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { usernameSchema } from '@isaac-atlas/shared';
import styles from '../auth/auth.module.css';
import { errorMessage } from '../auth/errors';
import { useMe, useSetUsername } from '../auth/useAuth';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { TextField } from '../ui/TextField';

/** Onboarding: las cuentas creadas con Google/Steam eligen su username acá. */
export function Welcome() {
  const { t } = useTranslation();
  usePageTitle(t('auth.welcomeTitle'));
  const navigate = useNavigate();
  const { data: me } = useMe();
  const setUsername = useSetUsername();
  const [username, setName] = useState('');
  const [invalid, setInvalid] = useState(false);

  if (me?.username) return <Navigate to="/" replace />;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = usernameSchema.safeParse(username);
    setInvalid(!parsed.success);
    if (parsed.success) {
      setUsername.mutate(
        { username: parsed.data },
        { onSuccess: () => navigate('/', { replace: true }) },
      );
    }
  };

  return (
    <Panel as="h1" title={t('auth.welcomeTitle')} className={styles.page}>
      <p>{t('auth.welcomeBody')}</p>
      {setUsername.error ? (
        <Notice tone="error">{errorMessage(t, setUsername.error)}</Notice>
      ) : null}
      <form onSubmit={onSubmit} noValidate>
        <TextField
          label={t('auth.username')}
          hint={t('auth.usernameHint')}
          autoComplete="username"
          maxLength={20}
          value={username}
          error={invalid ? t('fieldErrors.username') : undefined}
          onChange={(e) => setName(e.target.value)}
        />
        <Button type="submit" disabled={setUsername.isPending}>
          {t('auth.welcomeSubmit')}
        </Button>
      </form>
    </Panel>
  );
}
