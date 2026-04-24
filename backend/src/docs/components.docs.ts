/**
 * Componentes OpenAPI reutilizables: schemas, responses y security schemes.
 *
 * Referenciables en toda la documentación como:
 *   $ref: '#/components/schemas/ErrorResponse'
 *   $ref: '#/components/schemas/User'
 *   etc.
 */

/**
 * @openapi
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       required:
 *         - error
 *       properties:
 *         error:
 *           type: string
 *           description: Mensaje de error legible
 *           example: Credenciales inválidas
 *         code:
 *           type: string
 *           description: Código de error de la aplicación (presente en errores conocidos)
 *           example: UNAUTHORIZED
 *
 *     ValidationErrorResponse:
 *       type: object
 *       required:
 *         - error
 *         - details
 *       properties:
 *         error:
 *           type: string
 *           example: Datos inválidos
 *         details:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               path:
 *                 type: array
 *                 items:
 *                   type: string
 *               message:
 *                 type: string
 *
 *     RateLimitErrorResponse:
 *       type: object
 *       required:
 *         - error
 *         - code
 *       properties:
 *         error:
 *           type: string
 *           example: Demasiados intentos de inicio de sesión. Intentá nuevamente en 15 minutos.
 *         code:
 *           type: string
 *           enum: [RATE_LIMITED, ACCOUNT_LOCKED]
 *           example: RATE_LIMITED
 *
 *     AuthTokenPair:
 *       type: object
 *       required:
 *         - accessToken
 *         - refreshToken
 *       properties:
 *         accessToken:
 *           type: string
 *           description: JWT de acceso de corta duración (default 15min)
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlcyI6WyJTVVBFUkFETUlOIl0sInR5cGUiOiJhY2Nlc3MiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDAwMDkwMH0.sig
 *         refreshToken:
 *           type: string
 *           description: JWT de refresco de larga duración (default 7d), single-use con rotación
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJ0eXBlIjoicmVmcmVzaCIsImRldmljZUlkIjoiZGV2aWNlLTEiLCJqdGkiOiJ1dWlkLTEiLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MTcwMDYwNDgwMH0.sig
 *
 *     User:
 *       type: object
 *       required:
 *         - id
 *         - email
 *         - roles
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           description: ID único del usuario
 *           example: 550e8400-e29b-41d4-a716-446655440000
 *         email:
 *           type: string
 *           format: email
 *           example: admin@vozciudadana.gob
 *         fullName:
 *           type: string
 *           nullable: true
 *           example: Ana García
 *         roles:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/PanelRole'
 *         isActive:
 *           type: boolean
 *           description: Presente en respuestas de admin, no en auth/me
 *           example: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Presente en respuestas de admin
 *           example: 2024-01-15T10:30:00.000Z
 *
 *     PanelRole:
 *       type: string
 *       enum:
 *         - SUPERADMIN
 *         - COORDINADOR
 *         - OPERADOR_CHAT
 *         - ANALISTA
 *       description: Rol del usuario en el panel administrativo
 *       example: SUPERADMIN
 *
 *     LoginRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: admin@vozciudadana.gob
 *         password:
 *           type: string
 *           minLength: 1
 *           example: "MiPasswordSeguro123!"
 *         deviceId:
 *           type: string
 *           description: Identificador estable del dispositivo (alternativa al header x-device-id). Si se omite, se genera un UUID por request (sesión anónima).
 *           example: "browser-chrome-desktop-uuid"
 *
 *     RefreshRequest:
 *       type: object
 *       required:
 *         - refreshToken
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: Refresh token obtenido en /auth/login o /auth/refresh anterior
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         deviceId:
 *           type: string
 *           description: ID del dispositivo (alternativa al header x-device-id)
 *           example: "browser-chrome-desktop-uuid"
 *
 *     LogoutRequest:
 *       type: object
 *       properties:
 *         refreshToken:
 *           type: string
 *           description: Refresh token a invalidar. Si se omite, solo invalida el access token.
 *           example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *         logoutAll:
 *           type: boolean
 *           description: Si es true, invalida TODAS las sesiones del usuario (todos los dispositivos)
 *           example: false
 *
 *     RegisterAdminRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - fullName
 *         - roles
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: nuevo.admin@vozciudadana.gob
 *         password:
 *           type: string
 *           minLength: 8
 *           example: "PasswordSeguro123!"
 *         fullName:
 *           type: string
 *           minLength: 2
 *           example: Carlos Rodríguez
 *         roles:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/PanelRole'
 *           example: ["COORDINADOR"]
 *
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - fullName
 *         - roles
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *           example: operador@vozciudadana.gob
 *         password:
 *           type: string
 *           minLength: 8
 *           example: "PasswordSeguro123!"
 *         fullName:
 *           type: string
 *           minLength: 2
 *           example: María López
 *         roles:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/PanelRole'
 *           example: ["OPERADOR_CHAT"]
 *
 *     UpdateUserRequest:
 *       type: object
 *       properties:
 *         fullName:
 *           type: string
 *           minLength: 2
 *           example: María López Actualizado
 *         roles:
 *           type: array
 *           minItems: 1
 *           items:
 *             $ref: '#/components/schemas/PanelRole'
 *           example: ["ANALISTA"]
 *         isActive:
 *           type: boolean
 *           example: true
 *
 *     SystemConfig:
 *       type: object
 *       properties:
 *         message:
 *           type: string
 *           example: Configuración del sistema (solo SUPERADMIN)
 *         features:
 *           type: object
 *           properties:
 *             rbacEnabled:
 *               type: boolean
 *             refreshTokenRotation:
 *               type: boolean
 *             refreshTokenStorage:
 *               type: string
 *               example: redis
 *             multiSession:
 *               type: boolean
 *             auditLog:
 *               type: boolean
 *             rateLimiting:
 *               type: boolean
 *             progressiveLockout:
 *               type: boolean
 *
 *   responses:
 *     Unauthorized:
 *       description: Token de acceso inválido, expirado o ausente
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Unauthorized
 *             code: UNAUTHORIZED
 *     Forbidden:
 *       description: El usuario no tiene el rol requerido para este recurso
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Forbidden
 *             code: FORBIDDEN
 *     NotFound:
 *       description: Recurso no encontrado
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Usuario no encontrado
 *             code: NOT_FOUND
 *     RateLimited:
 *       description: Rate limit excedido o cuenta bloqueada
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RateLimitErrorResponse'
 *     InternalError:
 *       description: Error interno del servidor
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/ErrorResponse'
 *           example:
 *             error: Internal server error
 *
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: >
 *         JWT de acceso obtenido en /api/v1/auth/login.
 *         Formato: `Authorization: Bearer <accessToken>`
 *     hubSignature:
 *       type: apiKey
 *       in: header
 *       name: X-Hub-Signature-256
 *       description: Firma HMAC-SHA256 generada por Meta sobre el raw body del webhook
 */
export {};
