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
    supplier_invoices_due: float = 0.0


class SalesDashboardStats(BaseModel):
    total_orders: int
    draft_orders: int
    confirmed_orders: int
    cancelled_orders: int
    total_subtotal_ht: float
    total_tax_amount: float
    total_ttc: float


class QuotesDashboardStats(BaseModel):
    total_quotes: int = 0
    draft_quotes: int = 0
    sent_quotes: int = 0
    accepted_quotes: int = 0
    rejected_quotes: int = 0
    expired_quotes: int = 0
    total_ttc: float = 0.0


class InvoicesDashboardStats(BaseModel):
    total_invoices: int = 0
    draft_invoices: int = 0
    issued_invoices: int = 0
    partially_paid_invoices: int = 0
    paid_invoices: int = 0
    overdue_invoices: int = 0
    total_invoiced_ttc: float = 0.0
    total_amount_paid: float = 0.0
    total_amount_due: float = 0.0
    credit_notes_total: int = 0
    credit_notes_amount: float = 0.0
    # Supplier Invoices & Payments
    supplier_invoices_total: int = 0
    supplier_invoiced_ttc: float = 0.0
    supplier_amount_paid: float = 0.0
    supplier_amount_due: float = 0.0
    month_collected_amount: float = 0.0
    supplier_payments_count: int = 0
    supplier_payments_amount: float = 0.0


class MaintenanceDashboardStats(BaseModel):
    total_interventions: int = 0
    month_interventions: int = 0
    in_progress_interventions: int = 0
    completed_interventions: int = 0
    urgent_interventions: int = 0
    total_equipments: int = 0
    upcoming_maintenances: int = 0
    maintenance_cost_month: float = 0.0
    maintenance_cost_year: float = 0.0


class PaymentsDashboardStats(BaseModel):
    total_payments: int = 0
    total_collected_amount: float = 0.0


class StockDashboardStats(BaseModel):
    managed_products: int = 0
    total_quantity: float = 0.0
    total_value_ht: float = 0.0
    low_stock: int = 0
    out_of_stock: int = 0
    overstock: int = 0
    active_warehouses: int = 0
    movement_count: int = 0


class ExpensesDashboardStats(BaseModel):
    total_expenses: float = 0.0
    this_month: float = 0.0
    this_year: float = 0.0
    fixed_expenses: float = 0.0
    variable_expenses: float = 0.0


class VehiclesDashboardStats(BaseModel):
    total_vehicles: int = 0
    fuel_cost_month: float = 0.0
    maintenance_cost_month: float = 0.0
    total_expenses_month: float = 0.0


class RecentActivityItem(BaseModel):
    id: str
    type: str
    title: str
    reference: Optional[str] = None
    user_name: Optional[str] = None
    status: Optional[str] = None
    created_at: datetime


class DashboardStatsResponse(BaseModel):
    catalog: CatalogDashboardStats
    partners: PartnersDashboardStats
    purchases: PurchasesDashboardStats
    sales: Optional[SalesDashboardStats] = None
    quotes: Optional[QuotesDashboardStats] = None
    invoices: Optional[InvoicesDashboardStats] = None
    payments: Optional[PaymentsDashboardStats] = None
    stock: Optional[StockDashboardStats] = None
    expenses: Optional[ExpensesDashboardStats] = None
    vehicles: Optional[VehiclesDashboardStats] = None
    maintenance: Optional[MaintenanceDashboardStats] = None
    recent_activity: List[RecentActivityItem]

    model_config = ConfigDict(from_attributes=True)
