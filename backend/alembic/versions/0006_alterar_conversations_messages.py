"""alterar_conversations_y_messages

Revision ID: 0006
Revises: 0005
Create Date: 2026-04-22

Altera conversations:
  - Agrega channel (enum: whatsapp, web_chat, email, sms, other)
  - Agrega assigned_user_id FK a users (nullable)

Altera messages:
  - Agrega message_type (enum: text, image, audio, video, document, location, template, interactive, system)
  - Agrega external_message_id (String indexado, para dedup con plataformas externas)
  - Agrega attachment_id FK opcional a attachments

El campo conversations.assigned_dept y messages.meta se mantienen por compatibilidad.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Nuevos enums ──────────────────────────────────────────────────────────
    conversation_channel_enum = postgresql.ENUM(
        "whatsapp", "web_chat", "email", "sms", "other",
        name="conversation_channel",
        create_type=True,
    )
    message_type_enum = postgresql.ENUM(
        "text", "image", "audio", "video", "document",
        "location", "template", "interactive", "system",
        name="message_type",
        create_type=True,
    )
    conversation_channel_enum.create(op.get_bind(), checkfirst=True)
    message_type_enum.create(op.get_bind(), checkfirst=True)

    # ── Alteraciones en conversations ─────────────────────────────────────────
    op.add_column(
        "conversations",
        sa.Column(
            "channel",
            sa.Enum(
                "whatsapp", "web_chat", "email", "sms", "other",
                name="conversation_channel",
                create_type=False,
            ),
            nullable=False,
            server_default="whatsapp",
        ),
    )
    op.add_column(
        "conversations",
        sa.Column(
            "assigned_user_id",
            postgresql.UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        "fk_conversations_assigned_user_id",
        "conversations",
        "users",
        ["assigned_user_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_conversations_assigned_user_id",
        "conversations",
        ["assigned_user_id"],
    )

    # ── Alteraciones en messages ───────────────────────────────────────────────
    op.add_column(
        "messages",
        sa.Column(
            "message_type",
            sa.Enum(
                "text", "image", "audio", "video", "document",
                "location", "template", "interactive", "system",
                name="message_type",
                create_type=False,
            ),
            nullable=False,
            server_default="text",
        ),
    )
    op.add_column(
        "messages",
        sa.Column("external_message_id", sa.String(255), nullable=True),
    )
    op.add_column(
        "messages",
        sa.Column("attachment_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        "ix_messages_external_message_id",
        "messages",
        ["external_message_id"],
    )
    op.create_foreign_key(
        "fk_messages_attachment_id",
        "messages",
        "attachments",
        ["attachment_id"],
        ["id"],
        ondelete="SET NULL",
    )


def downgrade() -> None:
    # messages
    op.drop_constraint("fk_messages_attachment_id", "messages", type_="foreignkey")
    op.drop_index("ix_messages_external_message_id", table_name="messages")
    op.drop_column("messages", "attachment_id")
    op.drop_column("messages", "external_message_id")
    op.drop_column("messages", "message_type")

    # conversations
    op.drop_index("ix_conversations_assigned_user_id", table_name="conversations")
    op.drop_constraint("fk_conversations_assigned_user_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "assigned_user_id")
    op.drop_column("conversations", "channel")

    # enums
    sa.Enum(name="message_type").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="conversation_channel").drop(op.get_bind(), checkfirst=True)
