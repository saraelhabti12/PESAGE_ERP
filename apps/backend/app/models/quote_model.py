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


class QuoteStatus(str, PyEnum):
    DRAFT = "DRAFT"  # BROUILLON
    SENT = "SENT"    # ENVOYÉ
    ACCEPTED = "ACCEPTED"  # ACCEPTÉ
    REJECTED = "REJECTED"  # REFUSÉ
    EXPIRED = "EXPIRED"    # EXPIRÉ
    CANCELLED = "CANCELLED"  # ANNULÉ


class Quote(Base):
    __tablename__ = "quotes"
    __table_args__ = (
        CheckConstraint("subtotal_ht >= 0", name="chk_quote_subtotal_ht_positive"),
        CheckConstraint("discount_amount >= 0", name="chk_quote_discount_positive"),
        CheckConstraint("tax_amount >= 0", name="chk_quote_tax_amount_positive"),
        CheckConstraint("total_ttc >= 0", name="chk_quote_total_ttc_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("business_partners.id"), nullable=False, index=True)
    quote_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    valid_until: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    status: Mapped[QuoteStatus] = mapped_column(
        Enum(QuoteStatus, name="quote_status_enum", native_enum=False),
        default=QuoteStatus.DRAFT,
        nullable=False,
        index=True,
    )

    payment_terms: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    delivery_delay: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    realization_delay: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    subtotal_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    discount_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_amount: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

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
    customer = relationship("BusinessPartner", lazy="joined")
    creator = relationship("User", lazy="joined")
    items: Mapped[List["QuoteItem"]] = relationship(
        "QuoteItem",
        back_populates="quote",
        cascade="all, delete-orphan",
        order_by="QuoteItem.id",
    )
    sales = relationship("Sale", back_populates="quote")


class QuoteItem(Base):
    __tablename__ = "quote_items"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_quote_item_quantity_positive"),
        CheckConstraint("unit_price_ht >= 0", name="chk_quote_item_unit_price_positive"),
        CheckConstraint("tax_rate >= 0", name="chk_quote_item_tax_rate_positive"),
        CheckConstraint("discount_rate >= 0", name="chk_quote_item_discount_rate_positive"),
        CheckConstraint("line_subtotal_ht >= 0", name="chk_quote_item_line_subtotal_positive"),
        CheckConstraint("line_discount >= 0", name="chk_quote_item_line_discount_positive"),
        CheckConstraint("line_tax >= 0", name="chk_quote_item_line_tax_positive"),
        CheckConstraint("line_total_ttc >= 0", name="chk_quote_item_line_total_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    quote_id: Mapped[int] = mapped_column(ForeignKey("quotes.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)

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
    quote: Mapped["Quote"] = relationship("Quote", back_populates="items")
    product = relationship("Product", lazy="joined")
