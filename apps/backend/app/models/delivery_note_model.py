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


class DeliveryNoteStatus(str, PyEnum):
    DRAFT = "DRAFT"  # BROUILLON
    PARTIALLY_DELIVERED = "PARTIALLY_DELIVERED"  # PARTIELLEMENT_LIVRÉ
    DELIVERED = "DELIVERED"  # LIVRÉ
    CANCELLED = "CANCELLED"  # ANNULÉ


class DeliveryNote(Base):
    __tablename__ = "delivery_notes"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    sale_id: Mapped[int] = mapped_column(ForeignKey("sales.id"), nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("business_partners.id"), nullable=False, index=True)
    delivery_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    delivery_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    status: Mapped[DeliveryNoteStatus] = mapped_column(
        Enum(DeliveryNoteStatus, name="delivery_note_status_enum", native_enum=False),
        default=DeliveryNoteStatus.DRAFT,
        nullable=False,
        index=True,
    )

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
    sale = relationship("Sale", lazy="joined")
    customer = relationship("BusinessPartner", lazy="joined")
    creator = relationship("User", lazy="joined")
    items: Mapped[List["DeliveryNoteItem"]] = relationship(
        "DeliveryNoteItem",
        back_populates="delivery_note",
        cascade="all, delete-orphan",
        order_by="DeliveryNoteItem.id",
    )


class DeliveryNoteItem(Base):
    __tablename__ = "delivery_note_items"
    __table_args__ = (
        CheckConstraint("ordered_quantity >= 0", name="chk_dn_item_ordered_qty_positive"),
        CheckConstraint("delivered_quantity > 0", name="chk_dn_item_delivered_qty_positive"),
        CheckConstraint("remaining_quantity >= 0", name="chk_dn_item_remaining_qty_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    delivery_note_id: Mapped[int] = mapped_column(
        ForeignKey("delivery_notes.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    warehouse_id: Mapped[Optional[int]] = mapped_column(ForeignKey("warehouses.id"), nullable=True, index=True)

    ordered_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    delivered_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    remaining_quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

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
    delivery_note: Mapped["DeliveryNote"] = relationship("DeliveryNote", back_populates="items")
    product = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")
