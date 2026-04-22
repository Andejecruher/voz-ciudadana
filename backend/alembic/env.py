"""
Entorno de Alembic configurado para migraciones asíncronas con asyncpg.
Lee la URL de base de datos desde la variable de entorno DATABASE_URL.
"""
import asyncio
import os
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

# Importar todos los modelos para que Alembic los detecte
from app.db.base import Base  # noqa: F401

# Configuración de Alembic desde alembic.ini
config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Metadata de los modelos — necesaria para autogenerate
target_metadata = Base.metadata

# Sobreescribir URL con la variable de entorno si existe
database_url = os.environ.get("DATABASE_URL", config.get_main_option("sqlalchemy.url"))


def run_migrations_offline() -> None:
    """
    Modo offline: genera SQL sin conectarse a la base.
    Útil para revisar migraciones antes de aplicarlas.
    """
    context.configure(
        url=database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_migrations_online() -> None:
    """
    Modo online: se conecta a la base y aplica las migraciones de forma asíncrona.
    """
    connectable = create_async_engine(database_url, echo=False)
    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)
    await connectable.dispose()


if context.is_offline_mode():
    run_migrations_offline()
else:
    asyncio.run(run_migrations_online())
