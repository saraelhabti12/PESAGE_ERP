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
}

export interface RecentActivityItem {
  id: string;
  type: 'product' | 'category' | 'partner' | 'purchase_order' | 'purchase_receipt' | string;
  title: string;
  reference?: string | null;
  user_name?: string | null;
  status?: string | null;
  created_at: string;
}

export interface DashboardStatsResponse {
  catalog: CatalogDashboardStats;
  partners: PartnersDashboardStats;
  purchases: PurchasesDashboardStats;
  recent_activity: RecentActivityItem[];
}
