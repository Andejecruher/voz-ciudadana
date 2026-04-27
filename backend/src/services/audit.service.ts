/**
 * Servicio de auditoría para acciones administrativas.
 *
 * El registro es append-only: NUNCA se modifican ni eliminan entradas.
 * Los errores al registrar auditoría son no-bloqueantes —
 * se loguean pero no interrumpen el flujo de la operación principal.
 */
import crypto from 'crypto';
import type { Request } from 'express';
import type { PrismaService } from './prisma.service';

// ── Tipos ─────────────────────────────────────────────────────────────────────

/** Acciones auditables del panel admin */
export type AuditAction =
  | 'user.create'
  | 'user.update'
  | 'user.deactivate'
  | 'user.list'
  | 'role.assign'
  | 'role.remove'
  | 'neighborhood.create'
  | 'neighborhood.update'
  | 'neighborhood.delete'
  | 'citizen.create'
  | 'citizen.update'
  | 'citizen.delete'
  | 'citizen.tag.assign'
  | 'citizen.tag.remove'
  | 'tag.create'
  | 'tag.update'
  | 'tag.delete'
  | 'department.create'
  | 'department.update'
  | 'department.deactivate'
  | 'auth.login'
  | 'auth.logout'
  | 'auth.logout_all'
  | 'conversation.list'
  | 'conversation.get'
  | 'conversation.assign'
  | 'conversation.transfer'
  | 'conversation.handover'
  | 'conversation.close'
  | 'conversation.reopen'
  | 'event.create'
  | 'event.update'
  | 'citizen.register_event'
  | 'citizen.checkin_event';

export interface AuditEntry {
  actorId?: string | null;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

// ── Helpers internos ──────────────────────────────────────────────────────────

/** Extrae IP del request considerando proxies (X-Forwarded-For) */
export function extractIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first?.trim() ?? null;
  }
  return req.socket?.remoteAddress ?? null;
}

/** Extrae User-Agent del request */
export function extractUserAgent(req: Request): string | null {
  return req.headers['user-agent'] ?? null;
}

// ── Servicio ──────────────────────────────────────────────────────────────────

export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra una acción de auditoría de forma no-bloqueante.
   * Si falla, loguea el error pero no lanza excepción.
   *
   * NOTA: Usa $executeRawUnsafe para ser agnóstico al Prisma Client generado.
   * Una vez regenerado el cliente (prisma generate), se puede migrar a
   * `this.prisma.auditLog.create(...)` para tipado completo.
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      const id = crypto.randomUUID();
      const metadata = JSON.stringify(entry.metadata ?? {});
      const now = new Date().toISOString();

      await this.prisma.$executeRawUnsafe(
        `INSERT INTO audit_logs
           (id, actor_id, action, target_type, target_id, metadata, ip, user_agent, created_at)
         VALUES
           ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
        id,
        entry.actorId ?? null,
        entry.action,
        entry.targetType,
        entry.targetId ?? null,
        metadata,
        entry.ip ?? null,
        entry.userAgent ?? null,
        now,
      );
    } catch (err) {
      // Falla silenciosa — auditoría no debe interrumpir operaciones de negocio
      console.error('[AuditService] Error registrando auditoría:', err);
    }
  }

  /**
   * Helper de conveniencia: registra desde un Request de Express.
   * Extrae IP y User-Agent automáticamente.
   */
  async logFromRequest(req: Request, entry: Omit<AuditEntry, 'ip' | 'userAgent'>): Promise<void> {
    await this.log({
      ...entry,
      ip: extractIp(req),
      userAgent: extractUserAgent(req),
    });
  }
}
