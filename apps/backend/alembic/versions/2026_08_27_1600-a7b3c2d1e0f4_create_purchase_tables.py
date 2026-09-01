"""create_purchase_tables

Revision ID: a7b3c2d1e0f4
Revises: e5a912f831b1
Create Date: 2026-08-27 16:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a7b3c2d1e0f4'
down_revision: Union[str, None] = 'e5a912f831b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create purchase_orders table
    op.create_table(
        'purchase_orders',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('supplier_id', sa.Integer(), nullable=False),
        sa.Column('order_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('expected_date', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.Enum('DRAFT', 'PENDING', 'APPROVED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED', name='purchase_order_status_enum', native_enum=False), nullable=False),
        sa.Column('payment_terms', sa.String(length=255), nullable=True),
        sa.Column('payment_method', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('subtotal_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('tax_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('total_ttc', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['created_by'], ['users.id'], ),
        sa.ForeignKeyConstraint(['supplier_id'], ['business_partners.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_orders_created_by'), 'purchase_orders', ['created_by'], unique=False)
    op.create_index(op.f('ix_purchase_orders_reference'), 'purchase_orders', ['reference'], unique=True)
    op.create_index(op.f('ix_purchase_orders_status'), 'purchase_orders', ['status'], unique=False)
    op.create_index(op.f('ix_purchase_orders_supplier_id'), 'purchase_orders', ['supplier_id'], unique=False)

    # 2. Create purchase_order_items table
    op.create_table(
        'purchase_order_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('purchase_order_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity_ordered', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_price_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='20.00'),
        sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_subtotal_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_tax', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_total_ttc', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('quantity_received', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('quantity_remaining', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_order_items_product_id'), 'purchase_order_items', ['product_id'], unique=False)
    op.create_index(op.f('ix_purchase_order_items_purchase_order_id'), 'purchase_order_items', ['purchase_order_id'], unique=False)

    # 3. Create purchase_receipts table
    op.create_table(
        'purchase_receipts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('purchase_order_id', sa.Integer(), nullable=False),
        sa.Column('receipt_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('status', sa.Enum('DRAFT', 'CONFIRMED', 'CANCELLED', name='purchase_receipt_status_enum', native_enum=False), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('received_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['purchase_order_id'], ['purchase_orders.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['received_by'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_receipts_purchase_order_id'), 'purchase_receipts', ['purchase_order_id'], unique=False)
    op.create_index(op.f('ix_purchase_receipts_received_by'), 'purchase_receipts', ['received_by'], unique=False)
    op.create_index(op.f('ix_purchase_receipts_reference'), 'purchase_receipts', ['reference'], unique=True)
    op.create_index(op.f('ix_purchase_receipts_status'), 'purchase_receipts', ['status'], unique=False)

    # 4. Create purchase_receipt_items table
    op.create_table(
        'purchase_receipt_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('purchase_receipt_id', sa.Integer(), nullable=False),
        sa.Column('purchase_order_item_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity_received', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['product_id'], ['products.id'], ),
        sa.ForeignKeyConstraint(['purchase_order_item_id'], ['purchase_order_items.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['purchase_receipt_id'], ['purchase_receipts.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_purchase_receipt_items_product_id'), 'purchase_receipt_items', ['product_id'], unique=False)
    op.create_index(op.f('ix_purchase_receipt_items_purchase_order_item_id'), 'purchase_receipt_items', ['purchase_order_item_id'], unique=False)
    op.create_index(op.f('ix_purchase_receipt_items_purchase_receipt_id'), 'purchase_receipt_items', ['purchase_receipt_id'], unique=False)


def downgrade() -> None:
    op.drop_table('purchase_receipt_items')
    op.drop_table('purchase_receipts')
    op.drop_table('purchase_order_items')
    op.drop_table('purchase_orders')
