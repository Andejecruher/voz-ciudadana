# VozCiudadana 🏛️

Plataforma de participación ciudadana que permite a vecinos interactuar con su municipio a través de **WhatsApp**. Los ciudadanos se registran mediante un bot conversacional y pueden reportar problemas de su barrio.

---

## Arquitectura

```
voz-ciudadana/
├── backend/               # API FastAPI (Python 3.11+)
│   ├── app/
│   │   ├── core/          # Config, DB connection, Security utilities
│   │   ├── api/           # Routers y endpoints HTTP
│   │   ├── db/            # Modelos SQLAlchemy (ORM)
│   │   ├── schemas/       # Schemas Pydantic v2 (validación / serialización)
│   │   └── services/      # Lógica de negocio (WhatsApp bot FSM)
│   ├── alembic/           # Migraciones de base de datos
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/              # (reservado — vacío por ahora)
└── docker-compose.yml     # Orquestación local: api + postgres + redis
```

### Capas (Clean Architecture)

| Capa                         | Directorio    | Responsabilidad                       |
| ---------------------------- | ------------- | ------------------------------------- |
| **Infraestructura**          | `core/`       | Configuración, conexión DB, seguridad |
| **Entidades / Persistencia** | `db/models/`  | Modelos SQLAlchemy                    |
| **Contratos de datos**       | `schemas/`    | Pydantic v2 (entrada/salida)          |
| **Lógica de negocio**        | `services/`   | Bot FSM, reglas de dominio            |
| **Adaptadores HTTP**         | `api/routes/` | Endpoints FastAPI                     |

### Stack

- **FastAPI** + **Uvicorn** — API asíncrona
- **PostgreSQL 16** + **SQLAlchemy 2 async** + **Alembic** — persistencia
- **Redis 7** — estado FSM del bot (TTL 24 h)
- **Pydantic v2** + **pydantic-settings** — validación y config
- **Docker** multi-stage — imagen de producción liviana

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
| `DATABASE_URL`             | URL asyncpg de PostgreSQL                          |
| `REDIS_URL`                | URL de Redis                                       |
| `WHATSAPP_VERIFY_TOKEN`    | Token de verificación del webhook (lo definís vos) |
| `WHATSAPP_APP_SECRET`      | App Secret de la app Meta                          |
| `WHATSAPP_ACCESS_TOKEN`    | Token de la Cloud API de WhatsApp                  |
| `WHATSAPP_PHONE_NUMBER_ID` | ID del número de teléfono en Meta                  |
| `JWT_SECRET_KEY`           | Clave secreta para firmar tokens JWT               |
| `JWT_ALGORITHM`            | Algoritmo JWT (default: `HS256`)                   |
| `JWT_EXPIRE_MINUTES`       | Duración del access token en minutos (default: 60) |

### 2. Levantar con Docker Compose

```bash
docker-compose up --build
```

La API queda disponible en `http://localhost:8000`.  
Swagger UI: `http://localhost:8000/docs`

### 3. Ejecutar migraciones

```bash
# Dentro del contenedor de la API (o con venv local)
docker-compose exec api alembic upgrade head
```

### 4. Crear una nueva migración tras cambiar modelos

```bash
docker-compose exec api alembic revision --autogenerate -m "descripcion_del_cambio"
docker-compose exec api alembic upgrade head
```

---

## Webhook de WhatsApp

### Verificación (GET)

Meta llama a `GET /api/v1/webhook?hub.mode=subscribe&hub.verify_token=TOKEN&hub.challenge=CHALLENGE`.

El endpoint valida el token contra `WHATSAPP_VERIFY_TOKEN` y responde con el challenge en texto plano.

### Mensajes entrantes (POST)

Meta envía un `POST /api/v1/webhook` con el payload JSON firmado con HMAC-SHA256.

El header `X-Hub-Signature-256: sha256=<digest>` se valida usando el `WHATSAPP_APP_SECRET`.  
Si la firma es inválida, se responde `401 Unauthorized`.

> **Importante:** el endpoint siempre responde `200 OK` a Meta en menos de 5 segundos.  
> El procesamiento real ocurre en un `BackgroundTask` de FastAPI.

### Flujo de registro FSM

```
Estado 0 → bot saluda, pide nombre
Estado 1 → recibe nombre, lo guarda en Redis, pide barrio
Estado 2 → valida barrio (lista estática), registra ciudadano en DB
```

Si el barrio no está en la lista, el bot pide reintento sin avanzar de estado.

---

## Endpoints disponibles

| Método | Ruta                               | Descripción                              | Auth requerida |
| ------ | ---------------------------------- | ---------------------------------------- | -------------- |
| GET    | `/api/v1/health`                   | Estado de la API                         | No             |
| GET    | `/api/v1/webhook`                  | Verificación del webhook Meta            | No             |
| POST   | `/api/v1/webhook`                  | Recepción de mensajes WhatsApp           | No (HMAC)      |
| POST   | `/api/v1/auth/login`               | Login con email + password → JWT         | No             |
| GET    | `/api/v1/auth/me`                  | Perfil del usuario autenticado           | Bearer JWT     |
| POST   | `/api/v1/admin/users`              | Crear usuario del sistema                | Admin only     |
| POST   | `/api/v1/admin/users/{id}/roles`   | Asignar rol a un usuario                 | Admin only     |

---

## Auth API

### Login

```bash
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "supersecret"}'
```

Respuesta:
```json
{"access_token": "<jwt>", "token_type": "bearer"}
```

### Perfil autenticado

```bash
curl http://localhost:8000/api/v1/auth/me \
  -H "Authorization: Bearer <jwt>"
```

### Crear usuario (solo admin)

```bash
curl -X POST http://localhost:8000/api/v1/admin/users \
  -H "Authorization: Bearer <jwt_admin>" \
  -H "Content-Type: application/json" \
  -d '{"email": "agente@example.com", "password": "agente1234", "full_name": "Juan Pérez"}'
```

### Asignar rol (solo admin)

```bash
# Roles disponibles: admin, agent, readonly
curl -X POST http://localhost:8000/api/v1/admin/users/<user_id>/roles \
  -H "Authorization: Bearer <jwt_admin>" \
  -H "Content-Type: application/json" \
  -d '{"role_name": "agent"}'
```

### Flujo completo de primer setup

```bash
# 1. Crear superuser directamente en DB (solo la primera vez)
#    INSERT INTO users (id, email, hashed_password, is_superuser)
#    VALUES (gen_random_uuid(), 'admin@example.com', '<bcrypt_hash>', true)
#
# 2. Login
TOKEN=$(curl -s -X POST .../auth/login -d '{"email":"admin@example.com","password":"..."}' | jq -r .access_token)
#
# 3. Crear agente
curl -X POST .../admin/users -H "Authorization: Bearer $TOKEN" -d '{"email":"agente@...","password":"..."}'
#
# 4. Asignar rol
curl -X POST .../admin/users/<id>/roles -H "Authorization: Bearer $TOKEN" -d '{"role_name":"agent"}'
```

> **Roles del sistema:** `admin` (acceso total), `agent` (gestiona conversaciones), `readonly` (solo lectura).  
> Los `superuser` tienen acceso irrestricto sin importar sus roles asignados.

---

## Notas de producción

- Cambiar `ENVIRONMENT=production` para deshabilitar Swagger UI y reducir logging.
- Restringir `allow_origins` en CORS al dominio del frontend.
- Usar secrets manager (AWS Secrets Manager, Vault, etc.) en lugar de `.env` para credenciales.
- Escalar Redis con autenticación habilitada (`requirepass`).
