from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import List, Optional
from sqlalchemy import (
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InvoiceType(str, PyEnum):
    CUSTOMER = "CUSTOMER"  # Facture Client
    SUPPLIER = "SUPPLIER"  # Facture Fournisseur


class InvoiceStatus(str, PyEnum):
    DRAFT = "DRAFT"  # BROUILLON
    ISSUED = "ISSUED"  # ÉMISE
    PARTIALLY_PAID = "PARTIALLY_PAID"  # PARTIELLEMENT_PAYÉE
    PAID = "PAID"  # PAYÉE
    OVERDUE = "OVERDUE"  # EN_RETARD
    CANCELLED = "CANCELLED"  # ANNULÉE


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint("subtotal_ht >= 0", name="chk_invoice_subtotal_ht_positive"),
        CheckConstraint("discount_amount >= 0", name="chk_invoice_discount_positive"),
        CheckConstraint("tax_amount >= 0", name="chk_invoice_tax_amount_positive"),
        CheckConstraint("total_ttc >= 0", name="chk_invoice_total_ttc_positive"),
        CheckConstraint("amount_paid >= 0", name="chk_invoice_amount_paid_positive"),
        CheckConstraint("amount_due >= 0", name="chk_invoice_amount_due_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    
    invoice_type: Mapped[InvoiceType] = mapped_column(
        Enum(InvoiceType, name="invoice_type_enum", native_enum=False),
        default=InvoiceType.CUSTOMER,
        nullable=False,
        index=True,
    )
    customer_id: Mapped[Optional[int]] = mapped_column(ForeignKey("business_partners.id"), nullable=True, index=True)
    supplier_id: Mapped[Optional[int]] = mapped_column(ForeignKey("business_partners.id"), nullable=True, index=True)
    sale_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales.id"), nullable=True, index=True)
    purchase_order_id: Mapped[Optional[int]] = mapped_column(ForeignKey("purchase_orders.id"), nullable=True, index=True)

    invoice_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    due_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus, name="invoice_status_enum", native_enum=False),
        default=InvoiceStatus.DRAFT,
        nullable=False,
        index=True,
    )

    payment_terms: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    subtotal_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    amount_paid: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    amount_due: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
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

    # Relationships
    customer = relationship("BusinessPartner", foreign_keys=[customer_id], lazy="joined")
    supplier = relationship("BusinessPartner", foreign_keys=[supplier_id], lazy="joined")
    sale = relationship("Sale", lazy="joined")
    purchase_order = relationship("PurchaseOrder", lazy="joined")
    creator = relationship("User", lazy="joined")
    items: Mapped[List["InvoiceItem"]] = relationship(
        "InvoiceItem",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="InvoiceItem.id",
    )
    payments: Mapped[List["Payment"]] = relationship(
        "Payment",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="Payment.id",
    )
    credit_notes = relationship(
        "CreditNote",
        back_populates="invoice",
        cascade="all, delete-orphan",
        order_by="CreditNote.id",
    )


class InvoiceItem(Base):
    __tablename__ = "invoice_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_invoice_item_quantity_positive"),
        CheckConstraint("unit_price_ht >= 0", name="chk_invoice_item_unit_price_positive"),
        CheckConstraint("tax_rate >= 0", name="chk_invoice_item_tax_rate_positive"),
        CheckConstraint("discount_rate >= 0", name="chk_invoice_item_discount_rate_positive"),
        CheckConstraint("line_subtotal_ht >= 0", name="chk_invoice_item_line_subtotal_positive"),
        CheckConstraint("line_discount >= 0", name="chk_invoice_item_line_discount_positive"),
        CheckConstraint("line_tax >= 0", name="chk_invoice_item_line_tax_positive"),
        CheckConstraint("line_total_ttc >= 0", name="chk_invoice_item_line_total_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    invoice_id: Mapped[int] = mapped_column(
        ForeignKey("invoices.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)

    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=20.00, nullable=False)
    discount_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)

    line_subtotal_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

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

    # Relationships
    invoice: Mapped["Invoice"] = relationship("Invoice", back_populates="items")
    product = relationship("Product", lazy="joined")
