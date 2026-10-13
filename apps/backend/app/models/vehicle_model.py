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


class FuelType(str, PyEnum):
    DIESEL = "DIESEL"  # Diesel
    GASOLINE = "GASOLINE"  # Essence
    HYBRID = "HYBRID"  # Hybride
    ELECTRIC = "ELECTRIC"  # Électrique


class VehicleStatus(str, PyEnum):
    ACTIVE = "ACTIVE"  # En service
    IN_SERVICE = "IN_SERVICE"  # En mission
    MAINTENANCE = "MAINTENANCE"  # En maintenance / Réparation
    DECOMMISSIONED = "DECOMMISSIONED"  # Réformé / Hors service


class MaintenanceType(str, PyEnum):
    OIL_CHANGE = "OIL_CHANGE"  # Vidange
    INSPECTION = "INSPECTION"  # Révision
    BRAKES = "BRAKES"  # Freins
    TIRES = "TIRES"  # Pneus
    BATTERY = "BATTERY"  # Batterie
    ENGINE = "ENGINE"  # Moteur
    AC = "AC"  # Climatisation
    REPAIR = "REPAIR"  # Réparation
    CHECK = "CHECK"  # Contrôle technique
    OTHER = "OTHER"  # Autre


class Vehicle(Base):
    __tablename__ = "vehicles"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    registration_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    brand: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    model: Mapped[str] = mapped_column(String(100), nullable=False)
    vehicle_type: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)  # Utilitaire, Berline, etc.
    year: Mapped[Optional[int]] = mapped_column(nullable=True)
    vin: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    first_registration_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    current_mileage: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    fuel_type: Mapped[FuelType] = mapped_column(
        Enum(FuelType, name="fuel_type_enum", native_enum=False),
        default=FuelType.DIESEL,
        nullable=False,
    )
    fuel_capacity: Mapped[Optional[float]] = mapped_column(Numeric(8, 2), nullable=True)

    status: Mapped[VehicleStatus] = mapped_column(
        Enum(VehicleStatus, name="vehicle_status_enum", native_enum=False),
        default=VehicleStatus.ACTIVE,
        nullable=False,
        index=True,
    )

    default_driver_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True, index=True)

    # Document & compliance dates
    insurance_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    technical_inspection_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    registration_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    tax_expiry: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)  # Vignette

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
    default_driver = relationship("Employee", lazy="joined")
    maintenances: Mapped[List["VehicleMaintenance"]] = relationship(
        "VehicleMaintenance",
        back_populates="vehicle",
        cascade="all, delete-orphan",
        order_by="VehicleMaintenance.maintenance_date.desc()",
    )
    fuel_logs: Mapped[List["FuelLog"]] = relationship(
        "FuelLog",
        back_populates="vehicle",
        cascade="all, delete-orphan",
        order_by="FuelLog.date.desc()",
    )


class VehicleMaintenance(Base):
    __tablename__ = "vehicle_maintenances"
    __table_args__ = (
        CheckConstraint("labor_cost >= 0", name="chk_maint_labor_cost_positive"),
        CheckConstraint("parts_cost >= 0", name="chk_maint_parts_cost_positive"),
        CheckConstraint("total_cost >= 0", name="chk_maint_total_cost_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    maintenance_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    mileage: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    maintenance_type: Mapped[MaintenanceType] = mapped_column(
        Enum(MaintenanceType, name="maintenance_type_enum", native_enum=False),
        default=MaintenanceType.OIL_CHANGE,
        nullable=False,
        index=True,
    )

    description: Mapped[str] = mapped_column(String(255), nullable=False)
    supplier: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Garage / Fournisseur

    labor_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    parts_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    next_maintenance_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_maintenance_mileage: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="maintenances")
    creator = relationship("User", lazy="joined")


class FuelLog(Base):
    __tablename__ = "fuel_logs"
    __table_args__ = (
        CheckConstraint("liters > 0", name="chk_fuel_liters_positive"),
        CheckConstraint("price_per_liter >= 0", name="chk_fuel_price_positive"),
        CheckConstraint("total_cost >= 0", name="chk_fuel_total_cost_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    vehicle_id: Mapped[int] = mapped_column(ForeignKey("vehicles.id", ondelete="CASCADE"), nullable=False, index=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    mileage: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    liters: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    price_per_liter: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    station: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Station service
    driver_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True, index=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    # Relationships
    vehicle: Mapped["Vehicle"] = relationship("Vehicle", back_populates="fuel_logs")
    driver = relationship("Employee", lazy="joined")
    creator = relationship("User", lazy="joined")
