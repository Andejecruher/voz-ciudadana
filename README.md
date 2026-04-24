# VozCiudadana 🏛️

Plataforma de participación ciudadana que permite a vecinos interactuar con su municipio a través de **WhatsApp**. Los ciudadanos se registran mediante un bot conversacional y pueden reportar problemas de su barrio.

---

## Arquitectura

```
voz-ciudadana/
├── backend/               # API Express (Node.js 20+)
│   ├── src/
│   │   ├── config/        # Tipos de env (AppEnv) y tipos de dominio compartidos
│   │   ├── routes/        # Rutas de Express (webhook.routes.ts)
│   │   ├── controllers/   # Controllers HTTP — orquestan req/res hacia services
│   │   ├── services/      # Lógica de negocio: BotService, PrismaService, RedisService
│   │   ├── middlewares/   # metaSignature (HMAC), jwt (Bearer token)
│   │   ├── database/      # Singleton de PrismaClient para uso directo
│   │   ├── utils/         # Helpers reutilizables (hmac, normalización de teléfono)
│   │   └── server.ts      # Bootstrap Express — entry point
│   ├── prisma/            # Schema y migraciones (Prisma ORM)
│   ├── .eslintrc.js       # ESLint con @typescript-eslint strict
│   ├── .prettierrc        # Prettier config
│   ├── .husky/pre-commit  # Pre-commit hook: lint-staged
│   ├── Dockerfile
│   └── .env.example
├── frontend/              # (reservado — vacío por ahora)
└── docker-compose.yml     # Orquestación local: api + postgres + redis
```

### Capas del backend

| Capa             | Directorio     | Responsabilidad                                                 |
| ---------------- | -------------- | --------------------------------------------------------------- |
| **Config**       | `config/`      | Tipos de env (`AppEnv`) y tipos de dominio                      |
| **Routes**       | `routes/`      | Registra rutas Express con sus middlewares                      |
| **Controllers**  | `controllers/` | Handlers HTTP — parsean req y delegan a services                |
| **Services**     | `services/`    | Lógica de negocio + infraestructura (Prisma, Redis, Bot FSM)    |
| **Middlewares**  | `middlewares/` | HMAC Meta, JWT Bearer                                           |
| **Database**     | `database/`    | Singleton PrismaClient                                          |
| **Utils**        | `utils/`       | Helpers puros: validación HMAC, normalización de teléfono       |
| **Persistencia** | `prisma/`      | Schema Prisma con Colony (slug), Citizen, Conversation, Message |
| **Entrada**      | `server.ts`    | Bootstrap Express con cors, helmet, swagger                     |

### Stack

- **Express 4** + **Node.js 20** — API HTTP minimalista y tipada
- **TypeScript 5 strict** — tipos estrictos end-to-end con path aliases
- **PostgreSQL 16** + **Prisma 5** — persistencia con ORM type-safe
- **Redis 7** — estado FSM del bot (TTL 24 h) via ioredis
- **helmet + cors** — seguridad HTTP base
- **jsonwebtoken** — autenticación JWT para rutas de admin
- **swagger-jsdoc + swagger-ui-express** — documentación OpenAPI 3.0
- **Docker** multi-stage — imagen de producción liviana
- **Husky + lint-staged** — pre-commit hooks para lint y format

---

## Instalación de dependencias

```bash
cd backend

# Instalar todas las dependencias (runtime + devDependencies)
npm install \
  @prisma/client \
  cors \
  dotenv \
  express \
  helmet \
  ioredis \
  jsonwebtoken \
  swagger-jsdoc \
  swagger-ui-express

npm install --save-dev \
  @types/cors \
  @types/express \
  @types/jsonwebtoken \
  @types/node \
  @types/swagger-jsdoc \
  @types/swagger-ui-express \
  @typescript-eslint/eslint-plugin \
  @typescript-eslint/parser \
  eslint \
  husky \
  lint-staged \
  prettier \
  prisma \
  tsc-alias \
  ts-node \
  ts-node-dev \
  tsconfig-paths \
  typescript

# Inicializar Husky (genera .husky/_/husky.sh)
npm run prepare

# Generar cliente Prisma
npm run prisma:generate
```

---

## Setup de desarrollo

### 1. Copiar variables de entorno

```bash
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores reales
```

Variables obligatorias:

| Variable                   | Descripción                                        |
| -------------------------- | -------------------------------------------------- |
| `DATABASE_URL`             | URL de conexión PostgreSQL (Prisma format)         |
| `REDIS_HOST`               | Host de Redis                                      |
| `REDIS_PORT`               | Puerto de Redis                                    |
| `WHATSAPP_VERIFY_TOKEN`    | Token de verificación del webhook (lo definís vos) |
| `WHATSAPP_APP_SECRET`      | App Secret de la app Meta                          |
| `WHATSAPP_ACCESS_TOKEN`    | Token de la Cloud API de WhatsApp                  |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono en Meta                  |
| `PORT`                     | Puerto de la API (default: `8000`)                 |
| `NODE_ENV`                 | Entorno (development / production)                 |

