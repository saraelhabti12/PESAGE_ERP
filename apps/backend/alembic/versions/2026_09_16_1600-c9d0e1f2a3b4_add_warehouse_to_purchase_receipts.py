"""add_warehouse_to_purchase_receipts

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-09-16 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add warehouse_id to purchase_receipts table
    op.add_column('purchase_receipts', sa.Column('warehouse_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_purchase_receipts_warehouse_id',
        'purchase_receipts',
        'warehouses',
        ['warehouse_id'],
        ['id'],
    )
    op.create_index(
        op.f('ix_purchase_receipts_warehouse_id'),
        'purchase_receipts',
        ['warehouse_id'],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index(op.f('ix_purchase_receipts_warehouse_id'), table_name='purchase_receipts')
    op.drop_constraint('fk_purchase_receipts_warehouse_id', 'purchase_receipts', type_='foreignkey')
    op.drop_column('purchase_receipts', 'warehouse_id')
