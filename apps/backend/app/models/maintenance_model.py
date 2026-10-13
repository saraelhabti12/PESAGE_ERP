from datetime import datetime, timezone
from enum import Enum as PyEnum
from typing import List, Optional
from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EquipmentType(str, PyEnum):
    PONTS_BASCULES = "PONTS_BASCULES"  # Ponts-bascules
    BALANCES_INDUSTRIELLES = "BALANCES_INDUSTRIELLES"  # Balances industrielles
    BALANCES_PLATEFORMES = "BALANCES_PLATEFORMES"  # Balances plateformes
    INDICATEURS_POIDS = "INDICATEURS_POIDS"  # Indicateurs de poids
    CAPTEURS_CHARGE = "CAPTEURS_CHARGE"  # Capteurs de charge
    TERMINAUX_PESAGE = "TERMINAUX_PESAGE"  # Terminaux de pesage
    IMPRIMANTES_TICKETS = "IMPRIMANTES_TICKETS"  # Imprimantes de tickets
    AUTRE = "AUTRE"  # Autre équipement


class EquipmentStatus(str, PyEnum):
    OPERATIONAL = "OPERATIONAL"  # En service / Opérationnel
    UNDER_MAINTENANCE = "UNDER_MAINTENANCE"  # En maintenance / Révision
    OUT_OF_SERVICE = "OUT_OF_SERVICE"  # Hors service / Panne
    DECOMMISSIONED = "DECOMMISSIONED"  # Réformé / Remplacé


class InterventionType(str, PyEnum):
    PREVENTIVE_MAINTENANCE = "PREVENTIVE_MAINTENANCE"  # Maintenance préventive
    CORRECTIVE_MAINTENANCE = "CORRECTIVE_MAINTENANCE"  # Maintenance corrective
    BREAKDOWN_REPAIR = "BREAKDOWN_REPAIR"  # Dépannage urgent
    CALIBRATION = "CALIBRATION"  # Étalonnage / Calibration
    INSTALLATION = "INSTALLATION"  # Installation & Mise en service
    INSPECTION = "INSPECTION"  # Contrôle / Inspection
    METROLOGY_LEGAL = "METROLOGY_LEGAL"  # Métrologie légale
    STAMPING = "STAMPING"  # Poinçonnage
    OTHER = "OTHER"  # Autre


class InterventionPriority(str, PyEnum):
    LOW = "LOW"  # Faible
    NORMAL = "NORMAL"  # Normale
    HIGH = "HIGH"  # Urgente
    CRITICAL = "CRITICAL"  # Critique


class InterventionStatus(str, PyEnum):
    SCHEDULED = "SCHEDULED"  # Planifiée
    PENDING = "PENDING"  # En attente
    IN_PROGRESS = "IN_PROGRESS"  # En cours
    COMPLETED = "COMPLETED"  # Terminée
    CANCELLED = "CANCELLED"  # Annulée


class TaskStatus(str, PyEnum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


# ----------------------------------------------------
# EQUIPMENT (Matériel Client Installé)
# ----------------------------------------------------
class Equipment(Base):
    __tablename__ = "equipments"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    equipment_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("business_partners.id"), nullable=False, index=True)
    designation: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    equipment_type: Mapped[EquipmentType] = mapped_column(
        Enum(EquipmentType, name="equipment_type_enum", native_enum=False),
        default=EquipmentType.PONTS_BASCULES,
        nullable=False,
        index=True,
    )
    brand: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    model: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    serial_number: Mapped[Optional[str]] = mapped_column(String(100), nullable=True, index=True)
    site_name: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    site_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    installation_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    capacity_max: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    capacity_min: Mapped[Optional[float]] = mapped_column(Numeric(12, 2), nullable=True)
    graduation: Mapped[Optional[float]] = mapped_column(Numeric(10, 3), nullable=True)
    status: Mapped[EquipmentStatus] = mapped_column(
        Enum(EquipmentStatus, name="equipment_status_enum", native_enum=False),
        default=EquipmentStatus.OPERATIONAL,
        nullable=False,
        index=True,
    )
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
    customer = relationship("BusinessPartner", lazy="joined")
    interventions: Mapped[List["Intervention"]] = relationship(
        "Intervention",
        back_populates="equipment",
        cascade="all, delete-orphan",
        order_by="Intervention.date_start.desc()",
    )


