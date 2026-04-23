"""
Rutas de administración: gestión de usuarios y asignación de roles.
Solo accesibles para usuarios con rol 'admin' o superusers.
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user, require_roles
from app.core.database import get_db
from app.db.models.role import Role, UserRole
from app.db.models.user import User
from app.schemas.auth import AssignRoleRequest, UserCreate, UserOut
from app.schemas.common import ErrorResponse
from app.services.auth_service import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])

# Alias para la dependencia de rol admin — más legible en los decoradores
AdminRequired = Depends(require_roles(["admin"]))

_RESPONSES_ADMIN = {
    401: {"model": ErrorResponse, "description": "Token ausente, inválido o expirado."},
    403: {"model": ErrorResponse, "description": "El usuario no tiene rol admin."},
}


@router.post(
    "/users",
    response_model=UserOut,
    status_code=status.HTTP_201_CREATED,
    summary="Crear usuario del sistema",
    description=(
        "Crea un nuevo usuario del sistema (admin, agente, readonly, etc.). "
        "El usuario creado estará activo pero **sin roles asignados**; "
        "usar `POST /admin/users/{user_id}/roles` para asignarlos. "
        "Solo accesible para administradores."
    ),
    responses={
        201: {"description": "Usuario creado exitosamente."},
        409: {
            "model": ErrorResponse,
            "description": "Ya existe un usuario con ese email.",
        },
        **_RESPONSES_ADMIN,
    },
)
async def create_user(
    payload: UserCreate,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, AdminRequired],
) -> UserOut:
    """
    Crea un nuevo usuario del sistema (admin, agente, etc.).
    Solo accesible para administradores.
    """
    # Verificamos que el email no esté en uso
    existing = await db.execute(select(User).where(User.email == payload.email))
    if existing.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe un usuario con ese email",
        )

    new_user = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        is_superuser=payload.is_superuser,
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    return UserOut(
        id=new_user.id,
        email=new_user.email,
        full_name=new_user.full_name,
        is_active=new_user.is_active,
        is_superuser=new_user.is_superuser,
        roles=[],
        created_at=new_user.created_at,
    )


@router.post(
    "/users/{user_id}/roles",
    response_model=UserOut,
    summary="Asignar rol a usuario",
    description=(
        "Asigna un rol a un usuario existente. "
        "La operación es **idempotente**: si el usuario ya tiene el rol, no se duplica. "
        "Roles válidos: `admin`, `agent`, `readonly`. "
        "Solo accesible para administradores."
    ),
    responses={
        200: {"description": "Rol asignado (o ya existía). Devuelve el perfil actualizado."},
        404: {
            "model": ErrorResponse,
            "description": "Usuario o rol no encontrado.",
        },
        **_RESPONSES_ADMIN,
    },
)
async def assign_role(
    user_id: uuid.UUID,
    payload: AssignRoleRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
    _: Annotated[User, AdminRequired],
) -> UserOut:
    """
    Asigna un rol a un usuario existente.
    Si el usuario ya tiene el rol, la operación es idempotente.
    Solo accesible para administradores.
    """
    # Verificamos que el usuario existe, cargando sus roles actuales
    result = await db.execute(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Usuario no encontrado",
        )

    # Verificamos que el rol existe en la base de datos
    role_result = await db.execute(
        select(Role).where(Role.name == payload.role_name)
    )
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El rol '{payload.role_name}' no existe. Roles válidos: admin, agent, readonly",
        )

    # Verificamos si el usuario ya tiene ese rol (idempotente)
    already_assigned = any(ur.role_id == role.id for ur in user.user_roles)
    if not already_assigned:
        user_role = UserRole(user_id=user.id, role_id=role.id)
        db.add(user_role)
        await db.commit()
        # Recargamos el usuario con roles actualizados
        result = await db.execute(
            select(User)
            .options(selectinload(User.user_roles).selectinload(UserRole.role))
            .where(User.id == user_id)
        )
        user = result.scalar_one()

    return UserOut(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_superuser=user.is_superuser,
        roles=user.role_names,
        created_at=user.created_at,
    )
