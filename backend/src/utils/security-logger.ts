/**
 * Logger de eventos de seguridad críticos.
 *
 * Centraliza el logging estructurado para eventos que requieren
 * visibilidad operacional inmediata:
 * - Lockout de cuentas (brute force)
 * - Replay de refresh tokens (posible token theft)
 * - Rate limit excedido por IP
 * - Mismatch de deviceId/session
 * - Actividades sospechosas de fingerprint
 *
 * En producción, estos logs deben ser capturados por el agente de
 * monitoreo (Datadog, CloudWatch, Sentry, etc.).
 * Por ahora escriben a stdout con un prefijo estándar `[SECURITY]`.
 */

export type SecurityEventType =
  | 'ACCOUNT_LOCKED'
  | 'RATE_LIMIT_EXCEEDED'
  | 'REFRESH_REPLAY_DETECTED'
  | 'DEVICE_MISMATCH'
  | 'FINGERPRINT_ANOMALY'
  | 'SESSION_EXPIRED'
  | 'UNAUTHORIZED_ACCESS';

export interface SecurityEvent {
  type: SecurityEventType;
  ip?: string | null;
  userAgent?: string | null;
  email?: string | null;
  userId?: string | null;
  deviceId?: string | null;
  detail?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Registra un evento de seguridad crítico con formato estructurado.
 * Siempre escribe a stderr para diferenciarlo de logs normales.
 */
export function logSecurityEvent(event: SecurityEvent): void {
  const payload = {
    level: 'SECURITY',
    type: event.type,
    ts: new Date().toISOString(),
    ip: event.ip ?? 'unknown',
    userAgent: event.userAgent
      ? event.userAgent.substring(0, 150) // truncar para evitar log injection
      : 'unknown',
    ...(event.email && { email: maskEmail(event.email) }),
    ...(event.userId && { userId: event.userId }),
    ...(event.deviceId && { deviceId: event.deviceId }),
    ...(event.detail && { detail: event.detail }),
    ...(event.metadata && { metadata: event.metadata }),
  };

  // stderr para visibilidad en sistemas de logging que separan streams
  console.error(`[SECURITY] ${JSON.stringify(payload)}`);
}

/**
 * Enmascara el email para logs: muestra primeras 2 letras + dominio.
 * Ejemplo: "admin@empresa.com" → "ad***@empresa.com"
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***.***';
  const visible = local.substring(0, Math.min(2, local.length));
  return `${visible}***@${domain}`;
}
