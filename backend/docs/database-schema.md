# Database Schema — Voz Ciudadana

Base de datos: **PostgreSQL**  
ORM: **Prisma**  
Total de tablas: **18**

---

## Índice

1. [Autenticación y usuarios](#autenticación-y-usuarios)
   - [users](#users)
   - [roles](#roles)
   - [user_roles](#user_roles)
2. [Ciudadanos y territorios](#ciudadanos-y-territorios)
   - [citizens](#citizens)
   - [neighborhoods](#neighborhoods)
3. [Conversaciones y mensajes](#conversaciones-y-mensajes)
   - [conversations](#conversations)
   - [conversation_meta](#conversation_meta)
   - [messages](#messages)
   - [message_statuses](#message_statuses)
   - [attachments](#attachments)
4. [Tags y etiquetado](#tags-y-etiquetado)
   - [tags](#tags)
   - [citizen_tags](#citizen_tags)
5. [Enrutamiento y agentes](#enrutamiento-y-agentes)
   - [departments](#departments)
   - [assignments](#assignments)
6. [Eventos y auditoría](#eventos-y-auditoría)
   - [inbox_events](#inbox_events)
   - [outbox_events](#outbox_events)
   - [webhook_event_logs](#webhook_event_logs)
   - [audit_logs](#audit_logs)
7. [Enums](#enums)

---

## Autenticación y usuarios

### `users`

Usuarios administrativos del sistema (agentes, supervisores, superusuarios).

| Columna           | Tipo             | Nullable | Default  | Descripción                           |
| ----------------- | ---------------- | -------- | -------- | ------------------------------------- |
| `id`              | `UUID`           | No       | `uuid()` | Clave primaria                        |
| `email`           | `VARCHAR(255)`   | No       | —        | Email único del usuario               |
| `hashed_password` | `VARCHAR(255)`   | No       | —        | Contraseña hasheada                   |
| `full_name`       | `VARCHAR(255)`   | Sí       | —        | Nombre completo                       |
| `is_active`       | `BOOLEAN`        | No       | `true`   | Indica si el usuario está habilitado  |
| `is_superuser`    | `BOOLEAN`        | No       | `false`  | Acceso total sin restricciones de rol |
| `created_at`      | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación                     |
| `updated_at`      | `TIMESTAMPTZ(6)` | No       | `now()`  | Última actualización                  |

**Índices:** `email`

**Relaciones:**

- `user_roles` → 1:N
- `audit_logs` → 1:N (actor)
- `conversations` → 1:N (assigned_user)
- `citizen_tags` → 1:N (assigned_by)
- `attachments` → 1:N (uploaded_by)
- `assignments` → 1:N

---

### `roles`

Roles del sistema para control de acceso (RBAC).

| Columna       | Tipo             | Nullable | Default  | Descripción          |
| ------------- | ---------------- | -------- | -------- | -------------------- |
| `id`          | `UUID`           | No       | `uuid()` | Clave primaria       |
| `name`        | `VARCHAR(50)`    | No       | —        | Nombre único del rol |
| `description` | `VARCHAR(255)`   | Sí       | —        | Descripción del rol  |
| `created_at`  | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación    |

**Índices:** `name`

**Relaciones:**

- `user_roles` → 1:N

---

### `user_roles`

Tabla de unión N:M entre `users` y `roles`.

| Columna       | Tipo             | Nullable | Default  | Descripción         |
| ------------- | ---------------- | -------- | -------- | ------------------- |
| `id`          | `UUID`           | No       | `uuid()` | Clave primaria      |
| `user_id`     | `UUID`           | No       | —        | FK → `users.id`     |
| `role_id`     | `UUID`           | No       | —        | FK → `roles.id`     |
| `assigned_at` | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de asignación |

**Unique:** `(user_id, role_id)`  
**Índices:** `user_id`, `role_id`  
**On delete:** CASCADE en ambas FK

---

## Ciudadanos y territorios

### `citizens`

Ciudadanos que interactúan con el sistema vía WhatsApp u otros canales.

| Columna           | Tipo             | Nullable | Default    | Descripción                              |
| ----------------- | ---------------- | -------- | ---------- | ---------------------------------------- |
| `id`              | `UUID`           | No       | `uuid()`   | Clave primaria                           |
| `phone`           | `VARCHAR(30)`    | No       | —          | Teléfono único (identificador principal) |
| `name`            | `VARCHAR(255)`   | Sí       | —          | Nombre                                   |
| `last_name`       | `VARCHAR(255)`   | Sí       | —          | Apellido                                 |
| `email`           | `VARCHAR(255)`   | Sí       | —          | Email opcional                           |
| `source_channel`  | `source_channel` | No       | `whatsapp` | Canal de origen del ciudadano            |
| `lead_status`     | `lead_status`    | No       | `new`      | Estado del lead en el CRM                |
| `consent_given`   | `BOOLEAN`        | No       | `false`    | Consentimiento de datos otorgado         |
| `consent_at`      | `TIMESTAMPTZ(6)` | Sí       | —          | Fecha en que se otorgó el consentimiento |
| `neighborhood`    | `VARCHAR(255)`   | Sí       | —          | Barrio (texto libre, legacy)             |
| `neighborhood_id` | `UUID`           | Sí       | —          | FK → `neighborhoods.id`                  |
| `interests`       | `TEXT[]`         | No       | `[]`       | Intereses o temas de interés             |
| `created_at`      | `TIMESTAMPTZ(6)` | No       | `now()`    | Fecha de creación                        |
| `updated_at`      | `TIMESTAMPTZ(6)` | No       | `now()`    | Última actualización                     |

**Índices:** `phone`, `email`  
**On delete:** `neighborhood_id` → SET NULL

**Relaciones:**

- `conversations` → 1:N
- `citizen_tags` → 1:N
- `attachments` → 1:N

---

### `neighborhoods`

Barrios o zonas geográficas del municipio.

| Columna       | Tipo             | Nullable | Default  | Descripción                                      |
| ------------- | ---------------- | -------- | -------- | ------------------------------------------------ |
| `id`          | `UUID`           | No       | `uuid()` | Clave primaria                                   |
| `name`        | `VARCHAR(255)`   | No       | —        | Nombre único del barrio                          |
| `name_lower`  | `VARCHAR(255)`   | No       | —        | Nombre en minúsculas (búsqueda case-insensitive) |
| `description` | `TEXT`           | Sí       | —        | Descripción del barrio                           |
| `zone`        | `VARCHAR(100)`   | Sí       | —        | Zona o sector al que pertenece                   |
| `created_at`  | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación                                |
| `updated_at`  | `TIMESTAMPTZ(6)` | No       | `now()`  | Última actualización                             |

**Índices:** `name`, `name_lower`, `zone`

**Relaciones:**

- `citizens` → 1:N

---

## Conversaciones y mensajes

### `conversations`

Hilo principal de conversación entre el sistema y un ciudadano.

| Columna            | Tipo                   | Nullable | Default    | Descripción                       |
| ------------------ | ---------------------- | -------- | ---------- | --------------------------------- |
| `id`               | `UUID`                 | No       | `uuid()`   | Clave primaria                    |
| `citizen_id`       | `UUID`                 | No       | —          | FK → `citizens.id`                |
| `status`           | `conversation_status`  | No       | `open`     | Estado de la conversación         |
| `channel`          | `conversation_channel` | No       | `whatsapp` | Canal de comunicación             |
| `assigned_dept`    | `VARCHAR(100)`         | Sí       | —          | Departamento asignado (texto)     |
| `assigned_user_id` | `UUID`                 | Sí       | —          | FK → `users.id` (agente asignado) |
| `created_at`       | `TIMESTAMPTZ(6)`       | No       | `now()`    | Fecha de creación                 |
| `updated_at`       | `TIMESTAMPTZ(6)`       | No       | `now()`    | Última actualización              |

**Índices:** `assigned_user_id`, `(citizen_id, status)`  
**On delete:** `citizen_id` → CASCADE, `assigned_user_id` → SET NULL

**Relaciones:**

- `messages` → 1:N
- `assignments` → 1:N
- `conversation_meta` → 1:1

---

### `conversation_meta`

Extiende `conversations` con el estado de la máquina de estados del orquestador (FSM). Diseñada como tabla separada para no romper el modelo base.

| Columna             | Tipo                      | Nullable | Default    | Descripción                            |
| ------------------- | ------------------------- | -------- | ---------- | -------------------------------------- |
| `id`                | `UUID`                    | No       | `uuid()`   | Clave primaria                         |
| `conversation_id`   | `UUID`                    | No       | —          | FK única → `conversations.id`          |
| `flow_state`        | `conversation_flow_state` | No       | `BOT_FLOW` | Estado actual de la FSM                |
| `locked_by_user_id` | `UUID`                    | Sí       | —          | Usuario que tomó el control manual     |
| `locked_at`         | `TIMESTAMPTZ(6)`          | Sí       | —          | Timestamp del lock                     |
| `version`           | `INT`                     | No       | `0`        | Versión para optimistic locking        |
| `department_slug`   | `VARCHAR(100)`            | Sí       | —          | Slug del departamento al que se enrutó |
| `handover_at`       | `TIMESTAMPTZ(6)`          | Sí       | —          | Timestamp del handover a humano        |
| `created_at`        | `TIMESTAMPTZ(6)`          | No       | `now()`    | Fecha de creación                      |
| `updated_at`        | `TIMESTAMPTZ(6)`          | No       | `now()`    | Última actualización                   |

**Índices:** `flow_state`, `locked_by_user_id`  
**On delete:** `conversation_id` → CASCADE

---

### `messages`

Mensajes individuales dentro de una conversación.

| Columna               | Tipo                | Nullable | Default  | Descripción                       |
| --------------------- | ------------------- | -------- | -------- | --------------------------------- |
| `id`                  | `UUID`              | No       | `uuid()` | Clave primaria                    |
| `conversation_id`     | `UUID`              | No       | —        | FK → `conversations.id`           |
| `body`                | `TEXT`              | No       | —        | Contenido del mensaje             |
| `direction`           | `message_direction` | No       | —        | `inbound` o `outbound`            |
| `message_type`        | `message_type`      | No       | `text`   | Tipo de mensaje                   |
| `external_message_id` | `VARCHAR(255)`      | Sí       | —        | ID del mensaje en Meta (WAMID)    |
| `attachment_id`       | `UUID`              | Sí       | —        | FK → `attachments.id`             |
| `meta`                | `JSONB`             | No       | `{}`     | Metadatos adicionales del mensaje |
| `created_at`          | `TIMESTAMPTZ(6)`    | No       | `now()`  | Fecha de creación                 |

**Índices:** `external_message_id`  
**On delete:** `conversation_id` → CASCADE, `attachment_id` → SET NULL

**Relaciones:**

- `attachments` → 1:N (mensajes que tienen adjunto vía `message_id`)
- `message_statuses` → 1:N

---

### `message_statuses`

Registro de estados de entrega de mensajes outbound (sent, delivered, read, failed).

| Columna       | Tipo                   | Nullable | Default  | Descripción                    |
| ------------- | ---------------------- | -------- | -------- | ------------------------------ |
| `id`          | `UUID`                 | No       | `uuid()` | Clave primaria                 |
| `message_id`  | `UUID`                 | No       | —        | FK → `messages.id`             |
| `wamid`       | `VARCHAR(255)`         | No       | —        | WAMID retornado por Meta       |
| `status`      | `message_status_value` | No       | —        | Estado de entrega              |
| `error_code`  | `INT`                  | Sí       | —        | Código de error (si aplica)    |
| `error_title` | `VARCHAR(255)`         | Sí       | —        | Descripción del error          |
| `timestamp`   | `TIMESTAMPTZ`          | No       | —        | Timestamp del evento de estado |
| `created_at`  | `TIMESTAMPTZ(6)`       | No       | `now()`  | Fecha de creación              |

**Índices:** `wamid`, `message_id`  
**On delete:** `message_id` → CASCADE

---

### `attachments`

Archivos adjuntos asociados a mensajes o ciudadanos (imágenes, documentos, audio, video).

| Columna             | Tipo             | Nullable | Default  | Descripción                  |
| ------------------- | ---------------- | -------- | -------- | ---------------------------- |
| `id`                | `UUID`           | No       | `uuid()` | Clave primaria               |
| `storage_key`       | `VARCHAR(1024)`  | No       | —        | Clave en el storage (S3/GCS) |
| `mime_type`         | `VARCHAR(127)`   | No       | —        | Tipo MIME del archivo        |
| `file_size_bytes`   | `BIGINT`         | No       | —        | Tamaño en bytes              |
| `original_filename` | `VARCHAR(512)`   | Sí       | —        | Nombre original del archivo  |
| `cdn_url`           | `TEXT`           | Sí       | —        | URL pública en CDN           |
| `message_id`        | `UUID`           | Sí       | —        | FK → `messages.id`           |
| `citizen_id`        | `UUID`           | Sí       | —        | FK → `citizens.id`           |
| `uploaded_by`       | `UUID`           | Sí       | —        | FK → `users.id`              |
| `created_at`        | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación            |

**Índices:** `message_id`, `citizen_id`  
**On delete:** todas las FK → SET NULL

---

## Tags y etiquetado

### `tags`

Etiquetas del sistema para clasificar ciudadanos.

| Columna       | Tipo             | Nullable | Default  | Descripción                   |
| ------------- | ---------------- | -------- | -------- | ----------------------------- |
| `id`          | `UUID`           | No       | `uuid()` | Clave primaria                |
| `name`        | `VARCHAR(100)`   | No       | —        | Nombre único del tag          |
| `description` | `TEXT`           | Sí       | —        | Descripción del tag           |
| `color`       | `VARCHAR(20)`    | Sí       | —        | Color HEX o nombre para la UI |
| `created_at`  | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación             |

**Índices:** `name`

**Relaciones:**

- `citizen_tags` → 1:N

---

### `citizen_tags`

Tabla de unión N:M entre `citizens` y `tags`.

| Columna          | Tipo             | Nullable | Default  | Descripción                    |
| ---------------- | ---------------- | -------- | -------- | ------------------------------ |
| `id`             | `UUID`           | No       | `uuid()` | Clave primaria                 |
| `citizen_id`     | `UUID`           | No       | —        | FK → `citizens.id`             |
| `tag_id`         | `UUID`           | No       | —        | FK → `tags.id`                 |
| `assigned_by_id` | `UUID`           | Sí       | —        | FK → `users.id` (quién asignó) |
| `assigned_at`    | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de asignación            |

**Unique:** `(citizen_id, tag_id)`  
**Índices:** `citizen_id`, `tag_id`  
**On delete:** `citizen_id` → CASCADE, `tag_id` → CASCADE, `assigned_by_id` → SET NULL

---

## Enrutamiento y agentes

### `departments`

Departamentos disponibles para el enrutamiento de conversaciones a equipos humanos.

| Columna       | Tipo             | Nullable | Default  | Descripción                            |
| ------------- | ---------------- | -------- | -------- | -------------------------------------- |
| `id`          | `UUID`           | No       | `uuid()` | Clave primaria                         |
| `slug`        | `VARCHAR(100)`   | No       | —        | Identificador único URL-friendly       |
| `name`        | `VARCHAR(255)`   | No       | —        | Nombre del departamento                |
| `description` | `TEXT`           | Sí       | —        | Descripción del departamento           |
| `is_active`   | `BOOLEAN`        | No       | `true`   | Indica si está habilitado para routing |
| `keywords`    | `TEXT[]`         | No       | `[]`     | Palabras clave para routing automático |
| `created_at`  | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación                      |
| `updated_at`  | `TIMESTAMPTZ(6)` | No       | `now()`  | Última actualización                   |

**Índices:** `slug`, `is_active`

---

### `assignments`

Historial de asignaciones de conversaciones a agentes humanos. Soporta múltiples asignaciones por conversación (trazabilidad completa).

| Columna           | Tipo             | Nullable | Default  | Descripción                                   |
| ----------------- | ---------------- | -------- | -------- | --------------------------------------------- |
| `id`              | `UUID`           | No       | `uuid()` | Clave primaria                                |
| `conversation_id` | `UUID`           | No       | —        | FK → `conversations.id`                       |
| `user_id`         | `UUID`           | No       | —        | FK → `users.id` (agente asignado)             |
| `department_slug` | `VARCHAR(100)`   | Sí       | —        | Slug del departamento relacionado             |
| `assigned_at`     | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de asignación                           |
| `released_at`     | `TIMESTAMPTZ(6)` | Sí       | —        | Fecha en que el agente liberó la conversación |
| `is_active`       | `BOOLEAN`        | No       | `true`   | Indica si la asignación está vigente          |

**Índices:** `conversation_id`, `user_id`, `is_active`  
**On delete:** ambas FK → CASCADE

---

## Eventos y auditoría

### `inbox_events`

Cola de eventos entrantes del webhook de Meta. Actúa como buffer persistente para procesamiento asíncrono y deduplicación por WAMID.

| Columna           | Tipo                 | Nullable | Default   | Descripción                                           |
| ----------------- | -------------------- | -------- | --------- | ----------------------------------------------------- |
| `id`              | `UUID`               | No       | `uuid()`  | Clave primaria                                        |
| `wamid`           | `VARCHAR(255)`       | No       | —         | ID único del mensaje en Meta (clave de deduplicación) |
| `phone`           | `VARCHAR(30)`        | No       | —         | Teléfono del remitente                                |
| `payload`         | `JSONB`              | No       | —         | Payload completo del webhook                          |
| `status`          | `inbox_event_status` | No       | `pending` | Estado de procesamiento                               |
| `retry_count`     | `INT`                | No       | `0`       | Número de reintentos realizados                       |
| `last_error_at`   | `TIMESTAMPTZ(6)`     | Sí       | —         | Timestamp del último error                            |
| `last_error`      | `TEXT`               | Sí       | —         | Descripción del último error                          |
| `idempotency_key` | `VARCHAR(255)`       | Sí       | —         | Clave de idempotencia adicional                       |
| `created_at`      | `TIMESTAMPTZ(6)`     | No       | `now()`   | Fecha de creación                                     |
| `processed_at`    | `TIMESTAMPTZ(6)`     | Sí       | —         | Fecha en que fue procesado exitosamente               |

**Unique:** `wamid`  
**Índices:** `phone`, `status`, `created_at`

---

### `outbox_events`

Cola outbox para garantizar la entrega de mensajes salientes a la Meta API (outbox pattern). Soporta reintentos con backoff.

| Columna           | Tipo                  | Nullable | Default   | Descripción                        |
| ----------------- | --------------------- | -------- | --------- | ---------------------------------- |
| `id`              | `UUID`                | No       | `uuid()`  | Clave primaria                     |
| `conversation_id` | `UUID`                | Sí       | —         | Conversación asociada (opcional)   |
| `phone`           | `VARCHAR(30)`         | No       | —         | Teléfono destino                   |
| `payload`         | `JSONB`               | No       | —         | Payload a enviar a Meta API        |
| `status`          | `outbox_event_status` | No       | `pending` | Estado de envío                    |
| `retry_count`     | `INT`                 | No       | `0`       | Número de reintentos               |
| `next_retry_at`   | `TIMESTAMPTZ(6)`      | Sí       | —         | Próximo intento programado         |
| `last_error`      | `TEXT`                | Sí       | —         | Descripción del último error       |
| `wamid`           | `VARCHAR(255)`        | Sí       | —         | WAMID retornado por Meta al enviar |
| `idempotency_key` | `VARCHAR(255)`        | No       | —         | Clave de idempotencia (única)      |
| `created_at`      | `TIMESTAMPTZ(6)`      | No       | `now()`   | Fecha de creación                  |
| `sent_at`         | `TIMESTAMPTZ(6)`      | Sí       | —         | Fecha de envío exitoso             |

**Unique:** `idempotency_key`  
**Índices:** `phone`, `(status, next_retry_at)`, `conversation_id`

---

### `webhook_event_logs`

Log inmutable de todos los webhooks recibidos de Meta. Usado para auditoría y replay ante fallos.

| Columna          | Tipo             | Nullable | Default  | Descripción                     |
| ---------------- | ---------------- | -------- | -------- | ------------------------------- |
| `id`             | `UUID`           | No       | `uuid()` | Clave primaria                  |
| `correlation_id` | `VARCHAR(255)`   | No       | —        | ID de correlación del request   |
| `raw_payload`    | `JSONB`          | No       | —        | Payload crudo recibido          |
| `signature`      | `VARCHAR(255)`   | Sí       | —        | Firma HMAC de Meta              |
| `processed_ok`   | `BOOLEAN`        | No       | `false`  | Si el procesamiento fue exitoso |
| `error_message`  | `TEXT`           | Sí       | —        | Error si el procesamiento falló |
| `ip_address`     | `VARCHAR(45)`    | Sí       | —        | IP de origen (IPv4 o IPv6)      |
| `created_at`     | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación               |

**Índices:** `correlation_id`, `created_at`

---

### `audit_logs`

Registro inmutable de acciones sensibles realizadas por usuarios admin. Diseño **append-only** — no se modifican ni eliminan registros.

| Columna       | Tipo             | Nullable | Default  | Descripción                              |
| ------------- | ---------------- | -------- | -------- | ---------------------------------------- |
| `id`          | `UUID`           | No       | `uuid()` | Clave primaria                           |
| `actor_id`    | `UUID`           | Sí       | —        | FK → `users.id` (null si fue el sistema) |
| `action`      | `VARCHAR(100)`   | No       | —        | Acción realizada (ej: `user.create`)     |
| `target_type` | `VARCHAR(50)`    | No       | —        | Tipo del recurso afectado (ej: `User`)   |
| `target_id`   | `VARCHAR(255)`   | Sí       | —        | ID del recurso afectado                  |
| `metadata`    | `JSONB`          | No       | `{}`     | Datos adicionales de la acción           |
| `ip`          | `VARCHAR(45)`    | Sí       | —        | IP del actor (IPv4 o IPv6)               |
| `user_agent`  | `VARCHAR(512)`   | Sí       | —        | User-Agent del request                   |
| `created_at`  | `TIMESTAMPTZ(6)` | No       | `now()`  | Fecha de creación                        |

**Índices:** `actor_id`, `action`, `(target_type, target_id)`, `created_at`  
**On delete:** `actor_id` → SET NULL

---

## Enums

| Enum (DB)                 | Valores                                                                                        | Usado en                       |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------ |
| `source_channel`          | `whatsapp`, `web`, `event`, `referral`, `other`                                                | `citizens.source_channel`      |
| `lead_status`             | `new`, `contacted`, `engaged`, `converted`, `unsubscribed`                                     | `citizens.lead_status`         |
| `conversation_status`     | `open`, `in_progress`, `resolved`, `closed`                                                    | `conversations.status`         |
| `conversation_channel`    | `whatsapp`, `web_chat`, `email`, `sms`, `other`                                                | `conversations.channel`        |
| `conversation_flow_state` | `BOT_FLOW`, `REGISTERING`, `DEPARTMENT_ROUTING`, `HUMAN_FLOW`, `ESCALATED`, `CLOSED`           | `conversation_meta.flow_state` |
| `message_direction`       | `inbound`, `outbound`                                                                          | `messages.direction`           |
| `message_type`            | `text`, `image`, `audio`, `video`, `document`, `location`, `template`, `interactive`, `system` | `messages.message_type`        |
| `message_status_value`    | `sent`, `delivered`, `read`, `failed`                                                          | `message_statuses.status`      |
| `inbox_event_status`      | `pending`, `processing`, `processed`, `failed`, `dead_lettered`                                | `inbox_events.status`          |
| `outbox_event_status`     | `pending`, `sending`, `sent`, `failed`, `dead_lettered`                                        | `outbox_events.status`         |
