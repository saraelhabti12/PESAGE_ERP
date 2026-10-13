import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { customerService } from '@/services/customerService';
import {
  Invoice,
  InvoiceStatus,
  InvoiceFromSaleInput,
} from '@/types/invoices';
import { PaymentFormData } from '@/types/payments';
import { Sale } from '@/types/sales';
import { BusinessPartner } from '@/types/partner';
import { PAYMENT_METHODS, PAYMENT_TERMS } from '@/constants/purchases';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { DatePeriodFilter, DatePeriodValue } from '@/components/ui/DatePeriodFilter';
import { useNotification } from '@/context/NotificationContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  DocumentHeader,
  PartnerInfoBlock,
  TotalsBlock,
  SignaturesBlock,
  DocumentFooter,
  CustomerInvoiceDocument,
} from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

import {
  FileText,
  CreditCard,
  Trash2,
  Eye,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Receipt,
  RotateCcw,
  Plus,
  Filter,
  DollarSign,
  Download,
  Building2,
  ShoppingBag,
  ShoppingCart,
  Printer,
  X,
} from 'lucide-react';

export const CustomerInvoicesPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  // Data
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [candidateSales, setCandidateSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<BusinessPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [minAmountFilter, setMinAmountFilter] = useState<string>('');
  const [maxAmountFilter, setMaxAmountFilter] = useState<string>('');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodValue>({
    preset: 'ALL',
    label: 'Toutes les dates',
  });

  // Modal states
  const [isCreateFromSaleModalOpen, setIsCreateFromSaleModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [saleIdForInvoice, setSaleIdForInvoice] = useState<number | null>(null);
  const [customInvoiceRef, setCustomInvoiceRef] = useState<string>('');
  const [paymentTermsForSale, setPaymentTermsForSale] = useState<string>('30 jours');
  const [invoiceDateForSale, setInvoiceDateForSale] = useState<string>(
    new Date().toISOString().split('T')[0]
  );

  // Payment form state
  const initialPaymentFormState: PaymentFormData = {
    invoice_id: 0,
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    transaction_reference: '',
    notes: '',
  };
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>(initialPaymentFormState);
  const [paymentFormErrors, setPaymentFormErrors] = useState<Record<string, string>>({});

  // Cancel dialog
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [invoiceToCancel, setInvoiceToCancel] = useState<Invoice | null>(null);

  // Fetch data with database-level filtering
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('invoice_type', 'CUSTOMER');

      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (customerFilter !== 'ALL') params.append('customer_id', customerFilter);
      if (minAmountFilter) params.append('min_amount', minAmountFilter);
      if (maxAmountFilter) params.append('max_amount', maxAmountFilter);
      if (periodFilter.dateFrom) params.append('date_from', periodFilter.dateFrom);
      if (periodFilter.dateTo) params.append('date_to', periodFilter.dateTo);

      const [invRes, salesRes, candidatesRes, customersList] = await Promise.all([
        api.get<Invoice[]>(`/api/v1/invoices?${params.toString()}`),
        api.get<Sale[]>('/api/v1/sales'),
        api.get<Sale[]>('/api/v1/invoices/candidates/sales').catch(() => ({ data: [] as Sale[] })),
        customerService.getCustomers({ isActive: true }),
      ]);

      setInvoices(invRes.data);
      setSales(salesRes.data);
      setCandidateSales(candidatesRes.data);
      setCustomers(customersList);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du chargement des factures clients.'));
    } finally {
      setIsLoading(false);
    }
  }, [
    searchTerm,
    statusFilter,
    customerFilter,
    minAmountFilter,
    maxAmountFilter,
    periodFilter,
    showError,
  ]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle URL preselection (e.g. ?sale_id=123)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const preSaleId = params.get('sale_id');
    if (preSaleId && sales.length > 0) {
      const sId = Number(preSaleId);
      handleOpenCreateFromSaleModal(sId);
    }
  }, [location.search, sales]);

  // Eligible sales for invoicing
  const eligibleSales = useMemo(() => {
    if (candidateSales && candidateSales.length > 0) {
      return candidateSales;
    }
    const activeInvoicedSaleIds = new Set(
      invoices.filter((inv) => inv.status !== 'CANCELLED' && inv.sale_id).map((inv) => inv.sale_id)
    );
    return sales.filter(
      (s) =>
        ['CONFIRMED', 'DELIVERED', 'PARTIALLY_DELIVERED'].includes(s.status) &&
        !activeInvoicedSaleIds.has(s.id)
    );
  }, [candidateSales, sales, invoices]);

  // Selected Sale Details for Auto-fill Preview
  const selectedSale = useMemo(() => {
    if (!saleIdForInvoice) return null;
    return (
      candidateSales.find((s) => s.id === saleIdForInvoice) ||
      sales.find((s) => s.id === saleIdForInvoice) ||
      null
    );
  }, [saleIdForInvoice, candidateSales, sales]);

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const active = invoices.filter((i) => i.status !== 'CANCELLED');
    const totalTtc = active.reduce((acc, i) => acc + (i.total_ttc || 0), 0);
    const totalPaid = active.reduce((acc, i) => acc + (i.amount_paid || 0), 0);
    const totalDue = active.reduce((acc, i) => acc + (i.amount_due || 0), 0);
    const overdueCount = active.filter(
      (i) => i.status === 'OVERDUE' || (i.amount_due > 0 && new Date(i.due_date) < new Date())
    ).length;

    return {
      count: invoices.length,
      totalTtc,
      totalPaid,
      totalDue,
      overdueCount,
    };
  }, [invoices]);

  const handleOpenCreateFromSaleModal = async (preselectedSaleId?: number) => {
    // Refresh candidate sales dynamically
    try {
      const candRes = await api.get<Sale[]>('/api/v1/invoices/candidates/sales');
      setCandidateSales(candRes.data);
      const candidates = candRes.data;

      if (preselectedSaleId) {
        setSaleIdForInvoice(preselectedSaleId);
        const foundSale = candidates.find((s) => s.id === preselectedSaleId) || sales.find((s) => s.id === preselectedSaleId);
        if (foundSale?.payment_terms) {
          setPaymentTermsForSale(foundSale.payment_terms);
        }
      } else if (candidates.length > 0) {
        setSaleIdForInvoice(candidates[0].id);
        if (candidates[0].payment_terms) {
          setPaymentTermsForSale(candidates[0].payment_terms);
        }
      } else {
        setSaleIdForInvoice(null);
      }
    } catch {
      if (preselectedSaleId) {
        setSaleIdForInvoice(preselectedSaleId);
      } else if (eligibleSales.length > 0) {
        setSaleIdForInvoice(eligibleSales[0].id);
      } else {
        setSaleIdForInvoice(null);
      }
    }

    setCustomInvoiceRef('');
    setInvoiceDateForSale(new Date().toISOString().split('T')[0]);
    setIsCreateFromSaleModalOpen(true);
  };

  const handleCreateFromSale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!saleIdForInvoice) {
      showError('Veuillez sélectionner une vente validée.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload: InvoiceFromSaleInput = {
        sale_id: saleIdForInvoice,
        reference: customInvoiceRef.trim() ? customInvoiceRef.trim() : undefined,
        invoice_date: invoiceDateForSale,
        payment_terms: paymentTermsForSale,
      };

      const res = await api.post<Invoice>('/api/v1/invoices/from-sale', payload);
      showSuccess(`Facture client ${res.data.reference} créée avec succès !`);
      setIsCreateFromSaleModalOpen(false);
      fetchData();
    } catch (err: any) {
      showError(getApiErrorMessage(err, 'Erreur lors de la génération de la facture client.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenPaymentModal = (invoice: Invoice) => {
    setSelectedInvoice(invoice);
    setPaymentFormData({
      invoice_id: invoice.id,
      amount: invoice.amount_due,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      transaction_reference: '',
      notes: '',
    });
    setPaymentFormErrors({});
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoice) return;

    const errors: Record<string, string> = {};
    if (!paymentFormData.amount || paymentFormData.amount <= 0) {
      errors.amount = 'Le montant doit être supérieur à 0.';
    } else if (paymentFormData.amount > selectedInvoice.amount_due + 0.001) {
      errors.amount = `Le montant dépasse le restant dû (${formatCurrency(selectedInvoice.amount_due)}).`;
    }
    if (!paymentFormData.payment_date) {
      errors.payment_date = 'La date de paiement est obligatoire.';
    }

    if (Object.keys(errors).length > 0) {
      setPaymentFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/v1/payments', {
        ...paymentFormData,
        amount: Number(paymentFormData.amount),
      });
      showSuccess('Règlement client enregistré avec succès !');
      setIsPaymentModalOpen(false);
      fetchData();
    } catch (err: any) {
      showError(getApiErrorMessage(err, "Erreur lors de l'enregistrement du règlement."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoiceToCancel) return;
    try {
      await api.post(`/api/v1/invoices/${invoiceToCancel.id}/cancel`);
      showSuccess(`Facture client ${invoiceToCancel.reference} annulée.`);
      setCancelConfirmOpen(false);
      setInvoiceToCancel(null);
      fetchData();
    } catch (err: any) {
      showError(getApiErrorMessage(err, "Erreur lors de l'annulation de la facture."));
    }
  };

  const handleResetFilters = () => {
    setSearchTerm('');
    setStatusFilter('ALL');
    setCustomerFilter('ALL');
    setMinAmountFilter('');
    setMaxAmountFilter('');
    setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' });
  };

  const isAnyFilterActive =
    searchTerm.trim() !== '' ||
    statusFilter !== 'ALL' ||
    customerFilter !== 'ALL' ||
    minAmountFilter !== '' ||
    maxAmountFilter !== '' ||
    periodFilter.preset !== 'ALL';

  const renderStatusBadge = (status: InvoiceStatus, inv: Invoice) => {
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = status !== 'PAID' && status !== 'CANCELLED' && inv.due_date < today;

    if (status === 'PAID') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Payée
        </span>
      );
    }
    if (status === 'PARTIALLY_PAID') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 text-pesage-blue border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
          <Clock className="w-3 h-3 mr-1" />
          Partiellement payée
        </span>
      );
    }
    if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
          Annulée
        </span>
      );
    }
    if (status === 'OVERDUE' || isOverdue) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
          <AlertTriangle className="w-3 h-3 mr-1" />
          En retard
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        Émise
      </span>
    );
  };

  const columns: Column<Invoice>[] = [
    {
      header: 'Réf. Facture',
      accessor: (row) => (
        <div className="flex flex-col">
          <span className="font-semibold text-pesage-blue hover:underline cursor-pointer">
            {row.reference}
          </span>
          <span className="text-[11px] text-app-text-muted">
            {formatDate(row.invoice_date || row.created_at)}
          </span>
        </div>
      ),
    },
    {
      header: 'Client',
      accessor: (row) => (
        <div>
          <span className="font-medium text-app-text">
            {row.customer?.trade_name || row.customer?.legal_name || `Client #${row.customer_id}`}
          </span>
          {row.customer?.code && (
            <span className="block text-[10px] text-app-text-muted">{row.customer.code}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Origine / Vente',
      accessor: (row) =>
        row.sale ? (
          <span
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/ventes/${row.sale?.id}`);
            }}
            className="inline-flex items-center gap-1 text-xs text-app-text-muted hover:text-pesage-blue hover:underline cursor-pointer"
          >
            <ShoppingCart className="w-3 h-3 text-slate-400" />
            {row.sale.reference}
          </span>
        ) : (
          <span className="text-xs text-app-text-muted italic">Facture directe</span>
        ),
    },
    {
      header: 'Échéance',
      accessor: (row) => {
        const today = new Date().toISOString().split('T')[0];
        const isLate = row.status !== 'PAID' && row.status !== 'CANCELLED' && row.due_date < today;
        return (
          <div className="flex flex-col">
            <span className={`text-xs ${isLate ? 'text-rose-600 font-bold' : 'text-app-text'}`}>
              {formatDate(row.due_date)}
            </span>
            <span className="text-[10px] text-app-text-muted">{row.payment_terms || '30 jours'}</span>
          </div>
        );
      },
    },
    {
      header: 'Montant HT',
      align: 'right',
      accessor: (row) => (
        <span className="text-xs font-mono text-app-text">
          {formatCurrency(row.subtotal_ht || 0)}
        </span>
      ),
    },
    {
      header: 'Total TTC',
      align: 'right',
      accessor: (row) => (
        <span className="text-xs font-bold font-mono text-app-text">
          {formatCurrency(row.total_ttc)}
        </span>
      ),
    },
    {
      header: 'Reste à payer',
      align: 'right',
      accessor: (row) => (
        <span
          className={`text-xs font-bold font-mono ${
            row.amount_due > 0 ? 'text-pesage-orange' : 'text-emerald-600'
          }`}
        >
          {formatCurrency(row.amount_due)}
        </span>
      ),
    },
    {
      header: 'Statut',
      accessor: (row) => renderStatusBadge(row.status, row),
    },
    {
      header: 'Actions',
      align: 'right',
      accessor: (row) => (
        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => navigate(`/factures/${row.id}`)}
            className="p-1.5 text-app-text-muted hover:text-pesage-blue hover:bg-app-surface-subtle rounded-lg transition"
            title="Consulter le détail"
          >
            <Eye className="w-4 h-4" />
          </button>

          <button
            onClick={() => {
              setSelectedInvoice(row);
              setIsPreviewModalOpen(true);
            }}
            className="p-1.5 text-app-text-muted hover:text-pesage-blue hover:bg-app-surface-subtle rounded-lg transition"
            title="Aperçu / Imprimer la facture"
          >
            <Printer className="w-4 h-4" />
          </button>

          {row.status !== 'PAID' && row.status !== 'CANCELLED' && (
            <button
              onClick={() => handleOpenPaymentModal(row)}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 rounded-lg transition"
              title="Enregistrer un règlement"
            >
              <CreditCard className="w-4 h-4" />
            </button>
          )}

          {row.status !== 'CANCELLED' && (
            <button
              onClick={() => navigate(`/avoirs?invoice_id=${row.id}`)}
              className="p-1.5 text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/30 rounded-lg transition"
              title="Créer un avoir client"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}

          {row.status !== 'CANCELLED' && row.amount_paid === 0 && (
            <button
              onClick={() => {
                setInvoiceToCancel(row);
                setCancelConfirmOpen(true);
              }}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
              title="Annuler la facture"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Factures Vente"
        description="Gestion et suivi des factures clients, échéances et encaissements du cycle commercial."
        icon={Receipt}
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => handleOpenCreateFromSaleModal()}
            >
              Facturer une Vente
            </Button>
          </div>
        }
      />

      {/* KPI Cards Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-app-text-muted">Factures Clients</span>
            <Receipt className="w-4 h-4 text-pesage-blue" />
          </div>
          <p className="text-2xl font-bold text-app-text mt-2">{summaryMetrics.count}</p>
          <span className="text-[11px] text-app-text-muted">Total des émissions</span>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-app-text-muted">Chiffre d'Affaires Facturé (TTC)</span>
            <DollarSign className="w-4 h-4 text-pesage-blue" />
          </div>
          <p className="text-2xl font-bold text-app-text mt-2 font-mono">
            {formatCurrency(summaryMetrics.totalTtc)}
          </p>
          <span className="text-[11px] text-emerald-600 font-medium">
            Encaissé : {formatCurrency(summaryMetrics.totalPaid)}
          </span>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-app-text-muted">Restant à Encaisser</span>
            <Clock className="w-4 h-4 text-pesage-orange" />
          </div>
          <p className="text-2xl font-bold text-pesage-orange mt-2 font-mono">
            {formatCurrency(summaryMetrics.totalDue)}
          </p>
          <span className="text-[11px] text-app-text-muted">Créances clients en cours</span>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-app-text-muted">Factures en Retard</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <p className="text-2xl font-bold text-rose-600 mt-2">{summaryMetrics.overdueCount}</p>
          <span className="text-[11px] text-rose-600/80 font-medium">Nécessite relance</span>
        </div>
      </div>

      {/* Global Filter Bar */}
      <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            {/* Search */}
            <div className="w-64">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Rechercher par réf, client..."
              />
            </div>

            {/* Date / Period Filter */}
            <DatePeriodFilter
              value={periodFilter}
              onChange={setPeriodFilter}
              onReset={() => setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' })}
            />

            {/* Client Filter */}
            <select
              value={customerFilter}
              onChange={(e) => setCustomerFilter(e.target.value)}
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="ALL">Tous les clients</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.trade_name || c.legal_name}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="ISSUED">Émise</option>
              <option value="PARTIALLY_PAID">Partiellement payée</option>
              <option value="PAID">Payée</option>
              <option value="OVERDUE">En retard</option>
              <option value="CANCELLED">Annulée</option>
            </select>
          </div>

          {/* Reset Filters Button */}
          {isAnyFilterActive && (
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={handleResetFilters}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        {/* Active Filters Summary Chips */}
        {isAnyFilterActive && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-app-border text-xs">
            <span className="text-app-text-muted font-semibold">Filtres actifs :</span>
            {periodFilter.preset !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pesage-blue-subtle text-pesage-blue border border-pesage-blue/20 font-medium">
                Période : {periodFilter.label}
                <button
                  type="button"
                  onClick={() => setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' })}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {customerFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Client : {customers.find((c) => String(c.id) === customerFilter)?.trade_name || customerFilter}
                <button
                  type="button"
                  onClick={() => setCustomerFilter('ALL')}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Statut : {statusFilter}
                <button
                  type="button"
                  onClick={() => setStatusFilter('ALL')}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {searchTerm.trim() !== '' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Recherche : "{searchTerm}"
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Table */}
      <div className="bg-app-surface rounded-2xl border border-app-border overflow-hidden shadow-xs">
        <DataTable<Invoice>
          data={invoices}
          columns={columns}
          isLoading={isLoading}
          keyExtractor={(row) => row.id}
          emptyTitle="Aucune facture client trouvée"
          emptyDescription="Aucune facture client ne correspond aux critères sélectionnés."
        />
      </div>

      {/* Modal: Create Customer Invoice From Sale */}
      <Modal
        isOpen={isCreateFromSaleModalOpen}
        onClose={() => setIsCreateFromSaleModalOpen(false)}
        title="Facturer une Vente Confirmée"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateFromSale} className="space-y-4">
          {eligibleSales.length === 0 ? (
            <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs space-y-3">
              <div className="flex items-center gap-2 font-bold text-sm text-amber-700 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>Aucune vente disponible pour facturation</span>
              </div>
              <p className="text-app-text-muted leading-relaxed">
                Toutes les commandes de vente existantes ont déjà été facturées ou aucune vente confirmée/livrée n'est en attente de facturation.
              </p>
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setIsCreateFromSaleModalOpen(false);
                    navigate('/ventes');
                  }}
                >
                  Accéder au module Ventes
                </Button>
              </div>
            </div>
          ) : (
            <>
              <FormField
                label="Sélectionner la commande de vente"
                required
              >
                <div>
                  <select
                    value={saleIdForInvoice || ''}
                    onChange={(e) => {
                      const sId = Number(e.target.value);
                      setSaleIdForInvoice(sId);
                      const sel = sales.find((s) => s.id === sId) || candidateSales.find((s) => s.id === sId);
                      if (sel?.payment_terms) {
                        setPaymentTermsForSale(sel.payment_terms);
                      }
                    }}
                    required
                    className="w-full px-3 py-2.5 bg-app-surface border border-app-border rounded-xl text-xs font-semibold text-app-text focus:outline-none focus:border-pesage-blue shadow-xs"
                  >
                    <option value="">-- Sélectionner une commande de vente --</option>
                    {eligibleSales.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.reference} — {s.customer?.trade_name || s.customer?.legal_name || 'Client'} — {formatDate(s.order_date)} — {formatCurrency(s.total_ttc)} ({s.status})
                      </option>
                    ))}
                  </select>
                  <p className="text-[11px] text-app-text-muted mt-1">
                    Sélectionnez une commande confirmée ou livrée pour auto-remplir les données de la facture.
                  </p>
                </div>
              </FormField>

              {/* Auto-filled Sale Preview */}
              {selectedSale && (
                <div className="space-y-3 p-4 rounded-xl bg-app-surface-subtle border border-app-border">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-app-border pb-2.5 text-xs">
                    <div>
                      <span className="text-app-text-muted">Client : </span>
                      <span className="font-bold text-app-text">
                        {selectedSale.customer?.trade_name || selectedSale.customer?.legal_name}
                      </span>
                      {selectedSale.customer?.city && (
                        <span className="text-app-text-muted"> ({selectedSale.customer.city})</span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-app-text-muted">Réf : <strong className="text-pesage-blue">{selectedSale.reference}</strong></span>
                      <span className="text-app-text-muted">Date : <strong>{formatDate(selectedSale.order_date)}</strong></span>
                    </div>
                  </div>

                  {/* Line items preview table */}
                  {selectedSale.items && selectedSale.items.length > 0 && (
                    <div className="overflow-x-auto max-h-48 border border-app-border rounded-lg bg-app-surface">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead className="bg-app-surface-subtle text-app-text-muted border-b border-app-border">
                          <tr>
                            <th className="py-1.5 px-3 font-semibold">Article / Prestation</th>
                            <th className="py-1.5 px-3 font-semibold text-right">Qté</th>
                            <th className="py-1.5 px-3 font-semibold text-right">P.U. HT</th>
                            <th className="py-1.5 px-3 font-semibold text-right">TVA</th>
                            <th className="py-1.5 px-3 font-semibold text-right">Total HT</th>
                            <th className="py-1.5 px-3 font-semibold text-right">Total TTC</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-app-border">
                          {selectedSale.items.map((it, idx) => (
                            <tr key={idx} className="hover:bg-app-surface-subtle/50">
                              <td className="py-1.5 px-3">
                                <p className="font-medium text-app-text">
                                  {it.product?.designation || `Produit #${it.product_id}`}
                                </p>
                                {it.product?.sku && (
                                  <span className="text-[10px] text-app-text-muted font-mono">{it.product.sku}</span>
                                )}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-medium">{it.quantity}</td>
                              <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(it.unit_price_ht)}</td>
                              <td className="py-1.5 px-3 text-right font-mono">{it.tax_rate}%</td>
                              <td className="py-1.5 px-3 text-right font-mono">{formatCurrency(it.line_subtotal_ht)}</td>
                              <td className="py-1.5 px-3 text-right font-mono font-bold text-pesage-blue">
                                {formatCurrency(it.line_total_ttc)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Financial Totals Summary */}
                  <div className="flex justify-end pt-1">
                    <div className="w-64 space-y-1 text-xs">
                      <div className="flex justify-between text-app-text-muted">
                        <span>Total HT :</span>
                        <span className="font-mono">{formatCurrency(selectedSale.subtotal_ht)}</span>
                      </div>
                      {Number(selectedSale.discount_amount) > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Remise :</span>
                          <span className="font-mono">-{formatCurrency(selectedSale.discount_amount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-app-text-muted">
                        <span>TVA (20%) :</span>
                        <span className="font-mono">{formatCurrency(selectedSale.tax_amount)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-sm text-app-text pt-1 border-t border-app-border">
                        <span>Total TTC :</span>
                        <span className="font-mono text-pesage-blue">{formatCurrency(selectedSale.total_ttc)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <FormField
                label="Référence personnalisée (optionnel)"
              >
                <div>
                  <input
                    type="text"
                    value={customInvoiceRef}
                    onChange={(e) => setCustomInvoiceRef(e.target.value)}
                    placeholder="Ex: FAC-2026-0012"
                    className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
                  />
                  <p className="text-[11px] text-app-text-muted mt-1">
                    Laisser vide pour générer automatiquement FAC-AAAAMM-XXXX
                  </p>
                </div>
              </FormField>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <FormField label="Date d'émission" required>
                  <input
                    type="date"
                    value={invoiceDateForSale}
                    onChange={(e) => setInvoiceDateForSale(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
                  />
                </FormField>

                <FormField label="Conditions de règlement" required>
                  <select
                    value={paymentTermsForSale}
                    onChange={(e) => setPaymentTermsForSale(e.target.value)}
                    className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-semibold text-app-text focus:outline-none focus:border-pesage-blue"
                  >
                    {PAYMENT_TERMS.map((pt) => (
                      <option key={pt.value} value={pt.value}>
                        {pt.label}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </>
          )}

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsCreateFromSaleModalOpen(false)}
            >
              Annuler
            </Button>
            {eligibleSales.length > 0 && (
              <Button
                type="submit"
                variant="primary"
                isLoading={isSubmitting}
                disabled={!saleIdForInvoice}
              >
                Émettre la Facture Client
              </Button>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal: Register Customer Payment */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={`Enregistrer un règlement — ${selectedInvoice?.reference}`}
      >
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-pesage-blue-subtle text-pesage-blue dark:bg-pesage-blue/20 dark:text-blue-200 text-xs flex justify-between items-center">
            <span>Reste à payer :</span>
            <span className="font-bold font-mono text-sm">
              {formatCurrency(selectedInvoice?.amount_due || 0)}
            </span>
          </div>

          <FormField label="Montant du règlement (MAD)" required error={paymentFormErrors.amount}>
            <input
              type="number"
              step="0.01"
              value={paymentFormData.amount}
              onChange={(e) =>
                setPaymentFormData({ ...paymentFormData, amount: Number(e.target.value) })
              }
              required
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-bold font-mono text-app-text focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Date du paiement" required error={paymentFormErrors.payment_date}>
              <input
                type="date"
                value={paymentFormData.payment_date}
                onChange={(e) =>
                  setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })
                }
                required
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Mode de règlement" required>
              <select
                value={paymentFormData.payment_method}
                onChange={(e) =>
                  setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })
                }
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-semibold text-app-text focus:outline-none focus:border-pesage-blue"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Réf. Transaction / N° Chèque / Virement">
            <input
              type="text"
              value={paymentFormData.transaction_reference || ''}
              onChange={(e) =>
                setPaymentFormData({ ...paymentFormData, transaction_reference: e.target.value })
              }
              placeholder="Ex: CHQ-8849202"
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <FormField label="Notes / Remarques">
            <textarea
              rows={2}
              value={paymentFormData.notes || ''}
              onChange={(e) =>
                setPaymentFormData({ ...paymentFormData, notes: e.target.value })
              }
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="success"
              isLoading={isSubmitting}
            >
              Confirmer l'Encaissement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Invoice Printable / Preview Modal */}
      {selectedInvoice && (
        <DocumentPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title="Aperçu Facture Client"
          documentRef={selectedInvoice.reference}
        >
          <CustomerInvoiceDocument invoice={selectedInvoice} />
        </DocumentPreviewModal>
      )}


      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancelInvoice}
        title="Annuler la facture client"
        message={`Êtes-vous sûr de vouloir annuler la facture ${invoiceToCancel?.reference} ? Cette action est irréversible.`}
        confirmText="Annuler la facture"
        variant="danger"
      />
    </div>
  );
};
