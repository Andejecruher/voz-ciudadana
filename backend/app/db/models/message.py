"""
Modelo ORM para mensajes individuales dentro de una conversación.
Incluye tipo de mensaje, ID externo (Meta/WhatsApp) y adjunto opcional.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MessageDirection(str, enum.Enum):
    """Indica si el mensaje lo envió el ciudadano o el sistema."""
    inbound = "inbound"   # ciudadano → bot
    outbound = "outbound"  # bot → ciudadano


class MessageType(str, enum.Enum):
    """Tipo de contenido del mensaje."""
    text = "text"
    image = "image"
    audio = "audio"
    video = "video"
    document = "document"
    location = "location"
    template = "template"
    interactive = "interactive"
    system = "system"


class Message(Base):
    """Mensaje individual dentro de una conversación."""

    __tablename__ = "messages"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    direction: Mapped[MessageDirection] = mapped_column(
        Enum(MessageDirection, name="message_direction"),
        nullable=False,
    )

    # Tipo de contenido del mensaje
    message_type: Mapped[MessageType] = mapped_column(
        Enum(MessageType, name="message_type"),
        nullable=False,
        default=MessageType.text,
        server_default="text",
    )

    # ID del mensaje en la plataforma externa (p.ej. wamid de Meta), indexado para dedup
    external_message_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, index=True
    )

    # FK opcional al adjunto asociado al mensaje
    attachment_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("attachments.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Metadata arbitraria: message_id de Meta, tipo de mensaje, etc. (legacy — se mantiene)
    meta: Mapped[dict] = mapped_column(JSONB, server_default="{}", nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    conversation: Mapped["Conversation"] = relationship(  # noqa: F821
        back_populates="messages", lazy="noload"
    )
    attachment: Mapped["Attachment"] = relationship(  # noqa: F821
        lazy="noload", foreign_keys=[attachment_id]
    )
