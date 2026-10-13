from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class PartnerTypeEnum(str, Enum):
    CUSTOMER = "CUSTOMER"
    SUPPLIER = "SUPPLIER"
    CUSTOMER_SUPPLIER = "CUSTOMER_SUPPLIER"


class AddressTypeEnum(str, Enum):
    MAIN = "MAIN"
    BILLING = "BILLING"
    SHIPPING = "SHIPPING"
    OTHER = "OTHER"


# --- Contact Schemas ---
class PartnerContactBase(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    is_primary: bool = False
    notes: Optional[str] = Field(None, max_length=500)


class PartnerContactCreate(PartnerContactBase):
    pass


class PartnerContactUpdate(BaseModel):
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    position: Optional[str] = Field(None, max_length=100)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    is_primary: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=500)


class PartnerContactResponse(PartnerContactBase):
    id: int
    partner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Address Schemas ---
class PartnerAddressBase(BaseModel):
    type: AddressTypeEnum = AddressTypeEnum.MAIN
    label: Optional[str] = Field(None, max_length=100)
    address_line: str = Field(..., min_length=1, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field("Maroc", max_length=100)
    is_primary: bool = False


class PartnerAddressCreate(PartnerAddressBase):
    pass


class PartnerAddressUpdate(BaseModel):
    type: Optional[AddressTypeEnum] = None
    label: Optional[str] = Field(None, max_length=100)
    address_line: Optional[str] = Field(None, min_length=1, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    country: Optional[str] = Field(None, max_length=100)
    is_primary: Optional[bool] = None


class PartnerAddressResponse(PartnerAddressBase):
    id: int
    partner_id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# --- Business Partner Schemas ---
class PartnerBase(BaseModel):
    code: Optional[str] = Field(None, max_length=50)
    legal_name: str = Field(..., min_length=1, max_length=255)
    trade_name: Optional[str] = Field(None, max_length=255)
    partner_type: PartnerTypeEnum = PartnerTypeEnum.CUSTOMER
    ice: Optional[str] = Field(None, max_length=50)
    tax_id: Optional[str] = Field(None, max_length=50)
    registration_number: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field("Maroc", max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    is_active: bool = True


class PartnerCreate(PartnerBase):
    pass


class PartnerUpdate(BaseModel):
    code: Optional[str] = Field(None, min_length=1, max_length=50)
    legal_name: Optional[str] = Field(None, min_length=1, max_length=255)
    trade_name: Optional[str] = Field(None, max_length=255)
    partner_type: Optional[PartnerTypeEnum] = None
    ice: Optional[str] = Field(None, max_length=50)
    tax_id: Optional[str] = Field(None, max_length=50)
    registration_number: Optional[str] = Field(None, max_length=50)
    phone: Optional[str] = Field(None, max_length=50)
    email: Optional[EmailStr] = None
    website: Optional[str] = Field(None, max_length=255)
    address: Optional[str] = Field(None, max_length=500)
    city: Optional[str] = Field(None, max_length=100)
    country: Optional[str] = Field(None, max_length=100)
    postal_code: Optional[str] = Field(None, max_length=20)
    notes: Optional[str] = None
    is_active: Optional[bool] = None


class PartnerResponse(PartnerBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class PartnerDetailResponse(PartnerResponse):
    contacts: List[PartnerContactResponse] = []
    addresses: List[PartnerAddressResponse] = []

    model_config = ConfigDict(from_attributes=True)


class PartnerSummaryResponse(BaseModel):
    partner_id: int
    partner_type: str
    # Customer metrics
    total_quotes: int = 0
    total_sales: int = 0
    total_sales_ttc: float = 0.0
    total_invoices: int = 0
    total_invoiced_ttc: float = 0.0
    amount_paid: float = 0.0
    amount_due: float = 0.0
    total_delivery_notes: int = 0
    total_credit_notes: int = 0
    total_credit_notes_amount: float = 0.0
    total_interventions: int = 0
    total_equipments: int = 0
    # Supplier metrics
    total_purchases: int = 0
    total_purchases_ttc: float = 0.0
    total_supplier_invoices: int = 0
    total_supplier_invoiced_ttc: float = 0.0
    supplier_amount_paid: float = 0.0
    supplier_amount_due: float = 0.0
    total_receipts: int = 0
    total_payments: int = 0
    total_documents: int = 0
    last_transaction_date: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

