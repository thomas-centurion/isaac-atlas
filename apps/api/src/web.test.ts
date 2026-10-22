import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import request from 'supertest';
import { afterAll, describe, expect, it, vi } from 'vitest';

// La ruta del build se lee al cargar la config: se prepara una carpeta falsa antes de importar.
const dist = mkdtempSync(join(tmpdir(), 'isaac-web-'));
mkdirSync(join(dist, 'assets'));
writeFileSync(
  join(dist, 'index.html'),
  '<!doctype html><html><head><title>Isaac Atlas</title></head><body><div id="root"></div></body></html>',
);
writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log("hi")');
writeFileSync(join(dist, 'robots.txt'), 'User-agent: *');
vi.stubEnv('WEB_DIST', dist);

const { createApp } = await import('./app.js');
const app = createApp();

afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe('servir la web desde la API', () => {
  it('la raíz devuelve index.html sin cache (para tomar siempre el build nuevo)', async () => {
    const res = await request(app).get('/');
    expect(res.status).toBe(200);
    expect(res.text).toContain('<div id="root">');
    expect(res.headers['cache-control']).toBe('no-cache');
  });

  it('las rutas de React Router caen en index.html', async () => {
    for (const path of ['/runs/abc', '/u/Alice', '/seeds/ABCD1234', '/login']) {
      const res = await request(app).get(path);
      expect(res.status, path).toBe(200);
      expect(res.text).toContain('<div id="root">');
    }
  });

  it('los assets con hash se cachean para siempre; el resto, un día', async () => {
    const asset = await request(app).get('/assets/app-abc123.js');
    expect(asset.status).toBe(200);
    expect(asset.headers['cache-control']).toBe('public, max-age=31536000, immutable');

    const other = await request(app).get('/robots.txt');
    expect(other.headers['cache-control']).toBe('public, max-age=86400');
  });

  it('/api sigue devolviendo JSON (no cae en index.html)', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not_found' });
    expect((await request(app).get('/api/health')).body.status).toBe('ok');
  });

  it('la CSP restringe scripts a self y permite los avatares de Google y Steam', async () => {
    const csp = String((await request(app).get('/')).headers['content-security-policy']);
    expect(csp).toContain("default-src 'self'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toMatch(/img-src[^;]*https:\/\/\*\.googleusercontent\.com/);
    expect(csp).toMatch(/img-src[^;]*https:\/\/\*\.steamstatic\.com/);
    expect(csp).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it('inyecta título, descripción y canonical por página, escapando el contenido', async () => {
    const home = (await request(app).get('/')).text;
    expect(home).toContain('<meta name="description"');
    expect(home).toContain('<link rel="canonical"');
    expect(home).toContain('og:title');

    // Perfil con caracteres inválidos para HTML: nunca llega sin escapar al documento.
    const evil = await request(app).get('/seeds/%22%3E%3Cscript%3E');
    expect(evil.text).not.toContain('<script>');
  });

  it('las páginas privadas llevan noindex y las rutas inexistentes dan 404 real', async () => {
    expect((await request(app).get('/login')).text).toContain('noindex');
    const missing = await request(app).get('/esto-no-existe');
    expect(missing.status).toBe(404);
    expect(missing.text).toContain('<div id="root">');
    expect((await request(app).get('/assets/viejo-123.js')).status).toBe(404);
    expect((await request(app).get('/assets/viejo-123.js')).headers['content-type']).toMatch(
      /text\/plain/,
    );
  });

  it('robots.txt apunta al sitemap y bloquea la API', async () => {
    const res = await request(app).get('/robots.txt');
    expect(res.text).toContain('Disallow: /api/');
    expect(res.text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });
});
