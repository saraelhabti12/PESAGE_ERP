export enum CreditNoteStatus {
  DRAFT = 'DRAFT',
  VALIDATED = 'VALIDATED',
  CANCELLED = 'CANCELLED',
}

export enum CreditNoteReason {
  RETURN = 'RETURN',
  BILLING_ERROR = 'BILLING_ERROR',
  COMMERCIAL_DISCOUNT = 'COMMERCIAL_DISCOUNT',
  PARTIAL_CANCELLATION = 'PARTIAL_CANCELLATION',
  PRICE_CORRECTION = 'PRICE_CORRECTION',
  DEFECTIVE_PRODUCT = 'DEFECTIVE_PRODUCT',
  OTHER = 'OTHER',
}

export interface CreditNoteItem {
  id: number;
  credit_note_id: number;
  product_id?: number | null;
  invoice_item_id?: number | null;
  warehouse_id?: number | null;
  description: string;
  quantity: number;
  unit_price_ht: number;
  tax_rate: number;
  discount_rate: number;
  line_subtotal_ht: number;
  line_discount: number;
  line_tax: number;
  line_total_ttc: number;
  return_to_stock: boolean;
  product?: {
    id: number;
    sku: string;
    designation: string;
  } | null;
}

export interface CreditNote {
  id: number;
  reference: string;
  invoice_id: number;
  customer_id: number;
  status: CreditNoteStatus;
  credit_note_date: string;
  reason: CreditNoteReason;
  reason_details?: string | null;
  subtotal_ht: number;
  discount_amount: number;
  tax_amount: number;
  total_ttc: number;
  notes?: string | null;
  created_by?: number | null;
  created_at: string;
  updated_at: string;
  customer?: {
    id: number;
    code: string;
    legal_name: string;
  } | null;
  invoice?: {
    id: number;
    reference: string;
    total_ttc: number;
    amount_paid: number;
    amount_due: number;
  } | null;
  creator?: {
    id: number;
    first_name?: string;
    last_name?: string;
    email: string;
  } | null;
  items: CreditNoteItem[];
}

export interface CreditNoteItemCreate {
  product_id?: number | null;
  invoice_item_id?: number | null;
  warehouse_id?: number | null;
  description: string;
  quantity: number;
  unit_price_ht: number;
  tax_rate?: number;
  discount_rate?: number;
  return_to_stock?: boolean;
}

export interface CreditNoteCreate {
  reference?: string;
  invoice_id: number;
  reason?: CreditNoteReason;
  reason_details?: string;
  credit_note_date?: string;
  notes?: string;
  items: CreditNoteItemCreate[];
}
