import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Category, CategoryCreate, CategoryUpdate } from '@/types/catalog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusFilter } from '@/components/ui/StatusFilter';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { Layers, Plus, Edit2, Ban, CheckCircle2, Loader2 } from 'lucide-react';

export const CategoriesPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deactivatingCategory, setDeactivatingCategory] = useState<Category | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState<CategoryCreate>({ name: '', code: '', description: '' });

  // Permissions check
  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('categories.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('categories.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('categories.delete');

  const fetchCategories = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/categories?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<Category[]>(url);
      setCategories(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger les catégories.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/api/v1/categories', formData);
      showSuccess('Catégorie créée avec succès.');
      setIsCreateOpen(false);
      setFormData({ name: '', code: '', description: '' });
      fetchCategories();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la création de la catégorie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCategory) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const updateData: CategoryUpdate = {
        name: editingCategory.name,
        code: editingCategory.code,
        description: editingCategory.description || undefined,
        is_active: editingCategory.is_active,
      };
      await api.put(`/api/v1/categories/${editingCategory.id}`, updateData);
      showSuccess('Catégorie mise à jour avec succès.');
      setEditingCategory(null);
      fetchCategories();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la mise à jour de la catégorie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingCategory) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/categories/${deactivatingCategory.id}`);
      showSuccess(`Catégorie "${deactivatingCategory.name}" désactivée avec succès.`);
      setDeactivatingCategory(null);
      fetchCategories();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de la désactivation de la catégorie.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Category>[] = [
    {
      header: 'Code',
      accessor: (cat) => <span className="font-mono text-pesage-blue dark:text-pesage-blue-light font-bold">{cat.code}</span>,
      width: '140px',
    },
    {
      header: 'Nom de la catégorie',
      accessor: (cat) => <span className="font-semibold text-slate-900 dark:text-slate-100">{cat.name}</span>,
    },
    {
      header: 'Description',
      accessor: (cat) => <span className="text-slate-500 dark:text-slate-400">{cat.description || '-'}</span>,
    },
    {
      header: 'Statut',
      accessor: (cat) =>
        cat.is_active ? (
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
        title="Catégories de produits"
        subtitle="Gestion et classification des familles de produits du catalogue commercial"
        icon={Layers}
        action={
          canCreate
            ? {
                label: 'Ajouter une catégorie',
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

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher une catégorie par nom ou par code..."
        />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={categories}
        keyExtractor={(cat) => cat.id}
        isLoading={isLoading}
        emptyTitle="Aucune catégorie trouvée"
        emptyDescription="Aucune catégorie ne correspond à vos critères de recherche."
        actions={(cat) => (
          <div className="flex items-center justify-end space-x-1.5">
            {canUpdate && (
              <button
                onClick={() => {
                  setEditingCategory(cat);
                  setModalError(null);
                }}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 transition-colors"
                title="Modifier la catégorie"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && cat.is_active && (
              <button
                onClick={() => setDeactivatingCategory(cat)}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 transition-colors border border-rose-500/20"
                title="Désactiver la catégorie"
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
        title="Ajouter une catégorie"
        subtitle="Saisissez les informations de la nouvelle famille d'articles"
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
          <FormField label="Code de la catégorie" required>
            <input
              type="text"
              required
              placeholder="ex. CAT-ELEC"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
            />
          </FormField>

          <FormField label="Nom de la catégorie" required>
            <input
              type="text"
              required
              placeholder="ex. Électronique & Automatisme"
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
      {editingCategory && (
        <Modal
          isOpen={!!editingCategory}
          onClose={() => setEditingCategory(null)}
          title="Modifier la catégorie"
          subtitle={`Modification des informations de ${editingCategory.name}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingCategory(null)}
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
            <FormField label="Code de la catégorie" required>
              <input
                type="text"
                required
                value={editingCategory.code}
                onChange={(e) => setEditingCategory({ ...editingCategory, code: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2 bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-slate-900 dark:text-slate-100 text-xs focus:outline-none focus:border-pesage-blue font-mono"
              />
            </FormField>

            <FormField label="Nom de la catégorie" required>
              <input
                type="text"
                required
                value={editingCategory.name}
                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={3}
                value={editingCategory.description || ''}
                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="cat_is_active"
                checked={editingCategory.is_active}
                onChange={(e) => setEditingCategory({ ...editingCategory, is_active: e.target.checked })}
                className="rounded bg-slate-50 dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-pesage-blue focus:ring-0 cursor-pointer"
              />
              <label htmlFor="cat_is_active" className="text-xs text-slate-700 dark:text-slate-300 font-semibold cursor-pointer">
                Catégorie active
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingCategory}
        onClose={() => setDeactivatingCategory(null)}
        onConfirm={handleConfirmDeactivate}
        title="Désactiver la catégorie"
        message={`Êtes-vous sûr de vouloir désactiver la catégorie "${deactivatingCategory?.name}" ? Cette action désactivera également la catégorie dans les formulaires de sélection.`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isLoading={isSubmitting}
      />
    </div>
  );
};
