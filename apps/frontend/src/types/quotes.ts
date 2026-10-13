import { BusinessPartner } from './partner';
import { Product } from './catalog';
import { Warehouse } from './warehouse';

export type QuoteStatus = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';

export interface QuoteItem {
  id: number;
  quote_id: number;
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

export interface Quote {
  id: number;
  reference: string;
  customer_id: number;
  quote_date: string;
  valid_until?: string | null;
  status: QuoteStatus;
  payment_terms?: string | null;
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
  creator?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  items: QuoteItem[];
}

export interface QuoteItemFormData {
  product_id: string | number;
  warehouse_id?: string | number;
  quantity: number;
  unit_price_ht: number;
  tax_rate: number;
  discount_rate: number;
}

export interface QuoteFormData {
  reference: string;
  customer_id: string | number;
  quote_date: string;
  valid_until?: string;
  payment_terms: string;
  delivery_delay?: string;
  realization_delay?: string;
  notes: string;
  items: QuoteItemFormData[];
}
