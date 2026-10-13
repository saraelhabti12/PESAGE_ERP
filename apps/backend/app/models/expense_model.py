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


class RecurringExpenseFrequency(str, PyEnum):
    MONTHLY = "MONTHLY"  # Mensuel
    QUARTERLY = "QUARTERLY"  # Trimestriel
    YEARLY = "YEARLY"  # Annuel


class ExpenseStatus(str, PyEnum):
    DRAFT = "DRAFT"  # Brouillon
    VALIDATED = "VALIDATED"  # Validée
    PAID = "PAID"  # Payée
    CANCELLED = "CANCELLED"  # Annulée


class ExpenseCategory(Base):
    __tablename__ = "expense_categories"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
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

    # Relationships
    expenses: Mapped[List["Expense"]] = relationship("Expense", back_populates="category")
    recurring_expenses: Mapped[List["RecurringExpense"]] = relationship("RecurringExpense", back_populates="category")


class RecurringExpense(Base):
    __tablename__ = "recurring_expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_recurring_expense_amount_positive"),
        CheckConstraint("day_of_month >= 1 AND day_of_month <= 31", name="chk_recurring_expense_day_valid"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    category_id: Mapped[int] = mapped_column(ForeignKey("expense_categories.id"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)

    frequency: Mapped[RecurringExpenseFrequency] = mapped_column(
        Enum(RecurringExpenseFrequency, name="recurring_expense_frequency_enum", native_enum=False),
        default=RecurringExpenseFrequency.MONTHLY,
        nullable=False,
    )

    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    end_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    day_of_month: Mapped[int] = mapped_column(default=1, nullable=False)  # 1-31

    payment_method: Mapped[Optional[str]] = mapped_column(String(100), default="Virement bancaire", nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    last_generated_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

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
    category: Mapped["ExpenseCategory"] = relationship("ExpenseCategory", back_populates="recurring_expenses")
    creator = relationship("User", lazy="joined")
    expenses: Mapped[List["Expense"]] = relationship("Expense", back_populates="recurring_expense")


class Expense(Base):
    __tablename__ = "expenses"
    __table_args__ = (
        CheckConstraint("amount > 0", name="chk_expense_amount_positive"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    reference: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    expense_date: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True,
    )

    category_id: Mapped[int] = mapped_column(ForeignKey("expense_categories.id"), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    payment_method: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    supplier_payee: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)  # Bénéficiaire

    employee_id: Mapped[Optional[int]] = mapped_column(ForeignKey("employees.id"), nullable=True, index=True)
    vehicle_id: Mapped[Optional[int]] = mapped_column(ForeignKey("vehicles.id"), nullable=True, index=True)
    recurring_expense_id: Mapped[Optional[int]] = mapped_column(ForeignKey("recurring_expenses.id"), nullable=True, index=True)

    status: Mapped[ExpenseStatus] = mapped_column(
        Enum(ExpenseStatus, name="expense_status_enum", native_enum=False),
        default=ExpenseStatus.PAID,
        nullable=False,
        index=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False)

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
    category: Mapped["ExpenseCategory"] = relationship("ExpenseCategory", back_populates="expenses", lazy="joined")
    employee = relationship("Employee", lazy="joined")
    vehicle = relationship("Vehicle", lazy="joined")
    recurring_expense = relationship("RecurringExpense", back_populates="expenses", lazy="joined")
    creator = relationship("User", lazy="joined")
