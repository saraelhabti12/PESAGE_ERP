export enum VehicleStatus {
  AVAILABLE = 'AVAILABLE',
  IN_USE = 'IN_USE',
  MAINTENANCE = 'MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export interface Vehicle {
  id: number;
  code: string;
  brand: string;
  model: string;
  registration_number: string;
  status: VehicleStatus;
  year?: number | null;
  mileage: number;
  fuel_type?: string | null;
  driver_id?: number | null;
  insurance_expiry?: string | null;
  technical_inspection_expiry?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  driver?: {
    id: number;
    code: string;
    first_name: string;
    last_name: string;
    phone?: string | null;
  } | null;
}

export interface VehicleMaintenance {
  id: number;
  vehicle_id: number;
  maintenance_type: string;
  maintenance_date: string;
  mileage_at_maintenance?: number | null;
  description: string;
  service_provider?: string | null;
  parts_cost: number;
  labor_cost: number;
  total_cost: number;
  invoice_reference?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  vehicle?: Vehicle | null;
}

export interface FuelLog {
  id: number;
  vehicle_id: number;
  date: string;
  quantity_liters: number;
  price_per_liter: number;
  total_cost: number;
  mileage?: number | null;
  station_name?: string | null;
  fuel_card_number?: string | null;
  invoice_reference?: string | null;
  created_by?: number | null;
  created_at: string;
  vehicle?: Vehicle | null;
}

export interface VehicleCreate {
  code?: string;
  brand: string;
  model: string;
  registration_number: string;
  status?: VehicleStatus;
  year?: number;
  mileage?: number;
  fuel_type?: string;
  driver_id?: number | null;
  insurance_expiry?: string | null;
  technical_inspection_expiry?: string | null;
  notes?: string;
}

export interface VehicleMaintenanceCreate {
  vehicle_id: number;
  maintenance_type: string;
  maintenance_date?: string;
  mileage_at_maintenance?: number;
  description: string;
  service_provider?: string;
  parts_cost?: number;
  labor_cost?: number;
  invoice_reference?: string;
  notes?: string;
}

export interface FuelLogCreate {
  vehicle_id: number;
  date?: string;
  quantity_liters: number;
  price_per_liter: number;
  mileage?: number;
  station_name?: string;
  fuel_card_number?: string;
  invoice_reference?: string;
}

export interface VehicleStats {
  total_vehicles: number;
  active_vehicles: number;
  in_maintenance: number;
  expiring_insurances_30d: number;
  expiring_inspections_30d: number;
  total_fuel_cost_month: number;
  total_maintenance_cost_month: number;
  total_fleet_expenses_month: number;
  by_vehicle: {
    vehicle_id: number;
    code: string;
    registration_number: string;
    brand: string;
    model: string;
    fuel_cost_month: number;
    maintenance_cost_month: number;
    total_cost_month: number;
  }[];
}
