import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMyRuns } from '../api/runs';
import { RunCard } from '../runs/RunCard';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import styles from './MyRuns.module.css';

export function MyRuns() {
  const { t } = useTranslation();
  const { data: runs, isPending, error } = useMyRuns();

  return (
    <Panel title={t('run.myRuns')}>
      <p>
        <Link to="/runs/new">{t('run.newCta')}</Link>
      </p>
      {isPending ? <p>{t('run.loading')}</p> : null}
      {error ? <Notice tone="error">{t('errors.internal')}</Notice> : null}
      {runs?.length === 0 ? <p>{t('run.emptyMine')}</p> : null}

      <ul className={styles.list}>
        {runs?.map((run) => (
          <li key={run.id}>
            <RunCard run={run} showAuthor={false} />
          </li>
        ))}
      </ul>
    </Panel>
  );
}
