import { BusinessPartner } from './partner';
import { Product } from './catalog';
import { Warehouse } from './warehouse';
import { Sale } from './sales';

export type DeliveryNoteStatus = 'DRAFT' | 'DELIVERED' | 'CANCELLED';

export interface DeliveryNoteItem {
  id: number;
  delivery_note_id: number;
  sale_item_id: number;
  product_id: number;
  warehouse_id?: number | null;
  ordered_quantity: number;
  delivered_quantity: number;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  product?: Product;
  warehouse?: Warehouse;
}

export interface DeliveryNote {
  id: number;
  reference: string;
  sale_id: number;
  customer_id: number;
  delivery_date: string;
  status: DeliveryNoteStatus;
  shipping_address?: string | null;
  tracking_number?: string | null;
  notes?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  sale?: Sale;
  customer?: BusinessPartner;
  creator?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  };
  items: DeliveryNoteItem[];
}

export interface DeliveryProgressItem {
  sale_item_id: number;
  product_id: number;
  product_name: string;
  product_sku: string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  ordered_quantity: number;
  delivered_quantity: number;
  remaining_quantity: number;
}

export interface SaleDeliveryProgress {
  sale_id: number;
  sale_reference: string;
  sale_status: string;
  items: DeliveryProgressItem[];
}

export interface DeliveryNoteItemFormData {
  sale_item_id: number;
  delivered_quantity: number;
  notes?: string;
}

export interface DeliveryNoteFormData {
  reference: string;
  sale_id: number;
  delivery_date: string;
  shipping_address?: string;
  tracking_number?: string;
  notes?: string;
  items: DeliveryNoteItemFormData[];
}
