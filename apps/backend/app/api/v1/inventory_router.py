from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.schemas.stock_schemas import (
    InventorySessionCreate,
    InventorySessionRead,
    InventoryItemCount,
    InventoryItemRead,
)
from app.services.stock_services import InventoryService
from app.security.deps import require_permission

router = APIRouter(prefix="/inventory", tags=["Inventory"])


@router.get(
    "",
    response_model=List[InventorySessionRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("inventory.view"))],
)
def list_inventory_sessions(
    warehouse_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Lists inventory counting sessions with filters."""
    skip = (page - 1) * size
    items, _ = InventoryService.list_sessions(
        db, warehouse_id=warehouse_id, status_filter=status_filter, skip=skip, limit=size
    )
    return items


@router.get(
    "/{session_id}",
    response_model=InventorySessionRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("inventory.view"))],
)
def get_inventory_session(
    session_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves detailed inventory session with product counts."""
    return InventoryService.get_session(db, session_id)


@router.post(
    "",
    response_model=InventorySessionRead,
    status_code=status.HTTP_201_CREATED,
)
def create_inventory_session(
    data: InventorySessionCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.create")),
):
    """Creates a new inventory session and pre-populates stock items."""
    return InventoryService.create_session(
        db,
        warehouse_id=data.warehouse_id,
        notes=data.notes,
        user_id=current_user.id,
    )


@router.post(
    "/{session_id}/start",
    response_model=InventorySessionRead,
    status_code=status.HTTP_200_OK,
)
def start_inventory_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.create")),
):
    """Starts the inventory counting session."""
    return InventoryService.start_session(db, session_id, current_user.id)


@router.put(
    "/{session_id}/items/{product_id}",
    response_model=InventoryItemRead,
    status_code=status.HTTP_200_OK,
)
def update_inventory_item_count(
    session_id: int,
    product_id: int,
    data: InventoryItemCount,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.create")),
):
    """Updates physical counted quantity for a specific product."""
    return InventoryService.update_item_count(
        db,
        session_id=session_id,
        product_id=product_id,
        counted_quantity=data.counted_quantity,
        reason=data.reason,
    )


@router.post(
    "/{session_id}/validate",
    response_model=InventorySessionRead,
    status_code=status.HTTP_200_OK,
)
def validate_inventory_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.validate")),
):
    """Validates the inventory session, creating adjustment movements for discrepancies."""
    return InventoryService.validate_session(db, session_id, current_user.id)


@router.post(
    "/{session_id}/cancel",
    response_model=InventorySessionRead,
    status_code=status.HTTP_200_OK,
)
def cancel_inventory_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("inventory.cancel")),
):
    """Cancels an inventory session."""
    return InventoryService.cancel_session(db, session_id, current_user.id)
