/**
 * Middleware de validación de firma HMAC de Meta (X-Hub-Signature-256).
 *
 * Meta firma cada webhook POST con HMAC-SHA256 usando el App Secret de la app.
 * Este middleware valida esa firma ANTES de que el payload llegue al controller.
 *
 * Flujo:
 * 1. Lee el header X-Hub-Signature-256
 * 2. Accede al rawBody capturado por express.json({ verify: ... }) en server.ts
 * 3. Calcula el HMAC esperado con el App Secret
 * 4. Compara con timing-safe equal para evitar timing attacks
 * 5. Si no coincide → 401 Unauthorized
 * 6. Si coincide → next() para continuar al controller
 *
 * Supuesto: El rawBody debe capturarse en server.ts con:
 *   express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } })
 *
 * Referencia: https://developers.facebook.com/docs/messenger-platform/webhooks#validate-payloads
 */
import { Request, Response, NextFunction } from 'express';
import * as crypto from 'crypto';
import { getEnv } from '@/config/env.config';

/** Extiende Request para incluir el rawBody capturado en server.ts */
interface RequestWithRawBody extends Request {
  rawBody?: Buffer;
}

/**
 * Middleware de Express que valida la firma X-Hub-Signature-256 de Meta.
 *
 * Debe montarse ANTES del controller en la ruta POST /webhook.
 * Requiere que express.json() esté configurado con la opción `verify` para
 * capturar el rawBody.
 */
export function metaSignatureMiddleware(
  req: RequestWithRawBody,
  res: Response,
  next: NextFunction,
): void {
  // ── 1. Verificar disponibilidad del rawBody ──────────────────────────────
  if (!req.rawBody) {
    console.error('[MetaSignature] rawBody no disponible — verificar configuración de express.json');
    res.status(400).json({ error: 'Raw body not available' });
    return;
  }

  // ── 2. Leer el header de firma ────────────────────────────────────────────
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (!signature) {
    console.warn('[MetaSignature] Header X-Hub-Signature-256 ausente');
    res.status(401).json({ error: 'Missing X-Hub-Signature-256 header' });
    return;
  }

  // ── 3. Calcular firma esperada ────────────────────────────────────────────
  const appSecret = getEnv('WHATSAPP_APP_SECRET');

  const expectedSignature =
    'sha256=' + crypto.createHmac('sha256', appSecret).update(req.rawBody).digest('hex');

  // ── 4. Comparación timing-safe ────────────────────────────────────────────
  // timingSafeEqual requiere buffers del mismo largo — verificar antes
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    console.warn('[MetaSignature] Firma HMAC inválida — posible request no autorizada');
    res.status(401).json({ error: 'Invalid X-Hub-Signature-256' });
    return;
  }

  // ── 5. Firma válida — continuar al controller ─────────────────────────────
  console.debug('[MetaSignature] Firma HMAC válida ✓');
  next();
}
