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

# ── Instancia FastAPI ─────────────────────────────────────────────────────────
app = FastAPI(
    title="VozCiudadana API",
    description="Backend de la plataforma de participación ciudadana vía WhatsApp.",
    version="0.1.0",
    docs_url="/docs" if settings.environment != "production" else None,
    redoc_url="/redoc" if settings.environment != "production" else None,
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
