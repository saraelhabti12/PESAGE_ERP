import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { customerService } from '@/services/customerService';
import {
  PurchaseOrder,
  PurchaseOrderFormData,
  PurchaseOrderItemFormData,
  PurchaseOrderStatus,
  ReceiptFormData,
} from '@/types/purchase';
import { BusinessPartner } from '@/types/partner';
import { Product } from '@/types/catalog';
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
import {
  ShoppingBag,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  PackageCheck,
  Eye,
  FileText,
  AlertTriangle,
  ArrowRight,
  Clock,
  Coins,
  Truck,
  Building2,
  Calendar,
  Layers,
  ChevronRight,
  Package,
  Loader2,
  Warehouse as WarehouseIcon,
  RotateCcw,
  X,
} from 'lucide-react';

export const PurchasesPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError, showInfo } = useNotification();

  // Data lists
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<BusinessPartner[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingPrereqs, setIsLoadingPrereqs] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodValue>({
    preset: 'ALL',
    label: 'Toutes les dates',
  });

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [viewingOrder, setViewingOrder] = useState<PurchaseOrder | null>(null);
  const [receiptingOrder, setReceiptingOrder] = useState<PurchaseOrder | null>(null);
  const [cancellingOrder, setCancellingOrder] = useState<PurchaseOrder | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<PurchaseOrder | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Order Form State
  const [formData, setFormData] = useState<PurchaseOrderFormData>({
    reference: '',
    supplier_id: '',
    order_date: new Date().toISOString().split('T')[0],
    expected_date: '',
    payment_terms: '30 jours fin de mois',
    payment_method: 'bank_transfer',
    notes: '',
    items: [
      {
        product_id: '',
        quantity_ordered: 1,
        unit_price_ht: 0,
        tax_rate: 20,
        discount_rate: 0,
      },
    ],
  });

  // Receipt Form State
  const [receiptForm, setReceiptForm] = useState<ReceiptFormData>({
    reference: '',
    purchase_order_id: 0,
    warehouse_id: '',
    receipt_date: new Date().toISOString().split('T')[0],
    notes: '',
    items: [],
  });

  // RBAC checks
  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('purchases.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('purchases.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('purchases.delete');
  const canApprove = roleNames.includes('ADMIN') || userPerms.includes('purchases.approve');
  const canReceive = roleNames.includes('ADMIN') || userPerms.includes('purchase_receipts.create');

  // Load initial suppliers, products & active warehouses for forms
  const loadPrerequisites = useCallback(async () => {
    setIsLoadingPrereqs(true);
    try {
      const [rawSupps, prodRes, whRes] = await Promise.all([
        customerService.getSuppliers({ isActive: true }),
        api.get<Product[]>('/api/v1/products?size=100'),
        api.get<Warehouse[]>('/api/v1/warehouses?is_active=true'),
      ]);
      const rawProds = Array.isArray(prodRes.data) ? prodRes.data : (prodRes.data as any)?.items || [];
      const rawWhs = Array.isArray(whRes.data) ? whRes.data : (whRes.data as any)?.items || [];

      const activeSupps = rawSupps.filter((s: BusinessPartner) => s.is_active !== false);
      const activeProds = rawProds.filter((p: Product) => p.is_active !== false);
      const activeWhs = rawWhs.filter((w: Warehouse) => w.is_active !== false);

      setSuppliers(activeSupps);
      setProducts(activeProds);
      setWarehouses(activeWhs);
    } catch (err) {
      console.error('Failed loading suppliers, products or warehouses', err);
      showError('Impossible de charger la liste des fournisseurs, produits et dépôts.');
    } finally {
      setIsLoadingPrereqs(false);
    }
  }, [showError]);

  useEffect(() => {
    loadPrerequisites();
  }, [loadPrerequisites]);

  // Fetch purchases list
  const fetchPurchases = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/purchases?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (supplierFilter !== 'all') url += `&supplier_id=${supplierFilter}`;
      if (statusFilter !== 'all') url += `&status=${statusFilter}`;
      if (periodFilter.dateFrom) url += `&date_from=${periodFilter.dateFrom}`;
      if (periodFilter.dateTo) url += `&date_to=${periodFilter.dateTo}`;

      const res = await api.get<PurchaseOrder[]>(url);
      setPurchases(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger les commandes d\'achat.');
    } finally {
      setIsLoading(false);
    }
  }, [search, supplierFilter, statusFilter, periodFilter, showError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPurchases();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchPurchases]);

  // Fetch full details of single purchase order
  const fetchOrderDetail = async (id: number) => {
    try {
      const res = await api.get<PurchaseOrder>(`/api/v1/purchases/${id}`);
      return res.data;
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Erreur lors du chargement des détails.');
      return null;
    }
  };

  // KPIs
  const stats = useMemo(() => {
    const totalCount = purchases.length;
    const pendingApproval = purchases.filter((p) => p.status === 'DRAFT' || p.status === 'PENDING').length;
    const inReceipt = purchases.filter((p) => p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED').length;
    const totalAmount = purchases.reduce((sum, p) => sum + (Number(p.total_ttc) || 0), 0);
    return { totalCount, pendingApproval, inReceipt, totalAmount };
  }, [purchases]);

  // Format Helpers
  const formatCurrency = (val: number | string | undefined | null) => {
    const num = Number(val) || 0;
    return `${num.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} DH`;
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('fr-MA', {
        year: 'numeric',
        month: 'short',
        day: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  // Status Badge Helper
  const renderStatusBadge = (status: PurchaseOrderStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-700">
            <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
            Brouillon
          </span>
        );
      case 'PENDING':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
            <Clock className="w-3 h-3 text-amber-500" />
            En attente
          </span>
        );
      case 'APPROVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <CheckCircle2 className="w-3 h-3 text-blue-500" />
            Approuvée
          </span>
        );
      case 'PARTIALLY_RECEIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border border-orange-200 dark:border-orange-800">
            <Truck className="w-3 h-3 text-orange-500 animate-pulse" />
            Partiellement reçue
          </span>
        );
      case 'RECEIVED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <PackageCheck className="w-3 h-3 text-emerald-500" />
            Reçue
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            <XCircle className="w-3 h-3 text-rose-500" />
            Annulée
          </span>
        );
      default:
        return <span>{status}</span>;
    }
  };

  // ----------------------------------------------------
  // Form Line Items Calculations
  // ----------------------------------------------------
  const calculateFormLineTotals = (line: PurchaseOrderItemFormData) => {
    const qty = Number(line.quantity_ordered) || 0;
    const price = Number(line.unit_price_ht) || 0;
    const taxRate = Number(line.tax_rate) || 0;
    const discountRate = Number(line.discount_rate) || 0;

    const gross = qty * price;
    const discount = gross * (discountRate / 100);
    const subtotal = gross - discount;
    const tax = subtotal * (taxRate / 100);
    const totalTtc = subtotal + tax;

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      totalTtc: Math.round(totalTtc * 100) / 100,
    };
  };

  const formTotals = useMemo(() => {
    let subtotal = 0;
    let tax = 0;
    let totalTtc = 0;

    formData.items.forEach((item) => {
      const line = calculateFormLineTotals(item);
      subtotal += line.subtotal;
      tax += line.tax;
      totalTtc += line.totalTtc;
    });

    return {
      subtotal: Math.round(subtotal * 100) / 100,
      tax: Math.round(tax * 100) / 100,
      totalTtc: Math.round(totalTtc * 100) / 100,
    };
  }, [formData.items]);

  const handleProductChange = (index: number, value: string | number) => {
    const productId = value ? Number(value) : '';
    const selectedProd = products.find((p) => p.id === productId);
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        product_id: productId,
        unit_price_ht: selectedProd
          ? (Number(selectedProd.purchase_price) >= 0 ? Number(selectedProd.purchase_price) : 0)
          : newItems[index].unit_price_ht,
        tax_rate: selectedProd
          ? (selectedProd.tax_rate !== undefined && selectedProd.tax_rate !== null ? Number(selectedProd.tax_rate) : 20)
          : newItems[index].tax_rate,
      };
      return { ...prev, items: newItems };
    });
  };

  const handleLineFieldChange = (
    index: number,
    field: keyof PurchaseOrderItemFormData,
    value: any
  ) => {
    setFormData((prev) => {
      const newItems = [...prev.items];
      newItems[index] = {
        ...newItems[index],
        [field]: value,
      };
      return { ...prev, items: newItems };
    });
  };

  const addLine = () => {
    setFormData((prev) => ({
      ...prev,
      items: [
        ...prev.items,
        {
          product_id: '',
          quantity_ordered: 1,
          unit_price_ht: 0,
          tax_rate: 20,
          discount_rate: 0,
        },
      ],
    }));
  };

  const removeLine = (index: number) => {
    if (formData.items.length <= 1) {
      showError('La commande doit comporter au moins une ligne de produit.');
      return;
    }
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  // ----------------------------------------------------
  // Handlers
  // ----------------------------------------------------
  const handleOpenCreate = () => {
    setModalError(null);
    setEditingOrder(null);
    if (suppliers.length === 0 || products.length === 0) {
      loadPrerequisites();
    }
    setFormData({
      reference: '',
      supplier_id: '',
      order_date: new Date().toISOString().split('T')[0],
      expected_date: '',
      payment_terms: '30 jours fin de mois',
      payment_method: 'bank_transfer',
      notes: '',
      items: [
        {
          product_id: '',
          quantity_ordered: 1,
          unit_price_ht: 0,
          tax_rate: 20,
          discount_rate: 0,
        },
      ],
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = async (order: PurchaseOrder) => {
    setModalError(null);
    const detail = await fetchOrderDetail(order.id);
    if (!detail) return;

    setEditingOrder(detail);
    setFormData({
      reference: detail.reference,
      supplier_id: detail.supplier_id,
      order_date: detail.order_date ? detail.order_date.split('T')[0] : '',
      expected_date: detail.expected_date ? detail.expected_date.split('T')[0] : '',
      payment_terms: detail.payment_terms || '',
      payment_method: detail.payment_method || '',
      notes: detail.notes || '',
      items: (detail.items || []).map((i) => ({
        product_id: i.product_id,
        quantity_ordered: Number(i.quantity_ordered),
        unit_price_ht: Number(i.unit_price_ht),
        tax_rate: Number(i.tax_rate),
        discount_rate: Number(i.discount_rate),
      })),
    });
    setIsCreateOpen(true);
  };

  const handleOpenView = async (order: PurchaseOrder) => {
    const detail = await fetchOrderDetail(order.id);
    if (detail) {
      setViewingOrder(detail);
    }
  };

  const handleOpenReceipt = async (order: PurchaseOrder) => {
    if (warehouses.length === 0) {
      await loadPrerequisites();
    }
    const detail = await fetchOrderDetail(order.id);
    if (!detail) return;

    const receiptableItems = (detail.items || [])
      .filter((item) => Number(item.quantity_remaining) > 0)
      .map((item) => ({
        purchase_order_item_id: item.id,
        product_id: item.product_id,
        quantity_received: Number(item.quantity_remaining), // default to full remaining
        notes: '',
      }));

    if (receiptableItems.length === 0) {
      showError('Tous les articles de cette commande ont déjà été intégralement réceptionnés.');
      return;
    }

    setReceiptForm({
      reference: '',
      purchase_order_id: detail.id,
      warehouse_id: '',
      receipt_date: new Date().toISOString().split('T')[0],
      notes: '',
      items: receiptableItems,
    });
    setReceiptingOrder(detail);
  };

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (!formData.supplier_id) {
      setModalError('Aucun fournisseur sélectionné. Veuillez sélectionner un fournisseur.');
      return;
    }

    if (formData.items.length === 0) {
      setModalError('Veuillez ajouter au moins un produit.');
      return;
    }

    for (let i = 0; i < formData.items.length; i++) {
      const item = formData.items[i];
      if (!item.product_id) {
        setModalError(`Veuillez sélectionner un produit pour la ligne ${i + 1}.`);
        return;
      }
      if (Number(item.quantity_ordered) <= 0) {
        setModalError(`Quantité invalide. La quantité doit être supérieure à 0 (ligne ${i + 1}).`);
        return;
      }
      if (Number(item.unit_price_ht) < 0) {
        setModalError(`Le prix unitaire HT ne peut pas être négatif (ligne ${i + 1}).`);
        return;
      }
      if (Number(item.tax_rate) < 0) {
        setModalError(`Le taux de TVA ne peut pas être négatif (ligne ${i + 1}).`);
        return;
      }
      if (Number(item.discount_rate) < 0 || Number(item.discount_rate) > 100) {
        setModalError(`La remise doit être comprise entre 0 et 100% (ligne ${i + 1}).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        reference: formData.reference?.trim() || undefined,
        supplier_id: Number(formData.supplier_id),
        order_date: formData.order_date ? new Date(formData.order_date).toISOString() : undefined,
        expected_date: formData.expected_date ? new Date(formData.expected_date).toISOString() : undefined,
        payment_terms: formData.payment_terms || null,
        payment_method: formData.payment_method || null,
        notes: formData.notes || null,
        items: formData.items.map((it) => ({
          product_id: Number(it.product_id),
          quantity_ordered: Number(it.quantity_ordered),
          unit_price_ht: Number(it.unit_price_ht) >= 0 ? Number(it.unit_price_ht) : 0,
          tax_rate: Number(it.tax_rate) >= 0 ? Number(it.tax_rate) : 20,
          discount_rate: Number(it.discount_rate) >= 0 ? Number(it.discount_rate) : 0,
        })),
      };

      if (editingOrder) {
        const res = await api.put<PurchaseOrder>(`/api/v1/purchases/${editingOrder.id}`, payload);
        showSuccess(`Commande d'achat ${res.data.reference} mise à jour avec succès.`);
      } else {
        const res = await api.post<PurchaseOrder>('/api/v1/purchases', payload);
        showSuccess(`Commande d'achat ${res.data.reference} créée avec succès.`);
      }


      setIsCreateOpen(false);
      fetchPurchases();
    } catch (err: any) {
      const detail = err.response?.data?.error?.message || err.response?.data?.detail;
      let errorMsg = 'Impossible d\'enregistrer la commande.';
      if (typeof detail === 'string') {
        errorMsg = detail;
      } else if (Array.isArray(detail)) {
        errorMsg = detail.map((d: any) => `${d.loc?.slice(-1)[0] || 'Champ'}: ${d.msg}`).join(', ');
      }
      setModalError(errorMsg);
      showError(errorMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleApproveOrder = async (orderId: number) => {
    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/purchases/${orderId}/approve`);
      showSuccess('Commande d\'achat approuvée avec succès.');
      fetchPurchases();
      if (viewingOrder && viewingOrder.id === orderId) {
        const updated = await fetchOrderDetail(orderId);
        if (updated) setViewingOrder(updated);
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible d\'approuver la commande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancellingOrder) return;
    setIsSubmitting(true);
    try {
      await api.post(`/api/v1/purchases/${cancellingOrder.id}/cancel`);
      showSuccess('Commande d\'achat annulée avec succès.');
      setCancellingOrder(null);
      fetchPurchases();
      if (viewingOrder && viewingOrder.id === cancellingOrder.id) {
        const updated = await fetchOrderDetail(cancellingOrder.id);
        if (updated) setViewingOrder(updated);
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible d\'annuler la commande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteOrder = async () => {
    if (!deletingOrder) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/purchases/${deletingOrder.id}`);
      showSuccess('Commande supprimée avec succès.');
      setDeletingOrder(null);
      fetchPurchases();
      if (viewingOrder && viewingOrder.id === deletingOrder.id) {
        setViewingOrder(null);
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de supprimer la commande.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveReceipt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiptingOrder) return;

    // Filter items with qty > 0
    const validItems = receiptForm.items.filter((i) => Number(i.quantity_received) > 0);
    if (validItems.length === 0) {
      showError('Veuillez saisir une quantité à réceptionner supérieure à 0 pour au moins un produit.');
      return;
    }

    // Validate warehouse selection if any item is tracked
    const hasTrackedProducts = validItems.some((it) => {
      const orderItem = receiptingOrder.items?.find((o) => o.id === it.purchase_order_item_id);
      return orderItem?.product?.track_stock !== false;
    });

    if (hasTrackedProducts && !receiptForm.warehouse_id) {
      showError('Veuillez sélectionner le dépôt de réception.');
      return;
    }

    // Validate no line exceeds remaining
    for (const line of receiptForm.items) {
      const orderItem = receiptingOrder.items?.find((it) => it.id === line.purchase_order_item_id);
      if (orderItem) {
        const qtyReceived = Number(line.quantity_received) || 0;
        const remaining = Number(orderItem.quantity_remaining) || 0;
        if (qtyReceived > remaining) {
          showError(
            `La quantité reçue pour '${orderItem.product?.designation || 'produit'}' (${qtyReceived}) dépasse le reste à recevoir (${remaining}).`
          );
          return;
        }
      }
    }

    setIsSubmitting(true);
    try {
      const payload = {
        reference: receiptForm.reference?.trim() || undefined,
        purchase_order_id: receiptingOrder.id,
        warehouse_id: receiptForm.warehouse_id ? Number(receiptForm.warehouse_id) : undefined,
        receipt_date: receiptForm.receipt_date ? new Date(receiptForm.receipt_date).toISOString() : undefined,
        notes: receiptForm.notes || null,
        items: validItems.map((v) => ({
          purchase_order_item_id: v.purchase_order_item_id,
          product_id: v.product_id,
          quantity_received: Number(v.quantity_received),
          warehouse_id: receiptForm.warehouse_id ? Number(receiptForm.warehouse_id) : undefined,
          notes: v.notes || null,
        })),
      };

      await api.post('/api/v1/purchase-receipts', payload);
      showSuccess('Bon de réception enregistré et quantités mises à jour avec succès.');
      setReceiptingOrder(null);
      fetchPurchases();
      if (viewingOrder && viewingOrder.id === receiptingOrder.id) {
        const updated = await fetchOrderDetail(receiptingOrder.id);
        if (updated) setViewingOrder(updated);
      }
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Erreur lors de la création du bon de réception.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // Table Columns
  // ----------------------------------------------------
  const columns: Column<PurchaseOrder>[] = [
    {
      header: 'Référence',
      accessor: (p) => (
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-pesage-blue dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-1 rounded text-xs border border-blue-200 dark:border-blue-800">
            {p.reference}
          </span>
        </div>
      ),
      align: 'left',
    },
    {
      header: 'Fournisseur',
      accessor: (p) => (
        <div>
          <div className="font-semibold text-app-text-primary flex items-center gap-1.5">
            <Building2 className="w-3.5 h-3.5 text-pesage-orange" />
            {p.supplier?.legal_name || 'Fournisseur inconnu'}
          </div>
          {p.supplier?.code && (
            <div className="text-xs text-app-text-muted font-mono">{p.supplier.code}</div>
          )}
        </div>
      ),
    },
    {
      header: 'Date commande',
      accessor: (p) => (
        <span className="text-xs text-app-text-secondary whitespace-nowrap">
          {formatDate(p.order_date)}
        </span>
      ),
    },
    {
      header: 'Date prévue',
      accessor: (p) => (
        <span className="text-xs text-app-text-muted whitespace-nowrap">
          {p.expected_date ? formatDate(p.expected_date) : 'Non spécifiée'}
        </span>
      ),
    },
    {
      header: 'Sous-total HT',
      accessor: (p) => (
        <span className="text-xs font-mono text-app-text-secondary whitespace-nowrap">
          {formatCurrency(p.subtotal_ht)}
        </span>
      ),
    },
    {
      header: 'TVA',
      accessor: (p) => (
        <span className="text-xs font-mono text-app-text-muted whitespace-nowrap">
          {formatCurrency(p.tax_amount)}
        </span>
      ),
    },
    {
      header: 'Total TTC',
      accessor: (p) => (
        <span className="text-sm font-mono font-bold text-pesage-blue dark:text-pesage-orange whitespace-nowrap">
          {formatCurrency(p.total_ttc)}
        </span>
      ),
    },
    {
      header: 'Statut',
      accessor: (p) => renderStatusBadge(p.status),
    },
    {
      header: 'Actions',
      accessor: (p) => (
        <div className="flex items-center justify-end gap-1.5">
          {/* Consulter */}
          <button
            onClick={() => handleOpenView(p)}
            className="p-1.5 text-app-text-secondary hover:text-pesage-blue hover:bg-blue-50 dark:hover:bg-blue-950/50 rounded-lg transition"
            title="Consulter les détails"
          >
            <Eye className="w-4 h-4" />
          </button>

          {/* Modifier (si DRAFT ou PENDING) */}
          {(p.status === 'DRAFT' || p.status === 'PENDING') && canUpdate && (
            <button
              onClick={() => handleOpenEdit(p)}
              className="p-1.5 text-app-text-secondary hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/50 rounded-lg transition"
              title="Modifier la commande"
            >
              <Edit2 className="w-4 h-4" />
            </button>
          )}

          {/* Approuver (si DRAFT ou PENDING) */}
          {(p.status === 'DRAFT' || p.status === 'PENDING') && canApprove && (
            <button
              onClick={() => handleApproveOrder(p.id)}
              className="p-1.5 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 rounded-lg transition"
              title="Approuver la commande"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}

          {/* Réceptionner (si APPROVED ou PARTIALLY_RECEIVED) */}
          {(p.status === 'APPROVED' || p.status === 'PARTIALLY_RECEIVED') && canReceive && (
            <button
              onClick={() => handleOpenReceipt(p)}
              className="p-1.5 text-pesage-orange hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/50 rounded-lg transition"
              title="Réceptionner des articles"
            >
              <Truck className="w-4 h-4" />
            </button>
          )}

          {/* Annuler (si DRAFT, PENDING ou APPROVED) */}
          {(p.status === 'DRAFT' || p.status === 'PENDING' || p.status === 'APPROVED') && canUpdate && (
            <button
              onClick={() => setCancellingOrder(p)}
              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
              title="Annuler la commande"
            >
              <XCircle className="w-4 h-4" />
            </button>
          )}

          {/* Supprimer (si DRAFT ou CANCELLED) */}
          {(p.status === 'DRAFT' || p.status === 'CANCELLED') && canDelete && (
            <button
              onClick={() => setDeletingOrder(p)}
              className="p-1.5 text-app-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 rounded-lg transition"
              title="Supprimer la commande"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      ),
      align: 'right',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <PageHeader
        title="Gestion des achats"
        subtitle="Suivi du cycle d'achat : commandes fournisseurs, réceptions de marchandises et reliquats"
        icon={ShoppingBag}
        action={
          canCreate
            ? {
                label: 'Nouvelle commande',
                onClick: handleOpenCreate,
                icon: Plus,
              }
            : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">
                Total Commandes
              </p>
              <h3 className="text-2xl font-bold text-app-text-primary mt-1">
                {stats.totalCount}
              </h3>
            </div>
            <div className="p-3 bg-blue-50 dark:bg-blue-950/60 text-pesage-blue dark:text-blue-400 rounded-xl">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">
                À Valider / Approuver
              </p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                {stats.pendingApproval}
              </h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/60 text-amber-600 rounded-xl">
              <Clock className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">
                En Réception
              </p>
              <h3 className="text-2xl font-bold text-pesage-orange mt-1">
                {stats.inReceipt}
              </h3>
            </div>
            <div className="p-3 bg-orange-50 dark:bg-orange-950/60 text-pesage-orange rounded-xl">
              <Truck className="w-5 h-5" />
            </div>
          </div>
        </div>

        <div className="bg-app-surface border border-app-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-app-text-muted uppercase tracking-wider">
                Engagements TTC
              </p>
              <h3 className="text-2xl font-bold font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {formatCurrency(stats.totalAmount)}
              </h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 rounded-xl">
              <Coins className="w-5 h-5" />
            </div>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
            <div className="w-64">
              <SearchBar
                value={search}
                onChange={setSearch}
                placeholder="Rechercher par référence, fournisseur..."
              />
            </div>

            <DatePeriodFilter
              value={periodFilter}
              onChange={setPeriodFilter}
              onReset={() => setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' })}
            />

            {/* Fournisseur Selector Filter */}
            <select
              value={supplierFilter}
              onChange={(e) => setSupplierFilter(e.target.value)}
              aria-label="Filtrer par fournisseur"
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="all">Tous les fournisseurs</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.legal_name} ({s.code})
                </option>
              ))}
            </select>

            {/* Status Selector Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filtrer par statut"
              className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
            >
              <option value="all">Tous les statuts</option>
              <option value="DRAFT">Brouillons</option>
              <option value="PENDING">En attente</option>
              <option value="APPROVED">Approuvées</option>
              <option value="PARTIALLY_RECEIVED">Partiellement reçues</option>
              <option value="RECEIVED">Reçues</option>
              <option value="CANCELLED">Annulées</option>
            </select>
          </div>

          {(search.trim() !== '' || supplierFilter !== 'all' || statusFilter !== 'all' || periodFilter.preset !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => {
                setSearch('');
                setSupplierFilter('all');
                setStatusFilter('all');
                setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' });
              }}
            >
              Réinitialiser
            </Button>
          )}
        </div>

        {(search.trim() !== '' || supplierFilter !== 'all' || statusFilter !== 'all' || periodFilter.preset !== 'ALL') && (
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
            {supplierFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                Fournisseur : {suppliers.find((s) => String(s.id) === supplierFilter)?.legal_name || supplierFilter}
                <button
                  type="button"
                  onClick={() => setSupplierFilter('all')}
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

      {/* Data Table */}
      <DataTable<PurchaseOrder>
        columns={columns}
        data={purchases}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        emptyTitle="Aucune commande d'achat trouvée"
        emptyDescription="Créez une nouvelle commande d'achat ou modifiez vos critères de recherche."
      />

      {/* ========================================================================= */}
      {/* CREATE / EDIT PURCHASE ORDER MODAL                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isSubmitting && setIsCreateOpen(false)}
        title={editingOrder ? `Modifier la commande : ${editingOrder.reference}` : "Nouvelle commande d'achat"}
        maxWidth="4xl"
      >
        <form onSubmit={handleSaveOrder} className="space-y-6">
          {modalError && (
            <div className="p-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{modalError}</span>
            </div>
          )}

          {/* Section 1: Entête de commande */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Fournisseur *" required>
              <select
                value={formData.supplier_id}
                onChange={(e) =>
                  setFormData({ ...formData, supplier_id: e.target.value ? Number(e.target.value) : '' })
                }
                required
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              >
                <option value="">
                  {isLoadingPrereqs ? 'Chargement des fournisseurs...' : 'Sélectionner un fournisseur'}
                </option>
                {suppliers.length === 0 && !isLoadingPrereqs && (
                  <option value="" disabled>
                    Aucun fournisseur disponible.
                  </option>
                )}
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.code ? `[${s.code}] ` : ''}{s.legal_name}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Date de commande *">
              <input
                type="date"
                value={formData.order_date}
                onChange={(e) => setFormData({ ...formData, order_date: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              />
            </FormField>

            <FormField label="Date prévue de livraison">
              <input
                type="date"
                value={formData.expected_date || ''}
                onChange={(e) => setFormData({ ...formData, expected_date: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              />
            </FormField>

            <FormField label="Conditions de paiement">
              <select
                value={formData.payment_terms || ''}
                onChange={(e) => setFormData({ ...formData, payment_terms: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              >
                {PAYMENT_TERMS.map((term) => (
                  <option key={term.value} value={term.value}>
                    {term.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Mode de paiement">
              <select
                value={formData.payment_method || ''}
                onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              >
                {PAYMENT_METHODS.map((method) => (
                  <option key={method.value} value={method.value}>
                    {method.label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Référence personnalisée (optionnelle)">
              <input
                type="text"
                value={formData.reference || ''}
                onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                placeholder="Auto-générée si vide"
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue font-mono"
              />
            </FormField>
          </div>

          {/* Section 2: Lignes d'articles */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-app-text-primary flex items-center gap-2">
                <Layers className="w-4 h-4 text-pesage-blue" />
                Lignes de commande d'achat
              </h4>
              <button
                type="button"
                onClick={addLine}
                className="inline-flex items-center gap-1 px-3 py-1 text-xs font-semibold text-pesage-blue hover:text-blue-700 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-lg transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Ajouter une ligne
              </button>
            </div>

            <div className="overflow-x-auto border border-app-border rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-app-border text-app-text-muted font-semibold">
                  <tr>
                    <th className="p-2.5 min-w-[220px]">Produit / Désignation *</th>
                    <th className="p-2.5 w-24 text-right">Qté *</th>
                    <th className="p-2.5 w-28 text-right">Prix U. HT (DH) *</th>
                    <th className="p-2.5 w-20 text-right">TVA %</th>
                    <th className="p-2.5 w-20 text-right">Remise %</th>
                    <th className="p-2.5 w-28 text-right">Total HT</th>
                    <th className="p-2.5 w-28 text-right">Total TTC</th>
                    <th className="p-2.5 w-12 text-center"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border">
                  {formData.items.map((line, idx) => {
                    const totals = calculateFormLineTotals(line);
                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-2">
                          <select
                            value={line.product_id}
                            onChange={(e) => handleProductChange(idx, e.target.value)}
                            required
                            aria-label={`Produit ligne ${idx + 1}`}
                            className="w-full px-2 py-1.5 text-xs bg-app-surface border border-app-border rounded text-app-text-primary focus:ring-1 focus:ring-pesage-blue"
                          >
                            <option value="">
                              {isLoadingPrereqs ? 'Chargement des produits...' : 'Sélectionner un produit...'}
                            </option>
                            {products.length === 0 && !isLoadingPrereqs && (
                              <option value="" disabled>
                                Aucun produit disponible.
                              </option>
                            )}
                            {products.map((prod) => (
                              <option key={prod.id} value={prod.id}>
                                {prod.sku} — {prod.designation}
                              </option>
                            ))}
                          </select>
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0.01"
                            step="any"
                            value={line.quantity_ordered}
                            onChange={(e) => handleLineFieldChange(idx, 'quantity_ordered', e.target.value)}
                            required
                            aria-label={`Quantité ligne ${idx + 1}`}
                            className="w-full px-2 py-1.5 text-xs text-right font-mono bg-app-surface border border-app-border rounded text-app-text-primary focus:ring-1 focus:ring-pesage-blue"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unit_price_ht}
                            onChange={(e) => handleLineFieldChange(idx, 'unit_price_ht', e.target.value)}
                            required
                            aria-label={`Prix unitaire HT ligne ${idx + 1}`}
                            className="w-full px-2 py-1.5 text-xs text-right font-mono bg-app-surface border border-app-border rounded text-app-text-primary focus:ring-1 focus:ring-pesage-blue"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            step="0.1"
                            value={line.tax_rate}
                            onChange={(e) => handleLineFieldChange(idx, 'tax_rate', e.target.value)}
                            aria-label={`Taux TVA ligne ${idx + 1}`}
                            className="w-full px-2 py-1.5 text-xs text-right font-mono bg-app-surface border border-app-border rounded text-app-text-primary focus:ring-1 focus:ring-pesage-blue"
                          />
                        </td>

                        <td className="p-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="0.1"
                            value={line.discount_rate}
                            onChange={(e) => handleLineFieldChange(idx, 'discount_rate', e.target.value)}
                            aria-label={`Remise pourcentage ligne ${idx + 1}`}
                            className="w-full px-2 py-1.5 text-xs text-right font-mono bg-app-surface border border-app-border rounded text-app-text-primary focus:ring-1 focus:ring-pesage-blue"
                          />
                        </td>

                        <td className="p-2 text-right font-mono text-xs text-app-text-secondary">
                          {formatCurrency(totals.subtotal)}
                        </td>

                        <td className="p-2 text-right font-mono text-xs font-bold text-pesage-blue dark:text-pesage-orange">
                          {formatCurrency(totals.totalTtc)}
                        </td>

                        <td className="p-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeLine(idx)}
                            disabled={formData.items.length <= 1}
                            className="p-1 text-app-text-muted hover:text-rose-600 disabled:opacity-30 transition"
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
          </div>

          {/* Section 3: Notes & Totaux */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
            <div>
              <FormField label="Notes & Instructions">
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Instructions spécifiques pour la livraison, références devis fournisseur..."
                  className="w-full px-3 py-2 text-xs bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue resize-none"
                />
              </FormField>
            </div>

            <div className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-app-border space-y-2">
              <div className="flex justify-between text-xs text-app-text-secondary">
                <span>Sous-total HT :</span>
                <span className="font-mono font-medium">{formatCurrency(formTotals.subtotal)}</span>
              </div>
              <div className="flex justify-between text-xs text-app-text-secondary">
                <span>Montant TVA :</span>
                <span className="font-mono font-medium">{formatCurrency(formTotals.tax)}</span>
              </div>
              <div className="border-t border-app-border pt-2 flex justify-between text-sm font-bold text-app-text-primary">
                <span>Total TTC :</span>
                <span className="font-mono text-pesage-blue dark:text-pesage-orange text-base">
                  {formatCurrency(formTotals.totalTtc)}
                </span>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmitting}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2 flex items-center gap-2"
            >
              {isSubmitting && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              <span>{editingOrder ? 'Enregistrer les modifications' : 'Créer la commande'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* VIEW PURCHASE ORDER DETAIL MODAL                                          */}
      {/* ========================================================================= */}
      {viewingOrder && (
        <Modal
          isOpen={true}
          onClose={() => setViewingOrder(null)}
          title={`Détails de la commande : ${viewingOrder.reference}`}
          maxWidth="4xl"
        >
          <div className="space-y-6">
            {/* Header info */}
            <div className="bg-gray-50 dark:bg-gray-900/60 p-4 rounded-xl border border-app-border grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
              <div>
                <span className="text-app-text-muted block">Fournisseur</span>
                <span className="font-bold text-app-text-primary text-sm mt-0.5 block">
                  {viewingOrder.supplier?.legal_name}
                </span>
                <span className="text-app-text-muted font-mono">{viewingOrder.supplier?.code}</span>
              </div>

              <div>
                <span className="text-app-text-muted block">Date de commande</span>
                <span className="font-medium text-app-text-primary block mt-0.5">
                  {formatDate(viewingOrder.order_date)}
                </span>
                {viewingOrder.expected_date && (
                  <span className="text-xs text-app-text-muted">
                    Prévue : {formatDate(viewingOrder.expected_date)}
                  </span>
                )}
              </div>

              <div>
                <span className="text-app-text-muted block">Statut</span>
                <div className="mt-1">{renderStatusBadge(viewingOrder.status)}</div>
              </div>

              <div>
                <span className="text-app-text-muted block">Créée par</span>
                <span className="font-medium text-app-text-primary block mt-0.5">
                  {viewingOrder.creator?.first_name} {viewingOrder.creator?.last_name || viewingOrder.creator?.email}
                </span>
                <span className="text-app-text-muted text-[11px]">
                  {formatDate(viewingOrder.created_at)}
                </span>
              </div>
            </div>

            {/* Articles Table */}
            <div className="space-y-2">
              <h4 className="text-sm font-bold text-app-text-primary flex items-center gap-2">
                <Package className="w-4 h-4 text-pesage-blue" />
                Articles commandés & Suivi des réceptions
              </h4>

              <div className="overflow-x-auto border border-app-border rounded-xl">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-app-border text-app-text-muted font-semibold">
                    <tr>
                      <th className="p-2.5">Produit</th>
                      <th className="p-2.5 text-right">Qté Commandée</th>
                      <th className="p-2.5 text-right text-emerald-600 dark:text-emerald-400">Reçue</th>
                      <th className="p-2.5 text-right text-pesage-orange">Reste</th>
                      <th className="p-2.5 text-right">P.U. HT</th>
                      <th className="p-2.5 text-right">TVA</th>
                      <th className="p-2.5 text-right font-bold">Total TTC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {viewingOrder.items?.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                        <td className="p-2.5">
                          <div className="font-semibold text-app-text-primary">
                            {item.product?.designation}
                          </div>
                          <div className="text-[11px] font-mono text-app-text-muted">
                            SKU: {item.product?.sku}
                          </div>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          {item.quantity_ordered}
                        </td>
                        <td className="p-2.5 text-right font-mono text-emerald-600 dark:text-emerald-400 font-semibold">
                          {item.quantity_received}
                        </td>
                        <td className="p-2.5 text-right font-mono text-pesage-orange font-bold">
                          {item.quantity_remaining}
                        </td>
                        <td className="p-2.5 text-right font-mono text-app-text-secondary">
                          {formatCurrency(item.unit_price_ht)}
                        </td>
                        <td className="p-2.5 text-right font-mono text-app-text-muted">
                          {item.tax_rate}%
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-pesage-blue dark:text-pesage-orange">
                          {formatCurrency(item.line_total_ttc)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totaux & Paiement */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-app-border text-xs space-y-1">
                <div>
                  <span className="text-app-text-muted">Conditions : </span>
                  <span className="font-medium">{viewingOrder.payment_terms || 'Non spécifiées'}</span>
                </div>
                <div>
                  <span className="text-app-text-muted">Mode de paiement : </span>
                  <span className="font-medium">{viewingOrder.payment_method || 'Non spécifié'}</span>
                </div>
                {viewingOrder.notes && (
                  <div className="pt-1 text-app-text-secondary">
                    <span className="text-app-text-muted block">Notes :</span>
                    {viewingOrder.notes}
                  </div>
                )}
              </div>

              <div className="p-3 bg-gray-50 dark:bg-gray-900/40 rounded-lg border border-app-border text-xs space-y-1.5">
                <div className="flex justify-between text-app-text-secondary">
                  <span>Sous-total HT :</span>
                  <span className="font-mono font-medium">{formatCurrency(viewingOrder.subtotal_ht)}</span>
                </div>
                <div className="flex justify-between text-app-text-secondary">
                  <span>Total TVA :</span>
                  <span className="font-mono font-medium">{formatCurrency(viewingOrder.tax_amount)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-app-text-primary pt-1 border-t border-app-border">
                  <span>Total TTC :</span>
                  <span className="font-mono text-pesage-blue dark:text-pesage-orange">
                    {formatCurrency(viewingOrder.total_ttc)}
                  </span>
                </div>
              </div>
            </div>

            {/* Receipts History */}
            {viewingOrder.receipts && viewingOrder.receipts.length > 0 && (
              <div className="space-y-2 pt-2">
                <h4 className="text-sm font-bold text-app-text-primary flex items-center gap-2">
                  <Truck className="w-4 h-4 text-pesage-orange" />
                  Historique des réceptions ({viewingOrder.receipts.length})
                </h4>
                <div className="space-y-2">
                  {viewingOrder.receipts.map((rec) => (
                    <div
                      key={rec.id}
                      className="p-3 bg-white dark:bg-gray-800 border border-app-border rounded-lg text-xs flex items-center justify-between"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-app-text-primary">
                            {rec.reference}
                          </span>
                          {rec.warehouse && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 dark:bg-blue-950/50 text-pesage-blue border border-blue-200 dark:border-blue-800">
                              Dépôt : {rec.warehouse.code} — {rec.warehouse.name}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-app-text-muted">
                          Reçu le {formatDate(rec.receipt_date)} par {rec.receiver?.first_name} {rec.receiver?.last_name || rec.receiver?.email}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-emerald-600">
                          {rec.items?.reduce((acc, it) => acc + Number(it.quantity_received), 0)} article(s) réceptionné(s)
                        </div>
                        {rec.notes && <div className="text-app-text-muted text-[11px]">{rec.notes}</div>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Contextual Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-app-border">
              <div className="flex items-center gap-2">
                {(viewingOrder.status === 'DRAFT' || viewingOrder.status === 'PENDING') && canApprove && (
                  <button
                    type="button"
                    onClick={() => handleApproveOrder(viewingOrder.id)}
                    className="btn-success text-xs px-4 py-2 flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Approuver la commande
                  </button>
                )}

                {(viewingOrder.status === 'APPROVED' || viewingOrder.status === 'PARTIALLY_RECEIVED') && canReceive && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingOrder(null);
                      handleOpenReceipt(viewingOrder);
                    }}
                    className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5"
                  >
                    <Truck className="w-4 h-4" />
                    Réceptionner des articles
                  </button>
                )}

                {(viewingOrder.status === 'APPROVED' || viewingOrder.status === 'PARTIALLY_RECEIVED' || viewingOrder.status === 'RECEIVED') && (
                  <button
                    type="button"
                    onClick={() => {
                      setViewingOrder(null);
                      navigate(`/factures-achat?purchase_id=${viewingOrder.id}`);
                    }}
                    className="px-4 py-2 rounded-xl bg-pesage-blue-subtle text-pesage-blue border border-pesage-blue/30 hover:bg-pesage-blue/20 text-xs font-semibold flex items-center gap-1.5 transition"
                  >
                    <FileText className="w-4 h-4" />
                    Facturer
                  </button>
                )}

                {(viewingOrder.status === 'DRAFT' || viewingOrder.status === 'PENDING' || viewingOrder.status === 'APPROVED') && canUpdate && (
                  <button
                    type="button"
                    onClick={() => setCancellingOrder(viewingOrder)}
                    className="btn-danger text-xs px-3 py-2 flex items-center gap-1.5"
                  >
                    <XCircle className="w-4 h-4" />
                    Annuler
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setViewingOrder(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Fermer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* PURCHASE RECEIPT MODAL                                                    */}
      {/* ========================================================================= */}
      {receiptingOrder && (
        <Modal
          isOpen={true}
          onClose={() => !isSubmitting && setReceiptingOrder(null)}
          title={`Réception de commande : ${receiptingOrder.reference}`}
          maxWidth="4xl"
        >
          <form onSubmit={handleSaveReceipt} className="space-y-5">
            <div className="bg-blue-50 dark:bg-blue-950/40 p-3 rounded-lg border border-blue-200 dark:border-blue-900 text-xs text-blue-800 dark:text-blue-300">
              Fournisseur : <span className="font-bold">{receiptingOrder.supplier?.legal_name}</span>.
              Saisissez les quantités réellement réceptionnées ci-dessous.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <FormField label="N° Bon de Livraison / Référence">
                <input
                  type="text"
                  value={receiptForm.reference || ''}
                  onChange={(e) => setReceiptForm({ ...receiptForm, reference: e.target.value })}
                  placeholder="Ex: BL-FOURNISSEUR-12345 (Auto si vide)"
                  className="w-full px-3 py-2 text-xs bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue font-mono"
                />
              </FormField>

              <FormField label="Date de réception *">
                <input
                  type="date"
                  value={receiptForm.receipt_date}
                  onChange={(e) => setReceiptForm({ ...receiptForm, receipt_date: e.target.value })}
                  required
                  className="w-full px-3 py-2 text-xs bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
                />
              </FormField>

              <FormField label="Dépôt de réception *">
                <select
                  id="receipt-warehouse-select"
                  value={receiptForm.warehouse_id}
                  onChange={(e) =>
                    setReceiptForm({
                      ...receiptForm,
                      warehouse_id: e.target.value ? Number(e.target.value) : '',
                    })
                  }
                  required
                  className="w-full px-3 py-2 text-xs bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
                >
                  <option value="">Sélectionner un dépôt...</option>
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
              </FormField>
            </div>

            {/* Items to receive table */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">
                  Articles à réceptionner
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setReceiptForm((prev) => ({
                      ...prev,
                      items: prev.items.map((it) => {
                        const orderItem = receiptingOrder.items?.find((o) => o.id === it.purchase_order_item_id);
                        return {
                          ...it,
                          quantity_received: orderItem ? Number(orderItem.quantity_remaining) : it.quantity_received,
                        };
                      }),
                    }));
                  }}
                  className="text-xs font-semibold text-pesage-blue dark:text-blue-400 hover:underline"
                >
                  Tout recevoir
                </button>
              </div>

              <div className="border border-app-border rounded-xl overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-gray-50 dark:bg-gray-800/60 border-b border-app-border text-app-text-muted">
                    <tr>
                      <th className="p-2.5">Produit</th>
                      <th className="p-2.5 text-right w-24">Commandé</th>
                      <th className="p-2.5 text-right w-24">Déjà reçu</th>
                      <th className="p-2.5 text-right w-24 text-pesage-orange font-bold">Reste</th>
                      <th className="p-2.5 text-right w-36 text-pesage-blue font-bold">Reçu maintenant *</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-app-border">
                    {receiptForm.items.map((line, idx) => {
                      const orderItem = receiptingOrder.items?.find((it) => it.id === line.purchase_order_item_id);
                      if (!orderItem) return null;
                      const maxQty = Number(orderItem.quantity_remaining) || 0;
                      return (
                        <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/30">
                          <td className="p-2.5">
                            <div className="font-semibold text-app-text-primary">
                              {orderItem.product?.designation}
                            </div>
                            <div className="text-[11px] font-mono text-app-text-muted">
                              SKU: {orderItem.product?.sku}
                            </div>
                          </td>
                          <td className="p-2.5 text-right font-mono">{orderItem.quantity_ordered}</td>
                          <td className="p-2.5 text-right font-mono text-emerald-600">{orderItem.quantity_received}</td>
                          <td className="p-2.5 text-right font-mono font-bold text-pesage-orange">{maxQty}</td>
                          <td className="p-2.5 text-right">
                            <input
                              type="number"
                              min="0"
                              max={maxQty}
                              step="any"
                              value={line.quantity_received}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setReceiptForm((prev) => {
                                  const newItems = [...prev.items];
                                  newItems[idx] = {
                                    ...newItems[idx],
                                    quantity_received: val,
                                  };
                                  return { ...prev, items: newItems };
                                });
                              }}
                              required
                              aria-label={`Quantité reçue pour ${orderItem.product?.designation || `produit ${idx + 1}`}`}
                              className="w-full px-2 py-1 text-xs text-right font-mono font-bold bg-white dark:bg-gray-900 border border-pesage-blue rounded text-pesage-blue dark:text-blue-400 focus:ring-1 focus:ring-pesage-blue"
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <FormField label="Notes & Observations">
              <textarea
                rows={2}
                value={receiptForm.notes || ''}
                onChange={(e) => setReceiptForm({ ...receiptForm, notes: e.target.value })}
                placeholder="État de la marchandise reçue, transporteur..."
                className="w-full px-3 py-2 text-xs bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue resize-none"
              />
            </FormField>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border">
              <button
                type="button"
                onClick={() => setReceiptingOrder(null)}
                disabled={isSubmitting}
                className="btn-secondary px-4 py-2"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-primary px-5 py-2 flex items-center gap-2"
              >
                {isSubmitting && <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                Confirmer la réception
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* ========================================================================= */}
      {/* CANCEL ORDER DIALOG                                                       */}
      {/* ========================================================================= */}
      <ConfirmDialog
        isOpen={!!cancellingOrder}
        title="Annuler la commande d'achat"
        message={`Êtes-vous sûr de vouloir annuler la commande ${cancellingOrder?.reference} ? Cette action est irréversible.`}
        confirmLabel="Annuler la commande"
        onConfirm={handleCancelOrder}
        onClose={() => setCancellingOrder(null)}
      />

      {/* ========================================================================= */}
      {/* DELETE ORDER DIALOG                                                       */}
      {/* ========================================================================= */}
      <ConfirmDialog
        isOpen={!!deletingOrder}
        title="Supprimer la commande d'achat"
        message={`Êtes-vous sûr de vouloir supprimer définitivement la commande ${deletingOrder?.reference} ?`}
        confirmLabel="Supprimer définitivement"
        onConfirm={handleDeleteOrder}
        onClose={() => setDeletingOrder(null)}
      />
    </div>
  );
};
