import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
  /** Nivel del título: la primera sección de cada página es h1 (una sola por página). */
  as?: 'h1' | 'h2';
}

/** Contenedor tipo menú del juego: papel oscuro con borde pixelado. */
export function Panel({ title, as: Heading = 'h2', className, children, ...rest }: PanelProps) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(' ')} {...rest}>
      {title ? <Heading className={styles.title}>{title}</Heading> : null}
      {children}
    </section>
  );
}
