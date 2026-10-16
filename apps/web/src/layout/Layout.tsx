import { NavLink, Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { usePageVisibility } from '../hooks/usePageVisibility';
import styles from './Layout.module.css';

export function Layout() {
  const { t, i18n } = useTranslation();
  usePageVisibility();
  const current: Language = i18n.language.startsWith('es') ? 'es' : 'en';

  return (
    <div className={styles.shell}>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>{t('app.name')}</span>
          <span className={styles.tagline}>{t('app.tagline')}</span>
        </div>
        <nav className={styles.nav} aria-label="Principal">
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : undefined)}>
            {t('nav.home')}
          </NavLink>
          <NavLink
            to="/design"
            className={({ isActive }) => (isActive ? styles.active : undefined)}
          >
            {t('nav.design')}
          </NavLink>
        </nav>
        <div className={styles.langs} role="group" aria-label={t('nav.language')}>
          {LANGUAGES.map((lang) => (
            <button
              key={lang}
              type="button"
              aria-pressed={lang === current}
              className={lang === current ? styles.langActive : undefined}
              onClick={() => setLanguage(lang)}
            >
              {lang.toUpperCase()}
            </button>
          ))}
        </div>
      </header>

      <main className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <p>{t('footer.legal')}</p>
        <p className={styles.counter}>
          {t('footer.visitors')} <span>000042</span>
        </p>
      </footer>
    </div>
  );
}
