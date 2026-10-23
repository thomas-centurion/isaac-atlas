import { SPRITE_CELL } from '@isaac-atlas/shared';
import { catalog } from '../catalog';
import styles from './ItemIcon.module.css';

interface CharacterFaceProps {
  /** Id del personaje (el mismo del catálogo). */
  id: number;
  /** Multiplicador entero del sprite original de 32px. */
  scale?: number;
}

const SHEET_URL = '/sprites/characters.png';

/**
 * Cara del personaje. Es decorativa: el nombre ya está escrito al lado, así que no se anuncia dos
 * veces. El sheet va en el orden de `catalog.characters` (ver scripts/build-faces.ts).
 */
export function CharacterFace({ id, scale = 1 }: CharacterFaceProps) {
  const index = catalog.characters.findIndex((c) => c.id === id);
  if (index < 0) return null;
  const size = SPRITE_CELL * scale;

  return (
    <span
      aria-hidden="true"
      className={styles.icon}
      style={{
        width: size,
        height: size,
        backgroundImage: `url(${SHEET_URL})`,
        backgroundSize: `${catalog.characters.length * size}px ${size}px`,
        backgroundPosition: `-${index * size}px 0`,
      }}
    />
  );
}
