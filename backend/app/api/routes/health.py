"""
Endpoint de salud del servicio.
"""
from fastapi import APIRouter

from app.core.config import settings
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check() -> HealthResponse:
    """Verifica que la API esté levantada y devuelve el entorno actual."""
    return HealthResponse(status="ok", environment=settings.environment)
