import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import styles from '../auth/auth.module.css';
import { ButtonLink } from '../ui/ButtonLink';
import { Panel } from '../ui/Panel';

/** Cualquier URL que no existe: antes dejaba la pantalla vacía. */
export function NotFound() {
  const { t } = useTranslation();
  usePageTitle(t('notFoundPage.title'));

  return (
    <Panel as="h1" title={t('notFoundPage.title')} className={`${styles.page} ${styles.center}`}>
      <p>{t('notFoundPage.body')}</p>
      <ButtonLink href="/" variant="primary">
        {t('auth.goHome')}
      </ButtonLink>
    </Panel>
  );
}
