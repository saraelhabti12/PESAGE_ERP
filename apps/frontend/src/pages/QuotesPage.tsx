import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { customerService } from '@/services/customerService';
import {
  Quote,
  QuoteFormData,
  QuoteItemFormData,
  QuoteStatus,
} from '@/types/quotes';
import { BusinessPartner } from '@/types/partner';
import { Product } from '@/types/catalog';
import { Warehouse } from '@/types/warehouse';
import { PAYMENT_TERMS } from '@/constants/purchases';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { DatePeriodFilter, DatePeriodValue } from '@/components/ui/DatePeriodFilter';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  DocumentHeader,
  PartnerInfoBlock,
  TotalsBlock,
  SignaturesBlock,
  DocumentFooter,
  QuoteDocument,
} from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

import {
  FileText,
  Plus,
  Edit2,
  Trash2,
  Send,
  CheckCircle2,
  XCircle,
  Eye,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Package,
  Printer,
  FileCheck2,
  RotateCcw,
  X,
} from 'lucide-react';

export const QuotesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  // Data lists
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [customers, setCustomers] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [customerFilter, setCustomerFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodValue>({
    preset: 'ALL',
    label: 'Toutes les dates',
  });

  // Modal states
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Confirm dialogs
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<Quote | null>(null);
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [actionType, setActionType] = useState<'send' | 'accept' | 'reject' | 'cancel' | 'convert' | null>(null);
  const [actionQuote, setActionQuote] = useState<Quote | null>(null);

  // Form state
  const initialFormState: QuoteFormData = {
    reference: '',
    customer_id: '',
    quote_date: new Date().toISOString().split('T')[0],
    valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    payment_terms: '30 jours',
    delivery_delay: '15 jours',
    realization_delay: '',
    notes: '',
    items: [
      {
        product_id: '',
        warehouse_id: '',
        quantity: 1,
        unit_price_ht: 0,
        tax_rate: 20,
        discount_rate: 0,
      },
    ],
  };

  const [formData, setFormData] = useState<QuoteFormData>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Fetch initial data
  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodFilter.dateFrom) params.append('date_from', periodFilter.dateFrom);
      if (periodFilter.dateTo) params.append('date_to', periodFilter.dateTo);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (customerFilter !== 'ALL') params.append('customer_id', customerFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const quotesUrl = params.toString() ? `/api/v1/quotes?${params.toString()}` : '/api/v1/quotes';

      const [quotesRes, customersList, productsRes, warehousesRes] = await Promise.all([
        api.get<Quote[]>(quotesUrl),
        customerService.getCustomers({ isActive: true }),
        api.get<Product[]>('/api/v1/products'),
        api.get<Warehouse[]>('/api/v1/warehouses'),
      ]);
      setQuotes(quotesRes.data);
      setCustomers(customersList);
      setProducts(productsRes.data);
      setWarehouses(warehousesRes.data);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du chargement des devis.'));
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter, statusFilter, customerFilter, searchTerm, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculations for dynamic line items
  const calculateItemSubtotal = (item: QuoteItemFormData) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unit_price_ht) || 0;
    const discount = Number(item.discount_rate) || 0;
    const tax = Number(item.tax_rate) || 0;

    const base = qty * price;
    const discAmount = base * (discount / 100);
    const subtotalHT = base - discAmount;
    const taxAmount = subtotalHT * (tax / 100);
    const totalTTC = subtotalHT + taxAmount;

    return { subtotalHT, discAmount, taxAmount, totalTTC };
  };

  const formTotals = useMemo(() => {
    let subtotalHT = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let totalTTC = 0;

    formData.items.forEach((item) => {
      const calc = calculateItemSubtotal(item);
      subtotalHT += calc.subtotalHT;
      totalDiscount += calc.discAmount;
      totalTax += calc.taxAmount;
      totalTTC += calc.totalTTC;
    });

    return { subtotalHT, totalDiscount, totalTax, totalTTC };
  }, [formData.items]);

  // Filtered quotes
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const customerName = q.customer?.legal_name || q.customer?.trade_name || '';
      const matchesSearch =
        q.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (q.customer?.code && q.customer.code.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || q.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [quotes, searchTerm, statusFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = quotes.length;
    const draft = quotes.filter((q) => q.status === 'DRAFT').length;
    const sent = quotes.filter((q) => q.status === 'SENT').length;
    const accepted = quotes.filter((q) => q.status === 'ACCEPTED').length;
    const totalAmount = quotes.reduce((acc, q) => acc + (q.total_ttc || 0), 0);

    return { total, draft, sent, accepted, totalAmount };
  }, [quotes]);

  // Open Create Modal
  const handleOpenCreateModal = () => {
    setIsEditing(false);
    setSelectedQuote(null);
    setFormData({
      ...initialFormState,
      reference: `DEV-${new Date().getFullYear()}-${String(quotes.length + 1).padStart(4, '0')}`,
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEditModal = (quote: Quote) => {
    if (quote.status !== 'DRAFT') {
      showInfo('Seuls les devis en brouillon peuvent être modifiés.');
      return;
    }
    setIsEditing(true);
    setSelectedQuote(quote);
    setFormData({
      reference: quote.reference,
      customer_id: quote.customer_id,
      quote_date: quote.quote_date,
      valid_until: quote.valid_until || '',
      payment_terms: quote.payment_terms || '30 jours',
      delivery_delay: quote.delivery_delay || '',
      realization_delay: quote.realization_delay || '',
      notes: quote.notes || '',
      items: quote.items.map((it) => ({
        product_id: it.product_id,
        warehouse_id: it.warehouse_id || '',
        quantity: it.quantity,
        unit_price_ht: it.unit_price_ht,
        tax_rate: it.tax_rate,
        discount_rate: it.discount_rate,
      })),
    });
    setFormErrors({});
    setIsFormModalOpen(true);
  };

  // Line item handlers
  const handleAddItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: '',
          warehouse_id: '',
          quantity: 1,
          unit_price_ht: 0,
          tax_rate: 20,
          discount_rate: 0,
        },
      ],
    }));
  };

  const handleRemoveItem = (index: number) => {
    if (formData.items.length <= 1) {
      showInfo('Le devis doit comporter au moins un article.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleItemChange = (index: number, field: keyof QuoteItemFormData, value: any) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      const updatedItem = { ...newItems[index], [field]: value };

      // Auto-fill price from product if product_id changes
      if (field === 'product_id') {
        const prod = products.find((p) => p.id === Number(value));
        if (prod) {
          updatedItem.unit_price_ht = prod.sale_price || 0;
          updatedItem.tax_rate = prod.tax_rate !== undefined ? prod.tax_rate : 20;
        }
      }

      newItems[index] = updatedItem;
      return { ...prev, items: newItems };
    });
  };

  // Form Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.customer_id) errors.customer_id = 'Le client est obligatoire.';
    if (!formData.quote_date) errors.quote_date = 'La date du devis est obligatoire.';
    if (!formData.items || formData.items.length === 0) {
      errors.items = 'Veuillez ajouter au moins un article.';
    } else {
      formData.items.forEach((it, idx) => {
        if (!it.product_id) errors[`item_${idx}_product`] = 'Produit obligatoire.';
        if (Number(it.quantity) <= 0) errors[`item_${idx}_qty`] = 'Quantité > 0.';
        if (Number(it.unit_price_ht) < 0) errors[`item_${idx}_price`] = 'Prix >= 0.';
      });
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      const payload = {
        reference: formData.reference || undefined,
        customer_id: Number(formData.customer_id),
        quote_date: formData.quote_date,
        valid_until: formData.valid_until || null,
        payment_terms: formData.payment_terms || null,
        delivery_delay: formData.delivery_delay || null,
        realization_delay: formData.realization_delay || null,
        notes: formData.notes || null,
        items: formData.items.map((it) => ({
          product_id: Number(it.product_id),
          warehouse_id: it.warehouse_id ? Number(it.warehouse_id) : null,
          quantity: Number(it.quantity),
          unit_price_ht: Number(it.unit_price_ht),
          tax_rate: Number(it.tax_rate),
          discount_rate: Number(it.discount_rate),
        })),
      };

      if (isEditing && selectedQuote) {
        const res = await api.put<Quote>(`/api/v1/quotes/${selectedQuote.id}`, payload);
        showSuccess(`Devis ${res.data.reference} modifié avec succès.`);
      } else {
        const res = await api.post<Quote>('/api/v1/quotes', payload);
        showSuccess(`Devis ${res.data.reference} créé avec succès.`);
      }

      setIsFormModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors de l’enregistrement du devis.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Actions on Quotes (Send, Accept, Reject, Convert to Sale)
  const handleTriggerAction = (quote: Quote, type: 'send' | 'accept' | 'reject' | 'cancel' | 'convert') => {
    setActionQuote(quote);
    setActionType(type);
    setActionConfirmOpen(true);
  };

  const handleExecuteAction = async () => {
    if (!actionQuote || !actionType) return;
    setIsSubmitting(true);
    try {
      if (actionType === 'send') {
        const res = await api.post<Quote>(`/api/v1/quotes/${actionQuote.id}/send`);
        showSuccess(`Devis ${res.data.reference} marqué comme Envoyé.`);
      } else if (actionType === 'accept') {
        const res = await api.post<Quote>(`/api/v1/quotes/${actionQuote.id}/accept`);
        showSuccess(`Devis ${res.data.reference} marqué comme Accepté.`);
      } else if (actionType === 'reject') {
        const res = await api.post<Quote>(`/api/v1/quotes/${actionQuote.id}/reject`);
        showSuccess(`Devis ${res.data.reference} marqué comme Refusé.`);
      } else if (actionType === 'cancel') {
        const res = await api.post<Quote>(`/api/v1/quotes/${actionQuote.id}/cancel`);
        showSuccess(`Devis ${res.data.reference} annulé.`);
      } else if (actionType === 'convert') {
        const res = await api.post(`/api/v1/quotes/${actionQuote.id}/convert-to-sale`);
        showSuccess(`Devis ${actionQuote.reference} converti en Vente ${res.data.reference} !`);
        navigate(`/ventes/${res.data.id}`);
        return;
      }
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, `Erreur lors de l'action sur le devis.`));
    } finally {
      setIsSubmitting(false);
      setActionConfirmOpen(false);
      setActionQuote(null);
      setActionType(null);
    }
  };

  // Delete Quote
  const handleDeleteQuote = async () => {
    if (!quoteToDelete) return;
    try {
      await api.delete(`/api/v1/quotes/${quoteToDelete.id}`);
      showSuccess(`Devis ${quoteToDelete.reference} supprimé.`);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors de la suppression du devis.'));
    } finally {
      setDeleteConfirmOpen(false);
      setQuoteToDelete(null);
    }
  };

  // Status Badge Component
  const renderStatusBadge = (status: QuoteStatus) => {
    const badges: Record<QuoteStatus, { label: string; bg: string; text: string; border: string }> = {
      DRAFT: { label: 'Brouillon', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
      SENT: { label: 'Envoyé', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      ACCEPTED: { label: 'Accepté', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      REJECTED: { label: 'Refusé', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
      CANCELLED: { label: 'Annulé', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    };
    const b = badges[status] || badges.DRAFT;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${b.bg} ${b.text} ${b.border}`}>
        {b.label}
      </span>
    );
  };

  // DataTable Columns
  const columns: Column<Quote>[] = [
    {
      header: 'Référence',
      accessor: (q: Quote) => (
        <div className="flex items-center space-x-2">
          <FileText className="w-4 h-4 text-pesage-blue shrink-0" />
          <span className="font-semibold text-pesage-blue-dark">{q.reference}</span>
        </div>
      ),
    },
    {
      header: 'Client',
      accessor: (q: Quote) => (
        <div>
          <p className="font-medium text-app-text">{q.customer?.legal_name || q.customer?.trade_name || 'Client'}</p>
          <p className="text-xs text-app-text-muted">{q.customer?.code}</p>
        </div>
      ),
    },
    {
      header: 'Date devis',
      accessor: (q: Quote) => formatDate(q.quote_date),
    },
    {
      header: 'Validité',
      accessor: (q: Quote) => (q.valid_until ? formatDate(q.valid_until) : '—'),
    },
    {
      header: 'Total HT',
      accessor: (q: Quote) => formatCurrency(q.subtotal_ht),
    },
    {
      header: 'Total TTC',
      accessor: (q: Quote) => (
        <span className="font-bold text-app-text">{formatCurrency(q.total_ttc)}</span>
      ),
    },
    {
      header: 'Statut',
      accessor: (q: Quote) => renderStatusBadge(q.status),
    },
    {
      header: 'Actions',
      accessor: (q: Quote) => (
        <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
          {/* View / Print Preview */}
          <button
            onClick={() => {
              setSelectedQuote(q);
              setIsPreviewModalOpen(true);
            }}
            className="p-1.5 rounded-lg hover:bg-app-surface-hover text-app-text-muted hover:text-pesage-blue transition-colors"
            title="Aperçu & Impression"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Workflow Action: Send */}
          {q.status === 'DRAFT' && (
            <button
              onClick={() => handleTriggerAction(q, 'send')}
              className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors"
              title="Marquer comme Envoyé"
            >
              <Send className="w-4 h-4" />
            </button>
          )}

          {/* Workflow Action: Accept */}
          {(q.status === 'DRAFT' || q.status === 'SENT') && (
            <button
              onClick={() => handleTriggerAction(q, 'accept')}
              className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-600 transition-colors"
              title="Marquer comme Accepté"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}

          {/* Workflow Action: Convert to Sale */}
          {(q.status === 'ACCEPTED' || q.status === 'SENT') && (
            <button
              onClick={() => handleTriggerAction(q, 'convert')}
              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center space-x-1 shadow-xs transition-colors"
              title="Convertir en Vente"
            >
              <FileCheck2 className="w-3.5 h-3.5" />
              <span>Convertir</span>
            </button>
          )}

          {/* Edit (Draft only) */}
          {q.status === 'DRAFT' && (
            <button
              onClick={() => handleOpenEditModal(q)}
              className="p-1.5 rounded-lg hover:bg-app-surface-hover text-app-text-muted hover:text-pesage-orange transition-colors"
              title="Modifier"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {/* Delete (Draft only) */}
          {(q.status === 'DRAFT' || q.status === 'CANCELLED') && (
            <button
              onClick={() => {
                setQuoteToDelete(q);
                setDeleteConfirmOpen(true);
              }}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-app-text-muted hover:text-rose-600 transition-colors"
              title="Supprimer"
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
        title="Devis Clients"
        description="Créez, gérez et convertissez vos propositions commerciales en commandes et ventes fermes."
        actions={
          <button
            onClick={handleOpenCreateModal}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-sm shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Devis</span>
          </button>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-pesage-blue/10 text-pesage-blue rounded-xl">
            <FileText className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Total Devis</p>
            <p className="text-xl font-bold text-app-text">{stats.total}</p>
          </div>
        </div>

        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Brouillons / En cours</p>
            <p className="text-xl font-bold text-app-text">{stats.draft + stats.sent}</p>
          </div>
        </div>

        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Acceptés</p>
            <p className="text-xl font-bold text-emerald-600">{stats.accepted}</p>
          </div>
        </div>

        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-pesage-orange/10 text-pesage-orange rounded-xl">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Volume Devisé</p>
            <p className="text-xl font-bold text-app-text">{formatCurrency(stats.totalAmount)}</p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="w-64">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Rechercher par référence, client..."
              />
            </div>

            <DatePeriodFilter
              value={periodFilter}
              onChange={setPeriodFilter}
              onReset={() => setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' })}
            />

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

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="DRAFT">Brouillon</option>
              <option value="SENT">Envoyé</option>
              <option value="ACCEPTED">Accepté</option>
              <option value="REJECTED">Refusé</option>
              <option value="CANCELLED">Annulé</option>
            </select>
          </div>

          {(searchTerm.trim() !== '' || customerFilter !== 'ALL' || statusFilter !== 'ALL' || periodFilter.preset !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => {
                setSearchTerm('');
                setCustomerFilter('ALL');
                setStatusFilter('ALL');
                setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' });
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        {(searchTerm.trim() !== '' || customerFilter !== 'ALL' || statusFilter !== 'ALL' || periodFilter.preset !== 'ALL') && (
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
                Client : {customers.find((c) => String(c.id) === customerFilter)?.legal_name || customerFilter}
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

      {/* Main DataTable */}
      <DataTable<Quote>
        columns={columns}
        data={filteredQuotes}
        keyExtractor={(q) => q.id}
        isLoading={isLoading}
        emptyTitle="Aucun devis trouvé"
        emptyDescription="Créez votre première proposition commerciale en cliquant sur Nouveau Devis."
      />

      {/* Create / Edit Quote Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={isEditing ? `Modifier le Devis ${selectedQuote?.reference}` : 'Nouveau Devis Commercial'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Référence *" error={formErrors.reference}>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                placeholder="Ex: DEV-2026-0001"
                required
              />
            </FormField>

            <FormField label="Client *" error={formErrors.customer_id}>
              <select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                required
              >
                <option value="">
                  {customers.length === 0 ? 'Aucun client disponible' : 'Sélectionner un client...'}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.legal_name || c.trade_name} ({c.code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date du devis *" error={formErrors.quote_date}>
              <input
                type="date"
                value={formData.quote_date}
                onChange={(e) => setFormData({ ...formData, quote_date: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                required
              />
            </FormField>

            <FormField label="Date de validité">
              <input
                type="date"
                value={formData.valid_until || ''}
                onChange={(e) => setFormData({ ...formData, valid_until: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
              />
            </FormField>

            <FormField label="Conditions de règlement">
              <select
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
              >
                {PAYMENT_TERMS.map((pt) => (
                  <option key={pt.value} value={pt.value}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Délai de livraison">
              <input
                type="text"
                value={formData.delivery_delay || ''}
                onChange={(e) => setFormData({ ...formData, delivery_delay: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                placeholder="Ex: 7 jours, 15 jours, À convenir..."
              />
            </FormField>

            <FormField label="Délai de réalisation">
              <input
                type="text"
                value={formData.realization_delay || ''}
                onChange={(e) => setFormData({ ...formData, realization_delay: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                placeholder="Ex: 3 jours, 1 semaine, À convenir..."
              />
            </FormField>

            <FormField label="Notes & Observations">
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                placeholder="Remarques éventuelles..."
              />
            </FormField>
          </div>

          {/* Line Items Section */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-app-text flex items-center space-x-2">
                <Package className="w-4 h-4 text-pesage-blue" />
                <span>Articles du Devis</span>
              </h3>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-pesage-blue/10 hover:bg-pesage-blue/20 text-pesage-blue font-semibold text-xs transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter un article</span>
              </button>
            </div>

            {formErrors.items && (
              <p className="text-xs text-rose-600 font-medium">{formErrors.items}</p>
            )}

            <div className="border border-app-border rounded-xl overflow-x-auto bg-app-surface-subtle/30">
              <table className="w-full text-xs text-left">
                <thead className="bg-app-surface-subtle text-app-text-muted font-semibold uppercase tracking-wider border-b border-app-border">
                  <tr>
                    <th className="p-3 min-w-[220px]">Produit *</th>
                    <th className="p-3 min-w-[160px]">Dépôt préférentiel</th>
                    <th className="p-3 w-24">Quantité *</th>
                    <th className="p-3 w-28">Prix Unit. HT *</th>
                    <th className="p-3 w-20">Remise %</th>
                    <th className="p-3 w-20">TVA %</th>
                    <th className="p-3 w-32 text-right">Total TTC</th>
                    <th className="p-3 w-10 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {formData.items.map((item, index) => {
                    const calc = calculateItemSubtotal(item);
                    return (
                      <tr key={index} className="hover:bg-app-surface-hover/50">
                        {/* Product */}
                        <td className="p-2.5">
                          <select
                            value={item.product_id}
                            onChange={(e) => handleItemChange(index, 'product_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text text-xs focus:ring-1 focus:ring-pesage-blue"
                            required
                          >
                            <option value="">Choisir un produit...</option>
                            {products.map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.designation} ({p.sku})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Warehouse */}
                        <td className="p-2.5">
                          <select
                            value={item.warehouse_id || ''}
                            onChange={(e) => handleItemChange(index, 'warehouse_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text text-xs focus:ring-1 focus:ring-pesage-blue"
                          >
                            <option value="">Tous dépôts / Standard</option>
                            {warehouses.map((w) => (
                              <option key={w.id} value={w.id}>
                                {w.name} ({w.code})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Quantity */}
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="1"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text text-xs text-center focus:ring-1 focus:ring-pesage-blue"
                            required
                          />
                        </td>

                        {/* Unit Price HT */}
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={item.unit_price_ht}
                            onChange={(e) => handleItemChange(index, 'unit_price_ht', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text text-xs text-right focus:ring-1 focus:ring-pesage-blue"
                            required
                          />
                        </td>

                        {/* Discount */}
                        <td className="p-2.5">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={item.discount_rate}
                            onChange={(e) => handleItemChange(index, 'discount_rate', e.target.value)}
                            className="w-full px-2 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text text-xs text-center focus:ring-1 focus:ring-pesage-blue"
                          />
                        </td>

                        {/* Tax Rate */}
                        <td className="p-2.5">
                          <select
                            value={item.tax_rate}
                            onChange={(e) => handleItemChange(index, 'tax_rate', Number(e.target.value))}
                            className="w-full px-2 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text text-xs text-center focus:ring-1 focus:ring-pesage-blue"
                          >
                            <option value={20}>20%</option>
                            <option value={14}>14%</option>
                            <option value={10}>10%</option>
                            <option value={7}>7%</option>
                            <option value={0}>0%</option>
                          </select>
                        </td>

                        {/* Total TTC */}
                        <td className="p-2.5 text-right font-semibold text-app-text">
                          {formatCurrency(calc.totalTTC)}
                        </td>

                        {/* Remove */}
                        <td className="p-2.5 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(index)}
                            className="p-1 rounded text-app-text-muted hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Supprimer la ligne"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary Panel */}
            <div className="flex justify-end pt-3">
              <div className="w-full max-w-xs bg-app-surface-subtle p-4 rounded-xl border border-app-border space-y-2 text-xs">
                <div className="flex justify-between text-app-text-secondary">
                  <span>Sous-total HT :</span>
                  <span className="font-semibold text-app-text">{formatCurrency(formTotals.subtotalHT)}</span>
                </div>
                {formTotals.totalDiscount > 0 && (
                  <div className="flex justify-between text-amber-600">
                    <span>Remise totale :</span>
                    <span className="font-semibold">-{formatCurrency(formTotals.totalDiscount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-app-text-secondary">
                  <span>TVA :</span>
                  <span className="font-semibold text-app-text">{formatCurrency(formTotals.totalTax)}</span>
                </div>
                <div className="flex justify-between text-sm font-bold text-app-text border-t border-app-border pt-2">
                  <span>Total TTC :</span>
                  <span className="text-pesage-blue-dark">{formatCurrency(formTotals.totalTTC)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="btn-secondary text-xs px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-5 py-2 flex items-center space-x-2"
            >
              {isSubmitting ? (
                <span>Enregistrement...</span>
              ) : (
                <span>{isEditing ? 'Mettre à jour' : 'Créer le Devis'}</span>
              )}
            </button>
          </div>
        </form>
      </Modal>

      {/* Quote Printable / Preview Modal */}
      {selectedQuote && (
        <DocumentPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title="Aperçu du Devis"
          documentRef={selectedQuote.reference}
          extraActions={
            (selectedQuote.status === 'ACCEPTED' || selectedQuote.status === 'SENT') && (
              <button
                type="button"
                onClick={() => {
                  setIsPreviewModalOpen(false);
                  handleTriggerAction(selectedQuote, 'convert');
                }}
                className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-sm transition-colors cursor-pointer"
              >
                <FileCheck2 className="w-4 h-4" />
                <span className="hidden sm:inline">Convertir en Vente</span>
              </button>
            )
          }
        >
          <QuoteDocument quote={selectedQuote} />
        </DocumentPreviewModal>
      )}


      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteQuote}
        title="Supprimer le Devis"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le devis ${quoteToDelete?.reference} ? Cette action est irréversible.`}
        confirmLabel="Supprimer"
        cancelLabel="Annuler"
        variant="danger"
      />

      {/* General Action Confirmation Dialog */}
      <ConfirmDialog
        isOpen={actionConfirmOpen}
        onClose={() => setActionConfirmOpen(false)}
        onConfirm={handleExecuteAction}
        title={
          actionType === 'convert'
            ? 'Convertir le Devis en Vente'
            : actionType === 'accept'
            ? 'Accepter le Devis'
            : actionType === 'send'
            ? 'Marquer comme Envoyé'
            : actionType === 'reject'
            ? 'Refuser le Devis'
            : 'Annuler le Devis'
        }
        message={
          actionType === 'convert'
            ? `Voulez-vous convertir le devis ${actionQuote?.reference} en commande de vente ? Un bon de commande client sera créé automatiquement.`
            : `Confirmez-vous le changement de statut pour le devis ${actionQuote?.reference} ?`
        }
        confirmLabel={actionType === 'convert' ? 'Convertir en Vente' : 'Confirmer'}
        cancelLabel="Retour"
        variant={actionType === 'reject' || actionType === 'cancel' ? 'danger' : 'primary'}
      />
    </div>
  );
};
