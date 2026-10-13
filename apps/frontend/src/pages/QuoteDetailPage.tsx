import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { Quote, QuoteStatus } from '@/types/quotes';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AttachmentsSection } from '@/components/common/AttachmentsSection';
import { useNotification } from '@/context/NotificationContext';

import { formatCurrency, formatDate } from '@/lib/formatters';

import { QuoteDocument } from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

import {
  ArrowLeft,

  FileText,
  CheckCircle2,
  Send,
  Building2,
  CreditCard,
  Printer,
  Trash2,
  Loader2,
  Package,
  FileCheck2,
  DollarSign,
} from 'lucide-react';

export const QuoteDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // Actions confirmation
  const [actionConfirmOpen, setActionConfirmOpen] = useState(false);
  const [actionType, setActionType] = useState<'send' | 'accept' | 'reject' | 'cancel' | 'convert' | 'delete' | null>(null);

  const fetchQuote = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await api.get<Quote>(`/api/v1/quotes/${id}`);
      setQuote(res.data);
    } catch (err: any) {
      showError(getApiErrorMessage(err, 'Devis introuvable.'));
      navigate('/devis');
    } finally {
      setIsLoading(false);
    }
  }, [id, showError, navigate]);

  useEffect(() => {
    fetchQuote();
  }, [fetchQuote]);

  const handleAction = async () => {
    if (!quote || !actionType) return;
    try {
      if (actionType === 'send') {
        const res = await api.post<Quote>(`/api/v1/quotes/${quote.id}/send`);
        setQuote(res.data);
        showSuccess(`Devis ${quote.reference} marqué comme Envoyé.`);
      } else if (actionType === 'accept') {
        const res = await api.post<Quote>(`/api/v1/quotes/${quote.id}/accept`);
        setQuote(res.data);
        showSuccess(`Devis ${quote.reference} accepté.`);
      } else if (actionType === 'reject') {
        const res = await api.post<Quote>(`/api/v1/quotes/${quote.id}/reject`);
        setQuote(res.data);
        showSuccess(`Devis ${quote.reference} refusé.`);
      } else if (actionType === 'cancel') {
        const res = await api.post<Quote>(`/api/v1/quotes/${quote.id}/cancel`);
        setQuote(res.data);
        showSuccess(`Devis ${quote.reference} annulé.`);
      } else if (actionType === 'convert') {
        const res = await api.post(`/api/v1/quotes/${quote.id}/convert-to-sale`);
        showSuccess(`Devis ${quote.reference} converti en Vente ${res.data.reference} !`);
        navigate(`/ventes/${res.data.id}`);
        return;
      } else if (actionType === 'delete') {
        await api.delete(`/api/v1/quotes/${quote.id}`);
        showSuccess(`Devis ${quote.reference} supprimé.`);
        navigate('/devis');
        return;
      }
    } catch (err: any) {
      showError(getApiErrorMessage(err, "Erreur lors de l'exécution de l'action."));
    } finally {
      setActionConfirmOpen(false);
      setActionType(null);
    }
  };

  const renderStatusBadge = (status: QuoteStatus) => {
    const badges: Record<QuoteStatus, { label: string; bg: string; text: string; border: string }> = {
      DRAFT: { label: 'Brouillon', bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-300' },
      SENT: { label: 'Envoyé', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
      ACCEPTED: { label: 'Accepté', bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
      REJECTED: { label: 'Refusé', bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
      CANCELLED: { label: 'Annulé', bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
    };
    const b = badges[status] || badges.DRAFT;
    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${b.bg} ${b.text} ${b.border}`}>
        {b.label}
      </span>
    );
  };

  if (isLoading || !quote) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-pesage-blue" />
        <p className="text-xs text-app-text-muted">Chargement du détail du devis...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation Bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate('/devis')}
          className="inline-flex items-center gap-2 text-xs font-semibold text-app-text-muted hover:text-pesage-blue transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour aux devis</span>
        </button>

        <div className="flex items-center gap-2">
          {quote.status === 'DRAFT' && (
            <button
              onClick={() => {
                setActionType('send');
                setActionConfirmOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shadow-sm transition"
            >
              <Send className="w-4 h-4" />
              <span>Envoyer au client</span>
            </button>
          )}

          {(quote.status === 'DRAFT' || quote.status === 'SENT') && (
            <button
              onClick={() => {
                setActionType('accept');
                setActionConfirmOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 shadow-sm transition"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Accepter</span>
            </button>
          )}

          {(quote.status === 'ACCEPTED' || quote.status === 'SENT') && (
            <button
              onClick={() => {
                setActionType('convert');
                setActionConfirmOpen(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 shadow-sm transition"
            >
              <FileCheck2 className="w-4 h-4" />
              <span>Convertir en Vente</span>
            </button>
          )}

          {(quote.status === 'DRAFT' || quote.status === 'CANCELLED') && (
            <button
              onClick={() => {
                setActionType('delete');
                setActionConfirmOpen(true);
              }}
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
            <FileText className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-xl font-bold text-app-text-primary font-mono">{quote.reference}</h1>
              {renderStatusBadge(quote.status)}
            </div>
            <p className="text-xs text-app-text-muted mt-1">
              Émis le {formatDate(quote.quote_date)} {quote.valid_until && `— Valide jusqu'au ${formatDate(quote.valid_until)}`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-app-text-muted block">Total Devis TTC</span>
          <span className="text-2xl font-black text-pesage-blue">{formatCurrency(quote.total_ttc)}</span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <Building2 className="w-4 h-4 text-pesage-blue" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Client</h3>
          </div>
          <p className="text-sm font-bold text-app-text">{quote.customer?.legal_name || quote.customer?.trade_name}</p>
          <p className="text-xs text-app-text-muted">Code : {quote.customer?.code}</p>
          {(quote.customer?.ice || quote.customer?.tax_id) && (
            <p className="text-xs text-app-text-muted">ICE : {quote.customer.ice || quote.customer.tax_id}</p>
          )}
          {quote.customer?.address && <p className="text-xs text-app-text-muted">Adresse : {quote.customer.address}</p>}
        </div>

        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <CreditCard className="w-4 h-4 text-pesage-orange" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Modalités</h3>
          </div>
          <p className="text-xs"><span className="text-app-text-muted">Conditions :</span> <span className="font-semibold">{quote.payment_terms || '30 jours'}</span></p>
          {quote.delivery_delay && (
            <p className="text-xs"><span className="text-app-text-muted">Délai livraison :</span> <span className="font-semibold text-pesage-blue">{quote.delivery_delay}</span></p>
          )}
          {quote.realization_delay && (
            <p className="text-xs"><span className="text-app-text-muted">Délai réalisation :</span> <span className="font-semibold text-pesage-blue">{quote.realization_delay}</span></p>
          )}
          {quote.notes && <p className="text-xs text-app-text-muted"><span className="font-semibold">Notes :</span> {quote.notes}</p>}
        </div>

        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider">Totaux</h3>
          </div>
          <div className="flex justify-between text-xs"><span>Total HT :</span><span className="font-semibold">{formatCurrency(quote.subtotal_ht)}</span></div>
          {quote.discount_amount > 0 && <div className="flex justify-between text-xs text-amber-600"><span>Remise :</span><span>-{formatCurrency(quote.discount_amount)}</span></div>}
          <div className="flex justify-between text-xs"><span>TVA :</span><span className="font-semibold">{formatCurrency(quote.tax_amount)}</span></div>
          <div className="flex justify-between text-sm font-bold pt-2 border-t border-app-border"><span>Total TTC :</span><span className="text-pesage-blue">{formatCurrency(quote.total_ttc)}</span></div>
        </div>
      </div>

      {/* Articles Table */}
      <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-pesage-blue" />
          <span>Articles du Devis ({quote.items.length})</span>
        </h3>
        <table className="w-full text-xs text-left">
          <thead className="bg-app-surface-subtle text-app-text-muted font-semibold uppercase tracking-wider border-b border-app-border">
            <tr>
              <th className="p-3">Produit</th>
              <th className="p-3 text-center">Quantité</th>
              <th className="p-3 text-right">Prix Unit. HT</th>
              <th className="p-3 text-center">Remise %</th>
              <th className="p-3 text-center">TVA %</th>
              <th className="p-3 text-right">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {quote.items.map((it) => (
              <tr key={it.id}>
                <td className="p-3 font-semibold text-app-text">{it.product?.designation || `Produit #${it.product_id}`}</td>
                <td className="p-3 text-center">{it.quantity}</td>
                <td className="p-3 text-right">{formatCurrency(it.unit_price_ht)}</td>
                <td className="p-3 text-center">{it.discount_rate}%</td>
                <td className="p-3 text-center">{it.tax_rate}%</td>
                <td className="p-3 text-right font-bold text-app-text">{formatCurrency(it.line_total_ttc)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Attachments Section */}
      <AttachmentsSection
        entityType="quote"
        entityId={quote.id}
        title="Pièces Jointes & Documents du Devis"
      />

      <ConfirmDialog
        isOpen={actionConfirmOpen}
        onClose={() => setActionConfirmOpen(false)}
        onConfirm={handleAction}
        title="Confirmation d'action"
        message={`Confirmez-vous cette action sur le devis ${quote.reference} ?`}
        confirmLabel="Confirmer"
        cancelLabel="Annuler"
      />

      {/* Document A4 Preview & Print Modal */}
      <DocumentPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title="Aperçu du Devis"
        documentRef={quote.reference}
      >
        <QuoteDocument quote={quote} />
      </DocumentPreviewModal>
    </div>
  );
};

