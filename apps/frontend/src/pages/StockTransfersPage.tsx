import React, { useEffect, useState } from 'react';
import {
  ArrowRightLeft,
  Warehouse as WarehouseIcon,
  Package,
  AlertCircle,
  CheckCircle2,
  RotateCw,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';
import { api, getApiErrorMessage } from '@/lib/api';
import { Product } from '../types/catalog';
import { Warehouse } from '../types/warehouse';
import { StockBalance, StockTransferCreate, StockTransferResponse } from '../types/stock';

export const StockTransfersPage: React.FC = () => {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingPrereqs, setIsLoadingPrereqs] = useState<boolean>(true);

  // Form State
  const [formData, setFormData] = useState<StockTransferCreate>({
    product_id: 0,
    source_warehouse_id: 0,
    dest_warehouse_id: 0,
    quantity: 1,
    reason: '',
  });

  // Source & Destination Balances (Strictly bound to selected product + warehouse)
  const [sourceBalance, setSourceBalance] = useState<StockBalance | null>(null);
  const [destBalance, setDestBalance] = useState<StockBalance | null>(null);
  const [isLoadingBalances, setIsLoadingBalances] = useState<boolean>(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successResult, setSuccessResult] = useState<StockTransferResponse | null>(null);

  const fetchPrerequisites = async () => {
    setIsLoadingPrereqs(true);
    setError(null);
    try {
      // 1. Fetch active warehouses
      const whRes = await api.get<Warehouse[]>('/api/v1/warehouses', {
        params: { is_active: true },
      });
      const whList = Array.isArray(whRes.data) ? whRes.data : [];
      setWarehouses(whList);

      // 2. Fetch tracked products
      const prodRes = await api.get<Product[]>('/api/v1/products', {
        params: { is_active: true, size: 200 },
      });
      const prodList = Array.isArray(prodRes.data)
        ? prodRes.data.filter((p: Product) => p.track_stock)
        : [];
      setProducts(prodList);

      if (whList.length >= 2) {
        setFormData((prev) => ({
          ...prev,
          source_warehouse_id: whList[0].id,
          dest_warehouse_id: whList[1].id,
          product_id: prodList.length > 0 ? prodList[0].id : 0,
        }));
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Impossible de charger les données nécessaires.'));
    } finally {
      setIsLoadingPrereqs(false);
    }
  };

  useEffect(() => {
    fetchPrerequisites();
  }, []);

  // Fetch balances whenever product or warehouses change
  useEffect(() => {
    let isMounted = true;

    if (!formData.product_id || !formData.source_warehouse_id || !formData.dest_warehouse_id) {
      setSourceBalance(null);
      setDestBalance(null);
      return;
    }

    // Immediately clear stale state when product or warehouses change
    setSourceBalance(null);
    setDestBalance(null);
    setIsLoadingBalances(true);

    const fetchExactBalances = async () => {
      try {
        const [srcRes, dstRes] = await Promise.all([
          api.get<StockBalance>('/api/v1/stock/balance', {
            params: {
              product_id: formData.product_id,
              warehouse_id: formData.source_warehouse_id,
            },
          }),
          api.get<StockBalance>('/api/v1/stock/balance', {
            params: {
              product_id: formData.product_id,
              warehouse_id: formData.dest_warehouse_id,
            },
          }),
        ]);

        if (isMounted) {
          setSourceBalance(srcRes.data);
          setDestBalance(dstRes.data);
        }
      } catch (err: any) {
        if (isMounted) {
          setSourceBalance(null);
          setDestBalance(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingBalances(false);
        }
      }
    };

    fetchExactBalances();

    return () => {
      isMounted = false;
    };
  }, [formData.product_id, formData.source_warehouse_id, formData.dest_warehouse_id]);

  const selectedProduct = products.find((p) => p.id === formData.product_id);
  const unitSymbol =
    selectedProduct?.unit?.abbreviation ||
    selectedProduct?.unit?.name ||
    'U';

  const srcWh = warehouses.find((w) => w.id === formData.source_warehouse_id);
  const dstWh = warehouses.find((w) => w.id === formData.dest_warehouse_id);

  const srcQtyCurrent = sourceBalance ? sourceBalance.quantity : 0;
  const srcAvailCurrent = sourceBalance ? sourceBalance.available_quantity : 0;
  const srcQtyAfter = Math.max(0, srcQtyCurrent - formData.quantity);
  const dstQtyCurrent = destBalance ? destBalance.quantity : 0;
  const dstQtyAfter = dstQtyCurrent + formData.quantity;
  const isInsufficient = formData.quantity > srcAvailCurrent;

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessResult(null);

    if (formData.source_warehouse_id === formData.dest_warehouse_id) {
      setError('Le dépôt de départ et le dépôt de destination doivent être différents.');
      return;
    }

    if (!formData.product_id) {
      setError('Veuillez sélectionner un article à transférer.');
      return;
    }

    if (formData.quantity <= 0) {
      setError('La quantité à transférer doit être strictement positive.');
      return;
    }

    if (isInsufficient) {
      setError(
        `Quantité insuffisante dans le dépôt source (Disponible: ${srcAvailCurrent} ${unitSymbol}, Demandé: ${formData.quantity} ${unitSymbol}).`
      );
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<StockTransferResponse>('/api/v1/stock/transfers', formData);
      setSuccessResult(res.data);

      // Refetch exact balances after transfer
      const [srcRes, dstRes] = await Promise.all([
        api.get<StockBalance>('/api/v1/stock/balance', {
          params: {
            product_id: formData.product_id,
            warehouse_id: formData.source_warehouse_id,
          },
        }),
        api.get<StockBalance>('/api/v1/stock/balance', {
          params: {
            product_id: formData.product_id,
            warehouse_id: formData.dest_warehouse_id,
          },
        }),
      ]);

      setSourceBalance(srcRes.data);
      setDestBalance(dstRes.data);
    } catch (err: any) {
      setError(getApiErrorMessage(err, 'Erreur lors du transfert de stock.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <div className="p-3 bg-purple-50 text-purple-700 rounded-xl border border-purple-100">
          <ArrowRightLeft className="w-6 h-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Transfert Inter-Dépôts</h1>
          <p className="text-sm text-slate-500">
            Déplacement physique d'équipements et réapprovisionnement entre dépôts et ateliers
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {successResult && (
        <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-3.5 animate-in fade-in">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1 text-sm text-emerald-900">
            <div className="font-bold">Transfert effectué avec succès !</div>
            <div>
              <span className="font-semibold">
                {successResult.quantity_transferred} {unitSymbol}
              </span>{' '}
              transférés de <span className="font-semibold">{srcWh?.name}</span> vers{' '}
              <span className="font-semibold">{dstWh?.name}</span>.
            </div>
            <div className="text-xs text-emerald-700 font-mono pt-1">
              Nouveau stock source: {successResult.source_quantity} {unitSymbol} | Nouveau stock
              destination: {successResult.dest_quantity} {unitSymbol}
            </div>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-3 text-sm animate-in fade-in">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Main Transfer Form Card */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200/80">
        <form onSubmit={handleTransfer} className="space-y-6">
          {/* Article Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
              Article à Transférer *
            </label>
            <select
              value={formData.product_id}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  product_id: Number(e.target.value),
                })
              }
              className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-medium text-slate-900"
              required
            >
              <option value="0">-- Sélectionner un produit géré en stock --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.designation} (Unité:{' '}
                  {p.unit?.abbreviation || p.unit?.name || 'U'})
                </option>
              ))}
            </select>
          </div>

          {/* Warehouses Selection Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Source Warehouse */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <WarehouseIcon className="w-4 h-4 text-purple-600" />
                Dépôt de Départ (Source) *
              </div>
              <select
                value={formData.source_warehouse_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    source_warehouse_id: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 font-semibold text-slate-900"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Stock disponible actuel:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {isLoadingBalances ? (
                    <span className="text-slate-400 italic font-sans text-xs">Chargement...</span>
                  ) : (
                    `${srcAvailCurrent} ${unitSymbol}`
                  )}
                </span>
              </div>
            </div>

            {/* Destination Warehouse */}
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wider">
                <WarehouseIcon className="w-4 h-4 text-emerald-600" />
                Dépôt d'Arrivée (Destination) *
              </div>
              <select
                value={formData.dest_warehouse_id}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    dest_warehouse_id: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 font-semibold text-slate-900"
                required
              >
                {warehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>

              <div className="pt-2 border-t border-slate-200 flex items-center justify-between text-xs">
                <span className="text-slate-500">Stock actuel:</span>
                <span className="font-bold text-slate-900 font-mono text-sm">
                  {isLoadingBalances ? (
                    <span className="text-slate-400 italic font-sans text-xs">Chargement...</span>
                  ) : (
                    `${dstQtyCurrent} ${unitSymbol}`
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Quantity & Reason */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Quantité à Transférer ({unitSymbol}) *
              </label>
              <input
                type="number"
                min="0.01"
                step="any"
                value={formData.quantity}
                onChange={(e) =>
                  setFormData({ ...formData, quantity: parseFloat(e.target.value) || 0 })
                }
                className={`w-full px-3.5 py-2.5 text-sm bg-slate-50 border rounded-xl focus:bg-white focus:outline-none focus:ring-2 font-bold text-slate-900 text-lg ${
                  isInsufficient
                    ? 'border-rose-300 focus:ring-rose-500/20 focus:border-rose-500 text-rose-900'
                    : 'border-slate-200 focus:ring-purple-500/20 focus:border-purple-500'
                }`}
                required
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Motif / Justification du Transfert
              </label>
              <input
                type="text"
                value={formData.reason || ''}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                placeholder="Ex: Réapprovisionnement stock atelier, intervention urgente..."
                className="w-full px-3.5 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
              />
            </div>
          </div>

          {/* Visual Preview Card */}
          {selectedProduct && (
            <div
              className={`p-4 rounded-xl border space-y-3 transition-all ${
                isInsufficient
                  ? 'bg-rose-50/70 border-rose-200'
                  : 'bg-purple-50/50 border-purple-100'
              }`}
            >
              <div className="flex items-center justify-between">
                <div
                  className={`text-xs font-bold uppercase tracking-wider ${
                    isInsufficient ? 'text-rose-900' : 'text-purple-900'
                  }`}
                >
                  Aperçu Simulation Avant / Après Transfert
                </div>
                {isInsufficient && (
                  <div className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700 bg-rose-100/80 px-2.5 py-1 rounded-full">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Stock insuffisant dans le dépôt source
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                {/* Source Simulation */}
                <div
                  className={`bg-white p-3 rounded-lg border flex items-center justify-between ${
                    isInsufficient ? 'border-rose-200' : 'border-purple-100'
                  }`}
                >
                  <div>
                    <div className="font-sans font-bold text-slate-700">{srcWh?.name}</div>
                    <div className="text-slate-400">Stock Source</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">
                      {srcQtyCurrent} {unitSymbol}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-rose-500" />
                    <span
                      className={`font-bold text-sm ${
                        isInsufficient ? 'text-rose-600' : 'text-slate-900'
                      }`}
                    >
                      {srcQtyAfter} {unitSymbol}
                    </span>
                  </div>
                </div>

                {/* Destination Simulation */}
                <div className="bg-white p-3 rounded-lg border border-purple-100 flex items-center justify-between">
                  <div>
                    <div className="font-sans font-bold text-slate-700">{dstWh?.name}</div>
                    <div className="text-slate-400">Stock Destination</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">
                      {dstQtyCurrent} {unitSymbol}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="font-bold text-emerald-600 text-sm">
                      {dstQtyAfter} {unitSymbol}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSubmitting || isLoadingPrereqs || isLoadingBalances || isInsufficient}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white font-semibold text-sm rounded-xl transition-all shadow-sm shadow-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RotateCw className="w-4 h-4 animate-spin" />
                  Traitement du transfert...
                </>
              ) : isInsufficient ? (
                <>
                  <AlertTriangle className="w-4 h-4" />
                  Stock Disponible Insuffisant
                </>
              ) : (
                <>
                  <ArrowRightLeft className="w-4 h-4" />
                  Exécuter le Transfert
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
