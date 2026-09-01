from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.stock_model import (
    WarehouseType,
    StockMovementType,
    StockReservationStatus,
    InventorySessionStatus,
)
from app.schemas.product_schemas import ProductResponse


# ----------------------------------------------------
# WAREHOUSE SCHEMAS
# ----------------------------------------------------
class WarehouseBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=255)
    type: WarehouseType = Field(default=WarehouseType.MAIN)
    address: Optional[str] = None
    description: Optional[str] = None
    is_active: bool = True


class WarehouseCreate(WarehouseBase):
    pass


class WarehouseUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type: Optional[WarehouseType] = None
    address: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None


class WarehouseResponse(WarehouseBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# STOCK BALANCE SCHEMAS
# ----------------------------------------------------
class WarehouseNested(BaseModel):
    id: int
    code: str
    name: str
    type: WarehouseType

    model_config = ConfigDict(from_attributes=True)


class UserNested(BaseModel):
    id: int
    first_name: str
    last_name: str
    email: str

    model_config = ConfigDict(from_attributes=True)


class StockBalanceRead(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    quantity: float
    reserved_quantity: float
    available_quantity: float
    minimum_quantity: float
    maximum_quantity: Optional[float] = None
    status: str
    valuation: float = 0.0
    product: Optional[ProductResponse] = None
    warehouse: Optional[WarehouseNested] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class StockThresholdUpdate(BaseModel):
    minimum_quantity: float = Field(default=0.0, ge=0.0)
    maximum_quantity: Optional[float] = Field(default=None, ge=0.0)


# ----------------------------------------------------
# STOCK MOVEMENT SCHEMAS
# ----------------------------------------------------
class StockMovementRead(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    movement_type: StockMovementType
    quantity: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    reason: Optional[str] = None
    created_by: Optional[int] = None
    created_at: datetime
    product: Optional[ProductResponse] = None
    warehouse: Optional[WarehouseNested] = None
    creator: Optional[UserNested] = None

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# STOCK ADJUSTMENT & TRANSFER SCHEMAS
# ----------------------------------------------------
class StockAdjustmentCreate(BaseModel):
    product_id: int
    warehouse_id: int
    new_quantity: float = Field(..., ge=0.0)
    reason: str = Field(..., min_length=1, max_length=500)


class StockTransferCreate(BaseModel):
    product_id: int
    source_warehouse_id: int
    dest_warehouse_id: int
    quantity: float = Field(..., gt=0.0)
    reason: Optional[str] = None
    reference: Optional[str] = None


# ----------------------------------------------------
# STOCK RESERVATION SCHEMAS
# ----------------------------------------------------
class StockReservationCreate(BaseModel):
    product_id: int
    warehouse_id: int
    quantity: float = Field(..., gt=0.0)
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None


class StockReservationRead(BaseModel):
    id: int
    product_id: int
    warehouse_id: int
    quantity: float
    reference_type: Optional[str] = None
    reference_id: Optional[int] = None
    status: StockReservationStatus
    reserved_by: int
    created_at: datetime
    released_at: Optional[datetime] = None
    product: Optional[ProductResponse] = None
    warehouse: Optional[WarehouseNested] = None
    user: Optional[UserNested] = None

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# INVENTORY SCHEMAS
# ----------------------------------------------------
class InventoryItemCount(BaseModel):
    product_id: int
    counted_quantity: float = Field(..., ge=0.0)
    reason: Optional[str] = None


class InventoryItemRead(BaseModel):
    id: int
    inventory_session_id: int
    product_id: int
    system_quantity: float
    counted_quantity: float
    difference: float
    reason: Optional[str] = None
    product: Optional[ProductResponse] = None

    model_config = ConfigDict(from_attributes=True)


class InventorySessionCreate(BaseModel):
    warehouse_id: int
    notes: Optional[str] = None


class InventorySessionRead(BaseModel):
    id: int
    warehouse_id: int
    reference: str
    status: InventorySessionStatus
    started_at: Optional[datetime] = None
    validated_at: Optional[datetime] = None
    created_by: int
    validated_by: Optional[int] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    warehouse: Optional[WarehouseNested] = None
    creator: Optional[UserNested] = None
    validator: Optional[UserNested] = None
    items: List[InventoryItemRead] = []

    model_config = ConfigDict(from_attributes=True)


# ----------------------------------------------------
# STOCK DASHBOARD STATS SCHEMAS
# ----------------------------------------------------
class StockStatsResponse(BaseModel):
    total_stock_value: float = 0.0
    tracked_products_count: int = 0
    out_of_stock_count: int = 0
    low_stock_count: int = 0
    overstock_count: int = 0
    total_quantity: float = 0.0
