from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.credit_note_model import CreditNoteReason
from app.models.user_model import User
from app.schemas.credit_note_schemas import CreditNoteCreate, CreditNoteRead
from app.security.deps import get_current_user, require_permission, require_any_permission
from app.services.credit_note_services import CreditNoteService

router = APIRouter(prefix="/credit-notes", tags=["Credit Notes"])


@router.get(
    "",
    response_model=List[CreditNoteRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_any_permission("invoices.view", "customers.view", "partners.view"))],
)
def list_credit_notes(
    search: Optional[str] = Query(None),
    customer: Optional[int] = Query(None, alias="customer_id"),
    invoice: Optional[int] = Query(None, alias="invoice_id"),
    reason: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    min_amount: Optional[float] = Query(None),
    max_amount: Optional[float] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("invoices.view", "customers.view", "partners.view")),
):
    """Lists credit notes with advanced filtering (search, customer, invoice, reason, dates, amounts)."""
    skip = (page - 1) * size
    items, _ = CreditNoteService.list_credit_notes(
        db=db,
        search=search,
        customer_id=customer,
        invoice_id=invoice,
        reason=reason,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        min_amount=min_amount,
        max_amount=max_amount,
        skip=skip,
        limit=size,
    )
    return items


@router.post(
    "",
    response_model=CreditNoteRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("invoices.create"))],
)
def create_credit_note(
    data: CreditNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a credit note (avoir) linked to an invoice with optional stock return."""
    return CreditNoteService.create_credit_note(db=db, data=data, user_id=current_user.id)


@router.get(
    "/{credit_note_id}",
    response_model=CreditNoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_any_permission("invoices.view", "customers.view", "partners.view"))],
)
def get_credit_note(
    credit_note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_any_permission("invoices.view", "customers.view", "partners.view")),
):
    """Retrieves a single credit note by ID."""
    return CreditNoteService.get_credit_note(db=db, credit_note_id=credit_note_id)


@router.post(
    "/{credit_note_id}/cancel",
    response_model=CreditNoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("invoices.cancel"))],
)
def cancel_credit_note(
    credit_note_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels a credit note and reverses any physical stock returns."""
    return CreditNoteService.cancel_credit_note(db=db, credit_note_id=credit_note_id, user_id=current_user.id)
