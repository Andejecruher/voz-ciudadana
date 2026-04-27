/**
 * Validación HMAC-SHA256 para webhooks de Meta.
 * Separado del middleware para poder testearlo en aislamiento.
 */
import * as crypto from 'crypto';

/**
 * Valida la firma X-Hub-Signature-256 de Meta.
 *
 * @param rawBody  - Buffer crudo del body de la request
 * @param signature - Header X-Hub-Signature-256 (formato: "sha256=<hex>")
 * @param appSecret - App Secret de la app de Meta
 * @returns true si la firma es válida
 */
export function validateHmacSignature(
  rawBody: Buffer,
  signature: string,
  appSecret: string,
): boolean {
  if (!signature.startsWith('sha256=')) return false;

  const expected = 'sha256=' + crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');

  const sigBuffer = Buffer.from(signature);
  const expBuffer = Buffer.from(expected);

  if (sigBuffer.length !== expBuffer.length) return false;

  return crypto.timingSafeEqual(sigBuffer, expBuffer);
}

/**
 * Genera el App Secret Proof para llamadas autenticadas a la Graph API.
 * Requerido para endpoints que necesitan appsecret_proof.
 *
 * @param accessToken - Token de acceso
 * @param appSecret   - App Secret
 * @returns hex string del HMAC
 */
export function generateAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

/**
 * Genera una clave de idempotencia a partir del wamid + timestamp.
 */
export function generateIdempotencyKey(wamid: string, timestamp: string): string {
  return crypto.createHash('sha256').update(`${wamid}:${timestamp}`).digest('hex').slice(0, 64);
}
