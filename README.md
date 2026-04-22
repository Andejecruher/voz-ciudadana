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

| Método | Ruta              | Descripción                    |
| ------ | ----------------- | ------------------------------ |
| GET    | `/api/v1/health`  | Estado de la API               |
| GET    | `/api/v1/webhook` | Verificación del webhook Meta  |
| POST   | `/api/v1/webhook` | Recepción de mensajes WhatsApp |

---

## Notas de producción

- Cambiar `ENVIRONMENT=production` para deshabilitar Swagger UI y reducir logging.
- Restringir `allow_origins` en CORS al dominio del frontend.
- Usar secrets manager (AWS Secrets Manager, Vault, etc.) en lugar de `.env` para credenciales.
- Escalar Redis con autenticación habilitada (`requirepass`).
