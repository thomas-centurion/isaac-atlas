import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { registerSchema } from '@isaac-atlas/shared';
import { ProviderButtons } from '../auth/ProviderButtons';
import styles from '../auth/auth.module.css';
import { errorMessage, fieldErrors } from '../auth/errors';
import { useMe, useRegister } from '../auth/useAuth';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { TextField } from '../ui/TextField';

export function Register() {
  const { t } = useTranslation();
  const { data: me } = useMe();
  const register = useRegister();
  const [values, setValues] = useState({ email: '', username: '', password: '' });
  const [clientErrors, setClientErrors] = useState<Record<string, true>>({});

  if (me) return <Navigate to="/" replace />;

  const invalid = { ...clientErrors, ...fieldErrors(register.error) };
  const fieldError = (name: keyof typeof values) =>
    invalid[name] ? t(`fieldErrors.${name}`) : undefined;
  const bind = (name: keyof typeof values) => ({
    value: values[name],
    error: fieldError(name),
    onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
      setValues((v) => ({ ...v, [name]: e.target.value })),
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsed = registerSchema.safeParse(values);
    setClientErrors(
      parsed.success
        ? {}
        : Object.fromEntries(parsed.error.issues.map((i) => [i.path.join('.'), true as const])),
    );
    if (parsed.success) register.mutate(parsed.data);
  };

  // Los errores de campo ya se muestran junto al input.
  const showGeneral = register.error && !(Object.keys(fieldErrors(register.error)).length > 0);

  return (
    <Panel title={t('auth.registerTitle')} className={styles.page}>
      {showGeneral ? <Notice tone="error">{errorMessage(t, register.error)}</Notice> : null}

      <form onSubmit={onSubmit} noValidate>
        <TextField label={t('auth.email')} type="email" autoComplete="email" {...bind('email')} />
        <TextField
          label={t('auth.username')}
          hint={t('auth.usernameHint')}
          autoComplete="username"
          maxLength={20}
          {...bind('username')}
        />
        <TextField
          label={t('auth.password')}
          hint={t('auth.passwordHint')}
          type="password"
          autoComplete="new-password"
          {...bind('password')}
        />
        <Button type="submit" disabled={register.isPending}>
          {t('auth.register')}
        </Button>
      </form>

      <p className={styles.divider}>{t('auth.or')}</p>
      <ProviderButtons />

      <div className={styles.links}>
        <Link to="/login">{t('auth.haveAccount')}</Link>
      </div>
    </Panel>
  );
}