# ----------------------------------------------------
# INTERVENTION (Fiche d'Intervention & Rapport)
# ----------------------------------------------------
class Intervention(Base):
    __tablename__ = "interventions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    intervention_code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    customer_id: Mapped[int] = mapped_column(ForeignKey("business_partners.id"), nullable=False, index=True)
    equipment_id: Mapped[Optional[int]] = mapped_column(ForeignKey("equipments.id", ondelete="SET NULL"), nullable=True, index=True)
    site: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    assigned_technician_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    date_start: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )
    date_end: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    intervention_type: Mapped[InterventionType] = mapped_column(
        Enum(InterventionType, name="intervention_type_enum", native_enum=False),
        default=InterventionType.PREVENTIVE_MAINTENANCE,
        nullable=False,
        index=True,
    )
    priority: Mapped[InterventionPriority] = mapped_column(
        Enum(InterventionPriority, name="intervention_priority_enum", native_enum=False),
        default=InterventionPriority.NORMAL,
        nullable=False,
        index=True,
    )
    status: Mapped[InterventionStatus] = mapped_column(
        Enum(InterventionStatus, name="intervention_status_enum", native_enum=False),
        default=InterventionStatus.SCHEDULED,
        nullable=False,
        index=True,
    )

    # Technical Details
    problem_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    work_performed: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    observations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recommendations: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    next_maintenance_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    next_maintenance_mileage: Mapped[Optional[float]] = mapped_column(Numeric(10, 2), nullable=True)

    # Costs
    labor_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    parts_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    travel_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    other_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    # Optional Commercial document linkages
    quote_id: Mapped[Optional[int]] = mapped_column(ForeignKey("quotes.id", ondelete="SET NULL"), nullable=True)
    sale_id: Mapped[Optional[int]] = mapped_column(ForeignKey("sales.id", ondelete="SET NULL"), nullable=True)
    invoice_id: Mapped[Optional[int]] = mapped_column(ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True)

    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)
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
    customer = relationship("BusinessPartner", lazy="joined")
    equipment: Mapped[Optional["Equipment"]] = relationship("Equipment", back_populates="interventions", lazy="joined")
    technician = relationship("Employee", lazy="joined")
    creator = relationship("User", lazy="joined")
    tasks: Mapped[List["InterventionTask"]] = relationship(
        "InterventionTask",
        back_populates="intervention",
        cascade="all, delete-orphan",
        order_by="InterventionTask.order_index.asc(), InterventionTask.id.asc()",
    )
    parts: Mapped[List["InterventionPart"]] = relationship(
        "InterventionPart",
        back_populates="intervention",
        cascade="all, delete-orphan",
        order_by="InterventionPart.id.asc()",
    )


# ----------------------------------------------------
# INTERVENTION TASKS (Travaux / Étapes Réalisées)
# ----------------------------------------------------
class InterventionTask(Base):
    __tablename__ = "intervention_tasks"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    intervention_id: Mapped[int] = mapped_column(ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus, name="intervention_task_status_enum", native_enum=False),
        default=TaskStatus.PENDING,
        nullable=False,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    order_index: Mapped[int] = mapped_column(default=0, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    intervention: Mapped["Intervention"] = relationship("Intervention", back_populates="tasks")


# ----------------------------------------------------
# INTERVENTION PARTS (Pièces / Consommables Utilisés)
# ----------------------------------------------------
class InterventionPart(Base):
    __tablename__ = "intervention_parts"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    intervention_id: Mapped[int] = mapped_column(ForeignKey("interventions.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id: Mapped[Optional[int]] = mapped_column(ForeignKey("products.id", ondelete="SET NULL"), nullable=True, index=True)
    designation: Mapped[str] = mapped_column(String(255), nullable=False)
    quantity: Mapped[float] = mapped_column(Numeric(10, 2), default=1.00, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=20.00, nullable=False)
    total_ht: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)
    total_ttc: Mapped[float] = mapped_column(Numeric(12, 2), default=0.00, nullable=False)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    intervention: Mapped["Intervention"] = relationship("Intervention", back_populates="parts")
    product = relationship("Product", lazy="joined")
