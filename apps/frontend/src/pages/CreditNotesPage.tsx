import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  CreditNote,
  CreditNoteCreate,
  CreditNoteItemCreate,
  CreditNoteReason,
  CreditNoteStatus,
} from '@/types/creditNotes';
import { Invoice } from '@/types/invoices';
import { Warehouse } from '@/types/warehouse';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { DatePeriodFilter, DatePeriodValue } from '@/components/ui/DatePeriodFilter';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  DocumentHeader,
  PartnerInfoBlock,
  TotalsBlock,
  SignaturesBlock,
  DocumentFooter,
  CreditNoteDocument,
} from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

import {
  FileText,
  RotateCcw,
  Plus,
  Download,
  Eye,
  Trash2,
  CheckCircle,
  Clock,
  AlertCircle,
  Building,
  Package,
  Calendar,
  Printer,
  X,
} from 'lucide-react';

export const CreditNotesPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();

  const [creditNotes, setCreditNotes] = useState<CreditNote[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [reasonFilter, setReasonFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodValue>({
    preset: 'ALL',
    label: 'Toutes les dates',
  });

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [selectedCreditNote, setSelectedCreditNote] = useState<CreditNote | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form creation state
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);
  const [creditReason, setCreditReason] = useState<CreditNoteReason>(CreditNoteReason.RETURN);
  const [reasonDetails, setReasonDetails] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [itemsToCredit, setItemsToCredit] = useState<
    Array<{
      invoice_item_id: number;
      product_id?: number | null;
      description: string;
      unit_price_ht: number;
      tax_rate: number;
      discount_rate: number;
      max_quantity: number;
      quantity: number;
      return_to_stock: boolean;
      warehouse_id?: number | null;
    }>
  >([]);

  // Cancel dialog
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cnToCancel, setCnToCancel] = useState<CreditNote | null>(null);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodFilter.dateFrom) params.append('date_from', periodFilter.dateFrom);
      if (periodFilter.dateTo) params.append('date_to', periodFilter.dateTo);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (reasonFilter !== 'ALL') params.append('reason', reasonFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const cnUrl = params.toString() ? `/api/v1/credit-notes?${params.toString()}` : '/api/v1/credit-notes';

      const [cnRes, invRes, whRes] = await Promise.all([
        api.get<CreditNote[]>(cnUrl),
        api.get<Invoice[]>('/api/v1/invoices?invoice_type=CUSTOMER'),
        api.get<Warehouse[]>('/api/v1/warehouses'),
      ]);
      setCreditNotes(cnRes.data);
      setInvoices(invRes.data);
      setWarehouses(whRes.data.filter((w) => w.is_active));
    } catch (err) {
      showError(getApiErrorMessage(err, "Impossible de charger les avoirs clients."));
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter, statusFilter, reasonFilter, searchTerm, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle invoice selection in create modal
  const handleSelectInvoice = (invoiceId: number) => {
    setSelectedInvoiceId(invoiceId);
    const invoice = invoices.find((inv) => inv.id === invoiceId);
    if (invoice && invoice.items) {
      const defaultWh = warehouses.length > 0 ? warehouses[0].id : null;
      setItemsToCredit(
        invoice.items.map((item) => ({
          invoice_item_id: item.id,
          product_id: item.product_id,
          description: item.description || `Article #${item.id}`,
          unit_price_ht: item.unit_price_ht,
          tax_rate: item.tax_rate,
          discount_rate: item.discount_rate || 0,
          max_quantity: item.quantity,
          quantity: item.quantity,
          return_to_stock: item.product_id ? true : false,
          warehouse_id: defaultWh,
        }))
      );
    } else {
      setItemsToCredit([]);
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInvoiceId) {
      showError('Veuillez sélectionner une facture client.');
      return;
    }

    const validLines = itemsToCredit.filter((it) => it.quantity > 0);
    if (validLines.length === 0) {
      showError("Veuillez indiquer au moins une ligne avec une quantité d'avoir positive.");
      return;
    }

    // Check stock return requirement
    for (const line of validLines) {
      if (line.return_to_stock && !line.warehouse_id) {
        showError(`Veuillez sélectionner un dépôt pour la réintégration de '${line.description}'.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload: CreditNoteCreate = {
        invoice_id: selectedInvoiceId,
        reason: creditReason,
        reason_details: reasonDetails.trim() || undefined,
        notes: formNotes.trim() || undefined,
        items: validLines.map(
          (line): CreditNoteItemCreate => ({
            invoice_item_id: line.invoice_item_id,
            product_id: line.product_id,
            warehouse_id: line.return_to_stock ? line.warehouse_id : null,
            description: line.description,
            quantity: line.quantity,
            unit_price_ht: line.unit_price_ht,
            tax_rate: line.tax_rate,
            discount_rate: line.discount_rate,
            return_to_stock: line.return_to_stock,
          })
        ),
      };

      const res = await api.post<CreditNote>('/api/v1/credit-notes', payload);
      showSuccess(`Avoir ${res.data.reference} généré avec succès.`);
      setIsCreateModalOpen(false);
      setSelectedInvoiceId(null);
      setItemsToCredit([]);
      setReasonDetails('');
      setFormNotes('');
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de l'émission de l'avoir."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelCreditNote = async () => {
    if (!cnToCancel) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/credit-notes/${cnToCancel.id}/cancel`);
      showSuccess(`Avoir ${cnToCancel.reference} annulé avec succès.`);
      setCancelDialogOpen(false);
      setCnToCancel(null);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de l'annulation de l'avoir."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/exports/credit-notes?status=${statusFilter === 'ALL' ? '' : statusFilter}`;
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'avoirs_clients.xlsx');
    // Add token header via direct fetch or target
    fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        link.href = downloadUrl;
        document.body.appendChild(link);
        link.click();
        link.remove();
        showSuccess('Export Excel des avoirs téléchargé.');
      })
      .catch((e) => showError(getApiErrorMessage(e, "Erreur lors de l'exportation Excel.")));
  };

  // KPIs
  const kpis = useMemo(() => {
    const totalTtc = creditNotes
      .filter((cn) => cn.status === CreditNoteStatus.VALIDATED)
      .reduce((sum, cn) => sum + Number(cn.total_ttc), 0);
    const count = creditNotes.filter((cn) => cn.status === CreditNoteStatus.VALIDATED).length;
    const returnedItems = creditNotes
      .filter((cn) => cn.status === CreditNoteStatus.VALIDATED)
      .reduce(
        (sum, cn) => sum + cn.items.filter((i) => i.return_to_stock).reduce((s, it) => s + Number(it.quantity), 0),
        0
      );
    return { totalTtc, count, returnedItems };
  }, [creditNotes]);

  // Filtered list
  const filteredCreditNotes = useMemo(() => {
    return creditNotes.filter((cn) => {
      const matchSearch =
        searchTerm.trim() === '' ||
        cn.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cn.customer?.legal_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        cn.invoice?.reference.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || cn.status === statusFilter;
      const matchReason = reasonFilter === 'ALL' || cn.reason === reasonFilter;

      return matchSearch && matchStatus && matchReason;
    });
  }, [creditNotes, searchTerm, statusFilter, reasonFilter]);

  const columns: Column<CreditNote>[] = [
    {
      header: 'Référence',
      accessor: (cn) => (
        <span className="font-semibold text-primary-600 dark:text-primary-400 font-mono">
          {cn.reference}
        </span>
      ),
    },
    {
      header: 'Date',
      accessor: (cn) => (
        <span className="text-gray-600 dark:text-gray-300 text-sm">
          {formatDate(cn.credit_note_date)}
        </span>
      ),
    },
    {
      header: 'Client',
      accessor: (cn) => (
        <div>
          <div className="font-medium text-gray-900 dark:text-white">
            {cn.customer?.legal_name || '—'}
          </div>
          <div className="text-xs text-gray-500 font-mono">{cn.customer?.code}</div>
        </div>
      ),
    },
    {
      header: 'Facture d’origine',
      accessor: (cn) => (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 font-mono">
          <FileText className="w-3.5 h-3.5" />
          {cn.invoice?.reference || `Facture #${cn.invoice_id}`}
        </span>
      ),
    },
    {
      header: 'Motif',
      accessor: (cn) => {
        const labels: Record<string, string> = {
          RETURN: 'Retour de marchandise',
          BILLING_ERROR: 'Erreur de facturation',
          COMMERCIAL_DISCOUNT: 'Geste commercial',
          PARTIAL_CANCELLATION: 'Annulation partielle',
          PRICE_CORRECTION: 'Correction de prix',
          DEFECTIVE_PRODUCT: 'Produit défectueux',
          OTHER: 'Autre motif',
        };
        return (
          <span className="text-xs text-gray-700 dark:text-gray-300">
            {labels[cn.reason] || cn.reason}
          </span>
        );
      },
    },
    {
      header: 'Total TTC',
      accessor: (cn) => (
        <span className="font-bold text-gray-900 dark:text-white">
          {formatCurrency(cn.total_ttc)}
        </span>
      ),
    },
    {
      header: 'Statut',
      accessor: (cn) => {
        if (cn.status === CreditNoteStatus.VALIDATED) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
              <CheckCircle className="w-3 h-3" /> Validé
            </span>
          );
        }
        if (cn.status === CreditNoteStatus.CANCELLED) {
          return (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400">
              <AlertCircle className="w-3 h-3" /> Annulé
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
            <Clock className="w-3 h-3" /> Brouillon
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (cn) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => {
              setSelectedCreditNote(cn);
              setIsPreviewModalOpen(true);
            }}
            className="p-1.5 text-gray-500 hover:text-pesage-blue dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Consulter le détail"
          >
            <Eye className="w-4 h-4" />
          </button>
          {cn.status === CreditNoteStatus.VALIDATED && (
            <button
              type="button"
              onClick={() => {
                setCnToCancel(cn);
                setCancelDialogOpen(true);
              }}
              className="p-1.5 text-gray-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg transition-colors"
              title="Annuler l'avoir"
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
      <PageHeader
        title="Avoirs Clients"
        description="Gestion et émission des avoirs de facturation et réintégration de stock."
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-secondary px-3.5 py-2"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Exporter Excel</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedInvoiceId(null);
                setItemsToCredit([]);
                setIsCreateModalOpen(true);
              }}
              className="btn-primary px-4 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvel Avoir Client</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Avoirs Émis
            </span>
            <div className="p-2 rounded-xl bg-pesage-blue/10 text-pesage-blue dark:text-blue-400">
              <RotateCcw className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(kpis.totalTtc)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Impact financier déduit des créances clients</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Nombre d'Avoirs Validés
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {kpis.count}
          </div>
          <p className="mt-1 text-xs text-gray-500">Documents comptables enregistrés</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Articles Réintégrés
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {kpis.returnedItems} unités
          </div>
          <p className="mt-1 text-xs text-gray-500">Stock physique remis en disponibilité</p>
        </div>
      </div>

      {/* Filters Bar */}
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
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrer par statut"
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="ALL">Tous les statuts</option>
              <option value="VALIDATED">Validés</option>
              <option value="DRAFT">Brouillons</option>
              <option value="CANCELLED">Annulés</option>
            </select>

            <select
              value={reasonFilter}
              onChange={(e) => setReasonFilter(e.target.value)}
              aria-label="Filtrer par motif"
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="ALL">Tous les motifs</option>
              <option value="RETURN">Retour marchandise</option>
              <option value="BILLING_ERROR">Erreur de facturation</option>
              <option value="COMMERCIAL_DISCOUNT">Geste commercial</option>
              <option value="PARTIAL_CANCELLATION">Annulation partielle</option>
              <option value="PRICE_CORRECTION">Correction de prix</option>
              <option value="DEFECTIVE_PRODUCT">Produit défectueux</option>
              <option value="OTHER">Autre motif</option>
            </select>
          </div>

          {(searchTerm.trim() !== '' || statusFilter !== 'ALL' || reasonFilter !== 'ALL' || periodFilter.preset !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('ALL');
                setReasonFilter('ALL');
                setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' });
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        {(searchTerm.trim() !== '' || statusFilter !== 'ALL' || reasonFilter !== 'ALL' || periodFilter.preset !== 'ALL') && (
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
            {reasonFilter !== 'ALL' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Motif : {reasonFilter}
                <button
                  type="button"
                  onClick={() => setReasonFilter('ALL')}
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

      {/* Table */}
      <div className="bg-app-surface rounded-2xl border border-app-border shadow-xs overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredCreditNotes}
          isLoading={isLoading}
          keyExtractor={(cn) => cn.id.toString()}
          emptyTitle="Aucun avoir client trouvé."
        />
      </div>

      {/* CREATE MODAL */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title="Émettre un Nouvel Avoir Client"
        maxWidth="4xl"
      >
        <form onSubmit={handleCreateSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Facture Client Concernée" required>
              <select
                value={selectedInvoiceId || ''}
                onChange={(e) => handleSelectInvoice(Number(e.target.value))}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Sélectionnez une facture d'origine...</option>
                {invoices
                  .filter((inv) => inv.status !== 'CANCELLED')
                  .map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.reference} — {inv.customer?.legal_name} (TTC: {formatCurrency(inv.total_ttc)}, Reste:{' '}
                      {formatCurrency(inv.amount_due)})
                    </option>
                  ))}
              </select>
            </FormField>

            <FormField label="Motif de l'Avoir" required>
              <select
                value={creditReason}
                onChange={(e) => setCreditReason(e.target.value as CreditNoteReason)}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-white"
              >
                <option value={CreditNoteReason.RETURN}>Retour de marchandise physique</option>
                <option value={CreditNoteReason.BILLING_ERROR}>Erreur de facturation</option>
                <option value={CreditNoteReason.COMMERCIAL_DISCOUNT}>Geste / Remise commerciale</option>
                <option value={CreditNoteReason.PARTIAL_CANCELLATION}>Annulation partielle</option>
                <option value={CreditNoteReason.PRICE_CORRECTION}>Correction de prix / Erreur tarifaire</option>
                <option value={CreditNoteReason.DEFECTIVE_PRODUCT}>Produit défectueux / cassé</option>
                <option value={CreditNoteReason.OTHER}>Autre motif</option>
              </select>
            </FormField>
          </div>

          {selectedInvoiceId && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                  Articles et Lignes Facturées Éligibles
                </h4>
                <span className="text-xs text-gray-500">
                  Indiquez les quantités à créditer et la réintégration en stock
                </span>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs">
                  <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase">
                    <tr>
                      <th className="p-3">Description</th>
                      <th className="p-3 w-28 text-right">P.U. HT</th>
                      <th className="p-3 w-20 text-center">Max</th>
                      <th className="p-3 w-28">Qté Avoir</th>
                      <th className="p-3 w-40">Réintégrer Stock</th>
                      <th className="p-3 w-44">Dépôt Réception</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {itemsToCredit.map((line, idx) => (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                        <td className="p-3 font-medium text-gray-900 dark:text-white">
                          {line.description}
                        </td>
                        <td className="p-3 text-right font-mono text-gray-600 dark:text-gray-300">
                          {formatCurrency(line.unit_price_ht)}
                        </td>
                        <td className="p-3 text-center text-gray-500 font-bold">{line.max_quantity}</td>
                        <td className="p-3">
                          <input
                            type="number"
                            min="0"
                            max={line.max_quantity}
                            step="0.01"
                            value={line.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setItemsToCredit((prev) =>
                                prev.map((item, i) => (i === idx ? { ...item, quantity: val } : item))
                              );
                            }}
                            className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-right font-mono"
                          />
                        </td>
                        <td className="p-3">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={line.return_to_stock}
                              disabled={!line.product_id}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setItemsToCredit((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, return_to_stock: checked } : item
                                  )
                                );
                              }}
                              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-gray-700 dark:text-gray-300 text-xs">Oui (Stock +)</span>
                          </label>
                        </td>
                        <td className="p-3">
                          {line.return_to_stock && (
                            <select
                              value={line.warehouse_id || ''}
                              onChange={(e) => {
                                const whId = Number(e.target.value) || null;
                                setItemsToCredit((prev) =>
                                  prev.map((item, i) =>
                                    i === idx ? { ...item, warehouse_id: whId } : item
                                  )
                                );
                              }}
                              className="w-full px-2 py-1 border border-gray-200 dark:border-gray-700 rounded-lg text-xs"
                            >
                              {warehouses.map((w) => (
                                <option key={w.id} value={w.id}>
                                  {w.name} ({w.code})
                                </option>
                              ))}
                            </select>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField label="Détail du Motif / Justification">
              <input
                type="text"
                value={reasonDetails}
                onChange={(e) => setReasonDetails(e.target.value)}
                placeholder="Ex: Marchandise endommagée lors du déchargement..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>

            <FormField label="Notes et Mentions Internes">
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Notes de validation..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !selectedInvoiceId}
              className="btn-primary px-5 py-2"
            >
              {isSubmitting ? 'Émission en cours...' : "Émettre et Valider l'Avoir"}
            </button>
          </div>
        </form>
      </Modal>

      {/* PREVIEW MODAL */}
      {selectedCreditNote && (
        <DocumentPreviewModal
          isOpen={isPreviewModalOpen}
          onClose={() => setIsPreviewModalOpen(false)}
          title="Aperçu Avoir Client"
          documentRef={selectedCreditNote.reference}
        >
          <CreditNoteDocument creditNote={selectedCreditNote} />
        </DocumentPreviewModal>
      )}


      {/* CONFIRM CANCEL DIALOG */}
      <ConfirmDialog
        isOpen={cancelDialogOpen}
        title="Annuler l'Avoir Client"
        message={`Êtes-vous sûr de vouloir annuler l'avoir ${cnToCancel?.reference} ? Le solde de la facture sera réajusté et les mouvements de stock seront contre-passés.`}
        confirmLabel="Annuler l'avoir"
        cancelLabel="Retour"
        variant="danger"
        isLoading={isSubmitting}
        onConfirm={handleCancelCreditNote}
        onClose={() => setCancelDialogOpen(false)}
      />
    </div>
  );
};
