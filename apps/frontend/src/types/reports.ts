export interface TopCustomerReport {
  customer_id: number;
  code: string;
  name: string;
  total_ht: number;
  total_ttc: number;
  orders_count: number;
}

export interface TopProductReport {
  product_id: number;
  sku: string;
  designation: string;
  category_name?: string | null;
  total_quantity: number;
  total_ht: number;
}

export interface CommercialReportResponse {
  period_start?: string | null;
  period_end?: string | null;
  total_turnover_ht: number;
  total_turnover_ttc: number;
  total_collected_ttc: number;
  total_outstanding_due: number;
  total_sales_count: number;
  total_invoices_count: number;
  total_credit_notes_amount_ttc: number;
  top_customers: TopCustomerReport[];
  top_products: TopProductReport[];
  monthly_trend: {
    period: string;
    sales_ht: number;
    sales_ttc: number;
    purchases_ht: number;
    expenses_ht: number;
    margin_ht: number;
  }[];
}
