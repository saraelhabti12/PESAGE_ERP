import { api } from '@/lib/api';
import { BusinessPartner } from '@/types/partner';

export interface CustomerLookupOptions {
  search?: string;
  isActive?: boolean;
  size?: number;
}

/**
 * CANONICAL CUSTOMER & SUPPLIER LOOKUP SERVICE
 *
 * Provides a single, unified source of truth for looking up partners across all ERP modules:
 * - Devis (QuotesPage)
 * - Ventes (SalesPage)
 * - Bons de Livraison (DeliveryNotesPage)
 * - Factures Vente (CustomerInvoicesPage)
 * - Avoirs Clients (CreditNotesPage)
 * - Interventions & SAV (MaintenancePage)
 * - Équipements Clients (MaintenancePage)
 * - Commandes d'Achat & Réceptions (PurchasesPage)
 * - Factures Fournisseurs (SupplierInvoicesPage)
 * - Dépenses (ExpensesPage)
 */
export const customerService = {
  /**
   * Fetches active customers (partner_type is CUSTOMER or CUSTOMER_SUPPLIER).
   * Ensures all modules share the exact same canonical customer list.
   */
  async getCustomers(options: CustomerLookupOptions = {}): Promise<BusinessPartner[]> {
    const { search, isActive = true, size = 500 } = options;
    const params = new URLSearchParams();
    params.append('size', String(size));
    if (isActive !== undefined) {
      params.append('is_active', String(isActive));
    }
    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    const res = await api.get<BusinessPartner[]>(`/api/v1/customers?${params.toString()}`);
    const items = Array.isArray(res.data) ? res.data : (res.data as any)?.items || [];
    return items;
  },

  /**
   * Retrieves single customer by ID with full details.
   */
  async getCustomerById(id: number): Promise<BusinessPartner> {
    const res = await api.get<BusinessPartner>(`/api/v1/customers/${id}`);
    return res.data;
  },

  /**
   * Fetches active suppliers (partner_type is SUPPLIER or CUSTOMER_SUPPLIER).
   * Ensures all purchasing and expense modules share the exact same supplier list.
   */
  async getSuppliers(options: CustomerLookupOptions = {}): Promise<BusinessPartner[]> {
    const { search, isActive = true, size = 500 } = options;
    const params = new URLSearchParams();
    params.append('size', String(size));
    if (isActive !== undefined) {
      params.append('is_active', String(isActive));
    }
    if (search && search.trim()) {
      params.append('search', search.trim());
    }

    const res = await api.get<BusinessPartner[]>(`/api/v1/suppliers?${params.toString()}`);
    const items = Array.isArray(res.data) ? res.data : (res.data as any)?.items || [];
    return items;
  },

  /**
   * Retrieves single supplier by ID with full details.
   */
  async getSupplierById(id: number): Promise<BusinessPartner> {
    const res = await api.get<BusinessPartner>(`/api/v1/suppliers/${id}`);
    return res.data;
  },
};
