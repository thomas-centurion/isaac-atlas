# Isaac Atlas

Bitácora comunitaria de seeds y runs de **The Binding of Isaac: Repentance+**. Registrás una run con su seed, personaje e ítems por piso, y la comunidad la busca, la vota y la clasifica como _OP_, _Troll_ o _Difícil_.

Fan site sin fines de lucro. The Binding of Isaac y sus sprites pertenecen a Edmund McMillen y Nicalis, Inc.

🔗 **En vivo:** https://isaac-atlas.onrender.com

## Qué hace

- **Buscador** de runs por personaje, ítems iniciales, ítems que tiene y que no tiene, dificultad y resultado.
- **Votos y veredictos** con ranking _hot_, _top_ (límite inferior de Wilson) y _new_, más una seed del día.
- **Runs** con ítems y trinkets por piso, ítems iniciales según los desbloqueos, borrador local y edición.
- **Perfiles públicos**, páginas por seed, reportes y panel de moderación.
- **Cuentas** con email y contraseña, Google o Steam; exportación y borrado de datos.
- Bilingüe **ES/EN**, estética retro pixel, accesible (WCAG AA) y responsive.

## Stack

| Parte             | Tecnología                                                                           |
| ----------------- | ------------------------------------------------------------------------------------ |
| `apps/web`        | React 18, TypeScript, Vite, CSS Modules, TanStack Query, react-router, react-i18next |
| `apps/api`        | Node 22, Express, Mongoose, Passport, express-session + connect-mongo, argon2, Zod   |
| `packages/shared` | Esquemas Zod, catálogo de ítems, utilidades de seed (compartidos por web y API)      |
| Datos             | MongoDB (Atlas M0 en producción)                                                     |
| Tests             | Vitest + Supertest contra un Mongo real                                              |

Monorepo con npm workspaces. En producción la API sirve también la web compilada (un solo origen).

## Correrlo en local

Necesitás Node 22+ y Docker (para MongoDB).

```bash
npm install
cp .env.example .env
npm run dev
```

Abre la web en http://localhost:5173 (la API en :4000). `npm run dev` levanta Mongo con Docker.

> Los **sprites del juego no están en el repo**. Sin ellos la web funciona, pero los ítems se ven sin imagen. Si tenés el juego instalado, `npm run catalog` regenera el catálogo y el sprite sheet de ítems (ver `scripts/build-catalog.ts`), y `npm run faces` el de caras de personajes. Ambos usan la variable `ISAAC_EXTRACTED`.

## Scripts útiles

| Comando                           | Qué hace                                          |
| --------------------------------- | ------------------------------------------------- |
| `npm run check`                   | Formato, lint, tipos y tests (lo mismo que la CI) |
| `npm run build`                   | Compila web y API                                 |
| `npm run make-admin -- <usuario>` | Da el rol de moderador a un usuario               |

## Deploy

El deploy es una imagen Docker (construida en local, porque el sprite sheet no va al repo) que corre en Render con MongoDB Atlas. Las variables de entorno están documentadas en `.env.example`.

## Licencia y contenido

El código es del autor. Los nombres, ítems y sprites de The Binding of Isaac son propiedad de sus dueños y no se redistribuyen en este repositorio.
