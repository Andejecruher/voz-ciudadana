"""
Endpoint de salud del servicio.
"""
from fastapi import APIRouter

from app.core.config import settings
from app.schemas.common import HealthResponse

router = APIRouter()


@router.get(
    "/health",
    response_model=HealthResponse,
    tags=["Health"],
    summary="Estado del servicio",
    description=(
        "Verifica que la API esté operativa. "
        "Útil para health-checks de load balancers y orquestadores (Docker, Kubernetes)."
    ),
    responses={
        200: {
            "description": "La API está operativa.",
            "content": {
                "application/json": {
                    "example": {"status": "ok", "environment": "development"}
                }
            },
        }
    },
)
async def health_check() -> HealthResponse:
    """Verifica que la API esté levantada y devuelve el entorno actual."""
    return HealthResponse(status="ok", environment=settings.environment)
