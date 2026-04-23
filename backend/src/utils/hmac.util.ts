/**
 * Utilidades criptográficas para validación de webhooks.
 * Centraliza la lógica HMAC para evitar duplicación entre servicios.
 */
import * as crypto from 'crypto';

/**
 * Error específico para fallas de autenticación del webhook.
 * Permite distinguirlo de otros errores en el middleware.
 */
export class WebhookAuthError extends Error {
  readonly statusCode = 401;

  constructor(message: string) {
    super(message);
    this.name = 'WebhookAuthError';
  }
}

/**
 * Valida la firma X-Hub-Signature-256 enviada por Meta en el header del webhook.
 *
 * @param rawBody  - Buffer con el cuerpo crudo de la request (debe preservarse sin parsear)
 * @param signature - Valor del header X-Hub-Signature-256 (formato: "sha256=<hex>")
 * @param appSecret - App Secret de la app de Meta para generar el HMAC esperado
 *
 * @throws WebhookAuthError si la firma es inválida o falta
 */
export function validateWebhookSignature(
  rawBody: Buffer,
  signature: string | undefined,
  appSecret: string,
): void {
  if (!signature) {
    throw new WebhookAuthError('Missing X-Hub-Signature-256 header');
  }

  const expected =
    'sha256=' +
    crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex');

  // Comparación segura para evitar timing attacks
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    throw new WebhookAuthError('Invalid X-Hub-Signature-256');
  }
}

/**
 * Normaliza un número de teléfono al formato E.164 con "+" inicial.
 * WhatsApp envía números sin el símbolo "+".
 *
 * @param phone - Número tal como llega del payload (ej: "5491112345678")
 * @returns Número normalizado (ej: "+5491112345678")
 */
export function normalizePhone(phone: string): string {
  return phone.startsWith('+') ? phone : `+${phone}`;
}
