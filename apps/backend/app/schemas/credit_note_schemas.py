from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, Field

from app.models.credit_note_model import CreditNoteReason, CreditNoteStatus
from app.schemas.sale_schemas import CustomerSummary, ProductSummary, UserSummary


# --------------------------------------------------
# Credit Note Item Schemas
# --------------------------------------------------
class CreditNoteItemBase(BaseModel):
    product_id: Optional[int] = None
    invoice_item_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    description: str = Field(..., max_length=255)
    quantity: float = Field(gt=0, description="Quantité retournée ou créditée")
    unit_price_ht: float = Field(ge=0, description="Prix unitaire HT")
    tax_rate: float = Field(default=20.0, ge=0)
    discount_rate: float = Field(default=0.0, ge=0, le=100)
    return_to_stock: bool = Field(default=False, description="Réintégrer physiquement en stock")


class CreditNoteItemCreate(CreditNoteItemBase):
    pass


class CreditNoteItemRead(BaseModel):
    id: int
    credit_note_id: int
    product_id: Optional[int] = None
    invoice_item_id: Optional[int] = None
    warehouse_id: Optional[int] = None
    description: str
    quantity: float
    unit_price_ht: float
    tax_rate: float
    discount_rate: float
    line_subtotal_ht: float
    line_discount: float
    line_tax: float
    line_total_ttc: float
    return_to_stock: bool
    created_at: datetime
    updated_at: datetime
    product: Optional[ProductSummary] = None

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Invoice Reference for Credit Note
# --------------------------------------------------
class InvoiceSummaryForCreditNote(BaseModel):
    id: int
    reference: str
    invoice_date: datetime
    total_ttc: float
    amount_paid: float
    amount_due: float
    status: str

    model_config = ConfigDict(from_attributes=True)


# --------------------------------------------------
# Credit Note Schemas
# --------------------------------------------------
class CreditNoteBase(BaseModel):
    invoice_id: int
    credit_note_date: Optional[datetime] = None
    reason: CreditNoteReason = Field(default=CreditNoteReason.RETURN)
    reason_details: Optional[str] = None
    notes: Optional[str] = None


class CreditNoteCreate(CreditNoteBase):
    items: List[CreditNoteItemCreate] = Field(..., min_length=1, description="Au moins une ligne d'avoir est requise")


class CreditNoteUpdate(BaseModel):
    notes: Optional[str] = None


class CreditNoteRead(BaseModel):
    id: int
    reference: str
    invoice_id: int
    customer_id: int
    credit_note_date: datetime
    reason: CreditNoteReason
    reason_details: Optional[str] = None
    status: CreditNoteStatus
    subtotal_ht: float
    discount_amount: float
    tax_amount: float
    total_ttc: float
    notes: Optional[str] = None
    created_by: int
    created_at: datetime
    updated_at: datetime
    customer: Optional[CustomerSummary] = None
    invoice: Optional[InvoiceSummaryForCreditNote] = None
    creator: Optional[UserSummary] = None
    items: List[CreditNoteItemRead] = []

    model_config = ConfigDict(from_attributes=True)


class CreditNoteListResponse(BaseModel):
    items: List[CreditNoteRead]
    total: int
    page: int
    size: int
    pages: int

    model_config = ConfigDict(from_attributes=True)
