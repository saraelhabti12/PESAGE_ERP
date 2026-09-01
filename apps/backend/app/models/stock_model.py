import enum
from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy import (
    String,
    Text,
    DateTime,
    ForeignKey,
    Numeric,
    Enum,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WarehouseType(str, enum.Enum):
    MAIN = "MAIN"
    WAREHOUSE = "WAREHOUSE"
    WORKSHOP = "WORKSHOP"
    VEHICLE = "VEHICLE"
    OTHER = "OTHER"


class StockMovementType(str, enum.Enum):
    PURCHASE_RECEIPT = "PURCHASE_RECEIPT"
    SALE = "SALE"
    RETURN_IN = "RETURN_IN"
    RETURN_OUT = "RETURN_OUT"
    ADJUSTMENT_IN = "ADJUSTMENT_IN"
    ADJUSTMENT_OUT = "ADJUSTMENT_OUT"
    TRANSFER_IN = "TRANSFER_IN"
    TRANSFER_OUT = "TRANSFER_OUT"
    MANUAL_IN = "MANUAL_IN"
    MANUAL_OUT = "MANUAL_OUT"


class StockReservationStatus(str, enum.Enum):
    ACTIVE = "ACTIVE"
    RELEASED = "RELEASED"
    CONSUMED = "CONSUMED"
    CANCELLED = "CANCELLED"


class InventorySessionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Warehouse(Base):
    __tablename__ = "warehouses"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    type: Mapped[WarehouseType] = mapped_column(
        Enum(WarehouseType, name="warehouse_type_enum", native_enum=False),
        default=WarehouseType.MAIN,
        nullable=False,
    )
    address: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(default=True, nullable=False, index=True)

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
    stock_balances: Mapped[List["StockBalance"]] = relationship(
        "StockBalance",
        back_populates="warehouse",
        cascade="all, delete-orphan",
    )
    movements: Mapped[List["StockMovement"]] = relationship(
        "StockMovement",
        back_populates="warehouse",
    )
    reservations: Mapped[List["StockReservation"]] = relationship(
        "StockReservation",
        back_populates="warehouse",
    )
    inventory_sessions: Mapped[List["InventorySession"]] = relationship(
        "InventorySession",
        back_populates="warehouse",
    )


class StockBalance(Base):
    __tablename__ = "stock_balances"
    __table_args__ = (
        UniqueConstraint("product_id", "warehouse_id", name="uq_stock_balance_product_warehouse"),
        CheckConstraint("quantity >= 0", name="chk_stock_balance_qty_positive"),
        CheckConstraint("reserved_quantity >= 0", name="chk_stock_balance_reserved_positive"),
        CheckConstraint("reserved_quantity <= quantity", name="chk_stock_balance_reserved_le_qty"),
        CheckConstraint("minimum_quantity >= 0", name="chk_stock_balance_min_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id", ondelete="CASCADE"), nullable=False, index=True)

    quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    reserved_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    minimum_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    maximum_quantity: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)

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
    product = relationship("Product", lazy="joined")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="stock_balances", lazy="joined")

    @property
    def available_quantity(self) -> float:
        return max(0.0, float(self.quantity) - float(self.reserved_quantity))

    @property
    def status(self) -> str:
        qty = float(self.quantity)
        min_qty = float(self.minimum_quantity)
        max_qty = float(self.maximum_quantity) if self.maximum_quantity is not None else None

        if qty == 0:
            return "OUT_OF_STOCK"
        if min_qty > 0 and qty <= min_qty:
            return "LOW"
        if max_qty is not None and qty > max_qty:
            return "OVERSTOCK"
        return "NORMAL"


class StockMovement(Base):
    __tablename__ = "stock_movements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False, index=True)

    movement_type: Mapped[StockMovementType] = mapped_column(
        Enum(StockMovementType, name="stock_movement_type_enum", native_enum=False),
        nullable=False,
        index=True,
    )
    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    reference_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    # Relationships
    product = relationship("Product", lazy="joined")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="movements", lazy="joined")
    creator = relationship("User", lazy="joined")


class StockReservation(Base):
    __tablename__ = "stock_reservations"
    __table_args__ = (
        CheckConstraint("quantity > 0", name="chk_stock_reservation_qty_gt_zero"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False, index=True)

    quantity: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    reference_type: Mapped[Optional[str]] = mapped_column(String(50), nullable=True, index=True)
    reference_id: Mapped[Optional[int]] = mapped_column(nullable=True, index=True)
    status: Mapped[StockReservationStatus] = mapped_column(
        Enum(StockReservationStatus, name="stock_reservation_status_enum", native_enum=False),
        default=StockReservationStatus.ACTIVE,
        nullable=False,
        index=True,
    )
    reserved_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    released_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    # Relationships
    product = relationship("Product", lazy="joined")
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="reservations", lazy="joined")
    user = relationship("User", lazy="joined")


class InventorySession(Base):
    __tablename__ = "inventory_sessions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    warehouse_id: Mapped[int] = mapped_column(ForeignKey("warehouses.id"), nullable=False, index=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    status: Mapped[InventorySessionStatus] = mapped_column(
        Enum(InventorySessionStatus, name="inventory_session_status_enum", native_enum=False),
        default=InventorySessionStatus.DRAFT,
        nullable=False,
        index=True,
    )
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    validated_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    validated_by: Mapped[Optional[int]] = mapped_column(ForeignKey("users.id"), nullable=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

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
    warehouse: Mapped["Warehouse"] = relationship("Warehouse", back_populates="inventory_sessions", lazy="joined")
    creator = relationship("User", foreign_keys=[created_by], lazy="joined")
    validator = relationship("User", foreign_keys=[validated_by], lazy="joined")
    items: Mapped[List["InventoryItem"]] = relationship(
        "InventoryItem",
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="InventoryItem.id",
    )


class InventoryItem(Base):
    __tablename__ = "inventory_items"
    __table_args__ = (
        UniqueConstraint("inventory_session_id", "product_id", name="uq_inventory_session_product"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    inventory_session_id: Mapped[int] = mapped_column(
        ForeignKey("inventory_sessions.id", ondelete="CASCADE"), nullable=False, index=True
    )
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), nullable=False, index=True)

    system_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    counted_quantity: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    difference: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # Relationships
    session: Mapped["InventorySession"] = relationship("InventorySession", back_populates="items")
    product = relationship("Product", lazy="joined")
