# syntax=docker/dockerfile:1
#
# Una sola imagen: la API de Node sirve también la web compilada (un solo origen).
#
#   docker build -t isaac-atlas .
#   docker run -p 4000:4000 --env-file .env.production isaac-atlas
#
# Ojo: el sprite sheet (apps/web/public/sprites/items.png) no está en git. El build lo toma de
# tu carpeta local; si construís desde un checkout limpio, correr antes `npm run catalog`.

# ---------- build ----------
FROM node:22-slim AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci

COPY . .
RUN npm run build

# ---------- runtime ----------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=4000
ENV WEB_DIST=/app/apps/web/dist
WORKDIR /app

# Solo dependencias de producción de la API (el código compartido ya viene empaquetado en dist).
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev --workspace=@isaac-atlas/api --include-workspace-root=false \
  && npm cache clean --force

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/web/dist apps/web/dist

USER node
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://localhost:'+process.env.PORT+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "apps/api/dist/index.js"]
