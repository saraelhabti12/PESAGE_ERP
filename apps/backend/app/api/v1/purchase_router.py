from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.purchase_schemas import (
    PurchaseOrderCreate,
    PurchaseOrderDetail,
    PurchaseOrderRead,
    PurchaseOrderUpdate,
    PurchaseReceiptCreate,
    PurchaseReceiptRead,
)
from app.security.deps import require_permission
from app.services.purchase_services import PurchaseReceiptService, PurchaseService

router = APIRouter(tags=["Purchases & Receipts"])


# ----------------------------------------------------
# PURCHASE ORDERS
# ----------------------------------------------------
@router.get(
    "/purchases",
    response_model=List[PurchaseOrderRead],
    status_code=status.HTTP_200_OK,
)
def get_purchases(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    search: Optional[str] = Query(None),
    supplier_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases.view")),
):
    """List purchase orders with filtering and pagination."""
    skip = (page - 1) * size
    orders, total = PurchaseService.list_purchase_orders(
        db=db,
        search=search,
        supplier_id=supplier_id,
        status_filter=status,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=size,
    )
    result = []
    for o in orders:
        read_obj = PurchaseOrderRead.model_validate(o)
        read_obj.items_count = len(o.items)
        result.append(read_obj)
    return result


@router.post(
    "/purchases",
    response_model=PurchaseOrderDetail,
    status_code=status.HTTP_201_CREATED,
)
def create_purchase(
    data: PurchaseOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases.create")),
):
    """Create a new purchase order with lines and recalculated totals."""
    order = PurchaseService.create_purchase_order(db=db, data=data, user_id=current_user.id)
    return PurchaseService.get_purchase_order(db=db, order_id=order.id)


@router.get(
    "/purchases/{id}",
    response_model=PurchaseOrderDetail,
    status_code=status.HTTP_200_OK,
)
def get_purchase_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases.view")),
):
    """Get full purchase order profile with supplier, lines, and receipts history."""
    return PurchaseService.get_purchase_order(db=db, order_id=id)


@router.put(
    "/purchases/{id}",
    response_model=PurchaseOrderDetail,
    status_code=status.HTTP_200_OK,
)
def update_purchase(
    id: int,
    data: PurchaseOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases.update")),
):
    """Update a draft or pending purchase order."""
    order = PurchaseService.update_purchase_order(db=db, order_id=id, data=data)
    return PurchaseService.get_purchase_order(db=db, order_id=order.id)


@router.delete(
    "/purchases/{id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def delete_purchase(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases.delete")),
):
    """Delete a draft or cancelled purchase order."""
    PurchaseService.delete_purchase_order(db=db, order_id=id)
    return None


@router.post(
    "/purchases/{id}/approve",
    response_model=PurchaseOrderDetail,
    status_code=status.HTTP_200_OK,
)
def approve_purchase(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases.approve")),
):
    """Approve a purchase order for receiving."""
    PurchaseService.approve_purchase_order(db=db, order_id=id, user_id=current_user.id)
    return PurchaseService.get_purchase_order(db=db, order_id=id)


@router.post(
    "/purchases/{id}/cancel",
    response_model=PurchaseOrderDetail,
    status_code=status.HTTP_200_OK,
)
def cancel_purchase(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchases.update")),
):
    """Cancel a purchase order if not yet received."""
    PurchaseService.cancel_purchase_order(db=db, order_id=id, user_id=current_user.id)
    return PurchaseService.get_purchase_order(db=db, order_id=id)


# ----------------------------------------------------
# PURCHASE RECEIPTS
# ----------------------------------------------------
@router.get(
    "/purchase-receipts",
    response_model=List[PurchaseReceiptRead],
    status_code=status.HTTP_200_OK,
)
def get_receipts(
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=100),
    purchase_order_id: Optional[int] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_receipts.view")),
):
    """List purchase receipts."""
    skip = (page - 1) * size
    receipts, total = PurchaseReceiptService.list_receipts(
        db=db,
        purchase_order_id=purchase_order_id,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=size,
    )
    return receipts


@router.post(
    "/purchase-receipts",
    response_model=PurchaseReceiptRead,
    status_code=status.HTTP_201_CREATED,
)
def create_receipt(
    data: PurchaseReceiptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_receipts.create")),
):
    """Create and confirm a receipt for a purchase order, incrementing received quantities."""
    receipt = PurchaseReceiptService.create_receipt(db=db, data=data, user_id=current_user.id)
    return PurchaseReceiptService.get_receipt(db=db, receipt_id=receipt.id)


@router.get(
    "/purchase-receipts/{id}",
    response_model=PurchaseReceiptRead,
    status_code=status.HTTP_200_OK,
)
def get_receipt_by_id(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("purchase_receipts.view")),
):
    """Get purchase receipt by ID."""
    return PurchaseReceiptService.get_receipt(db=db, receipt_id=id)
