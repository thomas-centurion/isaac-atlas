import { useEffect, useMemo, useRef } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import { filtersFromParams, filtersToParams, hasActiveFilters } from '@isaac-atlas/shared';
import { SORT_MODES, type SearchFilters, type SortMode } from '@isaac-atlas/shared';
import { useDaily, useRunSearch } from '../api/runs';
import { RunCard } from '../runs/RunCard';
import { FilterPanel } from '../search/FilterPanel';
import { Button } from '../ui/Button';
import { Notice } from '../ui/Notice';
import { Panel } from '../ui/Panel';
import { Tabs } from '../ui/Tabs';
import styles from './Search.module.css';

/** Página principal: buscar seeds por personaje, ítems iniciales y sinergias. Los filtros viven en la URL. */
export function Search() {
  const { t } = useTranslation();
  usePageTitle(t('nav.search'));
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const focusRef = useRef<HTMLInputElement>(null);
  const search = useRunSearch(filters);
  const daily = useDaily();

  const update = (next: SearchFilters) => setParams(filtersToParams(next), { replace: true });

  // Atajo "/": enfoca el primer buscador de ítems.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        focusRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runs = search.data?.pages.flatMap((page) => page.runs) ?? [];
  const highlight = [...filters.startItems, ...filters.items];

  return (
    <>
      <Panel>
        <h1>{t('search.title')}</h1>
        <p>{t('search.intro')}</p>
      </Panel>

      {daily.data?.run ? (
        <Panel title={t('search.daily')}>
          <p className={styles.hint}>{t('search.dailyHint')}</p>
          <RunCard run={daily.data.run} />
        </Panel>
      ) : null}

      <FilterPanel filters={filters} onChange={update} focusRef={focusRef} />

      <Panel title={t('search.results')}>
        <Tabs<SortMode>
          label={t('search.sortBy')}
          value={filters.sort}
          onChange={(sort) => update({ ...filters, sort })}
          options={SORT_MODES.map((mode) => ({ value: mode, label: t(`sort.${mode}`) }))}
        />
        {search.isPending ? <p>{t('run.loading')}</p> : null}
        {search.error ? <Notice tone="error">{t('errors.internal')}</Notice> : null}

        {search.data && runs.length === 0 ? (
          <div>
            <p>{t(hasActiveFilters(filters) ? 'search.noMatches' : 'search.noRunsYet')}</p>
            <Link to="/runs/new">{t('search.beFirst')}</Link>
          </div>
        ) : null}

        <ul className={styles.list} aria-live="polite">
          {runs.map((run) => (
            <li key={run.id}>
              <RunCard run={run} highlight={highlight} />
            </li>
          ))}
        </ul>

        {search.hasNextPage ? (
          <Button
            variant="secondary"
            disabled={search.isFetchingNextPage}
            onClick={() => void search.fetchNextPage()}
          >
            {t(search.isFetchingNextPage ? 'run.loading' : 'search.loadMore')}
          </Button>
        ) : null}
      </Panel>
    </>
  );
}
