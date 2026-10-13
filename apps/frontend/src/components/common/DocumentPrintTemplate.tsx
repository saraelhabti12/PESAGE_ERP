import React, { useState } from 'react';
import { formatCurrency, formatDate, formatDateShort } from '@/lib/formatters';
import { BusinessPartner } from '@/types/partner';
import { Quote } from '@/types/quotes';
import { Invoice } from '@/types/invoices';
import { DeliveryNote } from '@/types/deliveryNotes';
import { CreditNote, CreditNoteReason } from '@/types/creditNotes';
import { Intervention, EquipmentType, InterventionType, TaskStatus } from '@/types/maintenance';
import { Sale } from '@/types/sales';
import { Scale, CheckCircle2, Wrench, ShieldCheck, Truck, FileText } from 'lucide-react';

// =========================================================================
// CORPORATE IDENTITY & DOCUMENT HEADER
// =========================================================================
export interface DocumentHeaderProps {
  title: string;
  reference: string;
  date: string;
  dateLabel?: string;
  validUntil?: string | null;
  dueDate?: string | null;
  sourceReference?: string | null;
  sourceLabel?: string;
  statusBadge?: React.ReactNode;
}

export const DocumentHeader: React.FC<DocumentHeaderProps> = ({
  title,
  reference,
  date,
  dateLabel = 'Date',
  validUntil,
  dueDate,
  sourceReference,
  sourceLabel = 'Réf. Source',
  statusBadge,
}) => {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="flex items-start justify-between border-b-2 border-slate-900 pb-5 avoid-page-break">
      {/* Pesage 2000 Corporate Identity */}
      <div className="flex items-start space-x-4 max-w-[65%]">
        <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-xs shrink-0 flex items-center justify-center">
          {!logoFailed ? (
            <img
              src="/branding/pesage-2000-logo.png"
              alt="Pesage 2000"
              className="h-14 w-auto object-contain"
              onError={() => setLogoFailed(true)}
            />
          ) : (
            <div className="h-14 w-28 flex flex-col items-center justify-center bg-slate-50 text-slate-800 rounded-lg p-1">
              <Scale className="w-6 h-6 text-[#001BB7]" />
              <span className="text-[10px] font-black tracking-wider text-slate-900 mt-0.5">PESAGE 2000</span>
            </div>
          )}
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-black tracking-tight text-slate-950 uppercase leading-none">
            PESAGE 2000 SARL
          </h2>
          <p className="text-xs font-bold text-[#001BB7] leading-tight">
            Solutions de Pesage Industriel & Commercial • Métrologie Légale & SAV
          </p>
          <p className="text-xs text-slate-600 leading-tight">
            Casablanca, Maroc • contact@pesage2000.ma • Tél : +212 5 22 00 00 00
          </p>
          <p className="text-[11px] text-slate-500 font-mono leading-tight">
            ICE: 001524389000084 | RC: 284910 | IF: 14456920 | Patente: 37920140
          </p>
        </div>
      </div>

      {/* Document Meta (Reference, dates, status) */}
      <div className="text-right space-y-1.5 shrink-0">
        <div className="flex items-center justify-end gap-2">
          {statusBadge}
          <span className="inline-block px-3.5 py-1 rounded-md text-xs font-black uppercase tracking-wider bg-slate-900 text-white shadow-xs">
            {title}
          </span>
        </div>
        <h3 className="text-2xl font-black font-mono text-slate-900 leading-tight">{reference}</h3>
        <p className="text-xs text-slate-700">
          <span className="text-slate-500 font-medium">{dateLabel} :</span>{' '}
          <span className="font-semibold">{formatDateShort(date) !== '-' ? formatDateShort(date) : formatDate(date)}</span>
        </p>
        {validUntil && (
          <p className="text-xs text-slate-700">
            <span className="text-slate-500 font-medium">Valide jusqu'au :</span>{' '}
            <span className="font-semibold">{formatDateShort(validUntil)}</span>
          </p>
        )}
        {dueDate && (
          <p className="text-xs text-slate-700">
            <span className="text-slate-500 font-medium">Échéance :</span>{' '}
            <span className="font-semibold">{formatDateShort(dueDate)}</span>
          </p>
        )}
        {sourceReference && (
          <p className="text-xs text-slate-700 font-semibold">
            <span className="text-slate-500 font-normal">{sourceLabel} :</span> {sourceReference}
          </p>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// PARTNER INFORMATION BLOCK (STRICTLY CONDITIONAL FIELDS)
// =========================================================================
export interface PartnerInfoBlockProps {
  label: 'Client' | 'Fournisseur' | 'Destinataire';
  partner?: Partial<BusinessPartner> | null;
  fallbackName?: string;
  shippingAddress?: string | null;
  paymentTerms?: string | null;
  deliveryDelay?: string | null;
  realizationDelay?: string | null;
  trackingNumber?: string | null;
  notes?: string | null;
}

export const PartnerInfoBlock: React.FC<PartnerInfoBlockProps> = ({
  label,
  partner,
  fallbackName,
  shippingAddress,
  paymentTerms,
  deliveryDelay,
  realizationDelay,
  trackingNumber,
  notes,
}) => {
  const partnerName = partner?.legal_name || partner?.trade_name || fallbackName;
  const ice = partner?.ice || partner?.tax_id;
  const hasDelaysOrTerms = paymentTerms || deliveryDelay || realizationDelay || trackingNumber || notes;

  return (
    <div className="grid grid-cols-2 gap-6 bg-slate-50/90 p-4.5 rounded-xl border border-slate-200 text-xs avoid-page-break">
      {/* Partner Identification */}
      <div className="space-y-1.5">
        <p className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-[#001BB7]" />
          <span>{label} :</span>
        </p>
        {partnerName && <p className="text-sm font-bold text-slate-900">{partnerName}</p>}
        {partner?.code && (
          <p className="text-slate-700">
            <span className="text-slate-500 font-medium">Code :</span> <span className="font-mono">{partner.code}</span>
          </p>
        )}
        {/* ICE: Render ONLY if populated. NEVER render "ICE: —" or empty box */}
        {ice && (
          <p className="text-slate-800 font-medium">
            <span className="text-slate-500 font-medium">ICE :</span> <span className="font-mono font-semibold">{ice}</span>
          </p>
        )}
        {partner?.registration_number && (
          <p className="text-slate-700">
            <span className="text-slate-500 font-medium">RC :</span> <span className="font-mono">{partner.registration_number}</span>
          </p>
        )}
        {partner?.address && (
          <p className="text-slate-700">
            <span className="text-slate-500 font-medium">Adresse :</span> {partner.address}
          </p>
        )}
        {shippingAddress && shippingAddress !== partner?.address && (
          <p className="text-slate-800 font-medium">
            <span className="text-slate-500 font-medium">Lieu de livraison :</span> {shippingAddress}
          </p>
        )}
        {partner?.phone && (
          <p className="text-slate-700">
            <span className="text-slate-500 font-medium">Tél :</span> {partner.phone}
          </p>
        )}
        {partner?.email && (
          <p className="text-slate-700">
            <span className="text-slate-500 font-medium">Email :</span> {partner.email}
          </p>
        )}
      </div>

      {/* Commercial & Execution Terms (Render ONLY if populated) */}
      <div className="space-y-1.5">
        {hasDelaysOrTerms && (
          <>
            <p className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] mb-1 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5B36]" />
              <span>Modalités & Exécution :</span>
            </p>
            {paymentTerms && (
              <p className="text-slate-800">
                <span className="text-slate-500 font-medium">Règlement :</span>{' '}
                <span className="font-semibold">{paymentTerms}</span>
              </p>
            )}
            {deliveryDelay && (
              <p className="text-slate-800">
                <span className="text-slate-500 font-medium">Délai de livraison :</span>{' '}
                <span className="font-bold text-[#001BB7]">{deliveryDelay}</span>
              </p>
            )}
            {realizationDelay && (
              <p className="text-slate-800">
                <span className="text-slate-500 font-medium">Délai de réalisation :</span>{' '}
                <span className="font-bold text-[#001BB7]">{realizationDelay}</span>
              </p>
            )}
            {trackingNumber && (
              <p className="text-slate-800">
                <span className="text-slate-500 font-medium">Suivi transporteur :</span>{' '}
                <span className="font-mono font-semibold">{trackingNumber}</span>
              </p>
            )}
            {notes && (
              <p className="text-slate-700 italic pt-1.5 border-t border-slate-200">
                <span className="text-slate-500 not-italic font-semibold">Note :</span> {notes}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// TOTALS SUMMARY BLOCK (STRICTLY CONDITIONAL DISCOUNT AND PAYMENTS)
// =========================================================================
export interface TotalsBlockProps {
  subtotalHt: number;
  discountAmount?: number;
  taxAmount: number;
  totalTtc: number;
  amountPaid?: number;
  amountDue?: number;
}

export const TotalsBlock: React.FC<TotalsBlockProps> = ({
  subtotalHt,
  discountAmount = 0,
  taxAmount,
  totalTtc,
  amountPaid = 0,
  amountDue,
}) => {
  return (
    <div className="flex justify-end avoid-page-break">
      <div className="w-80 space-y-2 text-xs text-slate-800 bg-slate-50/90 p-4 rounded-xl border border-slate-200">
        <div className="flex justify-between items-center">
          <span className="text-slate-600 font-medium">Total HT :</span>
          <span className="font-mono font-semibold text-slate-900">{formatCurrency(subtotalHt)}</span>
        </div>

        {/* Discount: NEVER render if 0 or undefined */}
        {discountAmount > 0 && (
          <div className="flex justify-between items-center text-amber-800 font-semibold">
            <span>Remise accordée :</span>
            <span className="font-mono">-{formatCurrency(discountAmount)}</span>
          </div>
        )}

        <div className="flex justify-between items-center">
          <span className="text-slate-600 font-medium">Montant TVA :</span>
          <span className="font-mono font-semibold text-slate-900">{formatCurrency(taxAmount)}</span>
        </div>

        <div className="flex justify-between items-center text-base font-black text-slate-900 border-t-2 border-slate-300 pt-2">
          <span>Total TTC :</span>
          <span className="font-mono text-[#001BB7]">{formatCurrency(totalTtc)}</span>
        </div>

        {/* Paid and Due: NEVER render if 0 */}
        {amountPaid > 0 && (
          <>
            <div className="flex justify-between items-center text-xs font-bold text-emerald-700 border-t border-slate-200 pt-2">
              <span>Montant Réglé :</span>
              <span className="font-mono">{formatCurrency(amountPaid)}</span>
            </div>
            {amountDue !== undefined && amountDue > 0 && (
              <div className="flex justify-between items-center text-xs font-extrabold text-[#FF5B36]">
                <span>Reste à Payer :</span>
                <span className="font-mono">{formatCurrency(amountDue)}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// =========================================================================
// SIGNATURES BLOCK
// =========================================================================
export interface SignaturesBlockProps {
  leftTitle?: string;
  leftSubtitle?: string;
  rightTitle?: string;
  rightSubtitle?: string;
}

export const SignaturesBlock: React.FC<SignaturesBlockProps> = ({
  leftTitle = 'Pour PESAGE 2000 SARL',
  leftSubtitle = 'Cachet & Signature autorisée',
  rightTitle = 'Bon pour accord & Réception',
  rightSubtitle = 'Date, Signature & Cachet du Client',
}) => {
  return (
    <div className="grid grid-cols-2 gap-8 pt-6 border-t border-slate-200 text-xs text-slate-700 avoid-page-break">
      <div className="border border-dashed border-slate-300 rounded-xl p-4 h-32 flex flex-col justify-between bg-slate-50/50">
        <div>
          <p className="font-bold text-slate-900">{leftTitle}</p>
          <p className="text-[11px] text-slate-500 italic mt-0.5">{leftSubtitle}</p>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">Date : _____ / _____ / 2026</div>
      </div>
      <div className="border border-dashed border-slate-300 rounded-xl p-4 h-32 flex flex-col justify-between bg-slate-50/50">
        <div>
          <p className="font-bold text-slate-900">{rightTitle}</p>
          <p className="text-[11px] text-slate-500 italic mt-0.5">{rightSubtitle}</p>
        </div>
        <div className="text-[10px] text-slate-400 font-mono">Date : _____ / _____ / 2026</div>
      </div>
    </div>
  );
};

// =========================================================================
// LEGAL FOOTER
// =========================================================================
export const DocumentFooter: React.FC = () => {
  return (
    <footer className="pt-4 border-t border-slate-200 text-center text-[10px] text-slate-500 space-y-0.5 avoid-page-break">
      <p className="font-semibold text-slate-600">
        PESAGE 2000 SARL — Capital Social : 1 000 000 DH — Matériel de Pesage Industriel & Métrologie Légale
      </p>
      <p>
        Siège Social : Casablanca, Maroc • Tél : +212 5 22 00 00 00 • Email : contact@pesage2000.ma
      </p>
      <p className="font-mono text-[9px] text-slate-400">
        R.C. : 284910 • I.F. : 14456920 • I.C.E. : 001524389000084 • Patente : 37920140 • CNSS : 8472910
      </p>
    </footer>
  );
};

// =========================================================================
// COMPLETE PRE-ASSEMBLED DOCUMENTS
// =========================================================================

// 1. DEVIS COMMERCIAL (QUOTE)
export const QuoteDocument: React.FC<{ quote: Quote }> = ({ quote }) => {
  const hasDiscount =
    quote.discount_amount > 0 || quote.items.some((it) => it.discount_rate > 0);

  return (
    <div className="space-y-6">
      <DocumentHeader
        title="DEVIS COMMERCIAL"
        reference={quote.reference}
        date={quote.quote_date}
        validUntil={quote.valid_until}
      />

      <PartnerInfoBlock
        label="Client"
        partner={quote.customer}
        fallbackName={`Client #${quote.customer_id}`}
        paymentTerms={quote.payment_terms}
        deliveryDelay={quote.delivery_delay}
        realizationDelay={quote.realization_delay}
        notes={quote.notes}
      />

      {/* Items Table */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-300">
            <tr>
              <th className="p-3 w-[45%]">Désignation</th>
              <th className="p-3 text-center w-[10%]">Qté</th>
              <th className="p-3 text-right w-[15%]">Prix Unit. HT</th>
              {hasDiscount && <th className="p-3 text-center w-[10%]">Remise</th>}
              <th className="p-3 text-center w-[10%]">TVA</th>
              <th className="p-3 text-right w-[15%]">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {quote.items.map((it) => (
              <tr key={it.id} className="avoid-page-break">
                <td className="p-3">
                  <p className="font-semibold text-slate-900 leading-tight">
                    {it.product?.designation || `Produit #${it.product_id}`}
                  </p>
                  {it.product?.sku && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Réf: {it.product.sku}
                    </p>
                  )}
                </td>
                <td className="p-3 text-center font-medium text-slate-800">{it.quantity}</td>
                <td className="p-3 text-right font-mono text-slate-800">{formatCurrency(it.unit_price_ht)}</td>
                {hasDiscount && (
                  <td className="p-3 text-center text-amber-700 font-semibold font-mono">
                    {it.discount_rate > 0 ? `${it.discount_rate}%` : ''}
                  </td>
                )}
                <td className="p-3 text-center text-slate-600 font-mono">{it.tax_rate}%</td>
                <td className="p-3 text-right font-bold font-mono text-slate-900">
                  {formatCurrency(it.line_total_ttc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TotalsBlock
        subtotalHt={quote.subtotal_ht}
        discountAmount={quote.discount_amount}
        taxAmount={quote.tax_amount}
        totalTtc={quote.total_ttc}
      />

      <SignaturesBlock
        leftTitle="Pour PESAGE 2000 SARL"
        leftSubtitle="Cachet & Signature autorisée"
        rightTitle="Bon pour accord & Commande"
        rightSubtitle="Date, Signature & Cachet du Client"
      />

      <DocumentFooter />
    </div>
  );
};

// 2. FACTURE VENTE (CUSTOMER INVOICE)
export const CustomerInvoiceDocument: React.FC<{ invoice: Invoice }> = ({ invoice }) => {
  const hasDiscount =
    invoice.discount_amount > 0 || invoice.items.some((it) => it.discount_rate > 0);

  return (
    <div className="space-y-6">
      <DocumentHeader
        title="FACTURE DE VENTE"
        reference={invoice.reference}
        date={invoice.invoice_date}
        dueDate={invoice.due_date}
        sourceReference={invoice.sale?.reference}
        sourceLabel="Réf. Commande Vente"
      />

      <PartnerInfoBlock
        label="Client"
        partner={invoice.customer}
        fallbackName={`Client #${invoice.customer_id}`}
        paymentTerms={invoice.payment_terms}
        notes={invoice.notes}
      />

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-300">
            <tr>
              <th className="p-3 w-[45%]">Désignation</th>
              <th className="p-3 text-center w-[10%]">Qté</th>
              <th className="p-3 text-right w-[15%]">Prix Unit. HT</th>
              {hasDiscount && <th className="p-3 text-center w-[10%]">Remise</th>}
              <th className="p-3 text-center w-[10%]">TVA</th>
              <th className="p-3 text-right w-[15%]">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.items.map((it) => (
              <tr key={it.id} className="avoid-page-break">
                <td className="p-3">
                  <p className="font-semibold text-slate-900 leading-tight">
                    {it.product?.designation || it.description || `Produit #${it.product_id}`}
                  </p>
                  {it.product?.sku && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Réf: {it.product.sku}
                    </p>
                  )}
                </td>
                <td className="p-3 text-center font-medium text-slate-800">{it.quantity}</td>
                <td className="p-3 text-right font-mono text-slate-800">{formatCurrency(it.unit_price_ht)}</td>
                {hasDiscount && (
                  <td className="p-3 text-center text-amber-700 font-semibold font-mono">
                    {it.discount_rate > 0 ? `${it.discount_rate}%` : ''}
                  </td>
                )}
                <td className="p-3 text-center text-slate-600 font-mono">{it.tax_rate}%</td>
                <td className="p-3 text-right font-bold font-mono text-slate-900">
                  {formatCurrency(it.line_total_ttc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TotalsBlock
        subtotalHt={invoice.subtotal_ht}
        discountAmount={invoice.discount_amount}
        taxAmount={invoice.tax_amount}
        totalTtc={invoice.total_ttc}
        amountPaid={invoice.amount_paid}
        amountDue={invoice.amount_due}
      />

      <SignaturesBlock
        leftTitle="Pour PESAGE 2000 SARL"
        leftSubtitle="Direction Financière & Comptabilité"
        rightTitle="Pour le Client"
        rightSubtitle="Mention 'Bon pour accord de paiement'"
      />

      <DocumentFooter />
    </div>
  );
};

// 3. FACTURE ACHAT (SUPPLIER INVOICE)
export const SupplierInvoiceDocument: React.FC<{ invoice: Invoice }> = ({ invoice }) => {
  const hasDiscount =
    invoice.discount_amount > 0 || invoice.items.some((it) => it.discount_rate > 0);

  return (
    <div className="space-y-6">
      <DocumentHeader
        title="FACTURE D'ACHAT"
        reference={invoice.reference}
        date={invoice.invoice_date}
        dueDate={invoice.due_date}
        sourceReference={invoice.purchase_order?.reference}
        sourceLabel="Réf. Bon de Commande"
      />

      <PartnerInfoBlock
        label="Fournisseur"
        partner={invoice.supplier}
        fallbackName={`Fournisseur #${invoice.supplier_id}`}
        paymentTerms={invoice.payment_terms}
        notes={invoice.notes}
      />

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-300">
            <tr>
              <th className="p-3 w-[45%]">Désignation Fournisseur</th>
              <th className="p-3 text-center w-[10%]">Qté</th>
              <th className="p-3 text-right w-[15%]">Prix Unit. HT</th>
              {hasDiscount && <th className="p-3 text-center w-[10%]">Remise</th>}
              <th className="p-3 text-center w-[10%]">TVA</th>
              <th className="p-3 text-right w-[15%]">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {invoice.items.map((it) => (
              <tr key={it.id} className="avoid-page-break">
                <td className="p-3">
                  <p className="font-semibold text-slate-900 leading-tight">
                    {it.product?.designation || it.description || `Article #${it.product_id}`}
                  </p>
                  {it.product?.sku && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Réf: {it.product.sku}
                    </p>
                  )}
                </td>
                <td className="p-3 text-center font-medium text-slate-800">{it.quantity}</td>
                <td className="p-3 text-right font-mono text-slate-800">{formatCurrency(it.unit_price_ht)}</td>
                {hasDiscount && (
                  <td className="p-3 text-center text-amber-700 font-semibold font-mono">
                    {it.discount_rate > 0 ? `${it.discount_rate}%` : ''}
                  </td>
                )}
                <td className="p-3 text-center text-slate-600 font-mono">{it.tax_rate}%</td>
                <td className="p-3 text-right font-bold font-mono text-slate-900">
                  {formatCurrency(it.line_total_ttc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TotalsBlock
        subtotalHt={invoice.subtotal_ht}
        discountAmount={invoice.discount_amount}
        taxAmount={invoice.tax_amount}
        totalTtc={invoice.total_ttc}
        amountPaid={invoice.amount_paid}
        amountDue={invoice.amount_due}
      />

      <SignaturesBlock
        leftTitle="Pour le Fournisseur"
        leftSubtitle="Émission & Cachet Commercial"
        rightTitle="Pour PESAGE 2000 SARL"
        rightSubtitle="Service Achats & Bon à Payer"
      />

      <DocumentFooter />
    </div>
  );
};

// 4. BON DE LIVRAISON (DELIVERY NOTE)
export const DeliveryNoteDocument: React.FC<{ deliveryNote: DeliveryNote }> = ({ deliveryNote }) => {
  return (
    <div className="space-y-6">
      <DocumentHeader
        title="BON DE LIVRAISON"
        reference={deliveryNote.reference}
        date={deliveryNote.delivery_date}
        dateLabel="Date de livraison"
        sourceReference={deliveryNote.sale?.reference}
        sourceLabel="Réf. Commande Vente"
      />

      <PartnerInfoBlock
        label="Destinataire"
        partner={deliveryNote.customer}
        fallbackName={`Client #${deliveryNote.customer_id}`}
        shippingAddress={deliveryNote.shipping_address}
        trackingNumber={deliveryNote.tracking_number}
        notes={deliveryNote.notes}
      />

      {/* Quantities & Products Table (No unnecessary pricing columns) */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-300">
            <tr>
              <th className="p-3 w-[20%]">Réf. Article</th>
              <th className="p-3 w-[45%]">Désignation</th>
              <th className="p-3 text-center w-[15%]">Qté Commandée</th>
              <th className="p-3 text-center w-[15%] bg-emerald-50 text-emerald-950 font-black">Qté Livrée</th>
              <th className="p-3 w-[15%]">Observations</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {deliveryNote.items.map((it) => (
              <tr key={it.id} className="avoid-page-break">
                <td className="p-3 font-mono font-semibold text-slate-700">
                  {it.product?.sku || `PROD-${it.product_id}`}
                </td>
                <td className="p-3">
                  <p className="font-semibold text-slate-900 leading-tight">
                    {it.product?.designation || `Produit #${it.product_id}`}
                  </p>
                  {it.warehouse && (
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      Magasin: {it.warehouse.name}
                    </p>
                  )}
                </td>
                <td className="p-3 text-center font-medium text-slate-700">{it.ordered_quantity}</td>
                <td className="p-3 text-center font-black text-emerald-800 bg-emerald-50/50">
                  {it.delivered_quantity}
                </td>
                <td className="p-3 text-slate-600 italic">{it.notes || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SignaturesBlock
        leftTitle="Expédié par PESAGE 2000 SARL"
        leftSubtitle="Nom, Signature du Livreur & Date"
        rightTitle="Réceptionné par le Client"
        rightSubtitle="Date, Nom, Cachet & Mention 'Reçu conforme'"
      />

      <DocumentFooter />
    </div>
  );
};

// 5. AVOIR CLIENT (CREDIT NOTE)
const CREDIT_REASON_LABELS: Record<string, string> = {
  [CreditNoteReason.RETURN]: 'Retour de marchandise',
  [CreditNoteReason.BILLING_ERROR]: 'Erreur de facturation',
  [CreditNoteReason.COMMERCIAL_DISCOUNT]: 'Geste / Remise commerciale',
  [CreditNoteReason.PARTIAL_CANCELLATION]: 'Annulation partielle',
  [CreditNoteReason.PRICE_CORRECTION]: 'Rectification de prix',
  [CreditNoteReason.DEFECTIVE_PRODUCT]: 'Produit défectueux / Non conforme',
  [CreditNoteReason.OTHER]: 'Autre motif',
};

export const CreditNoteDocument: React.FC<{ creditNote: CreditNote }> = ({ creditNote }) => {
  return (
    <div className="space-y-6">
      <DocumentHeader
        title="AVOIR CLIENT"
        reference={creditNote.reference}
        date={creditNote.credit_note_date}
        sourceReference={`Facture #${creditNote.invoice_id}`}
        sourceLabel="Facture d'Origine"
      />

      {/* Credit Reason Banner */}
      <div className="bg-amber-50/90 border border-amber-200 text-amber-950 p-3.5 rounded-xl text-xs flex items-center justify-between avoid-page-break">
        <div>
          <span className="font-bold uppercase tracking-wider text-[11px] text-amber-900 block">
            Motif de l'Avoir :
          </span>
          <span className="font-semibold text-sm">
            {CREDIT_REASON_LABELS[creditNote.reason] || creditNote.reason}
          </span>
          {creditNote.reason_details && (
            <span className="text-amber-800 ml-2">({creditNote.reason_details})</span>
          )}
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-bold uppercase bg-amber-200/70 text-amber-900 border border-amber-300">
          Note de Crédit
        </span>
      </div>

      <PartnerInfoBlock
        label="Client"
        partner={creditNote.customer}
        fallbackName={`Client #${creditNote.customer_id}`}
        notes={creditNote.notes}
      />

      {/* Credited Items */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-300">
            <tr>
              <th className="p-3 w-[45%]">Désignation</th>
              <th className="p-3 text-center w-[10%]">Qté Avoir</th>
              <th className="p-3 text-right w-[15%]">Prix Unit. HT</th>
              <th className="p-3 text-center w-[10%]">TVA</th>
              <th className="p-3 text-right w-[20%]">Total TTC Crédité</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {creditNote.items && creditNote.items.length > 0 ? (
              creditNote.items.map((it) => (
                <tr key={it.id} className="avoid-page-break">
                  <td className="p-3">
                    <p className="font-semibold text-slate-900 leading-tight">
                      {it.product?.designation || it.description}
                    </p>
                    {it.product?.sku && (
                      <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                        Réf: {it.product.sku}
                      </p>
                    )}
                    {it.return_to_stock && (
                      <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Retourné en stock
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-center font-bold text-slate-900">{it.quantity}</td>
                  <td className="p-3 text-right font-mono text-slate-800">{formatCurrency(it.unit_price_ht)}</td>
                  <td className="p-3 text-center font-mono text-slate-600">{it.tax_rate}%</td>
                  <td className="p-3 text-right font-bold font-mono text-[#001BB7]">
                    {formatCurrency(it.line_total_ttc)}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                  Avoir global sur facture #{creditNote.invoice_id}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <TotalsBlock
        subtotalHt={creditNote.subtotal_ht}
        discountAmount={creditNote.discount_amount}
        taxAmount={creditNote.tax_amount}
        totalTtc={creditNote.total_ttc}
      />

      <SignaturesBlock
        leftTitle="Pour PESAGE 2000 SARL"
        leftSubtitle="Service Comptabilité & Direction"
        rightTitle="Reçu par le Client"
        rightSubtitle="Date, Nom, Cachet & Signature"
      />

      <DocumentFooter />
    </div>
  );
};

// 6. RAPPORT TECHNIQUE D'INTERVENTION (MAINTENANCE)
const EQUIPMENT_TYPE_NAMES: Record<string, string> = {
  [EquipmentType.PONTS_BASCULES]: 'Pont-bascule',
  [EquipmentType.BALANCES_INDUSTRIELLES]: 'Balance industrielle',
  [EquipmentType.BALANCES_PLATEFORMES]: 'Balance plateforme',
  [EquipmentType.INDICATEURS_POIDS]: 'Indicateur de poids',
  [EquipmentType.CAPTEURS_CHARGE]: 'Capteur de charge',
  [EquipmentType.TERMINAUX_PESAGE]: 'Terminal de pesage',
  [EquipmentType.IMPRIMANTES_TICKETS]: 'Imprimante tickets',
  [EquipmentType.AUTRE]: 'Autre équipement de pesage',
};

const INTERVENTION_TYPE_NAMES: Record<string, string> = {
  [InterventionType.PREVENTIVE_MAINTENANCE]: 'Maintenance préventive',
  [InterventionType.CORRECTIVE_MAINTENANCE]: 'Maintenance corrective',
  [InterventionType.BREAKDOWN_REPAIR]: 'Dépannage urgent',
  [InterventionType.CALIBRATION]: 'Étalonnage & Calibration',
  [InterventionType.INSTALLATION]: 'Installation & Mise en service',
  [InterventionType.INSPECTION]: 'Contrôle & Inspection',
  [InterventionType.METROLOGY_LEGAL]: 'Métrologie légale',
  [InterventionType.STAMPING]: 'Poinçonnage officiel',
  [InterventionType.OTHER]: 'Autre intervention',
};

export const InterventionReportDocument: React.FC<{ intervention: Intervention }> = ({
  intervention,
}) => {
  return (
    <div className="space-y-6">
      <DocumentHeader
        title="RAPPORT TECHNIQUE"
        reference={intervention.intervention_code}
        date={intervention.date_start}
        dateLabel="Date début"
      />

      {/* Client & Equipment Boxes */}
      <div className="grid grid-cols-2 gap-4 avoid-page-break">
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
          <div className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] text-[#001BB7] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#001BB7]" />
            <span>CLIENT & SITE D'INTERVENTION</span>
          </div>
          <div className="font-bold text-sm text-slate-900">
            {intervention.customer?.legal_name ||
              intervention.customer?.trade_name ||
              intervention.customer?.company_name ||
              `Client #${intervention.customer_id}`}
          </div>
          {intervention.site && (
            <p className="text-slate-700">
              <span className="text-slate-500 font-medium">Site :</span> {intervention.site}
            </p>
          )}
          {intervention.customer?.city && (
            <p className="text-slate-700">
              <span className="text-slate-500 font-medium">Ville :</span> {intervention.customer.city}
            </p>
          )}
          {(intervention.customer?.ice || intervention.customer?.tax_id) && (
            <p className="text-slate-800 font-medium">
              <span className="text-slate-500 font-medium">ICE :</span>{' '}
              <span className="font-mono">{intervention.customer.ice || intervention.customer.tax_id}</span>
            </p>
          )}
          {intervention.customer?.phone && (
            <p className="text-slate-700">
              <span className="text-slate-500 font-medium">Tél :</span> {intervention.customer.phone}
            </p>
          )}
        </div>

        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
          <div className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px] text-[#001BB7] flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#001BB7]" />
            <span>ÉQUIPEMENT DE PESAGE</span>
          </div>
          <div className="font-bold text-sm text-slate-900">
            {intervention.equipment?.designation || 'Équipement Pesage'}
          </div>
          <div className="text-slate-700">
            <span className="text-slate-500 font-medium">Type :</span>{' '}
            {intervention.equipment
              ? EQUIPMENT_TYPE_NAMES[intervention.equipment.equipment_type] || intervention.equipment.equipment_type
              : 'Standard'}
          </div>
          <div className="text-slate-700">
            {intervention.equipment?.serial_number && (
              <span>
                <span className="text-slate-500 font-medium">N° Série :</span>{' '}
                <span className="font-mono font-semibold">{intervention.equipment.serial_number}</span>
              </span>
            )}
            {intervention.equipment?.serial_number && intervention.equipment?.brand && <span> • </span>}
            {intervention.equipment?.brand && (
              <span>
                <span className="text-slate-500 font-medium">Marque :</span> {intervention.equipment.brand}
              </span>
            )}
          </div>
          {intervention.equipment?.capacity_max && (
            <div className="text-slate-700">
              <span className="text-slate-500 font-medium">Portée Max :</span>{' '}
              <span className="font-bold text-slate-900">{intervention.equipment.capacity_max} kg</span>
            </div>
          )}
        </div>
      </div>

      {/* Operation Meta */}
      <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs avoid-page-break">
        <div>
          <span className="text-slate-500 font-medium block">Type d'intervention :</span>
          <span className="font-bold text-slate-900 mt-0.5 block">
            {INTERVENTION_TYPE_NAMES[intervention.intervention_type] || intervention.intervention_type}
          </span>
        </div>
        <div>
          <span className="text-slate-500 font-medium block">Technicien Métrologue :</span>
          <span className="font-bold text-slate-900 mt-0.5 block">
            {intervention.technician
              ? `${intervention.technician.first_name} ${intervention.technician.last_name}`
              : 'Équipe Métrologie Pesage 2000'}
          </span>
        </div>
        <div>
          <span className="text-slate-500 font-medium block">Statut d'exécution :</span>
          <span className="font-bold text-emerald-800 uppercase mt-0.5 block">
            {intervention.status}
          </span>
        </div>
      </div>

      {/* Diagnostic & Problem Description */}
      {(intervention.problem_description || intervention.diagnosis) && (
        <div className="space-y-3 text-xs avoid-page-break">
          {intervention.problem_description && (
            <div>
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                Demande initiale & Anomalie signalée
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed">
                {intervention.problem_description}
              </div>
            </div>
          )}
          {intervention.diagnosis && (
            <div>
              <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px] mb-1">
                Diagnostic & Constats Métrologiques
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 leading-relaxed">
                {intervention.diagnosis}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Operations / Tasks Checklist */}
      {intervention.tasks && intervention.tasks.length > 0 && (
        <div className="space-y-2 text-xs avoid-page-break">
          <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Contrôles Métrologiques & Travaux Réalisés
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200">
            {intervention.tasks.map((t, idx) => (
              <div key={idx} className="p-2.5 flex items-center justify-between text-xs bg-white">
                <div className="flex items-center space-x-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="text-slate-900 font-medium">{t.description}</span>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase">
                  {t.status === TaskStatus.COMPLETED ? 'Conforme / Réalisé' : t.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Replaced Parts (if any) */}
      {intervention.parts && intervention.parts.length > 0 && (
        <div className="space-y-2 text-xs avoid-page-break">
          <div className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            Pièces & Organes de Pesage Remplacés
          </div>
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-slate-100 text-slate-800 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-2.5 text-left">Désignation</th>
                  <th className="p-2.5 text-center w-20">Qté</th>
                  <th className="p-2.5 text-right w-28">P.U HT</th>
                  <th className="p-2.5 text-right w-32">Total HT</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {intervention.parts.map((p, idx) => (
                  <tr key={idx}>
                    <td className="p-2.5 text-slate-900 font-medium">{p.designation}</td>
                    <td className="p-2.5 text-center font-bold">{p.quantity}</td>
                    <td className="p-2.5 text-right font-mono">{formatCurrency(p.unit_price)}</td>
                    <td className="p-2.5 text-right font-mono font-bold">{formatCurrency(p.total_ht)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Observations & Next Visit */}
      {(intervention.observations || intervention.recommendations) && (
        <div className="grid grid-cols-2 gap-4 text-xs avoid-page-break">
          {intervention.observations && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 uppercase text-[10px] text-[#001BB7]">
                Observations Métrologiques
              </div>
              <div className="text-slate-800 leading-relaxed">{intervention.observations}</div>
            </div>
          )}
          {intervention.recommendations && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <div className="font-bold text-slate-900 uppercase text-[10px] text-[#FF5B36]">
                Recommandations & Échéances
              </div>
              <div className="text-slate-800 leading-relaxed">{intervention.recommendations}</div>
              {intervention.next_maintenance_date && (
                <div className="font-bold text-[#FF5B36] pt-1 border-t border-slate-200 mt-1">
                  Prochaine visite métrologique : {formatDateShort(intervention.next_maintenance_date)}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      <SignaturesBlock
        leftTitle="Le Technicien Métrologue Pesage 2000"
        leftSubtitle="Signature & Cachet technique"
        rightTitle="Le Responsable Client (Bon pour accord)"
        rightSubtitle="Nom, Visa & Cachet société"
      />

      <DocumentFooter />
    </div>
  );
};

// 7. BON DE COMMANDE VENTE (SALE ORDER)
export const SaleOrderDocument: React.FC<{ sale: Sale }> = ({ sale }) => {
  const hasDiscount =
    sale.discount_amount > 0 || sale.items.some((it) => it.discount_rate > 0);

  return (
    <div className="space-y-6">
      <DocumentHeader
        title="BON DE COMMANDE VENTE"
        reference={sale.reference}
        date={sale.order_date}
        sourceReference={sale.quote ? sale.quote.reference : sale.quote_id ? `Devis #${sale.quote_id}` : undefined}
        sourceLabel="Devis d'Origine"
      />

      <PartnerInfoBlock
        label="Client"
        partner={sale.customer}
        fallbackName={`Client #${sale.customer_id}`}
        paymentTerms={sale.payment_terms}
        deliveryDelay={sale.delivery_delay}
        realizationDelay={sale.realization_delay}
        notes={sale.notes}
      />

      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs text-left">
          <thead className="bg-slate-100 text-slate-800 font-bold border-b-2 border-slate-300">
            <tr>
              <th className="p-3 w-[45%]">Désignation</th>
              <th className="p-3 text-center w-[10%]">Qté</th>
              <th className="p-3 text-right w-[15%]">Prix Unit. HT</th>
              {hasDiscount && <th className="p-3 text-center w-[10%]">Remise</th>}
              <th className="p-3 text-center w-[10%]">TVA</th>
              <th className="p-3 text-right w-[15%]">Total TTC</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sale.items.map((it) => (
              <tr key={it.id} className="avoid-page-break">
                <td className="p-3">
                  <p className="font-semibold text-slate-900 leading-tight">
                    {it.product?.designation || `Produit #${it.product_id}`}
                  </p>
                  {it.product?.sku && (
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      Réf: {it.product.sku}
                    </p>
                  )}
                </td>
                <td className="p-3 text-center font-medium text-slate-800">{it.quantity}</td>
                <td className="p-3 text-right font-mono text-slate-800">{formatCurrency(it.unit_price_ht)}</td>
                {hasDiscount && (
                  <td className="p-3 text-center text-amber-700 font-semibold font-mono">
                    {it.discount_rate > 0 ? `${it.discount_rate}%` : ''}
                  </td>
                )}
                <td className="p-3 text-center text-slate-600 font-mono">{it.tax_rate}%</td>
                <td className="p-3 text-right font-bold font-mono text-slate-900">
                  {formatCurrency(it.line_total_ttc)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <TotalsBlock
        subtotalHt={sale.subtotal_ht}
        discountAmount={sale.discount_amount}
        taxAmount={sale.tax_amount}
        totalTtc={sale.total_ttc}
      />

      <SignaturesBlock
        leftTitle="Pour PESAGE 2000 SARL"
        leftSubtitle="Direction Commerciale"
        rightTitle="Bon pour accord Client"
        rightSubtitle="Date, Signature & Cachet"
      />

      <DocumentFooter />
    </div>
  );
};
