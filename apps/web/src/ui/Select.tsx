import { useId, type ReactNode, type SelectHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  children: ReactNode;
}

/** <select> nativo (accesible y con teclado gratis) con el mismo estilo que TextField. */
export function Select({ label, className, id, children, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? autoId;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={selectId} className={styles.label}>
        {label}
      </label>
      <select id={selectId} className={`${styles.input} ${styles.select}`} {...rest}>
        {children}
      </select>
    </div>
  );
}
