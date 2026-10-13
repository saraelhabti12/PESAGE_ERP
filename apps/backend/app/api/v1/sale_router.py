from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.sale_schemas import (
    SaleCreate,
    SaleRead,
    SaleUpdate,
)
from app.security.deps import get_current_user, require_permission
from app.services.sale_services import SaleService

router = APIRouter(prefix="/sales", tags=["Sales"])


@router.get(
    "",
    response_model=List[SaleRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("sales.view"))],
)
def list_sales(
    search: Optional[str] = Query(None),
    customer: Optional[int] = Query(None, alias="customer_id"),
    status_filter: Optional[str] = Query(None, alias="status"),
    date_from: Optional[datetime] = Query(None),
    date_to: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.view")),
):
    """Lists sales with optional search, customer, status, and date filters."""
    skip = (page - 1) * size
    sales, _ = SaleService.list_sales(
        db=db,
        search=search,
        customer_id=customer,
        status_filter=status_filter,
        date_from=date_from,
        date_to=date_to,
        skip=skip,
        limit=size,
    )
    return sales


@router.post(
    "",
    response_model=SaleRead,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("sales.create"))],
)
def create_sale(
    data: SaleCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Creates a new sales order in DRAFT status."""
    return SaleService.create_sale(db=db, data=data, user_id=current_user.id)


@router.get(
    "/{sale_id}",
    response_model=SaleRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("sales.view"))],
)
def get_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.view")),
):
    """Retrieves a single sales order by ID with line items, customer, and creator."""
    return SaleService.get_sale(db=db, sale_id=sale_id)


@router.put(
    "/{sale_id}",
    response_model=SaleRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("sales.update"))],
)
def update_sale(
    sale_id: int,
    data: SaleUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.update")),
):
    """Updates a draft sales order and recalculates line items and totals."""
    return SaleService.update_sale(db=db, sale_id=sale_id, data=data)


@router.delete(
    "/{sale_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=[Depends(require_permission("sales.delete"))],
)
def delete_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("sales.delete")),
):
    """Deletes a draft or cancelled sales order."""
    SaleService.delete_sale(db=db, sale_id=sale_id)
    return None


@router.post(
    "/{sale_id}/confirm",
    response_model=SaleRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("sales.confirm"))],
)
def confirm_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Confirms the sale order and exits stock atomically for tracked products."""
    return SaleService.confirm_sale(db=db, sale_id=sale_id, user_id=current_user.id)


@router.post(
    "/{sale_id}/cancel",
    response_model=SaleRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("sales.cancel"))],
)
def cancel_sale(
    sale_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancels a sales order."""
    return SaleService.cancel_sale(db=db, sale_id=sale_id, user_id=current_user.id)
