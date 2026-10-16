import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Express } from 'express';
import { config } from './config.js';

const YEAR = 365 * 24 * 60 * 60;
const DAY = 24 * 60 * 60;

/**
 * En producción la API sirve también la web compilada: un solo origen, así la cookie de sesión
 * (SameSite=Lax) y los callbacks de Google/Steam funcionan sin CORS ni dominios cruzados.
 * En desarrollo no hace nada: el front corre en Vite y proxea /api.
 */
export function serveWeb(app: Express) {
  const wantsWeb = config.WEB_DIST !== undefined || config.NODE_ENV === 'production';
  if (!wantsWeb) return;

  const dist = resolve(config.WEB_DIST ?? '../web/dist');
  const index = resolve(dist, 'index.html');
  if (!existsSync(index)) {
    console.warn(
      `[web] no encontré ${index}: la API no va a servir la web (¿corriste npm run build?)`,
    );
    return;
  }

  app.use(
    express.static(dist, {
      index: false,
      setHeaders(res, path) {
        // Los archivos de /assets llevan hash en el nombre: se pueden cachear para siempre.
        if (path.includes(`${resolve(dist, 'assets')}`)) {
          res.setHeader('Cache-Control', `public, max-age=${YEAR}, immutable`);
        } else {
          res.setHeader('Cache-Control', `public, max-age=${DAY}`);
        }
      },
    }),
  );

  // Rutas del front (React Router): cualquier GET que no sea /api devuelve index.html.
  app.get(/^\/(?!api\/).*/, (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(index);
  });
}
