import { useEffect } from 'react';

const SITE = 'Isaac Atlas';

/**
 * Título de la pestaña por página ("Buscar · Isaac Atlas"). En una SPA el título no cambia solo:
 * sin esto todas las pestañas y el historial dicen lo mismo, y los lectores de pantalla no tienen
 * cómo saber en qué página están.
 */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · ${SITE}` : SITE;
  }, [title]);
}
