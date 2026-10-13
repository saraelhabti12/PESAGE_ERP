import { Warehouse } from './warehouse';
import { Product } from './catalog';

export type StockStatus = 'OUT_OF_STOCK' | 'LOW' | 'NORMAL' | 'OVERSTOCK';

export type StockMovementType =
  | 'PURCHASE_RECEIPT'
  | 'SALE'
  | 'RETURN_IN'
  | 'RETURN_OUT'
  | 'ADJUSTMENT_IN'
  | 'ADJUSTMENT_OUT'
  | 'TRANSFER_IN'
  | 'TRANSFER_OUT'
  | 'MANUAL_IN'
  | 'MANUAL_OUT';

export type StockReservationStatus = 'ACTIVE' | 'RELEASED' | 'CONSUMED' | 'CANCELLED';

export interface StockBalance {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  minimum_quantity?: number | null;
  maximum_quantity?: number | null;
  status: StockStatus;
  valuation: number;
  product?: Product | null;
  warehouse?: Warehouse | null;
  created_at: string;
  updated_at: string;
}

export interface StockMovement {
  id: number;
  product_id: number;
  warehouse_id: number;
  movement_type: StockMovementType;
  quantity: number;
  quantity_before: number;
  quantity_after: number;
  reference_type?: string | null;
  reference_id?: number | null;
  reason?: string | null;
  created_by?: number | null;
  created_at: string;
  product?: Product | null;
  warehouse?: Warehouse | null;
}

export interface StockAdjustmentCreate {
  product_id: number;
  warehouse_id: number;
  new_quantity: number;
  reason: string;
}

export interface StockTransferCreate {
  product_id: number;
  source_warehouse_id: number;
  dest_warehouse_id: number;
  quantity: number;
  reason?: string;
}

export interface StockTransferResponse {
  product_id: number;
  source_warehouse_id: number;
  dest_warehouse_id: number;
  quantity_transferred: number;
  source_quantity: number;
  dest_quantity: number;
  transfer_out_movement_id: number;
  transfer_in_movement_id: number;
}

export interface StockReservation {
  id: number;
  product_id: number;
  warehouse_id: number;
  quantity: number;
  status: StockReservationStatus;
  reference_type?: string | null;
  reference_id?: number | null;
  expires_at?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  product?: Product | null;
  warehouse?: Warehouse | null;
}

export interface StockThresholdUpdate {
  minimum_quantity?: number | null;
  maximum_quantity?: number | null;
}

export interface StockStats {
  managed_products?: number;
  total_tracked_products?: number;
  tracked_products_count?: number;
  total_stock_balances?: number;
  total_quantity?: number;
  total_value_ht?: number;
  total_stock_value: number;
  low_stock?: number;
  low_stock_count: number;
  out_of_stock?: number;
  out_of_stock_count: number;
  overstock?: number;
  overstock_count?: number;
  active_warehouses?: number;
  movement_count?: number;
  total_movements_today: number;
}
