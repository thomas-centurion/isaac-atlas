import { useEffect, useRef } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { useLogout, useMe } from '../auth/useAuth';
import { usePageVisibility } from '../hooks/usePageVisibility';
import styles from './Layout.module.css';

export function Layout() {
  const { t, i18n } = useTranslation();
  usePageVisibility();
  const mainRef = useRef<HTMLElement>(null);
  const { pathname } = useLocation();
  const previousPath = useRef(pathname);

  // En una SPA el navegador no mueve el foco al cambiar de página: un usuario de teclado o lector de
  // pantalla se quedaría en el link que acaba de tocar. Se lleva al contenido (solo si cambia la
  // ruta, no los filtros de la URL, para no robar el foco mientras se escribe).
  useEffect(() => {
    // Comparar con la ruta anterior (y no con un "es el primer render") también evita mover el foco
    // en la carga inicial cuando React StrictMode ejecuta los efectos dos veces en desarrollo.
    if (previousPath.current === pathname) return;
    previousPath.current = pathname;
    mainRef.current?.focus({ preventScroll: false });
  }, [pathname]);
  const { data: user } = useMe();
  const logout = useLogout();
  const current: Language = i18n.language.startsWith('es') ? 'es' : 'en';

  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>
        {t('nav.skip')}
      </a>
      <header className={styles.header}>
        <div className={styles.brand}>
          <span className={styles.logo}>{t('app.name')}</span>
          <span className={styles.tagline}>{t('app.tagline')}</span>
        </div>
        <nav className={styles.nav} aria-label={t('nav.main')}>
          <NavLink to="/" end className={({ isActive }) => (isActive ? styles.active : undefined)}>
            {t('nav.search')}
          </NavLink>
          <NavLink
            to="/design"
            className={({ isActive }) => (isActive ? styles.active : undefined)}
          >
            {t('nav.design')}
          </NavLink>
          {user ? (
            <>
              <NavLink
                to="/runs/new"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                {t('nav.newRun')}
              </NavLink>
              <NavLink
                to="/runs"
                end
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                {t('nav.myRuns')}
              </NavLink>
              {user.role === 'admin' ? (
                <NavLink
                  to="/admin"
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                >
                  {t('nav.admin')}
                </NavLink>
              ) : null}
              <NavLink
                to="/account"
                className={({ isActive }) => (isActive ? styles.active : undefined)}
              >
                {user.username ?? t('account.title')}
              </NavLink>
              <button type="button" className={styles.navButton} onClick={() => logout.mutate()}>
                {t('auth.logout')}
              </button>
            </>
          ) : (
            <NavLink
              to="/login"
              className={({ isActive }) => (isActive ? styles.active : undefined)}
            >
              {t('auth.login')}
            </NavLink>
          )}
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

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
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
