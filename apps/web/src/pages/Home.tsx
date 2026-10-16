import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Panel } from '../ui/Panel';

export function Home() {
  const { t } = useTranslation();
  return (
    <Panel>
      <h1>{t('home.title')}</h1>
      <p>{t('home.body')}</p>
      <Link to="/design">{t('home.cta')}</Link>
    </Panel>
  );
}
