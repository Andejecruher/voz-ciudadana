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
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';

import { env } from './config/env.config';
import { createSwaggerSpec } from './config/swagger.config';
import { errorHandler } from './middlewares/errorHandler';

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
 *
 * NOTA: Swagger UI (swagger-ui-express 5.x) requiere scripts/estilos inline y
 * carga assets desde CDN (unpkg.com). La CSP por defecto de helmet 7 los bloquea.
 * Se deshabilita contentSecurityPolicy únicamente para las rutas de docs.
 * El resto de la app mantiene la CSP estricta de helmet.
 */
app.use(
  /^\/(api-docs|docs)(\/|$)/,
  helmet({
    contentSecurityPolicy: false,
  }),
);
app.use(/^(?!\/(api-docs|docs))/, helmet());

/**
 * cors: permite peticiones cross-origin.
 * En producción, restringir origin al dominio del frontend.
 * Supuesto: En desarrollo se permite todo; en prod configurar via CORS_ORIGIN env.
 */
app.use(
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
// La spec es un objeto OpenAPIV3.Document; swagger-ui-express acepta JsonObject.
const swaggerSpec = createSwaggerSpec({ port }) as unknown as swaggerUi.JsonObject;

const swaggerUiOptions: swaggerUi.SwaggerUiOptions = {
  // Habilitar "Try it out" por defecto en todos los endpoints
  swaggerOptions: {
    tryItOutEnabled: true,
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'list',
  },
  // Customizar el título de la UI
  customSiteTitle: 'Voz Ciudadana API — Docs',
};

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions));
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, swaggerUiOptions)); // alias de compatibilidad
app.get('/api-docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Rutas ─────────────────────────────────────────────────────────────────────
registerRoutes(app, { prisma, redis });

// ── Manejo global de errores ──────────────────────────────────────────────────
// errorHandler normaliza AppError, ValidationError y errores genéricos al
// formato { success: false, error, code? } definido en utils/api-response.ts
app.use(errorHandler);

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