### 2. Levantar con Docker Compose (dev)

> Usa el profile `dev` para levantar API + Postgres + Redis locales.

```bash
docker-compose --profile dev up --build
```

La API queda disponible en `http://localhost:8000`.

Para bajar todo:

```bash
docker-compose --profile dev down
```

### 3. Levantar con Docker Compose (prod)

> Usa el profile `prod` para levantar solo la API.
> **No** crea Postgres ni Redis: deben existir externos.

Opcion A: exportar variables en tu shell

```bash
export DATABASE_URL=postgresql://user:pass@host:5432/db
export REDIS_HOST=redis-host
export REDIS_PORT=6379
export PORT=8000
docker-compose --profile prod up --build -d
```

Opcion B: crear un archivo `.env` en la raiz del repo con esas variables
(`docker-compose` lo carga automaticamente).

La API queda disponible en `http://localhost:8000`.

### 4. Desarrollo local (sin Docker)

```bash
cd backend
npm install

# Generar cliente Prisma
npx prisma generate

# Ejecutar migraciones
npx prisma migrate dev

# Iniciar en modo watch
npm run start:dev
```

La API corre en `http://localhost:8000`.  
Documentación Swagger en `http://localhost:8000/docs`.

### 5. Ejecutar migraciones (producción)

```bash
# Dentro del contenedor de la API (dev)
docker-compose --profile dev exec api npx prisma migrate deploy

# Dentro del contenedor de la API (prod)
docker-compose --profile prod exec api-prod npx prisma migrate deploy

# O localmente
cd backend && npx prisma migrate deploy
```

### 6. Crear una nueva migración tras cambiar el schema

```bash
cd backend && npx prisma migrate dev --name descripcion_del_cambio
```

---

## Endpoints

### Health check

```
GET /health
```

Retorna `{ status: "ok", ts: "<iso-timestamp>" }`.

---

## Webhook de WhatsApp

### Verificación (GET)

Meta llama a `GET /webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE`.

El endpoint valida el token contra `WHATSAPP_VERIFY_TOKEN` y responde con el challenge en texto plano.

### Mensajes entrantes (POST)

Meta envía un `POST /webhook` con el payload JSON firmado con HMAC-SHA256.

El header `X-Hub-Signature-256: sha256=<digest>` se valida usando el `WHATSAPP_APP_SECRET`.
Si la firma es inválida, se responde `401 Unauthorized`.

> **Importante:** el endpoint siempre responde `200 OK` a Meta en menos de 5 segundos.
> El procesamiento real ocurre de forma asíncrona.

### Documentación interactiva

```
http://localhost:8000/docs       # Swagger UI
http://localhost:8000/docs.json  # OpenAPI JSON spec
```

### Flujo de registro FSM

```
Estado START         → bot saluda, pide nombre completo
Estado AWAITING_NAME → recibe nombre, lo guarda en DB y Redis, pide colonia
Estado AWAITING_COLONY → valida elección de colonia, pide intereses
Estado AWAITING_INTERESTS → registra intereses, activa ciudadano, COMPLETE
Estado COMPLETE      → mensajes se persisten, pendiente de derivación a agente
```

Si la entrada no es válida en cualquier estado, el bot pide reintento sin avanzar.

---

## Notas de producción

- Cambiar `NODE_ENV=production` para ajustar logging y optimizaciones.
- Restringir `allow_origins` en CORS al dominio del frontend.
- Usar secrets manager (AWS Secrets Manager, Vault, etc.) en lugar de `.env` para credenciales.
- Escalar Redis con autenticación habilitada (`requirepass`).

---

## Deploy en Railway (backend)

Este repo incluye `railway.json` para forzar el build con Dockerfile en monorepo.

1. Crear un servicio en Railway desde este repo.
2. Configurar variables de entorno (externas):
   - `DATABASE_URL`
   - `REDIS_HOST`
   - `REDIS_PORT`
   - `REDIS_PASSWORD` (opcional)
   - `WHATSAPP_VERIFY_TOKEN`
   - `WHATSAPP_APP_ID`
   - `WHATSAPP_APP_SECRET`
   - `WHATSAPP_ACCESS_TOKEN`
   - `WHATSAPP_PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ACCOUNT_ID`
   - `PORT=8000`
   - `NODE_ENV=production`

3. El healthcheck se valida en `/health`.
