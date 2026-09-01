import { BusinessPartner } from './partner';
import { Product } from './catalog';

export type PurchaseOrderStatus =
  | 'DRAFT'
  | 'PENDING'
  | 'APPROVED'
  | 'PARTIALLY_RECEIVED'
  | 'RECEIVED'
  | 'CANCELLED';

export type PurchaseReceiptStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';

export interface PurchaseOrderItem {
  id: number;
  purchase_order_id: number;
  product_id: number;
  quantity_ordered: number;
  unit_price_ht: number;
  tax_rate: number;
  discount_rate: number;
  line_subtotal_ht: number;
  line_tax: number;
  line_total_ttc: number;
  quantity_received: number;
  quantity_remaining: number;
  created_at: string;
  updated_at: string;
  product?: Product;
}

export interface PurchaseOrderItemFormData {
  product_id: number | '';
  quantity_ordered: number | '';
  unit_price_ht: number | '';
  tax_rate: number | '';
  discount_rate: number | '';
}

export interface PurchaseReceiptItem {
  id: number;
  purchase_receipt_id: number;
  purchase_order_item_id: number;
  product_id: number;
  quantity_received: number;
  notes?: string | null;
  created_at: string;
  product?: Product;
}

export interface PurchaseReceipt {
  id: number;
  reference: string;
  purchase_order_id: number;
  receipt_date: string;
  status: PurchaseReceiptStatus;
  notes?: string | null;
  received_by: number;
  created_at: string;
  updated_at: string;
  receiver?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  items: PurchaseReceiptItem[];
}

export interface PurchaseOrder {
  id: number;
  reference: string;
  supplier_id: number;
  order_date: string;
  expected_date?: string | null;
  status: PurchaseOrderStatus;
  payment_terms?: string | null;
  payment_method?: string | null;
  notes?: string | null;
  subtotal_ht: number;
  tax_amount: number;
  total_ttc: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  supplier?: BusinessPartner;
  creator?: {
    id: number;
    email: string;
    first_name?: string;
    last_name?: string;
  };
  items_count?: number;
  items?: PurchaseOrderItem[];
  receipts?: PurchaseReceipt[];
}

export interface PurchaseOrderFormData {
  reference?: string;
  supplier_id: number | '';
  order_date: string;
  expected_date?: string;
  payment_terms?: string;
  payment_method?: string;
  notes?: string;
  items: PurchaseOrderItemFormData[];
}

export interface ReceiptItemFormData {
  purchase_order_item_id: number;
  product_id: number;
  quantity_received: number;
  notes?: string;
}

export interface ReceiptFormData {
  reference?: string;
  purchase_order_id: number;
  receipt_date: string;
  notes?: string;
  items: ReceiptItemFormData[];
}
