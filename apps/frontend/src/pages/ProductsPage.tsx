import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Product, ProductCreate, ProductUpdate, Category, ProductType, Brand, Unit } from '@/types/catalog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusFilter } from '@/components/ui/StatusFilter';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatPercentage } from '@/lib/formatters';
import { Package, Plus, Edit2, Ban, CheckCircle2, Loader2, Layers, Tag, Award, Scale, Info, DollarSign, Settings } from 'lucide-react';

export const ProductsPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Related options
  const [categories, setCategories] = useState<Category[]>([]);
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deactivatingProduct, setDeactivatingProduct] = useState<Product | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<ProductCreate>({
    sku: '',
    designation: '',
    description: '',
    category_id: 0,
    product_type_id: 0,
    brand_id: null,
    unit_id: 0,
    barcode: '',
    purchase_price: 0,
    sale_price: 0,
    tax_rate: 20,
    is_active: true,
    track_stock: true,
  });

  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('products.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('products.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('products.delete');

  const fetchOptions = async () => {
    try {
      const [catRes, typeRes, brandRes, unitRes] = await Promise.all([
        api.get<Category[]>('/api/v1/categories?is_active=true&size=100'),
        api.get<ProductType[]>('/api/v1/product-types?is_active=true&size=100'),
        api.get<Brand[]>('/api/v1/brands?is_active=true&size=100'),
        api.get<Unit[]>('/api/v1/units?is_active=true&size=100'),
      ]);
      setCategories(catRes.data);
      setProductTypes(typeRes.data);
      setBrands(brandRes.data);
      setUnits(unitRes.data);

      if (catRes.data.length > 0 && formData.category_id === 0) {
        setFormData((prev) => ({
          ...prev,
          category_id: catRes.data[0].id,
          product_type_id: typeRes.data[0]?.id || 0,
          unit_id: unitRes.data[0]?.id || 0,
        }));
      }
    } catch {
      // Ignore options fetch errors silently if restricted
    }
  };

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/products?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<Product[]>(url);
      setProducts(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger le catalogue produits.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  useEffect(() => {
    fetchProducts();
    fetchOptions();
  }, [fetchProducts]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.category_id || !formData.product_type_id || !formData.unit_id) {
      setModalError('Veuillez sélectionner la catégorie, le type de produit et l\'unité de mesure.');
      return;
    }
    setIsSubmitting(true);
    setModalError(null);
    try {
      const payload: ProductCreate = {
        ...formData,
        brand_id: formData.brand_id ? Number(formData.brand_id) : null,
        category_id: Number(formData.category_id),
        product_type_id: Number(formData.product_type_id),
        unit_id: Number(formData.unit_id),
        purchase_price: Number(formData.purchase_price),
        sale_price: Number(formData.sale_price),
        tax_rate: Number(formData.tax_rate),
        barcode: formData.barcode || undefined,
        description: formData.description || undefined,
      };
      await api.post('/api/v1/products', payload);
      showSuccess('Produit créé avec succès.');
      setIsCreateOpen(false);
      fetchProducts();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la création du produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const updatePayload: ProductUpdate = {
        sku: editingProduct.sku,
        designation: editingProduct.designation,
        description: editingProduct.description || undefined,
        category_id: Number(editingProduct.category_id),
        product_type_id: Number(editingProduct.product_type_id),
        brand_id: editingProduct.brand_id ? Number(editingProduct.brand_id) : null,
        unit_id: Number(editingProduct.unit_id),
        barcode: editingProduct.barcode || undefined,
        purchase_price: Number(editingProduct.purchase_price),
        sale_price: Number(editingProduct.sale_price),
        tax_rate: Number(editingProduct.tax_rate),
        is_active: editingProduct.is_active,
        track_stock: editingProduct.track_stock,
      };
      await api.put(`/api/v1/products/${editingProduct.id}`, updatePayload);
      showSuccess('Produit mis à jour avec succès.');
      setEditingProduct(null);
      fetchProducts();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la mise à jour du produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingProduct) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/products/${deactivatingProduct.id}`);
      showSuccess(`Produit "${deactivatingProduct.designation}" désactivé avec succès.`);
      setDeactivatingProduct(null);
      fetchProducts();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de la désactivation du produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Product>[] = [
    {
      header: 'Référence',
      accessor: (p) => <span className="font-mono text-pesage-blue dark:text-pesage-blue-light font-bold">{p.sku}</span>,
      width: '130px',
    },
    {
      header: 'Désignation',
      accessor: (p) => (
        <div>
          <span className="font-semibold text-slate-900 dark:text-slate-100 block">{p.designation}</span>
          {p.barcode && <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400 block">EAN: {p.barcode}</span>}
        </div>
      ),
    },
    {
      header: 'Catégorie',
      accessor: (p) => (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-pesage-blue/10 text-pesage-blue dark:text-pesage-blue-light border border-pesage-blue/20 text-[10px] font-medium">
          <Layers className="w-2.5 h-2.5" />
          <span>{p.category?.name || '-'}</span>
        </span>
      ),
    },
    {
      header: 'Type',
      accessor: (p) => (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20 text-[10px] font-medium">
          <Tag className="w-2.5 h-2.5" />
          <span>{p.product_type?.name || '-'}</span>
        </span>
      ),
    },
    {
      header: 'Marque',
      accessor: (p) => <span className="text-slate-600 dark:text-slate-400">{p.brand?.name || '-'}</span>,
    },
    {
      header: 'Unité',
      accessor: (p) => <span className="font-mono text-cyan-600 dark:text-cyan-400">{p.unit?.abbreviation || '-'}</span>,
    },
    {
      header: 'Prix d\'achat HT',
      accessor: (p) => <span className="text-slate-600 dark:text-slate-400">{formatCurrency(p.purchase_price)}</span>,
      align: 'right',
    },
    {
      header: 'Prix de vente HT',
      accessor: (p) => <span className="text-emerald-600 dark:text-emerald-400 font-bold">{formatCurrency(p.sale_price)}</span>,
      align: 'right',
    },
    {
      header: 'TVA',
      accessor: (p) => <span className="text-slate-600 dark:text-slate-400">{formatPercentage(p.tax_rate)}</span>,
      align: 'right',
    },
    {
      header: 'Statut',
      accessor: (p) =>
        p.is_active ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Actif</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <Ban className="w-3 h-3" />
            <span>Inactif</span>
          </span>
        ),
      width: '110px',
    },
  ];

  const inputClass = "w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue transition-colors";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Catalogue Produits"
        subtitle="Référentiel des articles, tarification en Dirham Marocain (DH) et classification commerciale"
        icon={Package}
        action={
          canCreate
            ? {
                label: 'Ajouter un produit',
                onClick: () => {
                  setModalError(null);
                  setIsCreateOpen(true);
                },
                icon: Plus,
              }
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par référence (SKU), désignation ou code-barres..."
        />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={products}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        emptyTitle="Aucun produit dans le catalogue"
        emptyDescription="Aucun article ne correspond aux critères de recherche actuels."
        actions={(p) => (
          <div className="flex items-center justify-end space-x-1.5">
            {canUpdate && (
              <button
                onClick={() => {
                  setEditingProduct(p);
                  setModalError(null);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                title="Modifier le produit"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && p.is_active && (
              <button
                onClick={() => setDeactivatingProduct(p)}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors border border-rose-500/20"
                title="Désactiver le produit"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />

      {/* Create Product Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Ajouter un nouveau produit"
        subtitle="Saisie des caractéristiques commerciales, tarifaires et de gestion de l'article"
        maxWidth="4xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="btn-secondary text-xs px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={isSubmitting}
              className="btn-primary text-xs px-4 py-2 flex items-center space-x-1.5"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Enregistrer le produit</span>
            </button>
          </>
        }
      >
        {modalError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-6">
          {/* SECTION 1: Informations Générales */}
          <div className="space-y-3 pt-1">
            <h4 className="text-xs font-bold text-pesage-blue dark:text-pesage-blue-light uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <Info className="w-4 h-4" />
              <span>Section 1 — Informations générales</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Référence (SKU)" required>
                <input
                  type="text"
                  required
                  placeholder="ex. PROD-1001"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                  className={`${inputClass} font-mono`}
                />
              </FormField>

              <FormField label="Code-barres (EAN)">
                <input
                  type="text"
                  placeholder="ex. 6111234567890"
                  value={formData.barcode || ''}
                  onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                  className={`${inputClass} font-mono`}
                />
              </FormField>
            </div>

            <FormField label="Désignation de l'article" required>
              <input
                type="text"
                required
                placeholder="ex. Armoire Électrique Industrielle IP65"
                value={formData.designation}
                onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                className={inputClass}
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={2}
                placeholder="Description détaillée de l'article..."
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className={inputClass}
              />
            </FormField>
          </div>

          {/* SECTION 2: Classification */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <Layers className="w-4 h-4" />
              <span>Section 2 — Classification</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Catégorie de produit" required>
                <select
                  required
                  value={formData.category_id}
                  onChange={(e) => setFormData({ ...formData, category_id: Number(e.target.value) })}
                  className={inputClass}
                >
                  <option value={0}>Sélectionner une catégorie...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Type de produit" required>
                <select
                  required
                  value={formData.product_type_id}
                  onChange={(e) => setFormData({ ...formData, product_type_id: Number(e.target.value) })}
                  className={inputClass}
                >
                  <option value={0}>Sélectionner un type...</option>
                  {productTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.code})
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Marque (Fabricant)">
                <select
                  value={formData.brand_id || ''}
                  onChange={(e) => setFormData({ ...formData, brand_id: e.target.value ? Number(e.target.value) : null })}
                  className={inputClass}
                >
                  <option value="">Aucune marque</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </FormField>

              <FormField label="Unité de mesure" required>
                <select
                  required
                  value={formData.unit_id}
                  onChange={(e) => setFormData({ ...formData, unit_id: Number(e.target.value) })}
                  className={inputClass}
                >
                  <option value={0}>Sélectionner une unité...</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.abbreviation})
                    </option>
                  ))}
                </select>
              </FormField>
            </div>
          </div>

          {/* SECTION 3: Tarification */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <DollarSign className="w-4 h-4" />
              <span>Section 3 — Tarification (DH)</span>
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <FormField label="Prix d'achat HT (DH)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.purchase_price}
                  onChange={(e) => setFormData({ ...formData, purchase_price: parseFloat(e.target.value) || 0 })}
                  className={`${inputClass} font-mono`}
                />
              </FormField>

              <FormField label="Prix de vente HT (DH)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.sale_price}
                  onChange={(e) => setFormData({ ...formData, sale_price: parseFloat(e.target.value) || 0 })}
                  className={`${inputClass} font-mono font-bold text-emerald-600 dark:text-emerald-400`}
                />
              </FormField>

              <FormField label="Taux de TVA (%)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData({ ...formData, tax_rate: parseFloat(e.target.value) || 0 })}
                  className={`${inputClass} font-mono`}
                />
              </FormField>
            </div>
          </div>

          {/* SECTION 4: Gestion */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-pesage-orange uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
              <Settings className="w-4 h-4" />
              <span>Section 4 — Paramètres de gestion</span>
            </h4>
            <div className="flex flex-wrap items-center gap-6 pt-1">
              <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.track_stock}
                  onChange={(e) => setFormData({ ...formData, track_stock: e.target.checked })}
                  className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-pesage-blue focus:ring-0 cursor-pointer"
                />
                <span>Activer le suivi du stock</span>
              </label>

              <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-pesage-blue focus:ring-0 cursor-pointer"
                />
                <span>Produit actif</span>
              </label>
            </div>
          </div>
        </form>
      </Modal>

      {/* Edit Product Modal */}
      {editingProduct && (
        <Modal
          isOpen={!!editingProduct}
          onClose={() => setEditingProduct(null)}
          title="Modifier le produit"
          subtitle={`Modification de la fiche produit #${editingProduct.sku}`}
          maxWidth="4xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="btn-secondary text-xs px-4 py-2"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={isSubmitting}
                className="btn-primary text-xs px-4 py-2 flex items-center space-x-1.5"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Enregistrer les modifications</span>
              </button>
            </>
          }
        >
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
              {modalError}
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-6">
            <div className="space-y-3 pt-1">
              <h4 className="text-xs font-bold text-pesage-blue dark:text-pesage-blue-light uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Info className="w-4 h-4" />
                <span>Section 1 — Informations générales</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Référence (SKU)" required>
                  <input
                    type="text"
                    required
                    value={editingProduct.sku}
                    onChange={(e) => setEditingProduct({ ...editingProduct, sku: e.target.value.toUpperCase() })}
                    className={`${inputClass} font-mono`}
                  />
                </FormField>

                <FormField label="Code-barres (EAN)">
                  <input
                    type="text"
                    value={editingProduct.barcode || ''}
                    onChange={(e) => setEditingProduct({ ...editingProduct, barcode: e.target.value })}
                    className={`${inputClass} font-mono`}
                  />
                </FormField>
              </div>

              <FormField label="Désignation de l'article" required>
                <input
                  type="text"
                  required
                  value={editingProduct.designation}
                  onChange={(e) => setEditingProduct({ ...editingProduct, designation: e.target.value })}
                  className={inputClass}
                />
              </FormField>

              <FormField label="Description">
                <textarea
                  rows={2}
                  value={editingProduct.description || ''}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className={inputClass}
                />
              </FormField>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Layers className="w-4 h-4" />
                <span>Section 2 — Classification</span>
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Catégorie de produit" required>
                  <select
                    required
                    value={editingProduct.category_id}
                    onChange={(e) => setEditingProduct({ ...editingProduct, category_id: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code})
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Type de produit" required>
                  <select
                    required
                    value={editingProduct.product_type_id}
                    onChange={(e) => setEditingProduct({ ...editingProduct, product_type_id: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {productTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.code})
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Marque (Fabricant)">
                  <select
                    value={editingProduct.brand_id || ''}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, brand_id: e.target.value ? Number(e.target.value) : null })
                    }
                    className={inputClass}
                  >
                    <option value="">Aucune marque</option>
                    {brands.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Unité de mesure" required>
                  <select
                    required
                    value={editingProduct.unit_id}
                    onChange={(e) => setEditingProduct({ ...editingProduct, unit_id: Number(e.target.value) })}
                    className={inputClass}
                  >
                    {units.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.abbreviation})
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <DollarSign className="w-4 h-4" />
                <span>Section 3 — Tarification (DH)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <FormField label="Prix d'achat HT (DH)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.purchase_price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, purchase_price: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </FormField>

                <FormField label="Prix de vente HT (DH)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.sale_price}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, sale_price: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputClass} font-mono font-bold text-emerald-600 dark:text-emerald-400`}
                  />
                </FormField>

                <FormField label="Taux de TVA (%)">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editingProduct.tax_rate}
                    onChange={(e) =>
                      setEditingProduct({ ...editingProduct, tax_rate: parseFloat(e.target.value) || 0 })
                    }
                    className={`${inputClass} font-mono`}
                  />
                </FormField>
              </div>
            </div>

            <div className="space-y-3">
              <h4 className="text-xs font-bold text-pesage-orange uppercase tracking-wider flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                <Settings className="w-4 h-4" />
                <span>Section 4 — Paramètres de gestion</span>
              </h4>
              <div className="flex flex-wrap items-center gap-6 pt-1">
                <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.is_active}
                    onChange={(e) => setEditingProduct({ ...editingProduct, is_active: e.target.checked })}
                    className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-pesage-blue focus:ring-0 cursor-pointer"
                  />
                  <span>Produit actif</span>
                </label>

                <label className="flex items-center space-x-2 text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingProduct.track_stock}
                    onChange={(e) => setEditingProduct({ ...editingProduct, track_stock: e.target.checked })}
                    className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-pesage-blue focus:ring-0 cursor-pointer"
                  />
                  <span>Activer le suivi du stock</span>
                </label>
              </div>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingProduct}
        onClose={() => setDeactivatingProduct(null)}
        onConfirm={handleConfirmDeactivate}
        title="Désactiver le produit"
        message={`Êtes-vous sûr de vouloir désactiver le produit "${deactivatingProduct?.designation}" (Réf: ${deactivatingProduct?.sku}) ?`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isLoading={isSubmitting}
      />
    </div>
  );
};
