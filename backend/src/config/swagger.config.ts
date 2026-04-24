import swaggerJsdoc from 'swagger-jsdoc';

export type SwaggerSpecParams = {
  port: number;
};

export type SwaggerSpec = Record<string, unknown>;

type SwaggerJSDocOptions = {
  definition: {
    openapi: string;
    info: {
      title: string;
      version: string;
      description?: string;
      contact?: { name?: string };
      license?: { name: string; url?: string };
    };
    servers?: Array<{ url: string; description?: string }>;
    components?: {
      securitySchemes?: Record<string, Record<string, unknown>>;
    };
    tags?: Array<{ name: string; description?: string }>;
  };
  apis: string[];
};

type SwaggerBuilder = (options?: SwaggerJSDocOptions) => SwaggerSpec;

const buildSwaggerSpec: SwaggerBuilder = (options) =>
  swaggerJsdoc(options as unknown as swaggerJsdoc.Options) as SwaggerSpec;

export const createSwaggerSpec: (params: SwaggerSpecParams) => SwaggerSpec = ({ port }) => {
  const swaggerOptions: SwaggerJSDocOptions = {
    definition: {
      openapi: '3.0.0',
      info: {
        title: 'Voz Ciudadana API',
        version: '0.1.0',
        description: [
          'API del backend de **Voz Ciudadana**.',
          '',
          '## Módulos',
          '- **Auth**: Autenticación JWT con refresh token rotado, multi-sesión por dispositivo, rate limiting y lockout progresivo.',
          '- **Admin**: Gestión de usuarios del panel (CRUD). Solo SUPERADMIN.',
          '- **Webhook**: Webhook de WhatsApp Cloud API para recepción de mensajes del bot FSM.',
          '- **Health**: Health check para monitoreo y load balancers.',
          '',
          '## Autenticación',
          'Usar el botón **Authorize** con el access token obtenido en `POST /api/v1/auth/login`.',
          'Formato: `Bearer <accessToken>`',
        ].join('\n'),
        contact: { name: 'Equipo Voz Ciudadana' },
      },
      servers: [
        { url: `http://localhost:${port}`, description: 'Desarrollo local' },
        { url: 'https://api.vozciudadana.gob', description: 'Producción' },
      ],
      // Los componentes se definen en src/docs/components.docs.ts vía @openapi JSDoc.
      // Esta sección solo necesita los securitySchemes para que Swagger UI muestre el botón Authorize.
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'JWT de acceso obtenido en POST /api/v1/auth/login. Formato: `Bearer <accessToken>`',
          },
          hubSignature: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Hub-Signature-256',
            description: 'Firma HMAC-SHA256 generada por Meta sobre el raw body del webhook',
          },
        },
      },
      tags: [
        { name: 'Auth', description: 'Autenticación y gestión de sesiones del panel admin' },
        {
          name: 'Admin',
          description: 'Gestión de usuarios del panel (solo SUPERADMIN)',
        },
        { name: 'Webhook', description: 'Webhook de WhatsApp Cloud API (Meta)' },
        { name: 'Health', description: 'Estado de la aplicación' },
      ],
    },
    // Lee anotaciones JSDoc de todos los archivos docs, controllers y routes
    apis: [
      // docs explícitos primero — definen componentes reutilizables
      './src/docs/components.docs.ts',
      './src/docs/health.docs.ts',
      './src/docs/auth.docs.ts',
      './src/docs/admin.docs.ts',
      './src/docs/webhook.docs.ts',
      // controllers y routes como fallback por si hay anotaciones inline
      './src/controllers/*.ts',
      './src/routes/*.ts',
      // archivos compilados (para el modo producción con dist/)
      './dist/docs/components.docs.js',
      './dist/docs/health.docs.js',
      './dist/docs/auth.docs.js',
      './dist/docs/admin.docs.js',
      './dist/docs/webhook.docs.js',
      './dist/controllers/*.js',
      './dist/routes/*.js',
    ],
  };

  return buildSwaggerSpec(swaggerOptions);
};
