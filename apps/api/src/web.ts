import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import express, { type Express } from 'express';
import mongoose from 'mongoose';
import { catalog, formatSeed, isValidSeedFormat, normalizeSeed } from '@isaac-atlas/shared';
import { config } from './config.js';
import { Run } from './models/Run.js';
import { User } from './models/User.js';
import { VISIBLE_RUNS } from './runDto.js';

const YEAR = 365 * 24 * 60 * 60;
const DAY = 24 * 60 * 60;
const SITEMAP_LIMIT = 5000;

const SITE = 'Isaac Atlas';
const DEFAULT_DESCRIPTION =
  'Bitácora comunitaria de seeds y runs de The Binding of Isaac: Repentance+. Buscá por personaje e ítems, votá y compartí tus synergies.';

/** Páginas que no tienen sentido en un buscador (sesión, cuenta, moderación). */
const PRIVATE_PATHS =
  /^\/(login|register|forgot-password|reset-password|verify-email|welcome|account|admin|design|runs\/new|runs\/[^/]+\/edit)(\/|$)/;

interface PageMeta {
  title: string;
  description: string;
  noindex?: boolean;
  /** La URL no existe: se responde 404 (con la misma app, que muestra su página de error). */
  notFound?: boolean;
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const baseUrl = () => config.PUBLIC_URL.replace(/\/$/, '');

/** Recorta para descripciones de preview (los buscadores cortan alrededor de 160). */
const clip = (s: string, max = 200) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function characterName(id: number): string {
  const c = catalog.characters.find((ch) => ch.id === id);
  if (!c) return 'Isaac';
  return c.tainted ? `Tainted ${c.name.es}` : c.name.es;
}

/**
 * Metadatos por página. La web es una SPA: sin esto, Discord, WhatsApp, X o Google ven el mismo
 * título para todas las URLs. Se resuelve en el server para las páginas públicas con contenido.
 */
async function metaFor(path: string): Promise<PageMeta> {
  const fallback: PageMeta = { title: SITE, description: DEFAULT_DESCRIPTION };
  if (PRIVATE_PATHS.test(path) || path === '/runs') return { ...fallback, noindex: true };
  // Solo existen estas páginas; el resto es un 404 real (no un 200 con la app dentro).
  const known = path === '/' || path === '/privacy' || /^\/(runs|seeds|u)\/[^/]+$/.test(path);
  if (!known) return { ...fallback, noindex: true, notFound: true };
  if (mongoose.connection.readyState !== 1) return fallback;

  try {
    const run = /^\/runs\/([0-9a-f]{24})$/i.exec(path);
    if (run) {
      const doc = await Run.findOne({ _id: run[1], ...VISIBLE_RUNS }).populate<{
        author: { username?: string };
      }>('author', 'username');
      if (!doc) return { ...fallback, noindex: true, notFound: true };
      const result = doc.outcome.result === 'win' ? 'victoria' : 'muerte';
      return {
        title: `Seed ${formatSeed(doc.seed)} · ${characterName(doc.characterId)} · ${SITE}`,
        description: clip(
          `Run de ${characterName(doc.characterId)} con ${doc.items.length} ítems (${result}), ` +
            `por ${doc.author?.username ?? 'alguien'}. Votos: ${doc.stats.up - doc.stats.down}.`,
        ),
      };
    }

    const seed = /^\/seeds\/([^/]+)$/.exec(path);
    if (seed) {
      let value: string;
      try {
        value = normalizeSeed(decodeURIComponent(seed[1]!));
      } catch {
        return { ...fallback, noindex: true, notFound: true };
      }
      if (!isValidSeedFormat(value)) return { ...fallback, noindex: true, notFound: true };
      const count = await Run.countDocuments({ seed: value, ...VISIBLE_RUNS });
      if (count === 0) return { ...fallback, noindex: true };
      return {
        title: `Seed ${formatSeed(value)} · ${SITE}`,
        description: `${count} ${count === 1 ? 'run registrada' : 'runs registradas'} con la seed ${formatSeed(value)} en Isaac Atlas.`,
      };
    }

    const profile = /^\/u\/([^/]+)$/.exec(path);
    if (profile) {
      const username = decodeURIComponent(profile[1]!);
      if (!/^[A-Za-z0-9_]{3,20}$/.test(username)) {
        return { ...fallback, noindex: true, notFound: true };
      }
      const user = await User.findOne({ usernameLower: username.toLowerCase() });
      if (!user?.username) return { ...fallback, noindex: true, notFound: true };
      const runs = await Run.countDocuments({ author: user._id, ...VISIBLE_RUNS });
      return {
        title: `${user.username} · ${SITE}`,
        description: `Perfil de ${user.username} en Isaac Atlas: ${runs} ${runs === 1 ? 'run publicada' : 'runs publicadas'}.`,
      };
    }
  } catch {
    // Sin metadatos específicos antes que una página rota.
  }
  return fallback;
}

/** Inserta el título y las etiquetas SEO en el index.html compilado. */
export function renderIndex(template: string, meta: PageMeta, path: string): string {
  const title = escapeHtml(meta.title);
  const description = escapeHtml(meta.description);
  const url = escapeHtml(`${baseUrl()}${path === '/' ? '' : path}`);
  const tags = [
    `<meta name="description" content="${description}" />`,
    meta.noindex
      ? '<meta name="robots" content="noindex" />'
      : `<link rel="canonical" href="${url}" />`,
    '<meta property="og:type" content="website" />',
    `<meta property="og:site_name" content="${SITE}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${description}" />`,
    `<meta property="og:url" content="${url}" />`,
    '<meta name="twitter:card" content="summary" />',
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${description}" />`,
  ].join('\n    ');

  return template
    .replace(/<title>.*?<\/title>/s, `<title>${title}</title>`)
    .replace('</head>', `    ${tags}\n  </head>`);
}

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
  const template = readFileSync(index, 'utf8');

