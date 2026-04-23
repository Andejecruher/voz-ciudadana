"""
Importa todos los modelos para que Alembic los detecte al generar migraciones.
El orden de importación importa: tablas sin FK deben importarse antes que las que dependen de ellas.
"""
from app.core.database import Base  # noqa: F401
from app.db.models.user import User  # noqa: F401
from app.db.models.role import Role, UserRole  # noqa: F401
from app.db.models.neighborhood import Neighborhood  # noqa: F401
from app.db.models.citizen import Citizen  # noqa: F401
from app.db.models.tag import Tag, CitizenTag  # noqa: F401
from app.db.models.conversation import Conversation  # noqa: F401
from app.db.models.message import Message  # noqa: F401
from app.db.models.attachment import Attachment  # noqa: F401

__all__ = [
    "Base",
    "User",
    "Role",
    "UserRole",
    "Neighborhood",
    "Citizen",
    "Tag",
    "CitizenTag",
    "Conversation",
    "Message",
    "Attachment",
]
