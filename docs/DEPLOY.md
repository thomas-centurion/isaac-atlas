# Deploy de Isaac Atlas

La API de Node sirve también la web compilada: **un solo servicio, un solo origen**. Eso hace que la cookie de sesión (`SameSite=Lax`) y los callbacks de Google/Steam funcionen sin CORS. Hace falta una base MongoDB y HTTPS delante.

## 0. Decisión previa: el sprite sheet

`apps/web/public/sprites/items.png` (arte del juego) **está en `.gitignore`**: las instrucciones del juego piden no redistribuir recursos extraídos. Para desplegar hay tres caminos, a elegir:

1. **Construir la imagen en tu PC** (`docker build`, ver abajo): el sprite sheet local entra en la imagen; el repo sigue sin tenerlo. Es lo más simple y no publica nada en git.
2. **Subirlo al repo** (quitando la línea de `.gitignore`): permite deploy automático desde git. Hacelo solo con el repo **privado**, y asumiendo el riesgo de redistribuir arte de Nicalis (aunque sea un fan site sin fines de lucro).
3. **Servirlo desde un bucket/CDN** y cambiar `SHEET_URL` en `apps/web/src/ui/ItemIcon.tsx`.

El catálogo (`packages/shared/src/data/catalog.json`) sí está en git: son nombres, IDs y pools, no arte.

## 1. Variables de entorno

| Variable                                    | Obligatoria     | Descripción                                                                                                                                                                                        |
| ------------------------------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NODE_ENV`                                  | sí              | `production` (cookies `Secure`, `trust proxy`, sirve la web).                                                                                                                                      |
| `MONGODB_URI`                               | sí              | Cadena de conexión (Atlas o propia).                                                                                                                                                               |
| `SESSION_SECRET`                            | sí              | ≥ 16 caracteres aleatorios (`openssl rand -base64 32`). La API no arranca con el valor de desarrollo.                                                                                              |
| `WEB_ORIGIN`                                | sí              | URL pública con `https://`, sin barra final. También es el origen permitido para mutaciones.                                                                                                       |
| `PUBLIC_URL`                                | no              | Si la URL pública difiere de `WEB_ORIGIN`. Se usa en callbacks OAuth y links de mails.                                                                                                             |
| `PORT`                                      | no              | Por defecto 4000 (muchos hosts lo inyectan solos).                                                                                                                                                 |
| `TRUST_PROXY`                               | no              | Cantidad de proxies delante (1 por defecto; Cloudflare + hosting = 2). Si está mal, la API no ve el HTTPS original y **no emite la cookie de sesión**: el login parece funcionar pero no persiste. |
| `COOKIE_SECURE`                             | no              | `false` solo para probar un build de producción por `http://localhost`. Nunca en un sitio real.                                                                                                    |
| `WEB_DIST`                                  | no              | Carpeta del build de la web. Por defecto `../web/dist` (relativo a `apps/api`); la imagen Docker ya la fija.                                                                                       |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | no              | Sin ellas el botón de Google no aparece.                                                                                                                                                           |
| `STEAM_API_KEY`                             | no              | Solo para el avatar de Steam. El login por Steam no la necesita.                                                                                                                                   |
| `SMTP_URL`                                  | **recomendada** | Sin SMTP los mails (verificación, reset) solo salen por consola: los usuarios no podrían verificar el email.                                                                                       |
| `MAIL_FROM`                                 | no              | Remitente, p. ej. `Isaac Atlas <no-reply@tu-dominio>`.                                                                                                                                             |

## 2. MongoDB Atlas (gratis)

1. Crear un cluster **M0** en https://www.mongodb.com/atlas.
2. _Database Access_: usuario con contraseña propia (rol `readWrite` sobre la base).
3. _Network Access_: permitir la IP de tu hosting (o `0.0.0.0/0` si el host no tiene IP fija; en ese caso la contraseña tiene que ser fuerte).
4. Copiar la cadena `mongodb+srv://…` a `MONGODB_URI` (con `/isaac-atlas` como base).

