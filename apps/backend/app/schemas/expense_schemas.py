from datetime import datetime
from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.expense_model import ExpenseStatus, RecurringExpenseFrequency
from app.schemas.employee_schemas import EmployeeRead
from app.schemas.sale_schemas import UserSummary
from app.schemas.vehicle_schemas import VehicleRead


# --------------------------------------------------
# Expense Category Schemas
# --------------------------------------------------
class ExpenseCategoryBase(BaseModel):
    name: str = Field(..., max_length=100)
    code: str = Field(..., max_length=50)
    description: Optional[str] = None
    is_active: bool = Field(default=True)


class ExpenseCategoryCreate(ExpenseCategoryBase):
    pass


class ExpenseCategoryUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class ExpenseCategoryRead(ExpenseCategoryBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Recurring Expense Schemas
# --------------------------------------------------
class RecurringExpenseBase(BaseModel):
    category_id: int
    label: str = Field(..., max_length=255)
    amount: float = Field(gt=0)
    frequency: RecurringExpenseFrequency = Field(default=RecurringExpenseFrequency.MONTHLY)
    start_date: datetime
    end_date: Optional[datetime] = None
    day_of_month: int = Field(default=1, ge=1, le=31)
    payment_method: Optional[str] = Field(default="Virement bancaire")
    is_active: bool = Field(default=True)
    notes: Optional[str] = None


class RecurringExpenseCreate(RecurringExpenseBase):
    pass


class RecurringExpenseUpdate(BaseModel):
    category_id: Optional[int] = None
    label: Optional[str] = Field(None, max_length=255)
    amount: Optional[float] = Field(None, gt=0)
    frequency: Optional[RecurringExpenseFrequency] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    day_of_month: Optional[int] = Field(None, ge=1, le=31)
    payment_method: Optional[str] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class RecurringExpenseRead(RecurringExpenseBase):
    id: int
    last_generated_date: Optional[datetime] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    category: Optional[ExpenseCategoryRead] = None
    creator: Optional[UserSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Variable Expense Schemas
# --------------------------------------------------
class ExpenseBase(BaseModel):
    expense_date: Optional[datetime] = None
    category_id: int
    label: str = Field(..., max_length=255)
    amount: float = Field(gt=0)
    payment_method: Optional[str] = Field(default="Espèces")
    supplier_payee: Optional[str] = Field(None, max_length=255)
    employee_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    recurring_expense_id: Optional[int] = None
    status: ExpenseStatus = Field(default=ExpenseStatus.PAID)
    notes: Optional[str] = None


class ExpenseCreate(ExpenseBase):
    reference: Optional[str] = Field(None, max_length=100)


class ExpenseUpdate(BaseModel):
    expense_date: Optional[datetime] = None
    category_id: Optional[int] = None
    label: Optional[str] = Field(None, max_length=255)
    amount: Optional[float] = Field(None, gt=0)
    payment_method: Optional[str] = None
    supplier_payee: Optional[str] = None
    employee_id: Optional[int] = None
    vehicle_id: Optional[int] = None
    status: Optional[ExpenseStatus] = None
    notes: Optional[str] = None


class ExpenseRead(ExpenseBase):
    id: int
    reference: str
    created_by: int
    created_at: datetime
    updated_at: datetime
    category: Optional[ExpenseCategoryRead] = None
    employee: Optional[EmployeeRead] = None
    vehicle: Optional[VehicleRead] = None
    creator: Optional[UserSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Expense Statistics
# --------------------------------------------------
class CategoryExpenseStat(BaseModel):
    category_id: int
    category_name: str
    total_amount: float
    percentage: float


class MonthlyExpenseStat(BaseModel):
    month: str
    total_amount: float
    fixed_amount: float
    variable_amount: float


class ExpenseStatistics(BaseModel):
    total_expenses: float
    fixed_expenses: float
    variable_expenses: float
    this_month: float
    this_year: float
    by_category: List[CategoryExpenseStat]
    by_month: List[MonthlyExpenseStat]
    by_payment_method: Dict[str, float]

    model_config = ConfigDict(from_attributes=True)
