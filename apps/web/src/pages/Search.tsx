import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../hooks/usePageTitle';
import {
  SORT_MODES,
  filtersFromParams,
  filtersToParams,
  hasActiveFilters,
  type SearchFilters,
  type SortMode,
} from '@isaac-atlas/shared';
import { useDaily, useRunSearch } from '../api/runs';
import { RunCard } from '../runs/RunCard';
import { FilterPanel } from '../search/FilterPanel';
import { Button } from '../ui/Button';
import { ItemIcon } from '../ui/ItemIcon';
import { Notice } from '../ui/Notice';
import { Tabs } from '../ui/Tabs';
import styles from './Search.module.css';

/** Cuántos filtros hay aplicados (para el botón "Filtros (3)" en pantallas chicas). */
function activeCount(f: SearchFilters): number {
  return (
    [f.character, f.difficulty, f.result, f.fullUnlocks, f.verdict, f.seed, f.author].filter(
      (v) => v !== undefined,
    ).length +
    f.startItems.length +
    f.items.length +
    f.exclude.length
  );
}

/** Página principal: buscar seeds por personaje, ítems iniciales y sinergias. Los filtros viven en la URL. */
export function Search() {
  const { t } = useTranslation();
  usePageTitle(t('nav.search'));
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => filtersFromParams(params), [params]);
  const focusRef = useRef<HTMLInputElement>(null);
  const search = useRunSearch(filters);
  const daily = useDaily();
  // En pantallas chicas los filtros están plegados detrás de un botón.
  const [filtersOpen, setFiltersOpen] = useState(false);

  const update = (next: SearchFilters) => setParams(filtersToParams(next), { replace: true });

  // Atajo "/": enfoca el primer buscador de ítems (y abre los filtros si estaban plegados).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
      if (e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        setFiltersOpen(true);
        // Esperar a que el panel se muestre antes de enfocar.
        requestAnimationFrame(() => focusRef.current?.focus());
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const runs = search.data?.pages.flatMap((page) => page.runs) ?? [];
  const highlight = [...filters.startItems, ...filters.items];
  const active = activeCount(filters);

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <button
          type="button"
          className={styles.toggle}
          aria-expanded={filtersOpen}
          aria-controls="filters-panel"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {t('search.filters')}
          {active > 0 ? <span className={styles.count}>{active}</span> : null}
          <span aria-hidden="true" className={styles.chevron}>
            {filtersOpen ? '▴' : '▾'}
          </span>
        </button>
        <div
          id="filters-panel"
          className={`${styles.filters} ${filtersOpen ? styles.filtersOpen : ''}`}
        >
          <FilterPanel filters={filters} onChange={update} focusRef={focusRef} />
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.hero}>
          <h1>{t('search.title')}</h1>
          <p>{t('search.intro')}</p>
        </header>

        {params.get('account') === 'deleted' ? (
          <Notice tone="success">{t('account.deleted')}</Notice>
        ) : null}

        {daily.data?.run ? (
          <section className={styles.daily} aria-labelledby="daily-title">
            <h2 id="daily-title" className={styles.dailyTitle}>
              <span aria-hidden="true">★</span> {t('search.daily')}
            </h2>
            <p className={styles.hint}>{t('search.dailyHint')}</p>
            <RunCard run={daily.data.run} featured />
          </section>
        ) : null}

        <section aria-labelledby="results-title">
          <div className={styles.resultsHead}>
            <h2 id="results-title" className={styles.resultsTitle}>
              {t('search.results')}
            </h2>
            <Tabs<SortMode>
              label={t('search.sortBy')}
              value={filters.sort}
              onChange={(sort) => update({ ...filters, sort })}
              options={SORT_MODES.map((mode) => ({ value: mode, label: t(`sort.${mode}`) }))}
            />
          </div>

          {search.isPending ? <p>{t('run.loading')}</p> : null}
          {search.error ? <Notice tone="error">{t('errors.internal')}</Notice> : null}

          {search.data && runs.length === 0 ? (
            <div className={styles.empty}>
              <ItemIcon kind="item" id={105} scale={2} />
              <p>{t(hasActiveFilters(filters) ? 'search.noMatches' : 'search.noRunsYet')}</p>
              <Link to="/runs/new" className={styles.cta}>
                {t('search.beFirst')}
              </Link>
            </div>
          ) : null}

          <ul className={styles.grid} aria-live="polite">
            {runs.map((run) => (
              <li key={run.id}>
                <RunCard run={run} highlight={highlight} />
              </li>
            ))}
          </ul>

          {search.hasNextPage ? (
            <div className={styles.more}>
              <Button
                variant="secondary"
                disabled={search.isFetchingNextPage}
                onClick={() => void search.fetchNextPage()}
              >
                {t(search.isFetchingNextPage ? 'run.loading' : 'search.loadMore')}
              </Button>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
