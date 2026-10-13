import { BusinessPartner } from './partner';

export interface Payment {
  id: number;
  reference: string;
  invoice_id: number;
  customer_id: number;
  payment_date: string;
  amount: number;
  payment_method: string;
  transaction_reference?: string | null;
  notes?: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
  customer?: BusinessPartner;
  creator?: {
    id: number;
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  };
}

export interface PaymentFormData {
  invoice_id: number;
  amount: number;
  payment_date: string;
  payment_method: string;
  transaction_reference?: string;
  notes?: string;
}

export interface CustomerFinancialSummary {
  customer_id: number;
  customer_name: string;
  total_invoiced: number;
  total_paid: number;
  balance_due: number;
  unpaid_invoice_count: number;
}
