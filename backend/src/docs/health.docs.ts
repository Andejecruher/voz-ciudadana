/**
 * @openapi
 * tags:
 *   - name: Health
 *     description: Estado de la aplicación
 */

/**
 * @openapi
 * /health:
 *   get:
 *     tags: [Health]
 *     summary: Estado de la aplicación
 *     description: >
 *       Endpoint de health check. Retorna el estado de la API y el timestamp actual.
 *       No requiere autenticación. Útil para load balancers y monitoreo.
 *     responses:
 *       200:
 *         description: Aplicación funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               required:
 *                 - status
 *                 - ts
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok]
 *                   example: ok
 *                 ts:
 *                   type: string
 *                   format: date-time
 *                   description: Timestamp ISO 8601 del servidor
 *                   example: "2024-01-15T10:30:00.000Z"
 *             example:
 *               status: ok
 *               ts: "2024-01-15T10:30:00.000Z"
 */
export {};
