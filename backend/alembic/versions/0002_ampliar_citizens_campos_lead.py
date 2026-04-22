"""ampliar_citizens_campos_lead

Revision ID: 0002
Revises: 0001
Create Date: 2026-04-22

Agrega campos de lead a la tabla citizens:
  - last_name (nullable)
  - email (nullable, indexado)
  - source_channel (enum: whatsapp, web, event, referral, other)
  - lead_status (enum: new, contacted, engaged, converted, unsubscribed)
  - consent_given (bool, default false)
  - consent_at (nullable, timestamp con tz)
  - neighborhood_id (nullable, FK a neighborhoods — se agrega la FK en 0003)

El campo neighborhood (string legacy) se mantiene intacto.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Nuevos enums ──────────────────────────────────────────────────────────
    source_channel_enum = postgresql.ENUM(
        "whatsapp", "web", "event", "referral", "other",
        name="source_channel",
        create_type=True,
    )
    lead_status_enum = postgresql.ENUM(
        "new", "contacted", "engaged", "converted", "unsubscribed",
        name="lead_status",
        create_type=True,
    )
    source_channel_enum.create(op.get_bind(), checkfirst=True)
    lead_status_enum.create(op.get_bind(), checkfirst=True)

    # ── Nuevas columnas en citizens ───────────────────────────────────────────
    op.add_column(
        "citizens",
        sa.Column("last_name", sa.String(255), nullable=True),
    )
    op.add_column(
        "citizens",
        sa.Column("email", sa.String(255), nullable=True),
    )
    op.add_column(
        "citizens",
        sa.Column(
            "source_channel",
            sa.Enum(
                "whatsapp", "web", "event", "referral", "other",
                name="source_channel",
                create_type=False,
            ),
            nullable=False,
            server_default="whatsapp",
        ),
    )
    op.add_column(
        "citizens",
        sa.Column(
            "lead_status",
            sa.Enum(
                "new", "contacted", "engaged", "converted", "unsubscribed",
                name="lead_status",
                create_type=False,
            ),
            nullable=False,
            server_default="new",
        ),
    )
    op.add_column(
        "citizens",
        sa.Column(
            "consent_given",
            sa.Boolean(),
            nullable=False,
            server_default=sa.text("false"),
        ),
    )
    op.add_column(
        "citizens",
        sa.Column("consent_at", sa.DateTime(timezone=True), nullable=True),
    )
    # Columna neighborhood_id preparada SIN FK aún (se agrega en 0003 junto con la tabla)
    op.add_column(
        "citizens",
        sa.Column(
            "neighborhood_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )

    # ── Índices ───────────────────────────────────────────────────────────────
    op.create_index("ix_citizens_email", "citizens", ["email"], unique=False)
    op.create_index("ix_citizens_neighborhood_id", "citizens", ["neighborhood_id"], unique=False)


def downgrade() -> None:
    op.drop_index("ix_citizens_neighborhood_id", table_name="citizens")
    op.drop_index("ix_citizens_email", table_name="citizens")

    op.drop_column("citizens", "neighborhood_id")
    op.drop_column("citizens", "consent_at")
    op.drop_column("citizens", "consent_given")
    op.drop_column("citizens", "lead_status")
    op.drop_column("citizens", "source_channel")
    op.drop_column("citizens", "email")
    op.drop_column("citizens", "last_name")

    sa.Enum(name="lead_status").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="source_channel").drop(op.get_bind(), checkfirst=True)
