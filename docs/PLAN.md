# Isaac Atlas — Plan de proyecto

Bitácora comunitaria de seeds, runs y sinergias para **The Binding of Isaac: Repentance+**.
Pensada para dejarse abierta de fondo (segundo monitor u overlay de Steam) mientras se juega.

---

## 1. Decisiones tomadas

| Tema              | Decisión                                                                                                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versión del juego | **Repentance+** únicamente. El modelo guarda `gameVersion` y cada ítem tiene `introducedIn`, así que agregar DLCs después = nuevo catálogo + mostrar el filtro. |
| Auth              | Email/contraseña + Google + Steam, con **Passport.js** y sesiones en cookie (ver §4).                                                                           |
| Sprites           | Sprites originales del juego, con aviso de atribución (fan site sin fines de lucro).                                                                            |
| Idioma            | Bilingüe **ES/EN** desde el día uno. Nombres de ítems canónicos en inglés.                                                                                      |
| Estilos           | CSS puro (CSS Modules + custom properties). Sin frameworks de estilos.                                                                                          |
| Lectura pública   | Buscar y ver runs no requiere cuenta. Subir runs y votar sí.                                                                                                    |

## 2. Realidades del juego que condicionan el diseño

- **Una seed no es determinista por sí sola.** El resultado depende de seed + versión + personaje + dificultad + **unlocks del save**. Cada run guarda `fullUnlocks: boolean` y el buscador lo filtra (por defecto: saves completos).
- **Primer piso vs. resto de la run.** Lo que aparece en Basement 1 depende de la seed; lo posterior depende del camino del jugador. Cada ítem se registra con `floor` y `source` (treasure, shop, devil, angel, boss, secret, curse, other). De ahí sale `startItems` → "empieza con Mutant Spider".
- **Ítems innatos.** Los ítems iniciales del personaje (D6 de Isaac, etc.) se autocompletan al elegir personaje y se marcan como `source: "innate"`.
- **Validación de seed.** 8 caracteres, alfabeto de 32 símbolos (sin I, O, U, 5), con checksum embebido. Se valida en `shared` (front y back). _Pendiente: verificar el algoritmo exacto del checksum antes de implementarlo._
- **Catálogo.** ~719 collectibles + ~189 trinkets (+ cartas/píldoras en una fase posterior). Se genera con un script a partir de los recursos del juego (`items.xml`, `items_metadata.xml`, `itempools.xml`, `gfx/items/`) extraídos con el _ResourceExtractor_ que trae la propia instalación del juego. Salida: `catalog.json` + **un único sprite sheet** (CSS `background-position`).

## 3. Arquitectura

```
isaac-atlas/                    npm workspaces
├─ apps/web                     React 18 + TS + Vite · CSS Modules
├─ apps/api                     Node 22 + TS + Express · Mongoose · Passport
├─ packages/shared              tipos, esquemas Zod, validador de seed, catálogo, i18n de dominio
├─ scripts/                     generación de catálogo y sprite sheet
├─ docker-compose.yml           MongoDB local
└─ docs/
```

**Frontend**

- React Router (rutas), TanStack Query (estado de servidor: caché, paginación por cursor, votos optimistas), `useReducer` + context para el formulario de run.
- i18n con `react-i18next`; textos en `locales/{es,en}.json`.
- Búsqueda de ítems 100 % en cliente sobre el catálogo estático (fuzzy, con alias), navegación por teclado.
- Rendimiento en segundo plano: animaciones solo CSS (`transform`/`opacity`), pausadas con `visibilitychange`, respeto de `prefers-reduced-motion`, sin timers de JS en idle.

**Estética**: menús de papel rasgado del juego × web de los 2000. `border-image` para bordes rústicos, fuente pixel (Press Start 2P / Silkscreen), cursores `.png` propios, `image-rendering: pixelated`, layouts con CSS Grid, contador de visitas falso, transiciones tipo menú del juego.

**Backend**

