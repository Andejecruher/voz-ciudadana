# ─── Stage 1: deps — instala TODAS las dependencias (dev + prod) ───────────────
FROM node:20-alpine AS deps

WORKDIR /app

RUN apk add --no-cache openssl

COPY package.json pnpm-lock.yaml* ./

# npm ci para reproducibilidad; instala devDependencies también (default)
RUN npm install --frozen-lockfile

# ─── Stage 2: dev — imagen de desarrollo con hot-reload ────────────────────────
FROM deps AS dev

WORKDIR /app

# Copiar el resto del código fuente
COPY prisma ./prisma
COPY src ./src
COPY tsconfig.json ./

# Generar cliente Prisma (necesario antes de correr ts-node)
RUN npx prisma generate

EXPOSE 8000

# ts-node-dev con hot-reload; prisma migrate dev y seed se corren manualmente
CMD ["npm", "run", "dev"]

# ─── Stage 3: test — corre jest con devDependencies incluidas ─────────────────
FROM deps AS test

WORKDIR /app

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY tsconfig.json ./
COPY tsconfig.test.json* ./
COPY jest.config.js ./

CMD ["npm", "test", "--", "--runInBand"]

# ─── Stage 4: builder — compila TypeScript para producción ────────────────────
FROM deps AS builder

WORKDIR /app

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY tsconfig.json ./
RUN npm run build

# ─── Stage 4: runner — imagen de producción minimal ───────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

RUN apk add --no-cache openssl

# Solo dependencias de producción
COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile

# Copiar cliente Prisma generado y dist compilado
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/dist ./dist
COPY prisma ./prisma

EXPOSE 8000

# En prod: aplica migraciones pendientes y levanta la app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
