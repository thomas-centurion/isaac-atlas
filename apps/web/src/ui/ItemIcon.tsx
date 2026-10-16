import { SPRITE_CELL, SPRITE_COLUMNS, spritePosition } from '@isaac-atlas/shared';
import { useTranslation } from 'react-i18next';
import { getItem, getTrinket } from '../catalog';
import styles from './ItemIcon.module.css';

interface ItemIconProps {
  kind: 'item' | 'trinket';
  id: number;
  /** Multiplicador entero del sprite original de 32px. */
  scale?: number;
}

const SHEET_URL = '/sprites/items.png';

export function ItemIcon({ kind, id, scale = 2 }: ItemIconProps) {
  const { i18n } = useTranslation();
  const entry = kind === 'item' ? getItem(id) : getTrinket(id);
  if (!entry) return null;

  const lang = i18n.language.startsWith('es') ? 'es' : 'en';
  const name = entry.name[lang];
  const { x, y } = spritePosition(entry.sprite);
  const size = SPRITE_CELL * scale;

  return (
    <span
      role="img"
      aria-label={name}
      title={name}
      className={styles.icon}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SHEET_URL})`,
        backgroundSize: `${SPRITE_COLUMNS * size}px auto`,
        backgroundPosition: `-${x * scale}px -${y * scale}px`,
      }}
    />
  );
}
