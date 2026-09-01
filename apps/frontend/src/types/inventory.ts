import { Warehouse } from './warehouse';
import { Product } from './catalog';

export type InventorySessionStatus = 'DRAFT' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface InventoryItem {
  id: number;
  inventory_session_id: number;
  product_id: number;
  system_quantity: number;
  counted_quantity?: number | null;
  difference?: number | null;
  reason?: string | null;
  product?: Product | null;
}

export interface InventorySession {
  id: number;
  reference: string;
  warehouse_id: number;
  status: InventorySessionStatus;
  notes?: string | null;
  created_by?: number | null;
  validated_by?: number | null;
  created_at: string;
  validated_at?: string | null;
  warehouse?: Warehouse | null;
  items: InventoryItem[];
}

export interface InventorySessionCreate {
  warehouse_id: number;
  notes?: string;
}

export interface InventoryItemCount {
  product_id: number;
  counted_quantity: number;
  reason?: string;
}
