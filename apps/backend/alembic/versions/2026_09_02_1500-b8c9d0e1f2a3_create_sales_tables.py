"""create_sales_tables

Revision ID: b8c9d0e1f2a3
Revises: f1a2b3c4d5e6
Create Date: 2026-09-02 15:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


# revision identifiers, used by Alembic.
revision: str = 'b8c9d0e1f2a3'
down_revision: Union[str, None] = 'f1a2b3c4d5e6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create sale_status_enum if using PostgreSQL native enum or ensure Enum type definition
    sale_status_enum = postgresql.ENUM(
        'DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED',
        name='sale_status_enum'
    )
    sale_status_enum.create(op.get_bind(), checkfirst=True)

    # 2. Create sales table
    op.create_table(
        'sales',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('order_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'status',
            sa.Enum('DRAFT', 'CONFIRMED', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', name='sale_status_enum', native_enum=False),
            nullable=False,
            server_default='DRAFT'
        ),
        sa.Column('payment_terms', sa.String(length=255), nullable=True),
        sa.Column('payment_method', sa.String(length=100), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('subtotal_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('discount_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('tax_amount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('total_ttc', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('subtotal_ht >= 0', name='chk_sale_subtotal_ht_positive'),
        sa.CheckConstraint('discount_amount >= 0', name='chk_sale_discount_positive'),
        sa.CheckConstraint('tax_amount >= 0', name='chk_sale_tax_amount_positive'),
        sa.CheckConstraint('total_ttc >= 0', name='chk_sale_total_ttc_positive'),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['business_partners.id']),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sales_created_by'), 'sales', ['created_by'], unique=False)
    op.create_index(op.f('ix_sales_customer_id'), 'sales', ['customer_id'], unique=False)
    op.create_index(op.f('ix_sales_reference'), 'sales', ['reference'], unique=True)
    op.create_index(op.f('ix_sales_status'), 'sales', ['status'], unique=False)

    # 3. Create sale_items table
    op.create_table(
        'sale_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('sale_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_price_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='20.00'),
        sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_subtotal_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_discount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_tax', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_total_ttc', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.CheckConstraint('quantity > 0', name='chk_sale_item_quantity_positive'),
        sa.CheckConstraint('unit_price_ht >= 0', name='chk_sale_item_unit_price_positive'),
        sa.CheckConstraint('tax_rate >= 0', name='chk_sale_item_tax_rate_positive'),
        sa.CheckConstraint('discount_rate >= 0', name='chk_sale_item_discount_rate_positive'),
        sa.CheckConstraint('line_subtotal_ht >= 0', name='chk_sale_item_line_subtotal_positive'),
        sa.CheckConstraint('line_discount >= 0', name='chk_sale_item_line_discount_positive'),
        sa.CheckConstraint('line_tax >= 0', name='chk_sale_item_line_tax_positive'),
        sa.CheckConstraint('line_total_ttc >= 0', name='chk_sale_item_line_total_positive'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_sale_items_product_id'), 'sale_items', ['product_id'], unique=False)
    op.create_index(op.f('ix_sale_items_sale_id'), 'sale_items', ['sale_id'], unique=False)


def downgrade() -> None:
    op.drop_table('sale_items')
    op.drop_table('sales')
    op.execute("DROP TYPE IF EXISTS sale_status_enum")
