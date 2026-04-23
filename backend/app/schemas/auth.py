"""
Schemas Pydantic v2 para autenticación y gestión de usuarios/roles.
"""
import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    """Payload de login con email y contraseña."""
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    """Respuesta del endpoint de login con el access token."""
    access_token: str
    token_type: str = "bearer"


# ── Roles ─────────────────────────────────────────────────────────────────────

class RoleOut(BaseModel):
    """Representación pública de un rol."""
    id: uuid.UUID
    name: str
    description: str | None = None

    model_config = {"from_attributes": True}


# ── Users ─────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    """Payload para crear un nuevo usuario del sistema."""
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str | None = None
    is_superuser: bool = False


class UserOut(BaseModel):
    """Representación pública de un usuario (sin password)."""
    id: uuid.UUID
    email: EmailStr
    full_name: str | None = None
    is_active: bool
    is_superuser: bool
    roles: list[str] = []
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignRoleRequest(BaseModel):
    """Payload para asignar un rol a un usuario."""
    role_name: str = Field(
        description="Nombre del rol a asignar: admin, agent, readonly"
    )
