/**
 * Middleware de autenticación JWT para rutas protegidas del panel de administración.
 *
 * Extrae y valida el token Bearer del header Authorization.
 * Si es válido, inyecta el payload decodificado en req.user para uso posterior.
 *
 * Supuesto: Se usa jsonwebtoken (@types/jsonwebtoken). Agregar al package.json:
 *   dependencies: jsonwebtoken
 *   devDependencies: @types/jsonwebtoken
 *
 * Flujo:
 * 1. Extraer el token del header Authorization: Bearer <token>
 * 2. Verificar y decodificar el JWT con JWT_SECRET
 * 3. Inyectar el payload en req.user
 * 4. Llamar next() si es válido, 401 si no
 *
 * Uso:
 *   router.get('/admin/citizens', jwtMiddleware, adminController.listCitizens);
 *
 * Variables de entorno requeridas:
 *   JWT_SECRET — secreto para firmar/verificar JWTs (nunca en código fuente)
 */
import { Request, Response, NextFunction } from 'express';
import {
  verify,
  JsonWebTokenError,
  TokenExpiredError,
  JwtPayload as JwtLibPayload,
} from 'jsonwebtoken';

/**
 * Payload esperado dentro del JWT.
 * Extensible según las necesidades del sistema de roles.
 */
export interface JwtPayload extends JwtLibPayload {
  /** ID del usuario autenticado */
  sub: string;
  /** Rol del usuario (admin, agent, etc.) */
  role: string;
}

/** Extiende Express Request para incluir el user autenticado */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware de Express que valida el token JWT del header Authorization.
 *
 * @throws 401 si el token está ausente, malformado o expirado
 * @throws 500 si JWT_SECRET no está configurado
 */
export function jwtMiddleware(req: Request, res: Response, next: NextFunction): void {
  // ── 1. Extraer token del header ───────────────────────────────────────────
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Token not found in Authorization header' });
    return;
  }

  // ── 2. Obtener el secreto ─────────────────────────────────────────────────
  const secret = process.env['JWT_SECRET'];

  if (!secret) {
    console.error('[JwtMiddleware] JWT_SECRET no configurado en variables de entorno');
    res.status(500).json({ error: 'Internal server error' });
    return;
  }

  // ── 3. Verificar y decodificar ────────────────────────────────────────────
  try {
    // jsonwebtoken retorna string | JwtPayload — el cast es seguro post-verificación
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    const decoded = verify(token, secret) as JwtPayload;

    // Inyectar payload en req para uso en controllers
    req.user = decoded;

    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({ error: 'Token expired' });
      return;
    }

    if (err instanceof JsonWebTokenError) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Error inesperado — no exponer detalles al cliente
    console.error('[JwtMiddleware] Error verificando token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}
