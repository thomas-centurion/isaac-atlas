import { useEffect } from 'react';

/**
 * La web se deja abierta de fondo mientras se juega: cuando la pestaña no es
 * visible marcamos <html data-hidden="true"> y el CSS global pausa todas las
 * animaciones. No hay timers de JS corriendo en idle.
 */
export function usePageVisibility() {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => root.setAttribute('data-hidden', String(document.hidden));
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, []);
}
