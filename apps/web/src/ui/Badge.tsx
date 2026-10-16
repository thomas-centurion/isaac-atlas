import type { HTMLAttributes } from 'react';
import styles from './Badge.module.css';

export type BadgeTone = 'op' | 'troll' | 'hard' | 'neutral';

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: BadgeTone;
}

/** Etiqueta para veredictos de la comunidad (OP, Troll, Hard) y metadatos. */
export function Badge({ tone = 'neutral', className, ...rest }: BadgeProps) {
  return (
    <span className={[styles.badge, styles[tone], className].filter(Boolean).join(' ')} {...rest} />
  );
}
