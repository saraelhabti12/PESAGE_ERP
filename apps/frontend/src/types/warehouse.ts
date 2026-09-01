export type WarehouseType = 'MAIN' | 'WAREHOUSE' | 'WORKSHOP' | 'VEHICLE' | 'OTHER';

export interface Warehouse {
  id: number;
  code: string;
  name: string;
  type: WarehouseType;
  address?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface WarehouseCreate {
  code: string;
  name: string;
  type: WarehouseType;
  address?: string;
  description?: string;
  is_active?: boolean;
}

export interface WarehouseUpdate {
  code?: string;
  name?: string;
  type?: WarehouseType;
  address?: string | null;
  description?: string | null;
  is_active?: boolean;
}
