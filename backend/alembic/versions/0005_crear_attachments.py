"""crear_attachments

Revision ID: 0005
Revises: 0004
Create Date: 2026-04-22

Crea la tabla attachments para metadata de archivos adjuntos.
El archivo físico reside en almacenamiento externo (S3/GCS).
FKs opcionales a messages, citizens y users.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "attachments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("storage_key", sa.String(1024), nullable=False),
        sa.Column("mime_type", sa.String(127), nullable=False),
        sa.Column("file_size_bytes", sa.BigInteger(), nullable=False),
        sa.Column("original_filename", sa.String(512), nullable=True),
        sa.Column("cdn_url", sa.Text(), nullable=True),
        # FK opcional al mensaje que contiene este adjunto
        sa.Column("message_id", postgresql.UUID(as_uuid=True), nullable=True),
        # FK opcional al ciudadano propietario
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=True),
        # FK opcional al usuario que subió el archivo
        sa.Column("uploaded_by", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["message_id"],
            ["messages.id"],
            name="fk_attachments_message_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["citizen_id"],
            ["citizens.id"],
            name="fk_attachments_citizen_id",
            ondelete="SET NULL",
        ),
        sa.ForeignKeyConstraint(
            ["uploaded_by"],
            ["users.id"],
            name="fk_attachments_uploaded_by",
            ondelete="SET NULL",
        ),
    )
    op.create_index("ix_attachments_message_id", "attachments", ["message_id"])
    op.create_index("ix_attachments_citizen_id", "attachments", ["citizen_id"])


def downgrade() -> None:
    op.drop_index("ix_attachments_citizen_id", table_name="attachments")
    op.drop_index("ix_attachments_message_id", table_name="attachments")
    op.drop_table("attachments")
