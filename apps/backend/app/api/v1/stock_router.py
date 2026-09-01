from datetime import datetime
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.user_model import User
from app.models.stock_model import StockMovementType
from app.schemas.stock_schemas import (
    StockBalanceRead,
    StockMovementRead,
    StockAdjustmentCreate,
    StockTransferCreate,
    StockReservationCreate,
    StockReservationRead,
    StockThresholdUpdate,
    StockStatsResponse,
)
from app.services.stock_services import StockService
from app.security.deps import require_permission, get_current_user

router = APIRouter(prefix="/stock", tags=["Stock"])


@router.get(
    "",
    response_model=List[StockBalanceRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def list_stock(
    product_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Lists stock balances with product, warehouse, search, and status filters."""
    skip = (page - 1) * size
    items, _ = StockService.list_stock(
        db,
        product_id=product_id,
        warehouse_id=warehouse_id,
        search=search,
        status_filter=status_filter,
        skip=skip,
        limit=size,
    )
    return items


@router.get(
    "/balance",
    response_model=StockBalanceRead,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def get_single_stock_balance(
    product_id: int = Query(...),
    warehouse_id: int = Query(...),
    db: Session = Depends(get_db),
):
    """Returns the exact stock balance for a specific (product_id, warehouse_id) combination, or valid zero-stock representation."""
    return StockService.get_product_warehouse_balance(db, product_id=product_id, warehouse_id=warehouse_id)



@router.get(
    "/stats",
    response_model=StockStatsResponse,
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def get_stock_stats(
    db: Session = Depends(get_db),
):
    """Returns aggregated real stock KPIs and metrics."""
    return StockService.get_stock_stats(db)


@router.get(
    "/alerts",
    response_model=List[StockBalanceRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def get_stock_alerts(
    db: Session = Depends(get_db),
):
    """Returns stock lines that are in low stock, out of stock, or overstock status."""
    items, _ = StockService.list_stock(db, limit=200)
    return [b for b in items if b["status"] in ("OUT_OF_STOCK", "LOW", "OVERSTOCK")]


@router.get(
    "/movements",
    response_model=List[StockMovementRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock_movements.view"))],
)
def list_movements(
    product_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    movement_type: Optional[StockMovementType] = Query(None),
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Lists immutable stock movement audit logs with filters."""
    skip = (page - 1) * size
    items, _ = StockService.list_movements(
        db,
        product_id=product_id,
        warehouse_id=warehouse_id,
        movement_type=movement_type.value if movement_type else None,
        start_date=start_date,
        end_date=end_date,
        skip=skip,
        limit=size,
    )
    return items


@router.post(
    "/adjustments",
    response_model=StockBalanceRead,
    status_code=status.HTTP_200_OK,
)
def adjust_stock(
    data: StockAdjustmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.adjust")),
):
    """Performs a controlled stock adjustment, creating an immutable audit movement."""
    balance = StockService.adjust_stock(
        db,
        product_id=data.product_id,
        warehouse_id=data.warehouse_id,
        new_quantity=data.new_quantity,
        reason=data.reason,
        user_id=current_user.id,
    )
    purchase_price = float(balance.product.purchase_price) if balance.product and balance.product.purchase_price else 0.0
    return {
        "id": balance.id,
        "product_id": balance.product_id,
        "warehouse_id": balance.warehouse_id,
        "quantity": float(balance.quantity),
        "reserved_quantity": float(balance.reserved_quantity),
        "available_quantity": balance.available_quantity,
        "minimum_quantity": float(balance.minimum_quantity),
        "maximum_quantity": float(balance.maximum_quantity) if balance.maximum_quantity is not None else None,
        "status": balance.status,
        "valuation": round(float(balance.quantity) * purchase_price, 2),
        "product": balance.product,
        "warehouse": balance.warehouse,
        "created_at": balance.created_at,
        "updated_at": balance.updated_at,
    }


@router.post(
    "/transfers",
    status_code=status.HTTP_200_OK,
)
def transfer_stock(
    data: StockTransferCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock_transfers.create")),
):
    """Performs an atomic stock transfer between two warehouses."""
    source_bal, dest_bal = StockService.transfer_stock(
        db,
        product_id=data.product_id,
        source_warehouse_id=data.source_warehouse_id,
        dest_warehouse_id=data.dest_warehouse_id,
        quantity=data.quantity,
        reason=data.reason,
        user_id=current_user.id,
    )
    return {
        "message": "Transfert effectué avec succès.",
        "source_warehouse_id": source_bal.warehouse_id,
        "source_quantity": float(source_bal.quantity),
        "dest_warehouse_id": dest_bal.warehouse_id,
        "dest_quantity": float(dest_bal.quantity),
    }


@router.get(
    "/reservations",
    response_model=List[StockReservationRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock_reservations.view"))],
)
def list_reservations(
    product_id: Optional[int] = Query(None),
    warehouse_id: Optional[int] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
):
    """Lists stock reservations."""
    skip = (page - 1) * size
    items, _ = StockService.list_reservations(
        db, product_id=product_id, warehouse_id=warehouse_id, status_filter=status_filter, skip=skip, limit=size
    )
    return items


@router.post(
    "/reservations",
    response_model=StockReservationRead,
    status_code=status.HTTP_201_CREATED,
)
def create_reservation(
    data: StockReservationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock_reservations.create")),
):
    """Creates a new stock reservation if sufficient available stock exists."""
    return StockService.reserve_stock(
        db,
        product_id=data.product_id,
        warehouse_id=data.warehouse_id,
        quantity=data.quantity,
        reference_type=data.reference_type,
        reference_id=data.reference_id,
        user_id=current_user.id,
    )


@router.post(
    "/reservations/{reservation_id}/release",
    response_model=StockReservationRead,
    status_code=status.HTTP_200_OK,
)
def release_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock_reservations.release")),
):
    """Releases an active stock reservation, restoring available quantity."""
    return StockService.release_reservation(db, reservation_id, current_user.id)


@router.post(
    "/reservations/{reservation_id}/consume",
    response_model=StockReservationRead,
    status_code=status.HTTP_200_OK,
)
def consume_reservation(
    reservation_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock_reservations.consume")),
):
    """Consumes an active stock reservation, deducting stock quantity."""
    return StockService.consume_reservation(db, reservation_id, current_user.id)


@router.put(
    "/{balance_id}/thresholds",
    response_model=StockBalanceRead,
    status_code=status.HTTP_200_OK,
)
def update_thresholds(
    balance_id: int,
    data: StockThresholdUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_permission("stock.adjust")),
):
    """Updates minimum and maximum stock alert thresholds."""
    balance = StockService.update_thresholds(
        db, balance_id, min_quantity=data.minimum_quantity, max_quantity=data.maximum_quantity
    )
    purchase_price = float(balance.product.purchase_price) if balance.product and balance.product.purchase_price else 0.0
    return {
        "id": balance.id,
        "product_id": balance.product_id,
        "warehouse_id": balance.warehouse_id,
        "quantity": float(balance.quantity),
        "reserved_quantity": float(balance.reserved_quantity),
        "available_quantity": balance.available_quantity,
        "minimum_quantity": float(balance.minimum_quantity),
        "maximum_quantity": float(balance.maximum_quantity) if balance.maximum_quantity is not None else None,
        "status": balance.status,
        "valuation": round(float(balance.quantity) * purchase_price, 2),
        "product": balance.product,
        "warehouse": balance.warehouse,
        "created_at": balance.created_at,
        "updated_at": balance.updated_at,
    }


@router.get(
    "/{product_id}",
    response_model=List[StockBalanceRead],
    status_code=status.HTTP_200_OK,
    dependencies=[Depends(require_permission("stock.view"))],
)
def get_product_stock(
    product_id: int,
    warehouse_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
):
    """Returns stock balances for a given product across all warehouses or in a specific warehouse."""
    if warehouse_id:
        single = StockService.get_product_warehouse_balance(db, product_id=product_id, warehouse_id=warehouse_id)
        return [single]
    items, _ = StockService.list_stock(db, product_id=product_id, limit=100)
    return items

