"""
Modelos ORM para tags y la relación N-M con ciudadanos.
Permite etiquetar leads con categorías de campaña (interés, grupo, etc.).
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Tag(Base):
    """
    Etiqueta de campaña. Puede aplicarse a múltiples ciudadanos.
    Reemplaza gradualmente el array libre `citizens.interests`.
    """

    __tablename__ = "tags"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Nombre del tag (único, normalizado en minúsculas)
    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)

    # Descripción del tag (uso sugerido, contexto de campaña)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Color para visualización en el panel (hex o nombre CSS)
    color: Mapped[str | None] = mapped_column(String(20), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Ciudadanos que tienen este tag
    citizen_tags: Mapped[list["CitizenTag"]] = relationship(
        back_populates="tag", lazy="noload"
    )


class CitizenTag(Base):
    """
    Tabla de unión entre ciudadanos y tags.
    Registra cuándo y quién aplicó cada tag.
    """

    __tablename__ = "citizen_tags"
    __table_args__ = (
        UniqueConstraint("citizen_id", "tag_id", name="uq_citizen_tags_citizen_tag"),
    )

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    citizen_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("citizens.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    tag_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("tags.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Usuario del sistema que aplicó el tag (FK opcional)
    assigned_by_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    assigned_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relaciones
    citizen: Mapped["Citizen"] = relationship(  # noqa: F821
        back_populates="citizen_tags", lazy="noload"
    )
    tag: Mapped["Tag"] = relationship(
        back_populates="citizen_tags", lazy="noload"
    )
    assigned_by: Mapped["User"] = relationship(  # noqa: F821
        lazy="noload", foreign_keys=[assigned_by_id]
    )
