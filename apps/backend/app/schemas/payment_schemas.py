from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.schemas.sale_schemas import CustomerSummary, UserSummary


# --------------------------------------------------
# Invoice Summary for Payment
# --------------------------------------------------
class InvoiceSummaryForPayment(BaseModel):
    id: int
    reference: str
    invoice_date: datetime
    due_date: datetime
    status: str
    total_ttc: float
    amount_paid: float
    amount_due: float

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Payment Schemas
# --------------------------------------------------
class PaymentBase(BaseModel):
    reference: Optional[str] = Field(None, max_length=100)
    invoice_id: int
    payment_date: Optional[datetime] = None
    amount: float = Field(gt=0, description="Payment amount must be strictly positive")
    payment_method: str = Field(..., max_length=100)
    transaction_reference: Optional[str] = Field(None, max_length=150)
    notes: Optional[str] = None


class PaymentCreate(PaymentBase):
    pass


class PaymentRead(BaseModel):
    id: int
    reference: str
    invoice_id: int
    customer_id: int
    payment_date: datetime
    amount: float
    payment_method: str
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None
    created_by: int
    created_at: datetime
    customer: Optional[CustomerSummary] = None
    invoice: Optional[InvoiceSummaryForPayment] = None
    creator: Optional[UserSummary] = None

    model_config = ConfigDict(from_attributes=True)


class PaymentListResponse(BaseModel):
    items: List[PaymentRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)


class CustomerFinancialSummary(BaseModel):
    customer_id: int
    total_invoiced: float
    total_paid: float
    balance_due: float
    invoice_count: int
    unpaid_invoice_count: int

    model_config = ConfigDict(from_attributes=True)
