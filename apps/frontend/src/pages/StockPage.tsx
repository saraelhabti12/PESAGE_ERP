import React, { useEffect, useState } from 'react';
import {
  Boxes,
  Search,
  RotateCw,
  AlertTriangle,
  ArrowRightLeft,
  History,
  ClipboardList,
  SlidersHorizontal,
  DollarSign,
  PackageCheck,
  PackageX,
  PlusCircle,
  X,
  AlertCircle,
  TrendingDown,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { StockBalance, StockStats, StockAdjustmentCreate, StockThresholdUpdate } from '../types/stock';
import { Warehouse } from '../types/warehouse';
import { STOCK_STATUS_LABELS } from '../constants/stock';

export const StockPage: React.FC = () => {
  const [stockBalances, setStockBalances] = useState<StockBalance[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [stats, setStats] = useState<StockStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Adjustment Modal
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState<boolean>(false);
  const [selectedBalanceForAdjust, setSelectedBalanceForAdjust] = useState<StockBalance | null>(null);
  const [adjustFormData, setAdjustFormData] = useState<StockAdjustmentCreate>({
    product_id: 0,
    warehouse_id: 0,
    new_quantity: 0,
    reason: '',
  });
  const [adjustError, setAdjustError] = useState<string | null>(null);
  const [isSavingAdjust, setIsSavingAdjust] = useState<boolean>(false);

  // Threshold Modal
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState<boolean>(false);
  const [selectedBalanceForThreshold, setSelectedBalanceForThreshold] = useState<StockBalance | null>(null);
  const [thresholdFormData, setThresholdFormData] = useState<StockThresholdUpdate>({
    minimum_quantity: null,
    maximum_quantity: null,
  });
  const [thresholdError, setThresholdError] = useState<string | null>(null);
  const [isSavingThreshold, setIsSavingThreshold] = useState<boolean>(false);

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Fetch Warehouses for dropdown
      const whRes = await api.get<Warehouse[]>('/api/v1/warehouses');
      setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);

      // 2. Fetch Stock Stats
      const statsRes = await api.get<StockStats>('/api/v1/stock/stats');
      setStats(statsRes.data);

      // 3. Fetch Stock Balances
      const params: Record<string, string | number> = { size: 100 };
      if (warehouseFilter) params.warehouse_id = Number(warehouseFilter);
      if (statusFilter) params.status = statusFilter;
      if (searchTerm) params.search = searchTerm;

      const stockRes = await api.get<StockBalance[]>('/api/v1/stock', { params });
      setStockBalances(Array.isArray(stockRes.data) ? stockRes.data : []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Impossible de charger les données de stock.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [warehouseFilter, statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Open Adjustment Modal
  const handleOpenAdjustModal = (balance: StockBalance) => {
    setSelectedBalanceForAdjust(balance);
    setAdjustFormData({
      product_id: balance.product_id,
      warehouse_id: balance.warehouse_id,
      new_quantity: balance.quantity,
      reason: '',
    });
    setAdjustError(null);
    setIsAdjustModalOpen(true);
  };

  const handleSaveAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustFormData.reason.trim()) {
      setAdjustError('Le motif du réajustement de stock est obligatoire.');
      return;
    }

    setIsSavingAdjust(true);
    setAdjustError(null);
    try {
      await api.post('/api/v1/stock/adjustments', adjustFormData);
      setIsAdjustModalOpen(false);
      fetchData();
    } catch (err: any) {
      setAdjustError(getApiErrorMessage(err, "Erreur lors de l'ajustement de stock."));
    } finally {
      setIsSavingAdjust(false);
    }
  };

  // Open Threshold Modal
  const handleOpenThresholdModal = (balance: StockBalance) => {
    setSelectedBalanceForThreshold(balance);
    setThresholdFormData({
      minimum_quantity: balance.minimum_quantity ?? 0,
      maximum_quantity: balance.maximum_quantity ?? null,
    });
    setThresholdError(null);
    setIsThresholdModalOpen(true);
  };

  const handleSaveThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBalanceForThreshold) return;

    setIsSavingThreshold(true);
    setThresholdError(null);
    try {
      await api.put(`/api/v1/stock/${selectedBalanceForThreshold.id}/thresholds`, thresholdFormData);
      setIsThresholdModalOpen(false);
      fetchData();
    } catch (err: any) {
      setThresholdError(getApiErrorMessage(err, 'Erreur lors de la mise à jour des seuils.'));
    } finally {
      setIsSavingThreshold(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Gestion des Stocks</h1>
            <p className="text-sm text-slate-500">
              Niveaux en temps réel, disponibilités, valorisation et alertes d'approvisionnement
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Link
            to="/stock/transferts"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all shadow-sm"
          >
            <ArrowRightLeft className="w-4 h-4 text-purple-600" />
            Transferts
          </Link>
          <Link
            to="/stock/mouvements"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all shadow-sm"
          >
            <History className="w-4 h-4 text-blue-600" />
            Historique Mouvements
          </Link>
          <Link
            to="/stock/inventaires"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-blue-500/20"
          >
            <ClipboardList className="w-4 h-4" />
            Sessions d'Inventaire
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Valeur Totale Stock
            </span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {(stats?.total_stock_value || 0).toLocaleString('fr-FR', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span className="text-sm font-bold text-slate-500">DH</span>
          </div>
          <div className="text-xs text-slate-400 mt-1">Calculée selon Prix d'Achat HT</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Articles Gérés en Stock
            </span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <PackageCheck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-slate-900">
            {stats?.total_tracked_products || 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">Produits avec suivi d'inventaire actif</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Alertes Stock Faible
            </span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-amber-600">
            {stats?.low_stock_count || 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">Quantité ≤ Seuil d'Alerte Minimum</div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Ruptures Immédiates
            </span>
            <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
              <PackageX className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-black text-rose-600">
            {stats?.out_of_stock_count || 0}
          </div>
          <div className="text-xs text-slate-400 mt-1">Quantité disponible = 0</div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Rechercher par référence, désignation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </form>

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
            <option value="OUT_OF_STOCK">Rupture</option>
            <option value="LOW">Stock Faible</option>
            <option value="NORMAL">Normal</option>
            <option value="OVERSTOCK">Surstock</option>
          </select>

          <button
            onClick={fetchData}
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
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Article / Référence</th>
                <th className="px-6 py-4">Dépôt</th>
                <th className="px-6 py-4 text-center">Quantité Réelle</th>
                <th className="px-6 py-4 text-center">Réservée</th>
                <th className="px-6 py-4 text-center">Disponible</th>
                <th className="px-6 py-4 text-right">Valeur Stock</th>
                <th className="px-6 py-4 text-center">Statut</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Chargement des niveaux de stock...
                  </td>
                </tr>
              ) : stockBalances.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <Boxes className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Aucun enregistrement de stock trouvé.
                  </td>
                </tr>
              ) : (
                stockBalances.map((b) => (
                  <tr key={b.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-mono font-bold text-blue-600 text-xs">
                        {b.product?.sku}
                      </div>
                      <div className="font-semibold text-slate-900 mt-0.5">
                        {b.product?.designation}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                        <WarehouseIcon className="w-3 h-3 text-slate-500" />
                        {b.warehouse?.code} — {b.warehouse?.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center font-bold text-slate-900">
                      {b.quantity}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        {b.product?.unit?.abbreviation || 'U'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center font-medium text-amber-600">
                      {b.reserved_quantity > 0 ? b.reserved_quantity : '—'}
                    </td>
                    <td className="px-6 py-4 text-center font-black text-slate-900">
                      <span
                        className={
                          b.available_quantity === 0
                            ? 'text-rose-600'
                            : b.available_quantity <= (b.minimum_quantity || 0)
                            ? 'text-amber-600'
                            : 'text-emerald-700'
                        }
                      >
                        {b.available_quantity}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right font-semibold text-slate-900 font-mono">
                      {b.valuation.toLocaleString('fr-FR', {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{' '}
                      <span className="text-xs text-slate-400">DH</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs border ${
                          STOCK_STATUS_LABELS[b.status]?.badgeClass || 'bg-slate-50 text-slate-700'
                        }`}
                      >
                        {STOCK_STATUS_LABELS[b.status]?.label || b.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenAdjustModal(b)}
                          className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Ajuster la quantité physique"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleOpenThresholdModal(b)}
                          className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="Paramétrer les seuils d'alerte"
                        >
                          <AlertTriangle className="w-4 h-4" />
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

      {/* Quick Adjust Modal */}
      {isAdjustModalOpen && selectedBalanceForAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <SlidersHorizontal className="w-5 h-5 text-blue-600" />
                <h2 className="text-lg font-bold text-slate-900">Ajustement de Stock</h2>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveAdjust} className="p-6 space-y-4">
              {adjustError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-xs font-mono font-bold text-blue-600">
                  {selectedBalanceForAdjust.product?.sku}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedBalanceForAdjust.product?.designation}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Dépôt: {selectedBalanceForAdjust.warehouse?.name} | Quantité actuelle:{' '}
                  <span className="font-bold text-slate-900">{selectedBalanceForAdjust.quantity}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nouvelle Quantité Réelle en Stock *
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={adjustFormData.new_quantity}
                  onChange={(e) =>
                    setAdjustFormData({ ...adjustFormData, new_quantity: parseFloat(e.target.value) || 0 })
                  }
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 font-bold text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Motif de l'Ajustement (Audit Log) *
                </label>
                <textarea
                  rows={3}
                  value={adjustFormData.reason}
                  onChange={(e) => setAdjustFormData({ ...adjustFormData, reason: e.target.value })}
                  placeholder="Ex: Comptage physique, correction casse, perte matériel..."
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingAdjust}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  {isSavingAdjust ? 'Enregistrement...' : 'Valider Ajustement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Threshold Modal */}
      {isThresholdModalOpen && selectedBalanceForThreshold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <AlertTriangle className="w-5 h-5 text-amber-600" />
                <h2 className="text-lg font-bold text-slate-900">Seuils d'Alerte & Stock</h2>
              </div>
              <button
                onClick={() => setIsThresholdModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveThreshold} className="p-6 space-y-4">
              {thresholdError && (
                <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{thresholdError}</span>
                </div>
              )}

              <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80">
                <div className="text-xs font-mono font-bold text-blue-600">
                  {selectedBalanceForThreshold.product?.sku}
                </div>
                <div className="text-sm font-semibold text-slate-900">
                  {selectedBalanceForThreshold.product?.designation}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Dépôt: {selectedBalanceForThreshold.warehouse?.name}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seuil Minimum d'Alerte (Stock Faible)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={thresholdFormData.minimum_quantity ?? ''}
                  onChange={(e) =>
                    setThresholdFormData({
                      ...thresholdFormData,
                      minimum_quantity: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 5"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  Seuil Maximum (Surstock)
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={thresholdFormData.maximum_quantity ?? ''}
                  onChange={(e) =>
                    setThresholdFormData({
                      ...thresholdFormData,
                      maximum_quantity: e.target.value ? parseFloat(e.target.value) : null,
                    })
                  }
                  placeholder="Ex: 100"
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsThresholdModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSavingThreshold}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm"
                >
                  {isSavingThreshold ? 'Enregistrement...' : 'Enregistrer Seuils'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
