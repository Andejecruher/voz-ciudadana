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
 * - Los aliases de path (@/) requieren tsconfig-paths en ts-node-dev
 */
import express, { NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

// Cargar .env antes de cualquier import que lea process.env
import './config/env.config';
import { getPort } from './config/env.config';

// Servicios de infraestructura
import { PrismaService } from './services/prisma.service';
import { RedisService } from './services/redis.service';

// Capa de servicios de dominio
import { BotService } from './services/bot.service';

// Controllers
import { WebhookController } from './controllers/webhook.controller';

// Rutas
import { createWebhookRouter } from './routes/webhook.routes';

// ── Instancias de infraestructura ────────────────────────────────────────────
const prisma = new PrismaService();
const redis = new RedisService();
const port = getPort();

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
    origin: process.env['CORS_ORIGIN'] ?? '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Hub-Signature-256'],
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
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Voz Ciudadana API',
      version: '0.1.0',
      description:
        'API del backend de Voz Ciudadana — webhook WhatsApp + bot FSM de registro ciudadano.',
      contact: { name: 'Equipo Voz Ciudadana' },
    },
    servers: [{ url: `http://localhost:${port}`, description: 'Desarrollo local' }],
    components: {
      securitySchemes: {
        hubSignature: {
          type: 'apiKey',
          in: 'header',
          name: 'X-Hub-Signature-256',
          description: 'Firma HMAC-SHA256 generada por Meta sobre el raw body',
        },
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    tags: [
      { name: 'Webhook', description: 'Endpoints del webhook de WhatsApp Cloud API' },
      { name: 'Health', description: 'Estado de la aplicación' },
    ],
  },
  // Lee anotaciones JSDoc de controllers (tanto src como dist compilado)
  apis: ['./src/controllers/*.ts', './dist/controllers/*.js'],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/docs.json', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// ── Composición manual de dependencias ────────────────────────────────────────
// Wiring: PrismaService + RedisService → BotService → WebhookController → Router
const botService = new BotService(prisma, redis);
const webhookController = new WebhookController(botService);

// ── Rutas ─────────────────────────────────────────────────────────────────────
const webhookRouter = createWebhookRouter(webhookController);
app.use('/api/v1/webhook', webhookRouter);

// ── Health check ──────────────────────────────────────────────────────────────
/**
 * @openapi
 * /health:
 *   get:
 *     summary: Estado de la aplicación
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Aplicación funcionando correctamente
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: ok
 *                 ts:
 *                   type: string
 *                   format: date-time
 */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// ── Manejo global de errores ──────────────────────────────────────────────────
// El cuarto parámetro `_next` es obligatorio para que Express reconozca el handler de error
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ErrorHandler]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Arranque ──────────────────────────────────────────────────────────────────
async function start(): Promise<void> {
  await prisma.connect();

  const server = app.listen(port, () => {
    console.log(`🚀 Voz Ciudadana API corriendo en http://localhost:${port}`);
    console.log(`📚 Documentación en http://localhost:${port}/docs`);
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
