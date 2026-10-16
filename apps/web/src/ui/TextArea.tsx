import { useId, type TextareaHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
}

export function TextArea({ label, hint, className, id, ...rest }: TextAreaProps) {
  const autoId = useId();
  const areaId = id ?? autoId;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={areaId} className={styles.label}>
        {label}
      </label>
      <textarea
        id={areaId}
        rows={4}
        className={`${styles.input} ${styles.textarea}`}
        aria-describedby={hint ? `${areaId}-hint` : undefined}
        {...rest}
      />
      {hint ? (
        <p id={`${areaId}-hint`} className={styles.hint}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
