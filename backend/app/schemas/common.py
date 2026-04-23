"""
Schemas Pydantic v2 para respuestas genéricas de la API.
"""
from pydantic import BaseModel, ConfigDict, Field


class HealthResponse(BaseModel):
    """Respuesta estándar del endpoint de salud."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"status": "ok", "environment": "development"}}
    )

    status: str = Field(description="Estado del servicio. Siempre 'ok' si la API está operativa.")
    environment: str = Field(description="Entorno de ejecución: development, staging, production.")


class ErrorResponse(BaseModel):
    """Formato estándar de error devuelto por la API."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"detail": "Email o contraseña incorrectos"}}
    )

    detail: str = Field(description="Descripción del error.")


class WebhookReceivedResponse(BaseModel):
    """Respuesta de confirmación al webhook de Meta."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"status": "received"}}
    )

    status: str = Field(
        default="received",
        description="Confirmación de recepción. Meta requiere 200 OK con cualquier body.",
    )