- Express + Helmet + `express-rate-limit` + validación Zod en cada endpoint.
- Mongoose sobre MongoDB (Docker en dev, Atlas M0 en prod).
- Testing: Vitest + Supertest contra el Mongo real de Docker (base `isaac-atlas-test`), en lugar de `mongodb-memory-server`: más fiel (índices únicos parciales, TTL, connect-mongo) y sin descargar binarios. En CI hará falta un servicio Mongo.

## 4. Autenticación

**Sesiones en servidor, no JWT.** Con flujos OAuth/OpenID por redirección, una cookie de sesión `httpOnly` es lo más simple y seguro (revocable, nada sensible en el cliente).

- `express-session` + `connect-mongo` (sesiones guardadas en Mongo), cookie `httpOnly`, `Secure` en prod, `SameSite=Lax`.
- Protección CSRF para mutaciones: `SameSite=Lax` + verificación del header `Origin` contra una allowlist.
- **Mismo sitio para front y API**: en dev, proxy de Vite `/api → :4000`; en prod, Express sirve el build del front (o ambos bajo el mismo dominio). Evita problemas de cookies de terceros.

**Estrategias**

| Proveedor        | Implementación                                                                                                      | Credenciales necesarias                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Email/contraseña | `passport-local` + **argon2id**                                                                                     | — (envío de mails: consola/Ethereal en dev, Resend en prod)   |
| Google           | `passport-google-oauth20`                                                                                           | Client ID/Secret de Google Cloud Console                      |
| Steam            | OpenID 2.0. `passport-steam` está sin mantenimiento → **strategy propia** chica (redirect + `check_authentication`) | Steam Web API key (solo para avatar/nombre, no para el login) |

**Modelo de cuenta**

```ts
User {
  username,                     // único, elegido en onboarding (los nombres de Google/Steam colisionan)
  email?, emailVerified,
  passwordHash?,
  identities: [{ provider: "google" | "steam", providerId, linkedAt }],
  avatar, locale, createdAt
}
```

- Vinculación de proveedores desde el perfil estando logueado.
- Autovinculación por email **solo** si el email viene verificado (Google sí; Steam no da email).
- Flujos de email: verificación de cuenta y reseteo de contraseña con tokens de un solo uso (hash guardado, TTL index).

**Decisiones de implementación (fase 3)**

- Steam OpenID 2.0 propio (sin `passport-steam`): se verifica con `check_authentication` contra Steam, `return_to` exacto, `claimed_id` de `steamcommunity.com`, y un `state` aleatorio guardado en la sesión dentro del `return_to`.
- Google con `passport-google-oauth20` y `state: true`. Sin credenciales, el botón no aparece (`GET /api/auth/providers`).
- Anti pre-hijacking: si un login de Google/Steam llega con email verificado que coincide con una cuenta local sin verificar, se verifica y **se le borra la contraseña**.
- Un reset de contraseña cierra todas las sesiones del usuario.
- Login sin enumeración de usuarios (hash falso para igualar tiempos); `forgot` siempre responde 204.
- CSRF: `SameSite=Lax` + verificación de `Origin` en toda mutación. Rate limit (30 req / 15 min) en login, registro, forgot, reset y verificación.
- Pendiente para producción: configurar SMTP real (Resend) y credenciales de Google; hoy los mails salen por consola.

## 5. Modelo de datos

```ts
Run {
  seed: "ABCDEFGH",                        // normalizada; se muestra "ABCD EFGH"
  gameVersion: "rep+", character, difficulty: "normal"|"hard"|"greed"|"greedier",
  challenge?, fullUnlocks: boolean,
  items:    [{ itemId, floor: "B1", source, order }],
  trinkets: [{ trinketId, floor, order }],
  startItems: [itemId],                    // derivado al guardar
  outcome: { result: "win"|"death"|"quit", lastFloor, finalBoss? },
  notes, author: ObjectId, createdAt, updatedAt,
  stats: { up, down, wilson, hot, verdicts: { op, troll, hard } }   // desnormalizado
}
Vote    { userId, runId, value: 1 | -1 }               // único (userId, runId)
Verdict { userId, runId, kind: "op"|"troll"|"hard" }   // uno por usuario y run
Report  { userId, runId, reason, status }
```

