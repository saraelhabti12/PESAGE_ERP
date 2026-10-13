import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { DeliveryNote, DeliveryNoteStatus } from '@/types/deliveryNotes';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AttachmentsSection } from '@/components/common/AttachmentsSection';
import { useNotification } from '@/context/NotificationContext';
import { formatDate } from '@/lib/formatters';
import { DeliveryNoteDocument } from '@/components/common/DocumentPrintTemplate';

import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import {
  ArrowLeft,

  Truck,
  CheckCircle2,
  XCircle,
  Building2,
  Printer,
  Trash2,
  Loader2,
  Package,
  MapPin,
} from 'lucide-react';

export const DeliveryNoteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [deliveryNote, setDeliveryNote] = useState<DeliveryNote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);


  const fetchDeliveryNote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await api.get<DeliveryNote>(`/api/v1/delivery-notes/${id}`);
      setDeliveryNote(res.data);
    } catch (err: any) {
      showError(getApiErrorMessage(err, 'Bon de livraison introuvable.'));
      navigate('/livraisons');
    } finally {
      setIsLoading(false);
    }
  }, [id, showError, navigate]);

  useEffect(() => {
    fetchDeliveryNote();
  }, [fetchDeliveryNote]);

  const handleCancel = async () => {
    if (!deliveryNote) return;
    try {
      const res = await api.post<DeliveryNote>(`/api/v1/delivery-notes/${deliveryNote.id}/cancel`);
      setDeliveryNote(res.data);
      showSuccess(`Bon de livraison ${deliveryNote.reference} annulé.`);
      setCancelConfirmOpen(false);
    } catch (err: any) {
      showError(getApiErrorMessage(err, "Erreur lors de l'annulation du bon de livraison."));
    }
  };

  const renderStatusBadge = (status: DeliveryNoteStatus) => {
    if (status === 'DELIVERED') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          Livré
        </span>
      );
    }
    if (status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
          <XCircle className="w-3.5 h-3.5 mr-1" />
          Annulé
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300">
        Brouillon
      </span>
    );
  };

  if (isLoading || !deliveryNote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-pesage-blue" />
        <p className="text-xs text-app-text-muted">Chargement du bon de livraison...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/livraisons')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-app-text-muted hover:text-pesage-blue transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux livraisons</span>
        </button>

        <div className="flex items-center gap-2">
          {deliveryNote.status === 'DELIVERED' && (
            <button
              onClick={() => setCancelConfirmOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 shadow-sm transition"
            >
              <Trash2 className="w-4 h-4" />
              <span>Annuler le BL</span>
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
            <Truck className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-app-text-primary font-mono">{deliveryNote.reference}</h1>
              {renderStatusBadge(deliveryNote.status)}
            </div>
            <p className="text-xs text-app-text-muted mt-1">
              Date d'expédition : {formatDate(deliveryNote.delivery_date)} — Réf. Commande : {deliveryNote.sale?.reference}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-app-text-muted block">Articles Expédiés</span>
          <span className="text-2xl font-black text-pesage-blue">
            {deliveryNote.items.reduce((acc, it) => acc + it.delivered_quantity, 0)} unités
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <Building2 className="w-4 h-4 text-pesage-blue" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Destinataire</h3>
          </div>
          <p className="text-sm font-bold text-app-text">{deliveryNote.customer?.legal_name || deliveryNote.customer?.trade_name}</p>
          <p className="text-xs text-app-text-muted">Code : {deliveryNote.customer?.code}</p>
          {(deliveryNote.customer?.ice || deliveryNote.customer?.tax_id) && (
            <p className="text-xs text-app-text-muted">ICE : {deliveryNote.customer.ice || deliveryNote.customer.tax_id}</p>
          )}
          {deliveryNote.shipping_address && (
            <p className="text-xs text-app-text">
              <span className="text-app-text-muted">Adresse de livraison :</span> {deliveryNote.shipping_address}
            </p>
          )}
        </div>

        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <MapPin className="w-4 h-4 text-pesage-orange" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Suivi Transport</h3>
          </div>
          <p className="text-xs"><span className="text-app-text-muted">N° Suivi / Transporteur :</span> <span className="font-semibold">{deliveryNote.tracking_number || 'Livraison standard'}</span></p>
          {deliveryNote.notes && <p className="text-xs text-app-text-muted"><span className="font-semibold">Notes :</span> {deliveryNote.notes}</p>}
        </div>
      </div>

      {/* Items Table */}
      <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-pesage-blue" />
          <span>Articles livrés ({deliveryNote.items.length})</span>
        </h3>
        <table className="w-full text-xs text-left">
          <thead className="bg-app-surface-subtle text-app-text-muted font-semibold uppercase tracking-wider border-b border-app-border">
            <tr>
              <th className="p-3">Réf. Article</th>
              <th className="p-3">Désignation</th>
              <th className="p-3 text-center">Qté Commandée</th>
              <th className="p-3 text-center font-bold text-emerald-600 bg-emerald-500/10">Qté Livrée</th>
              <th className="p-3">Remarques / Séries</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {deliveryNote.items.map((it) => (
              <tr key={it.id}>
                <td className="p-3 font-mono text-app-text-muted">{it.product?.sku || `PROD-${it.product_id}`}</td>
                <td className="p-3 font-medium text-app-text">{it.product?.designation}</td>
                <td className="p-3 text-center">{it.ordered_quantity}</td>
                <td className="p-3 text-center font-bold text-emerald-600 bg-emerald-500/5">{it.delivered_quantity}</td>
                <td className="p-3 text-app-text-muted">{it.notes || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Attachments Section */}
      <AttachmentsSection
        entityType="delivery_note"
        entityId={deliveryNote.id}
        title="Pièces Jointes & Bons de Livraison Signés"
      />

      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancel}
        title="Annuler le bon de livraison"
        message={`Voulez-vous annuler le bon de livraison ${deliveryNote.reference} ?`}
        confirmLabel="Confirmer l'annulation"
        cancelLabel="Annuler"
        variant="danger"
      />

      {/* Document A4 Preview & Print Modal */}
      <DocumentPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Aperçu Bon de Livraison"
        documentRef={deliveryNote.reference}
      >
        <DeliveryNoteDocument deliveryNote={deliveryNote} />
      </DocumentPreviewModal>
    </div>
  );
};

