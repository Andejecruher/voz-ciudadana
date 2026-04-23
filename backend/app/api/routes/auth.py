"""
Rutas de autenticación: login y perfil del usuario actual.
"""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_user
from app.core.database import get_db
from app.db.models.role import UserRole
from app.db.models.user import User
from app.schemas.auth import LoginRequest, TokenResponse, UserOut
from app.services.auth_service import create_access_token, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=TokenResponse, summary="Iniciar sesión")
async def login(
    payload: LoginRequest,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> TokenResponse:
    """
    Autentica al usuario con email + contraseña.
    Retorna un access token JWT si las credenciales son válidas.
    """
    # Buscamos el usuario por email cargando sus roles
    result = await db.execute(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.email == payload.email)
    )
    user = result.scalar_one_or_none()

    # Verificamos existencia, contraseña y estado activo
    if not user or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email o contraseña incorrectos",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Usuario inactivo",
        )

    # Incluimos los roles como claim extra en el JWT para reducir queries en cada request
    token = create_access_token(
        subject=str(user.id),
        extra_claims={"email": user.email, "roles": user.role_names},
    )

    return TokenResponse(access_token=token)


@router.get("/me", response_model=UserOut, summary="Perfil del usuario autenticado")
async def me(
    current_user: Annotated[User, Depends(get_current_user)],
) -> UserOut:
    """
    Retorna el perfil del usuario autenticado con sus roles asignados.
    Requiere un JWT válido en el header Authorization.
    """
    return UserOut(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        is_active=current_user.is_active,
        is_superuser=current_user.is_superuser,
        roles=current_user.role_names,
        created_at=current_user.created_at,
    )
