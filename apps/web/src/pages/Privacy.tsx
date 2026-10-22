import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { Panel } from '../ui/Panel';
import styles from '../auth/auth.module.css';

const SECTIONS = ['collect', 'use', 'cookies', 'share', 'rights'] as const;

/** Política de privacidad: la piden Google (OAuth en producción) y el RGPD. */
export function Privacy() {
  const { t } = useTranslation();
  usePageTitle(t('privacy.title'));

  return (
    <div className={styles.legal}>
      <Panel as="h1" title={t('privacy.title')}>
        <p>{t('privacy.intro')}</p>
        {SECTIONS.map((key) => (
          <section key={key}>
            <h2>{t(`privacy.${key}.title`)}</h2>
            <p>{t(`privacy.${key}.body`)}</p>
          </section>
        ))}
        <p>
          <Link to="/account">{t('privacy.manage')}</Link>
        </p>
      </Panel>
    </div>
  );
}
