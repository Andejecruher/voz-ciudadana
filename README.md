# VozCiudadana 🏛️

Plataforma de participación ciudadana que permite a vecinos interactuar con su municipio a través de **WhatsApp**. Los ciudadanos se registran mediante un bot conversacional y pueden reportar problemas de su barrio.

---

## Arquitectura

```
voz-ciudadana/
├── backend/               # API Express (Node.js 20+)
│   ├── src/
│   │   ├── config/        # Tipos de env (AppEnv) y tipos de dominio compartidos
│   │   ├── router/        # createAppRouter — wiring manual de dependencias + rutas Express
│   │   ├── controller/    # Controllers HTTP (funciones handler de Express)
│   │   ├── services/      # Servicios de dominio e infraestructura
│   │   │   ├── prisma.service.ts
│   │   │   ├── redis.service.ts
│   │   │   ├── whatsapp-bot.service.ts
│   │   │   └── webhook.service.ts
│   │   ├── utils/         # Helpers reutilizables (hmac, normalización de teléfono)
│   │   └── server.ts      # Bootstrap Express — entry point
│   ├── prisma/            # Schema y migraciones (Prisma ORM)
│   ├── Dockerfile
│   └── .env.example
├── frontend/              # (reservado — vacío por ahora)
└── docker-compose.yml     # Orquestación local: api + postgres + redis
```

### Capas del backend

| Capa             | Directorio        | Responsabilidad                                              |
| ---------------- | ----------------- | ------------------------------------------------------------ |
| **Config**       | `config/`         | Tipos de variables de entorno (`AppEnv`) y tipos de dominio  |
| **Router**       | `router/`         | `createAppRouter` — monta rutas y wirings de controllers     |
| **Controller**   | `controller/`     | Handlers de Express (recibe req/res, delega a service)       |
| **Services**     | `services/`       | Lógica de negocio + infraestructura (Prisma, Redis, Bot FSM) |
| **Utils**        | `utils/`          | Helpers puros: validación HMAC, normalización de teléfono    |
| **Persistencia** | `prisma/`         | Schema Prisma, migraciones                                   |
| **Entrada**      | `server.ts`       | Bootstrap Express                                            |

### Stack

- **Express 4** + **Node.js 20** — API HTTP minimalista y tipada
- **TypeScript 5** — tipos estrictos end-to-end
- **PostgreSQL 16** + **Prisma 5** — persistencia con ORM type-safe
- **Redis 7** — estado FSM del bot (TTL 24 h) via ioredis
- **swagger-jsdoc + swagger-ui-express** — documentación OpenAPI 3.0
- **Docker** multi-stage — imagen de producción liviana

---

## Setup de desarrollo

### 1. Copiar variables de entorno

```bash
cp backend/.env.example backend/.env
# Editar backend/.env con tus valores reales
```

Variables obligatorias:

| Variable               | Descripción                                        |
| ---------------------- | -------------------------------------------------- |
| `DATABASE_URL`         | URL de conexión PostgreSQL (Prisma format)         |
| `REDIS_HOST`           | Host de Redis                                      |
| `REDIS_PORT`           | Puerto de Redis                                    |
| `WA_VERIFY_TOKEN`      | Token de verificación del webhook (lo definís vos) |
| `WA_APP_SECRET`        | App Secret de la app Meta                          |
| `WA_ACCESS_TOKEN`      | Token de la Cloud API de WhatsApp                  |
| `WA_PHONE_NUMBER_ID`   | ID del número de teléfono en Meta                  |
| `PORT`                 | Puerto de la API (default: `3000`)                 |
| `NODE_ENV`             | Entorno (development / production)                 |

### 2. Levantar con Docker Compose

```bash
docker-compose up --build
```

La API queda disponible en `http://localhost:3000`.

### 3. Desarrollo local (sin Docker)

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

La API corre en `http://localhost:3000`.  
Documentación Swagger en `http://localhost:3000/docs`.

### 4. Ejecutar migraciones (producción)

```bash
# Dentro del contenedor de la API
docker-compose exec api npx prisma migrate deploy

# O localmente
cd backend && npx prisma migrate deploy
```

### 5. Crear una nueva migración tras cambiar el schema

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

El endpoint valida el token contra `WA_VERIFY_TOKEN` y responde con el challenge en texto plano.

### Mensajes entrantes (POST)

Meta envía un `POST /webhook` con el payload JSON firmado con HMAC-SHA256.

El header `X-Hub-Signature-256: sha256=<digest>` se valida usando el `WA_APP_SECRET`.
Si la firma es inválida, se responde `401 Unauthorized`.

> **Importante:** el endpoint siempre responde `200 OK` a Meta en menos de 5 segundos.
> El procesamiento real ocurre de forma asíncrona.

### Documentación interactiva

```
http://localhost:3000/docs       # Swagger UI
http://localhost:3000/docs.json  # OpenAPI JSON spec
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
