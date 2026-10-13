import { BusinessPartner } from './partner';
import { Product } from './catalog';
import { Warehouse } from './warehouse';
import { Sale } from './sales';
import { PurchaseOrder } from './purchase';
import { Payment } from './payments';

export type InvoiceStatus = 'DRAFT' | 'ISSUED' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE' | 'CANCELLED';
export type InvoiceType = 'CUSTOMER' | 'SUPPLIER';

export interface InvoiceItem {
  id: number;
  invoice_id: number;
  product_id: number;
  warehouse_id?: number | null;
  sale_item_id?: number | null;
  description?: string | null;
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

export interface Invoice {
  id: number;
  reference: string;
  invoice_type: InvoiceType;
  customer_id?: number | null;
  supplier_id?: number | null;
  sale_id?: number | null;
  purchase_order_id?: number | null;
  invoice_date: string;
  due_date: string;
  status: InvoiceStatus;
  payment_terms?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  subtotal_ht: number;
  discount_amount: number;
  tax_amount: number;
  total_ttc: number;
  amount_paid: number;
  amount_due: number;
  days_until_due?: number;
  days_overdue?: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  customer?: BusinessPartner;
  supplier?: BusinessPartner;
  sale?: Sale;
  purchase_order?: PurchaseOrder;
  creator?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  items: InvoiceItem[];
  payments: Payment[];
}

export interface InvoiceItemFormData {
  product_id: string | number;
  warehouse_id?: string | number;
  description?: string;
  quantity: number;
  unit_price_ht: number;
  tax_rate: number;
  discount_rate: number;
}

export interface InvoiceFormData {
  reference: string;
  invoice_type: InvoiceType;
  customer_id?: string | number;
  supplier_id?: string | number;
  sale_id?: number;
  purchase_order_id?: number;
  invoice_date: string;
  due_date?: string;
  payment_terms: string;
  payment_method?: string;
  notes: string;
  items: InvoiceItemFormData[];
}

export interface InvoiceFromSaleInput {
  sale_id: number;
  reference?: string;
  invoice_date?: string;
  payment_terms?: string;
  payment_method?: string;
  notes?: string;
}

export interface InvoiceFromPurchaseInput {
  purchase_order_id: number;
  reference?: string;
  invoice_date?: string;
  due_date?: string;
  payment_terms?: string;
  payment_method?: string;
  notes?: string;
}
