import { useEffect, useState, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import {
  DIFFICULTIES,
  MAX_FILTER_ITEMS,
  RUN_RESULTS,
  VERDICT_KINDS,
  catalog,
  formatSeed,
  hasActiveFilters,
  isValidSeedFormat,
  normalizeSeed,
  type SearchFilters,
} from '@isaac-atlas/shared';
import { useLang } from '../hooks/useLang';
import { ItemPicker } from '../runs/ItemPicker';
import { characterLabel } from '../runs/labels';
import { Select } from '../ui/Select';
import { TextField } from '../ui/TextField';
import { ItemChips } from './ItemChips';
import styles from './FilterPanel.module.css';

type ItemList = 'startItems' | 'items';

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  /** Se enfoca con el atajo "/" (lo registra la página). */
  focusRef?: RefObject<HTMLInputElement>;
}

/** Barra lateral de filtros: lo principal (personaje e ítems) a la vista, el resto en "Más filtros". */
export function FilterPanel({ filters, onChange, focusRef }: FilterPanelProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const [seedText, setSeedText] = useState(filters.seed ? formatSeed(filters.seed) : '');

  // Si los filtros cambian desde afuera (limpiar, botón atrás), el campo sigue a la URL.
  useEffect(() => {
    setSeedText((current) =>
      normalizeSeed(current) === (filters.seed ?? '')
        ? current
        : filters.seed
          ? formatSeed(filters.seed)
          : '',
    );
  }, [filters.seed]);

  const regular = catalog.characters.filter((c) => !c.tainted);
  const tainted = catalog.characters.filter((c) => c.tainted);

  const set = (patch: Partial<SearchFilters>) => onChange({ ...filters, ...patch });
  /** Quita un filtro opcional (en vez de dejarlo en `undefined`, para que no viaje en la URL). */
  const unset = (
    key: 'character' | 'difficulty' | 'result' | 'fullUnlocks' | 'seed' | 'verdict',
  ) => {
    const next = { ...filters };
    delete next[key];
    onChange(next);
  };

  const onSeedChange = (raw: string) => {
    const text = raw.toUpperCase();
    setSeedText(text);
    if (text.trim() === '') unset('seed');
    else if (isValidSeedFormat(text)) set({ seed: normalizeSeed(text) });
  };

  const addItem = (list: ItemList, id: number) => {
    if (filters[list].includes(id) || filters[list].length >= MAX_FILTER_ITEMS) return;
    onChange({ ...filters, [list]: [...filters[list], id] });
  };
  const removeItem = (list: ItemList, id: number) =>
    set({ [list]: filters[list].filter((x) => x !== id) });

  const pickers: { list: ItemList; label: string; hint: string }[] = [
    { list: 'startItems', label: t('search.startsWith'), hint: t('search.startsWithHint') },
    { list: 'items', label: t('search.hasItems'), hint: t('search.hasItemsHint') },
  ];

  // "Más filtros" se abre solo si alguno de ellos está aplicado (así no hay filtros ocultos activos).
  const moreActive =
    filters.seed !== undefined ||
    filters.fullUnlocks !== undefined ||
    filters.result !== undefined ||
    filters.verdict !== undefined;

  return (
    <section className={styles.panel} aria-labelledby="filters-title">
      <div className={styles.head}>
        <h2 id="filters-title" className={styles.title}>
          {t('search.filters')}
        </h2>
        <button
          type="button"
          className={styles.clear}
          disabled={!hasActiveFilters(filters)}
          onClick={() => onChange({ startItems: [], items: [], sort: filters.sort })}
        >
          {t('search.clear')}
        </button>
      </div>

      <Select
        label={t('run.character')}
        value={filters.character ?? ''}
        onChange={(e) => {
          if (e.target.value === '') unset('character');
          else set({ character: Number(e.target.value) });
        }}
      >
        <option value="">{t('search.any')}</option>
        <optgroup label={t('run.regular')}>
          {regular.map((c) => (
            <option key={c.id} value={c.id}>
              {characterLabel(c, lang, t)}
            </option>
          ))}
        </optgroup>
        <optgroup label={t('run.tainted')}>
          {tainted.map((c) => (
            <option key={c.id} value={c.id}>
              {characterLabel(c, lang, t)}
            </option>
          ))}
        </optgroup>
      </Select>

      <Select
        label={t('run.difficulty')}
        value={filters.difficulty ?? ''}
        onChange={(e) => {
          if (e.target.value === '') unset('difficulty');
          else set({ difficulty: e.target.value as (typeof DIFFICULTIES)[number] });
        }}
      >
        <option value="">{t('search.any')}</option>
        {DIFFICULTIES.map((d) => (
          <option key={d} value={d}>
            {t(`difficulty.${d}`)}
          </option>
        ))}
      </Select>

      <div className={styles.pickers}>
        {pickers.map(({ list, label, hint }, i) => (
          <div key={list} className={styles.picker}>
            <ItemPicker
              kind="item"
              label={label}
              shortcut={i === 0 ? 'Ctrl K' : undefined}
              inputRef={i === 0 ? focusRef : undefined}
              onPick={(id) => addItem(list, id)}
            />
            <p className={styles.hint}>{hint}</p>
            <ItemChips ids={filters[list]} onRemove={(id) => removeItem(list, id)} />
          </div>
        ))}
      </div>

      <details className={styles.more} open={moreActive}>
        <summary className={styles.summary}>{t('search.moreFilters')}</summary>
        <div className={styles.moreBody}>
          <TextField
            label={t('run.seed')}
            placeholder="ABCD 1234"
            maxLength={9}
            autoComplete="off"
            spellCheck={false}
            value={seedText}
            error={
              seedText.trim() !== '' && !isValidSeedFormat(seedText)
                ? t('run.seedInvalid')
                : undefined
            }
            onChange={(e) => onSeedChange(e.target.value)}
          />

          <Select
            label={t('search.unlocks')}
            value={filters.fullUnlocks === undefined ? '' : String(filters.fullUnlocks)}
            onChange={(e) => {
              if (e.target.value === '') unset('fullUnlocks');
              else set({ fullUnlocks: e.target.value === 'true' });
            }}
          >
            <option value="">{t('search.any')}</option>
            <option value="true">{t('run.unlocksFull')}</option>
            <option value="false">{t('run.unlocksPartial')}</option>
          </Select>

          <Select
            label={t('run.result')}
            value={filters.result ?? ''}
            onChange={(e) => {
              if (e.target.value === '') unset('result');
              else set({ result: e.target.value as (typeof RUN_RESULTS)[number] });
            }}
          >
            <option value="">{t('search.any')}</option>
            {RUN_RESULTS.map((r) => (
              <option key={r} value={r}>
                {t(`results.${r}`)}
              </option>
            ))}
          </Select>

          <Select
            label={t('search.verdict')}
            value={filters.verdict ?? ''}
            onChange={(e) => {
              if (e.target.value === '') unset('verdict');
              else set({ verdict: e.target.value as (typeof VERDICT_KINDS)[number] });
            }}
          >
            <option value="">{t('search.any')}</option>
            {VERDICT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`verdict.${kind}`)}
              </option>
            ))}
          </Select>
        </div>
      </details>
    </section>
  );
}
