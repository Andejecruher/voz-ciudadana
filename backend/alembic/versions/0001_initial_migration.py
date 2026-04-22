"""initial_migration

Revision ID: 0001
Revises:
Create Date: 2026-04-22

Crea las tablas iniciales: users, citizens, conversations, messages.
Incluye enums (conversation_status, message_direction), FKs con CASCADE y constraints.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Enums ──────────────────────────────────────────────────────────────────
    conversation_status = postgresql.ENUM(
        "open", "in_progress", "resolved", "closed",
        name="conversation_status",
        create_type=False,
    )
    message_direction = postgresql.ENUM(
        "inbound", "outbound",
        name="message_direction",
        create_type=False,
    )
    conversation_status.create(op.get_bind(), checkfirst=True)
    message_direction.create(op.get_bind(), checkfirst=True)

    # ── users ──────────────────────────────────────────────────────────────────
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("hashed_password", sa.String(255), nullable=False),
        sa.Column("full_name", sa.String(255), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.text("true")),
        sa.Column("is_superuser", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("email", name="uq_users_email"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)

    # ── citizens ───────────────────────────────────────────────────────────────
    op.create_table(
        "citizens",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("phone", sa.String(30), nullable=False),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("neighborhood", sa.String(255), nullable=True),
        sa.Column(
            "interests",
            postgresql.ARRAY(sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("phone", name="uq_citizens_phone"),
    )
    op.create_index("ix_citizens_phone", "citizens", ["phone"], unique=True)

    # ── conversations ──────────────────────────────────────────────────────────
    op.create_table(
        "conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            "status",
            conversation_status,
            nullable=False,
            server_default="open",
        ),
        sa.Column("assigned_dept", sa.String(100), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["citizen_id"],
            ["citizens.id"],
            name="fk_conversations_citizen_id",
            ondelete="CASCADE",
        ),
    )

    # ── messages ───────────────────────────────────────────────────────────────
    op.create_table(
        "messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("conversation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("body", sa.Text(), nullable=False),
        sa.Column(
            "direction",
            message_direction,
            nullable=False,
        ),
        sa.Column(
            "meta",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["conversation_id"],
            ["conversations.id"],
            name="fk_messages_conversation_id",
            ondelete="CASCADE",
        ),
    )


def downgrade() -> None:
    # Drop en orden inverso (dependencias primero)
    op.drop_table("messages")
    op.drop_table("conversations")
    op.drop_index("ix_citizens_phone", table_name="citizens")
    op.drop_table("citizens")
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")

    # Eliminar enums explícitamente
    sa.Enum(name="message_direction").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="conversation_status").drop(op.get_bind(), checkfirst=True)
