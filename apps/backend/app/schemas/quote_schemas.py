from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.quote_model import QuoteStatus
from app.schemas.sale_schemas import CustomerSummary, ProductSummary, UserSummary


# --------------------------------------------------
# Quote Item Schemas
# --------------------------------------------------
class QuoteItemBase(BaseModel):
    product_id: int
    quantity: float = Field(gt=0, description="Quantity must be strictly positive")
    unit_price_ht: Optional[float] = Field(None, ge=0, description="Unit price HT (prefilled from product if None)")
    tax_rate: Optional[float] = Field(None, ge=0, description="Tax rate % (prefilled from product if None)")
    discount_rate: float = Field(default=0.00, ge=0, le=100, description="Discount rate % between 0 and 100")


class QuoteItemCreate(QuoteItemBase):
    pass


class QuoteItemUpdate(BaseModel):
    product_id: Optional[int] = None
    quantity: Optional[float] = Field(None, gt=0)
    unit_price_ht: Optional[float] = Field(None, ge=0)
    tax_rate: Optional[float] = Field(None, ge=0)
    discount_rate: Optional[float] = Field(None, ge=0, le=100)


class QuoteItemRead(BaseModel):
    id: int
    quote_id: int
    product_id: int
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

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Quote Schemas
# --------------------------------------------------
class QuoteBase(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)
    customer_id: int
    quote_date: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    delivery_delay: Optional[str] = Field(None, max_length=100)
    realization_delay: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class QuoteCreate(QuoteBase):
    items: List[QuoteItemCreate] = Field(..., min_length=1, description="At least one line item is required")


class QuoteUpdate(BaseModel):
    customer_id: Optional[int] = None
    quote_date: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    delivery_delay: Optional[str] = Field(None, max_length=100)
    realization_delay: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None
    items: Optional[List[QuoteItemCreate]] = Field(None, min_length=1)


class QuoteRead(BaseModel):
    id: int
    reference: str
    customer_id: int
    quote_date: datetime
    valid_until: Optional[datetime] = None
    status: QuoteStatus
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
    items: List[QuoteItemRead] = []

    model_config = ConfigDict(from_attributes=True)


class QuoteListResponse(BaseModel):
    items: List[QuoteRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
