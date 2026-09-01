from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, Field
from app.schemas.category_schemas import CategoryResponse
from app.schemas.product_type_schemas import ProductTypeResponse
from app.schemas.brand_schemas import BrandResponse
from app.schemas.unit_schemas import UnitResponse


class ProductCreate(BaseModel):
    sku: str = Field(..., min_length=1, max_length=100)
    designation: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=512)
    category_id: int
    product_type_id: int
    brand_id: Optional[int] = None
    unit_id: int
    barcode: Optional[str] = Field(None, max_length=100)
    purchase_price: float = Field(0.0, ge=0.0)
    sale_price: float = Field(0.0, ge=0.0)
    tax_rate: float = Field(0.0, ge=0.0)
    is_active: bool = True
    track_stock: bool = True


class ProductUpdate(BaseModel):
    sku: Optional[str] = Field(None, min_length=1, max_length=100)
    designation: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = Field(None, max_length=512)
    category_id: Optional[int] = None
    product_type_id: Optional[int] = None
    brand_id: Optional[int] = None
    unit_id: Optional[int] = None
    barcode: Optional[str] = Field(None, max_length=100)
    purchase_price: Optional[float] = Field(None, ge=0.0)
    sale_price: Optional[float] = Field(None, ge=0.0)
    tax_rate: Optional[float] = Field(None, ge=0.0)
    is_active: Optional[bool] = None
    track_stock: Optional[bool] = None


class ProductResponse(BaseModel):
    id: int
    sku: str
    designation: str
    description: Optional[str] = None
    category_id: int
    product_type_id: int
    brand_id: Optional[int] = None
    unit_id: int
    barcode: Optional[str] = None
    purchase_price: float
    sale_price: float
    tax_rate: float
    is_active: bool
    track_stock: bool
    created_at: datetime
    updated_at: datetime

    category: Optional[CategoryResponse] = None
    product_type: Optional[ProductTypeResponse] = None
    brand: Optional[BrandResponse] = None
    unit: Optional[UnitResponse] = None

    model_config = ConfigDict(from_attributes=True)
