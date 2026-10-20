import { useEffect, useRef } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type Language } from '../i18n';
import { useLogout, useMe } from '../auth/useAuth';
import { usePageVisibility } from '../hooks/usePageVisibility';
import { ItemIcon } from '../ui/ItemIcon';
import styles from './Layout.module.css';

/** El D6 de logo: la seed es, al final, una tirada de dados. */
const LOGO_ITEM_ID = 105;

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? `${styles.navLink} ${styles.navActive}` : styles.navLink;

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

      <header className={styles.topbar}>
        <div className={styles.topbarInner}>
          <Link to="/" className={styles.brand}>
            <span aria-hidden="true" className={styles.brandIcon}>
              <ItemIcon kind="item" id={LOGO_ITEM_ID} scale={1} />
            </span>
            <span className={styles.logo}>{t('app.name')}</span>
          </Link>

          <nav className={styles.nav} aria-label={t('nav.main')}>
            <NavLink to="/" end className={navClass}>
              {t('nav.search')}
            </NavLink>
            {user ? (
              <>
                <NavLink to="/runs/new" className={navClass}>
                  {t('nav.newRun')}
                </NavLink>
                <NavLink to="/runs" end className={navClass}>
                  {t('nav.myRuns')}
                </NavLink>
                {user.role === 'admin' ? (
                  <NavLink to="/admin" className={navClass}>
                    {t('nav.admin')}
                  </NavLink>
                ) : null}
              </>
            ) : null}
            {/* La galería de componentes es una herramienta de desarrollo: no se muestra al público */}
            {import.meta.env.DEV ? (
              <NavLink to="/design" className={navClass}>
                {t('nav.design')}
              </NavLink>
            ) : null}
          </nav>

          <div className={styles.right}>
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

            {user ? (
              <div className={styles.account}>
                <NavLink to="/account" className={styles.accountLink}>
                  {user.username ?? t('account.title')}
                </NavLink>
                <button type="button" className={styles.logout} onClick={() => logout.mutate()}>
                  {t('auth.logout')}
                </button>
              </div>
            ) : (
              <div className={styles.account}>
                <Link to="/login" className={styles.ghost}>
                  {t('auth.login')}
                </Link>
                <Link to="/register" className={styles.cta}>
                  {t('auth.register')}
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className={styles.main}>
        <Outlet />
      </main>

      <footer className={styles.footer}>
        <div className={styles.footerInner}>
          <p>{t('footer.legal')}</p>
          <p className={styles.counter}>
            {t('footer.visitors')} <span>000042</span>
          </p>
        </div>
      </footer>
    </div>
  );
}
