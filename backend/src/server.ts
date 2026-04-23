/**
 * Entry point de la aplicación Express.
 *
 * Responsabilidades:
 * - Cargar variables de entorno
 * - Instanciar servicios de infraestructura (Prisma, Redis)
 * - Montar middlewares (JSON con rawBody, Swagger)
 * - Registrar rutas
 * - Escuchar en el puerto configurado
 * - Manejar señales del proceso (SIGTERM, SIGINT) para shutdown limpio
 */
import './config/env.config'; // Asegura dotenv.config() al inicio
import express, { Request, Response, NextFunction } from 'express';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

import { getPort } from './config/env.config';
import { PrismaService } from './services/prisma.service';
import { RedisService } from './services/redis.service';
import { createAppRouter } from './router/app.router';

// ── Instancias de infraestructura ────────────────────────────────────────────
const prisma = new PrismaService();
const redis = new RedisService();

// ── Aplicación Express ────────────────────────────────────────────────────────
const app = express();

/**
 * Middleware para capturar el rawBody antes del parsing JSON.
 * Meta firma el payload con HMAC-SHA256 sobre el body crudo —
 * necesitamos el Buffer original para validar la firma.
 */
app.use(
  express.json({
    verify: (req: Request & { rawBody?: Buffer }, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

// ── Swagger / OpenAPI ─────────────────────────────────────────────────────────
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Voz Ciudadana API',
      version: '0.1.0',
      description:
        'API del backend de Voz Ciudadana — webhook WhatsApp + bot FSM de registro ciudadano.',
      contact: {
        name: 'Equipo Voz Ciudadana',
      },
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Desarrollo local' },
    ],
    components: {
      securitySchemes: {
        hubSignature: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Hub-Signature-256',
          description: 'Firma HMAC-SHA256 generada por Meta sobre el raw body',
        },
      },
    },
    tags: [
      {
        name: 'Webhook',
        description: 'Endpoints del webhook de WhatsApp Cloud API',
      },
    ],
  },
  // Lee anotaciones JSDoc de los controllers
  apis: ['./src/controller/*.ts', './dist/controller/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Documentación UI en /docs
app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Especificación JSON en /docs.json
app.get('/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Rutas de la aplicación ────────────────────────────────────────────────────
const appRouter = createAppRouter({ prisma, redis });
app.use('/', appRouter);

// ── Health check mínimo ───────────────────────────────────────────────────────
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Manejo global de errores ──────────────────────────────────────────────────
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ErrorHandler]', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await prisma.connect();

  const port = getPort();
  const server = app.listen(port, () => {
    console.log(`🚀 Voz Ciudadana API corriendo en http://localhost:${port}`);
    console.log(`📚 Documentación en http://localhost:${port}/docs`);
  });

  // ── Shutdown limpio en señales del proceso ────────────────────────────────
  const shutdown = async (signal: string): Promise<void> => {
    console.log(`\n[Shutdown] Señal recibida: ${signal}. Cerrando servidor...`);

    server.close(async () => {
      await prisma.disconnect();
      await redis.disconnect();
      console.log('[Shutdown] Servidor cerrado limpiamente.');
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

start().catch((err) => {
  console.error('[Bootstrap] Error fatal al iniciar la aplicación:', err);
  process.exit(1);
});
