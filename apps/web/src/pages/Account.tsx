import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { AUTH_PROVIDERS, authProviderSchema } from '@isaac-atlas/shared';
import { ProviderButtons } from '../auth/ProviderButtons';
import styles from '../auth/auth.module.css';
import { errorMessage } from '../auth/errors';
import { useMe, useResendVerification, useUnlink } from '../auth/useAuth';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';

export function Account() {
  const { t } = useTranslation();
  usePageTitle(t('account.title'));
  const { data: me } = useMe();
  const unlink = useUnlink();
  const resend = useResendVerification();
  const [params] = useSearchParams();
  if (!me) return null;

  const linked = authProviderSchema.safeParse(params.get('linked'));
  const error = params.get('error');
  const linkedProviders = me.identities.map((i) => i.provider);
  // Siempre debe quedar un método de acceso.
  const canUnlink = me.hasPassword || me.identities.length > 1;

  return (
    <>
      <Panel as="h1" title={t('account.title')}>
        {linked.success ? (
          <Notice tone="success">
            {t('account.linked', { provider: t(`auth.providers.${linked.data}`) })}
          </Notice>
        ) : null}
        {error ? <Notice tone="error">{errorMessage(t, error)}</Notice> : null}

        {me.avatar ? (
          <img src={me.avatar} alt="" className={styles.avatar} referrerPolicy="no-referrer" />
        ) : null}
        <h3>{me.username}</h3>
        {me.email ? (
          <p>
            {me.email}{' '}
            {me.emailVerified ? (
              <Badge tone="troll">{t('account.verified')}</Badge>
            ) : (
              <Badge tone="hard">{t('account.unverified')}</Badge>
            )}
          </p>
        ) : null}
        {me.email && !me.emailVerified ? (
          <>
            {resend.isSuccess ? <Notice tone="success">{t('account.resent')}</Notice> : null}
            <Button variant="secondary" onClick={() => resend.mutate()} disabled={resend.isPending}>
              {t('account.resend')}
            </Button>
          </>
        ) : null}
      </Panel>

      <Panel title={t('account.connections')}>
        {unlink.error ? <Notice tone="error">{errorMessage(t, unlink.error)}</Notice> : null}
        <ul className={styles.identities}>
          {AUTH_PROVIDERS.filter((p) => linkedProviders.includes(p)).map((provider) => (
            <li key={provider} className={styles.identity}>
              <span>{t(`auth.providers.${provider}`)}</span>
              <Button
                variant="danger"
                disabled={!canUnlink || unlink.isPending}
                onClick={() => unlink.mutate(provider)}
              >
                {t('account.unlink')}
              </Button>
            </li>
          ))}
        </ul>
        {!canUnlink && linkedProviders.length > 0 ? <p>{t('account.lastMethod')}</p> : null}
        <ProviderButtons link exclude={linkedProviders} />
      </Panel>
    </>
  );
}
