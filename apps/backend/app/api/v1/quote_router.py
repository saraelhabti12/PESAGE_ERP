from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.quote_schemas import (
    QuoteCreate,
    QuoteRead,
    QuoteUpdate,
)
from app.schemas.sale_schemas import SaleRead
from app.security.deps import get_current_user, require_permission
from app.services.quote_services import QuoteService

router = APIRouter(prefix="/quotes", tags=["Quotes"])


@router.get(
    "",
    response_model=List[QuoteRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("quotes.view"))],
)
def list_quotes(
    search: Optional[str] = Query(None),
    customer: Optional[int] = Query(None, alias="customer_id"),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quotes.view")),
):
    """Lists quotes with optional search, customer, status, and date filters."""
    skip = (page - 1) * size
    quotes, _ = QuoteService.list_quotes(
        db=db,
        search=search,
        customer_id=customer,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=size,
    )
    return quotes


@router.post(
    "",
    response_model=QuoteRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("quotes.create"))],
)
def create_quote(
    data: QuoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new quote in DRAFT status."""
    return QuoteService.create_quote(db=db, data=data, user_id=current_user.id)


@router.get(
    "/{quote_id}",
    response_model=QuoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("quotes.view"))],
)
def get_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quotes.view")),
):
    """Retrieves a single quote by ID with items, customer, and creator."""
    return QuoteService.get_quote(db=db, quote_id=quote_id)


@router.put(
    "/{quote_id}",
    response_model=QuoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("quotes.update"))],
)
def update_quote(
    quote_id: int,
    data: QuoteUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quotes.update")),
):
    """Updates a draft quote and recalculates line items and totals."""
    return QuoteService.update_quote(db=db, quote_id=quote_id, data=data)


@router.delete(
    "/{quote_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("quotes.delete"))],
)
def delete_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("quotes.delete")),
):
    """Deletes a draft or cancelled quote."""
    QuoteService.delete_quote(db=db, quote_id=quote_id)
    return None


@router.post(
    "/{quote_id}/send",
    response_model=QuoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("quotes.send"))],
)
def send_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks a quote as SENT."""
    return QuoteService.send_quote(db=db, quote_id=quote_id)


@router.post(
    "/{quote_id}/accept",
    response_model=QuoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("quotes.accept"))],
)
def accept_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks a quote as ACCEPTED."""
    return QuoteService.accept_quote(db=db, quote_id=quote_id)


@router.post(
    "/{quote_id}/reject",
    response_model=QuoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("quotes.reject"))],
)
def reject_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Marks a quote as REJECTED."""
    return QuoteService.reject_quote(db=db, quote_id=quote_id)


@router.post(
    "/{quote_id}/cancel",
    response_model=QuoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("quotes.update"))],
)
def cancel_quote(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels a quote."""
    return QuoteService.cancel_quote(db=db, quote_id=quote_id)


@router.post(
    "/{quote_id}/convert-to-sale",
    response_model=SaleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("quotes.convert"))],
)
def convert_to_sale(
    quote_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Converts a quote to a sales order in DRAFT status."""
    return QuoteService.convert_to_sale(db=db, quote_id=quote_id, user_id=current_user.id)
