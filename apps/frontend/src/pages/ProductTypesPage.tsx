import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { ProductType, ProductTypeCreate, ProductTypeUpdate } from '@/types/catalog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusFilter } from '@/components/ui/StatusFilter';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { Tag, Plus, Edit2, Ban, CheckCircle2, Loader2 } from 'lucide-react';

export const ProductTypesPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [types, setTypes] = useState<ProductType[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingType, setEditingType] = useState<ProductType | null>(null);
  const [deactivatingType, setDeactivatingType] = useState<ProductType | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState<ProductTypeCreate>({ name: '', code: '', description: '' });

  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('product_types.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('product_types.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('product_types.delete');

  const fetchTypes = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/product-types?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<ProductType[]>(url);
      setTypes(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger les types de produits.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  useEffect(() => {
    fetchTypes();
  }, [fetchTypes]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/api/v1/product-types', formData);
      showSuccess('Type de produit créé avec succès.');
      setIsCreateOpen(false);
      setFormData({ name: '', code: '', description: '' });
      fetchTypes();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la création du type de produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingType) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const updateData: ProductTypeUpdate = {
        name: editingType.name,
        code: editingType.code,
        description: editingType.description || undefined,
        is_active: editingType.is_active,
      };
      await api.put(`/api/v1/product-types/${editingType.id}`, updateData);
      showSuccess('Type de produit mis à jour avec succès.');
      setEditingType(null);
      fetchTypes();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la mise à jour du type de produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingType) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/product-types/${deactivatingType.id}`);
      showSuccess(`Type de produit "${deactivatingType.name}" désactivé avec succès.`);
      setDeactivatingType(null);
      fetchTypes();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de la désactivation du type de produit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<ProductType>[] = [
    {
      header: 'Code',
      accessor: (t) => <span className="font-mono text-indigo-600 dark:text-indigo-400 font-bold">{t.code}</span>,
      width: '140px',
    },
    {
      header: 'Nom du type',
      accessor: (t) => <span className="font-semibold text-slate-900 dark:text-slate-100">{t.name}</span>,
    },
    {
      header: 'Description',
      accessor: (t) => <span className="text-slate-500 dark:text-slate-400">{t.description || '-'}</span>,
    },
    {
      header: 'Statut',
      accessor: (t) =>
        t.is_active ? (
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
      width: '120px',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Types de produits"
        subtitle="Classification par nature ou type d'articles (Consommable, Service, Équipement)"
        icon={Tag}
        action={
          canCreate
            ? {
                label: 'Ajouter un type de produit',
                onClick: () => {
                  setFormData({ name: '', code: '', description: '' });
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
          placeholder="Rechercher par nom ou code..."
        />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={types}
        keyExtractor={(t) => t.id}
        isLoading={isLoading}
        emptyTitle="Aucun type de produit trouvé"
        emptyDescription="Aucun type de produit ne correspond à vos critères de recherche."
        actions={(t) => (
          <div className="flex items-center justify-end space-x-1.5">
            {canUpdate && (
              <button
                onClick={() => {
                  setEditingType(t);
                  setModalError(null);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                title="Modifier"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && t.is_active && (
              <button
                onClick={() => setDeactivatingType(t)}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors border border-rose-500/20"
                title="Désactiver"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />

      {/* Create Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Ajouter un type de produit"
        subtitle="Spécifiez les caractéristiques du nouveau type d'article"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-pesage-blue/20"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Enregistrer</span>
            </button>
          </>
        }
      >
        {modalError && (
          <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs font-medium">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <FormField label="Code du type de produit" required>
            <input
              type="text"
              required
              placeholder="ex. TYPE-MACHINERY"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
            />
          </FormField>

          <FormField label="Nom du type de produit" required>
            <input
              type="text"
              required
              placeholder="ex. Machine industrielle"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              rows={3}
              placeholder="Description optionnelle..."
              value={formData.description || ''}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
            />
          </FormField>
        </form>
      </Modal>

      {/* Edit Modal */}
      {editingType && (
        <Modal
          isOpen={!!editingType}
          onClose={() => setEditingType(null)}
          title="Modifier le type de produit"
          subtitle={`Modification des informations de ${editingType.name}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingType(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-pesage-blue/20"
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

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormField label="Code du type de produit" required>
              <input
                type="text"
                required
                value={editingType.code}
                onChange={(e) => setEditingType({ ...editingType, code: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-pesage-blue font-mono"
              />
            </FormField>

            <FormField label="Nom du type de produit" required>
              <input
                type="text"
                required
                value={editingType.name}
                onChange={(e) => setEditingType({ ...editingType, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={3}
                value={editingType.description || ''}
                onChange={(e) => setEditingType({ ...editingType, description: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="type_is_active"
                checked={editingType.is_active}
                onChange={(e) => setEditingType({ ...editingType, is_active: e.target.checked })}
                className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-pesage-blue focus:ring-0 cursor-pointer"
              />
              <label htmlFor="type_is_active" className="text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                Type de produit actif
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingType}
        onClose={() => setDeactivatingType(null)}
        onConfirm={handleConfirmDeactivate}
        title="Désactiver le type de produit"
        message={`Êtes-vous sûr de vouloir désactiver le type de produit "${deactivatingType?.name}" ?`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isLoading={isSubmitting}
      />
    </div>
  );
};
