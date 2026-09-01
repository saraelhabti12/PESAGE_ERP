"""create stock and warehouse tables

Revision ID: f1a2b3c4d5e6
Revises: c4e8f1b2a9d0
Create Date: 2026-08-30 18:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'c4e8f1b2a9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create Enums if native enum is needed or use VARCHAR
    warehouse_type_enum = postgresql.ENUM('MAIN', 'WAREHOUSE', 'WORKSHOP', 'VEHICLE', 'OTHER', name='warehouse_type_enum')
    warehouse_type_enum.create(op.get_bind(), checkfirst=True)

    stock_movement_type_enum = postgresql.ENUM(
        'PURCHASE_RECEIPT', 'SALE', 'RETURN_IN', 'RETURN_OUT',
        'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT',
        'MANUAL_IN', 'MANUAL_OUT',
        name='stock_movement_type_enum'
    )
    stock_movement_type_enum.create(op.get_bind(), checkfirst=True)

    stock_reservation_status_enum = postgresql.ENUM('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED', name='stock_reservation_status_enum')
    stock_reservation_status_enum.create(op.get_bind(), checkfirst=True)

    inventory_session_status_enum = postgresql.ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='inventory_session_status_enum')
    inventory_session_status_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create warehouses table
    op.create_table(
        'warehouses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('name', sa.String(length=255), nullable=False),
        sa.Column('type', sa.Enum('MAIN', 'WAREHOUSE', 'WORKSHOP', 'VEHICLE', 'OTHER', name='warehouse_type_enum', native_enum=False), nullable=False, server_default='MAIN'),
        sa.Column('address', sa.Text(), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_warehouses_code'), 'warehouses', ['code'], unique=True)
    op.create_index(op.f('ix_warehouses_name'), 'warehouses', ['name'], unique=False)
    op.create_index(op.f('ix_warehouses_is_active'), 'warehouses', ['is_active'], unique=False)

    # 3. Create stock_balances table
    op.create_table(
        'stock_balances',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('reserved_quantity', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('minimum_quantity', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('maximum_quantity', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('product_id', 'warehouse_id', name='uq_stock_balance_product_warehouse'),
        sa.CheckConstraint('quantity >= 0', name='chk_stock_balance_qty_positive'),
        sa.CheckConstraint('reserved_quantity >= 0', name='chk_stock_balance_reserved_positive'),
        sa.CheckConstraint('reserved_quantity <= quantity', name='chk_stock_balance_reserved_le_qty'),
        sa.CheckConstraint('minimum_quantity >= 0', name='chk_stock_balance_min_positive'),
    )
    op.create_index(op.f('ix_stock_balances_product_id'), 'stock_balances', ['product_id'], unique=False)
    op.create_index(op.f('ix_stock_balances_warehouse_id'), 'stock_balances', ['warehouse_id'], unique=False)

    # 4. Create stock_movements table
    op.create_table(
        'stock_movements',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False),
        sa.Column('movement_type', sa.Enum('PURCHASE_RECEIPT', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'MANUAL_IN', 'MANUAL_OUT', name='stock_movement_type_enum', native_enum=False), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_stock_movements_created_at'), 'stock_movements', ['created_at'], unique=False)
    op.create_index(op.f('ix_stock_movements_created_by'), 'stock_movements', ['created_by'], unique=False)
    op.create_index(op.f('ix_stock_movements_movement_type'), 'stock_movements', ['movement_type'], unique=False)
    op.create_index(op.f('ix_stock_movements_product_id'), 'stock_movements', ['product_id'], unique=False)
    op.create_index(op.f('ix_stock_movements_reference_id'), 'stock_movements', ['reference_id'], unique=False)
    op.create_index(op.f('ix_stock_movements_reference_type'), 'stock_movements', ['reference_type'], unique=False)
    op.create_index(op.f('ix_stock_movements_warehouse_id'), 'stock_movements', ['warehouse_id'], unique=False)

    # 5. Create stock_reservations table
    op.create_table(
        'stock_reservations',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('reference_type', sa.String(length=50), nullable=True),
        sa.Column('reference_id', sa.Integer(), nullable=True),
        sa.Column('status', sa.Enum('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED', name='stock_reservation_status_enum', native_enum=False), nullable=False, server_default='ACTIVE'),
        sa.Column('reserved_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('released_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['reserved_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.CheckConstraint('quantity > 0', name='chk_stock_reservation_qty_gt_zero'),
    )
    op.create_index(op.f('ix_stock_reservations_product_id'), 'stock_reservations', ['product_id'], unique=False)
    op.create_index(op.f('ix_stock_reservations_reference_id'), 'stock_reservations', ['reference_id'], unique=False)
    op.create_index(op.f('ix_stock_reservations_reference_type'), 'stock_reservations', ['reference_type'], unique=False)
    op.create_index(op.f('ix_stock_reservations_reserved_by'), 'stock_reservations', ['reserved_by'], unique=False)
    op.create_index(op.f('ix_stock_reservations_status'), 'stock_reservations', ['status'], unique=False)
    op.create_index(op.f('ix_stock_reservations_warehouse_id'), 'stock_reservations', ['warehouse_id'], unique=False)

    # 6. Create inventory_sessions table
    op.create_table(
        'inventory_sessions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='inventory_session_status_enum', native_enum=False), nullable=False, server_default='DRAFT'),
        sa.Column('started_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('validated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('validated_by', sa.Integer(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['validated_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_inventory_sessions_created_by'), 'inventory_sessions', ['created_by'], unique=False)
    op.create_index(op.f('ix_inventory_sessions_reference'), 'inventory_sessions', ['reference'], unique=True)
    op.create_index(op.f('ix_inventory_sessions_status'), 'inventory_sessions', ['status'], unique=False)
    op.create_index(op.f('ix_inventory_sessions_validated_by'), 'inventory_sessions', ['validated_by'], unique=False)
    op.create_index(op.f('ix_inventory_sessions_warehouse_id'), 'inventory_sessions', ['warehouse_id'], unique=False)

    # 7. Create inventory_items table
    op.create_table(
        'inventory_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('inventory_session_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('system_quantity', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('counted_quantity', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('difference', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('reason', sa.Text(), nullable=True),
        sa.ForeignKeyConstraint(['inventory_session_id'], ['inventory_sessions.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('inventory_session_id', 'product_id', name='uq_inventory_session_product'),
    )
    op.create_index(op.f('ix_inventory_items_inventory_session_id'), 'inventory_items', ['inventory_session_id'], unique=False)
    op.create_index(op.f('ix_inventory_items_product_id'), 'inventory_items', ['product_id'], unique=False)

    # 8. Add warehouse_id to purchase_receipt_items
    op.add_column('purchase_receipt_items', sa.Column('warehouse_id', sa.Integer(), nullable=True))
    op.create_foreign_key('fk_purchase_receipt_items_warehouse_id', 'purchase_receipt_items', 'warehouses', ['warehouse_id'], ['id'])
    op.create_index(op.f('ix_purchase_receipt_items_warehouse_id'), 'purchase_receipt_items', ['warehouse_id'], unique=False)


def downgrade() -> None:
    # Drop FK from purchase_receipt_items
    op.drop_index(op.f('ix_purchase_receipt_items_warehouse_id'), table_name='purchase_receipt_items')
    op.drop_constraint('fk_purchase_receipt_items_warehouse_id', 'purchase_receipt_items', type_='foreignkey')
    op.drop_column('purchase_receipt_items', 'warehouse_id')

    # Drop inventory_items
    op.drop_index(op.f('ix_inventory_items_product_id'), table_name='inventory_items')
    op.drop_index(op.f('ix_inventory_items_inventory_session_id'), table_name='inventory_items')
    op.drop_table('inventory_items')

    # Drop inventory_sessions
    op.drop_index(op.f('ix_inventory_sessions_warehouse_id'), table_name='inventory_sessions')
    op.drop_index(op.f('ix_inventory_sessions_validated_by'), table_name='inventory_sessions')
    op.drop_index(op.f('ix_inventory_sessions_status'), table_name='inventory_sessions')
    op.drop_index(op.f('ix_inventory_sessions_reference'), table_name='inventory_sessions')
    op.drop_index(op.f('ix_inventory_sessions_created_by'), table_name='inventory_sessions')
    op.drop_table('inventory_sessions')

    # Drop stock_reservations
    op.drop_index(op.f('ix_stock_reservations_warehouse_id'), table_name='stock_reservations')
    op.drop_index(op.f('ix_stock_reservations_status'), table_name='stock_reservations')
    op.drop_index(op.f('ix_stock_reservations_reserved_by'), table_name='stock_reservations')
    op.drop_index(op.f('ix_stock_reservations_reference_type'), table_name='stock_reservations')
    op.drop_index(op.f('ix_stock_reservations_reference_id'), table_name='stock_reservations')
    op.drop_index(op.f('ix_stock_reservations_product_id'), table_name='stock_reservations')
    op.drop_table('stock_reservations')

    # Drop stock_movements
    op.drop_index(op.f('ix_stock_movements_warehouse_id'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_reference_type'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_reference_id'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_product_id'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_movement_type'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_created_by'), table_name='stock_movements')
    op.drop_index(op.f('ix_stock_movements_created_at'), table_name='stock_movements')
    op.drop_table('stock_movements')

    # Drop stock_balances
    op.drop_index(op.f('ix_stock_balances_warehouse_id'), table_name='stock_balances')
    op.drop_index(op.f('ix_stock_balances_product_id'), table_name='stock_balances')
    op.drop_table('stock_balances')

    # Drop warehouses
    op.drop_index(op.f('ix_warehouses_is_active'), table_name='warehouses')
    op.drop_index(op.f('ix_warehouses_name'), table_name='warehouses')
    op.drop_index(op.f('ix_warehouses_code'), table_name='warehouses')
    op.drop_table('warehouses')

    # Drop enums
    postgresql.ENUM('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', name='inventory_session_status_enum').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM('ACTIVE', 'RELEASED', 'CONSUMED', 'CANCELLED', name='stock_reservation_status_enum').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM('PURCHASE_RECEIPT', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'MANUAL_IN', 'MANUAL_OUT', name='stock_movement_type_enum').drop(op.get_bind(), checkfirst=True)
    postgresql.ENUM('MAIN', 'WAREHOUSE', 'WORKSHOP', 'VEHICLE', 'OTHER', name='warehouse_type_enum').drop(op.get_bind(), checkfirst=True)
