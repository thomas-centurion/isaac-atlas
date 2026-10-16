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
import { Button } from '../ui/Button';
import { Panel } from '../ui/Panel';
import { Select } from '../ui/Select';
import { TextField } from '../ui/TextField';
import { ItemChips } from './ItemChips';
import styles from './FilterPanel.module.css';

type ItemList = 'startItems' | 'items' | 'exclude';

interface FilterPanelProps {
  filters: SearchFilters;
  onChange: (next: SearchFilters) => void;
  /** Se enfoca con el atajo "/" (lo registra la página). */
  focusRef?: RefObject<HTMLInputElement>;
}

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
    // "Tiene X" y "Sin X" se contradicen: agregar a uno lo saca del otro.
    const conflicts: ItemList[] = list === 'exclude' ? ['items', 'startItems'] : ['exclude'];
    const next = { ...filters, [list]: [...filters[list], id] };
    for (const other of conflicts) next[other] = next[other].filter((x) => x !== id);
    onChange(next);
  };
  const removeItem = (list: ItemList, id: number) =>
    set({ [list]: filters[list].filter((x) => x !== id) });

  const pickers: { list: ItemList; label: string; hint: string }[] = [
    { list: 'startItems', label: t('search.startsWith'), hint: t('search.startsWithHint') },
    { list: 'items', label: t('search.hasItems'), hint: t('search.hasItemsHint') },
    { list: 'exclude', label: t('search.excludeItems'), hint: t('search.excludeItemsHint') },
  ];

  return (
    <Panel title={t('search.filters')}>
      <div className={styles.grid}>
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

      <div className={styles.pickers}>
        {pickers.map(({ list, label, hint }, i) => (
          <div key={list}>
            <ItemPicker
              kind="item"
              label={label}
              shortcut={i === 0 ? '/' : undefined}
              inputRef={i === 0 ? focusRef : undefined}
              onPick={(id) => addItem(list, id)}
            />
            <p className={styles.hint}>{hint}</p>
            <ItemChips ids={filters[list]} onRemove={(id) => removeItem(list, id)} />
          </div>
        ))}
      </div>

      <Button
        variant="secondary"
        disabled={!hasActiveFilters(filters)}
        onClick={() => onChange({ startItems: [], items: [], exclude: [], sort: filters.sort })}
      >
        {t('search.clear')}
      </Button>
    </Panel>
  );
}
