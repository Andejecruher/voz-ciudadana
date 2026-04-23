"""
Punto de entrada de la aplicación FastAPI.
Configura CORS, registra los routers y expone la instancia `app`.
"""
import logging

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.router import api_router
from app.core.config import settings
from app.db import base  # noqa: F401  # registra todos los modelos ORM

# ── Logging básico ────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.DEBUG if settings.environment == "development" else logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)

logger = logging.getLogger(__name__)

# ── Metadatos de tags para la documentación OpenAPI ──────────────────────────
TAGS_METADATA = [
    {
        "name": "Health",
        "description": "Endpoints de monitoreo y verificación del estado del servicio.",
    },
    {
        "name": "auth",
        "description": (
            "Autenticación con email/contraseña. "
            "El login devuelve un **JWT Bearer token** que debe enviarse en el header "
            "`Authorization: Bearer <token>` para acceder a endpoints protegidos."
        ),
    },
    {
        "name": "admin",
        "description": (
            "Gestión de usuarios del sistema y asignación de roles. "
            "Todos los endpoints requieren rol **admin** o `is_superuser=true`."
        ),
    },
    {
        "name": "WhatsApp Webhook",
        "description": (
            "Integración con la **Meta Cloud API** de WhatsApp. "
            "El endpoint GET es usado por Meta para verificar la URL del webhook. "
            "El POST recibe eventos de mensajes entrantes con validación de firma HMAC-SHA256."
        ),
    },
]

_is_prod = settings.environment == "production"

# ── Instancia FastAPI ─────────────────────────────────────────────────────────
app = FastAPI(
    title="VozCiudadana API",
    description=(
        "## VozCiudadana — Plataforma de participación ciudadana\n\n"
        "Backend de la plataforma que permite a ciudadanos interactuar vía **WhatsApp** "
        "para registrar solicitudes, consultas y participar en campañas digitales.\n\n"
        "### Autenticación\n"
        "Los endpoints protegidos requieren un token JWT obtenido en `POST /api/v1/auth/login`. "
        "Enviarlo como `Authorization: Bearer <token>`.\n\n"
        "### Roles disponibles\n"
        "- **admin** — acceso total, gestión de usuarios y roles\n"
        "- **agent** — atención ciudadana\n"
        "- **readonly** — solo lectura\n"
    ),
    version="0.1.0",
    openapi_url="/api/v1/openapi.json",
    docs_url="/docs" if not _is_prod else None,
    redoc_url="/redoc" if not _is_prod else None,
    openapi_tags=TAGS_METADATA,
    contact={
        "name": "Equipo VozCiudadana",
    },
    license_info={
        "name": "Privado",
    },
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# En producción restringir origins al dominio del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"] if settings.environment == "development" else [],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(api_router, prefix="/api/v1")


@app.on_event("startup")
async def on_startup() -> None:
    logger.info("VozCiudadana API iniciada — entorno: %s", settings.environment)
