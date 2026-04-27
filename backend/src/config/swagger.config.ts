/**
 * Especificación OpenAPI 3.0 del backend Voz Ciudadana.
 *
 * DECISIÓN DE DISEÑO: spec programática pura (sin swagger-jsdoc).
 *
 * Motivo: swagger-jsdoc parsea comentarios JSDoc en runtime buscando archivos
 * mediante globs. En producción (Docker/dist/) los archivos compilados no
 * incluyen la carpeta `docs/` (no es importada por ningún módulo), por lo que
 * swagger-jsdoc nunca la encuentra y devuelve 0 paths.
 *
 * Al definir la spec como objeto TypeScript plano:
 *  - No hay globs, no hay resolución de rutas en runtime.
 *  - El compilador verifica la coherencia del objeto.
 *  - La spec es idéntica en dev, prod y Docker sin configuración adicional.
 *  - swagger-jsdoc ya no es necesaria como dependencia.
 */

// Tipos mínimos de OpenAPI 3.0 definidos localmente para no depender de openapi-types.
// Suficiente para tipar la spec completa con seguridad en TypeScript.
type SchemaObject = Record<string, unknown>;
type ResponseObject = Record<string, unknown>;
type SecuritySchemeObject = Record<string, unknown>;
type PathsObject = Record<string, unknown>;
type OpenAPIDocument = {
  openapi: string;
  info: Record<string, unknown>;
  servers?: Array<{ url: string; description?: string }>;
  tags?: Array<{ name: string; description?: string }>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    responses?: Record<string, ResponseObject>;
    securitySchemes?: Record<string, SecuritySchemeObject>;
  };
  paths: PathsObject;
};

export type SwaggerSpecParams = {
  port: number;
};

// ─── Schemas reutilizables ────────────────────────────────────────────────────

