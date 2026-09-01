import React, { useEffect, useState } from 'react';
import {
  ClipboardList,
  ArrowLeft,
  RotateCw,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Play,
  Save,
  Check,
  Warehouse as WarehouseIcon,
  FileSpreadsheet,
} from 'lucide-react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { InventorySession, InventoryItem } from '../types/inventory';
import { INVENTORY_STATUS_LABELS } from '../constants/stock';

export const InventoryDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<InventorySession | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Local state for counts
  const [counts, setCounts] = useState<Record<number, { counted: number; reason: string }>>({});
  const [isSavingCounts, setIsSavingCounts] = useState<boolean>(false);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [isCancelling, setIsCancelling] = useState<boolean>(false);

  const fetchSession = async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.get<InventorySession>(`/api/v1/inventory/${id}`);
      setSession(res.data);

      // Preload count values
      const initialCounts: Record<number, { counted: number; reason: string }> = {};
      res.data.items.forEach((item: InventoryItem) => {
        initialCounts[item.product_id] = {
          counted: item.counted_quantity !== null && item.counted_quantity !== undefined ? item.counted_quantity : item.system_quantity,
          reason: item.reason || '',
        };
      });
      setCounts(initialCounts);
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Impossible de charger la session d'inventaire."));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, [id]);

  const handleStartSession = async () => {
    if (!id) return;
    try {
      await api.post(`/api/v1/inventory/${id}/start`);
      setSuccessMessage("Session d'inventaire démarrée avec succès.");
      fetchSession();
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Erreur lors du démarrage.'));
    }
  };

  const handleUpdateCount = (productId: number, counted: number, reason: string) => {
    setCounts((prev) => ({
      ...prev,
      [productId]: { counted, reason },
    }));
  };

  const handleSaveAllCounts = async () => {
    if (!id || !session) return;
    setIsSavingCounts(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // Save item by item
      const savePromises = session.items.map((item: InventoryItem) => {
        const countData = counts[item.product_id];
        if (countData !== undefined) {
          return api.put(`/api/v1/inventory/${id}/items/${item.product_id}`, {
            product_id: item.product_id,
            counted_quantity: countData.counted,
            reason: countData.reason,
          });
        }
        return Promise.resolve();
      });

      await Promise.all(savePromises);
      setSuccessMessage('Comptages enregistrés avec succès.');
      fetchSession();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Erreur lors de l'enregistrement des comptages."));
    } finally {
      setIsSavingCounts(false);
    }
  };

  const handleValidateSession = async () => {
    if (!id) return;
    const confirmValidation = window.confirm(
      'Êtes-vous sûr de vouloir valider et clôturer cette session ?\n\nTous les écarts de stock seront automatiquement appliqués sous forme de mouvements d’ajustement de stock.'
    );
    if (!confirmValidation) return;

    setIsValidating(true);
    setError(null);
    setSuccessMessage(null);
    try {
      // First save all current counts
      await handleSaveAllCounts();
      await api.post(`/api/v1/inventory/${id}/validate`);
      setSuccessMessage('Inventaire validé et clôturé avec succès ! Les stocks ont été mis à jour.');
      fetchSession();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Erreur lors de la validation de l'inventaire."));
    } finally {
      setIsValidating(false);
    }
  };

  const handleCancelSession = async () => {
    if (!id) return;
    const confirmCancel = window.confirm('Êtes-vous sûr de vouloir annuler cette session ?');
    if (!confirmCancel) return;

    setIsCancelling(true);
    try {
      await api.post(`/api/v1/inventory/${id}/cancel`);
      fetchSession();
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Erreur lors de l'annulation."));
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-400">
        <RotateCw className="w-8 h-8 animate-spin mx-auto mb-3 text-blue-600" />
        Chargement de la feuille d'inventaire...
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-white p-12 rounded-2xl shadow-sm border border-slate-200 text-center text-slate-500">
        Session d'inventaire introuvable.
      </div>
    );
  }

  const isEditable = session.status === 'IN_PROGRESS';
  const statusConf = INVENTORY_STATUS_LABELS[session.status] || {
    label: session.status,
    badgeClass: 'bg-slate-50 text-slate-700',
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="flex items-center gap-3">
          <Link
            to="/stock/inventaires"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-xl transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 font-mono">{session.reference}</h1>
              <span
                className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold border ${statusConf.badgeClass}`}
              >
                {statusConf.label}
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                <WarehouseIcon className="w-3.5 h-3.5 text-blue-600" />
                {session.warehouse?.code} — {session.warehouse?.name}
              </span>
              <span>•</span>
              <span>
                Créé le{' '}
                {new Date(session.created_at).toLocaleDateString('fr-FR', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {session.status === 'DRAFT' && (
            <button
              onClick={handleStartSession}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-amber-500/20"
            >
              <Play className="w-4 h-4" />
              Démarrer le Comptage
            </button>
          )}

          {isEditable && (
            <>
              <button
                onClick={handleSaveAllCounts}
                disabled={isSavingCounts}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors border border-slate-200"
              >
                <Save className="w-4 h-4" />
                {isSavingCounts ? 'Enregistrement...' : 'Enregistrer'}
              </button>

              <button
                onClick={handleValidateSession}
                disabled={isValidating}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl transition-all shadow-sm shadow-emerald-500/20"
              >
                <Check className="w-4 h-4" />
                {isValidating ? 'Validation...' : 'Valider & Clôturer'}
              </button>
            </>
          )}

          {session.status !== 'COMPLETED' && session.status !== 'CANCELLED' && (
            <button
              onClick={handleCancelSession}
              disabled={isCancelling}
              className="px-3 py-2 text-rose-600 hover:bg-rose-50 text-xs font-semibold rounded-xl border border-rose-200 transition-colors"
            >
              Annuler Session
            </button>
          )}
        </div>
      </div>

      {/* Success Alert */}
      {successMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 flex-shrink-0 text-emerald-600" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Counting Sheet Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        <div className="p-4 bg-slate-50/50 border-b border-slate-200/80 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-blue-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Feuille de Comptage des Articles ({session.items.length} articles)
            </span>
          </div>
          {session.notes && (
            <span className="text-xs text-slate-500 italic max-w-md truncate">
              Notes: {session.notes}
            </span>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50/80 text-xs uppercase font-semibold text-slate-500 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Article</th>
                <th className="px-6 py-4 text-center">Stock Théorique (Système)</th>
                <th className="px-6 py-4 text-center w-48">Comptage Physique</th>
                <th className="px-6 py-4 text-center">Écart Constaté</th>
                <th className="px-6 py-4">Motif / Justification Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {session.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    Aucun article dans ce dépôt au moment de l'initialisation de l'inventaire.
                  </td>
                </tr>
              ) : (
                session.items.map((item) => {
                  const currentCount =
                    counts[item.product_id]?.counted !== undefined
                      ? counts[item.product_id].counted
                      : item.counted_quantity ?? item.system_quantity;

                  const difference = currentCount - item.system_quantity;
                  const currentReason = counts[item.product_id]?.reason ?? item.reason ?? '';

                  return (
                    <tr key={item.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-mono font-bold text-blue-600 text-xs">
                          {item.product?.sku}
                        </div>
                        <div className="font-semibold text-slate-900 mt-0.5">
                          {item.product?.designation}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-bold text-slate-700">
                        {item.system_quantity}{' '}
                        <span className="text-xs font-normal text-slate-400">
                          {item.product?.unit?.abbreviation || 'U'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isEditable ? (
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={currentCount}
                            onChange={(e) =>
                              handleUpdateCount(
                                item.product_id,
                                parseFloat(e.target.value) || 0,
                                currentReason
                              )
                            }
                            className="w-28 text-center px-2 py-1.5 text-sm font-bold font-mono bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900"
                          />
                        ) : (
                          <span className="font-bold font-mono text-slate-900">
                            {item.counted_quantity !== null && item.counted_quantity !== undefined
                              ? item.counted_quantity
                              : '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center font-mono font-black">
                        {difference === 0 ? (
                          <span className="text-slate-400 font-normal">0</span>
                        ) : difference > 0 ? (
                          <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-xs">
                            +{difference}
                          </span>
                        ) : (
                          <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200 text-xs">
                            {difference}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {isEditable ? (
                          <input
                            type="text"
                            value={currentReason}
                            onChange={(e) =>
                              handleUpdateCount(item.product_id, currentCount, e.target.value)
                            }
                            placeholder="Motif de l'écart..."
                            className="w-full px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                          />
                        ) : (
                          <span className="text-xs text-slate-500">{item.reason || '—'}</span>
                        )}
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
