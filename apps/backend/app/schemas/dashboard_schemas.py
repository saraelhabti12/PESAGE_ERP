from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, ConfigDict


class CatalogDashboardStats(BaseModel):
    total_products: int
    active_products: int
    inactive_products: int
    total_categories: int
    total_product_types: int
    total_brands: int
    total_units: int


class PartnersDashboardStats(BaseModel):
    total_customers: int
    active_customers: int
    total_suppliers: int
    active_suppliers: int


class PurchasesDashboardStats(BaseModel):
    total_orders: int
    draft_orders: int
    pending_orders: int
    approved_orders: int
    partially_received_orders: int
    received_orders: int
    total_subtotal_ht: float
    total_tax_amount: float
    total_ttc: float


class RecentActivityItem(BaseModel):
    id: str
    type: str  # 'product', 'category', 'partner', 'purchase_order', 'purchase_receipt'
    title: str
    reference: Optional[str] = None
    user_name: Optional[str] = None
    status: Optional[str] = None
    created_at: datetime


class DashboardStatsResponse(BaseModel):
    catalog: CatalogDashboardStats
    partners: PartnersDashboardStats
    purchases: PurchasesDashboardStats
    recent_activity: List[RecentActivityItem]

    model_config = ConfigDict(from_attributes=True)
