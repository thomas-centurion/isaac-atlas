import { useTranslation } from 'react-i18next';
import { getItem } from '../catalog';
import { useLang } from '../hooks/useLang';
import { ItemIcon } from '../ui/ItemIcon';
import styles from './ItemChips.module.css';

interface ItemChipsProps {
  ids: number[];
  onRemove: (id: number) => void;
}

/** Ítems elegidos en un filtro, cada uno con su sprite y un botón para quitarlo. */
export function ItemChips({ ids, onRemove }: ItemChipsProps) {
  const { t } = useTranslation();
  const lang = useLang();
  if (ids.length === 0) return null;

  return (
    <ul className={styles.list}>
      {ids.map((id) => {
        const name = getItem(id)?.name[lang] ?? `#${id}`;
        return (
          <li key={id} className={styles.chip}>
            <ItemIcon kind="item" id={id} scale={1} />
            <span>{name}</span>
            <button
              type="button"
              className={styles.remove}
              aria-label={`${t('run.remove')}: ${name}`}
              onClick={() => onRemove(id)}
            >
              ×
            </button>
          </li>
        );
      })}
    </ul>
  );
}
