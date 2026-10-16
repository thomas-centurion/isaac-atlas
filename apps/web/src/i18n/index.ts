import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import es from './es.json';

export const LANGUAGES = ['es', 'en'] as const;
export type Language = (typeof LANGUAGES)[number];

const STORAGE_KEY = 'isaac-atlas:lang';

function detectLanguage(): Language {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'es' || stored === 'en') return stored;
  } catch {
    // localStorage no disponible (modo privado, etc.)
  }
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function setLanguage(lang: Language) {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignorar
  }
}

const initial = detectLanguage();
document.documentElement.lang = initial;

void i18n.use(initReactI18next).init({
  resources: { es: { translation: es }, en: { translation: en } },
  lng: initial,
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});

export default i18n;
