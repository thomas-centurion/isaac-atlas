import { useId, useMemo, useState, type KeyboardEvent, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import { useLang } from '../hooks/useLang';
import { searchCatalog, type SearchKind } from '../search/itemSearch';
import { ItemIcon } from '../ui/ItemIcon';
import styles from './ItemPicker.module.css';

interface ItemPickerProps {
  kind: SearchKind;
  onPick: (id: number) => void;
  inputRef?: RefObject<HTMLInputElement>;
}

/** Combobox: escribís, flechas para moverte, Enter para agregar. El foco queda en el input. */
export function ItemPicker({ kind, onPick, inputRef }: ItemPickerProps) {
  const { t } = useTranslation();
  const lang = useLang();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  const results = useMemo(() => searchCatalog(query, kind), [query, kind]);
  const open = query.trim().length > 0;
  const activeIndex = Math.min(active, Math.max(0, results.length - 1));

  const pick = (id: number) => {
    onPick(id);
    setQuery('');
    setActive(0);
  };

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (results.length === 0) return;
      e.preventDefault();
      const step = e.key === 'ArrowDown' ? 1 : -1;
      // Función de actualización: con key-repeat llegan varias teclas antes de re-renderizar.
      setActive((prev) => {
        const current = Math.min(prev, results.length - 1);
        return (current + step + results.length) % results.length;
      });
    } else if (e.key === 'Enter') {
      // Enter dentro del buscador no debe enviar el formulario.
      e.preventDefault();
      const hit = results[activeIndex];
      if (hit) pick(hit.id);
    } else if (e.key === 'Escape') {
      setQuery('');
    }
  };

  return (
    <div className={styles.picker}>
      <label htmlFor={`${listId}-input`} className={styles.label}>
        {t(kind === 'item' ? 'run.searchItem' : 'run.searchTrinket')}
        <kbd className={styles.kbd}>/</kbd>
      </label>
      <input
        id={`${listId}-input`}
        ref={inputRef}
        className={styles.input}
        role="combobox"
        aria-expanded={open && results.length > 0}
        aria-controls={listId}
        aria-activedescendant={open && results.length > 0 ? `${listId}-${activeIndex}` : undefined}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        placeholder={t('run.searchPlaceholder')}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
        }}
        onKeyDown={onKeyDown}
      />
      <ul id={listId} role="listbox" className={styles.list} hidden={!open}>
        {results.length === 0 && open ? (
          <li className={styles.empty}>{t('run.noResults')}</li>
        ) : null}
        {results.map((r, i) => (
          <li
            key={`${r.kind}-${r.id}`}
            id={`${listId}-${i}`}
            role="option"
            aria-selected={i === activeIndex}
            className={
              i === activeIndex ? `${styles.option} ${styles.activeOption}` : styles.option
            }
            // onMouseDown (no onClick) para que el input no pierda el foco antes de agregar.
            onMouseDown={(e) => {
              e.preventDefault();
              pick(r.id);
            }}
            onMouseEnter={() => setActive(i)}
          >
            <ItemIcon kind={r.kind} id={r.id} scale={1} />
            <span>{r.entry.name[lang]}</span>
            <span className={styles.id}>#{r.id}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
