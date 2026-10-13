import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Brand, BrandCreate, BrandUpdate } from '@/types/catalog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusFilter } from '@/components/ui/StatusFilter';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { Award, Plus, Edit2, Ban, CheckCircle2, Loader2 } from 'lucide-react';

export const BrandsPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [brands, setBrands] = useState<Brand[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState<Brand | null>(null);
  const [deactivatingBrand, setDeactivatingBrand] = useState<Brand | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState<BrandCreate>({ name: '', code: '', description: '' });

  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('brands.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('brands.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('brands.delete');

  const fetchBrands = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/brands?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<Brand[]>(url);
      setBrands(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger les marques.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/api/v1/brands', formData);
      showSuccess('Marque créée avec succès.');
      setIsCreateOpen(false);
      setFormData({ name: '', code: '', description: '' });
      fetchBrands();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la création de la marque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBrand) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const updateData: BrandUpdate = {
        name: editingBrand.name,
        code: editingBrand.code,
        description: editingBrand.description || undefined,
        is_active: editingBrand.is_active,
      };
      await api.put(`/api/v1/brands/${editingBrand.id}`, updateData);
      showSuccess('Marque mise à jour avec succès.');
      setEditingBrand(null);
      fetchBrands();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la mise à jour de la marque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingBrand) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/brands/${deactivatingBrand.id}`);
      showSuccess(`Marque "${deactivatingBrand.name}" désactivée avec succès.`);
      setDeactivatingBrand(null);
      fetchBrands();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de la désactivation de la marque.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Brand>[] = [
    {
      header: 'Code',
      accessor: (b) => <span className="font-mono text-purple-400 font-bold">{b.code}</span>,
      width: '140px',
    },
    {
      header: 'Nom de la marque',
      accessor: (b) => <span className="font-semibold text-slate-100">{b.name}</span>,
    },
    {
      header: 'Description',
      accessor: (b) => <span className="text-slate-400">{b.description || '-'}</span>,
    },
    {
      header: 'Statut',
      accessor: (b) =>
        b.is_active ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Actif</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
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
        title="Marques"
        subtitle="Référentiel des marques et fabricants d'équipements"
        icon={Award}
        action={
          canCreate
            ? {
                label: 'Ajouter une marque',
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
          placeholder="Rechercher une marque par nom ou code..."
        />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={brands}
        keyExtractor={(b) => b.id}
        isLoading={isLoading}
        emptyTitle="Aucune marque trouvée"
        emptyDescription="Aucune marque ne correspond à vos critères de recherche."
        actions={(b) => (
          <div className="flex items-center justify-end space-x-1.5">
            {canUpdate && (
              <button
                onClick={() => {
                  setEditingBrand(b);
                  setModalError(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Modifier"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && b.is_active && (
              <button
                onClick={() => setDeactivatingBrand(b)}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20"
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
        title="Ajouter une marque"
        subtitle="Informations sur la marque du fabricant"
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
              <span>Enregistrer</span>
            </button>
          </>
        }
      >
        {modalError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <FormField label="Code de la marque" required>
            <input
              type="text"
              required
              placeholder="ex. BRAND-ABB"
              value={formData.code}
              onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
            />
          </FormField>

          <FormField label="Nom de la marque" required>
            <input
              type="text"
              required
              placeholder="ex. ABB Automation"
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
      {editingBrand && (
        <Modal
          isOpen={!!editingBrand}
          onClose={() => setEditingBrand(null)}
          title="Modifier la marque"
          subtitle={`Modification des informations de ${editingBrand.name}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingBrand(null)}
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
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {modalError}
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormField label="Code de la marque" required>
              <input
                type="text"
                required
                value={editingBrand.code}
                onChange={(e) => setEditingBrand({ ...editingBrand, code: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
              />
            </FormField>

            <FormField label="Nom de la marque" required>
              <input
                type="text"
                required
                value={editingBrand.name}
                onChange={(e) => setEditingBrand({ ...editingBrand, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={3}
                value={editingBrand.description || ''}
                onChange={(e) => setEditingBrand({ ...editingBrand, description: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="brand_is_active"
                checked={editingBrand.is_active}
                onChange={(e) => setEditingBrand({ ...editingBrand, is_active: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-brand-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="brand_is_active" className="text-xs text-slate-300 font-semibold cursor-pointer">
                Marque active
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingBrand}
        onClose={() => setDeactivatingBrand(null)}
        onConfirm={handleConfirmDeactivate}
        title="Désactiver la marque"
        message={`Êtes-vous sûr de vouloir désactiver la marque "${deactivatingBrand?.name}" ?`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isLoading={isSubmitting}
      />
    </div>
  );
};
