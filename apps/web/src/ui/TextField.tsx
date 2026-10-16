import { useId, type InputHTMLAttributes } from 'react';
import styles from './TextField.module.css';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({ label, hint, error, className, id, ...rest }: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const noteId = `${inputId}-note`;
  const note = error ?? hint;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <input
        id={inputId}
        className={[styles.input, error ? styles.invalid : ''].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={note ? noteId : undefined}
        {...rest}
      />
      {note ? (
        <p id={noteId} className={error ? styles.error : styles.hint}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