**Índices**: `{ gameVersion, character, "items.itemId" }`, `{ startItems }`, `{ seed }`, `{ "stats.hot": -1 }`, `{ "stats.wilson": -1 }`, `{ createdAt: -1 }`.

**Ranking**

- _Top_: límite inferior del intervalo de Wilson (no premia runs con pocos votos).
- _Hot_: score con decaimiento temporal; se recalcula en cada voto y con un job periódico.
- _Seed del día_: job diario que elige entre runs recientes bien rankeadas.

## 6. API (borrador)

```
POST   /api/auth/register | /login | /logout        GET /api/auth/me
GET    /api/auth/google | /google/callback | /steam | /steam/callback
POST   /api/auth/verify-email | /forgot | /reset

GET    /api/runs?character&difficulty&startItems&items&exclude&verdict&result&sort=hot|top|new&cursor
POST   /api/runs          GET/PATCH/DELETE /api/runs/:id
PUT    /api/runs/:id/vote            DELETE /api/runs/:id/vote
PUT    /api/runs/:id/verdict         POST   /api/runs/:id/report
GET    /api/seeds/:seed              (todas las runs de esa seed, agregadas)
GET    /api/daily                    GET    /api/users/:username
```

## 7. Fases

| Fase   | Contenido                                                                      | Entregable                             |
| ------ | ------------------------------------------------------------------------------ | -------------------------------------- |
| 0      | Monorepo, TS estricto, ESLint/Prettier, Docker Mongo, git                      | `npm run dev` levanta front + API + DB |
| 1      | Script de catálogo + sprite sheet, validador de seed en `shared`               | Catálogo navegable                     |
| 2      | Sistema de diseño retro: tokens, fuentes, cursores, componentes base, i18n     | Página de componentes                  |
| 3      | Auth completa (local + Google + Steam, onboarding, vinculación)                | Login funcional                        |
| 4      | Formulario de run + modo "Run en curso" (borrador en `localStorage`, atajos)   | Cargar runs                            |
| 5      | Buscador + filtros + página de seed                                            | Buscar seeds                           |
| 6      | Votos, veredictos, ranking Hot/Top/New, Seed del día                           | Feed comunitario                       |
| 7      | Perfil, reportes, rate limiting fino, deploy                                   | Online                                 |
| Futuro | Import de unlocks vía Steam API, comentarios, retos semanales, filtros por DLC | —                                      |

## 7b. Decisiones de implementación (fase 4)

- **Ítems innatos pendientes.** `players.xml` no incluye los ítems iniciales de cada personaje (viven en el código del juego) y la wiki no se pudo leer de forma confiable, así que no se autocompletan (D6 de Isaac, etc.). Hoy se cargan a mano; cargar esa tabla de forma verificada queda como tarea de datos.
- **Pisos 1-13** (numéricos, con nombres ES/EN para la ruta normal y la alternativa). `startItems` = ítems del piso 1, derivado en el servidor (el cliente no lo puede fijar).
- **Personajes:** 17 normales + 17 Tainted desde `players.xml` (formas transitorias excluidas). ID de jugador = `characterId`.
- **Borrador** de la run en `localStorage` (con recuperación parcial si está corrupto); se borra explícitamente al guardar.
- **API de runs:** crear, ver (público), `mine`, `PUT` y `DELETE` (solo el autor). La edición todavía no tiene UI.
- Buscador de ítems 100 % en cliente (EN/ES sin tildes, sin artículos iniciales, por ID).

## 7c. Decisiones de implementación (fase 5)

