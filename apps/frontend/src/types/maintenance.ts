export enum EquipmentType {
  PONTS_BASCULES = 'PONTS_BASCULES',
  BALANCES_INDUSTRIELLES = 'BALANCES_INDUSTRIELLES',
  BALANCES_PLATEFORMES = 'BALANCES_PLATEFORMES',
  INDICATEURS_POIDS = 'INDICATEURS_POIDS',
  CAPTEURS_CHARGE = 'CAPTEURS_CHARGE',
  TERMINAUX_PESAGE = 'TERMINAUX_PESAGE',
  IMPRIMANTES_TICKETS = 'IMPRIMANTES_TICKETS',
  AUTRE = 'AUTRE',
}

export enum EquipmentStatus {
  OPERATIONAL = 'OPERATIONAL',
  UNDER_MAINTENANCE = 'UNDER_MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
  DECOMMISSIONED = 'DECOMMISSIONED',
}

export enum InterventionType {
  PREVENTIVE_MAINTENANCE = 'PREVENTIVE_MAINTENANCE',
  CORRECTIVE_MAINTENANCE = 'CORRECTIVE_MAINTENANCE',
  BREAKDOWN_REPAIR = 'BREAKDOWN_REPAIR',
  CALIBRATION = 'CALIBRATION',
  INSTALLATION = 'INSTALLATION',
  INSPECTION = 'INSPECTION',
  METROLOGY_LEGAL = 'METROLOGY_LEGAL',
  STAMPING = 'STAMPING',
  OTHER = 'OTHER',
}

export enum InterventionPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL',
}

export enum InterventionStatus {
  SCHEDULED = 'SCHEDULED',
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum TaskStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export interface CustomerMini {
  id: number;
  company_name?: string | null;
  legal_name?: string | null;
  trade_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  ice?: string | null;
  tax_id?: string | null;
}

export interface TechnicianMini {
  id: number;
  first_name: string;
  last_name: string;
  email?: string | null;
  phone?: string | null;
  position?: string | null;
  job_title?: string | null;
  role?: string | null;
}

export interface Equipment {
  id: number;
  equipment_code: string;
  customer_id: number;
  designation: string;
  equipment_type: EquipmentType;
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  site_name?: string | null;
  site_address?: string | null;
  city?: string | null;
  installation_date?: string | null;
  capacity_max?: number | null;
  capacity_min?: number | null;
  graduation?: number | null;
  status: EquipmentStatus;
  notes?: string | null;
  created_at: string;
  updated_at: string;
  customer?: CustomerMini | null;
  interventions_count?: number;
}

export interface EquipmentCreate {
  equipment_code?: string;
  customer_id: number;
  designation: string;
  equipment_type: EquipmentType;
  brand?: string;
  model?: string;
  serial_number?: string;
  site_name?: string;
  site_address?: string;
  city?: string;
  installation_date?: string | null;
  capacity_max?: number | null;
  capacity_min?: number | null;
  graduation?: number | null;
  status?: EquipmentStatus;
  notes?: string;
}

export interface InterventionTask {
  id: number;
  intervention_id: number;
  description: string;
  status: TaskStatus;
  notes?: string | null;
  completed_at?: string | null;
  order_index: number;
  created_at: string;
}

export interface InterventionTaskCreate {
  description: string;
  status?: TaskStatus;
  notes?: string;
  completed_at?: string | null;
  order_index?: number;
}

export interface InterventionPart {
  id: number;
  intervention_id: number;
  product_id?: number | null;
  designation: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
  total_ht: number;
  total_ttc: number;
  created_at: string;
  product?: {
    id: number;
    reference?: string | null;
    name: string;
    price?: number | null;
  } | null;
}

export interface InterventionPartCreate {
  product_id?: number | null;
  designation: string;
  quantity: number;
  unit_price: number;
  tax_rate?: number;
}

export interface Intervention {
  id: number;
  intervention_code: string;
  customer_id: number;
  equipment_id?: number | null;
  site?: string | null;
  assigned_technician_id?: number | null;
  date_start: string;
  date_end?: string | null;
  intervention_type: InterventionType;
  priority: InterventionPriority;
  status: InterventionStatus;
  problem_description?: string | null;
  diagnosis?: string | null;
  work_performed?: string | null;
  observations?: string | null;
  recommendations?: string | null;
  next_maintenance_date?: string | null;
  next_maintenance_mileage?: number | null;
  labor_cost: number;
  parts_cost: number;
  travel_cost: number;
  other_cost: number;
  total_cost: number;
  quote_id?: number | null;
  sale_id?: number | null;
  invoice_id?: number | null;
  notes?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  customer?: CustomerMini | null;
  equipment?: Equipment | null;
  technician?: TechnicianMini | null;
  tasks: InterventionTask[];
  parts: InterventionPart[];
}

export interface InterventionCreate {
  intervention_code?: string;
  customer_id: number;
  equipment_id?: number | null;
  site?: string;
  assigned_technician_id?: number | null;
  date_start?: string;
  date_end?: string | null;
  intervention_type: InterventionType;
  priority: InterventionPriority;
  status: InterventionStatus;
  problem_description?: string;
  diagnosis?: string;
  work_performed?: string;
  observations?: string;
  recommendations?: string;
  next_maintenance_date?: string | null;
  next_maintenance_mileage?: number | null;
  labor_cost?: number;
  parts_cost?: number;
  travel_cost?: number;
  other_cost?: number;
  total_cost?: number;
  quote_id?: number | null;
  sale_id?: number | null;
  invoice_id?: number | null;
  notes?: string;
  tasks?: InterventionTaskCreate[];
  parts?: InterventionPartCreate[];
}

export interface MaintenanceStats {
  interventions_month: number;
  in_progress_count: number;
  completed_count: number;
  urgent_count: number;
  scheduled_count: number;
  equipment_count: number;
  monthly_cost: number;
  annual_cost: number;
  upcoming_maintenance_equipment_count: number;
}
