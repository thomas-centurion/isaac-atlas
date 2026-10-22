import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import styles from '../auth/auth.module.css';
import { errorMessage } from '../auth/errors';
import { useVerifyEmail } from '../auth/useAuth';
import { ButtonLink } from '../ui/ButtonLink';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';

export function VerifyEmail() {
  const { t } = useTranslation();
  usePageTitle(t('auth.verifyTitle'));
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
    <Panel as="h1" title={t('auth.verifyTitle')} className={`${styles.page} ${styles.center}`}>
      {isSuccess ? <Notice tone="success">{t('auth.verified')}</Notice> : null}
      {error || !token ? (
        <Notice tone="error">{errorMessage(t, error ?? 'invalid_token')}</Notice>
      ) : null}
      {!isSuccess && !error && token ? <p>{t('auth.verifying')}</p> : null}
      <ButtonLink href="/" variant={isSuccess ? 'primary' : 'secondary'}>
        {t('auth.goHome')}
      </ButtonLink>
    </Panel>
  );
}