- `GET /api/runs`: filtros `character`, `difficulty`, `result`, `fullUnlocks`, `seed`, `startItems` (todos entre los del piso 1), `items` (todos, en cualquier piso) y `exclude` (ninguno). Máximo 10 ítems por lista. Esquema compartido en `packages/shared/src/search.ts`.
- Paginación por cursor opaco sobre `(createdAt, _id)`: estable con runs nuevas y con `createdAt` empatado. Orden fijo por fecha; `hot`/`top` llegan con los votos (fase 6).
- `GET /api/seeds/:seed`: runs de esa seed, personajes y los ítems que más se repiten (cuenta runs, no copias).
- Los filtros viven en la URL (`/?character=0&startItems=153&items=105`): se pueden compartir y funcionan con el botón atrás. `/` es ahora la página de búsqueda.

## 7d. Decisiones de implementación (fase 6)

- **Votos:** uno por usuario y run (índice único). El delta sale del documento anterior (`findOneAndUpdate` con `new: false`), así que repetir o duplicar una petición no suma dos veces. No se puede votar la propia run.
- **Veredictos** (`op` / `troll` / `hard`): uno por usuario y run, cambiable y quitable, independiente del voto. Una run cuenta como OP/Troll/Hard con `MIN_VERDICT_VOTES` (hoy 1) veredictos de ese tipo; es una constante en `shared` para ajustar si hay abuso.
- **Contadores desnormalizados** en `run.stats` (`up`, `down`, `op`, `troll`, `hard`, `wilson`, `hot`), actualizados con `$inc` y recalculados después.
- **Top** = límite inferior de Wilson (95 %). **Hot** = `sign · log10(|up−down|+1) + antigüedad/45000 s`, con la antigüedad fija al crear la run: no hace falta job periódico (cambia respecto al plan original, donde se pensó recalcular con un job). El `+1` hace que un solo voto ya pese.
- **Orden** `hot` (por defecto) / `top` / `new` con cursor que incluye el puntaje; un cursor de otro orden da 400.
- **Seed del día:** se elige al primer pedido de la fecha UTC (mejor Wilson entre las de 30 días, sin repetir las de los últimos 14) y queda fija; índice único por fecha para que pedidos simultáneos no elijan dos.
- **Web:** votos optimistas con rollback si falla; al terminar se reemplaza por lo que respondió el servidor (la run no salta de lugar mientras se mira).
- Al borrar una run se borran sus votos y veredictos.

## 7e. Decisiones de implementación (fase 7)

- **Perfil público** (`/u/:username`): solo username, fecha de alta y totales recibidos. **No** expone email ni avatar (la foto de Google/Steam es un dato personal que el usuario no eligió publicar). Las runs se listan con `GET /api/runs?author=`.
- **Reportes:** uno por usuario y run, no se puede reportar la propia. Con `REPORT_HIDE_THRESHOLD` (3) reportes abiertos la run sale de listas, seeds, perfil y seed del día (sigue accesible por link y en "Mis runs"). Un moderador descarta (todos los reportes de esa run) o la quita (los reportes quedan como constancia).
- **Rol `admin`** solo por script (`npm run make-admin -- <username>`): no hay forma de pedirlo desde la web.
- **Rate limiting** (`limiters.ts`): techo general por IP, auth por IP, y escritura/votos/reportes **por cuenta** (una IP compartida no bloquea a los demás). Se guarda en memoria: vale con una sola instancia.
- **Deploy:** la API sirve la web compilada (un solo origen). CSP de helmet ampliada solo para los avatares de Google/Steam. Dockerfile multi-etapa verificado (corre como usuario no-root, healthcheck). Guía en `docs/DEPLOY.md`.
- **Cookie de sesión:** detrás de un proxy TLS necesita `TRUST_PROXY` bien configurado; si no, no se emite (se descubrió al probar el contenedor).
- Fuera de alcance (quedó documentado): borrado de cuenta/export de datos, edición de runs desde la web (la API ya lo soporta), importar unlocks desde Steam, comentarios y retos semanales.

## 8. Pendientes del usuario (cuando lleguemos a cada fase)

- **Fase 1**: ruta de instalación del juego para extraer recursos con el ResourceExtractor.
- **Fase 3**: crear credenciales OAuth de Google y la Steam Web API key (van en `.env`, nunca en el repo).
- **Fase 7**: elegir hosting y dominio.
