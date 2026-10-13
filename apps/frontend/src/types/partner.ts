export type PartnerType = 'CUSTOMER' | 'SUPPLIER' | 'CUSTOMER_SUPPLIER';

export type AddressType = 'MAIN' | 'BILLING' | 'SHIPPING' | 'OTHER';

export interface PartnerContact {
  id: number;
  partner_id: number;
  first_name: string;
  last_name: string;
  position?: string | null;
  phone?: string | null;
  email?: string | null;
  is_primary: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PartnerContactCreate {
  first_name: string;
  last_name: string;
  position?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface PartnerContactUpdate {
  first_name?: string;
  last_name?: string;
  position?: string;
  phone?: string;
  email?: string;
  is_primary?: boolean;
  notes?: string;
}

export interface PartnerAddress {
  id: number;
  partner_id: number;
  type: AddressType;
  label?: string | null;
  address_line: string;
  city?: string | null;
  postal_code?: string | null;
  country?: string | null;
  is_primary: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerAddressCreate {
  type: AddressType;
  label?: string;
  address_line: string;
  city?: string;
  postal_code?: string;
  country?: string;
  is_primary?: boolean;
}

export interface PartnerAddressUpdate {
  type?: AddressType;
  label?: string;
  address_line?: string;
  city?: string;
  postal_code?: string;
  country?: string;
  is_primary?: boolean;
}

export interface BusinessPartner {
  id: number;
  code: string;
  legal_name: string;
  trade_name?: string | null;
  partner_type: PartnerType;
  ice?: string | null;
  tax_id?: string | null;
  registration_number?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
  address?: string | null;
  city?: string | null;
  country?: string | null;
  postal_code?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  contacts?: PartnerContact[];
  addresses?: PartnerAddress[];
}

export interface PartnerCreate {
  code: string;
  legal_name: string;
  trade_name?: string;
  partner_type: PartnerType;
  ice?: string;
  tax_id?: string;
  registration_number?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  notes?: string;
  is_active?: boolean;
}

export interface PartnerUpdate {
  code?: string;
  legal_name?: string;
  trade_name?: string;
  partner_type?: PartnerType;
  ice?: string;
  tax_id?: string;
  registration_number?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  notes?: string;
  is_active?: boolean;
}

export interface CustomerFinancialMetrics {
  total_quotes: number;
  total_sales: number;
  total_delivery_notes: number;
  total_invoices: number;
  total_credit_notes: number;
  total_payments: number;
  amount_invoiced: number;
  amount_paid: number;
  amount_due: number;
  total_interventions: number;
  last_transaction_date?: string | null;
}

export interface SupplierFinancialMetrics {
  total_purchases: number;
  total_receipts: number;
  total_invoices: number;
  amount_invoiced: number;
  amount_paid: number;
  amount_due: number;
  total_payments: number;
  last_transaction_date?: string | null;
}

export interface PartnerSummaryResponse {
  partner_id: number;
  partner_type: string;
  customer?: CustomerFinancialMetrics | null;
  supplier?: SupplierFinancialMetrics | null;
}
