"""create_commercial_cycle_tables

Revision ID: f2a3b4c5d6e7
Revises: e1f2a3b4c5d6
Create Date: 2026-09-18 20:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'f2a3b4c5d6e7'
down_revision: Union[str, None] = 'e1f2a3b4c5d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Quotes Table
    op.create_table(
        'quotes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('quote_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('valid_until', sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            'status',
            sa.Enum('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED', name='quote_status_enum', native_enum=False),
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
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('subtotal_ht >= 0', name='chk_quote_subtotal_ht_positive'),
        sa.CheckConstraint('discount_amount >= 0', name='chk_quote_discount_positive'),
        sa.CheckConstraint('tax_amount >= 0', name='chk_quote_tax_amount_positive'),
        sa.CheckConstraint('total_ttc >= 0', name='chk_quote_total_ttc_positive'),
        sa.ForeignKeyConstraint(['customer_id'], ['business_partners.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_quotes_reference'), 'quotes', ['reference'], unique=True)
    op.create_index(op.f('ix_quotes_customer_id'), 'quotes', ['customer_id'], unique=False)
    op.create_index(op.f('ix_quotes_status'), 'quotes', ['status'], unique=False)
    op.create_index(op.f('ix_quotes_created_by'), 'quotes', ['created_by'], unique=False)

    # 2. Quote Items Table
    op.create_table(
        'quote_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('quote_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_price_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='20.00'),
        sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_subtotal_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_discount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_tax', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_total_ttc', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_quote_item_quantity_positive'),
        sa.CheckConstraint('unit_price_ht >= 0', name='chk_quote_item_unit_price_positive'),
        sa.CheckConstraint('tax_rate >= 0', name='chk_quote_item_tax_rate_positive'),
        sa.CheckConstraint('discount_rate >= 0', name='chk_quote_item_discount_rate_positive'),
        sa.CheckConstraint('line_subtotal_ht >= 0', name='chk_quote_item_line_subtotal_positive'),
        sa.CheckConstraint('line_discount >= 0', name='chk_quote_item_line_discount_positive'),
        sa.CheckConstraint('line_tax >= 0', name='chk_quote_item_line_tax_positive'),
        sa.CheckConstraint('line_total_ttc >= 0', name='chk_quote_item_line_total_positive'),
        sa.ForeignKeyConstraint(['quote_id'], ['quotes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_quote_items_quote_id'), 'quote_items', ['quote_id'], unique=False)
    op.create_index(op.f('ix_quote_items_product_id'), 'quote_items', ['product_id'], unique=False)

    # 3. Add quote_id to sales table
    op.add_column('sales', sa.Column('quote_id', sa.Integer(), nullable=True))
    op.create_foreign_key(
        'fk_sales_quote_id_quotes',
        'sales',
        'quotes',
        ['quote_id'],
        ['id'],
    )
    op.create_index(
        op.f('ix_sales_quote_id'),
        'sales',
        ['quote_id'],
        unique=False,
    )

    # 4. Delivery Notes Table
    op.create_table(
        'delivery_notes',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('sale_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('delivery_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('delivery_address', sa.String(length=255), nullable=True),
        sa.Column(
            'status',
            sa.Enum('DRAFT', 'PARTIALLY_DELIVERED', 'DELIVERED', 'CANCELLED', name='delivery_note_status_enum', native_enum=False),
            nullable=False,
            server_default='DRAFT'
        ),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id']),
        sa.ForeignKeyConstraint(['customer_id'], ['business_partners.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_delivery_notes_reference'), 'delivery_notes', ['reference'], unique=True)
    op.create_index(op.f('ix_delivery_notes_sale_id'), 'delivery_notes', ['sale_id'], unique=False)
    op.create_index(op.f('ix_delivery_notes_customer_id'), 'delivery_notes', ['customer_id'], unique=False)
    op.create_index(op.f('ix_delivery_notes_status'), 'delivery_notes', ['status'], unique=False)
    op.create_index(op.f('ix_delivery_notes_created_by'), 'delivery_notes', ['created_by'], unique=False)

    # 5. Delivery Note Items Table
    op.create_table(
        'delivery_note_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('delivery_note_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=False),
        sa.Column('warehouse_id', sa.Integer(), nullable=True),
        sa.Column('ordered_quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('delivered_quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('remaining_quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('ordered_quantity >= 0', name='chk_dn_item_ordered_qty_positive'),
        sa.CheckConstraint('delivered_quantity > 0', name='chk_dn_item_delivered_qty_positive'),
        sa.CheckConstraint('remaining_quantity >= 0', name='chk_dn_item_remaining_qty_positive'),
        sa.ForeignKeyConstraint(['delivery_note_id'], ['delivery_notes.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.ForeignKeyConstraint(['warehouse_id'], ['warehouses.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_delivery_note_items_delivery_note_id'), 'delivery_note_items', ['delivery_note_id'], unique=False)
    op.create_index(op.f('ix_delivery_note_items_product_id'), 'delivery_note_items', ['product_id'], unique=False)
    op.create_index(op.f('ix_delivery_note_items_warehouse_id'), 'delivery_note_items', ['warehouse_id'], unique=False)

    # 6. Invoices Table
    op.create_table(
        'invoices',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('sale_id', sa.Integer(), nullable=True),
        sa.Column('invoice_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('due_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            'status',
            sa.Enum('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'CANCELLED', name='invoice_status_enum', native_enum=False),
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
        sa.Column('amount_paid', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('amount_due', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('subtotal_ht >= 0', name='chk_invoice_subtotal_ht_positive'),
        sa.CheckConstraint('discount_amount >= 0', name='chk_invoice_discount_positive'),
        sa.CheckConstraint('tax_amount >= 0', name='chk_invoice_tax_amount_positive'),
        sa.CheckConstraint('total_ttc >= 0', name='chk_invoice_total_ttc_positive'),
        sa.CheckConstraint('amount_paid >= 0', name='chk_invoice_amount_paid_positive'),
        sa.CheckConstraint('amount_due >= 0', name='chk_invoice_amount_due_positive'),
        sa.ForeignKeyConstraint(['customer_id'], ['business_partners.id']),
        sa.ForeignKeyConstraint(['sale_id'], ['sales.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_invoices_reference'), 'invoices', ['reference'], unique=True)
    op.create_index(op.f('ix_invoices_customer_id'), 'invoices', ['customer_id'], unique=False)
    op.create_index(op.f('ix_invoices_sale_id'), 'invoices', ['sale_id'], unique=False)
    op.create_index(op.f('ix_invoices_status'), 'invoices', ['status'], unique=False)
    op.create_index(op.f('ix_invoices_created_by'), 'invoices', ['created_by'], unique=False)

    # 7. Invoice Items Table
    op.create_table(
        'invoice_items',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('product_id', sa.Integer(), nullable=True),
        sa.Column('description', sa.String(length=255), nullable=False),
        sa.Column('quantity', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('unit_price_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('tax_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='20.00'),
        sa.Column('discount_rate', sa.Numeric(precision=5, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_subtotal_ht', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_discount', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_tax', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('line_total_ttc', sa.Numeric(precision=12, scale=2), nullable=False, server_default='0.00'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('quantity > 0', name='chk_invoice_item_quantity_positive'),
        sa.CheckConstraint('unit_price_ht >= 0', name='chk_invoice_item_unit_price_positive'),
        sa.CheckConstraint('tax_rate >= 0', name='chk_invoice_item_tax_rate_positive'),
        sa.CheckConstraint('discount_rate >= 0', name='chk_invoice_item_discount_rate_positive'),
        sa.CheckConstraint('line_subtotal_ht >= 0', name='chk_invoice_item_line_subtotal_positive'),
        sa.CheckConstraint('line_discount >= 0', name='chk_invoice_item_line_discount_positive'),
        sa.CheckConstraint('line_tax >= 0', name='chk_invoice_item_line_tax_positive'),
        sa.CheckConstraint('line_total_ttc >= 0', name='chk_invoice_item_line_total_positive'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['product_id'], ['products.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_invoice_items_invoice_id'), 'invoice_items', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_invoice_items_product_id'), 'invoice_items', ['product_id'], unique=False)

    # 8. Payments Table
    op.create_table(
        'payments',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('reference', sa.String(length=100), nullable=False),
        sa.Column('invoice_id', sa.Integer(), nullable=False),
        sa.Column('customer_id', sa.Integer(), nullable=False),
        sa.Column('payment_date', sa.DateTime(timezone=True), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('payment_method', sa.String(length=100), nullable=False),
        sa.Column('transaction_reference', sa.String(length=150), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint('amount > 0', name='chk_payment_amount_positive'),
        sa.ForeignKeyConstraint(['invoice_id'], ['invoices.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['customer_id'], ['business_partners.id']),
        sa.ForeignKeyConstraint(['created_by'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_payments_reference'), 'payments', ['reference'], unique=True)
    op.create_index(op.f('ix_payments_invoice_id'), 'payments', ['invoice_id'], unique=False)
    op.create_index(op.f('ix_payments_customer_id'), 'payments', ['customer_id'], unique=False)
    op.create_index(op.f('ix_payments_created_by'), 'payments', ['created_by'], unique=False)


def downgrade() -> None:
    # 8. Payments
    op.drop_index(op.f('ix_payments_created_by'), table_name='payments')
    op.drop_index(op.f('ix_payments_customer_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_invoice_id'), table_name='payments')
    op.drop_index(op.f('ix_payments_reference'), table_name='payments')
    op.drop_table('payments')

    # 7. Invoice Items
    op.drop_index(op.f('ix_invoice_items_product_id'), table_name='invoice_items')
    op.drop_index(op.f('ix_invoice_items_invoice_id'), table_name='invoice_items')
    op.drop_table('invoice_items')

    # 6. Invoices
    op.drop_index(op.f('ix_invoices_created_by'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_status'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_sale_id'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_customer_id'), table_name='invoices')
    op.drop_index(op.f('ix_invoices_reference'), table_name='invoices')
    op.drop_table('invoices')

    # 5. Delivery Note Items
    op.drop_index(op.f('ix_delivery_note_items_warehouse_id'), table_name='delivery_note_items')
    op.drop_index(op.f('ix_delivery_note_items_product_id'), table_name='delivery_note_items')
    op.drop_index(op.f('ix_delivery_note_items_delivery_note_id'), table_name='delivery_note_items')
    op.drop_table('delivery_note_items')

    # 4. Delivery Notes
    op.drop_index(op.f('ix_delivery_notes_created_by'), table_name='delivery_notes')
    op.drop_index(op.f('ix_delivery_notes_status'), table_name='delivery_notes')
    op.drop_index(op.f('ix_delivery_notes_customer_id'), table_name='delivery_notes')
    op.drop_index(op.f('ix_delivery_notes_sale_id'), table_name='delivery_notes')
    op.drop_index(op.f('ix_delivery_notes_reference'), table_name='delivery_notes')
    op.drop_table('delivery_notes')

    # 3. Drop sales.quote_id
    op.drop_index(op.f('ix_sales_quote_id'), table_name='sales')
    op.drop_constraint('fk_sales_quote_id_quotes', 'sales', type_='foreignkey')
    op.drop_column('sales', 'quote_id')

    # 2. Quote Items
    op.drop_index(op.f('ix_quote_items_product_id'), table_name='quote_items')
    op.drop_index(op.f('ix_quote_items_quote_id'), table_name='quote_items')
    op.drop_table('quote_items')

    # 1. Quotes
    op.drop_index(op.f('ix_quotes_created_by'), table_name='quotes')
    op.drop_index(op.f('ix_quotes_status'), table_name='quotes')
    op.drop_index(op.f('ix_quotes_customer_id'), table_name='quotes')
    op.drop_index(op.f('ix_quotes_reference'), table_name='quotes')
    op.drop_table('quotes')
