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
        { name: 'Health', description: 'Estado de la aplicacion' },
      ],
    },
    // Lee anotaciones JSDoc de controllers, routes y docs (tanto src como dist compilado)
    apis: [
      './src/controllers/*.ts',
      './src/docs/*.ts',
      './src/routes/*.ts',
      './dist/controllers/*.js',
      './dist/docs/*.js',
      './dist/routes/*.js',
    ],
  };

  return buildSwaggerSpec(swaggerOptions);
};
