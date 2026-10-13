from datetime import datetime, timezone
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.invoice_model import InvoiceStatus, InvoiceType
from app.schemas.sale_schemas import CustomerSummary, ProductSummary, UserSummary


# --------------------------------------------------
# Partner summary for supplier
# --------------------------------------------------
class SupplierSummary(BaseModel):
    id: int
    code: str
    legal_name: str
    phone: Optional[str] = None
    email: Optional[str] = None
    ice: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Invoice Item Schemas
# --------------------------------------------------
class InvoiceItemBase(BaseModel):
    product_id: Optional[int] = None
    description: str = Field(..., max_length=255)
    quantity: float = Field(gt=0, description="Quantity must be strictly positive")
    unit_price_ht: Optional[float] = Field(None, ge=0, description="Unit price HT")
    tax_rate: Optional[float] = Field(None, ge=0, description="Tax rate %")
    discount_rate: float = Field(default=0.00, ge=0, le=100, description="Discount rate % between 0 and 100")


class InvoiceItemCreate(InvoiceItemBase):
    pass


class InvoiceItemRead(BaseModel):
    id: int
    invoice_id: int
    product_id: Optional[int] = None
    description: str
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
# Payment Summary for Invoice
# --------------------------------------------------
class PaymentSummaryForInvoice(BaseModel):
    id: int
    reference: str
    payment_date: datetime
    amount: float
    payment_method: str
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    created_by: int
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class CreditNoteSummaryForInvoice(BaseModel):
    id: int
    reference: str
    credit_note_date: datetime
    reason: str
    status: str
    total_ttc: float

    model_config = ConfigDict(from_attributes=True)


class SaleSummaryForInvoice(BaseModel):
    id: int
    reference: str
    order_date: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


class PurchaseSummaryForInvoice(BaseModel):
    id: int
    reference: str
    order_date: datetime
    status: str

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Invoice Schemas
# --------------------------------------------------
class InvoiceBase(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)
    invoice_type: InvoiceType = Field(default=InvoiceType.CUSTOMER)
    customer_id: Optional[int] = None
    supplier_id: Optional[int] = None
    sale_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class InvoiceCreate(InvoiceBase):
    items: List[InvoiceItemCreate] = Field(..., min_length=1, description="At least one line item is required")


class InvoiceFromSaleCreate(BaseModel):
    sale_id: int
    invoice_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class InvoiceFromPurchaseCreate(BaseModel):
    purchase_order_id: int
    invoice_date: Optional[datetime] = None
    due_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class InvoiceUpdate(BaseModel):
    due_date: Optional[datetime] = None
    payment_terms: Optional[str] = Field(None, max_length=255)
    payment_method: Optional[str] = Field(None, max_length=100)
    notes: Optional[str] = None


class InvoiceRead(BaseModel):
    id: int
    reference: str
    invoice_type: InvoiceType
    customer_id: Optional[int] = None
    supplier_id: Optional[int] = None
    sale_id: Optional[int] = None
    purchase_order_id: Optional[int] = None
    invoice_date: datetime
    due_date: datetime
    status: InvoiceStatus
    payment_terms: Optional[str] = None
    payment_method: Optional[str] = None
    notes: Optional[str] = None
    subtotal_ht: float
    discount_amount: float
    tax_amount: float
    total_ttc: float
    amount_paid: float
    amount_due: float
    created_by: int
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerSummary] = None
    supplier: Optional[SupplierSummary] = None
    sale: Optional[SaleSummaryForInvoice] = None
    purchase_order: Optional[PurchaseSummaryForInvoice] = None
    creator: Optional[UserSummary] = None
    items: List[InvoiceItemRead] = []
    payments: List[PaymentSummaryForInvoice] = []
    credit_notes: List[CreditNoteSummaryForInvoice] = []
    
    # Computed fields
    days_until_due: Optional[int] = None
    days_overdue: Optional[int] = None

    model_config = ConfigDict(from_attributes=True)


class InvoiceListResponse(BaseModel):
    items: List[InvoiceRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
