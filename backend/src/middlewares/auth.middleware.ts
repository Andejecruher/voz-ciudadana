/**
 * Middleware de autenticación JWT para rutas protegidas del panel de administración.
 *
 * Valida el access token Bearer, inyecta AuthenticatedUser en req.user.
 * Reemplaza al jwt.middleware.ts anterior — mantiene la misma firma de función
 * para compatibilidad con rutas existentes.
 */
import { NextFunction, Request, Response } from 'express';
import { JsonWebTokenError, TokenExpiredError } from 'jsonwebtoken';
import { verifyAccessToken } from '../utils/token.util';
import type { AuthenticatedUser } from '../types/auth.types';

/**
 * Middleware que valida el access token JWT del header Authorization.
 *
 * @throws 401 si el token está ausente, malformado o expirado
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
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

  try {
    const decoded = verifyAccessToken(token);

    if (decoded.type !== 'access') {
      res.status(401).json({ error: 'Invalid token type' });
      return;
    }

    const user: AuthenticatedUser = {
      id: decoded.sub ?? '',
      email: decoded.email,
      fullName: decoded.fullName,
      roles: decoded.roles,
    };

    req.user = user;
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

    console.error('[AuthMiddleware] Error verificando token:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
}

// Re-exportar con alias para compatibilidad con código existente
export { authMiddleware as jwtMiddleware };

/** Payload legacy expuesto para backward compat (deprecado — no usar en rutas nuevas) */
export type { AuthenticatedUser as JwtPayload };
