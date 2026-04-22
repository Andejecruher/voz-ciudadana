"""
Modelo ORM para barrios/localidades normalizados.
Permite segmentación geográfica de ciudadanos y leads.
"""
import uuid
from datetime import datetime

from sqlalchemy import DateTime, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Neighborhood(Base):
    """
    Barrio o localidad normalizado.
    Se usa para segmentar ciudadanos geográficamente en la campaña.
    """

    __tablename__ = "neighborhoods"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Nombre oficial del barrio (único, case-sensitive en DB, normalizado en app)
    name: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    # Nombre en minúsculas para búsqueda insensible a mayúsculas
    name_lower: Mapped[str] = mapped_column(String(255), nullable=False, index=True)

    # Descripción o notas adicionales del barrio (opcional)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Zona o región geográfica más amplia (opcional, p.ej. "Norte", "Sur")
    zone: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Ciudadanos que pertenecen a este barrio (relación inversa)
    citizens: Mapped[list["Citizen"]] = relationship(  # noqa: F821
        back_populates="neighborhood_ref",
        foreign_keys="Citizen.neighborhood_id",
        lazy="noload",
    )
