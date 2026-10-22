import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { Panel } from '../ui/Panel';
import { CONTACT_EMAIL } from '../site';
import styles from '../auth/auth.module.css';

const SECTIONS = [
  'controller',
  'collect',
  'use',
  'basis',
  'cookies',
  'processors',
  'retention',
  'rights',
  'age',
  'takedown',
] as const;

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
          {t('privacy.contact')}: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
        <p>
          <Link to="/account">{t('privacy.manage')}</Link>
        </p>
      </Panel>
    </div>
  );
}
