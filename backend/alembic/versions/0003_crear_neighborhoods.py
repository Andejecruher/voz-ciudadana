"""crear_neighborhoods_y_fk_citizen

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-22

Crea la tabla neighborhoods con constraints e índices.
Agrega la FK desde citizens.neighborhood_id → neighborhoods.id.

Incluye script de backfill SQLAlchemy que:
  1. Extrae valores distintos de citizens.neighborhood (insensible a mayúsculas).
  2. Inserta registros en neighborhoods.
  3. Vincula citizens.neighborhood_id cuando hay match exacto-insensible.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── Tabla neighborhoods ───────────────────────────────────────────────────
    op.create_table(
        "neighborhoods",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("name_lower", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("zone", sa.String(100), nullable=True),
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
        sa.UniqueConstraint("name", name="uq_neighborhoods_name"),
    )
    op.create_index("ix_neighborhoods_name", "neighborhoods", ["name"], unique=True)
    op.create_index("ix_neighborhoods_name_lower", "neighborhoods", ["name_lower"])
    op.create_index("ix_neighborhoods_zone", "neighborhoods", ["zone"])

    # ── FK citizens.neighborhood_id → neighborhoods.id ────────────────────────
    op.create_foreign_key(
        "fk_citizens_neighborhood_id",
        "citizens",
        "neighborhoods",
        ["neighborhood_id"],
        ["id"],
        ondelete="SET NULL",
    )

    # ── Backfill: poblar neighborhoods desde citizens.neighborhood ────────────
    # Usamos SQL directo para mayor portabilidad en el contexto de migración.
    conn = op.get_bind()

    # 1. Obtener barrios distintos no nulos desde citizens
    result = conn.execute(
        sa.text(
            "SELECT DISTINCT TRIM(neighborhood) AS neighborhood "
            "FROM citizens "
            "WHERE neighborhood IS NOT NULL AND TRIM(neighborhood) != ''"
        )
    )
    raw_neighborhoods = [row[0] for row in result.fetchall()]

    if raw_neighborhoods:
        # 2. Insertar en neighborhoods (ignorar duplicados)
        for name in raw_neighborhoods:
            conn.execute(
                sa.text(
                    "INSERT INTO neighborhoods (id, name, name_lower, created_at, updated_at) "
                    "VALUES (gen_random_uuid(), :name, :name_lower, now(), now()) "
                    "ON CONFLICT (name) DO NOTHING"
                ),
                {"name": name, "name_lower": name.lower()},
            )

        # 3. Vincular citizens.neighborhood_id con match insensible a mayúsculas
        conn.execute(
            sa.text(
                "UPDATE citizens c "
                "SET neighborhood_id = n.id "
                "FROM neighborhoods n "
                "WHERE LOWER(TRIM(c.neighborhood)) = n.name_lower "
                "  AND c.neighborhood IS NOT NULL "
                "  AND c.neighborhood_id IS NULL"
            )
        )


def downgrade() -> None:
    # Limpiar FKs y tabla en orden inverso
    op.drop_constraint("fk_citizens_neighborhood_id", "citizens", type_="foreignkey")
    op.drop_index("ix_neighborhoods_zone", table_name="neighborhoods")
    op.drop_index("ix_neighborhoods_name_lower", table_name="neighborhoods")
    op.drop_index("ix_neighborhoods_name", table_name="neighborhoods")
    op.drop_table("neighborhoods")