const schemas: Record<string, SchemaObject> = {
  ErrorResponse: {
    type: 'object',
    required: ['error'],
    properties: {
      error: {
        type: 'string',
        description: 'Mensaje de error legible',
        example: 'Credenciales inválidas',
      },
      code: {
        type: 'string',
        description: 'Código de error de la aplicación',
        example: 'UNAUTHORIZED',
      },
    },
  },
  ValidationErrorResponse: {
    type: 'object',
    required: ['error', 'details'],
    properties: {
      error: { type: 'string', example: 'Datos inválidos' },
      details: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            path: { type: 'array', items: { type: 'string' } },
            message: { type: 'string' },
          },
        },
      },
    },
  },
  RateLimitErrorResponse: {
    type: 'object',
    required: ['error', 'code'],
    properties: {
      error: {
        type: 'string',
        example: 'Demasiados intentos de inicio de sesión. Intentá nuevamente en 15 minutos.',
      },
      code: { type: 'string', enum: ['RATE_LIMITED', 'ACCOUNT_LOCKED'], example: 'RATE_LIMITED' },
    },
  },
  AuthTokenPair: {
    type: 'object',
    required: ['accessToken', 'refreshToken'],
    properties: {
      accessToken: {
        type: 'string',
        description: 'JWT de acceso de corta duración (default 15min)',
      },
      refreshToken: {
        type: 'string',
        description: 'JWT de refresco de larga duración (default 7d), single-use con rotación',
      },
    },
  },
  PanelRole: {
    type: 'string',
    enum: ['SUPERADMIN', 'COORDINADOR', 'OPERADOR_CHAT', 'ANALISTA'],
    description: 'Rol del usuario en el panel administrativo',
    example: 'SUPERADMIN',
  },
  User: {
    type: 'object',
    required: ['id', 'email', 'roles'],
    properties: {
      id: { type: 'string', format: 'uuid', example: '550e8400-e29b-41d4-a716-446655440000' },
      email: { type: 'string', format: 'email', example: 'admin@vozciudadana.gob' },
      fullName: { type: 'string', nullable: true, example: 'Ana García' },
      roles: { type: 'array', items: { $ref: '#/components/schemas/PanelRole' } },
      isActive: { type: 'boolean', description: 'Presente en respuestas de admin', example: true },
      createdAt: {
        type: 'string',
        format: 'date-time',
        description: 'Presente en respuestas de admin',
        example: '2024-01-15T10:30:00.000Z',
      },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'admin@vozciudadana.gob' },
      password: { type: 'string', minLength: 1, example: 'MiPassword123!' },
      deviceId: {
        type: 'string',
        description: 'Identificador estable del dispositivo',
        example: 'browser-chrome-desktop-uuid',
      },
    },
  },
  RefreshRequest: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string', example: 'eyJhbGciOiJIUzI1NiJ9...' },
      deviceId: { type: 'string', example: 'browser-chrome-desktop-uuid' },
    },
  },
  LogoutRequest: {
    type: 'object',
    properties: {
      refreshToken: { type: 'string', description: 'Refresh token a invalidar' },
      logoutAll: {
        type: 'boolean',
        description: 'Invalida TODAS las sesiones del usuario',
        example: false,
      },
    },
  },
  RegisterAdminRequest: {
    type: 'object',
    required: ['email', 'password', 'fullName', 'roles'],
    properties: {
      email: { type: 'string', format: 'email', example: 'nuevo.admin@vozciudadana.gob' },
      password: { type: 'string', minLength: 8, example: 'PasswordSeguro123!' },
      fullName: { type: 'string', minLength: 2, example: 'Carlos Rodríguez' },
      roles: {
        type: 'array',
        minItems: 1,
        items: { $ref: '#/components/schemas/PanelRole' },
        example: ['COORDINADOR'],
      },
    },
  },
  CreateUserRequest: {
    type: 'object',
    required: ['email', 'password', 'fullName'],
    properties: {
      email: { type: 'string', format: 'email', example: 'operador@vozciudadana.gob' },
      password: { type: 'string', minLength: 8, example: 'PasswordSeguro123!' },
      fullName: { type: 'string', minLength: 2, example: 'María López' },
      isActive: { type: 'boolean', example: true },
      roleIds: {
        type: 'array',
        items: { type: 'string', format: 'uuid' },
        description: 'IDs de roles a asignar al crear el usuario (opcional)',
      },
    },
  },
  UpdateUserRequest: {
    type: 'object',
    properties: {
      fullName: { type: 'string', minLength: 2, example: 'María López Actualizado' },
      password: { type: 'string', minLength: 8, example: 'PasswordNuevo123!' },
      isActive: { type: 'boolean', example: true },
    },
  },
  CursorPaginationMeta: {
    type: 'object',
    required: ['hasNextPage', 'count'],
    properties: {
      nextCursor: {
        type: 'string',
        format: 'uuid',
        nullable: true,
        description: 'Cursor para solicitar la siguiente página',
      },
      hasNextPage: {
        type: 'boolean',
        example: true,
      },
      count: {
        type: 'integer',
        minimum: 0,
        example: 20,
      },
    },
  },
  NeighborhoodCatalog: {
    type: 'object',
    required: ['id', 'name', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'Centro' },
      description: { type: 'string', nullable: true, example: 'Zona céntrica de la ciudad' },
      zone: { type: 'string', nullable: true, example: 'Norte' },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateNeighborhoodRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 255, example: 'Centro' },
      description: { type: 'string', nullable: true, example: 'Zona céntrica de la ciudad' },
      zone: { type: 'string', nullable: true, example: 'Norte' },
    },
  },
  UpdateNeighborhoodRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 255, example: 'Centro Histórico' },
      description: { type: 'string', nullable: true, example: 'Descripción actualizada' },
      zone: { type: 'string', nullable: true, example: 'Centro' },
    },
  },
  TagCatalog: {
    type: 'object',
    required: ['id', 'name', 'createdAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      name: { type: 'string', example: 'infraestructura' },
      description: { type: 'string', nullable: true, example: 'Temas de obras públicas' },
      color: { type: 'string', nullable: true, example: '#0EA5E9' },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateTagRequest: {
    type: 'object',
    required: ['name'],
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100, example: 'infraestructura' },
      description: { type: 'string', nullable: true, example: 'Temas de obras públicas' },
      color: { type: 'string', nullable: true, example: '#0EA5E9' },
    },
  },
  UpdateTagRequest: {
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 2, maxLength: 100, example: 'infraestructura-local' },
      description: { type: 'string', nullable: true, example: 'Descripción actualizada' },
      color: { type: 'string', nullable: true, example: '#F97316' },
    },
  },
  DepartmentCatalog: {
    type: 'object',
    required: ['id', 'slug', 'name', 'isActive', 'keywords', 'createdAt', 'updatedAt'],
    properties: {
      id: { type: 'string', format: 'uuid' },
      slug: { type: 'string', example: 'general' },
      name: { type: 'string', example: 'Atención General' },
      description: { type: 'string', nullable: true, example: 'Canal de atención general' },
      isActive: { type: 'boolean', example: true },
      keywords: { type: 'array', items: { type: 'string' }, example: ['general', 'ayuda'] },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  CreateDepartmentRequest: {
    type: 'object',
    required: ['slug', 'name'],
    properties: {
      slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', example: 'obras-publicas' },
      name: { type: 'string', minLength: 2, maxLength: 255, example: 'Obras Públicas' },
      description: { type: 'string', nullable: true, example: 'Gestión de infraestructura urbana' },
      isActive: { type: 'boolean', example: true },
      keywords: { type: 'array', items: { type: 'string' }, example: ['bache', 'pavimento'] },
    },
  },
  UpdateDepartmentRequest: {
    type: 'object',
    properties: {
      slug: { type: 'string', pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$', example: 'obras' },
      name: { type: 'string', minLength: 2, maxLength: 255, example: 'Obras' },
      description: { type: 'string', nullable: true, example: 'Descripción actualizada' },
      isActive: { type: 'boolean', example: false },
      keywords: { type: 'array', items: { type: 'string' }, example: ['alumbrado', 'banqueta'] },
    },
  },
  ConversationFlowState: {
    type: 'string',
    enum: ['REGISTERING', 'DEPARTMENT_ROUTING', 'BOT_FLOW', 'HUMAN_FLOW', 'ESCALATED', 'CLOSED'],
    description: 'Estado del flujo de la conversación',
    example: 'BOT_FLOW',
  },
  SendTextRequest: {
    type: 'object',
    required: ['conversationId', 'text'],
    properties: {
      conversationId: {
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
      text: {
        type: 'string',
        minLength: 1,
        maxLength: 4096,
        example: 'Hola, ¿en qué te puedo ayudar?',
      },
    },
  },
  HandoverRequest: {
    type: 'object',
    required: ['conversationId'],
    properties: {
      conversationId: {
        type: 'string',
        format: 'uuid',
        example: '550e8400-e29b-41d4-a716-446655440000',
      },
    },
  },
  SystemConfig: {
    type: 'object',
    properties: {
      message: { type: 'string', example: 'Configuración del sistema (solo SUPERADMIN)' },
      features: {
        type: 'object',
        properties: {
          rbacEnabled: { type: 'boolean' },
          refreshTokenRotation: { type: 'boolean' },
          refreshTokenStorage: { type: 'string', example: 'redis' },
          multiSession: { type: 'boolean' },
          auditLog: { type: 'boolean' },
          rateLimiting: { type: 'boolean' },
          progressiveLockout: { type: 'boolean' },
        },
      },
    },
  },
};

// ─── Responses reutilizables ──────────────────────────────────────────────────

const responses: Record<string, ResponseObject> = {
  Unauthorized: {
    description: 'Token de acceso inválido, expirado o ausente',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
        example: { error: 'Unauthorized', code: 'UNAUTHORIZED' },
      },
    },
  },
  Forbidden: {
    description: 'El usuario no tiene el rol requerido para este recurso',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
        example: { error: 'Forbidden', code: 'FORBIDDEN' },
      },
    },
  },
  NotFound: {
    description: 'Recurso no encontrado',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
        example: { error: 'Usuario no encontrado', code: 'NOT_FOUND' },
      },
    },
  },
  RateLimited: {
    description: 'Rate limit excedido o cuenta bloqueada',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/RateLimitErrorResponse' },
      },
    },
  },
  InternalError: {
    description: 'Error interno del servidor',
    content: {
      'application/json': {
        schema: { $ref: '#/components/schemas/ErrorResponse' },
        example: { error: 'Internal server error' },
      },
    },
  },
};

