import type { HTMLAttributes, ReactNode } from 'react';
import styles from './Panel.module.css';

interface PanelProps extends Omit<HTMLAttributes<HTMLElement>, 'title'> {
  title?: ReactNode;
}

/** Contenedor tipo menú del juego: papel oscuro con borde pixelado. */
export function Panel({ title, className, children, ...rest }: PanelProps) {
  return (
    <section className={[styles.panel, className].filter(Boolean).join(' ')} {...rest}>
      {title ? <h2 className={styles.title}>{title}</h2> : null}
      {children}
    </section>
  );
}