La API crea los índices al arrancar (únicos parciales, TTL de tokens y sesiones).

## 3. Opción A — Docker en cualquier host (Render, Railway, Fly, VPS…)

```bash
docker build -t isaac-atlas .
docker run -p 4000:4000 --env-file .env.production isaac-atlas
```

- **Render / Railway / Fly:** apuntar al `Dockerfile` de la raíz. Si el servicio construye desde git, ver el punto 0 sobre el sprite sheet. Configurar las variables de la tabla y el puerto 4000.
- **VPS con Docker:** `docker-compose.prod.yml` levanta la app y Mongo juntos. Poné delante Caddy o Nginx con HTTPS apuntando al puerto 4000.
- El `HEALTHCHECK` consulta `/api/health` (devuelve `db: "up"` cuando conectó a Mongo).

## 4. Opción B — Sin Docker

```bash
npm ci
npm run catalog        # solo si necesitás regenerar catálogo/sprites (requiere el juego)
npm run build
NODE_ENV=production npm start -w @isaac-atlas/api
```

La API busca la web en `../web/dist` (relativo a `apps/api`) o en `WEB_DIST`.

## 5. Google y Steam en producción

- **Google Cloud Console** → credenciales OAuth: agregar
  - Origen autorizado: `https://tu-dominio`
  - URI de redirección: `https://tu-dominio/api/auth/google/callback`
  - Y publicar la pantalla de consentimiento (si queda en "Testing", solo entran los usuarios de prueba).
- **Steam:** no hay nada que registrar. El `realm` y el `return_to` salen de `PUBLIC_URL`/`WEB_ORIGIN`, que tienen que ser la URL real con `https://`.

## 6. Email (SMTP)

Cualquier proveedor SMTP sirve. Ejemplo con Resend:

```
SMTP_URL=smtps://resend:TU_API_KEY@smtp.resend.com:465
MAIL_FROM=Isaac Atlas <no-reply@tu-dominio>
```

Verificá el dominio remitente (SPF/DKIM) en el proveedor, o los mails caen en spam.

## 7. Primer moderador

El rol `admin` no se puede pedir desde la web. Después de registrarte:

```bash
MONGODB_URI="mongodb+srv://…" npm run make-admin -- TuUsername
```

(En desarrollo basta `npm run make-admin -- TuUsername` con tu `.env`.) Aparece el link **Moderación** en el menú.

## 8. Checklist post-deploy

- [ ] `GET /api/health` → `{"status":"ok","db":"up"}`
- [ ] Registro con email → llega el mail → el link verifica la cuenta
- [ ] Login con Google y con Steam (y vincular desde _Mi cuenta_)
- [ ] Crear una run, votarla desde otra cuenta, reportarla
- [ ] Las cookies tienen `Secure` y `HttpOnly` (DevTools → Application)
- [ ] Los sprites cargan (`/sprites/items.png` responde 200)
- [ ] Backups de Mongo activados (Atlas M0 no los incluye: exportar con `mongodump` periódicamente o pasar a un plan con backup)

## 9. Cosas que conviene saber

- **Límites de tasa** (`apps/api/src/limiters.ts`): se guardan en memoria del proceso. Con **una sola instancia** funcionan tal cual; si algún día escalás a varias, hay que moverlos a un store compartido (Redis).
- **Moderación:** una run con 3 reportes abiertos de usuarios distintos sale de las listas hasta que un admin la revise.
- **Datos personales (RGPD):** cada usuario puede descargar todo lo que se guarda de él (`GET /api/account/export`) y borrar su cuenta (`DELETE /api/account`) desde _Mi cuenta_. Falta, si el sitio tiene público europeo, publicar una política de privacidad que lo explique (qué se guarda: email, username, identificadores de Google/Steam, runs, votos y reportes).
