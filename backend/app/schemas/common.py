"""
Schemas Pydantic v2 para respuestas genéricas de la API.
"""
from pydantic import BaseModel


class HealthResponse(BaseModel):
    """Respuesta estándar del endpoint de salud."""
    status: str
    environment: str
