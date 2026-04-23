"""
Dependencias de FastAPI para autenticación y autorización por roles.

Uso:
    current_user = Depends(get_current_user)
    _             = Depends(require_roles(["admin"]))
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.db.models.role import UserRole
from app.db.models.user import User
from app.services.auth_service import decode_access_token

# El token se espera en Authorization: Bearer <token>
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")


async def get_current_user(
    token: Annotated[str, Depends(oauth2_scheme)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> User:
    """
    Dependencia que valida el JWT y retorna el usuario autenticado.

    Raises:
        401: Si el token es inválido, expiró o el usuario no existe/está inactivo.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="No se pudo validar las credenciales",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = decode_access_token(token)
        user_id: str | None = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Cargamos el usuario con sus roles en una sola query (eager load)
    result = await db.execute(
        select(User)
        .options(selectinload(User.user_roles).selectinload(UserRole.role))
        .where(User.id == user_id)
    )
    user = result.scalar_one_or_none()

    if user is None or not user.is_active:
        raise credentials_exception

    return user


def require_roles(allowed_roles: list[str]):
    """
    Fábrica de dependencias que verifica que el usuario tenga al menos uno
    de los roles permitidos.

    Uso:
        @router.get("/admin-only")
        async def admin_only(_: Annotated[User, Depends(require_roles(["admin"]))]):
            ...

    Args:
        allowed_roles: Lista de nombres de roles que tienen acceso.

    Returns:
        Dependencia FastAPI que retorna el usuario si tiene el rol, 403 si no.
    """
    async def _check(
        current_user: Annotated[User, Depends(get_current_user)],
    ) -> User:
        # Los superusers tienen acceso irrestricto
        if current_user.is_superuser:
            return current_user

        user_roles = current_user.role_names
        if not any(role in user_roles for role in allowed_roles):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado. Roles requeridos: {allowed_roles}",
            )
        return current_user

    return _check
