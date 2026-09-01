import React, { useEffect, useState } from 'react';
import {
  Building2,
  Plus,
  Search,
  CheckCircle2,
  XCircle,
  Edit2,
  Power,
  RotateCw,
  X,
  AlertCircle,
  Warehouse as WarehouseIcon,
  Info,
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { Warehouse, WarehouseCreate, WarehouseUpdate, WarehouseType } from '../types/warehouse';
import { WAREHOUSE_TYPE_LABELS } from '../constants/stock';

export const WarehousesPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [editingWarehouse, setEditingWarehouse] = useState<Warehouse | null>(null);
  const [formData, setFormData] = useState<WarehouseCreate>({
    code: '',
    name: '',
    type: 'WAREHOUSE',
    address: '',
    description: '',
    is_active: true,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Toggle Deactivate/Activate State
  const [togglingWarehouse, setTogglingWarehouse] = useState<Warehouse | null>(null);
  const [isToggling, setIsToggling] = useState<boolean>(false);

  const fetchWarehouses = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const params: Record<string, string> = {};
      if (typeFilter) params.type = typeFilter;
      const res = await api.get<Warehouse[]>('/api/v1/warehouses', { params });
      setWarehouses(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Impossible de charger la liste des dépôts.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWarehouses();
  }, [typeFilter]);

  const handleOpenCreateModal = () => {
    setEditingWarehouse(null);
    setFormData({
      code: '',
      name: '',
      type: 'WAREHOUSE',
      address: '',
      description: '',
      is_active: true,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (wh: Warehouse) => {
    setEditingWarehouse(wh);
    setFormData({
      code: wh.code,
      name: wh.name,
      type: wh.type,
      address: wh.address || '',
      description: wh.description || '',
      is_active: wh.is_active,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.code.trim()) {
      setFormError('Veuillez renseigner le code et le nom du dépôt.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editingWarehouse) {
        const updatePayload: WarehouseUpdate = {
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          type: formData.type,
          address: formData.address?.trim() || null,
          description: formData.description?.trim() || null,
          is_active: formData.is_active,
        };
        await api.put(`/api/v1/warehouses/${editingWarehouse.id}`, updatePayload);
      } else {
        await api.post('/api/v1/warehouses', {
          ...formData,
          code: formData.code.trim().toUpperCase(),
          name: formData.name.trim(),
          address: formData.address?.trim() || null,
          description: formData.description?.trim() || null,
        });
      }
      setIsModalOpen(false);
      fetchWarehouses();
    } catch (err: any) {
      setFormError(getApiErrorMessage(err, "Erreur lors de l'enregistrement du dépôt."));
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmToggleActive = async () => {
    if (!togglingWarehouse) return;
    setIsToggling(true);
    setError(null);
    try {
      await api.patch(`/api/v1/warehouses/${togglingWarehouse.id}/toggle-active`);
      setTogglingWarehouse(null);
      fetchWarehouses();
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Erreur lors du changement de statut du dépôt.'));
    } finally {
      setIsToggling(false);
    }
  };

  const filteredWarehouses = warehouses.filter((wh) => {
    const term = searchTerm.toLowerCase();
    return (
      wh.name.toLowerCase().includes(term) ||
      wh.code.toLowerCase().includes(term) ||
      (wh.address && wh.address.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
            <WarehouseIcon className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Dépôts & Entrepôts</h1>
            <p className="text-sm text-slate-500">
              Gestion multi-dépôts, ateliers techniques et points de stockage Pesage 2000
            </p>
          </div>
        </div>
        <button
          onClick={handleOpenCreateModal}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Nouveau Dépôt
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par code, nom, adresse..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
          >
            <option value="">Tous les types de dépôts</option>
            <option value="MAIN">Principal</option>
            <option value="WAREHOUSE">Entrepôt</option>
            <option value="WORKSHOP">Atelier</option>
            <option value="VEHICLE">Véhicule Technique</option>
            <option value="OTHER">Autre</option>
          </select>

          <button
            onClick={fetchWarehouses}
            disabled={isLoading}
            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all"
            title="Rafraîchir"
          >
            <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Warehouse Grid / Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Nom du Dépôt</th>
                <th className="px-6 py-4">Type</th>
                <th className="px-6 py-4">Emplacement / Adresse</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Chargement des dépôts...
                  </td>
                </tr>
              ) : filteredWarehouses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <Building2 className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Aucun dépôt trouvé.
                  </td>
                </tr>
              ) : (
                filteredWarehouses.map((wh) => (
                  <tr key={wh.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4 font-mono font-bold text-blue-600 text-xs">
                      {wh.code}
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900">
                      <div>{wh.name}</div>
                      {wh.description && (
                        <div className="text-xs text-slate-400 font-normal mt-0.5">
                          {wh.description}
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium border ${
                          WAREHOUSE_TYPE_LABELS[wh.type]?.color || 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {WAREHOUSE_TYPE_LABELS[wh.type]?.label || wh.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-600 max-w-xs truncate">
                      {wh.address || '—'}
                    </td>
                    <td className="px-6 py-4">
                      {wh.is_active ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3" />
                          Actif
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          <XCircle className="w-3 h-3" />
                          Inactif
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(wh)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Modifier le dépôt"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setTogglingWarehouse(wh)}
                          className={`p-1.5 rounded-lg transition-colors ${
                            wh.is_active
                              ? 'text-slate-400 hover:text-rose-600 hover:bg-rose-50'
                              : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                          }`}
                          title={wh.is_active ? 'Désactiver le dépôt' : 'Réactiver le dépôt'}
                        >
                          <Power className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <WarehouseIcon className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">
                  {editingWarehouse ? 'Modifier le Dépôt' : 'Ajouter un Nouveau Dépôt'}
                </h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Code Dépôt *
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Ex: MAG-001"
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 uppercase font-mono font-semibold"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    Type de Dépôt *
                  </label>
                  <select
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as WarehouseType })}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  >
                    <option value="MAIN">Principal</option>
                    <option value="WAREHOUSE">Entrepôt</option>
                    <option value="WORKSHOP">Atelier</option>
                    <option value="VEHICLE">Véhicule Technique</option>
                    <option value="OTHER">Autre</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nom du Dépôt *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Entrepôt Ain Sebaa"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-medium text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Emplacement / Adresse
                </label>
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Ex: Zone Industrielle, Lot 45, Casablanca"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Description / Remarques
                </label>
                <textarea
                  rows={2}
                  value={formData.description || ''}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Notes logistiques, accès, responsable..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                />
                <label htmlFor="is_active" className="text-sm font-medium text-slate-700">
                  Dépôt actif pour les réceptions et mouvements de stock
                </label>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  {isSaving ? 'Enregistrement...' : editingWarehouse ? 'Mettre à jour' : 'Créer le Dépôt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deactivation / Reactivation */}
      {togglingWarehouse && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div
                className={`p-3 rounded-xl border ${
                  togglingWarehouse.is_active
                    ? 'bg-rose-50 text-rose-600 border-rose-100'
                    : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                }`}
              >
                <Power className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {togglingWarehouse.is_active ? 'Désactiver le dépôt' : 'Réactiver le dépôt'}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {togglingWarehouse.code} — {togglingWarehouse.name}
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-600">
              {togglingWarehouse.is_active
                ? 'Êtes-vous sûr de vouloir désactiver ce dépôt ? Toutes les données historiques (mouvements, inventaires) resteront intactes, mais il ne sera plus proposé pour les nouveaux transferts ou réceptions.'
                : 'Êtes-vous sûr de vouloir réactiver ce dépôt ? Il sera à nouveau disponible pour toutes les opérations de stock.'}
            </p>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setTogglingWarehouse(null)}
                disabled={isToggling}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmToggleActive}
                disabled={isToggling}
                className={`px-4 py-2 text-white text-sm font-semibold rounded-xl transition-all shadow-sm ${
                  togglingWarehouse.is_active
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isToggling
                  ? 'Traitement...'
                  : togglingWarehouse.is_active
                  ? 'Désactiver'
                  : 'Réactiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
