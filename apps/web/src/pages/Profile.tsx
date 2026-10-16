import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { EMPTY_FILTERS } from '@isaac-atlas/shared';
import { ApiRequestError } from '../api/client';
import { useProfile, useRunSearch } from '../api/runs';
import { useLang } from '../hooks/useLang';
import { RunCard } from '../runs/RunCard';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import styles from './Profile.module.css';

/** Perfil público: quién es, cuánto aportó y sus runs. Sin email ni foto. */
export function Profile() {
  const { t } = useTranslation();
  const lang = useLang();
  const { username } = useParams();
  const profile = useProfile(username);
  usePageTitle(profile.data?.username);
  const filters = useMemo(
    () => ({ ...EMPTY_FILTERS, author: username, sort: 'new' as const }),
    [username],
  );
  const runs = useRunSearch(filters);

  if (profile.isPending) return <p>{t('run.loading')}</p>;
  if (profile.error || !profile.data) {
    const notFound = profile.error instanceof ApiRequestError && profile.error.code === 'not_found';
    return <Notice tone="error">{t(notFound ? 'profile.notFound' : 'errors.internal')}</Notice>;
  }

  const { data } = profile;
  const list = runs.data?.pages.flatMap((page) => page.runs) ?? [];

  return (
    <>
      <Panel>
        <h1>{data.username}</h1>
        <p className={styles.meta}>
          {t('profile.joined', { date: new Date(data.createdAt).toLocaleDateString(lang) })}
        </p>
        <div className={styles.stats}>
          <Badge>{t('profile.runs', { count: data.runCount })}</Badge>
          <Badge tone="op">{t('profile.upvotes', { count: data.totals.up })}</Badge>
          <Badge tone="op">
            {t('verdict.op')} ×{data.totals.op}
          </Badge>
          <Badge tone="troll">
            {t('verdict.troll')} ×{data.totals.troll}
          </Badge>
          <Badge tone="hard">
            {t('verdict.hard')} ×{data.totals.hard}
          </Badge>
        </div>
      </Panel>

      <Panel title={t('profile.runsTitle')}>
        {runs.isPending ? <p>{t('run.loading')}</p> : null}
        {runs.data && list.length === 0 ? <p>{t('profile.noRuns')}</p> : null}
        <ul className={styles.list}>
          {list.map((run) => (
            <li key={run.id}>
              <RunCard run={run} />
            </li>
          ))}
        </ul>
        {runs.hasNextPage ? (
          <Button
            variant="secondary"
            disabled={runs.isFetchingNextPage}
            onClick={() => void runs.fetchNextPage()}
          >
            {t(runs.isFetchingNextPage ? 'run.loading' : 'search.loadMore')}
          </Button>
        ) : null}
      </Panel>
    </>
  );
}
