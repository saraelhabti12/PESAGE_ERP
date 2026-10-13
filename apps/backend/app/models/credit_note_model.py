from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import List, Optional
from sqlalchemy import (
    Boolean,
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


class CreditNoteReason(str, PyEnum):
    RETURN = "RETURN"  # Retour marchandise
    BILLING_ERROR = "BILLING_ERROR"  # Erreur de facturation
    COMMERCIAL_DISCOUNT = "COMMERCIAL_DISCOUNT"  # Remise commerciale
    PARTIAL_CANCELLATION = "PARTIAL_CANCELLATION"  # Annulation partielle
    PRICE_CORRECTION = "PRICE_CORRECTION"  # Correction de prix / tarifaire
    DEFECTIVE_PRODUCT = "DEFECTIVE_PRODUCT"  # Produit défectueux / cassé
    OTHER = "OTHER"  # Autre



class CreditNoteStatus(str, PyEnum):
    DRAFT = "DRAFT"  # BROUILLON
    ISSUED = "ISSUED"  # ÉMISE
    CANCELLED = "CANCELLED"  # ANNULÉE


class CreditNote(Base):
    __tablename__ = "credit_notes"
    __table_args__ = (
        CheckConstraint("subtotal_ht >= 0", name="chk_credit_note_subtotal_ht_positive"),
        CheckConstraint("discount_amount >= 0", name="chk_credit_note_discount_positive"),
        CheckConstraint("tax_amount >= 0", name="chk_credit_note_tax_amount_positive"),
        CheckConstraint("total_ttc >= 0", name="chk_credit_note_total_ttc_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    invoice_id: Mapped[int] = mapped_column(ForeignKey("invoices.id"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("business_partners.id"), nullable=False, index=True)

    credit_note_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    reason: Mapped[CreditNoteReason] = mapped_column(
        Enum(CreditNoteReason, name="credit_note_reason_enum", native_enum=False),
        default=CreditNoteReason.RETURN,
        nullable=False,
        index=True,
    )

    status: Mapped[CreditNoteStatus] = mapped_column(
        Enum(CreditNoteStatus, name="credit_note_status_enum", native_enum=False),
        default=CreditNoteStatus.ISSUED,
        nullable=False,
        index=True,
    )

    subtotal_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    invoice = relationship("Invoice", back_populates="credit_notes", lazy="joined")
    customer = relationship("BusinessPartner", lazy="joined")
    creator = relationship("User", lazy="joined")
    items: Mapped[List["CreditNoteItem"]] = relationship(
        "CreditNoteItem",
        back_populates="credit_note",
        cascade="all, delete-orphan",
        order_by="CreditNoteItem.id",
    )


class CreditNoteItem(Base):
    __tablename__ = "credit_note_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_credit_note_item_quantity_positive"),
        CheckConstraint("unit_price_ht >= 0", name="chk_credit_note_item_unit_price_positive"),
        CheckConstraint("tax_rate >= 0", name="chk_credit_note_item_tax_rate_positive"),
        CheckConstraint("discount_rate >= 0", name="chk_credit_note_item_discount_rate_positive"),
        CheckConstraint("line_subtotal_ht >= 0", name="chk_credit_note_item_line_subtotal_positive"),
        CheckConstraint("line_discount >= 0", name="chk_credit_note_item_line_discount_positive"),
        CheckConstraint("line_tax >= 0", name="chk_credit_note_item_line_tax_positive"),
        CheckConstraint("line_total_ttc >= 0", name="chk_credit_note_item_line_total_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    credit_note_id: Mapped[int] = mapped_column(
        ForeignKey("credit_notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id"), nullable=True, index=True)
    invoice_item_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoice_items.id"), nullable=True, index=True)
    warehouse_id: Mapped[Optional[int]] = mapped_column(ForeignKey("warehouses.id"), nullable=True, index=True)

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=20.00, nullable=False)
    discount_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)

    line_subtotal_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_discount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    return_to_stock: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

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
    credit_note: Mapped["CreditNote"] = relationship("CreditNote", back_populates="items")
    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")
    invoice_item = relationship("InvoiceItem", lazy="joined")
