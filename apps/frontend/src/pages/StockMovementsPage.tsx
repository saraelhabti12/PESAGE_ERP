import React, { useEffect, useState } from 'react';
import {
  History,
  Search,
  RotateCw,
  Warehouse as WarehouseIcon,
  ArrowUpRight,
  ArrowDownLeft,
  Calendar,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { StockMovement, StockMovementType } from '../types/stock';
import { Warehouse } from '../types/warehouse';
import { MOVEMENT_TYPE_CONFIG } from '../constants/stock';

export const StockMovementsPage: React.FC = () => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [warehouseFilter, setWarehouseFilter] = useState<string>('');
  const [movementTypeFilter, setMovementTypeFilter] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const fetchMovements = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const whRes = await api.get<Warehouse[]>('/api/v1/warehouses');
      setWarehouses(Array.isArray(whRes.data) ? whRes.data : []);

      const params: Record<string, string | number> = { size: 100 };
      if (warehouseFilter) params.warehouse_id = Number(warehouseFilter);
      if (movementTypeFilter) params.movement_type = movementTypeFilter;

      const res = await api.get<StockMovement[]>('/api/v1/stock/movements', { params });
      setMovements(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Impossible de charger les mouvements de stock.'));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMovements();
  }, [warehouseFilter, movementTypeFilter]);

  const filteredMovements = movements.filter((m) => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      m.product?.sku?.toLowerCase().includes(term) ||
      m.product?.designation?.toLowerCase().includes(term) ||
      (m.reason && m.reason.toLowerCase().includes(term)) ||
      (m.reference_type && m.reference_type.toLowerCase().includes(term))
    );
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-50 text-blue-700 rounded-xl border border-blue-100">
            <History className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Mouvements & Traçabilité Stock</h1>
            <p className="text-sm text-slate-500">
              Journal d'audit immuable des flux, réceptions, transferts, ventes et ajustements
            </p>
          </div>
        </div>

        <button
          onClick={fetchMovements}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 text-sm font-semibold rounded-xl border border-slate-200 transition-all shadow-sm"
        >
          <RotateCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-600' : ''}`} />
          Actualiser
        </button>
      </div>

      {/* Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200/80 flex flex-col md:flex-row gap-3 items-center justify-between">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Filtrer par article, motif, référence..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
          />
        </div>

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
            value={movementTypeFilter}
            onChange={(e) => setMovementTypeFilter(e.target.value)}
            className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-700"
          >
            <option value="">Tous les Types de Mouvements</option>
            <option value="PURCHASE_RECEIPT">Réception Achat</option>
            <option value="TRANSFER_IN">Transfert Entrant</option>
            <option value="TRANSFER_OUT">Transfert Sortant</option>
            <option value="ADJUSTMENT_IN">Ajustement (+)</option>
            <option value="ADJUSTMENT_OUT">Ajustement (-)</option>
            <option value="RETURN_IN">Retour Client</option>
            <option value="RETURN_OUT">Retour Fournisseur</option>
            <option value="MANUAL_IN">Entrée Manuelle</option>
            <option value="MANUAL_OUT">Sortie Manuelle</option>
          </select>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Movements Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Date & Heure</th>
                <th className="px-6 py-4">Type de Flux</th>
                <th className="px-6 py-4">Article</th>
                <th className="px-6 py-4">Dépôt</th>
                <th className="px-6 py-4 text-center">Quantité Flux</th>
                <th className="px-6 py-4 text-center">Avant / Après</th>
                <th className="px-6 py-4">Motif & Référence</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <RotateCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-500" />
                    Chargement de l'audit log...
                  </td>
                </tr>
              ) : filteredMovements.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                    <History className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    Aucun mouvement enregistré.
                  </td>
                </tr>
              ) : (
                filteredMovements.map((m) => {
                  const config = MOVEMENT_TYPE_CONFIG[m.movement_type] || {
                    label: m.movement_type,
                    direction: '+',
                    badgeClass: 'bg-slate-50 text-slate-700',
                  };
                  return (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500 font-mono">
                        {new Date(m.created_at).toLocaleString('fr-FR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border ${config.badgeClass}`}
                        >
                          {config.direction === '+' ? (
                            <ArrowDownLeft className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <ArrowUpRight className="w-3.5 h-3.5 text-rose-600" />
                          )}
                          {config.label}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-blue-600 text-xs">
                          {m.product?.sku}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5 max-w-xs truncate">
                          {m.product?.designation}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
                          <WarehouseIcon className="w-3 h-3 text-slate-500" />
                          {m.warehouse?.code}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`font-black font-mono text-sm ${
                            config.direction === '+' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {config.direction === '+' ? '+' : '-'}
                          {m.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center text-xs font-mono text-slate-500">
                        <span>{m.quantity_before}</span>
                        <span className="mx-1.5 text-slate-300">→</span>
                        <span className="font-bold text-slate-900">{m.quantity_after}</span>
                      </td>
                      <td className="px-6 py-4">
                        {m.reference_type && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono mb-0.5">
                            <FileText className="w-3 h-3" />
                            {m.reference_type} #{m.reference_id}
                          </span>
                        )}
                        <div className="text-xs text-slate-600 mt-0.5">
                          {m.reason || '—'}
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
    </div>
  );
};
