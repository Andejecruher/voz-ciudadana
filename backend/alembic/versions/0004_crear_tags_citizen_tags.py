"""crear_tags_y_citizen_tags

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-22

Crea las tablas tags y citizen_tags para segmentación por etiquetas.
El campo citizens.interests (ARRAY legacy) se mantiene sin modificar.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Tabla tags ────────────────────────────────────────────────────────────
    op.create_table(
        "tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("color", sa.String(20), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.UniqueConstraint("name", name="uq_tags_name"),
    )
    op.create_index("ix_tags_name", "tags", ["name"], unique=True)

    # ── Tabla citizen_tags (unión N-M) ────────────────────────────────────────
    op.create_table(
        "citizen_tags",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("citizen_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("tag_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("assigned_by_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column(
            "assigned_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
        sa.ForeignKeyConstraint(
            ["citizen_id"],
            ["citizens.id"],
            name="fk_citizen_tags_citizen_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["tag_id"],
            ["tags.id"],
            name="fk_citizen_tags_tag_id",
            ondelete="CASCADE",
        ),
        sa.ForeignKeyConstraint(
            ["assigned_by_id"],
            ["users.id"],
            name="fk_citizen_tags_assigned_by_id",
            ondelete="SET NULL",
        ),
        sa.UniqueConstraint("citizen_id", "tag_id", name="uq_citizen_tags_citizen_tag"),
    )
    op.create_index("ix_citizen_tags_citizen_id", "citizen_tags", ["citizen_id"])
    op.create_index("ix_citizen_tags_tag_id", "citizen_tags", ["tag_id"])


def downgrade() -> None:
    op.drop_index("ix_citizen_tags_tag_id", table_name="citizen_tags")
    op.drop_index("ix_citizen_tags_citizen_id", table_name="citizen_tags")
    op.drop_table("citizen_tags")
    op.drop_index("ix_tags_name", table_name="tags")
    op.drop_table("tags")
