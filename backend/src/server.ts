/**
 * Entry point de la aplicación Express — Voz Ciudadana API.
 *
 * Responsabilidades:
 * - Cargar variables de entorno (dotenv)
 * - Instanciar servicios de infraestructura (Prisma, Redis)
 * - Montar middlewares globales (JSON con rawBody, cors, helmet, swagger)
 * - Registrar rutas (webhook, healthcheck)
 * - Escuchar en el puerto configurado
 * - Manejar señales del proceso (SIGTERM, SIGINT) para shutdown limpio
 *
 * Supuestos:
 * - cors y helmet se agregan como dependencias en package.json
 * - jsonwebtoken se agrega para el jwt.middleware
 * - Los imports del backend usan rutas relativas para evitar dependencia de baseUrl/paths
 */
import cors from 'cors';
import express, { NextFunction, Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.config';
import { createSwaggerSpec } from './config/swagger.config';
import { AppError } from './utils/app-error';

// Servicios de infraestructura
import { PrismaService } from './services/prisma.service';
import { RedisService } from './services/redis.service';

// Rutas
import { registerRoutes } from './routes';

// ── Instancias de infraestructura ────────────────────────────────────────────
const prisma = new PrismaService();
const redis = new RedisService();
const port = env.PORT;

// ── Aplicación Express ────────────────────────────────────────────────────────
const app = express();

/**
 * helmet: establece headers de seguridad HTTP seguros por defecto.
 * Protege contra clickjacking, sniffing, XSS y otros ataques comunes.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
app.use(helmet());

/**
 * cors: permite peticiones cross-origin.
 * En producción, restringir origin al dominio del frontend.
 * Supuesto: En desarrollo se permite todo; en prod configurar via CORS_ORIGIN env.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-call
app.use(
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  cors({
    origin: env.CORS_ORIGIN,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256', 'X-Device-Id'],
  }),
);

/**
 * express.json con opción `verify` para capturar el rawBody.
 * Meta firma los payloads del webhook con HMAC-SHA256 sobre el body crudo —
 * necesitamos el Buffer original ANTES del parsing para validar la firma.
 * El rawBody se inyecta en req para uso del metaSignature.middleware.ts
 */
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// ── Swagger / OpenAPI ─────────────────────────────────────────────────────────
// swagger-jsdoc expone types CJS con `any` en runtime; se castea al formato esperado por swagger-ui.
// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call
const swaggerSpec = createSwaggerSpec({ port }) as swaggerUi.JsonObject;

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec)); // alias de compatibilidad
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
registerRoutes(app, { prisma, redis });

// ── Manejo global de errores ──────────────────────────────────────────────────
// El cuarto parámetro `_next` es obligatorio para que Express reconozca el handler de error
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: err.message,
      ...(err.code ? { code: err.code } : {}),
    });
    return;
  }

  // Error inesperado — loguear pero no exponer detalles
  const message = err instanceof Error ? err.message : 'Unknown error';
  console.error('[ErrorHandler]', message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await prisma.connect();

  const server = app.listen(port, () => {
    console.log(`🚀 Voz Ciudadana API corriendo en http://localhost:${port}`);
    console.log(`📚 Documentación en http://localhost:${port}/api-docs`);
    console.log(`📄 OpenAPI JSON en http://localhost:${port}/api-docs.json`);
  });

  // Shutdown limpio al recibir señales del sistema operativo
  const shutdown = (signal: string): void => {
    console.log(`\n[Shutdown] Señal ${signal} recibida. Cerrando servidor...`);

    server.close(() => {
      prisma
        .disconnect()
        .then(() => redis.disconnect())
        .then(() => {
          console.log('[Shutdown] Servidor cerrado limpiamente.');
          process.exit(0);
        })
        .catch((err: unknown) => {
          console.error('[Shutdown] Error durante el cierre:', err);
          process.exit(1);
        });
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err: unknown) => {
  console.error('[Bootstrap] Error fatal al iniciar:', err);
  process.exit(1);
});
