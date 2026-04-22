"""
Modelo ORM para archivos adjuntos vinculados a mensajes o ciudadanos.
Almacena metadata del archivo; el contenido real va en almacenamiento externo (S3/GCS).
"""
import uuid
from datetime import datetime

from sqlalchemy import BigInteger, DateTime, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class Attachment(Base):
    """
    Archivo adjunto. Puede estar asociado a un mensaje, a un ciudadano, o a ambos.
    El archivo físico reside en almacenamiento externo; aquí solo se guarda metadata.
    """

    __tablename__ = "attachments"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )

    # Clave en el bucket de almacenamiento externo (S3/GCS key o path)
    storage_key: Mapped[str] = mapped_column(String(1024), nullable=False)

    # MIME type del archivo (p.ej. "image/jpeg", "application/pdf")
    mime_type: Mapped[str] = mapped_column(String(127), nullable=False)

    # Tamaño del archivo en bytes
    file_size_bytes: Mapped[int] = mapped_column(BigInteger, nullable=False)

    # Nombre original del archivo tal como lo subió el usuario
    original_filename: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # URL pública o firmada del CDN para servir el archivo
    cdn_url: Mapped[str | None] = mapped_column(Text, nullable=True)

    # FK opcional al mensaje que contiene este adjunto
    message_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("messages.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # FK opcional al ciudadano propietario del adjunto
    citizen_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("citizens.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # Usuario del sistema que realizó la carga (FK opcional)
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    # Relaciones
    message: Mapped["Message"] = relationship(  # noqa: F821
        lazy="noload", foreign_keys=[message_id]
    )
    citizen: Mapped["Citizen"] = relationship(  # noqa: F821
        lazy="noload", foreign_keys=[citizen_id]
    )
    uploader: Mapped["User"] = relationship(  # noqa: F821
        lazy="noload", foreign_keys=[uploaded_by]
    )
