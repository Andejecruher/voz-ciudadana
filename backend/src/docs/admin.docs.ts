/**
 * Documentación OpenAPI de los endpoints de administración de usuarios.
 * Base: /api/v1/admin
 * Acceso: Solo SUPERADMIN
 */

/**
 * @openapi
 * tags:
 *   - name: Admin
 *     description: >
 *       Gestión de usuarios del panel administrativo.
 *       Todos los endpoints requieren autenticación JWT con rol **SUPERADMIN**.
 *       Todas las operaciones de mutación quedan registradas en el audit log.
 */

/**
 * @openapi
 * /api/v1/admin/users:
 *   get:
 *     tags: [Admin]
 *     summary: Listar usuarios del panel
 *     description: >
 *       Retorna todos los usuarios del panel administrativo con sus roles.
 *       Ordenados por fecha de creación descendente (más recientes primero).
 *       Solo accesible para **SUPERADMIN**.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de usuarios
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - users
 *               properties:
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/User'
 *             example:
 *               users:
 *                 - id: 550e8400-e29b-41d4-a716-446655440000
 *                   email: admin@vozciudadana.gob
 *                   fullName: Ana García
 *                   isActive: true
 *                   createdAt: "2024-01-15T10:30:00.000Z"
 *                   roles: [SUPERADMIN]
 *                 - id: 660e8400-e29b-41d4-a716-446655440001
 *                   email: coordinador@vozciudadana.gob
 *                   fullName: Carlos Rodríguez
 *                   isActive: true
 *                   createdAt: "2024-01-16T09:00:00.000Z"
 *                   roles: [COORDINADOR]
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 *
 *   post:
 *     tags: [Admin]
 *     summary: Crear usuario del panel
 *     description: >
 *       Crea un nuevo usuario del panel administrativo con los roles especificados.
 *       Solo accesible para **SUPERADMIN**.
 *       La acción queda registrada en el audit log.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           example:
 *             email: operador@vozciudadana.gob
 *             password: "PasswordSeguro123!"
 *             fullName: María López
 *             roles: [OPERADOR_CHAT]
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
 *                 id: 770e8400-e29b-41d4-a716-446655440002
 *                 email: operador@vozciudadana.gob
 *                 fullName: María López
 *                 isActive: true
 *                 roles: [OPERADOR_CHAT]
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
 *               error: El email operador@vozciudadana.gob ya está registrado
 *               code: CONFLICT
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/v1/admin/users/{id}:
 *   patch:
 *     tags: [Admin]
 *     summary: Actualizar usuario del panel
 *     description: >
 *       Actualiza `fullName`, `roles` o `isActive` de un usuario.
 *       Al menos un campo debe estar presente.
 *       Solo accesible para **SUPERADMIN**.
 *       La acción queda registrada en el audit log con los campos modificados.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario a actualizar
 *         example: 660e8400-e29b-41d4-a716-446655440001
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *           examples:
 *             updateName:
 *               summary: Actualizar nombre
 *               value:
 *                 fullName: Carlos Rodríguez Actualizado
 *             updateRoles:
 *               summary: Cambiar roles
 *               value:
 *                 roles: [ANALISTA]
 *             deactivate:
 *               summary: Desactivar usuario
 *               value:
 *                 isActive: false
 *     responses:
 *       200:
 *         description: Usuario actualizado exitosamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - user
 *               properties:
 *                 user:
 *                   $ref: '#/components/schemas/User'
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
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 *
 *   delete:
 *     tags: [Admin]
 *     summary: Desactivar usuario del panel (soft delete)
 *     description: >
 *       Desactiva un usuario (`isActive: false`) sin eliminarlo de la base de datos.
 *       Las sesiones activas del usuario seguirán siendo válidas hasta su expiración
 *       natural; las siguientes validaciones de token fallarán con 401.
 *
 *       **Restricción**: No es posible desactivarse a uno mismo.
 *       Solo accesible para **SUPERADMIN**.
 *       La acción queda registrada en el audit log.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID del usuario a desactivar
 *         example: 660e8400-e29b-41d4-a716-446655440001
 *     responses:
 *       200:
 *         description: Usuario desactivado correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *             example:
 *               message: Usuario desactivado correctamente
 *       400:
 *         description: Intento de auto-desactivación
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: No podés desactivarte a vos mismo
 *               code: BAD_REQUEST
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

/**
 * @openapi
 * /api/v1/admin/config:
 *   get:
 *     tags: [Admin]
 *     summary: Configuración del sistema
 *     description: >
 *       Retorna la configuración actual del sistema y las features habilitadas.
 *       Solo accesible para **SUPERADMIN**.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Configuración del sistema
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SystemConfig'
 *             example:
 *               message: Configuración del sistema (solo SUPERADMIN)
 *               features:
 *                 rbacEnabled: true
 *                 refreshTokenRotation: true
 *                 refreshTokenStorage: redis
 *                 multiSession: true
 *                 auditLog: true
 *                 rateLimiting: true
 *                 progressiveLockout: true
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

export {};
