import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { customerService } from '@/services/customerService';
import {
  Sale,
  SaleFormData,
  SaleItemFormData,
  SaleStatus,
} from '@/types/sales';
import { BusinessPartner } from '@/types/partner';
import { Product } from '@/types/catalog';
import { StockBalance } from '@/types/stock';
import { Warehouse } from '@/types/warehouse';
import { PAYMENT_METHODS, PAYMENT_TERMS } from '@/constants/purchases';
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
  ShoppingCart,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  AlertTriangle,
  ArrowRight,
  Clock,
  DollarSign,
  Building2,
  Calendar,
  Layers,
  Package,
  Loader2,
  Boxes,
  Warehouse as WarehouseIcon,
  RotateCcw,
  X,
} from 'lucide-react';

export const SalesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  // Data lists
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [lineStock, setLineStock] = useState<
    Record<number, { loading: boolean; available: number | null; loaded: boolean }>
  >({});
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [customerFilter, setCustomerFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodValue>({
    preset: 'ALL',
    label: 'Toutes les dates',
  });

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSale, setEditingSale] = useState<Sale | null>(null);
  const [cancellingSale, setCancellingSale] = useState<Sale | null>(null);
  const [deletingSale, setDeletingSale] = useState<Sale | null>(null);
  const [confirmingSale, setConfirmingSale] = useState<Sale | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Sale Form State
  const initialFormData: SaleFormData = {
    reference: '',
    customer_id: '',
    order_date: new Date().toISOString().split('T')[0],
    payment_terms: '30 jours fin de mois',
    payment_method: 'Virement bancaire',
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

  const [formData, setFormData] = useState<SaleFormData>(initialFormData);

  // RBAC checks
  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('sales.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('sales.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('sales.delete');
  const canConfirm = roleNames.includes('ADMIN') || userPerms.includes('sales.confirm');
  const canCancel = roleNames.includes('ADMIN') || userPerms.includes('sales.cancel');

  // Fetch stock balance for a specific line combination (product_id + warehouse_id)
  const fetchLineStock = useCallback(
    async (index: number, productId: number, warehouseId: number) => {
      // Clear displayed stock immediately and show loading
      setLineStock((prev) => ({
        ...prev,
        [index]: { loading: true, available: null, loaded: false },
      }));
      try {
        const res = await api.get<StockBalance>(
          `/api/v1/stock/balance?product_id=${productId}&warehouse_id=${warehouseId}`
        );
        const avail = res.data ? Number(res.data.available_quantity) || 0 : 0;
        setLineStock((prev) => ({
          ...prev,
          [index]: { loading: false, available: avail, loaded: true },
        }));
      } catch (err) {
        setLineStock((prev) => ({
          ...prev,
          [index]: { loading: false, available: 0, loaded: true },
        }));
      }
    },
    []
  );

  // Load customers, products, and active warehouses
  const loadPrerequisites = useCallback(async () => {
    try {
      const [rawCusts, prodRes, whRes] = await Promise.all([
        customerService.getCustomers({ isActive: true }),
        api.get<Product[]>('/api/v1/products?size=200'),
        api.get<Warehouse[]>('/api/v1/warehouses?is_active=true'),
      ]);

      const rawProds = Array.isArray(prodRes.data)
        ? prodRes.data
        : (prodRes.data as any)?.items || [];
      const rawWhs = Array.isArray(whRes.data)
        ? whRes.data
        : (whRes.data as any)?.items || [];

      const activeCusts = rawCusts.filter((c: BusinessPartner) => c.is_active !== false);
      const activeProds = rawProds.filter((p: Product) => p.is_active !== false);
      const activeWhs = rawWhs.filter((w: Warehouse) => w.is_active !== false);

      setCustomers(activeCusts);
      setProducts(activeProds);
      setWarehouses(activeWhs);
    } catch (err) {
      console.error('Failed loading prerequisites for sales', err);
      showError('Impossible de charger les clients, produits ou dépôts.');
    }
  }, [showError]);

  useEffect(() => {
    loadPrerequisites();
  }, [loadPrerequisites]);

  // Fetch sales list
  const fetchSales = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/sales?size=100';
      if (search.trim()) url += `&search=${encodeURIComponent(search.trim())}`;
      if (customerFilter && customerFilter !== 'all') url += `&customer_id=${customerFilter}`;
      if (statusFilter && statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (periodFilter.dateFrom) url += `&date_from=${periodFilter.dateFrom}`;
      if (periodFilter.dateTo) url += `&date_to=${periodFilter.dateTo}`;

      const res = await api.get<Sale[]>(url);
      const items = Array.isArray(res.data) ? res.data : (res.data as any)?.items || [];
      setSales(items);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Erreur lors du chargement des ventes.');
    } finally {
      setIsLoading(false);
    }
  }, [search, customerFilter, statusFilter, periodFilter, showError]);

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Form helpers
  const handleProductChange = (index: number, productIdStr: string) => {
    const prodId = parseInt(productIdStr, 10);
    const selectedProd = products.find((p) => p.id === prodId);

    // Immediately clear displayed stock for this line
    setLineStock((prev) => ({
      ...prev,
      [index]: { loading: false, available: null, loaded: false },
    }));

    setFormData((prev) => {
      const updated = [...prev.items];
      if (selectedProd) {
        const prevWhId = updated[index]?.warehouse_id;
        updated[index] = {
          ...updated[index],
          product_id: prodId,
          unit_price_ht: Number(selectedProd.sale_price) || 0,
          tax_rate: Number(selectedProd.tax_rate) || 20,
        };
        // Reset warehouse if non-stock product, else re-fetch stock if warehouse was already picked
        if (!selectedProd.track_stock) {
          updated[index].warehouse_id = '';
        } else if (prevWhId) {
          fetchLineStock(index, prodId, Number(prevWhId));
        }
      } else {
        updated[index] = {
          ...updated[index],
          product_id: '',
          warehouse_id: '',
          unit_price_ht: 0,
          tax_rate: 20,
        };
      }
      return { ...prev, items: updated };
    });
  };

  const handleWarehouseChange = (index: number, warehouseIdStr: string) => {
    const whId = warehouseIdStr ? parseInt(warehouseIdStr, 10) : '';

    // Immediately clear displayed stock and show loading if product selected
    setLineStock((prev) => ({
      ...prev,
      [index]: { loading: false, available: null, loaded: false },
    }));

    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        warehouse_id: whId,
      };
      return { ...prev, items: updated };
    });

    const item = formData.items[index];
    const prodId = Number(item?.product_id);
    const prod = products.find((p) => p.id === prodId);

    if (prod && prod.track_stock && whId) {
      fetchLineStock(index, prodId, Number(whId));
    }
  };

  const handleItemChange = (index: number, field: keyof SaleItemFormData, value: any) => {
    setFormData((prev) => {
      const updated = [...prev.items];
      updated[index] = {
        ...updated[index],
        [field]: value,
      };
      return { ...prev, items: updated };
    });
  };

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
      showInfo('Une vente doit comporter au moins une ligne d\'article.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));

    // Re-index line stock
    setLineStock((prev) => {
      const newMap: Record<number, { loading: boolean; available: number | null; loaded: boolean }> = {};
      let targetIdx = 0;
      for (let i = 0; i < formData.items.length; i++) {
        if (i !== index) {
          if (prev[i]) {
            newMap[targetIdx] = prev[i];
          }
          targetIdx++;
        }
      }
      return newMap;
    });
  };

  // Live Totals Calculation in Form
  const formCalculations = useMemo(() => {
    let subtotalHt = 0;
    let totalDiscount = 0;
    let totalTax = 0;
    let hasStockWarning = false;

    const lineCalculations = formData.items.map((item, index) => {
      const qty = Math.max(0, Number(item.quantity) || 0);
      const price = Math.max(0, Number(item.unit_price_ht) || 0);
      const discRate = Math.min(100, Math.max(0, Number(item.discount_rate) || 0));
      const taxRate = Math.max(0, Number(item.tax_rate) || 0);

      const gross = qty * price;
      const discount = gross * (discRate / 100.0);
      const lineSubtotal = gross - discount;
      const lineTax = lineSubtotal * (taxRate / 100.0);
      const lineTotalTtc = lineSubtotal + lineTax;

      subtotalHt += lineSubtotal;
      totalDiscount += discount;
      totalTax += lineTax;

      // Line stock check
      const prod = products.find((p) => p.id === Number(item.product_id));
      const st = lineStock[index];
      const available = prod && prod.track_stock && st?.loaded ? (st.available ?? 0) : null;
      const isInsufficient =
        prod &&
        prod.track_stock &&
        st?.loaded &&
        st.available !== null &&
        qty > (st.available ?? 0);

      if (isInsufficient) {
        hasStockWarning = true;
      }

      return {
        lineSubtotal,
        discount,
        lineTax,
        lineTotalTtc,
        product: prod,
        stockState: st,
        available,
        isInsufficient,
      };
    });

    return {
      subtotalHt,
      totalDiscount,
      totalTax,
      totalTtc: subtotalHt + totalTax,
      lineCalculations,
      hasStockWarning,
    };
  }, [formData.items, products, lineStock]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setFormData(initialFormData);
    setLineStock({});
    setModalError(null);
    setIsCreateOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (sale: Sale) => {
    setEditingSale(sale);
    setFormData({
      reference: sale.reference,
      customer_id: sale.customer_id,
      order_date: sale.order_date ? sale.order_date.split('T')[0] : new Date().toISOString().split('T')[0],
      payment_terms: sale.payment_terms || '30 jours fin de mois',
      payment_method: sale.payment_method || 'Virement bancaire',
      notes: sale.notes || '',
      items: sale.items.map((item) => ({
        product_id: item.product_id,
        warehouse_id: item.warehouse_id || '',
        quantity: item.quantity,
        unit_price_ht: item.unit_price_ht,
        tax_rate: item.tax_rate,
        discount_rate: item.discount_rate,
      })),
    });
    setLineStock({});
    setModalError(null);

    // Fetch stock balance for each tracked line item
    sale.items.forEach((item, idx) => {
      const prod = products.find((p) => p.id === item.product_id);
      if (prod && prod.track_stock && item.warehouse_id) {
        fetchLineStock(idx, item.product_id, item.warehouse_id);
      }
    });
  };

  // Save Sale (Create or Update)
  const handleSaveSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.customer_id) {
      setModalError('Veuillez sélectionner un client.');
      return;
    }

    if (!formData.items || formData.items.length === 0) {
      setModalError('Veuillez ajouter au moins une ligne d\'article.');
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.product_id) {
        setModalError(`Veuillez sélectionner un produit pour la ligne #${i + 1}.`);
        return;
      }
      const prod = products.find((p) => p.id === Number(item.product_id));
      if (prod && prod.track_stock) {
        if (!item.warehouse_id) {
          setModalError(`Veuillez sélectionner le dépôt source pour la ligne #${i + 1} (${prod.designation}).`);
          return;
        }
        const st = lineStock[i];
        if (st?.loaded && st.available !== null && Number(item.quantity) > st.available) {
          setModalError(`Stock insuffisant. Disponible : ${st.available}`);
          return;
        }
      }
      if (Number(item.quantity) <= 0) {
        setModalError(`La quantité pour la ligne #${i + 1} doit être supérieure à 0.`);
        return;
      }
      if (Number(item.unit_price_ht) < 0) {
        setModalError(`Le prix unitaire pour la ligne #${i + 1} ne peut pas être négatif.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        reference: formData.reference.trim() || undefined,
        customer_id: Number(formData.customer_id),
        order_date: formData.order_date ? `${formData.order_date}T10:00:00Z` : undefined,
        payment_terms: formData.payment_terms || undefined,
        payment_method: formData.payment_method || undefined,
        notes: formData.notes.trim() || undefined,
        items: formData.items.map((it) => ({
          product_id: Number(it.product_id),
          warehouse_id: it.warehouse_id ? Number(it.warehouse_id) : undefined,
          quantity: Number(it.quantity),
          unit_price_ht: Number(it.unit_price_ht),
          tax_rate: Number(it.tax_rate),
          discount_rate: Number(it.discount_rate) || 0,
        })),
      };

      if (editingSale) {
        await api.put(`/api/v1/sales/${editingSale.id}`, payload);
        showSuccess(`Vente ${editingSale.reference} modifiée avec succès.`);
        setEditingSale(null);
      } else {
        const res = await api.post<Sale>('/api/v1/sales', payload);
        showSuccess(`Vente ${res.data.reference} créée en brouillon.`);
        setIsCreateOpen(false);
      }
      fetchSales();
      loadPrerequisites();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Erreur lors de l\'enregistrement de la vente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Confirm Sale Action
  const handleConfirmSale = async () => {
    if (!confirmingSale) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/sales/${confirmingSale.id}/confirm`);
      showSuccess(`Vente ${confirmingSale.reference} confirmée et stock mis à jour.`);
      setConfirmingSale(null);
      fetchSales();
      loadPrerequisites();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Erreur lors de la confirmation de la vente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Cancel Sale Action
  const handleCancelSale = async () => {
    if (!cancellingSale) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/sales/${cancellingSale.id}/cancel`);
      showSuccess(`Vente ${cancellingSale.reference} annulée.`);
      setCancellingSale(null);
      fetchSales();
      loadPrerequisites();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Erreur lors de l\'annulation de la vente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Sale Action
  const handleDeleteSale = async () => {
    if (!deletingSale) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/sales/${deletingSale.id}`);
      showSuccess(`Vente ${deletingSale.reference} supprimée avec succès.`);
      setDeletingSale(null);
      fetchSales();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Erreur lors de la suppression de la vente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Status Badge Rendering
  const renderStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3" />
            Brouillon
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Confirmée
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3 h-3" />
            Annulée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  // Table Columns Definition
  const columns: Column<Sale>[] = [
    {
      header: 'Référence',
      accessor: (row: Sale) => (
        <button
          onClick={() => navigate(`/ventes/${row.id}`)}
          className="font-mono font-bold text-pesage-blue hover:underline text-left"
        >
          {row.reference}
        </button>
      ),
    },
    {
      header: 'Client',
      accessor: (row: Sale) => (
        <div>
          <p className="font-semibold text-app-text-primary">{row.customer?.legal_name || `Client #${row.customer_id}`}</p>
          <p className="text-[11px] text-app-text-muted">{row.customer?.code}</p>
        </div>
      ),
    },
    {
      header: 'Date',
      accessor: (row: Sale) => formatDate(row.order_date),
    },
    {
      header: 'Sous-total HT',
      accessor: (row: Sale) => (
        <span className="font-medium">{formatCurrency(row.subtotal_ht)}</span>
      ),
    },
    {
      header: 'Remise',
      accessor: (row: Sale) => (
        <span className="text-app-text-muted">{formatCurrency(row.discount_amount)}</span>
      ),
    },
    {
      header: 'TVA',
      accessor: (row: Sale) => (
        <span className="text-app-text-muted">{formatCurrency(row.tax_amount)}</span>
      ),
    },
    {
      header: 'Total TTC',
      accessor: (row: Sale) => (
        <span className="font-bold text-pesage-blue">{formatCurrency(row.total_ttc)}</span>
      ),
    },
    {
      header: 'Statut',
      accessor: (row: Sale) => renderStatusBadge(row.status),
    },
  ];

  const renderRowActions = (row: Sale) => (
    <div className="flex items-center justify-end gap-1.5">
      <button
        onClick={() => navigate(`/ventes/${row.id}`)}
        className="p-1.5 rounded-lg text-app-text-muted hover:text-pesage-blue hover:bg-pesage-blue/10 transition"
        title="Consulter le détail"
      >
        <Eye className="w-4 h-4" />
      </button>

      {(row.status === 'CONFIRMED' || row.status === 'PARTIALLY_DELIVERED') && (
        <button
          onClick={() => navigate(`/livraisons?sale_id=${row.id}`)}
          className="p-1.5 rounded-lg text-app-text-muted hover:text-pesage-blue hover:bg-pesage-blue/10 transition"
          title="Créer un Bon de Livraison"
        >
          <Package className="w-4 h-4" />
        </button>
      )}

      {(row.status === 'CONFIRMED' || row.status === 'PARTIALLY_DELIVERED' || row.status === 'DELIVERED') && (
        <button
          onClick={() => navigate(`/factures?sale_id=${row.id}`)}
          className="p-1.5 rounded-lg text-app-text-muted hover:text-emerald-600 hover:bg-emerald-500/10 transition"
          title="Facturer"
        >
          <FileText className="w-4 h-4" />
        </button>
      )}

      {row.status === 'DRAFT' && canUpdate && (
        <button
          onClick={() => handleOpenEdit(row)}
          className="p-1.5 rounded-lg text-app-text-muted hover:text-pesage-orange hover:bg-pesage-orange/10 transition"
          title="Modifier"
        >
          <Edit2 className="w-4 h-4" />
        </button>
      )}

      {row.status === 'DRAFT' && canConfirm && (
        <button
          onClick={() => setConfirmingSale(row)}
          className="p-1.5 rounded-lg text-app-text-muted hover:text-emerald-600 hover:bg-emerald-500/10 transition"
          title="Confirmer la vente"
        >
          <CheckCircle2 className="w-4 h-4" />
        </button>
      )}

      {row.status === 'DRAFT' && canCancel && (
        <button
          onClick={() => setCancellingSale(row)}
          className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-600 hover:bg-rose-500/10 transition"
          title="Annuler"
        >
          <XCircle className="w-4 h-4" />
        </button>
      )}

      {(row.status === 'DRAFT' || row.status === 'CANCELLED') && canDelete && (
        <button
          onClick={() => setDeletingSale(row)}
          className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-600 hover:bg-rose-500/10 transition"
          title="Supprimer"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Gestion des ventes"
        description="Créez, suivez et confirmez les commandes et transactions de vente avec contrôle en temps réel des stocks."
        action={
          canCreate
            ? {
                label: 'Nouvelle vente',
                onClick: handleOpenCreate,
                icon: Plus,
              }
            : undefined
        }
      />

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-app-text-muted">Total Ventes</span>
            <p className="text-xl font-bold text-app-text-primary mt-0.5">{sales.length}</p>
          </div>
          <div className="p-2.5 rounded-xl bg-pesage-blue/10 text-pesage-blue">
            <ShoppingCart className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-app-text-muted">Ventes Confirmées</span>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">
              {sales.filter((s) => s.status === 'CONFIRMED').length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-app-text-muted">Ventes Brouillon</span>
            <p className="text-xl font-bold text-amber-600 mt-0.5">
              {sales.filter((s) => s.status === 'DRAFT').length}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs text-app-text-muted">Chiffre d'Affaires (TTC)</span>
            <p className="text-xl font-bold text-pesage-blue mt-0.5">
              {formatCurrency(
                sales
                  .filter((s) => s.status !== 'CANCELLED')
                  .reduce((acc, curr) => acc + Number(curr.total_ttc || 0), 0)
              )}
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-pesage-orange/10 text-pesage-orange">
            <DollarSign className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="w-64">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Rechercher réf, client..."
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
              <option value="all">Tous les clients</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.legal_name}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="all">Tous les statuts</option>
              <option value="DRAFT">Brouillon</option>
              <option value="CONFIRMED">Confirmée</option>
              <option value="CANCELLED">Annulée</option>
            </select>
          </div>

          {(search.trim() !== '' || customerFilter !== 'all' || statusFilter !== 'all' || periodFilter.preset !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => {
                setSearch('');
                setCustomerFilter('all');
                setStatusFilter('all');
                setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' });
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        {(search.trim() !== '' || customerFilter !== 'all' || statusFilter !== 'all' || periodFilter.preset !== 'ALL') && (
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
            {customerFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Client : {customers.find((c) => String(c.id) === customerFilter)?.legal_name || customerFilter}
                <button
                  type="button"
                  onClick={() => setCustomerFilter('all')}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {statusFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Statut : {statusFilter}
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
            {search.trim() !== '' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Recherche : "{search}"
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main Data Table */}
      <DataTable<Sale>
        columns={columns}
        data={sales}
        keyExtractor={(item) => item.id}
        isLoading={isLoading}
        emptyTitle="Aucune vente enregistrée"
        emptyDescription="Cliquez sur 'Nouvelle vente' pour créer une commande client."
        actions={renderRowActions}
      />

      {/* ========================================================================= */}
      {/* MODAL: NOUVELLE VENTE / MODIFIER VENTE                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateOpen || editingSale !== null}
        onClose={() => {
          setIsCreateOpen(false);
          setEditingSale(null);
        }}
        title={editingSale ? `Modifier la vente ${editingSale.reference}` : 'Nouvelle vente client'}
        maxWidth="4xl"
      >
        <form onSubmit={handleSaveSale} className="space-y-5">
          {modalError && (
            <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 text-xs font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Header Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 bg-gray-50/50 dark:bg-gray-800/30 p-4 rounded-xl border border-app-border">
            <FormField label="Client" required>
              <select
                value={formData.customer_id}
                onChange={(e) => setFormData({ ...formData, customer_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue"
                required
              >
                <option value="">
                  {customers.length === 0 ? 'Aucun client disponible' : 'Sélectionner un client...'}
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.legal_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date de vente" required>
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue"
                required
              />
            </FormField>

            <FormField label="Référence (Optionnelle)">
              <input
                type="text"
                value={formData.reference}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Ex: VTE-202609-0001 (auto si vide)"
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue font-mono"
              />
            </FormField>

            <FormField label="Mode de paiement">
              <select
                value={formData.payment_method}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.label}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Conditions de paiement">
              <select
                value={formData.payment_terms}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue"
              >
                {PAYMENT_TERMS.map((pt) => (
                  <option key={pt.value} value={pt.label}>
                    {pt.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Notes & Observations">
              <input
                type="text"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Instructions particulières..."
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue"
              />
            </FormField>
          </div>

          {/* Line Items Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Package className="w-4 h-4 text-pesage-blue" />
                Lignes d'articles ({formData.items.length})
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-pesage-blue/10 text-pesage-blue text-xs font-semibold hover:bg-pesage-blue/20 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Ajouter une ligne</span>
              </button>
            </div>

            <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
              {formData.items.map((item, index) => {
                const lineCalc = formCalculations.lineCalculations[index];
                return (
                  <div
                    key={index}
                    className="p-3.5 rounded-xl bg-app-surface border border-app-border space-y-3 relative hover:border-slate-300 dark:hover:border-slate-700 transition"
                  >
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-start">
                      {/* Product Selector (sm:col-span-3) */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-app-text-muted mb-1">
                          Produit #{index + 1} *
                        </label>
                        <select
                          value={item.product_id}
                          onChange={(e) => handleProductChange(index, e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue"
                          required
                        >
                          <option value="">Sélectionner un produit...</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.sku} — {p.designation}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Source Warehouse Selector (sm:col-span-3) */}
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-medium text-app-text-muted mb-1">
                          Dépôt source {lineCalc?.product?.track_stock ? '*' : ''}
                        </label>
                        <select
                          value={item.warehouse_id || ''}
                          onChange={(e) => handleWarehouseChange(index, e.target.value)}
                          disabled={!lineCalc?.product?.track_stock}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-800"
                          required={lineCalc?.product?.track_stock}
                        >
                          <option value="">
                            {lineCalc?.product?.track_stock
                              ? 'Sélectionner un dépôt...'
                              : 'Non applicable (hors stock)'}
                          </option>
                          {warehouses.map((w) => (
                            <option key={w.id} value={w.id}>
                              {w.code} — {w.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Quantity (sm:col-span-1) */}
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-medium text-app-text-muted mb-1">
                          Qté *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0.01"
                          value={item.quantity}
                          onChange={(e) => handleItemChange(index, 'quantity', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue text-right"
                          required
                        />
                      </div>

                      {/* Unit Price HT (sm:col-span-2) */}
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-medium text-app-text-muted mb-1">
                          Prix Unit. HT *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.unit_price_ht}
                          onChange={(e) => handleItemChange(index, 'unit_price_ht', e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-app-text-primary focus:outline-hidden focus:ring-2 focus:ring-pesage-blue text-right"
                          required
                        />
                      </div>

                      {/* Remise % (sm:col-span-1) */}
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-medium text-app-text-muted mb-1">
                          Remise %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={item.discount_rate}
                          onChange={(e) => handleItemChange(index, 'discount_rate', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-app-text-primary text-right"
                        />
                      </div>

                      {/* TVA % (sm:col-span-1) */}
                      <div className="sm:col-span-1">
                        <label className="block text-[11px] font-medium text-app-text-muted mb-1">
                          TVA %
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={item.tax_rate}
                          onChange={(e) => handleItemChange(index, 'tax_rate', e.target.value)}
                          className="w-full px-2 py-1.5 rounded-lg bg-app-surface border border-app-border text-xs text-app-text-primary text-right"
                        />
                      </div>

                      {/* Delete Line (sm:col-span-1) */}
                      <div className="sm:col-span-1 flex items-center justify-end pt-5">
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(index)}
                          className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-500/10 transition"
                          title="Supprimer la ligne"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* Stock Status Badge for Line */}
                    <div className="flex items-center gap-2">
                      {lineCalc?.product ? (
                        !lineCalc.product.track_stock ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400">
                            Produit hors stock
                          </span>
                        ) : !item.warehouse_id ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-amber-600 dark:text-amber-400 font-medium px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" />
                            Sélectionner un dépôt source
                          </span>
                        ) : lineStock[index]?.loading ? (
                          <span className="inline-flex items-center gap-1 text-[10px] text-pesage-blue font-semibold px-2 py-0.5 rounded-md bg-pesage-blue/10">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            Chargement...
                          </span>
                        ) : lineStock[index]?.loaded ? (
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                              lineCalc.isInsufficient
                                ? 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
                                : 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                            }`}
                          >
                            {lineCalc.isInsufficient ? (
                              <AlertTriangle className="w-3 h-3" />
                            ) : (
                              <Boxes className="w-3 h-3" />
                            )}
                            {lineCalc.isInsufficient
                              ? `Stock insuffisant. Disponible : ${lineStock[index]?.available ?? 0}`
                              : `Stock disponible : ${lineStock[index]?.available ?? 0} ${lineCalc.product.unit?.abbreviation || 'unités'}`}
                          </span>
                        ) : null
                      ) : null}
                    </div>

                    {/* Calculated Line Totals Summary */}
                    {lineCalc && (
                      <div className="pt-2 border-t border-dashed border-app-border flex items-center justify-between text-[11px] text-app-text-muted">
                        <span>
                          Sous-total HT : <strong className="text-app-text-primary">{formatCurrency(lineCalc.lineSubtotal)}</strong>
                          {lineCalc.discount > 0 && <span className="ml-1 text-emerald-600">(-{formatCurrency(lineCalc.discount)})</span>}
                        </span>
                        <span>
                          TVA : <strong>{formatCurrency(lineCalc.lineTax)}</strong>
                        </span>
                        <span>
                          Total TTC : <strong className="text-pesage-blue">{formatCurrency(lineCalc.lineTotalTtc)}</strong>
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Grand Totals Summary Box */}
          <div className="p-4 rounded-xl bg-pesage-blue/5 border border-pesage-blue/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-app-text-muted">
              {formCalculations.hasStockWarning && (
                <span className="text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  Attention : Certains articles dépassent le stock actuellement disponible.
                </span>
              )}
            </div>
            <div className="flex items-center gap-6 text-xs text-right">
              <div>
                <span className="text-app-text-muted block text-[11px]">Sous-total HT</span>
                <span className="font-bold text-app-text-primary">{formatCurrency(formCalculations.subtotalHt)}</span>
              </div>
              {formCalculations.totalDiscount > 0 && (
                <div>
                  <span className="text-app-text-muted block text-[11px]">Remises</span>
                  <span className="font-bold text-emerald-600">-{formatCurrency(formCalculations.totalDiscount)}</span>
                </div>
              )}
              <div>
                <span className="text-app-text-muted block text-[11px]">TVA</span>
                <span className="font-bold text-app-text-primary">{formatCurrency(formCalculations.totalTax)}</span>
              </div>
              <div>
                <span className="text-app-text-muted block text-[11px]">Total TTC</span>
                <span className="font-bold text-base text-pesage-blue">{formatCurrency(formCalculations.totalTtc)}</span>
              </div>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsCreateOpen(false);
                setEditingSale(null);
              }}
              className="btn-secondary text-xs px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-5 py-2 inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{editingSale ? 'Enregistrer les modifications' : 'Créer la vente (Brouillon)'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={confirmingSale !== null}
        onClose={() => setConfirmingSale(null)}
        onConfirm={handleConfirmSale}
        title="Confirmer la vente"
        message={`Êtes-vous sûr de vouloir confirmer la vente ${confirmingSale?.reference} ? Cette action validera la transaction et déduira immédiatement les articles du stock disponible.`}
        confirmLabel="Confirmer la vente"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={cancellingSale !== null}
        onClose={() => setCancellingSale(null)}
        onConfirm={handleCancelSale}
        title="Annuler la vente"
        message={`Êtes-vous sûr de vouloir annuler la vente ${cancellingSale?.reference} ?`}
        confirmLabel="Annuler la vente"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={deletingSale !== null}
        onClose={() => setDeletingSale(null)}
        onConfirm={handleDeleteSale}
        title="Supprimer la vente"
        message={`Êtes-vous sûr de vouloir supprimer définitivement la vente ${deletingSale?.reference} ?`}
        confirmLabel="Supprimer"
        isLoading={isSubmitting}
      />
    </div>
  );
};