// ─── Security schemes ─────────────────────────────────────────────────────────

const securitySchemes: Record<string, SecuritySchemeObject> = {
  bearerAuth: {
    type: 'http',
    scheme: 'bearer',
    bearerFormat: 'JWT',
    description:
      'JWT de acceso obtenido en POST /api/v1/auth/login. Formato: `Bearer <accessToken>`',
  },
  hubSignature: {
    type: 'apiKey',
    in: 'header',
    name: 'X-Hub-Signature-256',
    description: 'Firma HMAC-SHA256 generada por Meta sobre el raw body del webhook',
  },
};

// ─── Paths ────────────────────────────────────────────────────────────────────

const paths: PathsObject = {
  // ── Health ──────────────────────────────────────────────────────────────────
  '/health': {
    get: {
      tags: ['Health'],
      summary: 'Estado de la aplicación',
      description:
        'Endpoint de health check. Retorna el estado de la API y el timestamp actual. No requiere autenticación.',
      responses: {
        200: {
          description: 'Aplicación funcionando correctamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status', 'ts'],
                properties: {
                  status: { type: 'string', enum: ['ok'], example: 'ok' },
                  ts: { type: 'string', format: 'date-time', example: '2024-01-15T10:30:00.000Z' },
                },
              },
              example: { status: 'ok', ts: '2024-01-15T10:30:00.000Z' },
            },
          },
        },
      },
    },
  },

  // ── Auth ────────────────────────────────────────────────────────────────────
  '/api/v1/auth/login': {
    post: {
      tags: ['Auth'],
      summary: 'Iniciar sesión',
      description: [
        'Autentica al usuario admin con email y contraseña.',
        'Retorna un par de tokens JWT (access + refresh) y el perfil del usuario.',
        '',
        '**Rate limiting**: 10 intentos / 15 min por IP.',
        '**Lockout progresivo**: Tras 5 fallos consecutivos: 60s → 5min → 15min → 1h.',
        '**Device binding**: Enviar `x-device-id` o `body.deviceId` para multi-sesión real.',
      ].join('\n'),
      parameters: [
        {
          in: 'header',
          name: 'x-device-id',
          schema: { type: 'string' },
          description:
            'Identificador estable del dispositivo. Si se omite, se genera UUID aleatorio.',
          example: 'browser-chrome-desktop-uuid',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/LoginRequest' },
            examples: {
              withDevice: {
                summary: 'Login con device-id en body',
                value: {
                  email: 'admin@vozciudadana.gob',
                  password: 'MiPassword123!',
                  deviceId: 'browser-chrome-desktop-uuid',
                },
              },
              minimal: {
                summary: 'Login mínimo (sesión anónima)',
                value: { email: 'admin@vozciudadana.gob', password: 'MiPassword123!' },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Login exitoso — par de tokens + perfil del usuario',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['accessToken', 'refreshToken', 'user'],
                properties: {
                  accessToken: { type: 'string', description: 'JWT de acceso (15min por defecto)' },
                  refreshToken: { type: 'string', description: 'JWT de refresco (7d, single-use)' },
                  user: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
        400: {
          description: 'Datos de entrada inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: {
          description: 'Credenciales inválidas o usuario inactivo',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/auth/refresh': {
    post: {
      tags: ['Auth'],
      summary: 'Renovar access token',
      description: [
        'Rota el refresh token: invalida el anterior y emite un nuevo par.',
        'El refresh token es **single-use** — reutilizarlo activa detección de replay attack.',
        '',
        '**Rate limiting**: 60 intentos / 5 min por IP.',
      ].join('\n'),
      parameters: [
        {
          in: 'header',
          name: 'x-device-id',
          schema: { type: 'string' },
          description: 'ID del dispositivo (para detección de anomalías)',
          example: 'browser-chrome-desktop-uuid',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RefreshRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Tokens renovados exitosamente',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/AuthTokenPair' } },
          },
        },
        400: {
          description: 'refreshToken ausente',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        401: {
          description: 'Token inválido, expirado, sesión expirada o replay detectado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
              examples: {
                expired: {
                  value: { error: 'Refresh token inválido o expirado', code: 'UNAUTHORIZED' },
                },
                replay: { value: { error: 'Refresh token ya utilizado', code: 'UNAUTHORIZED' } },
              },
            },
          },
        },
        429: { $ref: '#/components/responses/RateLimited' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/auth/me': {
    get: {
      tags: ['Auth'],
      summary: 'Perfil del usuario autenticado',
      description:
        'Retorna el perfil del usuario asociado al access token. Consulta DB para datos actualizados.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Perfil del usuario autenticado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user'],
                properties: { user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/auth/logout': {
    post: {
      tags: ['Auth'],
      summary: 'Cerrar sesión',
      description: [
        'Invalida la sesión actual o todas las sesiones del usuario.',
        '',
        '- **Sin `logoutAll`**: invalida solo la sesión del `refreshToken` provisto.',
        '- **Con `logoutAll: true`**: invalida TODAS las sesiones (todos los dispositivos).',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: false,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/LogoutRequest' },
            examples: {
              single: { summary: 'Cerrar sesión actual', value: { refreshToken: 'eyJhbGci...' } },
              all: { summary: 'Cerrar todas las sesiones', value: { logoutAll: true } },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Sesión(es) cerrada(s) exitosamente',
          content: {
            'application/json': {
              schema: { type: 'object', properties: { message: { type: 'string' } } },
              examples: {
                single: { value: { message: 'Sesión cerrada correctamente' } },
                all: { value: { message: 'Todas las sesiones cerradas correctamente' } },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/auth/register': {
    post: {
      tags: ['Auth'],
      summary: 'Registrar nuevo administrador (solo SUPERADMIN)',
      description:
        'Crea un nuevo usuario del panel administrativo. Requiere rol **SUPERADMIN**. Queda registrado en audit log.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/RegisterAdminRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Usuario creado exitosamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user'],
                properties: { user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        400: {
          description: 'Datos inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        409: {
          description: 'El email ya está registrado',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  // ── Admin ───────────────────────────────────────────────────────────────────
  '/api/v1/admin/users': {
    get: {
      tags: ['Admin'],
      summary: 'Listar usuarios del panel',
      description:
        'Retorna todos los usuarios del panel administrativo con sus roles. Solo **SUPERADMIN**.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Lista de usuarios',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['users'],
                properties: {
                  users: { type: 'array', items: { $ref: '#/components/schemas/User' } },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    post: {
      tags: ['Admin'],
      summary: 'Crear usuario del panel',
      description:
        'Crea un nuevo usuario del panel administrativo. Solo **SUPERADMIN**. Queda en audit log.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateUserRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Usuario creado exitosamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user'],
                properties: { user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        400: {
          description: 'Datos inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        409: {
          description: 'Email ya registrado',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/users/{id}': {
    get: {
      tags: ['Admin'],
      summary: 'Obtener usuario del panel por ID',
      description: 'Retorna un usuario con sus roles. Acceso para SUPERADMIN y COORDINADOR.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del usuario',
          example: '660e8400-e29b-41d4-a716-446655440001',
        },
      ],
      responses: {
        200: {
          description: 'Usuario encontrado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user'],
                properties: { user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    patch: {
      tags: ['Admin'],
      summary: 'Actualizar usuario del panel',
      description:
        'Actualiza `fullName`, `password` o `isActive`. Al menos un campo requerido. Solo **SUPERADMIN**.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del usuario a actualizar',
          example: '660e8400-e29b-41d4-a716-446655440001',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateUserRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Usuario actualizado exitosamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user'],
                properties: { user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        400: {
          description: 'Datos inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/users/{id}/roles/{roleId}': {
    post: {
      tags: ['Admin'],
      summary: 'Asignar rol a usuario',
      description: 'Asigna un rol a un usuario. Solo **SUPERADMIN**.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del usuario',
        },
        {
          in: 'path',
          name: 'roleId',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del rol',
        },
      ],
      responses: {
        200: {
          description: 'Rol asignado correctamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user'],
                properties: { user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: {
          description: 'Rol ya asignado al usuario',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Remover rol de usuario',
      description: 'Remueve un rol previamente asignado a un usuario. Solo **SUPERADMIN**.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del usuario',
        },
        {
          in: 'path',
          name: 'roleId',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del rol',
        },
      ],
      responses: {
        200: {
          description: 'Rol removido correctamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['user'],
                properties: { user: { $ref: '#/components/schemas/User' } },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/config': {
    get: {
      tags: ['Admin'],
      summary: 'Configuración del sistema',
      description:
        'Retorna la configuración actual del sistema y las features habilitadas. Solo **SUPERADMIN**.',
      security: [{ bearerAuth: [] }],
      responses: {
        200: {
          description: 'Configuración del sistema',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SystemConfig' },
              example: {
                message: 'Configuración del sistema (solo SUPERADMIN)',
                features: {
                  rbacEnabled: true,
                  refreshTokenRotation: true,
                  refreshTokenStorage: 'redis',
                  multiSession: true,
                  auditLog: true,
                  rateLimiting: true,
                  progressiveLockout: true,
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/neighborhoods': {
    get: {
      tags: ['Admin'],
      summary: 'Listar barrios (catálogo)',
      description:
        'Lista barrios con filtros, búsqueda y paginación cursor. Acceso para SUPERADMIN y COORDINADOR.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'cursor',
          required: false,
          schema: { type: 'string', format: 'uuid' },
          description: 'Cursor de la página anterior',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Tamaño de página',
        },
        {
          in: 'query',
          name: 'search',
          required: false,
          schema: { type: 'string' },
          description: 'Búsqueda por nombre de barrio',
        },
        {
          in: 'query',
          name: 'zone',
          required: false,
          schema: { type: 'string' },
          description: 'Filtro por zona',
        },
      ],
      responses: {
        200: {
          description: 'Listado de barrios',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['neighborhoods', 'meta'],
                properties: {
                  neighborhoods: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/NeighborhoodCatalog' },
                  },
                  meta: { $ref: '#/components/schemas/CursorPaginationMeta' },
                },
              },
            },
          },
        },
        400: {
          description: 'Parámetros inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    post: {
      tags: ['Admin'],
      summary: 'Crear barrio (catálogo)',
      description: 'Crea un nuevo barrio. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateNeighborhoodRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Barrio creado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['neighborhood'],
                properties: {
                  neighborhood: { $ref: '#/components/schemas/NeighborhoodCatalog' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        409: {
          description: 'Barrio duplicado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/neighborhoods/{id}': {
    patch: {
      tags: ['Admin'],
      summary: 'Actualizar barrio (catálogo)',
      description: 'Actualiza un barrio. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del barrio',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateNeighborhoodRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Barrio actualizado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['neighborhood'],
                properties: {
                  neighborhood: { $ref: '#/components/schemas/NeighborhoodCatalog' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: {
          description: 'Barrio duplicado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Eliminar barrio (catálogo)',
      description:
        'Elimina físicamente un barrio solo si no tiene ciudadanos asociados. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del barrio',
        },
      ],
      responses: {
        200: {
          description: 'Barrio eliminado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message', 'neighborhood'],
                properties: {
                  message: { type: 'string' },
                  neighborhood: { $ref: '#/components/schemas/NeighborhoodCatalog' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: {
          description: 'Barrio en uso por ciudadanos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/tags': {
    get: {
      tags: ['Admin'],
      summary: 'Listar etiquetas (catálogo)',
      description:
        'Lista etiquetas con filtros, búsqueda y paginación cursor. Acceso para SUPERADMIN y COORDINADOR.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'cursor',
          required: false,
          schema: { type: 'string', format: 'uuid' },
          description: 'Cursor de la página anterior',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Tamaño de página',
        },
        {
          in: 'query',
          name: 'search',
          required: false,
          schema: { type: 'string' },
          description: 'Búsqueda por nombre o descripción',
        },
        {
          in: 'query',
          name: 'color',
          required: false,
          schema: { type: 'string' },
          description: 'Filtro por color',
        },
      ],
      responses: {
        200: {
          description: 'Listado de etiquetas',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tags', 'meta'],
                properties: {
                  tags: { type: 'array', items: { $ref: '#/components/schemas/TagCatalog' } },
                  meta: { $ref: '#/components/schemas/CursorPaginationMeta' },
                },
              },
            },
          },
        },
        400: {
          description: 'Parámetros inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    post: {
      tags: ['Admin'],
      summary: 'Crear etiqueta (catálogo)',
      description: 'Crea una nueva etiqueta. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateTagRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Etiqueta creada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tag'],
                properties: { tag: { $ref: '#/components/schemas/TagCatalog' } },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        409: {
          description: 'Etiqueta duplicada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/tags/{id}': {
    patch: {
      tags: ['Admin'],
      summary: 'Actualizar etiqueta (catálogo)',
      description: 'Actualiza una etiqueta. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID de la etiqueta',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateTagRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Etiqueta actualizada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['tag'],
                properties: { tag: { $ref: '#/components/schemas/TagCatalog' } },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: {
          description: 'Etiqueta duplicada',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Eliminar etiqueta (catálogo)',
      description:
        'Elimina físicamente una etiqueta solo si no está asignada a ciudadanos. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID de la etiqueta',
        },
      ],
      responses: {
        200: {
          description: 'Etiqueta eliminada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message', 'tag'],
                properties: {
                  message: { type: 'string' },
                  tag: { $ref: '#/components/schemas/TagCatalog' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: {
          description: 'Etiqueta en uso por ciudadanos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/departments': {
    get: {
      tags: ['Admin'],
      summary: 'Listar departamentos (catálogo)',
      description:
        'Lista departamentos con filtros, búsqueda y paginación cursor. Acceso para SUPERADMIN y COORDINADOR.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'query',
          name: 'cursor',
          required: false,
          schema: { type: 'string', format: 'uuid' },
          description: 'Cursor de la página anterior',
        },
        {
          in: 'query',
          name: 'limit',
          required: false,
          schema: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          description: 'Tamaño de página',
        },
        {
          in: 'query',
          name: 'search',
          required: false,
          schema: { type: 'string' },
          description: 'Búsqueda por slug, nombre o keyword',
        },
        {
          in: 'query',
          name: 'isActive',
          required: false,
          schema: { type: 'boolean' },
          description: 'Filtro por estado activo/inactivo',
        },
      ],
      responses: {
        200: {
          description: 'Listado de departamentos',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['departments', 'meta'],
                properties: {
                  departments: {
                    type: 'array',
                    items: { $ref: '#/components/schemas/DepartmentCatalog' },
                  },
                  meta: { $ref: '#/components/schemas/CursorPaginationMeta' },
                },
              },
            },
          },
        },
        400: {
          description: 'Parámetros inválidos',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    post: {
      tags: ['Admin'],
      summary: 'Crear departamento (catálogo)',
      description: 'Crea un nuevo departamento. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/CreateDepartmentRequest' },
          },
        },
      },
      responses: {
        201: {
          description: 'Departamento creado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['department'],
                properties: {
                  department: { $ref: '#/components/schemas/DepartmentCatalog' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        409: {
          description: 'Slug duplicado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/admin/departments/{id}': {
    patch: {
      tags: ['Admin'],
      summary: 'Actualizar departamento (catálogo)',
      description: 'Actualiza un departamento. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del departamento',
        },
      ],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/UpdateDepartmentRequest' },
          },
        },
      },
      responses: {
        200: {
          description: 'Departamento actualizado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['department'],
                properties: {
                  department: { $ref: '#/components/schemas/DepartmentCatalog' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ValidationErrorResponse' },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        409: {
          description: 'Slug duplicado',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' },
            },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
    delete: {
      tags: ['Admin'],
      summary: 'Desactivar departamento (catálogo)',
      description:
        'Soft delete del departamento (`isActive=false`). Se protege el slug `general`. Solo SUPERADMIN.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          in: 'path',
          name: 'id',
          required: true,
          schema: { type: 'string', format: 'uuid' },
          description: 'ID del departamento',
        },
      ],
      responses: {
        200: {
          description: 'Departamento desactivado',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['message', 'department'],
                properties: {
                  message: { type: 'string' },
                  department: { $ref: '#/components/schemas/DepartmentCatalog' },
                },
              },
            },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: { $ref: '#/components/responses/NotFound' },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  // ── Webhook ─────────────────────────────────────────────────────────────────
  '/api/v1/webhook': {
    get: {
      tags: ['Webhook'],
      summary: 'Verificación del webhook (Meta)',
      description: [
        'Meta llama a este endpoint al configurar la suscripción al webhook.',
        'Valida `hub.mode`, `hub.verify_token` y responde con `hub.challenge` como texto plano.',
        'No requiere autenticación JWT.',
      ].join('\n'),
      parameters: [
        {
          in: 'query',
          name: 'hub.mode',
          required: true,
          schema: { type: 'string', enum: ['subscribe'] },
          description: 'Debe ser "subscribe"',
        },
        {
          in: 'query',
          name: 'hub.verify_token',
          required: true,
          schema: { type: 'string' },
          description: 'Token configurado en `WHATSAPP_VERIFY_TOKEN`',
        },
        {
          in: 'query',
          name: 'hub.challenge',
          required: true,
          schema: { type: 'string' },
          description: 'Valor arbitrario de Meta que debe retornarse sin modificar',
        },
      ],
      responses: {
        200: {
          description: 'Verificación exitosa — retorna hub.challenge como texto plano',
          content: { 'text/plain': { schema: { type: 'string' }, example: '1234567890' } },
        },
        403: {
          description: 'Token de verificación inválido o modo incorrecto',
          content: { 'text/plain': { schema: { type: 'string' }, example: 'Forbidden' } },
        },
      },
    },
    post: {
      tags: ['Webhook'],
      summary: 'Recibir mensajes y eventos de WhatsApp',
      description: [
        'Recibe mensajes y eventos entrantes de WhatsApp enviados por Meta.',
        'El middleware `metaSignature` valida la firma HMAC-SHA256 antes de procesar el payload.',
        '',
        'El procesamiento es **asíncrono** — responde `200 OK` inmediatamente a Meta (< 5s).',
        '**Nota**: No usa JWT — usa firma HMAC-SHA256 de Meta.',
      ].join('\n'),
      security: [{ hubSignature: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['object', 'entry'],
              properties: {
                object: {
                  type: 'string',
                  enum: ['whatsapp_business_account'],
                  example: 'whatsapp_business_account',
                },
                entry: { type: 'array', items: { type: 'object' } },
              },
            },
          },
        },
      },
      responses: {
        200: {
          description: 'Payload recibido. Meta requiere siempre 200 OK.',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { status: { type: 'string', enum: ['ok', 'ignored'] } },
              },
              examples: {
                processed: { value: { status: 'ok' } },
                ignored: { value: { status: 'ignored' } },
              },
            },
          },
        },
        401: {
          description: 'Firma HMAC-SHA256 inválida o ausente',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },
  // ── Messages ─────────────────────────────────────────────────────────────────
  '/api/v1/messages/text': {
    post: {
      tags: ['Messages'],
      summary: 'Enviar mensaje de texto al ciudadano',
      description: [
        'El agente autenticado envía un mensaje de texto libre a una conversación activa.',
        'Requiere rol **OPERADOR_CHAT** o superior.',
        'El mensaje se encola en el Outbox y se envía de forma asíncrona a través de WhatsApp Cloud API.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/SendTextRequest' },
          },
        },
      },
      responses: {
        202: {
          description: 'Mensaje encolado para envío',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['queued'], example: 'queued' },
                  messageId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: {
          description: 'Conversación no encontrada',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  // ── Handover ─────────────────────────────────────────────────────────────────
  '/api/v1/handover/take': {
    post: {
      tags: ['Handover'],
      summary: 'Tomar control de una conversación',
      description: [
        'El agente toma control de una conversación en estado BOT o DEPARTMENT_ROUTING.',
        'Transiciona el estado a **HUMAN_FLOW**.',
        'Requiere rol **OPERADOR_CHAT** o superior.',
        'Retorna 409 si la conversación ya está asignada a un agente.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/HandoverRequest' } },
        },
      },
      responses: {
        200: {
          description: 'Conversación tomada exitosamente',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['taken'], example: 'taken' },
                  conversationId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: {
          description: 'Conversación no encontrada',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        409: {
          description: 'Conversación ya asignada a un agente',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/handover/release': {
    post: {
      tags: ['Handover'],
      summary: 'Devolver conversación al bot',
      description: [
        'El agente libera la conversación y la devuelve al bot (HUMAN_FLOW → BOT_FLOW).',
        'Requiere rol **OPERADOR_CHAT** o superior.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/HandoverRequest' } },
        },
      },
      responses: {
        200: {
          description: 'Conversación liberada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['released'], example: 'released' },
                  conversationId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: {
          description: 'Conversación no encontrada',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },

  '/api/v1/handover/escalate': {
    post: {
      tags: ['Handover'],
      summary: 'Escalar una conversación',
      description: [
        'El agente escala la conversación a un nivel superior (→ ESCALATED).',
        'Requiere rol **OPERADOR_CHAT** o superior.',
      ].join('\n'),
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: { $ref: '#/components/schemas/HandoverRequest' } },
        },
      },
      responses: {
        200: {
          description: 'Conversación escalada',
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  status: { type: 'string', enum: ['escalated'], example: 'escalated' },
                  conversationId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
        },
        400: {
          description: 'Payload inválido',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        401: { $ref: '#/components/responses/Unauthorized' },
        403: { $ref: '#/components/responses/Forbidden' },
        404: {
          description: 'Conversación no encontrada',
          content: {
            'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } },
          },
        },
        500: { $ref: '#/components/responses/InternalError' },
      },
    },
  },
};

// ─── Spec completa ────────────────────────────────────────────────────────────

export const createSwaggerSpec = ({ port }: SwaggerSpecParams): OpenAPIDocument => ({
  openapi: '3.0.0',
  info: {
    title: 'Voz Ciudadana API',
    version: '0.1.0',
    description: [
      'API del backend de **Voz Ciudadana**.',
      '',
      '## Módulos',
      '- **Auth**: Autenticación JWT con refresh token rotado, multi-sesión por dispositivo, rate limiting y lockout progresivo.',
      '- **Admin**: Gestión de usuarios del panel (CRUD). Solo SUPERADMIN.',
      '- **Webhook**: Webhook de WhatsApp Cloud API para recepción de mensajes entrantes.',
      '- **Messages**: Envío de mensajes salientes a ciudadanos vía WhatsApp.',
      '- **Handover**: Transferencia de conversaciones bot↔agente y escalado.',
      '- **Health**: Health check para monitoreo y load balancers.',
      '',
      '## Autenticación',
      'Usar el botón **Authorize** con el access token obtenido en `POST /api/v1/auth/login`.',
      'Formato: `Bearer <accessToken>`',
    ].join('\n'),
    contact: { name: 'Equipo Voz Ciudadana' },
    license: { name: 'Privado' },
  },
  servers: [
    { url: `http://localhost:${port}`, description: 'Desarrollo local' },
    { url: 'https://api.vozciudadana.gob', description: 'Producción' },
  ],
  tags: [
    { name: 'Auth', description: 'Autenticación y gestión de sesiones del panel admin' },
    { name: 'Admin', description: 'Gestión de usuarios del panel (solo SUPERADMIN)' },
    { name: 'Webhook', description: 'Webhook de WhatsApp Cloud API (Meta)' },
    { name: 'Messages', description: 'Envío de mensajes salientes a ciudadanos vía WhatsApp' },
    { name: 'Handover', description: 'Gestión de transferencia bot↔agente de conversaciones' },
    { name: 'Health', description: 'Estado de la aplicación' },
  ],
  components: {
    schemas,
    responses,
    securitySchemes,
  },
  paths,
});
