from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import List, Optional
from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PartnerType(str, PyEnum):
    CUSTOMER = "CUSTOMER"
    SUPPLIER = "SUPPLIER"
    CUSTOMER_SUPPLIER = "CUSTOMER_SUPPLIER"


class AddressType(str, PyEnum):
    MAIN = "MAIN"
    BILLING = "BILLING"
    SHIPPING = "SHIPPING"
    OTHER = "OTHER"


class BusinessPartner(Base):
    __tablename__ = "business_partners"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    legal_name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    trade_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    
    partner_type: Mapped[PartnerType] = mapped_column(
        Enum(PartnerType, name="partner_type_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    
    ice: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    tax_id: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    registration_number: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    website: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    
    address: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), default="Maroc", nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    contacts: Mapped[List["PartnerContact"]] = relationship(
        "PartnerContact",
        back_populates="partner",
        cascade="all, delete-orphan",
        order_by="desc(PartnerContact.is_primary), PartnerContact.id",
    )
    addresses: Mapped[List["PartnerAddress"]] = relationship(
        "PartnerAddress",
        back_populates="partner",
        cascade="all, delete-orphan",
        order_by="desc(PartnerAddress.is_primary), PartnerAddress.id",
    )


class PartnerContact(Base):
    __tablename__ = "partner_contacts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(
        ForeignKey("business_partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    position: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    partner: Mapped["BusinessPartner"] = relationship(
        "BusinessPartner",
        back_populates="contacts",
    )


class PartnerAddress(Base):
    __tablename__ = "partner_addresses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    partner_id: Mapped[int] = mapped_column(
        ForeignKey("business_partners.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    type: Mapped[AddressType] = mapped_column(
        Enum(AddressType, name="address_type_enum", native_enum=False),
        default=AddressType.MAIN,
        nullable=False,
    )
    label: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    address_line: Mapped[str] = mapped_column(String(500), nullable=False)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    country: Mapped[Optional[str]] = mapped_column(String(100), default="Maroc", nullable=True)
    is_primary: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    partner: Mapped["BusinessPartner"] = relationship(
        "BusinessPartner",
        back_populates="addresses",
    )
