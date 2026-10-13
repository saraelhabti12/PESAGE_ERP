from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.sale_model import SaleStatus


# --------------------------------------------------
# Nested Summaries
# --------------------------------------------------
class CustomerSummary(BaseModel):
    id: int
    code: str
    legal_name: str
    trade_name: Optional[str] = None
    partner_type: str
    phone: Optional[str] = None
    email: Optional[str] = None
    city: Optional[str] = None
    address: Optional[str] = None

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


class WarehouseSummary(BaseModel):
    id: int
    code: str
    name: str
    type: str

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Sale Item Schemas
# --------------------------------------------------
class SaleItemBase(BaseModel):
    product_id: int
    warehouse_id: Optional[int] = Field(None, description="Source warehouse ID for stock deduction")
    quantity: float = Field(gt=0, description="Quantity must be strictly positive")
    unit_price_ht: Optional[float] = Field(None, ge=0, description="Unit price HT (prefilled from product if None)")
    tax_rate: Optional[float] = Field(None, ge=0, description="Tax rate % (prefilled from product if None)")
    discount_rate: float = Field(default=0.00, ge=0, le=100, description="Discount rate % between 0 and 100")


class SaleItemCreate(SaleItemBase):
    pass


class SaleItemUpdate(BaseModel):
    product_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    quantity: Optional[float] = Field(None, gt=0)
    unit_price_ht: Optional[float] = Field(None, ge=0)
    tax_rate: Optional[float] = Field(None, ge=0)
    discount_rate: Optional[float] = Field(None, ge=0, le=100)


class SaleItemRead(BaseModel):
    id: int
    sale_id: int
    product_id: int
    warehouse_id: Optional[int] = None
    quantity: float
    unit_price_ht: float
    tax_rate: float
    discount_rate: float
    line_subtotal_ht: float
    line_discount: float
    line_tax: float
    line_total_ttc: float
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductSummary] = None
    warehouse: Optional[WarehouseSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Sale Schemas
# --------------------------------------------------
class SaleBase(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)
    customer_id: int
    quote_id: Optional[int] = None
    order_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    delivery_delay: Optional[str] = Field(None, max_length=100)
    realization_delay: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class SaleCreate(SaleBase):
    items: List[SaleItemCreate] = Field(..., min_length=1, description="At least one line item is required")


class SaleUpdate(BaseModel):
    customer_id: Optional[int] = None
    quote_id: Optional[int] = None
    order_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    delivery_delay: Optional[str] = Field(None, max_length=100)
    realization_delay: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    items: Optional[List[SaleItemCreate]] = Field(None, min_length=1)


class SaleRead(BaseModel):
    id: int
    reference: str
    customer_id: int
    quote_id: Optional[int] = None
    order_date: datetime
    status: SaleStatus
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    delivery_delay: Optional[str] = None
    realization_delay: Optional[str] = None
    notes: Optional[str] = None
    subtotal_ht: float
    discount_amount: float
    tax_amount: float
    total_ttc: float
    created_by: int
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerSummary] = None
    creator: Optional[UserSummary] = None
    items: List[SaleItemRead] = []

    model_config = ConfigDict(from_attributes=True)


class SaleListResponse(BaseModel):
    items: List[SaleRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
