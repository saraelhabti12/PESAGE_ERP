import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { Sale, SaleStatus } from '@/types/sales';
import { PageHeader } from '@/components/ui/PageHeader';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AttachmentsSection } from '@/components/common/AttachmentsSection';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { formatCurrency, formatDate } from '@/lib/formatters';

import { SaleOrderDocument } from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

import {
  ArrowLeft,
  ShoppingCart,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  Calendar,
  CreditCard,
  FileText,
  User,
  Package,
  Boxes,
  Printer,
  Trash2,
  AlertTriangle,
  Loader2,
  Info,
} from 'lucide-react';

export const SaleDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [sale, setSale] = useState<Sale | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);


  // RBAC checks
  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canConfirm = roleNames.includes('ADMIN') || userPerms.includes('sales.confirm');
  const canCancel = roleNames.includes('ADMIN') || userPerms.includes('sales.cancel');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('sales.delete');

  const fetchSale = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await api.get<Sale>(`/api/v1/sales/${id}`);
      setSale(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Vente introuvable.');
      navigate('/ventes');
    } finally {
      setIsLoading(false);
    }
  }, [id, showError, navigate]);

  useEffect(() => {
    fetchSale();
  }, [fetchSale]);

  const handleConfirm = async () => {
    if (!sale) return;
    setIsSubmitting(true);
    try {
      const res = await api.post<Sale>(`/api/v1/sales/${sale.id}/confirm`);
      setSale(res.data);
      showSuccess(`La vente ${sale.reference} a été confirmée avec succès. Les stocks ont été déduits.`);
      setIsConfirmOpen(false);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de la confirmation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!sale) return;
    setIsSubmitting(true);
    try {
      const res = await api.post<Sale>(`/api/v1/sales/${sale.id}/cancel`);
      setSale(res.data);
      showSuccess(`La vente ${sale.reference} a été annulée.`);
      setIsCancelOpen(false);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de l\'annulation.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!sale) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/sales/${sale.id}`);
      showSuccess(`La vente ${sale.reference} a été supprimée.`);
      setIsDeleteOpen(false);
      navigate('/ventes');
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Échec de la suppression.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderStatusBadge = (status: SaleStatus) => {
    switch (status) {
      case 'DRAFT':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Clock className="w-3.5 h-3.5" />
            Brouillon
          </span>
        );
      case 'CONFIRMED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Confirmée
          </span>
        );
      case 'CANCELLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
            <XCircle className="w-3.5 h-3.5" />
            Annulée
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-500/10 text-slate-600 border border-slate-500/20">
            {status}
          </span>
        );
    }
  };

  if (isLoading || !sale) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-pesage-blue" />
        <p className="text-xs text-app-text-muted">Chargement du détail de la vente...</p>
      </div>
    );
  }

  const grossTotal = sale.items.reduce(
    (acc, it) => acc + Number(it.quantity) * Number(it.unit_price_ht),
    0
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/ventes')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-app-text-muted hover:text-pesage-blue transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux ventes</span>
        </button>

        <div className="flex items-center gap-2">
          {sale.status === 'DRAFT' && canConfirm && (
            <button
              onClick={() => setIsConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Confirmer la vente</span>
            </button>
          )}

          {(sale.status === 'CONFIRMED' || sale.status === 'PARTIALLY_DELIVERED') && (
            <button
              onClick={() => navigate(`/livraisons?sale_id=${sale.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-pesage-blue text-white text-xs font-semibold hover:bg-pesage-blue-dark shadow-sm transition"
            >
              <Package className="w-4 h-4" />
              <span>Bon de Livraison</span>
            </button>
          )}

          {(sale.status === 'CONFIRMED' || sale.status === 'PARTIALLY_DELIVERED' || sale.status === 'DELIVERED') && (
            <button
              onClick={() => navigate(`/factures-vente?sale_id=${sale.id}`)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm transition"
            >
              <FileText className="w-4 h-4" />
              <span>Facturer</span>
            </button>
          )}

          {sale.status === 'DRAFT' && canCancel && (
            <button
              onClick={() => setIsCancelOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface border border-app-border text-rose-600 text-xs font-semibold hover:bg-rose-500/10 transition"
            >
              <XCircle className="w-4 h-4" />
              <span>Annuler</span>
            </button>
          )}

          {(sale.status === 'DRAFT' || sale.status === 'CANCELLED') && canDelete && (
            <button
              onClick={() => setIsDeleteOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Supprimer</span>
            </button>
          )}

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-app-surface border border-app-border text-xs font-semibold text-app-text-muted hover:bg-app-surface-hover transition cursor-pointer"
            title="Aperçu avant impression et export PDF"
          >
            <Printer className="w-4 h-4" />
            <span>Imprimer</span>
          </button>

        </div>
      </div>

      {/* Main Header Banner */}
      <div className="p-6 rounded-2xl bg-app-surface border border-app-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="p-3.5 rounded-2xl bg-pesage-blue/10 text-pesage-blue shrink-0">
            <ShoppingCart className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-app-text-primary font-mono">{sale.reference}</h1>
              {renderStatusBadge(sale.status)}
              {sale.quote_id && (
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-pesage-blue/10 text-pesage-blue border border-pesage-blue/20">
                  <FileText className="w-3 h-3" />
                  Devis d'origine #{sale.quote_id}
                </span>
              )}
            </div>
            <p className="text-xs text-app-text-muted mt-1">
              Créée le {formatDate(sale.created_at)} par {sale.creator?.first_name || ''} {sale.creator?.last_name || sale.creator?.email || 'Système'}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-app-text-muted block">Montant Total Net TTC</span>
          <span className="text-2xl font-black text-pesage-blue">{formatCurrency(sale.total_ttc)}</span>
        </div>
      </div>

      {/* Contextual Status Alert */}
      {sale.status === 'CONFIRMED' && (
        <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-3">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold">Vente confirmée & Mouvements de stock validés</p>
            <p className="text-emerald-700/80 dark:text-emerald-300/80">
              Cette vente est validée. Les sorties de stock ont été exécutées. Vous pouvez maintenant émettre le <strong>Bon de Livraison</strong> et générer la <strong>Facture</strong> correspondante.
            </p>
          </div>
        </div>
      )}

      {/* Grid: Customer Info & Order Details */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Customer Info Card */}
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-app-border">
            <Building2 className="w-4 h-4 text-pesage-blue" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">
              Informations Client
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div>
              <span className="text-app-text-muted block text-[11px]">Raison Sociale</span>
              <p className="font-semibold text-app-text-primary">{sale.customer?.legal_name || 'N/A'}</p>
              {sale.customer?.trade_name && (
                <p className="text-[11px] text-app-text-muted">Nom commercial : {sale.customer.trade_name}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-app-text-muted block text-[11px]">Code Client</span>
                <span className="font-mono text-app-text-primary">{sale.customer?.code || 'N/A'}</span>
              </div>
              {(sale.customer?.ice || sale.customer?.tax_id) && (
                <div>
                  <span className="text-app-text-muted block text-[11px]">ICE</span>
                  <span className="font-mono text-app-text-primary">{sale.customer?.ice || sale.customer?.tax_id}</span>
                </div>
              )}
            </div>

            {sale.customer?.phone && (
              <div>
                <span className="text-app-text-muted block text-[11px]">Téléphone</span>
                <span className="text-app-text-primary">{sale.customer.phone}</span>
              </div>
            )}

            {sale.customer?.email && (
              <div>
                <span className="text-app-text-muted block text-[11px]">Email</span>
                <span className="text-app-text-primary">{sale.customer.email}</span>
              </div>
            )}

            {sale.customer?.address && (
              <div>
                <span className="text-app-text-muted block text-[11px]">Adresse</span>
                <span className="text-app-text-primary">
                  {sale.customer.address}, {sale.customer.city || ''}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Order Details Card */}
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-app-border">
            <FileText className="w-4 h-4 text-pesage-orange" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">
              Détails de la commande
            </h3>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className="text-app-text-muted block text-[11px]">Date de commande</span>
                <span className="font-semibold text-app-text-primary">{formatDate(sale.order_date)}</span>
              </div>
              <div>
                <span className="text-app-text-muted block text-[11px]">Statut Vente</span>
                <span className="font-semibold text-app-text-primary">{sale.status}</span>
              </div>
            </div>

            <div>
              <span className="text-app-text-muted block text-[11px]">Mode de paiement</span>
              <span className="font-medium text-app-text-primary">{sale.payment_method || 'Non spécifié'}</span>
            </div>

            <div>
              <span className="text-app-text-muted block text-[11px]">Conditions de règlement</span>
              <span className="font-medium text-app-text-primary">{sale.payment_terms || 'Non spécifié'}</span>
            </div>

            {sale.notes && (
              <div className="p-2.5 rounded-lg bg-gray-50 dark:bg-gray-800/40 border border-app-border text-[11px] text-app-text-muted">
                <span className="font-semibold block mb-0.5 text-app-text-primary">Notes :</span>
                {sale.notes}
              </div>
            )}
          </div>
        </div>

        {/* Financial Recap Card */}
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 pb-3 border-b border-app-border">
              <CreditCard className="w-4 h-4 text-emerald-600" />
              <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">
                Récapitulatif Financier
              </h3>
            </div>

            <div className="space-y-2 text-xs mt-3">
              <div className="flex justify-between">
                <span className="text-app-text-muted">Total Brut HT</span>
                <span className="font-medium text-app-text-primary">{formatCurrency(grossTotal)}</span>
              </div>

              {Number(sale.discount_amount) > 0 && (
                <div className="flex justify-between text-emerald-600">
                  <span>Remise totale</span>
                  <span className="font-medium">-{formatCurrency(sale.discount_amount)}</span>
                </div>
              )}

              <div className="flex justify-between">
                <span className="text-app-text-muted">Sous-total Net HT</span>
                <span className="font-semibold text-app-text-primary">{formatCurrency(sale.subtotal_ht)}</span>
              </div>

              <div className="flex justify-between">
                <span className="text-app-text-muted">TVA</span>
                <span className="font-medium text-app-text-primary">{formatCurrency(sale.tax_amount)}</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-app-border flex justify-between items-center bg-pesage-blue/5 p-3 rounded-xl">
            <span className="text-xs font-bold text-app-text-primary">Total TTC</span>
            <span className="text-lg font-black text-pesage-blue">{formatCurrency(sale.total_ttc)}</span>
          </div>
        </div>
      </div>

      {/* Line Items Table */}
      <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-app-border">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-pesage-blue" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">
              Lignes d'articles ({sale.items.length})
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-gray-50/50 dark:bg-gray-800/30 text-app-text-muted uppercase text-[10px] tracking-wider border-b border-app-border">
              <tr>
                <th className="py-2.5 px-3 font-semibold">#</th>
                <th className="py-2.5 px-3 font-semibold">Produit</th>
                <th className="py-2.5 px-3 font-semibold">Dépôt source</th>
                <th className="py-2.5 px-3 font-semibold text-center">Gestion Stock</th>
                <th className="py-2.5 px-3 font-semibold text-right">Quantité</th>
                <th className="py-2.5 px-3 font-semibold text-right">Prix Unit. HT</th>
                <th className="py-2.5 px-3 font-semibold text-right">Remise %</th>
                <th className="py-2.5 px-3 font-semibold text-right">Sous-total HT</th>
                <th className="py-2.5 px-3 font-semibold text-right">TVA %</th>
                <th className="py-2.5 px-3 font-semibold text-right">Total TTC</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {sale.items.map((item, index) => (
                <tr key={item.id} className="hover:bg-app-surface-hover transition">
                  <td className="py-3 px-3 text-app-text-muted font-mono">{index + 1}</td>
                  <td className="py-3 px-3">
                    <p className="font-semibold text-app-text-primary">{item.product?.designation || `Produit #${item.product_id}`}</p>
                    <p className="font-mono text-[10px] text-app-text-muted">{item.product?.sku}</p>
                  </td>
                  <td className="py-3 px-3">
                    {item.product?.track_stock ? (
                      item.warehouse ? (
                        <div>
                          <p className="font-semibold text-app-text-primary">{item.warehouse.name}</p>
                          <p className="font-mono text-[10px] text-app-text-muted">{item.warehouse.code}</p>
                        </div>
                      ) : item.warehouse_id ? (
                        <span className="font-mono text-app-text-muted">Dépôt #{item.warehouse_id}</span>
                      ) : (
                        <span className="text-rose-500 italic text-[11px]">Non spécifié</span>
                      )
                    ) : (
                      <span className="text-app-text-muted italic text-[11px]">—</span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-center">
                    {item.product?.track_stock ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-md bg-pesage-blue/10 text-pesage-blue">
                        <Boxes className="w-3 h-3" />
                        Suivi en stock
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-md bg-slate-500/10 text-slate-600 dark:text-slate-400">
                        Hors stock
                      </span>
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-semibold text-app-text-primary">
                    {item.quantity} {item.product?.unit?.abbreviation || ''}
                  </td>
                  <td className="py-3 px-3 text-right">{formatCurrency(item.unit_price_ht)}</td>
                  <td className="py-3 px-3 text-right">
                    {Number(item.discount_rate) > 0 ? (
                      <span className="text-emerald-600 font-semibold">{item.discount_rate}%</span>
                    ) : (
                      ''
                    )}
                  </td>
                  <td className="py-3 px-3 text-right font-medium">{formatCurrency(item.line_subtotal_ht)}</td>
                  <td className="py-3 px-3 text-right text-app-text-muted">{item.tax_rate}%</td>
                  <td className="py-3 px-3 text-right font-bold text-pesage-blue">{formatCurrency(item.line_total_ttc)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Attachments Section */}
      <AttachmentsSection
        entityType="sale"
        entityId={sale.id}
        title="Pièces Jointes & Documents de la Commande"
      />

      {/* Confirmation Dialogs */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={handleConfirm}
        title="Confirmer la vente"
        message={`Confirmer la vente ${sale.reference} ? Les stocks des produits suivis seront immédiatement déduits des dépôts actifs.`}
        confirmLabel="Confirmer et déduire le stock"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        onConfirm={handleCancel}
        title="Annuler la vente"
        message={`Êtes-vous sûr de vouloir annuler la vente ${sale.reference} ?`}
        confirmLabel="Annuler la vente"
        isLoading={isSubmitting}
      />

      <ConfirmDialog
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Supprimer la vente"
        message={`Êtes-vous sûr de vouloir supprimer définitivement la vente ${sale.reference} ?`}
        confirmLabel="Supprimer"
        isLoading={isSubmitting}
      />

      {/* Document A4 Preview & Print Modal */}
      <DocumentPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Aperçu Bon de Commande Vente"
        documentRef={sale.reference}
      >
        <SaleOrderDocument sale={sale} />
      </DocumentPreviewModal>
    </div>
  );

};
