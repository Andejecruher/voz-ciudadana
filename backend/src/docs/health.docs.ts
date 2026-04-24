/**
 * @openapi
 * /health:
 *   get:
 *     summary: Estado de la aplicacion
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Aplicacion funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 ts:
 *                   type: string
 *                   format: date-time
 */
export {};
