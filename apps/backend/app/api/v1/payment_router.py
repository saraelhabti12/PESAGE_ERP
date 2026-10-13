from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.payment_schemas import (
    CustomerFinancialSummary,
    PaymentCreate,
    PaymentRead,
)
from app.security.deps import get_current_user, require_permission
from app.services.payment_services import PaymentService

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get(
    "",
    response_model=List[PaymentRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("payments.view"))],
)
def list_payments(
    search: Optional[str] = Query(None),
    customer: Optional[int] = Query(None, alias="customer_id"),
    supplier: Optional[int] = Query(None, alias="supplier_id"),
    partner: Optional[int] = Query(None, alias="partner_id"),
    invoice: Optional[int] = Query(None, alias="invoice_id"),
    payment_method: Optional[str] = Query(None),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.view")),
):
    """Lists payments with optional search, customer, supplier, invoice, method, and date filters."""
    partner_id = customer or supplier or partner
    skip = (page - 1) * size
    payments, _ = PaymentService.list_payments(
        db=db,
        search=search,
        customer_id=partner_id,
        invoice_id=invoice,
        payment_method=payment_method,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=size,
    )
    return payments


@router.post(
    "",
    response_model=PaymentRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("payments.create"))],
)
def create_payment(
    data: PaymentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Records a new customer payment for an invoice and updates remaining due and status."""
    return PaymentService.create_payment(db=db, data=data, user_id=current_user.id)


@router.get(
    "/customer-summary/{customer_id}",
    response_model=CustomerFinancialSummary,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("payments.view"))],
)
def get_customer_financial_summary(
    customer_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.view")),
):
    """Returns the financial summary (invoiced, paid, balance due) for a customer."""
    return PaymentService.get_customer_financial_summary(db=db, customer_id=customer_id)


@router.get(
    "/{payment_id}",
    response_model=PaymentRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("payments.view"))],
)
def get_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.view")),
):
    """Retrieves a single payment by ID."""
    return PaymentService.get_payment(db=db, payment_id=payment_id)


@router.delete(
    "/{payment_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("payments.delete"))],
)
def delete_payment(
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("payments.delete")),
):
    """Deletes/reverses a payment and restores invoice remaining due and status."""
    PaymentService.delete_payment(db=db, payment_id=payment_id)
    return None
