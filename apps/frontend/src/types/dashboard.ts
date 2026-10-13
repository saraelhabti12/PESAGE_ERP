export interface CatalogDashboardStats {
  total_products: number;
  active_products: number;
  inactive_products: number;
  total_categories: number;
  total_product_types: number;
  total_brands: number;
  total_units: number;
}

export interface PartnersDashboardStats {
  total_customers: number;
  active_customers: number;
  total_suppliers: number;
  active_suppliers: number;
}

export interface PurchasesDashboardStats {
  total_orders: number;
  draft_orders: number;
  pending_orders: number;
  approved_orders: number;
  partially_received_orders: number;
  received_orders: number;
  total_subtotal_ht: number;
  total_tax_amount: number;
  total_ttc: number;
  supplier_invoices_due: number;
}

export interface SalesDashboardStats {
  total_orders: number;
  draft_orders: number;
  confirmed_orders: number;
  cancelled_orders: number;
  total_subtotal_ht: number;
  total_tax_amount: number;
  total_ttc: number;
}

export interface StockDashboardStats {
  managed_products: number;
  total_quantity: number;
  total_value_ht: number;
  low_stock: number;
  out_of_stock: number;
  overstock: number;
  active_warehouses: number;
  movement_count: number;
}

export interface RecentActivityItem {
  id: string;
  type: string;
  title: string;
  reference?: string | null;
  user_name?: string | null;
  status?: string | null;
  created_at: string;
}

export interface QuotesDashboardStats {
  total_quotes: number;
  draft_quotes: number;
  sent_quotes: number;
  accepted_quotes: number;
  rejected_quotes: number;
  expired_quotes: number;
  total_ttc: number;
}

export interface InvoicesDashboardStats {
  total_invoices: number;
  draft_invoices: number;
  issued_invoices: number;
  partially_paid_invoices: number;
  paid_invoices: number;
  overdue_invoices: number;
  total_invoiced_ttc: number;
  total_amount_paid: number;
  total_amount_due: number;
  credit_notes_total: number;
  credit_notes_amount: number;
  supplier_invoices_total?: number;
  supplier_invoiced_ttc?: number;
  supplier_amount_paid?: number;
  supplier_amount_due?: number;
  month_collected_amount?: number;
  supplier_payments_count?: number;
  supplier_payments_amount?: number;
}

export interface MaintenanceDashboardStats {
  total_interventions: number;
  month_interventions: number;
  in_progress_interventions: number;
  completed_interventions: number;
  urgent_interventions: number;
  total_equipments: number;
  upcoming_maintenances: number;
  maintenance_cost_month: number;
  maintenance_cost_year: number;
}

export interface PaymentsDashboardStats {
  total_payments: number;
  total_collected_amount: number;
}

export interface ExpensesDashboardStats {
  total_expenses: number;
  this_month: number;
  this_year: number;
  fixed_expenses: number;
  variable_expenses: number;
}

export interface VehiclesDashboardStats {
  total_vehicles: number;
  fuel_cost_month: number;
  maintenance_cost_month: number;
  total_expenses_month: number;
}

export interface DashboardStatsResponse {
  catalog: CatalogDashboardStats;
  partners: PartnersDashboardStats;
  purchases: PurchasesDashboardStats;
  sales?: SalesDashboardStats | null;
  quotes?: QuotesDashboardStats | null;
  invoices?: InvoicesDashboardStats | null;
  payments?: PaymentsDashboardStats | null;
  stock?: StockDashboardStats | null;
  expenses?: ExpensesDashboardStats | null;
  vehicles?: VehiclesDashboardStats | null;
  maintenance?: MaintenanceDashboardStats | null;
  recent_activity: RecentActivityItem[];
}

