/**
 * @deprecated Use auth.middleware.ts instead.
 * Este archivo se mantiene por compatibilidad con código legacy.
 * Para nuevas rutas, usar authMiddleware de auth.middleware.ts.
 */
export { authMiddleware as jwtMiddleware } from './auth.middleware';
export type { AuthenticatedUser as JwtPayload } from '../types/auth.types';
