/**
 * Documentación OpenAPI de los endpoints del webhook de WhatsApp Cloud API.
 * Base: /api/v1/webhook
 */

/**
 * @openapi
 * tags:
 *   - name: Webhook
 *     description: >
 *       Endpoints del webhook de WhatsApp Cloud API (Meta).
 *       El GET verifica la suscripción al webhook. El POST recibe mensajes y eventos.
 *       El POST requiere firma HMAC-SHA256 válida en `X-Hub-Signature-256`.
 */

/**
 * @openapi
 * /api/v1/webhook:
 *   get:
 *     tags: [Webhook]
 *     summary: Verificación del webhook (Meta)
 *     description: >
 *       Meta llama a este endpoint al configurar o verificar la suscripción al webhook.
 *       Valida `hub.mode`, `hub.verify_token` y responde con `hub.challenge` como texto plano.
 *
 *       Este endpoint **no requiere autenticación JWT** — Meta lo llama directamente.
 *       El `hub.verify_token` debe coincidir con la variable de entorno `WHATSAPP_VERIFY_TOKEN`.
 *     parameters:
 *       - in: query
 *         name: hub.mode
 *         required: true
 *         schema:
 *           type: string
 *           enum: [subscribe]
 *         description: Debe ser "subscribe" para que la verificación sea exitosa
 *         example: subscribe
 *       - in: query
 *         name: hub.verify_token
 *         required: true
 *         schema:
 *           type: string
 *         description: Token de verificación configurado en Meta Developer Console y en `WHATSAPP_VERIFY_TOKEN`
 *         example: "mi-token-secreto"
 *       - in: query
 *         name: hub.challenge
 *         required: true
 *         schema:
 *           type: string
 *         description: Valor arbitrario de Meta que debe retornarse sin modificar
 *         example: "1234567890"
 *     responses:
 *       200:
 *         description: Verificación exitosa — retorna hub.challenge como texto plano
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *             example: "1234567890"
 *       403:
 *         description: Token de verificación inválido o modo incorrecto
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *             example: Forbidden
 *
 *   post:
 *     tags: [Webhook]
 *     summary: Recibir mensajes y eventos de WhatsApp
 *     description: >
 *       Recibe mensajes y eventos entrantes de WhatsApp enviados por Meta.
 *       El middleware `metaSignature` valida la firma HMAC-SHA256 antes de procesar
 *       el payload. Si la firma es inválida, se rechaza con 401 antes de llegar al controller.
 *
 *       El procesamiento del mensaje es **asíncrono** — se responde `200 OK` inmediatamente
 *       a Meta (que requiere respuesta en < 5 segundos) y el bot FSM procesa en background.
 *
 *       **Eventos soportados**: mensajes de texto, audio, imagen, documento, video, sticker,
 *       ubicación, contacto, plantilla y reacciones.
 *
 *       **Nota**: Este endpoint no usa autenticación JWT — usa firma HMAC-SHA256 de Meta.
 *     security:
 *       - hubSignature: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: Payload de WhatsApp Cloud API (formato de Meta)
 *             required:
 *               - object
 *               - entry
 *             properties:
 *               object:
 *                 type: string
 *                 enum: [whatsapp_business_account]
 *                 example: whatsapp_business_account
 *               entry:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       description: ID de la cuenta de WhatsApp Business
 *                       example: "123456789"
 *                     changes:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           value:
 *                             type: object
 *                             properties:
 *                               messaging_product:
 *                                 type: string
 *                                 example: whatsapp
 *                               metadata:
 *                                 type: object
 *                                 properties:
 *                                   display_phone_number:
 *                                     type: string
 *                                   phone_number_id:
 *                                     type: string
 *                               contacts:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     profile:
 *                                       type: object
 *                                       properties:
 *                                         name:
 *                                           type: string
 *                                     wa_id:
 *                                       type: string
 *                               messages:
 *                                 type: array
 *                                 items:
 *                                   type: object
 *                                   properties:
 *                                     from:
 *                                       type: string
 *                                       description: Número de teléfono del remitente
 *                                       example: "5491112345678"
 *                                     id:
 *                                       type: string
 *                                       description: ID del mensaje de WhatsApp
 *                                     type:
 *                                       type: string
 *                                       enum: [text, audio, image, document, video, sticker, location, contacts, template, reaction]
 *                                     text:
 *                                       type: object
 *                                       properties:
 *                                         body:
 *                                           type: string
 *                                           example: Hola
 *                           field:
 *                             type: string
 *                             example: messages
 *           examples:
 *             textMessage:
 *               summary: Mensaje de texto entrante
 *               value:
 *                 object: whatsapp_business_account
 *                 entry:
 *                   - id: "123456789"
 *                     changes:
 *                       - value:
 *                           messaging_product: whatsapp
 *                           metadata:
 *                             display_phone_number: "+54 9 11 1234-5678"
 *                             phone_number_id: "987654321"
 *                           contacts:
 *                             - profile:
 *                                 name: Juan Pérez
 *                               wa_id: "5491112345678"
 *                           messages:
 *                             - from: "5491112345678"
 *                               id: "wamid.ABC123"
 *                               type: text
 *                               text:
 *                                 body: "Hola, quiero registrarme"
 *                         field: messages
 *     responses:
 *       200:
 *         description: >
 *           Payload recibido y procesado (o encolado). Meta requiere siempre 200 OK.
 *           Si el objeto no es `whatsapp_business_account`, retorna `{status: "ignored"}`.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   enum: [ok, ignored]
 *             examples:
 *               processed:
 *                 value:
 *                   status: ok
 *               ignored:
 *                 value:
 *                   status: ignored
 *       400:
 *         description: Payload malformado (solo si el body es completamente inválido)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: Invalid payload
 *       401:
 *         description: Firma HMAC-SHA256 inválida o ausente
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               error: Invalid signature
 *               code: INVALID_SIGNATURE
 *       500:
 *         $ref: '#/components/responses/InternalError'
 */

export {};
