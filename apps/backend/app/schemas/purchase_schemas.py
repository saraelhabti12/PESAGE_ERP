from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.purchase_model import PurchaseOrderStatus, PurchaseReceiptStatus


# --------------------------------------------------
# Nested Summaries
# --------------------------------------------------
class PartnerSummary(BaseModel):
    id: int
    code: str
    legal_name: str
    trade_name: Optional[str] = None
    partner_type: str
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class ProductSummary(BaseModel):
    id: int
    sku: str
    designation: str
    barcode: Optional[str] = None
    purchase_price: float
    sale_price: float
    tax_rate: float
    track_stock: bool

    model_config = ConfigDict(from_attributes=True)


class UserSummary(BaseModel):
    id: int
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Purchase Order Item Schemas
# --------------------------------------------------
class PurchaseOrderItemBase(BaseModel):
    product_id: int
    quantity_ordered: float = Field(gt=0, description="Quantity must be greater than 0")
    unit_price_ht: float = Field(ge=0, default=0.00, description="Unit price HT must be >= 0")
    tax_rate: float = Field(ge=0, default=20.00, description="Tax rate % must be >= 0")
    discount_rate: float = Field(ge=0, le=100, default=0.00, description="Discount rate % between 0 and 100")


class PurchaseOrderItemCreate(PurchaseOrderItemBase):
    pass


class PurchaseOrderItemUpdate(BaseModel):
    product_id: Optional[int] = None
    quantity_ordered: Optional[float] = Field(None, gt=0)
    unit_price_ht: Optional[float] = Field(None, ge=0)
    tax_rate: Optional[float] = Field(None, ge=0)
    discount_rate: Optional[float] = Field(None, ge=0, le=100)


class PurchaseOrderItemRead(BaseModel):
    id: int
    purchase_order_id: int
    product_id: int
    quantity_ordered: float
    unit_price_ht: float
    tax_rate: float
    discount_rate: float
    line_subtotal_ht: float
    line_tax: float
    line_total_ttc: float
    quantity_received: float
    quantity_remaining: float
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Purchase Order Schemas
# --------------------------------------------------
class PurchaseOrderBase(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)
    supplier_id: int
    order_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class PurchaseOrderCreate(PurchaseOrderBase):
    items: List[PurchaseOrderItemCreate] = Field(min_length=1, description="Order must contain at least one line item")


class PurchaseOrderUpdate(BaseModel):
    supplier_id: Optional[int] = None
    order_date: Optional[datetime] = None
    expected_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    items: Optional[List[PurchaseOrderItemCreate]] = None


class PurchaseOrderRead(BaseModel):
    id: int
    reference: str
    supplier_id: int
    order_date: datetime
    expected_date: Optional[datetime] = None
    status: PurchaseOrderStatus
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    subtotal_ht: float
    tax_amount: float
    total_ttc: float
    created_by: int
    created_at: datetime
    updated_at: datetime
    supplier: Optional[PartnerSummary] = None
    creator: Optional[UserSummary] = None
    items_count: Optional[int] = 0
    items: List[PurchaseOrderItemRead] = []

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
class WarehouseSummary(BaseModel):
    id: int
    code: str
    name: str
    type: Optional[str] = None
    is_active: Optional[bool] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Purchase Receipt Schemas
# --------------------------------------------------
class PurchaseReceiptItemCreate(BaseModel):
    purchase_order_item_id: int
    product_id: int
    quantity_received: float = Field(gt=0, description="Quantity received must be > 0")
    warehouse_id: Optional[int] = None
    notes: Optional[str] = None


class PurchaseReceiptItemRead(BaseModel):
    id: int
    purchase_receipt_id: int
    purchase_order_item_id: int
    product_id: int
    warehouse_id: Optional[int] = None
    quantity_received: float
    notes: Optional[str] = None
    created_at: datetime
    product: Optional[ProductSummary] = None
    warehouse: Optional[WarehouseSummary] = None

    model_config = ConfigDict(from_attributes=True)


class PurchaseReceiptCreate(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)
    purchase_order_id: int
    warehouse_id: Optional[int] = None
    receipt_date: Optional[datetime] = None
    notes: Optional[str] = None
    items: List[PurchaseReceiptItemCreate] = Field(min_length=1, description="Receipt must contain at least one item")


class PurchaseReceiptRead(BaseModel):
    id: int
    reference: str
    purchase_order_id: int
    warehouse_id: Optional[int] = None
    receipt_date: datetime
    status: PurchaseReceiptStatus
    notes: Optional[str] = None
    received_by: int
    created_at: datetime
    updated_at: datetime
    receiver: Optional[UserSummary] = None
    warehouse: Optional[WarehouseSummary] = None
    items: List[PurchaseReceiptItemRead] = []

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Detailed Purchase Order (including lines and receipts)
# --------------------------------------------------
class PurchaseOrderDetail(BaseModel):
    id: int
    reference: str
    supplier_id: int
    order_date: datetime
    expected_date: Optional[datetime] = None
    status: PurchaseOrderStatus
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    subtotal_ht: float
    tax_amount: float
    total_ttc: float
    created_by: int
    created_at: datetime
    updated_at: datetime
    supplier: Optional[PartnerSummary] = None
    creator: Optional[UserSummary] = None
    items: List[PurchaseOrderItemRead] = []
    receipts: List[PurchaseReceiptRead] = []

    model_config = ConfigDict(from_attributes=True)
