import { useRef, type KeyboardEvent } from 'react';
import styles from './Tabs.module.css';

export interface TabOption<T extends string> {
  value: T;
  label: string;
}

interface TabsProps<T extends string> {
  label: string;
  options: TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}

/** Tablist accesible con navegación por flechas (Hot / Top / New, etc.). */
export function Tabs<T extends string>({ label, options, value, onChange }: TabsProps<T>) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (index + step + options.length) % options.length;
    const option = options[next];
    if (option) {
      onChange(option.value);
      refs.current[next]?.focus();
    }
  };

  return (
    <div role="tablist" aria-label={label} className={styles.list}>
      {options.map((opt, i) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            className={[styles.tab, selected ? styles.active : ''].filter(Boolean).join(' ')}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
