"""
Schemas Pydantic v2 para autenticación y gestión de usuarios/roles.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Payload de login con email y contraseña."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "admin@vozcuidadana.com",
                "password": "secreto123",
            }
        }
    )

    email: EmailStr = Field(description="Email del usuario registrado en el sistema.")
    password: str = Field(description="Contraseña en texto plano.")


class TokenResponse(BaseModel):
    """Respuesta del endpoint de login con el access token JWT."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                "token_type": "bearer",
            }
        }
    )

    access_token: str = Field(description="JWT Bearer token. Válido por el tiempo configurado en el servidor.")
    token_type: str = Field(default="bearer", description="Tipo de token. Siempre 'bearer'.")


# ── Roles ─────────────────────────────────────────────────────────────────────

class RoleOut(BaseModel):
    """Representación pública de un rol del sistema."""
    id: uuid.UUID
    name: str = Field(description="Nombre del rol: admin, agent, readonly.")
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ── Users ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Payload para crear un nuevo usuario del sistema."""

    model_config = ConfigDict(
        json_schema_extra={
            "example": {
                "email": "agente01@vozcuidadana.com",
                "password": "contraseñaSegura1",
                "full_name": "María González",
                "is_superuser": False,
            }
        }
    )

    email: EmailStr = Field(description="Email único del usuario.")
    password: str = Field(min_length=8, description="Contraseña en texto plano (mínimo 8 caracteres).")
    full_name: str | None = Field(default=None, description="Nombre completo del usuario.")
    is_superuser: bool = Field(default=False, description="Si es True, el usuario tiene acceso total sin restricciones de rol.")


class UserOut(BaseModel):
    """Representación pública de un usuario (sin contraseña)."""

    model_config = ConfigDict(
        from_attributes=True,
        json_schema_extra={
            "example": {
                "id": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
                "email": "agente01@vozcuidadana.com",
                "full_name": "María González",
                "is_active": True,
                "is_superuser": False,
                "roles": ["agent"],
                "created_at": "2024-01-15T10:30:00Z",
            }
        },
    )

    id: uuid.UUID = Field(description="Identificador único del usuario.")
    email: EmailStr = Field(description="Email del usuario.")
    full_name: str | None = Field(default=None, description="Nombre completo.")
    is_active: bool = Field(description="Si False, el usuario no puede autenticarse.")
    is_superuser: bool = Field(description="Indica acceso total sin restricciones de rol.")
    roles: list[str] = Field(default=[], description="Lista de nombres de roles asignados.")
    created_at: datetime = Field(description="Fecha y hora de creación del usuario (UTC).")


class AssignRoleRequest(BaseModel):
    """Payload para asignar un rol a un usuario."""

    model_config = ConfigDict(
        json_schema_extra={"example": {"role_name": "agent"}}
    )

    role_name: str = Field(
        description="Nombre del rol a asignar. Valores válidos: **admin**, **agent**, **readonly**."
    )
