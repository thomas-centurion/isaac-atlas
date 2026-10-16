import type { ReactNode } from 'react';
import styles from './Notice.module.css';

interface NoticeProps {
  tone: 'error' | 'success' | 'info';
  children: ReactNode;
}

/** Mensaje de estado (errores de API, confirmaciones). `role=alert` para lectores de pantalla. */
export function Notice({ tone, children }: NoticeProps) {
  return (
    <p role={tone === 'error' ? 'alert' : 'status'} className={`${styles.notice} ${styles[tone]}`}>
      {children}
    </p>
  );
}
