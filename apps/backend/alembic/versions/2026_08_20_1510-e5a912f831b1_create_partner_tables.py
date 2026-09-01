"""create_partner_tables

Revision ID: e5a912f831b1
Revises: d8bf43aa50f8
Create Date: 2026-08-20 15:10:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e5a912f831b1'
down_revision: Union[str, None] = 'd8bf43aa50f8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create business_partners table
    op.create_table(
        'business_partners',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('code', sa.String(length=50), nullable=False),
        sa.Column('legal_name', sa.String(length=255), nullable=False),
        sa.Column('trade_name', sa.String(length=255), nullable=True),
        sa.Column('partner_type', sa.Enum('CUSTOMER', 'SUPPLIER', 'CUSTOMER_SUPPLIER', name='partner_type_enum', native_enum=False), nullable=False),
        sa.Column('ice', sa.String(length=50), nullable=True),
        sa.Column('tax_id', sa.String(length=50), nullable=True),
        sa.Column('registration_number', sa.String(length=50), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('website', sa.String(length=255), nullable=True),
        sa.Column('address', sa.String(length=500), nullable=True),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('postal_code', sa.String(length=20), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_business_partners_code'), 'business_partners', ['code'], unique=True)
    op.create_index(op.f('ix_business_partners_legal_name'), 'business_partners', ['legal_name'], unique=False)
    op.create_index(op.f('ix_business_partners_trade_name'), 'business_partners', ['trade_name'], unique=False)
    op.create_index(op.f('ix_business_partners_partner_type'), 'business_partners', ['partner_type'], unique=False)
    op.create_index(op.f('ix_business_partners_ice'), 'business_partners', ['ice'], unique=False)

    # 2. Create partner_contacts table
    op.create_table(
        'partner_contacts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('partner_id', sa.Integer(), nullable=False),
        sa.Column('first_name', sa.String(length=100), nullable=False),
        sa.Column('last_name', sa.String(length=100), nullable=False),
        sa.Column('position', sa.String(length=100), nullable=True),
        sa.Column('phone', sa.String(length=50), nullable=True),
        sa.Column('email', sa.String(length=255), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('notes', sa.String(length=500), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['partner_id'], ['business_partners.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_partner_contacts_partner_id'), 'partner_contacts', ['partner_id'], unique=False)

    # 3. Create partner_addresses table
    op.create_table(
        'partner_addresses',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('partner_id', sa.Integer(), nullable=False),
        sa.Column('type', sa.Enum('MAIN', 'BILLING', 'SHIPPING', 'OTHER', name='address_type_enum', native_enum=False), nullable=False),
        sa.Column('label', sa.String(length=100), nullable=True),
        sa.Column('address_line', sa.String(length=500), nullable=False),
        sa.Column('city', sa.String(length=100), nullable=True),
        sa.Column('postal_code', sa.String(length=20), nullable=True),
        sa.Column('country', sa.String(length=100), nullable=True),
        sa.Column('is_primary', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(['partner_id'], ['business_partners.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_partner_addresses_partner_id'), 'partner_addresses', ['partner_id'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_partner_addresses_partner_id'), table_name='partner_addresses')
    op.drop_table('partner_addresses')
    op.drop_index(op.f('ix_partner_contacts_partner_id'), table_name='partner_contacts')
    op.drop_table('partner_contacts')
    op.drop_index(op.f('ix_business_partners_ice'), table_name='business_partners')
    op.drop_index(op.f('ix_business_partners_partner_type'), table_name='business_partners')
    op.drop_index(op.f('ix_business_partners_trade_name'), table_name='business_partners')
    op.drop_index(op.f('ix_business_partners_legal_name'), table_name='business_partners')
    op.drop_index(op.f('ix_business_partners_code'), table_name='business_partners')
    op.drop_table('business_partners')
