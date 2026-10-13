import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  Plus,
  RotateCw,
  Search,
  CheckCircle2,
  XCircle,
  Play,
  ArrowRight,
  Warehouse as WarehouseIcon,
  AlertCircle,
  X,
  FileText,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { InventorySession, InventorySessionCreate } from '../types/inventory';
import { Warehouse } from '../types/warehouse';
import { INVENTORY_STATUS_LABELS } from '../constants/stock';

export const InventoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<InventorySession[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create Modal
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [formData, setFormData] = useState<InventorySessionCreate>({
    warehouse_id: 0,
    notes: '',
  });
  const [modalError, setModalError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const whRes = await api.get<Warehouse[]>('/api/v1/warehouses');
      const whList = Array.isArray(whRes.data) ? whRes.data : [];
      setWarehouses(whList);

      const params: Record<string, string | number> = {};
      if (warehouseFilter) params.warehouse_id = Number(warehouseFilter);
      if (statusFilter) params.status = statusFilter;

      const res = await api.get<InventorySession[]>('/api/v1/inventory', { params });
      setSessions(Array.isArray(res.data) ? res.data : []);

      if (whList.length > 0 && formData.warehouse_id === 0) {
        setFormData((prev) => ({ ...prev, warehouse_id: whList[0].id }));
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Impossible de charger les sessions d'inventaire."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [warehouseFilter, statusFilter]);

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouse_id) {
      setModalError('Veuillez sélectionner un dépôt.');
      return;
    }

    setIsCreating(true);
    setModalError(null);
    try {
      const res = await api.post<InventorySession>('/api/v1/inventory', formData);
      setIsModalOpen(false);
      navigate(`/stock/inventaires/${res.data.id}`);
    } catch (err: any) {
      setModalError(getApiErrorMessage(err, "Erreur lors de la création de la session d'inventaire."));
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartSession = async (sessionId: number) => {
    try {
      await api.post(`/api/v1/inventory/${sessionId}/start`);
      fetchData();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Impossible de démarrer l'inventaire."));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Inventaires Physiques</h1>
            <p className="text-sm text-slate-500">
              Campagnes de comptage périodique, détection des écarts et ajustements automatiques
            </p>
          </div>
        </div>

        <button
          onClick={() => {
            setModalError(null);
            setIsModalOpen(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/20"
        >
          <Plus className="w-4 h-4" />
          Nouvel Inventaire
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="flex items-center gap-3 w-full md:w-auto flex-wrap">
          <select
            value={warehouseFilter}
            onChange={(e) => setWarehouseFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
          >
            <option value="">Tous les Dépôts</option>
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.code} — {w.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
          >
            <option value="">Tous les Statuts</option>
            <option value="DRAFT">Brouillon</option>
            <option value="IN_PROGRESS">En Cours</option>
            <option value="COMPLETED">Validé & Clôturé</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </div>

        <button
          onClick={fetchData}
          disabled={isLoading}
          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-50 rounded-xl border border-slate-200 transition-all self-end md:self-auto"
          title="Rafraîchir"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
        </button>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Sessions Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Référence</th>
                <th className="px-6 py-4">Dépôt</th>
                <th className="px-6 py-4">Date de Création</th>
                <th className="px-6 py-4 text-center">Nombre d'Articles</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Chargement des sessions d'inventaire...
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                    <ClipboardList className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Aucune session d'inventaire enregistrée.
                  </td>
                </tr>
              ) : (
                sessions.map((s) => {
                  const statusConf = INVENTORY_STATUS_LABELS[s.status] || {
                    label: s.status,
                    badgeClass: 'bg-slate-50 text-slate-700',
                  };
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-blue-600 text-xs">
                        {s.reference}
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                          <WarehouseIcon className="w-3 h-3 text-slate-500" />
                          {s.warehouse?.code} — {s.warehouse?.name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {new Date(s.created_at).toLocaleDateString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="px-6 py-4 text-center font-semibold text-slate-900">
                        {s.items?.length || 0}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs border font-semibold ${statusConf.badgeClass}`}
                        >
                          {statusConf.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {s.status === 'DRAFT' && (
                            <button
                              onClick={() => handleStartSession(s.id)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-lg text-xs font-semibold transition-colors"
                            >
                              <Play className="w-3 h-3" />
                              Démarrer
                            </button>
                          )}
                          <Link
                            to={`/stock/inventaires/${s.id}`}
                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-xs font-semibold transition-colors"
                          >
                            Ouvrir
                            <ArrowRight className="w-3 h-3" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create Inventory Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <ClipboardList className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Nouvelle Session d'Inventaire</h2>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} className="p-6 space-y-4">
              {modalError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{modalError}</span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Dépôt à Inventorier *
                </label>
                <select
                  value={formData.warehouse_id}
                  onChange={(e) => setFormData({ ...formData, warehouse_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-semibold text-slate-900"
                  required
                >
                  {warehouses.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} — {w.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-400 mt-1">
                  Tous les articles gérés en stock dans ce dépôt seront inclus dans la feuille de comptage.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Remarques & Notes de Campagne
                </label>
                <textarea
                  rows={3}
                  value={formData.notes || ''}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Ex: Inventaire semestriel pesage industriel..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-app-border">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-secondary text-sm px-4 py-2"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn-primary text-sm px-4 py-2"
                >
                  {isCreating ? 'Initialisation...' : 'Créer la Session'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
