from typing import Dict, List, Optional
from pydantic import BaseModel, ConfigDict


class CommercialStatistics(BaseModel):
    quotes_total: int
    quotes_accepted: int
    quotes_pending: int

    sales_total: int
    sales_confirmed: int
    sales_cancelled: int
    sales_total_ht: float
    sales_total_ttc: float

    invoices_total: int
    invoices_paid: int
    invoices_partial: int
    invoices_unpaid: int
    invoices_overdue: int
    total_invoiced_ttc: float
    total_paid: float
    total_due: float

    credit_notes_total: int
    credit_notes_amount: float

    purchases_total: int
    purchases_total_ttc: float
    supplier_amount_due: float

    model_config = ConfigDict(from_attributes=True)


class MonthlyTrendReportItem(BaseModel):
    month: str
    amount: float
    count: int


class PartnerPerformanceReportItem(BaseModel):
    partner_id: int
    partner_code: str
    partner_name: str
    total_amount: float
    document_count: int


class OverdueInvoiceReportItem(BaseModel):
    invoice_id: int
    reference: str
    partner_name: str
    due_date: str
    days_overdue: int
    total_ttc: float
    amount_due: float


class CommercialReportsBundle(BaseModel):
    sales_by_month: List[MonthlyTrendReportItem]
    invoices_by_month: List[MonthlyTrendReportItem]
    payments_by_month: List[MonthlyTrendReportItem]
    purchases_by_month: List[MonthlyTrendReportItem]
    top_customers_by_revenue: List[PartnerPerformanceReportItem]
    top_suppliers_by_purchases: List[PartnerPerformanceReportItem]
    overdue_invoices: List[OverdueInvoiceReportItem]

    model_config = ConfigDict(from_attributes=True)


class TopCustomerReport(BaseModel):
    customer_id: int
    code: str
    name: str
    total_ht: float
    total_ttc: float
    orders_count: int


class TopProductReport(BaseModel):
    product_id: int
    sku: str
    designation: str
    category_name: Optional[str] = None
    total_quantity: float
    total_ht: float


class MonthlyTrendMarginItem(BaseModel):
    period: str
    sales_ht: float
    sales_ttc: float
    purchases_ht: float
    expenses_ht: float
    margin_ht: float


class CommercialReportResponse(BaseModel):
    period_start: Optional[str] = None
    period_end: Optional[str] = None
    total_turnover_ht: float
    total_turnover_ttc: float
    total_collected_ttc: float
    total_outstanding_due: float
    total_sales_count: int
    total_invoices_count: int
    total_credit_notes_amount_ttc: float
    top_customers: List[TopCustomerReport] = []
    top_products: List[TopProductReport] = []
    monthly_trend: List[MonthlyTrendMarginItem] = []

    model_config = ConfigDict(from_attributes=True)
