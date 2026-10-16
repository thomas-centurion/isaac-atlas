# Isaac Atlas — Plan de proyecto

Bitácora comunitaria de seeds, runs y sinergias para **The Binding of Isaac: Repentance+**.
Pensada para dejarse abierta de fondo (segundo monitor u overlay de Steam) mientras se juega.

---

## 1. Decisiones tomadas

| Tema | Decisión |
|---|---|
| Versión del juego | **Repentance+** únicamente. El modelo guarda `gameVersion` y cada ítem tiene `introducedIn`, así que agregar DLCs después = nuevo catálogo + mostrar el filtro. |
| Auth | Email/contraseña + Google + Steam, con **Passport.js** y sesiones en cookie (ver §4). |
| Sprites | Sprites originales del juego, con aviso de atribución (fan site sin fines de lucro). |
| Idioma | Bilingüe **ES/EN** desde el día uno. Nombres de ítems canónicos en inglés. |
| Estilos | CSS puro (CSS Modules + custom properties). Sin frameworks de estilos. |
| Lectura pública | Buscar y ver runs no requiere cuenta. Subir runs y votar sí. |

## 2. Realidades del juego que condicionan el diseño

- **Una seed no es determinista por sí sola.** El resultado depende de seed + versión + personaje + dificultad + **unlocks del save**. Cada run guarda `fullUnlocks: boolean` y el buscador lo filtra (por defecto: saves completos).
- **Primer piso vs. resto de la run.** Lo que aparece en Basement 1 depende de la seed; lo posterior depende del camino del jugador. Cada ítem se registra con `floor` y `source` (treasure, shop, devil, angel, boss, secret, curse, other). De ahí sale `startItems` → "empieza con Mutant Spider".
- **Ítems innatos.** Los ítems iniciales del personaje (D6 de Isaac, etc.) se autocompletan al elegir personaje y se marcan como `source: "innate"`.
- **Validación de seed.** 8 caracteres, alfabeto de 32 símbolos (sin I, O, U, 5), con checksum embebido. Se valida en `shared` (front y back). *Pendiente: verificar el algoritmo exacto del checksum antes de implementarlo.*
- **Catálogo.** ~719 collectibles + ~189 trinkets (+ cartas/píldoras en una fase posterior). Se genera con un script a partir de los recursos del juego (`items.xml`, `items_metadata.xml`, `itempools.xml`, `gfx/items/`) extraídos con el *ResourceExtractor* que trae la propia instalación del juego. Salida: `catalog.json` + **un único sprite sheet** (CSS `background-position`).

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
- Testing: Vitest + Supertest + `mongodb-memory-server`.

## 4. Autenticación

**Sesiones en servidor, no JWT.** Con flujos OAuth/OpenID por redirección, una cookie de sesión `httpOnly` es lo más simple y seguro (revocable, nada sensible en el cliente).

- `express-session` + `connect-mongo` (sesiones guardadas en Mongo), cookie `httpOnly`, `Secure` en prod, `SameSite=Lax`.
- Protección CSRF para mutaciones: `SameSite=Lax` + verificación del header `Origin` contra una allowlist.
- **Mismo sitio para front y API**: en dev, proxy de Vite `/api → :4000`; en prod, Express sirve el build del front (o ambos bajo el mismo dominio). Evita problemas de cookies de terceros.

**Estrategias**
| Proveedor | Implementación | Credenciales necesarias |
|---|---|---|
| Email/contraseña | `passport-local` + **argon2id** | — (envío de mails: consola/Ethereal en dev, Resend en prod) |
| Google | `passport-google-oauth20` | Client ID/Secret de Google Cloud Console |
| Steam | OpenID 2.0. `passport-steam` está sin mantenimiento → **strategy propia** chica (redirect + `check_authentication`) | Steam Web API key (solo para avatar/nombre, no para el login) |

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
- *Top*: límite inferior del intervalo de Wilson (no premia runs con pocos votos).
- *Hot*: score con decaimiento temporal; se recalcula en cada voto y con un job periódico.
- *Seed del día*: job diario que elige entre runs recientes bien rankeadas.

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

| Fase | Contenido | Entregable |
|---|---|---|
| 0 | Monorepo, TS estricto, ESLint/Prettier, Docker Mongo, git | `npm run dev` levanta front + API + DB |
| 1 | Script de catálogo + sprite sheet, validador de seed en `shared` | Catálogo navegable |
| 2 | Sistema de diseño retro: tokens, fuentes, cursores, componentes base, i18n | Página de componentes |
| 3 | Auth completa (local + Google + Steam, onboarding, vinculación) | Login funcional |
| 4 | Formulario de run + modo "Run en curso" (borrador en `localStorage`, atajos) | Cargar runs |
| 5 | Buscador + filtros + página de seed | Buscar seeds |
| 6 | Votos, veredictos, ranking Hot/Top/New, Seed del día | Feed comunitario |
| 7 | Perfil, reportes, rate limiting fino, deploy | Online |
| Futuro | Import de unlocks vía Steam API, comentarios, retos semanales, filtros por DLC | — |

## 8. Pendientes del usuario (cuando lleguemos a cada fase)

- **Fase 1**: ruta de instalación del juego para extraer recursos con el ResourceExtractor.
- **Fase 3**: crear credenciales OAuth de Google y la Steam Web API key (van en `.env`, nunca en el repo).
- **Fase 7**: elegir hosting y dominio.
