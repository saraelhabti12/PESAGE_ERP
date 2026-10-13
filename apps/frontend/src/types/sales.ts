import { BusinessPartner } from './partner';
import { Product } from './catalog';
import { Warehouse } from './warehouse';

export type SaleStatus = 'DRAFT' | 'CONFIRMED' | 'PARTIALLY_DELIVERED' | 'DELIVERED' | 'CANCELLED';

export interface SaleItem {
  id: number;
  sale_id: number;
  product_id: number;
  warehouse_id?: number | null;
  quantity: number;
  unit_price_ht: number;
  tax_rate: number;
  discount_rate: number;
  line_subtotal_ht: number;
  line_discount: number;
  line_tax: number;
  line_total_ttc: number;
  created_at: string;
  updated_at: string;
  product?: Product;
  warehouse?: Warehouse;
}

export interface Sale {
  id: number;
  reference: string;
  customer_id: number;
  quote_id?: number | null;
  order_date: string;
  status: SaleStatus;
  payment_terms?: string | null;
  payment_method?: string | null;
  delivery_delay?: string | null;
  realization_delay?: string | null;
  notes?: string | null;
  subtotal_ht: number;
  discount_amount: number;
  tax_amount: number;
  total_ttc: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  customer?: BusinessPartner;
  quote?: {
    id: number;
    reference: string;
  } | null;
  creator?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  items: SaleItem[];
}

export interface SaleItemFormData {
  product_id: string | number;
  warehouse_id?: string | number;
  quantity: number;
  unit_price_ht: number;
  tax_rate: number;
  discount_rate: number;
}

export interface SaleFormData {
  reference: string;
  customer_id: string | number;
  quote_id?: string | number | null;
  order_date: string;
  payment_terms: string;
  payment_method: string;
  delivery_delay?: string;
  realization_delay?: string;
  notes: string;
  items: SaleItemFormData[];
}

