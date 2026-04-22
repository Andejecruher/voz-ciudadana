"""
Configuración de la conexión asíncrona con PostgreSQL usando SQLAlchemy 2.x.
"""
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings

# Motor asíncrono — pool_pre_ping evita conexiones muertas
engine = create_async_engine(
    settings.database_url,
    echo=settings.environment == "development",
    pool_pre_ping=True,
)

# Fábrica de sesiones asíncronas
AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Clase base para todos los modelos ORM."""
    pass


async def get_db() -> AsyncSession:
    """
    Dependencia de FastAPI que provee una sesión de base de datos
    y la cierra automáticamente al finalizar el request.
    """
    async with AsyncSessionLocal() as session:
        yield session
