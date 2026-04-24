# Backend docs

Este directorio centraliza la documentacion tecnica del backend.

## Estructura del backend

```
backend/
  docs/
  prisma/
    migrations/
    schema.prisma
    seed/
  src/
    config/
    controllers/
    database/
    middlewares/
    routes/
    services/
    utils/
    server.ts
  Dockerfile
  package.json
  tsconfig.json
```

### Que hay en cada carpeta

- docs/
  Documentacion del backend y convenciones internas.
- prisma/
  Schema y migraciones de Prisma, mas seeds para datos iniciales.
- src/
  Codigo fuente de la API.
- src/config/
  Configuracion de entorno y tipos de config.
- src/controllers/
  Controladores HTTP. Orquestan la request/response y llaman a servicios.
- src/database/
  Entradas de acceso a la base de datos (Prisma client, helpers).
- src/middlewares/
  Middlewares de Express (auth, firma, validaciones comunes).
- src/routes/
  Definicion de rutas y wiring de dependencias. Aqui se registran modulos.
- src/services/
  Logica de negocio y servicios de infraestructura.
- src/utils/
  Helpers puros (crypto, parsing, formateos simples).

## Como construir un modulo nuevo

### 1) Servicio (logica de negocio)

- Crear un servicio en src/services/.
- Debe recibir dependencias por constructor (por ejemplo Prisma o Redis).
- No debe conocer Express ni Request/Response.

### 2) Controller (capa HTTP)

- Crear controller en src/controllers/.
- Validar inputs de manera basica y delegar al servicio.
- Retornar respuestas HTTP con status y payload consistentes.
- Anotar endpoints con JSDoc OpenAPI para que Swagger los documente.

### 3) Routes (exponer endpoints)

- Crear un archivo en src/routes/ con un createXRouter(...).
- Montar el router en src/routes/index.ts dentro de registerRoutes.
- En index.ts se hace el wiring: instanciar servicios y controllers necesarios.

### 4) Middlewares (si aplica)

- Si un endpoint requiere autenticacion o firma, agregar middleware en src/middlewares/.
- Componerlo en el router del modulo.

### 5) Documentacion

- Agregar una seccion nueva en docs/README.md si el modulo lo amerita.
- Mantener la descripcion de carpetas y convenciones actualizada.

## Convenciones de inyeccion

- La inicializacion de infraestructura (Prisma, Redis) se hace en src/server.ts.
- El wiring de servicios y controllers ocurre en src/routes/index.ts.
- Las dependencias se inyectan por constructor para facilitar testing.

## Swagger / OpenAPI

- Se generan specs desde anotaciones JSDoc en controllers y routes.
- Revisar /docs para validar que los endpoints aparezcan correctamente.
