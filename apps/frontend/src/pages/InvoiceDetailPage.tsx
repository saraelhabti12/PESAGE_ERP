import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api, getApiErrorMessage } from '@/lib/api';
import { Invoice, InvoiceStatus } from '@/types/invoices';
import { Payment, PaymentFormData } from '@/types/payments';
import { PAYMENT_METHODS } from '@/constants/purchases';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { AttachmentsSection } from '@/components/common/AttachmentsSection';
import { useNotification } from '@/context/NotificationContext';

import { formatCurrency, formatDate } from '@/lib/formatters';

import {
  CustomerInvoiceDocument,
  SupplierInvoiceDocument,
} from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';

import {
  ArrowLeft,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Building2,
  CreditCard,
  Printer,
  Trash2,
  Loader2,
  Package,
  Receipt,
  DollarSign,
  ShoppingCart,
  ClipboardList,
} from 'lucide-react';

export const InvoiceDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showSuccess, showError } = useNotification();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);


  // Payment modal state
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentFormData, setPaymentFormData] = useState<PaymentFormData>({
    invoice_id: 0,
    amount: 0,
    payment_date: new Date().toISOString().split('T')[0],
    payment_method: 'bank_transfer',
    transaction_reference: '',
    notes: '',
  });
  const [paymentFormErrors, setPaymentFormErrors] = useState<Record<string, string>>({});

  // Cancel dialog
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const res = await api.get<Invoice>(`/api/v1/invoices/${id}`);
      setInvoice(res.data);
    } catch (err: any) {
      showError(getApiErrorMessage(err, 'Facture introuvable.'));
      navigate('/factures-vente');
    } finally {
      setIsLoading(false);
    }
  }, [id, showError, navigate]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  const isCustomer = invoice?.invoice_type !== 'SUPPLIER';
  const backRoute = isCustomer ? '/factures-vente' : '/factures-achat';
  const backLabel = isCustomer ? 'Retour aux Factures Vente' : 'Retour aux Factures Achat';

  const handleOpenPaymentModal = () => {
    if (!invoice) return;
    setPaymentFormData({
      invoice_id: invoice.id,
      amount: invoice.amount_due,
      payment_date: new Date().toISOString().split('T')[0],
      payment_method: 'bank_transfer',
      transaction_reference: '',
      notes: '',
    });
    setPaymentFormErrors({});
    setIsPaymentModalOpen(true);
  };

  const handleSubmitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invoice) return;

    const errors: Record<string, string> = {};
    if (!paymentFormData.amount || paymentFormData.amount <= 0) {
      errors.amount = 'Le montant doit être supérieur à 0.';
    } else if (paymentFormData.amount > invoice.amount_due + 0.001) {
      errors.amount = `Le montant ne peut pas dépasser le solde dû (${formatCurrency(invoice.amount_due)}).`;
    }
    if (!paymentFormData.payment_date) {
      errors.payment_date = 'La date du paiement est requise.';
    }

    if (Object.keys(errors).length > 0) {
      setPaymentFormErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post<Payment>('/api/v1/payments', {
        ...paymentFormData,
        amount: Number(paymentFormData.amount),
      });
      showSuccess(isCustomer ? 'Règlement client enregistré avec succès !' : 'Décaissement fournisseur enregistré avec succès !');
      setIsPaymentModalOpen(false);
      fetchInvoice();
    } catch (err: any) {
      showError(getApiErrorMessage(err, "Erreur lors de l'enregistrement du règlement."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    try {
      await api.delete(`/api/v1/payments/${paymentId}`);
      showSuccess('Règlement annulé avec succès.');
      fetchInvoice();
    } catch (err: any) {
      showError(getApiErrorMessage(err, "Erreur lors de l'annulation du règlement."));
    }
  };

  const handleCancelInvoice = async () => {
    if (!invoice) return;
    try {
      const res = await api.post<Invoice>(`/api/v1/invoices/${invoice.id}/cancel`);
      setInvoice(res.data);
      showSuccess(`Facture ${invoice.reference} annulée.`);
      setCancelConfirmOpen(false);
    } catch (err: any) {
      showError(getApiErrorMessage(err, "Erreur lors de l'annulation de la facture."));
    }
  };

  const renderStatusBadge = (inv: Invoice) => {
    const today = new Date().toISOString().split('T')[0];
    const isOverdue = inv.status !== 'PAID' && inv.status !== 'CANCELLED' && inv.due_date < today;

    if (inv.status === 'PAID') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
          <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
          {isCustomer ? 'Payée' : 'Réglée'}
        </span>
      );
    }
    if (inv.status === 'PARTIALLY_PAID') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-pesage-blue border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
          Partiellement {isCustomer ? 'payée' : 'réglée'}
        </span>
      );
    }
    if (inv.status === 'CANCELLED') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 border border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700">
          Annulée
        </span>
      );
    }
    if (isOverdue || inv.status === 'OVERDUE') {
      return (
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800 animate-pulse">
          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
          En retard / Échue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
        {isCustomer ? 'Émise' : 'Enregistrée'}
      </span>
    );
  };

  if (isLoading || !invoice) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-pesage-blue" />
        <p className="text-xs text-app-text-muted">Chargement de la facture...</p>
      </div>
    );
  }

  const partner = isCustomer ? invoice.customer : invoice.supplier;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate(backRoute)}
          className="inline-flex items-center gap-2 text-xs font-semibold text-app-text-muted hover:text-pesage-blue transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>

        <div className="flex items-center gap-2">
          {invoice.status !== 'PAID' && invoice.status !== 'CANCELLED' && (
            <Button
              variant="success"
              icon={CreditCard}
              onClick={handleOpenPaymentModal}
            >
              {isCustomer ? 'Enregistrer un Encaissement' : 'Enregistrer un Décaissement'}
            </Button>
          )}

          {invoice.status !== 'CANCELLED' && invoice.amount_paid === 0 && (
            <Button
              variant="danger"
              icon={Trash2}
              onClick={() => setCancelConfirmOpen(true)}
            >
              Annuler la facture
            </Button>
          )}

          <Button
            variant="secondary"
            icon={Printer}
            onClick={() => setIsPreviewModalOpen(true)}
          >
            Imprimer
          </Button>

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
              <h1 className="text-xl font-bold text-app-text font-mono">{invoice.reference}</h1>
              <span className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-app-text-muted border border-app-border">
                {isCustomer ? 'Facture Client' : 'Facture Fournisseur'}
              </span>
              {renderStatusBadge(invoice)}
            </div>
            <p className="text-xs text-app-text-muted mt-1">
              Émise le {formatDate(invoice.invoice_date || invoice.created_at)} — Échéance : {formatDate(invoice.due_date)}
              {invoice.sale && ` — Vente : ${invoice.sale.reference}`}
              {invoice.purchase_order && ` — Commande d'achat : ${invoice.purchase_order.reference}`}
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xs text-app-text-muted block">Reste à Payer</span>
          <span className="text-2xl font-black text-pesage-orange font-mono">
            {formatCurrency(invoice.amount_due)}
          </span>
        </div>
      </div>

      {/* Details Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <Building2 className="w-4 h-4 text-pesage-blue" />
            <h3 className="text-xs font-bold text-app-text uppercase tracking-wider">
              {isCustomer ? 'Client' : 'Fournisseur'}
            </h3>
          </div>
          <p className="text-sm font-bold text-app-text">
            {partner?.trade_name || partner?.legal_name || (isCustomer ? `Client #${invoice.customer_id}` : `Fournisseur #${invoice.supplier_id}`)}
          </p>
          {partner?.code && <p className="text-xs text-app-text-muted">Code : {partner.code}</p>}
          {(partner?.ice || partner?.tax_id) && (
            <p className="text-xs text-app-text-muted">ICE : {partner.ice || partner.tax_id}</p>
          )}
          {partner?.address && <p className="text-xs text-app-text-muted">Adresse : {partner.address}</p>}
          {partner?.phone && <p className="text-xs text-app-text-muted">Téléphone : {partner.phone}</p>}
        </div>

        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <CreditCard className="w-4 h-4 text-pesage-orange" />
            <h3 className="text-xs font-bold text-app-text uppercase tracking-wider">Conditions & Origine</h3>
          </div>
          <p className="text-xs">
            <span className="text-app-text-muted">Conditions : </span>
            <span className="font-semibold text-app-text">{invoice.payment_terms || '30 jours'}</span>
          </p>
          {invoice.payment_method && (
            <p className="text-xs">
              <span className="text-app-text-muted">Mode : </span>
              <span className="font-semibold text-app-text">{invoice.payment_method}</span>
            </p>
          )}
          {invoice.sale && (
            <p className="text-xs">
              <span className="text-app-text-muted">Commande de vente : </span>
              <span
                onClick={() => navigate(`/ventes/${invoice.sale?.id}`)}
                className="font-semibold text-pesage-blue hover:underline cursor-pointer"
              >
                {invoice.sale.reference}
              </span>
            </p>
          )}
          {invoice.purchase_order && (
            <p className="text-xs">
              <span className="text-app-text-muted">Bon de commande d'achat : </span>
              <span
                onClick={() => navigate(`/achats`)}
                className="font-semibold text-pesage-blue hover:underline cursor-pointer"
              >
                {invoice.purchase_order.reference}
              </span>
            </p>
          )}
          {invoice.notes && <p className="text-xs text-app-text-muted mt-2 italic">{invoice.notes}</p>}
        </div>

        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-2">
          <div className="flex items-center gap-2 pb-2 border-b border-app-border">
            <DollarSign className="w-4 h-4 text-emerald-600" />
            <h3 className="text-xs font-bold text-app-text uppercase tracking-wider">Totaux & Règlements</h3>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-app-text-muted">Total HT :</span>
            <span className="font-semibold text-app-text font-mono">{formatCurrency(invoice.subtotal_ht)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-app-text-muted">TVA :</span>
            <span className="font-semibold text-app-text font-mono">{formatCurrency(invoice.tax_amount)}</span>
          </div>
          <div className="flex justify-between text-xs font-bold border-t border-app-border pt-1">
            <span className="text-app-text">Total TTC :</span>
            <span className="text-app-text font-mono">{formatCurrency(invoice.total_ttc)}</span>
          </div>
          <div className="flex justify-between text-xs text-emerald-600 font-bold">
            <span>Total Réglé :</span>
            <span className="font-mono">{formatCurrency(invoice.amount_paid)}</span>
          </div>
          <div className="flex justify-between text-xs text-pesage-orange font-bold">
            <span>Reste Dû :</span>
            <span className="font-mono">{formatCurrency(invoice.amount_due)}</span>
          </div>
        </div>
      </div>

      {/* Items Table */}
      <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4">
        <h3 className="text-xs font-bold text-app-text uppercase tracking-wider flex items-center gap-2">
          <Package className="w-4 h-4 text-pesage-blue" />
          <span>Articles facturés ({invoice.items?.length || 0})</span>
        </h3>
        <table className="w-full text-xs text-left">
          <thead className="bg-app-surface-subtle text-app-text-muted font-semibold uppercase tracking-wider border-b border-app-border">
            <tr>
              <th className="p-3">Produit / Désignation</th>
              <th className="p-3 text-center">Quantité</th>
              <th className="p-3 text-right">Prix Unit. HT</th>
              <th className="p-3 text-center">Remise %</th>
              <th className="p-3 text-center">TVA %</th>
              <th className="p-3 text-right">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border">
            {invoice.items?.map((it) => (
              <tr key={it.id}>
                <td className="p-3 font-semibold text-app-text">
                  {it.product?.designation || it.description || `Article #${it.product_id}`}
                </td>
                <td className="p-3 text-center text-app-text font-mono">{it.quantity}</td>
                <td className="p-3 text-right text-app-text font-mono">{formatCurrency(it.unit_price_ht)}</td>
                <td className="p-3 text-center text-app-text font-mono">{it.discount_rate || 0}%</td>
                <td className="p-3 text-center text-app-text font-mono">{it.tax_rate || 20}%</td>
                <td className="p-3 text-right font-bold text-app-text font-mono">
                  {formatCurrency(it.line_total_ttc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Payments History */}
      {invoice.payments && invoice.payments.length > 0 && (
        <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-4">
          <h3 className="text-xs font-bold text-app-text uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            <span>Historique des paiements ({invoice.payments.length})</span>
          </h3>
          <table className="w-full text-xs text-left">
            <thead className="bg-app-surface-subtle text-app-text-muted font-semibold uppercase tracking-wider border-b border-app-border">
              <tr>
                <th className="p-3">Référence</th>
                <th className="p-3">Date</th>
                <th className="p-3">Mode</th>
                <th className="p-3">Transaction / Réf.</th>
                <th className="p-3 text-right">Montant</th>
                <th className="p-3 text-center w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {invoice.payments.map((p) => (
                <tr key={p.id}>
                  <td className="p-3 font-semibold text-app-text">{p.reference}</td>
                  <td className="p-3 text-app-text">{formatDate(p.payment_date)}</td>
                  <td className="p-3 capitalize text-app-text">{p.payment_method?.replace('_', ' ')}</td>
                  <td className="p-3 text-app-text-muted">{p.transaction_reference || '—'}</td>
                  <td className="p-3 text-right font-bold text-emerald-600 font-mono">
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="p-3 text-center">
                    <button
                      onClick={() => handleDeletePayment(p.id)}
                      className="p-1 rounded text-app-text-muted hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition"
                      title="Annuler ce règlement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Attachments Section */}
      <AttachmentsSection
        entityType={isCustomer ? 'customer_invoice' : 'supplier_invoice'}
        entityId={invoice.id}
        title="Pièces Jointes & Justificatifs de la Facture"
      />

      {/* Payment Modal */}
      <Modal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        title={isCustomer ? `Enregistrer un Encaissement Client` : `Enregistrer un Décaissement Fournisseur`}
      >
        <form onSubmit={handleSubmitPayment} className="space-y-4">
          <div className="p-3.5 rounded-xl bg-pesage-blue-subtle text-pesage-blue dark:bg-pesage-blue/20 dark:text-blue-200 text-xs flex justify-between items-center">
            <span>Reste à régler :</span>
            <span className="font-bold font-mono text-sm">
              {formatCurrency(invoice.amount_due)}
            </span>
          </div>

          <FormField label="Montant du règlement (MAD)" required error={paymentFormErrors.amount}>
            <input
              type="number"
              step="0.01"
              value={paymentFormData.amount}
              onChange={(e) =>
                setPaymentFormData({ ...paymentFormData, amount: Number(e.target.value) })
              }
              required
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-bold font-mono text-app-text focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <FormField label="Date du règlement" required error={paymentFormErrors.payment_date}>
              <input
                type="date"
                value={paymentFormData.payment_date}
                onChange={(e) =>
                  setPaymentFormData({ ...paymentFormData, payment_date: e.target.value })
                }
                required
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Mode de règlement" required>
              <select
                value={paymentFormData.payment_method}
                onChange={(e) =>
                  setPaymentFormData({ ...paymentFormData, payment_method: e.target.value })
                }
                className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-semibold text-app-text focus:outline-none focus:border-pesage-blue"
              >
                {PAYMENT_METHODS.map((pm) => (
                  <option key={pm.value} value={pm.value}>
                    {pm.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Réf. Transaction / N° Chèque / Virement">
            <input
              type="text"
              value={paymentFormData.transaction_reference || ''}
              onChange={(e) =>
                setPaymentFormData({ ...paymentFormData, transaction_reference: e.target.value })
              }
              placeholder="Ex: VIR-8849202"
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <FormField label="Notes / Remarques">
            <textarea
              rows={2}
              value={paymentFormData.notes || ''}
              onChange={(e) =>
                setPaymentFormData({ ...paymentFormData, notes: e.target.value })
              }
              className="w-full px-3 py-2 bg-app-surface border border-app-border rounded-xl text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-app-border">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setIsPaymentModalOpen(false)}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              variant="success"
              isLoading={isSubmitting}
            >
              Confirmer le Règlement
            </Button>
          </div>
        </form>
      </Modal>

      {/* Confirm Cancel Dialog */}
      <ConfirmDialog
        isOpen={cancelConfirmOpen}
        onClose={() => setCancelConfirmOpen(false)}
        onConfirm={handleCancelInvoice}
        title="Annuler la facture"
        message={`Êtes-vous sûr de vouloir annuler la facture ${invoice.reference} ?`}
        confirmText="Annuler la facture"
        variant="danger"
      />

      {/* Document A4 Preview & Print Modal */}
      <DocumentPreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        title={invoice.invoice_type === 'SUPPLIER' ? 'Aperçu Facture Achat' : 'Aperçu Facture Vente'}
        documentRef={invoice.reference}
      >
        {invoice.invoice_type === 'SUPPLIER' ? (
          <SupplierInvoiceDocument invoice={invoice} />
        ) : (
          <CustomerInvoiceDocument invoice={invoice} />
        )}
      </DocumentPreviewModal>
    </div>
  );
};

