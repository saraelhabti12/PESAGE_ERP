from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.models.stock_model import WarehouseType
from app.schemas.stock_schemas import (
    WarehouseCreate,
    WarehouseUpdate,
    WarehouseResponse,
)
from app.services.stock_services import WarehouseService
from app.security.deps import require_permission

router = APIRouter(prefix="/warehouses", tags=["Warehouses"])


@router.get(
    "",
    response_model=List[WarehouseResponse],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("warehouses.view"))],
)
def list_warehouses(
    search: Optional[str] = Query(None),
    type: Optional[WarehouseType] = Query(None),
    is_active: Optional[bool] = Query(None),
    db: Session = Depends(get_db),
):
    """Lists all warehouses with optional search and type/status filters."""
    return WarehouseService.list_warehouses(
        db, search=search, type_filter=type.value if type else None, is_active=is_active
    )


@router.get(
    "/{warehouse_id}",
    response_model=WarehouseResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("warehouses.view"))],
)
def get_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
):
    """Retrieves a single warehouse by ID."""
    return WarehouseService.get_warehouse(db, warehouse_id)


@router.post(
    "",
    response_model=WarehouseResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(require_permission("warehouses.create"))],
)
def create_warehouse(
    data: WarehouseCreate,
    db: Session = Depends(get_db),
):
    """Creates a new warehouse."""
    return WarehouseService.create_warehouse(db, data)


@router.put(
    "/{warehouse_id}",
    response_model=WarehouseResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("warehouses.update"))],
)
def update_warehouse(
    warehouse_id: int,
    data: WarehouseUpdate,
    db: Session = Depends(get_db),
):
    """Updates an existing warehouse."""
    return WarehouseService.update_warehouse(db, warehouse_id, data)


@router.patch(
    "/{warehouse_id}/toggle-active",
    response_model=WarehouseResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("warehouses.update"))],
)
def toggle_warehouse_active(
    warehouse_id: int,
    db: Session = Depends(get_db),
):
    """Toggles active state of a warehouse (deactivation / reactivation)."""
    wh = WarehouseService.get_warehouse(db, warehouse_id)
    return WarehouseService.update_warehouse(db, warehouse_id, WarehouseUpdate(is_active=not wh.is_active))


@router.delete(
    "/{warehouse_id}",
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("warehouses.delete"))],
)
def delete_warehouse(
    warehouse_id: int,
    db: Session = Depends(get_db),
):
    """Deletes a warehouse if it has no movement history or positive stock."""
    WarehouseService.delete_warehouse(db, warehouse_id)
    return {"message": "Dépôt supprimé avec succès."}

