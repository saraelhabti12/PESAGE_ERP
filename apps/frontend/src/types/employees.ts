export interface Employee {
  id: number;
  code: string;
  first_name: string;
  last_name: string;
  cin?: string | null;
  cnss_number?: string | null;
  email?: string | null;
  phone?: string | null;
  job_title?: string | null;
  department?: string | null;
  hire_date?: string | null;
  salary?: number | null;
  contract_type?: string | null;
  is_active: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmployeeCreate {
  code?: string;
  first_name: string;
  last_name: string;
  cin?: string;
  cnss_number?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  department?: string;
  hire_date?: string | null;
  salary?: number;
  contract_type?: string;
  notes?: string;
}
