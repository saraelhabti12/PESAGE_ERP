export enum ExpenseFrequency {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  ANNUAL = 'ANNUAL',
}

export enum ExpenseStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
}

export interface ExpenseCategory {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringExpense {
  id: number;
  category_id: number;
  label: string;
  amount: number;
  frequency: ExpenseFrequency;
  start_date: string;
  end_date?: string | null;
  day_of_month: number;
  supplier_id?: number | null;
  is_active: boolean;
  notes?: string | null;
  last_generated_period?: string | null;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory | null;
  supplier?: {
    id: number;
    code: string;
    legal_name: string;
  } | null;
}

export interface Expense {
  id: number;
  reference: string;
  category_id: number;
  recurring_expense_id?: number | null;
  label: string;
  amount: number;
  expense_date: string;
  payment_method?: string | null;
  status: ExpenseStatus;
  receipt_reference?: string | null;
  receipt_file_url?: string | null;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  category?: ExpenseCategory | null;
  recurring_expense?: RecurringExpense | null;
  creator?: {
    id: number;
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
}

export interface ExpenseCreate {
  reference?: string;
  category_id: number;
  recurring_expense_id?: number | null;
  label: string;
  amount: number;
  expense_date?: string;
  payment_method?: string;
  status?: ExpenseStatus;
  receipt_reference?: string;
  notes?: string;
}

export interface RecurringExpenseCreate {
  category_id: number;
  label: string;
  amount: number;
  frequency?: ExpenseFrequency;
  start_date?: string;
  end_date?: string | null;
  day_of_month?: number;
  supplier_id?: number | null;
  notes?: string;
}

export interface ExpenseStats {
  total_expenses: number;
  this_month: number;
  this_year: number;
  fixed_expenses: number;
  variable_expenses: number;
  by_category: {
    category_id: number;
    category_name: string;
    category_code: string;
    total_amount: number;
    expense_count: number;
  }[];
}
