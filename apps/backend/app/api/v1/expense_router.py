from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.expense_model import ExpenseStatus
from app.models.user_model import User
from app.schemas.expense_schemas import (
    ExpenseCategoryCreate,
    ExpenseCategoryRead,
    ExpenseCategoryUpdate,
    ExpenseCreate,
    ExpenseRead,
    ExpenseStatistics,
    ExpenseUpdate,
    RecurringExpenseCreate,
    RecurringExpenseRead,
    RecurringExpenseUpdate,
)
from app.security.deps import get_current_user, require_permission
from app.services.expense_services import ExpenseService

router = APIRouter(prefix="/expenses", tags=["Expenses & Cash"])


# ----------------------------------------------------
# Statistics & Categories
# ----------------------------------------------------
@router.get(
    "/stats",
    response_model=ExpenseStatistics,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
@router.get(
    "/statistics",
    response_model=ExpenseStatistics,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def get_expense_statistics(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.view")),
):
    """Returns comprehensive expense breakdown and statistics."""
    return ExpenseService.get_statistics(db=db)


@router.post(
    "/generate-recurring",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def generate_recurring_expenses(
    target_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Triggers generation of due recurring expenses for the target period (idempotent)."""
    return ExpenseService.generate_due_recurring_expenses(db=db, user_id=current_user.id, target_date=target_date)


@router.get(
    "/categories",
    response_model=List[ExpenseCategoryRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def list_categories(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.view")),
):
    """Lists all active expense categories."""
    return ExpenseService.list_categories(db=db)


@router.post(
    "/categories",
    response_model=ExpenseCategoryRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("settings.manage"))],
)
def create_category(
    data: ExpenseCategoryCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    """Creates a custom expense category."""
    return ExpenseService.create_category(db=db, data=data)


@router.put(
    "/categories/{cat_id}",
    response_model=ExpenseCategoryRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("settings.manage"))],
)
def update_category(
    cat_id: int,
    data: ExpenseCategoryUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("settings.manage")),
):
    """Updates an expense category."""
    return ExpenseService.update_category(db=db, cat_id=cat_id, data=data)


# ----------------------------------------------------
# Recurring Expenses
# ----------------------------------------------------
@router.get(
    "/recurring",
    response_model=List[RecurringExpenseRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def list_recurring_expenses(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.view")),
):
    """Lists configured recurring expenses."""
    return ExpenseService.list_recurring_expenses(db=db)


@router.post(
    "/recurring",
    response_model=RecurringExpenseRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def create_recurring_expense(
    data: RecurringExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Configures a recurring expense template."""
    return ExpenseService.create_recurring_expense(db=db, data=data, user_id=current_user.id)


@router.put(
    "/recurring/{rec_id}",
    response_model=RecurringExpenseRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.update"))],
)
def update_recurring_expense(
    rec_id: int,
    data: RecurringExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.update")),
):
    """Updates a recurring expense definition."""
    return ExpenseService.update_recurring_expense(db=db, rec_id=rec_id, data=data)


# ----------------------------------------------------
# Variable Expenses
# ----------------------------------------------------
@router.get(
    "",
    response_model=List[ExpenseRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def list_expenses(
    search: Optional[str] = Query(None),
    category_id: Optional[int] = Query(None),
    employee_id: Optional[int] = Query(None),
    vehicle_id: Optional[int] = Query(None),
    status_filter: Optional[ExpenseStatus] = Query(None, alias="status"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    payment_method: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.view")),
):
    """Lists expenses with advanced filtering (category, employee, vehicle, dates, amounts)."""
    skip = (page - 1) * size
    items, _ = ExpenseService.list_expenses(
        db=db,
        search=search,
        category_id=category_id,
        employee_id=employee_id,
        vehicle_id=vehicle_id,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        min_amount=min_amount,
        max_amount=max_amount,
        payment_method=payment_method,
        skip=skip,
        limit=size,
    )
    return items


@router.post(
    "",
    response_model=ExpenseRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def create_expense(
    data: ExpenseCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Records an expense entry."""
    return ExpenseService.create_expense(db=db, data=data, user_id=current_user.id)


@router.get(
    "/{expense_id}",
    response_model=ExpenseRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.view"))],
)
def get_expense(
    expense_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.view")),
):
    """Retrieves an expense by ID."""
    return ExpenseService.get_expense(db=db, expense_id=expense_id)


@router.put(
    "/{expense_id}",
    response_model=ExpenseRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.update"))],
)
def update_expense(
    expense_id: int,
    data: ExpenseUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("invoices.update")),
):
    """Updates an expense record."""
    return ExpenseService.update_expense(db=db, expense_id=expense_id, data=data)
