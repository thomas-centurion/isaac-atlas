import type { AnchorHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  variant?: Variant;
}

/** Un <a> con la apariencia de Button: para descargas y navegación que no es una acción de la app. */
export function ButtonLink({ variant = 'secondary', className, ...rest }: ButtonLinkProps) {
  const cls = [styles.button, styles[variant], styles.asLink, className].filter(Boolean).join(' ');
  return <a className={cls} {...rest} />;
}
