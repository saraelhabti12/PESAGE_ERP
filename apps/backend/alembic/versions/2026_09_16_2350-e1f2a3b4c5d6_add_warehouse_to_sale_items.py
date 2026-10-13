"""add_warehouse_to_sale_items

Revision ID: e1f2a3b4c5d6
Revises: c9d0e1f2a3b4
Create Date: 2026-09-16 23:50:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = 'c9d0e1f2a3b4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add warehouse_id to sale_items table
    op.add_column('sale_items', sa.Column('warehouse_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_sale_items_warehouse_id_warehouses',
        'sale_items',
        'warehouses',
        ['warehouse_id'],
        ['id'],
    )
    op.create_index(
        op.f('ix_sale_items_warehouse_id'),
        'sale_items',
        ['warehouse_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_sale_items_warehouse_id'), table_name='sale_items')
    op.drop_constraint('fk_sale_items_warehouse_id_warehouses', 'sale_items', type_='foreignkey')
    op.drop_column('sale_items', 'warehouse_id')
