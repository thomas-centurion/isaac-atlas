import { useEffect, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import styles from '../auth/auth.module.css';
import { errorMessage } from '../auth/errors';
import { useVerifyEmail } from '../auth/useAuth';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';

export function VerifyEmail() {
  const { t } = useTranslation();
  const [params] = useSearchParams();
  const token = params.get('token');
  const { mutate, isSuccess, error } = useVerifyEmail();
  // El token es de un solo uso: StrictMode monta los efectos dos veces en dev.
  const sent = useRef(false);

  useEffect(() => {
    if (!token || sent.current) return;
    sent.current = true;
    mutate(token);
  }, [token, mutate]);

  return (
    <Panel title={t('auth.verifyTitle')} className={styles.page}>
      {isSuccess ? <Notice tone="success">{t('auth.verified')}</Notice> : null}
      {error || !token ? (
        <Notice tone="error">{errorMessage(t, error ?? 'invalid_token')}</Notice>
      ) : null}
      {!isSuccess && !error && token ? <p>{t('auth.verifying')}</p> : null}
      <Link to="/">{t('nav.search')}</Link>
    </Panel>
  );
}
