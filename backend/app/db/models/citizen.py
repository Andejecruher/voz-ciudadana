"""
Modelo ORM para ciudadanos que interactúan con el bot de WhatsApp.
Incluye campos de lead para gestión de campañas políticas digitales.
"""
import enum
import uuid
from datetime import datetime

from sqlalchemy import ARRAY, Boolean, DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class SourceChannel(str, enum.Enum):
    """Canal de origen por el que se captó el lead."""
    whatsapp = "whatsapp"
    web = "web"
    event = "event"
    referral = "referral"
    other = "other"


class LeadStatus(str, enum.Enum):
    """Estado de madurez del lead en el funnel de campaña."""
    new = "new"
    contacted = "contacted"
    engaged = "engaged"
    converted = "converted"
    unsubscribed = "unsubscribed"


class Citizen(Base):
    """
    Ciudadano registrado a través del bot.
    Se identifica por su número de teléfono de WhatsApp.
    También funciona como lead en el contexto de campaña política.
    """

    __tablename__ = "citizens"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    # Número de WhatsApp en formato E.164, p.ej. +5491112345678
    phone: Mapped[str] = mapped_column(String(30), unique=True, nullable=False, index=True)
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Apellido del ciudadano (campo de lead, aditivo)
    last_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Email de contacto (campo de lead, indexado para búsquedas)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)

    # Canal de captación del lead
    source_channel: Mapped[SourceChannel] = mapped_column(
        Enum(SourceChannel, name="source_channel"),
        nullable=False,
        default=SourceChannel.whatsapp,
        server_default="whatsapp",
    )

    # Estado del lead en el funnel de campaña
    lead_status: Mapped[LeadStatus] = mapped_column(
        Enum(LeadStatus, name="lead_status"),
        nullable=False,
        default=LeadStatus.new,
        server_default="new",
    )

    # Consentimiento explícito de comunicaciones (GDPR / privacidad)
    consent_given: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default="false"
    )
    consent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Barrio como string libre (legacy — se mantiene por compatibilidad)
    neighborhood: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # FK al barrio normalizado (nullable hasta que se complete el backfill)
    neighborhood_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True),
        ForeignKey("neighborhoods.id", ondelete="SET NULL"),
        nullable=True,
    )

    # Lista de intereses declarados por el ciudadano (legacy — se mantiene)
    interests: Mapped[list[str]] = mapped_column(ARRAY(Text), server_default="{}")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relación al barrio normalizado
    neighborhood_ref: Mapped["Neighborhood"] = relationship(  # noqa: F821
        back_populates="citizens", lazy="noload", foreign_keys=[neighborhood_id]
    )

    # Relación 1-N con conversaciones
    conversations: Mapped[list["Conversation"]] = relationship(  # noqa: F821
        back_populates="citizen", lazy="noload"
    )

    # Relación N-M con tags a través de citizen_tags
    citizen_tags: Mapped[list["CitizenTag"]] = relationship(  # noqa: F821
        back_populates="citizen", lazy="noload"
    )
