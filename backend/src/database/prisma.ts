/**
 * Instancia singleton del cliente Prisma para toda la aplicación.
 *
 * Por qué singleton:
 * - Prisma abre un pool de conexiones a PostgreSQL al instanciar.
 * - Instanciar múltiples PrismaClients en la misma app abre múltiples pools,
 *   lo que puede agotar el límite de conexiones del servidor de BD.
 * - En desarrollo con hot-reload (ts-node-dev), cada recarga crearía una nueva
 *   instancia, por eso se cachea en `global` para evitar el problema.
 *
 * Referencia: https://www.prisma.io/docs/guides/performance-and-optimization/connection-management
 *
 * Supuesto: Este archivo expone una instancia lista para usar.
 * Para operaciones de lifecycle (connect/disconnect en shutdown),
 * usar PrismaService en src/services/prisma.service.ts que extiende PrismaClient.
 */
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.config';

/**
 * Extiende globalThis para cachear la instancia de Prisma en desarrollo.
 * En producción (NODE_ENV=production) no se usa el cache global.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Instancia singleton de PrismaClient.
 *
 * Uso:
 * ```ts
 * import { prismaClient } from '../database/prisma';
 * const citizens = await prismaClient.citizen.findMany();
 * ```
 *
 * En la mayoría de los casos, preferir inyectar PrismaService desde services/
 * para facilitar el testing y el manejo de ciclo de vida.
 */
export const prismaClient: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

// Cachear en global solo en desarrollo para hot-reload
if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient;
}
