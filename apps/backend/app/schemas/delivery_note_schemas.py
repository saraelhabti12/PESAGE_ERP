from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.delivery_note_model import DeliveryNoteStatus
from app.schemas.sale_schemas import CustomerSummary, ProductSummary, UserSummary, WarehouseSummary


# --------------------------------------------------
# Delivery Progress Schemas (for BL creation modal)
# --------------------------------------------------
class DeliveryProgressItem(BaseModel):
    sale_item_id: int
    product_id: int
    product_name: str
    product_sku: str
    warehouse_id: Optional[int] = None
    warehouse_name: Optional[str] = None
    ordered_quantity: float
    delivered_quantity: float
    remaining_quantity: float


class SaleDeliveryProgressResponse(BaseModel):
    sale_id: int
    sale_reference: str
    sale_status: str
    items: List[DeliveryProgressItem]


# --------------------------------------------------
# Delivery Note Item Schemas
# --------------------------------------------------
class DeliveryNoteItemBase(BaseModel):
    product_id: Optional[int] = None
    sale_item_id: Optional[int] = None
    warehouse_id: Optional[int] = Field(None, description="Source warehouse for delivery note line")
    delivered_quantity: float = Field(gt=0, description="Quantity being delivered now")
    notes: Optional[str] = None


class DeliveryNoteItemCreate(DeliveryNoteItemBase):
    pass


class DeliveryNoteItemRead(BaseModel):
    id: int
    delivery_note_id: int
    product_id: int
    warehouse_id: Optional[int] = None
    ordered_quantity: float
    delivered_quantity: float
    remaining_quantity: float
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductSummary] = None
    warehouse: Optional[WarehouseSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Delivery Note Schemas
# --------------------------------------------------
class DeliveryNoteBase(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)
    sale_id: int
    customer_id: Optional[int] = None
    delivery_date: Optional[datetime] = None
    delivery_address: Optional[str] = Field(None, max_length=255)
    shipping_address: Optional[str] = Field(None, max_length=255)
    tracking_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class DeliveryNoteCreate(DeliveryNoteBase):
    items: List[DeliveryNoteItemCreate] = Field(..., min_length=1, description="At least one line item is required")


class DeliveryNoteUpdate(BaseModel):
    delivery_date: Optional[datetime] = None
    delivery_address: Optional[str] = Field(None, max_length=255)
    shipping_address: Optional[str] = Field(None, max_length=255)
    tracking_number: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class SaleSummaryForDelivery(BaseModel):
    id: int
    reference: str
    order_date: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class DeliveryNoteRead(BaseModel):
    id: int
    reference: str
    sale_id: int
    customer_id: int
    delivery_date: datetime
    delivery_address: Optional[str] = None
    shipping_address: Optional[str] = None
    tracking_number: Optional[str] = None
    status: DeliveryNoteStatus
    notes: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    sale: Optional[SaleSummaryForDelivery] = None
    customer: Optional[CustomerSummary] = None
    creator: Optional[UserSummary] = None
    items: List[DeliveryNoteItemRead] = []

    model_config = ConfigDict(from_attributes=True)


class DeliveryNoteListResponse(BaseModel):
    items: List[DeliveryNoteRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)

