import type { ButtonHTMLAttributes } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'danger';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export function Button({ variant = 'primary', className, type = 'button', ...rest }: ButtonProps) {
  const cls = [styles.button, styles[variant], className].filter(Boolean).join(' ');
  return <button type={type} className={cls} {...rest} />;
}
