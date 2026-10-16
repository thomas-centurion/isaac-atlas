import { useTranslation } from 'react-i18next';
import type { Locale } from '@isaac-atlas/shared';

/** Idioma activo reducido a los dos que soportamos (para elegir nombre ES/EN del catálogo). */
export function useLang(): Locale {
  const { i18n } = useTranslation();
  return i18n.language.startsWith('es') ? 'es' : 'en';
}
