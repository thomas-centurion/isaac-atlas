import { useTranslation } from 'react-i18next';
import { ITEM_SOURCES, type ItemSource, type RunItem, type RunTrinket } from '@isaac-atlas/shared';
import { getItem, getTrinket } from '../catalog';
import { useLang } from '../hooks/useLang';
import { Button } from '../ui/Button';
import { ItemIcon } from '../ui/ItemIcon';
import styles from './FloorGroups.module.css';

interface FloorGroupsProps {
  items: RunItem[];
  trinkets: RunTrinket[];
  /** Con handlers → modo edición (quitar, cambiar origen). Sin ellos → solo lectura. */
  onRemoveItem?: (index: number) => void;
  onRemoveTrinket?: (index: number) => void;
  onSourceChange?: (index: number, source: ItemSource) => void;
}

interface Entry {
  key: string;
  kind: 'item' | 'trinket';
  id: number;
  index: number;
  floor: number;
  source?: ItemSource;
}

/** Ítems y trinkets agrupados por piso, en el orden en que se agarraron. */
export function FloorGroups({
  items,
  trinkets,
  onRemoveItem,
  onRemoveTrinket,
  onSourceChange,
}: FloorGroupsProps) {
  const { t } = useTranslation();
  const lang = useLang();

  const entries: Entry[] = [
    ...items.map((it, index) => ({
      key: `i-${index}`,
      kind: 'item' as const,
      id: it.itemId,
      index,
      floor: it.floor,
      source: it.source,
    })),
    ...trinkets.map((tr, index) => ({
      key: `t-${index}`,
      kind: 'trinket' as const,
      id: tr.trinketId,
      index,
      floor: tr.floor,
    })),
  ];
  const floors = [...new Set(entries.map((e) => e.floor))].sort((a, b) => a - b);

  if (entries.length === 0) return <p className={styles.empty}>{t('run.noItemsYet')}</p>;

  return (
    <div>
      {floors.map((floor) => (
        <section key={floor} className={styles.group}>
          <h3>
            {floor}. {t(`floors.${floor}`)}
          </h3>
          <ul className={styles.list}>
            {entries
              .filter((e) => e.floor === floor)
              .map((e) => {
                const name =
                  (e.kind === 'item' ? getItem(e.id) : getTrinket(e.id))?.name[lang] ?? '';
                return (
                  <li key={e.key} className={styles.card}>
                    <ItemIcon kind={e.kind} id={e.id} />
                    <div className={styles.info}>
                      <span className={styles.name}>{name}</span>
                      <div className={styles.controls}>
                        {e.source && onSourceChange ? (
                          <select
                            className={styles.source}
                            aria-label={t('run.source')}
                            value={e.source}
                            onChange={(ev) =>
                              onSourceChange(e.index, ev.target.value as ItemSource)
                            }
                          >
                            {ITEM_SOURCES.map((s) => (
                              <option key={s} value={s}>
                                {t(`sources.${s}`)}
                              </option>
                            ))}
                          </select>
                        ) : e.source && e.source !== 'other' ? (
                          <span className={styles.sourceText}>{t(`sources.${e.source}`)}</span>
                        ) : null}
                        {(e.kind === 'item' ? onRemoveItem : onRemoveTrinket) ? (
                          <Button
                            variant="danger"
                            aria-label={`${t('run.remove')}: ${name}`}
                            onClick={() =>
                              (e.kind === 'item' ? onRemoveItem : onRemoveTrinket)?.(e.index)
                            }
                          >
                            ×
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
          </ul>
        </section>
      ))}
    </div>
  );
}