  // Dinámicos: llevan la URL pública absoluta.
  app.get('/robots.txt', (_req, res) => {
    res.type('text/plain').set('Cache-Control', `public, max-age=${DAY}`);
    res.send(
      [
        'User-agent: *',
        'Disallow: /api/',
        'Disallow: /account',
        'Disallow: /admin',
        'Disallow: /login',
        'Disallow: /register',
        '',
        `Sitemap: ${baseUrl()}/sitemap.xml`,
        '',
      ].join('\n'),
    );
  });

  app.get('/sitemap.xml', async (_req, res, next) => {
    try {
      const [seeds, runs] = await Promise.all([
        Run.aggregate<{ _id: string; updated: Date }>([
          { $match: VISIBLE_RUNS },
          { $group: { _id: '$seed', updated: { $max: '$updatedAt' } } },
          { $sort: { updated: -1 } },
          { $limit: SITEMAP_LIMIT },
        ]),
        Run.find(VISIBLE_RUNS).sort({ updatedAt: -1 }).limit(SITEMAP_LIMIT).select('updatedAt'),
      ]);
      const url = (path: string, date?: Date) =>
        `  <url><loc>${escapeHtml(baseUrl() + path)}</loc>${date ? `<lastmod>${date.toISOString()}</lastmod>` : ''}</url>`;
      const body = [
        url('/'),
        ...seeds.map((s) => url(`/seeds/${s._id}`, s.updated)),
        ...runs.map((r) => url(`/runs/${r.id}`, r.updatedAt)),
      ].join('\n');
      res
        .type('application/xml')
        .set('Cache-Control', 'public, max-age=3600')
        .send(
          `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`,
        );
    } catch (err) {
      next(err);
    }
  });

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

  // Un archivo que no existe (con extensión) es un 404 de verdad, no la app: si no, un
  // /assets/viejo.js tras un deploy devolvería HTML con 200 y rompería el navegador.
  app.get(/^\/(?!api\/).*\.[a-z0-9]+$/i, (_req, res) => {
    res.status(404).type('text/plain').send('Not found');
  });

  // Rutas del front (React Router): cualquier otro GET que no sea /api devuelve index.html con
  // los metadatos de esa página.
  app.get(/^\/(?!api\/).*/, async (req, res) => {
    const path = req.path.length > 1 ? req.path.replace(/\/$/, '') : req.path;
    const meta = await metaFor(path);
    res.setHeader('Cache-Control', 'no-cache');
    res
      .status(meta.notFound ? 404 : 200)
      .type('html')
      .send(renderIndex(template, meta, path));
  });
}
