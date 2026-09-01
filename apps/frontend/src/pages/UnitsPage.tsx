import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Unit, UnitCreate, UnitUpdate } from '@/types/catalog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusFilter } from '@/components/ui/StatusFilter';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { Scale, Plus, Edit2, Ban, CheckCircle2, Loader2 } from 'lucide-react';

export const UnitsPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [units, setUnits] = useState<Unit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const [deactivatingUnit, setDeactivatingUnit] = useState<Unit | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState<UnitCreate>({ name: '', abbreviation: '', description: '' });

  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('units.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('units.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('units.delete');

  const fetchUnits = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/units?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<Unit[]>(url);
      setUnits(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger les unités de mesure.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  useEffect(() => {
    fetchUnits();
  }, [fetchUnits]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/api/v1/units', formData);
      showSuccess('Unité de mesure créée avec succès.');
      setIsCreateOpen(false);
      setFormData({ name: '', abbreviation: '', description: '' });
      fetchUnits();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la création de l\'unité.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUnit) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const updateData: UnitUpdate = {
        name: editingUnit.name,
        abbreviation: editingUnit.abbreviation,
        description: editingUnit.description || undefined,
        is_active: editingUnit.is_active,
      };
      await api.put(`/api/v1/units/${editingUnit.id}`, updateData);
      showSuccess('Unité de mesure mise à jour avec succès.');
      setEditingUnit(null);
      fetchUnits();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la mise à jour de l\'unité.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingUnit) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/units/${deactivatingUnit.id}`);
      showSuccess(`Unité de mesure "${deactivatingUnit.name}" désactivée avec succès.`);
      setDeactivatingUnit(null);
      fetchUnits();
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de la désactivation de l\'unité.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<Unit>[] = [
    {
      header: 'Nom de l\'unité',
      accessor: (u) => <span className="font-semibold text-slate-100">{u.name}</span>,
    },
    {
      header: 'Abréviation',
      accessor: (u) => <span className="font-mono text-cyan-400 font-bold">{u.abbreviation}</span>,
      width: '140px',
    },
    {
      header: 'Description',
      accessor: (u) => <span className="text-slate-400">{u.description || '-'}</span>,
    },
    {
      header: 'Statut',
      accessor: (u) =>
        u.is_active ? (
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
        title="Unités de mesure"
        subtitle="Unités standard pour le conditionnement et la gestion des stocks (Pièce, Kg, Mètre, Litre)"
        icon={Scale}
        action={
          canCreate
            ? {
                label: 'Ajouter une unité',
                onClick: () => {
                  setFormData({ name: '', abbreviation: '', description: '' });
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
          placeholder="Rechercher par nom ou abréviation..."
        />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={units}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
        emptyTitle="Aucune unité trouvée"
        emptyDescription="Aucune unité de mesure ne correspond à vos critères."
        actions={(u) => (
          <div className="flex items-center justify-end space-x-1.5">
            {canUpdate && (
              <button
                onClick={() => {
                  setEditingUnit(u);
                  setModalError(null);
                }}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Modifier"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && u.is_active && (
              <button
                onClick={() => setDeactivatingUnit(u)}
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
        title="Ajouter une unité de mesure"
        subtitle="Définition de l'unité de facturation et de stock"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
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
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <FormField label="Nom de l'unité" required>
            <input
              type="text"
              required
              placeholder="ex. Pièce / Kilogramme"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <FormField label="Abréviation" required>
            <input
              type="text"
              required
              placeholder="ex. Pcs / Kg / M"
              value={formData.abbreviation}
              onChange={(e) => setFormData({ ...formData, abbreviation: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
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
      {editingUnit && (
        <Modal
          isOpen={!!editingUnit}
          onClose={() => setEditingUnit(null)}
          title="Modifier l'unité de mesure"
          subtitle={`Modification des informations de ${editingUnit.name}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingUnit(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
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
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {modalError}
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <FormField label="Nom de l'unité" required>
              <input
                type="text"
                required
                value={editingUnit.name}
                onChange={(e) => setEditingUnit({ ...editingUnit, name: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Abréviation" required>
              <input
                type="text"
                required
                value={editingUnit.abbreviation}
                onChange={(e) => setEditingUnit({ ...editingUnit, abbreviation: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={3}
                value={editingUnit.description || ''}
                onChange={(e) => setEditingUnit({ ...editingUnit, description: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="unit_is_active"
                checked={editingUnit.is_active}
                onChange={(e) => setEditingUnit({ ...editingUnit, is_active: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-brand-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="unit_is_active" className="text-xs text-slate-300 font-semibold cursor-pointer">
                Unité de mesure active
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingUnit}
        onClose={() => setDeactivatingUnit(null)}
        onConfirm={handleConfirmDeactivate}
        title="Désactiver l'unité de mesure"
        message={`Êtes-vous sûr de vouloir désactiver l'unité de mesure "${deactivatingUnit?.name}" ?`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isLoading={isSubmitting}
      />
    </div>
  );
};
