import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { customerService } from '@/services/customerService';
import {
  DeliveryNote,
  DeliveryNoteFormData,
  DeliveryNoteStatus,
  SaleDeliveryProgress,
} from '@/types/deliveryNotes';
import { Sale } from '@/types/sales';
import { BusinessPartner } from '@/types/partner';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { DatePeriodFilter, DatePeriodValue } from '@/components/ui/DatePeriodFilter';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { formatDate } from '@/lib/formatters';
import {
  DocumentHeader,
  PartnerInfoBlock,
  SignaturesBlock,
  DocumentFooter,
  DeliveryNoteDocument,
} from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

import {
  Truck,
  Plus,
  Trash2,
  Eye,
  Calendar,
  Package,
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  RotateCcw,
  X,
} from 'lucide-react';

export const DeliveryNotesPage: React.FC = () => {
  const location = useLocation();
  const { showSuccess, showError } = useNotification();

  // Data lists
  const [deliveryNotes, setDeliveryNotes] = useState<DeliveryNote[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<BusinessPartner[]>([]);
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
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState<DeliveryNote | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sale Delivery Progress for Form
  const [selectedSaleId, setSelectedSaleId] = useState<number | null>(null);
  const [deliveryProgress, setDeliveryProgress] = useState<SaleDeliveryProgress | null>(null);
  const [isLoadingProgress, setIsLoadingProgress] = useState(false);

  // Form state
  const initialFormState: DeliveryNoteFormData = {
    reference: '',
    sale_id: 0,
    delivery_date: new Date().toISOString().split('T')[0],
    shipping_address: '',
    tracking_number: '',
    notes: '',
    items: [],
  };

  const [formData, setFormData] = useState<DeliveryNoteFormData>(initialFormState);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Cancel confirmation
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [blToCancel, setBlToCancel] = useState<DeliveryNote | null>(null);

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

      const blUrl = params.toString() ? `/api/v1/delivery-notes?${params.toString()}` : '/api/v1/delivery-notes';

      const [blRes, salesRes, customersList] = await Promise.all([
        api.get<DeliveryNote[]>(blUrl),
        api.get<Sale[]>('/api/v1/sales'),
        customerService.getCustomers({ isActive: true }),
      ]);
      setDeliveryNotes(blRes.data);
      setSales(salesRes.data);
      setCustomers(customersList);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du chargement des bons de livraison.'));
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter, statusFilter, customerFilter, searchTerm, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle URL query parameters (e.g. ?sale_id=123 to auto-open creation)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const preSaleId = params.get('sale_id');
    if (preSaleId && sales.length > 0) {
      const sId = Number(preSaleId);
      handleOpenCreateModal(sId);
    }
  }, [location.search, sales]);

  // Eligible sales for delivery (Confirmed or Partially Delivered)
  const eligibleSales = useMemo(() => {
    return sales.filter(
      (s) => s.status === 'CONFIRMED' || s.status === 'PARTIALLY_DELIVERED'
    );
  }, [sales]);

  // Filtered delivery notes
  const filteredNotes = useMemo(() => {
    return deliveryNotes.filter((dn) => {
      const customerName = dn.customer?.legal_name || dn.customer?.trade_name || '';
      const matchesSearch =
        dn.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dn.sale?.reference && dn.sale.reference.toLowerCase().includes(searchTerm.toLowerCase())) ||
        customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (dn.tracking_number && dn.tracking_number.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchesStatus = statusFilter === 'ALL' || dn.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [deliveryNotes, searchTerm, statusFilter]);

  // Stats calculation
  const stats = useMemo(() => {
    const total = deliveryNotes.length;
    const delivered = deliveryNotes.filter((dn) => dn.status === 'DELIVERED').length;
    const cancelled = deliveryNotes.filter((dn) => dn.status === 'CANCELLED').length;
    const pendingSales = eligibleSales.length;

    return { total, delivered, cancelled, pendingSales };
  }, [deliveryNotes, eligibleSales]);

  // Load sale progress when selecting a sale in creation modal
  const handleSelectSale = async (saleId: number) => {
    setSelectedSaleId(saleId);
    if (!saleId) {
      setDeliveryProgress(null);
      setFormData((prev) => ({ ...prev, sale_id: 0, items: [] }));
      return;
    }

    setIsLoadingProgress(true);
    try {
      const res = await api.get<SaleDeliveryProgress>(
        `/api/v1/delivery-notes/sales/${saleId}/delivery-progress`
      );
      setDeliveryProgress(res.data);

      const targetSale = sales.find((s) => s.id === saleId);

      // Pre-fill form items with remaining quantities
      setFormData((prev) => ({
        ...prev,
        sale_id: saleId,
        shipping_address: targetSale?.customer?.address || '',
        items: res.data.items.map((it) => ({
          sale_item_id: it.sale_item_id,
          delivered_quantity: it.remaining_quantity, // default to deliver all remaining
          notes: '',
        })),
      }));
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors de la récupération des reliquats de la commande.'));
    } finally {
      setIsLoadingProgress(false);
    }
  };

  // Open Create Modal
  const handleOpenCreateModal = (preselectedSaleId?: number) => {
    const newRef = `BL-${new Date().getFullYear()}-${String(deliveryNotes.length + 1).padStart(4, '0')}`;
    setFormData({
      ...initialFormState,
      reference: newRef,
      sale_id: preselectedSaleId || 0,
    });
    setFormErrors({});
    setIsFormModalOpen(true);

    if (preselectedSaleId) {
      handleSelectSale(preselectedSaleId);
    } else {
      setSelectedSaleId(null);
      setDeliveryProgress(null);
    }
  };

  // Handle line item quantity change
  const handleItemQtyChange = (saleItemId: number, val: number) => {
    setFormData((prev) => {
      const updated = prev.items.map((it) =>
        it.sale_item_id === saleItemId ? { ...it, delivered_quantity: val } : it
      );
      return { ...prev, items: updated };
    });
  };

  // Handle line item notes change
  const handleItemNotesChange = (saleItemId: number, notesVal: string) => {
    setFormData((prev) => {
      const updated = prev.items.map((it) =>
        it.sale_item_id === saleItemId ? { ...it, notes: notesVal } : it
      );
      return { ...prev, items: updated };
    });
  };

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.sale_id) errors.sale_id = 'La commande de vente est obligatoire.';
    if (!formData.delivery_date) errors.delivery_date = 'La date de livraison est obligatoire.';

    const nonZeroItems = formData.items.filter((it) => it.delivered_quantity > 0);
    if (nonZeroItems.length === 0) {
      errors.items = 'Veuillez renseigner une quantité à livrer > 0 sur au moins un article.';
    }

    if (deliveryProgress) {
      formData.items.forEach((it) => {
        const progressItem = deliveryProgress.items.find((p) => p.sale_item_id === it.sale_item_id);
        if (progressItem && it.delivered_quantity > progressItem.remaining_quantity) {
          errors[`item_${it.sale_item_id}`] = `Quantité max possible : ${progressItem.remaining_quantity}`;
        }
      });
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit BL Creation
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsSubmitting(true);
    try {
      // Filter only items with delivered_quantity > 0
      const activeItems = formData.items.filter((it) => it.delivered_quantity > 0);

      const payload = {
        reference: formData.reference || undefined,
        sale_id: formData.sale_id,
        delivery_date: formData.delivery_date,
        shipping_address: formData.shipping_address || null,
        tracking_number: formData.tracking_number || null,
        notes: formData.notes || null,
        items: activeItems.map((it) => ({
          sale_item_id: it.sale_item_id,
          delivered_quantity: Number(it.delivered_quantity),
          notes: it.notes || null,
        })),
      };

      const res = await api.post<DeliveryNote>('/api/v1/delivery-notes', payload);
      showSuccess(`Bon de Livraison ${res.data.reference} créé avec succès !`);
      setIsFormModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors de la création du bon de livraison.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Delivery Note
  const handleCancelDeliveryNote = async () => {
    if (!blToCancel) return;
    try {
      const res = await api.post<DeliveryNote>(`/api/v1/delivery-notes/${blToCancel.id}/cancel`);
      showSuccess(`Bon de Livraison ${res.data.reference} annulé.`);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors de l’annulation du bon de livraison.'));
    } finally {
      setCancelConfirmOpen(false);
      setBlToCancel(null);
    }
  };

  // Status Badge
  const renderStatusBadge = (status: DeliveryNoteStatus) => {
    if (status === 'DELIVERED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3 h-3 mr-1" />
          Livré
        </span>
      );
    }
    if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3 h-3 mr-1" />
          Annulé
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
        Brouillon
      </span>
    );
  };

  // DataTable Columns
  const columns: Column<DeliveryNote>[] = [
    {
      header: 'N° Bon de Livraison',
      accessor: (dn: DeliveryNote) => (
        <div className="flex items-center space-x-2">
          <Truck className="w-4 h-4 text-pesage-blue shrink-0" />
          <span className="font-semibold text-pesage-blue-dark">{dn.reference}</span>
        </div>
      ),
    },
    {
      header: 'Commande / Vente',
      accessor: (dn: DeliveryNote) => (
        <span className="font-medium text-app-text">{dn.sale?.reference || `Vente #${dn.sale_id}`}</span>
      ),
    },
    {
      header: 'Client',
      accessor: (dn: DeliveryNote) => (
        <div>
          <p className="font-medium text-app-text">{dn.customer?.legal_name || dn.customer?.trade_name || 'Client'}</p>
          <p className="text-xs text-app-text-muted">{dn.customer?.code}</p>
        </div>
      ),
    },
    {
      header: 'Date de livraison',
      accessor: (dn: DeliveryNote) => formatDate(dn.delivery_date),
    },
    {
      header: 'N° Suivi / Transport',
      accessor: (dn: DeliveryNote) => dn.tracking_number || '—',
    },
    {
      header: 'Articles livrés',
      accessor: (dn: DeliveryNote) => (
        <span className="px-2 py-0.5 rounded-md bg-app-surface-subtle font-semibold text-app-text text-xs border border-app-border">
          {dn.items.reduce((acc, it) => acc + it.delivered_quantity, 0)} unité(s)
        </span>
      ),
    },
    {
      header: 'Statut',
      accessor: (dn: DeliveryNote) => renderStatusBadge(dn.status),
    },
    {
      header: 'Actions',
      accessor: (dn: DeliveryNote) => (
        <div className="flex items-center space-x-1.5" onClick={(e) => e.stopPropagation()}>
          {/* View / Print Preview */}
          <button
            onClick={() => {
              setSelectedDeliveryNote(dn);
              setIsPreviewModalOpen(true);
            }}
            className="p-1.5 rounded-lg hover:bg-app-surface-hover text-app-text-muted hover:text-pesage-blue transition-colors"
            title="Aperçu & Impression du BL"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Cancel */}
          {dn.status === 'DELIVERED' && (
            <button
              onClick={() => {
                setBlToCancel(dn);
                setCancelConfirmOpen(true);
              }}
              className="p-1.5 rounded-lg hover:bg-rose-50 text-app-text-muted hover:text-rose-600 transition-colors"
              title="Annuler ce Bon de Livraison"
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
        title="Bons de Livraison"
        description="Générez et suivez les expéditions de marchandises vers vos clients avec gestion des livraisons partielles."
        actions={
          <button
            onClick={() => handleOpenCreateModal()}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-sm shadow-xs transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Bon de Livraison</span>
          </button>
        }
      />

      {/* KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-pesage-blue/10 text-pesage-blue rounded-xl">
            <Truck className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Total Bons Émis</p>
            <p className="text-xl font-bold text-app-text">{stats.total}</p>
          </div>
        </div>

        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Livrés</p>
            <p className="text-xl font-bold text-emerald-600">{stats.delivered}</p>
          </div>
        </div>

        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-amber-500/10 text-amber-600 rounded-xl">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Commandes en attente</p>
            <p className="text-xl font-bold text-app-text">{stats.pendingSales}</p>
          </div>
        </div>

        <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs flex items-center space-x-3">
          <div className="p-3 bg-rose-500/10 text-rose-600 rounded-xl">
            <XCircle className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-app-text-muted uppercase tracking-wider">Annulés</p>
            <p className="text-xl font-bold text-app-text">{stats.cancelled}</p>
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
                placeholder="Rechercher N° BL, vente, client..."
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
              <option value="DELIVERED">Livrés</option>
              <option value="CANCELLED">Annulés</option>
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
      <DataTable<DeliveryNote>
        columns={columns}
        data={filteredNotes}
        keyExtractor={(dn) => dn.id}
        isLoading={isLoading}
        emptyTitle="Aucun bon de livraison trouvé"
        emptyDescription="Générez votre premier bon de livraison depuis une commande de vente confirmée."
      />

      {/* Create Delivery Note Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title="Nouveau Bon de Livraison (BL)"
        maxWidth="4xl"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Référence BL *" error={formErrors.reference}>
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                placeholder="Ex: BL-2026-0001"
                required
              />
            </FormField>

            <FormField label="Commande de Vente associée *" error={formErrors.sale_id}>
              <select
                value={formData.sale_id || ''}
                onChange={(e) => handleSelectSale(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                required
              >
                <option value="">Sélectionner une commande de vente confirmée...</option>
                {eligibleSales.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.reference} — {s.customer?.legal_name || s.customer?.trade_name} ({s.status === 'PARTIALLY_DELIVERED' ? 'Partiellement livrée' : 'Prête pour livraison'})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date de livraison *" error={formErrors.delivery_date}>
              <input
                type="date"
                value={formData.delivery_date}
                onChange={(e) => setFormData({ ...formData, delivery_date: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                required
              />
            </FormField>

            <FormField label="N° de suivi / Transporteur">
              <input
                type="text"
                value={formData.tracking_number || ''}
                onChange={(e) => setFormData({ ...formData, tracking_number: e.target.value })}
                className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                placeholder="Ex: CTM-88231 / Livreur interne"
              />
            </FormField>

            <div className="md:col-span-2">
              <FormField label="Adresse de livraison">
                <input
                  type="text"
                  value={formData.shipping_address || ''}
                  onChange={(e) => setFormData({ ...formData, shipping_address: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-app-border bg-app-surface text-app-text focus:border-pesage-blue focus:ring-1 focus:ring-pesage-blue text-sm"
                  placeholder="Adresse complète du destinataire"
                />
              </FormField>
            </div>
          </div>

          {/* Items Section */}
          <div className="space-y-3 pt-2">
            <h3 className="text-sm font-bold text-app-text flex items-center space-x-2">
              <Package className="w-4 h-4 text-pesage-blue" />
              <span>Articles à expédier</span>
            </h3>

            {formErrors.items && (
              <p className="text-xs text-rose-600 font-medium">{formErrors.items}</p>
            )}

            {isLoadingProgress ? (
              <div className="p-8 text-center text-app-text-muted">
                Chargement des articles de la commande...
              </div>
            ) : deliveryProgress ? (
              <div className="border border-app-border rounded-xl overflow-hidden bg-app-surface-subtle/30">
                <table className="w-full text-xs text-left">
                  <thead className="bg-app-surface-subtle text-app-text-muted font-semibold uppercase tracking-wider border-b border-app-border">
                    <tr>
                      <th className="p-3">Produit</th>
                      <th className="p-3">Dépôt</th>
                      <th className="p-3 text-center">Commandé</th>
                      <th className="p-3 text-center">Déjà livré</th>
                      <th className="p-3 text-center">Reste à livrer</th>
                      <th className="p-3 w-32 text-center bg-pesage-blue/10 text-pesage-blue">Livré ce jour *</th>
                      <th className="p-3">Notes / N° Série</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {deliveryProgress.items.map((it) => {
                      const currentFormItem = formData.items.find((f) => f.sale_item_id === it.sale_item_id);
                      const isComplete = it.remaining_quantity === 0;

                      return (
                        <tr key={it.sale_item_id} className={isComplete ? 'opacity-50 bg-app-surface-subtle/50' : 'hover:bg-app-surface-hover/50'}>
                          <td className="p-3">
                            <p className="font-semibold text-app-text">{it.product_name}</p>
                            <p className="text-[10px] text-app-text-muted">SKU: {it.product_sku}</p>
                          </td>
                          <td className="p-3 text-app-text-secondary">{it.warehouse_name || 'Standard'}</td>
                          <td className="p-3 text-center font-medium">{it.ordered_quantity}</td>
                          <td className="p-3 text-center text-app-text-muted">{it.delivered_quantity}</td>
                          <td className="p-3 text-center font-bold text-amber-600">{it.remaining_quantity}</td>
                          <td className="p-3 bg-pesage-blue/5">
                            <input
                              type="number"
                              min="0"
                              max={it.remaining_quantity}
                              step="any"
                              disabled={isComplete}
                              value={currentFormItem?.delivered_quantity ?? 0}
                              onChange={(e) => handleItemQtyChange(it.sale_item_id, Number(e.target.value))}
                              className="w-full px-2.5 py-1.5 rounded-lg border border-pesage-blue/30 bg-app-surface text-app-text text-xs text-center font-bold focus:ring-1 focus:ring-pesage-blue disabled:opacity-50"
                            />
                            {formErrors[`item_${it.sale_item_id}`] && (
                              <p className="text-[10px] text-rose-600 mt-1">{formErrors[`item_${it.sale_item_id}`]}</p>
                            )}
                          </td>
                          <td className="p-3">
                            <input
                              type="text"
                              disabled={isComplete}
                              value={currentFormItem?.notes || ''}
                              onChange={(e) => handleItemNotesChange(it.sale_item_id, e.target.value)}
                              placeholder="N° de série, colis..."
                              className="w-full px-2.5 py-1.5 rounded-lg border border-app-border bg-app-surface text-app-text text-xs"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-8 text-center text-app-text-muted bg-app-surface-subtle/40 rounded-xl border border-dashed border-app-border">
                Veuillez sélectionner une commande de vente pour charger ses articles.
              </div>
            )}
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
              disabled={isSubmitting || !deliveryProgress}
              className="btn-primary text-xs px-5 py-2"
            >
              {isSubmitting ? 'Création en cours...' : 'Générer le Bon de Livraison'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Printable / Preview Delivery Note Modal */}
      {selectedDeliveryNote && (
        <DocumentPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title="Aperçu Bon de Livraison"
          documentRef={selectedDeliveryNote.reference}
        >
          <DeliveryNoteDocument deliveryNote={selectedDeliveryNote} />
        </DocumentPreviewModal>
      )}


      {/* Cancel Confirmation Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancelDeliveryNote}
        title="Annuler le Bon de Livraison"
        message={`Voulez-vous vraiment annuler le bon de livraison ${blToCancel?.reference} ? Le statut de livraison de la vente sera recalculé automatiquement.`}
        confirmLabel="Confirmer l'annulation"
        cancelLabel="Retour"
        variant="danger"
      />
    </div>
  );
};
