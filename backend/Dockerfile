# ─── Build stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

RUN apk add --no-cache openssl

# Copiar manifests primero para aprovechar caché de layers
COPY package.json tsconfig.json ./
RUN npm install --frozen-lockfile

# Copiar schema de Prisma y generar cliente
COPY prisma ./prisma
RUN npx prisma generate

# Copiar código fuente y compilar
COPY src ./src
RUN npm run build

# ─── Runtime stage ────────────────────────────────────────────────────────────
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

# Ejecutar migraciones y luego iniciar la app Express
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
