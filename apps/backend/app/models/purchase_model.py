from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import List, Optional
from sqlalchemy import DateTime, Enum, ForeignKey, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class PurchaseOrderStatus(str, PyEnum):
    DRAFT = "DRAFT"
    PENDING = "PENDING"
    APPROVED = "APPROVED"
    PARTIALLY_RECEIVED = "PARTIALLY_RECEIVED"
    RECEIVED = "RECEIVED"
    CANCELLED = "CANCELLED"


class PurchaseReceiptStatus(str, PyEnum):
    DRAFT = "DRAFT"
    CONFIRMED = "CONFIRMED"
    CANCELLED = "CANCELLED"


class PurchaseOrder(Base):
    __tablename__ = "purchase_orders"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    supplier_id: Mapped[int] = mapped_column(ForeignKey("business_partners.id"), nullable=False, index=True)
    order_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    expected_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    
    status: Mapped[PurchaseOrderStatus] = mapped_column(
        Enum(PurchaseOrderStatus, name="purchase_order_status_enum", native_enum=False),
        default=PurchaseOrderStatus.DRAFT,
        nullable=False,
        index=True,
    )
    
    payment_terms: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    subtotal_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
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
    supplier: Mapped["BusinessPartner"] = relationship("BusinessPartner", lazy="joined")
    creator: Mapped["User"] = relationship("User", lazy="joined")
    items: Mapped[List["PurchaseOrderItem"]] = relationship(
        "PurchaseOrderItem",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
        order_by="PurchaseOrderItem.id",
    )
    receipts: Mapped[List["PurchaseReceipt"]] = relationship(
        "PurchaseReceipt",
        back_populates="purchase_order",
        cascade="all, delete-orphan",
        order_by="PurchaseReceipt.id",
    )


class PurchaseOrderItem(Base):
    __tablename__ = "purchase_order_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    
    quantity_ordered: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    unit_price_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=20.00, nullable=False)
    discount_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=0.00, nullable=False)
    
    line_subtotal_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_tax: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    line_total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    
    quantity_received: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    quantity_remaining: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    
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
    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="items")
    product: Mapped["Product"] = relationship("Product", lazy="joined")
    receipt_items: Mapped[List["PurchaseReceiptItem"]] = relationship(
        "PurchaseReceiptItem",
        back_populates="order_item",
        cascade="all, delete-orphan",
    )


class PurchaseReceipt(Base):
    __tablename__ = "purchase_receipts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    purchase_order_id: Mapped[int] = mapped_column(ForeignKey("purchase_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    receipt_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    
    status: Mapped[PurchaseReceiptStatus] = mapped_column(
        Enum(PurchaseReceiptStatus, name="purchase_receipt_status_enum", native_enum=False),
        default=PurchaseReceiptStatus.CONFIRMED,
        nullable=False,
        index=True,
    )
    
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    warehouse_id: Mapped[Optional[int]] = mapped_column(ForeignKey("warehouses.id"), nullable=True, index=True)
    received_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    
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
    purchase_order: Mapped["PurchaseOrder"] = relationship("PurchaseOrder", back_populates="receipts")
    receiver: Mapped["User"] = relationship("User", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")
    items: Mapped[List["PurchaseReceiptItem"]] = relationship(
        "PurchaseReceiptItem",
        back_populates="receipt",
        cascade="all, delete-orphan",
        order_by="PurchaseReceiptItem.id",
    )


class PurchaseReceiptItem(Base):
    __tablename__ = "purchase_receipt_items"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    purchase_receipt_id: Mapped[int] = mapped_column(ForeignKey("purchase_receipts.id", ondelete="CASCADE"), nullable=False, index=True)
    purchase_order_item_id: Mapped[int] = mapped_column(ForeignKey("purchase_order_items.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    warehouse_id: Mapped[Optional[int]] = mapped_column(ForeignKey("warehouses.id"), nullable=True, index=True)
    
    quantity_received: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    receipt: Mapped["PurchaseReceipt"] = relationship("PurchaseReceipt", back_populates="items")
    order_item: Mapped["PurchaseOrderItem"] = relationship("PurchaseOrderItem", back_populates="receipt_items")
    product: Mapped["Product"] = relationship("Product", lazy="joined")
    warehouse = relationship("Warehouse", lazy="joined")

