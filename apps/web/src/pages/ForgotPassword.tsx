import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { forgotPasswordSchema } from '@isaac-atlas/shared';
import styles from '../auth/auth.module.css';
import { errorMessage } from '../auth/errors';
import { useForgotPassword } from '../auth/useAuth';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { TextField } from '../ui/TextField';

export function ForgotPassword() {
  const { t } = useTranslation();
  const forgot = useForgotPassword();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = forgotPasswordSchema.safeParse({ email });
    setInvalid(!parsed.success);
    if (parsed.success) forgot.mutate(parsed.data.email);
  };

  return (
    <Panel title={t('auth.forgotTitle')} className={styles.page}>
      {forgot.isSuccess ? <Notice tone="success">{t('auth.forgotSent')}</Notice> : null}
      {forgot.error ? <Notice tone="error">{errorMessage(t, forgot.error)}</Notice> : null}

      <p>{t('auth.forgotBody')}</p>
      <form onSubmit={onSubmit} noValidate>
        <TextField
          label={t('auth.email')}
          type="email"
          autoComplete="email"
          value={email}
          error={invalid ? t('fieldErrors.email') : undefined}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Button type="submit" disabled={forgot.isPending}>
          {t('auth.sendLink')}
        </Button>
      </form>
      <div className={styles.links}>
        <Link to="/login">{t('auth.backToLogin')}</Link>
      </div>
    </Panel>
  );
}
