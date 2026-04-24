/**
 * Documentación OpenAPI de los endpoints de autenticación.
 * Base: /api/v1/auth
 */

/**
 * @openapi
 * tags:
 *   - name: Auth
 *     description: >
 *       Autenticación y gestión de sesiones del panel administrativo.
 *       Implementa JWT access + refresh tokens con rotación single-use,
 *       multi-sesión por dispositivo (x-device-id), rate limiting por IP
 *       y lockout progresivo por identidad.
 */

/**
 * @openapi
 * /api/v1/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Iniciar sesión
 *     description: >
 *       Autentica al usuario admin con email y contraseña.
 *       Retorna un par de tokens JWT (access + refresh) y el perfil del usuario.
 *
 *       **Rate limiting**: 10 intentos / 15 min por IP. Configurable via
 *       `AUTH_RATE_LIMIT_MAX` y `AUTH_RATE_LIMIT_WINDOW_SECONDS`.
 *
 *       **Lockout progresivo**: Tras 5 fallos consecutivos (configurable via
 *       `AUTH_LOCKOUT_MAX_ATTEMPTS`) la cuenta se bloquea con duraciones
 *       progresivas: 60s → 5min → 15min → 1h.
 *
 *       **Device binding**: Se recomienda enviar `x-device-id` o `deviceId` en
 *       el body con un ID estable del dispositivo para habilitar multi-sesión real.
 *       Sin él, cada login crea una sesión anónima.
 *     parameters:
 *       - in: header
 *         name: x-device-id
 *         schema:
 *           type: string
 *         description: >
 *           Identificador estable del dispositivo. Prioridad sobre `body.deviceId`.
 *           Si se omite, se genera un UUID aleatorio por request.
 *         example: "browser-chrome-desktop-uuid"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             withDevice:
 *               summary: Login con device-id en body
 *               value:
 *                 email: admin@vozciudadana.gob
 *                 password: "MiPassword123!"
 *                 deviceId: "browser-chrome-desktop-uuid"
 *             minimal:
 *               summary: Login mínimo (sesión anónima)
 *               value:
 *                 email: admin@vozciudadana.gob
 *                 password: "MiPassword123!"
 *     responses:
 *       200:
 *         description: Login exitoso — par de tokens + perfil del usuario
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - accessToken
 *                 - refreshToken
 *                 - user
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: JWT de acceso (15min por defecto)
 *                 refreshToken:
 *                   type: string
 *                   description: JWT de refresco (7d por defecto, single-use)
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               accessToken: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTEifQ.sig
 *               refreshToken: eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ1dWlkLTEifQ.sig
 *               user:
 *                 id: 550e8400-e29b-41d4-a716-446655440000
 *                 email: admin@vozciudadana.gob
 *                 fullName: Ana García
 *                 roles: [SUPERADMIN]
 *       400:
 *         description: Datos de entrada inválidos (email malformado, contraseña vacía)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         description: Credenciales inválidas o usuario inactivo
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: Credenciales inválidas
 *               code: UNAUTHORIZED
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/v1/auth/refresh:
 *   post:
 *     tags: [Auth]
 *     summary: Renovar access token
 *     description: >
 *       Rota el refresh token: invalida el token anterior y emite un nuevo par.
 *       El refresh token es **single-use** — reutilizarlo activa detección de
 *       replay attack (invalida la sesión y registra evento de seguridad).
 *
 *       **Rate limiting**: 60 intentos / 5 min por IP para detectar refresh flooding.
 *
 *       **Device binding**: El `deviceId` del payload del token tiene prioridad.
 *       Enviar `x-device-id` o `body.deviceId` es opcional pero recomendado
 *       para detección de mismatch de dispositivo.
 *     parameters:
 *       - in: header
 *         name: x-device-id
 *         schema:
 *           type: string
 *         description: ID del dispositivo (para detección de anomalías)
 *         example: "browser-chrome-desktop-uuid"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefreshRequest'
 *           example:
 *             refreshToken: eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ1dWlkLTEifQ.sig
 *             deviceId: "browser-chrome-desktop-uuid"
 *     responses:
 *       200:
 *         description: Tokens renovados exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthTokenPair'
 *             example:
 *               accessToken: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyLTIifQ.sig
 *               refreshToken: eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ1dWlkLTIifQ.sig
 *       400:
 *         description: refreshToken ausente o no es string
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: refreshToken es requerido
 *               code: BAD_REQUEST
 *       401:
 *         description: Token inválido, expirado, sesión expirada o replay detectado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             examples:
 *               expired:
 *                 value:
 *                   error: Refresh token inválido o expirado
 *                   code: UNAUTHORIZED
 *               sessionExpired:
 *                 value:
 *                   error: Sesión expirada, iniciá sesión nuevamente
 *                   code: UNAUTHORIZED
 *               replay:
 *                 value:
 *                   error: Refresh token ya utilizado
 *                   code: UNAUTHORIZED
 *       429:
 *         $ref: '#/components/responses/RateLimited'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/v1/auth/me:
 *   get:
 *     tags: [Auth]
 *     summary: Perfil del usuario autenticado
 *     description: >
 *       Retorna el perfil del usuario asociado al access token.
 *       Siempre consulta la base de datos para retornar datos actualizados
 *       (incluyendo cambios de rol o desactivación).
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Perfil del usuario autenticado
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - user
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               user:
 *                 id: 550e8400-e29b-41d4-a716-446655440000
 *                 email: admin@vozciudadana.gob
 *                 fullName: Ana García
 *                 roles: [SUPERADMIN]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/v1/auth/logout:
 *   post:
 *     tags: [Auth]
 *     summary: Cerrar sesión
 *     description: >
 *       Invalida la sesión actual o todas las sesiones del usuario.
 *
 *       - **Sin `logoutAll`**: invalida solo la sesión identificada por `refreshToken`.
 *         Si no se provee `refreshToken`, el access token sigue válido hasta su expiración
 *         natural pero no se puede renovar.
 *       - **Con `logoutAll: true`**: invalida TODAS las sesiones (todos los dispositivos).
 *         Útil al detectar compromiso de cuenta.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LogoutRequest'
 *           examples:
 *             single:
 *               summary: Cerrar sesión actual
 *               value:
 *                 refreshToken: eyJhbGciOiJIUzI1NiJ9.eyJqdGkiOiJ1dWlkLTEifQ.sig
 *             all:
 *               summary: Cerrar todas las sesiones
 *               value:
 *                 logoutAll: true
 *     responses:
 *       200:
 *         description: Sesión(es) cerrada(s) exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             examples:
 *               single:
 *                 value:
 *                   message: Sesión cerrada correctamente
 *               all:
 *                 value:
 *                   message: Todas las sesiones cerradas correctamente
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     tags: [Auth]
 *     summary: Registrar nuevo administrador (solo SUPERADMIN)
 *     description: >
 *       Crea un nuevo usuario del panel administrativo.
 *       Requiere rol **SUPERADMIN**. Alternativa a `POST /admin/users` para
 *       registrar admins directamente desde el flujo de autenticación.
 *
 *       La acción queda registrada en el audit log.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RegisterAdminRequest'
 *           example:
 *             email: nuevo.coordinador@vozciudadana.gob
 *             password: "PasswordSeguro123!"
 *             fullName: Pedro Ramírez
 *             roles: [COORDINADOR]
 *     responses:
 *       201:
 *         description: Usuario creado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - user
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *             example:
 *               user:
 *                 id: 660e8400-e29b-41d4-a716-446655440001
 *                 email: nuevo.coordinador@vozciudadana.gob
 *                 fullName: Pedro Ramírez
 *                 roles: [COORDINADOR]
 *       400:
 *         description: Datos inválidos o roles no existen
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ValidationErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       409:
 *         description: El email ya está registrado
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: El email nuevo.coordinador@vozciudadana.gob ya está registrado
 *               code: CONFLICT
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

export {};
