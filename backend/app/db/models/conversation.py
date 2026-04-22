"""
Modelo ORM para conversaciones entre ciudadanos y el sistema.
Incluye canal de contacto y usuario asignado para gestión omnicanal.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, String, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ConversationStatus(str, enum.Enum):
    """Estados posibles de una conversación."""
    open = "open"
    in_progress = "in_progress"
    resolved = "resolved"
    closed = "closed"


class ConversationChannel(str, enum.Enum):
    """Canal por el que se inició la conversación."""
    whatsapp = "whatsapp"
    web_chat = "web_chat"
    email = "email"
    sms = "sms"
    other = "other"


class Conversation(Base):
    """Agrupador de mensajes de un ciudadano en una sesión de atención."""

    __tablename__ = "conversations"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    citizen_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("citizens.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[ConversationStatus] = mapped_column(
        Enum(ConversationStatus, name="conversation_status"),
        default=ConversationStatus.open,
        nullable=False,
    )

    # Canal de comunicación utilizado en la conversación
    channel: Mapped[ConversationChannel] = mapped_column(
        Enum(ConversationChannel, name="conversation_channel"),
        nullable=False,
        default=ConversationChannel.whatsapp,
        server_default="whatsapp",
    )

    # Área o departamento municipal asignado (legacy — se mantiene por compatibilidad)
    assigned_dept: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Usuario del sistema asignado para atender la conversación
    assigned_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    citizen: Mapped["Citizen"] = relationship(  # noqa: F821
        back_populates="conversations", lazy="noload"
    )
    messages: Mapped[list["Message"]] = relationship(  # noqa: F821
        back_populates="conversation", lazy="noload"
    )
    assigned_user: Mapped["User"] = relationship(  # noqa: F821
        lazy="noload", foreign_keys=[assigned_user_id]
    )
