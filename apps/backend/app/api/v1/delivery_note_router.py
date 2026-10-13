from datetime import datetime
from typing import Dict, List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.delivery_note_schemas import (
    DeliveryNoteCreate,
    DeliveryNoteRead,
    SaleDeliveryProgressResponse,
)
from app.security.deps import get_current_user, require_permission
from app.services.delivery_note_services import DeliveryNoteService

router = APIRouter(prefix="/delivery-notes", tags=["Delivery Notes"])


@router.get(
    "",
    response_model=List[DeliveryNoteRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("delivery_notes.view"))],
)
def list_delivery_notes(
    search: Optional[str] = Query(None),
    customer: Optional[int] = Query(None, alias="customer_id"),
    sale: Optional[int] = Query(None, alias="sale_id"),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delivery_notes.view")),
):
    """Lists delivery notes with optional search, customer, sale, status, and date filters."""
    skip = (page - 1) * size
    dns, _ = DeliveryNoteService.list_delivery_notes(
        db=db,
        search=search,
        customer_id=customer,
        sale_id=sale,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=size,
    )
    return dns


@router.post(
    "",
    response_model=DeliveryNoteRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("delivery_notes.create"))],
)
def create_delivery_note(
    data: DeliveryNoteCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new delivery note against a confirmed/partially delivered sale without double stock deduction."""
    return DeliveryNoteService.create_delivery_note(db=db, data=data, user_id=current_user.id)


@router.get(
    "/sales/{sale_id}/delivery-progress",
    response_model=SaleDeliveryProgressResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("delivery_notes.view"))],
)
def get_sale_delivery_progress_detailed(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delivery_notes.view")),
):
    """Returns detailed delivery progress including items, quantities, and warehouse info."""
    return DeliveryNoteService.get_sale_delivery_progress_detailed(db=db, sale_id=sale_id)


@router.get(
    "/sale-progress/{sale_id}",
    response_model=Dict[int, Dict[str, float]],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("delivery_notes.view"))],
)
def get_sale_delivery_progress(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delivery_notes.view")),
):
    """Returns the ordered, delivered, and remaining quantities for each product of a sale."""
    return DeliveryNoteService.get_sale_delivery_progress(db=db, sale_id=sale_id)



@router.get(
    "/{dn_id}",
    response_model=DeliveryNoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("delivery_notes.view"))],
)
def get_delivery_note(
    dn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("delivery_notes.view")),
):
    """Retrieves a single delivery note by ID with line items, sale, and customer."""
    return DeliveryNoteService.get_delivery_note(db=db, dn_id=dn_id)


@router.post(
    "/{dn_id}/cancel",
    response_model=DeliveryNoteRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("delivery_notes.cancel"))],
)
def cancel_delivery_note(
    dn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels a delivery note and recalculates the sale status."""
    return DeliveryNoteService.cancel_delivery_note(db=db, dn_id=dn_id)
