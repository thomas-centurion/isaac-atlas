import { useTranslation } from 'react-i18next';
import {
  ITEM_SOURCES,
  isSourceAvailable,
  type ItemSource,
  type RunItem,
  type RunTrinket,
} from '@isaac-atlas/shared';
import { getItem, getTrinket } from '../catalog';
import { useLang } from '../hooks/useLang';
import { Button } from '../ui/Button';
import { Checkbox } from '../ui/Checkbox';
import { ItemIcon } from '../ui/ItemIcon';
import { floorName } from './floors';
import styles from './FloorGroups.module.css';

interface FloorGroupsProps {
  items: RunItem[];
  trinkets: RunTrinket[];
  /** Con handlers → modo edición (quitar, cambiar origen). Sin ellos → solo lectura. */
  onRemoveItem?: (index: number) => void;
  onRemoveTrinket?: (index: number) => void;
  onSourceChange?: (index: number, source: ItemSource) => void;
  onRerollChange?: (index: number, rerolled: boolean) => void;
}

interface Entry {
  key: string;
  kind: 'item' | 'trinket';
  id: number;
  index: number;
  floor: number;
  alt?: boolean;
  source?: ItemSource;
  rerolled?: boolean;
}

/** Ítems y trinkets agrupados por piso, en el orden en que se agarraron. */
export function FloorGroups({
  items,
  trinkets,
  onRemoveItem,
  onRemoveTrinket,
  onSourceChange,
  onRerollChange,
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
      alt: it.alt,
      source: it.source,
      rerolled: it.rerolled,
    })),
    ...trinkets.map((tr, index) => ({
      key: `t-${index}`,
      kind: 'trinket' as const,
      id: tr.trinketId,
      index,
      floor: tr.floor,
      alt: tr.alt,
    })),
  ];
  // Un grupo por piso y ruta: "Sótano I" y "Aguacero I" son grupos distintos.
  const groupKey = (e: Entry) =>
    `${e.floor}-${e.alt === true ? 'alt' : e.alt === false ? 'normal' : 'any'}`;
  const groups = [...new Map(entries.map((e) => [groupKey(e), e])).values()].sort(
    (a, b) => a.floor - b.floor || Number(a.alt === true) - Number(b.alt === true),
  );

  if (entries.length === 0) return <p className={styles.empty}>{t('run.noItemsYet')}</p>;

  return (
    <div>
      {groups.map((group) => (
        <section key={groupKey(group)} className={styles.group}>
          <h3>
            {group.floor}. {floorName(t, group.floor, group.alt)}
          </h3>
          <ul className={styles.list}>
            {entries
              .filter((e) => groupKey(e) === groupKey(group))
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
                            {ITEM_SOURCES.filter(
                              (s) => s === e.source || isSourceAvailable(s, e.floor),
                            ).map((s) => (
                              <option key={s} value={s}>
                                {t(`sources.${s}`)}
                              </option>
                            ))}
                          </select>
                        ) : e.source && e.source !== 'other' ? (
                          <span className={styles.sourceText}>{t(`sources.${e.source}`)}</span>
                        ) : null}
                        {e.kind === 'item' && onRerollChange ? (
                          <Checkbox
                            className={styles.reroll}
                            label={t('run.reroll')}
                            aria-label={`${t('run.reroll')}: ${name}`}
                            checked={Boolean(e.rerolled)}
                            onChange={(ev) => onRerollChange(e.index, ev.target.checked)}
                          />
                        ) : e.rerolled ? (
                          <span className={styles.rerollBadge}>{t('run.reroll')}</span>
                        ) : null}
                        {(e.kind === 'item' ? onRemoveItem : onRemoveTrinket) ? (
                          <Button
                            variant="danger"
                            className={styles.remove}
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
