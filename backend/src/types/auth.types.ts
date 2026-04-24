/**
 * Tipos TypeScript para el sistema de autenticación y autorización RBAC.
 *
 * Fuente única de autorización: Role.name como string constante.
 * User.isSuperuser está deprecado — NO usar para nuevas rutas.
 */
import { JwtPayload as JwtLibPayload } from 'jsonwebtoken';

// ── Roles del panel administrativo ───────────────────────────────────────────

/** Roles válidos del panel. Agregar aquí si se necesitan más. */
export const PANEL_ROLES = ['SUPERADMIN', 'COORDINADOR', 'OPERADOR_CHAT', 'ANALISTA'] as const;

export type PanelRole = (typeof PANEL_ROLES)[number];

// ── JWT Payloads ──────────────────────────────────────────────────────────────

/**
 * Payload del access token.
 * `roles` contiene los nombres de rol del usuario autenticado.
 */
export interface AccessTokenPayload extends JwtLibPayload {
  /** ID del usuario (UUID) */
  sub: string;
  /** Email del usuario */
  email: string;
  /** Nombre completo */
  fullName: string | null;
  /** Roles asignados al usuario */
  roles: PanelRole[];
  /** Tipo de token — para distinguir access vs refresh */
  type: 'access';
}

/**
 * Payload del refresh token.
 * Minimalista por seguridad — solo sub, tipo y device binding.
 */
export interface RefreshTokenPayload extends JwtLibPayload {
  sub: string;
  type: 'refresh';
  /** Jti — ID único del token para invalidación en Redis */
  jti: string;
  /** Identificador del dispositivo que originó la sesión */
  deviceId: string;
}

// ── Extensión de Express Request ──────────────────────────────────────────────

/** Usuario autenticado inyectado en req.user por auth.middleware */
export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string | null;
  roles: PanelRole[];
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
