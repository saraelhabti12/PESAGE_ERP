import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import {
  BusinessPartner,
  PartnerContact,
  PartnerAddress,
  PartnerUpdate,
  PartnerContactCreate,
  PartnerContactUpdate,
  PartnerAddressCreate,
  PartnerAddressUpdate,
  AddressType,
  PartnerSummaryResponse,
} from '@/types/partner';
import { AttachmentsSection } from '@/components/common/AttachmentsSection';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/LoadingState';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { formatDate, formatCurrency } from '@/lib/formatters';
import {
  ArrowLeft,
  Building2,
  Phone,
  Mail,
  Globe,
  MapPin,
  FileBadge,
  UserCheck,
  Plus,
  Edit2,
  Trash2,
  Star,
  Ban,
  CheckCircle2,
  Loader2,
  Layers,
  FileText,
  ShoppingCart,
  ShoppingBag,
  Truck,
  CreditCard,
  Wrench,
  FolderArchive,
  BarChart3,
  Info,
  Calendar,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Clock,
  Receipt,
  RotateCcw,
  ClipboardList,
  Package,
} from 'lucide-react';

type TabType =
  | 'info'
  | 'contacts'
  | 'addresses'
  | 'quotes'
  | 'sales'
  | 'deliveries'
  | 'invoices'
  | 'credit_notes'
  | 'payments'
  | 'interventions'
  | 'purchases'
  | 'receipts'
  | 'supplier_invoices'
  | 'supplier_payments'
  | 'documents'
  | 'analytics';

export const PartnerDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [partner, setPartner] = useState<BusinessPartner | null>(null);
  const [contacts, setContacts] = useState<PartnerContact[]>([]);
  const [addresses, setAddresses] = useState<PartnerAddress[]>([]);
  const [summary, setSummary] = useState<PartnerSummaryResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  // Customer tab data state
  const [tabQuotes, setTabQuotes] = useState<any[]>([]);
  const [tabSales, setTabSales] = useState<any[]>([]);
  const [tabDeliveries, setTabDeliveries] = useState<any[]>([]);
  const [tabInvoices, setTabInvoices] = useState<any[]>([]);
  const [tabCreditNotes, setTabCreditNotes] = useState<any[]>([]);
  const [tabPayments, setTabPayments] = useState<any[]>([]);
  const [tabInterventions, setTabInterventions] = useState<any[]>([]);

  // Supplier tab data state
  const [tabPurchases, setTabPurchases] = useState<any[]>([]);
  const [tabReceipts, setTabReceipts] = useState<any[]>([]);
  const [tabSupplierInvoices, setTabSupplierInvoices] = useState<any[]>([]);
  const [tabSupplierPayments, setTabSupplierPayments] = useState<any[]>([]);

  const [isTabLoading, setIsTabLoading] = useState(false);

  // Partner edit & deactivation
  const [isEditPartnerOpen, setIsEditPartnerOpen] = useState(false);
  const [isDeactivatingPartner, setIsDeactivatingPartner] = useState(false);
  const [partnerFormData, setPartnerFormData] = useState<PartnerUpdate>({});

  // Contact modals
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<PartnerContact | null>(null);
  const [deletingContact, setDeletingContact] = useState<PartnerContact | null>(null);
  const [contactForm, setContactForm] = useState<PartnerContactCreate>({
    first_name: '',
    last_name: '',
    position: '',
    phone: '',
    email: '',
    is_primary: false,
    notes: '',
  });

  // Address modals
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<PartnerAddress | null>(null);
  const [deletingAddress, setDeletingAddress] = useState<PartnerAddress | null>(null);
  const [addressForm, setAddressForm] = useState<PartnerAddressCreate>({
    type: 'MAIN',
    label: '',
    address_line: '',
    city: '',
    postal_code: '',
    country: 'Maroc',
    is_primary: false,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('partners.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('partners.delete');
  const canManageContacts = roleNames.includes('ADMIN') || userPerms.includes('contacts.create');
  const canManageAddresses = roleNames.includes('ADMIN') || userPerms.includes('addresses.create');

  const fetchPartnerDetails = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    try {
      const [partnerRes, contactsRes, addressesRes, summaryRes] = await Promise.all([
        api.get<BusinessPartner>(`/api/v1/partners/${id}`),
        api.get<PartnerContact[]>(`/api/v1/partners/${id}/contacts`),
        api.get<PartnerAddress[]>(`/api/v1/partners/${id}/addresses`),
        api.get<PartnerSummaryResponse>(`/api/v1/partners/${id}/summary`).catch(() => ({ data: null })),
      ]);
      setPartner(partnerRes.data);
      setContacts(contactsRes.data);
      setAddresses(addressesRes.data);
      if (summaryRes?.data) {
        setSummary(summaryRes.data);
      }
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Impossible de charger les détails du partenaire.');
    } finally {
      setIsLoading(false);
    }
  }, [id, showError]);

  // Lazy load tab data when tab changes
  const fetchTabData = useCallback(async (tab: TabType, partnerId: string) => {
    if (tab === 'info' || tab === 'contacts' || tab === 'addresses' || tab === 'documents') return;
    setIsTabLoading(true);
    try {
      if (tab === 'quotes') {
        const res = await api.get(`/api/v1/quotes?customer_id=${partnerId}&size=50`);
        setTabQuotes(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'sales') {
        const res = await api.get(`/api/v1/sales?customer_id=${partnerId}&size=50`);
        setTabSales(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'deliveries') {
        const res = await api.get(`/api/v1/delivery-notes?customer_id=${partnerId}&size=50`);
        setTabDeliveries(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'invoices') {
        const res = await api.get(`/api/v1/invoices?customer_id=${partnerId}&invoice_type=CUSTOMER&size=50`);
        setTabInvoices(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'credit_notes') {
        const res = await api.get(`/api/v1/credit-notes?customer_id=${partnerId}&size=50`);
        setTabCreditNotes(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'payments') {
        const res = await api.get(`/api/v1/payments?customer_id=${partnerId}&size=50`);
        setTabPayments(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'interventions') {
        const res = await api.get(`/api/v1/maintenance/interventions?customer_id=${partnerId}&size=50`);
        setTabInterventions(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'purchases') {
        const res = await api.get(`/api/v1/purchases?supplier_id=${partnerId}&size=50`);
        setTabPurchases(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'receipts') {
        const res = await api.get(`/api/v1/purchase-receipts?supplier_id=${partnerId}&size=50`);
        setTabReceipts(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'supplier_invoices') {
        const res = await api.get(`/api/v1/invoices?supplier_id=${partnerId}&invoice_type=SUPPLIER&size=50`);
        setTabSupplierInvoices(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'supplier_payments') {
        const res = await api.get(`/api/v1/payments?supplier_id=${partnerId}&size=50`);
        setTabSupplierPayments(Array.isArray(res.data) ? res.data : res.data?.items || []);
      } else if (tab === 'analytics') {
        const res = await api.get(`/api/v1/partners/${partnerId}/summary`);
        setSummary(res.data);
      }
    } catch (_err) {
      // silently fail tab data load
    } finally {
      setIsTabLoading(false);
    }
  }, []);

  useEffect(() => {
    if (id && activeTab !== 'info' && activeTab !== 'contacts' && activeTab !== 'addresses') {
      fetchTabData(activeTab, id);
    }
  }, [activeTab, id, fetchTabData]);

  useEffect(() => {
    fetchPartnerDetails();
  }, [fetchPartnerDetails]);

  // Handle Partner Edit
  const handleOpenEditPartner = () => {
    if (!partner) return;
    setModalError(null);
    setPartnerFormData({
      code: partner.code,
      legal_name: partner.legal_name,
      trade_name: partner.trade_name || '',
      partner_type: partner.partner_type,
      ice: partner.ice || '',
      tax_id: partner.tax_id || '',
      registration_number: partner.registration_number || '',
      phone: partner.phone || '',
      email: partner.email || '',
      website: partner.website || '',
      address: partner.address || '',
      city: partner.city || '',
      postal_code: partner.postal_code || '',
      country: partner.country || 'Maroc',
      notes: partner.notes || '',
      is_active: partner.is_active,
    });
    setIsEditPartnerOpen(true);
  };

  const handleSubmitEditPartner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload: PartnerUpdate = {
        ...partnerFormData,
        email: partnerFormData.email ? partnerFormData.email : undefined,
      };
      await api.put(`/api/v1/partners/${partner.id}`, payload);
      showSuccess('Partenaire mis à jour avec succès.');
      setIsEditPartnerOpen(false);
      fetchPartnerDetails();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Échec de la mise à jour.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTogglePartnerActive = async () => {
    if (!partner) return;
    setIsSubmitting(true);
    try {
      const newStatus = !partner.is_active;
      await api.put(`/api/v1/partners/${partner.id}`, { is_active: newStatus });
      showSuccess(newStatus ? 'Partenaire réactivé avec succès.' : 'Partenaire désactivé avec succès.');
      setIsDeactivatingPartner(false);
      fetchPartnerDetails();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Action impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contacts handlers
  const handleOpenCreateContact = () => {
    setModalError(null);
    setEditingContact(null);
    setContactForm({
      first_name: '',
      last_name: '',
      position: '',
      phone: '',
      email: '',
      is_primary: contacts.length === 0,
      notes: '',
    });
    setIsContactModalOpen(true);
  };

  const handleOpenEditContact = (c: PartnerContact) => {
    setModalError(null);
    setEditingContact(c);
    setContactForm({
      first_name: c.first_name,
      last_name: c.last_name,
      position: c.position || '',
      phone: c.phone || '',
      email: c.email || '',
      is_primary: c.is_primary,
      notes: c.notes || '',
    });
    setIsContactModalOpen(true);
  };

  const handleSubmitContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        ...contactForm,
        email: contactForm.email ? contactForm.email : undefined,
      };

      if (editingContact) {
        await api.put(`/api/v1/partners/${partner.id}/contacts/${editingContact.id}`, payload);
        showSuccess('Contact mis à jour.');
      } else {
        await api.post(`/api/v1/partners/${partner.id}/contacts`, payload);
        showSuccess('Contact ajouté.');
      }
      setIsContactModalOpen(false);
      fetchPartnerDetails();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement du contact.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteContact = async () => {
    if (!partner || !deletingContact) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/partners/${partner.id}/contacts/${deletingContact.id}`);
      showSuccess('Contact supprimé.');
      setDeletingContact(null);
      fetchPartnerDetails();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Erreur lors de la suppression.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Addresses handlers
  const handleOpenCreateAddress = () => {
    setModalError(null);
    setEditingAddress(null);
    setAddressForm({
      type: 'MAIN',
      label: '',
      address_line: '',
      city: partner?.city || '',
      postal_code: partner?.postal_code || '',
      country: partner?.country || 'Maroc',
      is_primary: addresses.length === 0,
    });
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (a: PartnerAddress) => {
    setModalError(null);
    setEditingAddress(a);
    setAddressForm({
      type: a.type,
      label: a.label || '',
      address_line: a.address_line,
      city: a.city || '',
      postal_code: a.postal_code || '',
      country: a.country || 'Maroc',
      is_primary: a.is_primary,
    });
    setIsAddressModalOpen(true);
  };

  const handleSubmitAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!partner) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      if (editingAddress) {
        await api.put(`/api/v1/partners/${partner.id}/addresses/${editingAddress.id}`, addressForm);
        showSuccess('Adresse mise à jour.');
      } else {
        await api.post(`/api/v1/partners/${partner.id}/addresses`, addressForm);
        showSuccess('Adresse ajoutée.');
      }
      setIsAddressModalOpen(false);
      fetchPartnerDetails();
    } catch (err: any) {
      setModalError(err.response?.data?.detail || 'Erreur lors de l\'enregistrement de l\'adresse.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteAddress = async () => {
    if (!partner || !deletingAddress) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/partners/${partner.id}/addresses/${deletingAddress.id}`);
      showSuccess('Adresse supprimée.');
      setDeletingAddress(null);
      fetchPartnerDetails();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Erreur lors de la suppression.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <LoadingState message="Chargement des données du partenaire..." />;
  }

  if (!partner) {
    return (
      <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
        <h2 className="text-base font-bold text-app-text mb-2">Partenaire introuvable</h2>
        <p className="text-xs text-app-text-muted mb-4">Le partenaire demandé n'existe pas ou a été supprimé.</p>
        <button
          onClick={() => navigate('/clients')}
          className="px-4 py-2 bg-pesage-blue text-white text-xs font-semibold rounded-xl"
        >
          Retour aux clients
        </button>
      </div>
    );
  }

  const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
  const primaryAddress = addresses.find((a) => a.is_primary) || addresses[0];

  const addressTypeLabel = (type: AddressType) => {
    switch (type) {
      case 'MAIN':
        return 'Siège / Principal';
      case 'BILLING':
        return 'Facturation';
      case 'SHIPPING':
        return 'Livraison';
      case 'OTHER':
        return 'Autre';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with Navigation & Quick Actions */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-3.5">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl border border-app-border bg-app-surface hover:bg-slate-100 text-slate-600 transition-colors"
              title="Retour"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="font-mono font-bold text-xs text-pesage-blue bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                  {partner.code}
                </span>
                <h1 className="text-xl font-bold text-app-text tracking-tight">{partner.legal_name}</h1>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${
                    partner.partner_type === 'CUSTOMER_SUPPLIER'
                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                      : partner.partner_type === 'CUSTOMER'
                      ? 'bg-blue-50 text-blue-700 border-blue-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {partner.partner_type === 'CUSTOMER_SUPPLIER'
                    ? 'Client & Fournisseur'
                    : partner.partner_type === 'CUSTOMER'
                    ? 'Client'
                    : 'Fournisseur'}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
                    partner.is_active
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {partner.is_active ? 'Compte Actif' : 'Inactif'}
                </span>
              </div>
              {partner.trade_name && (
                <span className="text-xs text-app-text-muted mt-0.5 block font-medium">
                  Nom commercial: {partner.trade_name}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center">
            {canUpdate && (
              <button
                onClick={handleOpenEditPartner}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-app-surface border border-app-border hover:bg-slate-50 text-app-text text-xs font-semibold shadow-2xs transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Modifier la fiche
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setIsDeactivatingPartner(true)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors ${
                  partner.is_active
                    ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                    : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                {partner.is_active ? <Ban className="w-3.5 h-3.5" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                {partner.is_active ? 'Désactiver' : 'Réactiver'}
              </button>
            )}
          </div>
        </div>

        {/* Overview Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-app-border">
          <div className="flex items-center gap-2.5 text-xs text-app-text">
            <FileBadge className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] text-app-text-muted uppercase tracking-wider block font-semibold">
                ICE
              </span>
              <span className="font-mono font-medium">{partner.ice || 'Non renseigné'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-app-text">
            <UserCheck className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] text-app-text-muted uppercase tracking-wider block font-semibold">
                Contact Principal
              </span>
              <span>
                {primaryContact
                  ? `${primaryContact.first_name} ${primaryContact.last_name}`
                  : 'Aucun contact'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-app-text">
            <MapPin className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] text-app-text-muted uppercase tracking-wider block font-semibold">
                Ville / Localisation
              </span>
              <span>{partner.city || 'Non renseignée'}</span>
            </div>
          </div>

          <div className="flex items-center gap-2.5 text-xs text-app-text">
            <Calendar className="w-4 h-4 text-slate-400 shrink-0" />
            <div>
              <span className="text-[10px] text-app-text-muted uppercase tracking-wider block font-semibold">
                Enregistré le
              </span>
              <span>{formatDate(partner.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Live Partner Summary Metrics */}
        <div className="mt-4 pt-4 border-t border-app-border">
          {partner.partner_type === 'SUPPLIER' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Commandes Achat</span>
                <span className="text-base font-bold text-app-text-primary">
                  {summary?.supplier?.total_purchases ?? tabPurchases.length ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Bons Réception</span>
                <span className="text-base font-bold text-pesage-blue">
                  {summary?.supplier?.total_receipts ?? tabReceipts.length ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Factures Achat</span>
                <span className="text-base font-bold text-app-text-primary">
                  {summary?.supplier?.total_invoices ?? tabSupplierInvoices.length ?? 0}
                </span>
                <span className="text-[10px] text-app-text-muted block truncate mt-0.5">
                  {formatCurrency(summary?.supplier?.amount_invoiced ?? 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Total Réglé</span>
                <span className="text-base font-bold text-emerald-600">
                  {formatCurrency(summary?.supplier?.amount_paid ?? 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Restant Dû</span>
                <span className="text-base font-bold text-rose-600">
                  {formatCurrency(summary?.supplier?.amount_due ?? 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Règlements</span>
                <span className="text-base font-bold text-indigo-600">
                  {summary?.supplier?.total_payments ?? tabSupplierPayments.length ?? 0}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Devis Émis</span>
                <span className="text-base font-bold text-app-text-primary">
                  {summary?.customer?.total_quotes ?? tabQuotes.length ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Ventes Validées</span>
                <span className="text-base font-bold text-pesage-blue">
                  {summary?.customer?.total_sales ?? tabSales.length ?? 0}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Factures Client</span>
                <span className="text-base font-bold text-app-text-primary">
                  {summary?.customer?.total_invoices ?? tabInvoices.length ?? 0}
                </span>
                <span className="text-[10px] text-app-text-muted block truncate mt-0.5">
                  {formatCurrency(summary?.customer?.amount_invoiced ?? 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Total Encaissé</span>
                <span className="text-base font-bold text-emerald-600">
                  {formatCurrency(summary?.customer?.amount_paid ?? 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Reste à Recouvrer</span>
                <span className="text-base font-bold text-rose-600">
                  {formatCurrency(summary?.customer?.amount_due ?? 0)}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-app-surface-subtle/60 border border-app-border">
                <span className="text-[10px] text-app-text-muted block font-medium">Interventions</span>
                <span className="text-base font-bold text-amber-600">
                  {summary?.customer?.total_interventions ?? tabInterventions.length ?? 0}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-app-border pb-1">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'info'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Vue d'ensemble
        </button>

        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'contacts'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
          }`}
        >
          <UserCheck className="w-3.5 h-3.5" />
          Contacts ({contacts.length})
        </button>

        <button
          onClick={() => setActiveTab('addresses')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'addresses'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Adresses ({addresses.length})
        </button>

        {partner.partner_type === 'SUPPLIER' ? (
          <>
            <button
              onClick={() => setActiveTab('purchases')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'purchases'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <ClipboardList className="w-3.5 h-3.5" />
              Commandes d'Achat
            </button>

            <button
              onClick={() => setActiveTab('receipts')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'receipts'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Réceptions
            </button>

            <button
              onClick={() => setActiveTab('supplier_invoices')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'supplier_invoices'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Factures Achat
            </button>

            <button
              onClick={() => setActiveTab('supplier_payments')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'supplier_payments'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Règlements
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setActiveTab('quotes')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'quotes'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              Devis
            </button>

            <button
              onClick={() => setActiveTab('sales')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'sales'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Ventes
            </button>

            <button
              onClick={() => setActiveTab('deliveries')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'deliveries'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <Truck className="w-3.5 h-3.5" />
              Bons de Livraison
            </button>

            <button
              onClick={() => setActiveTab('invoices')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'invoices'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <Receipt className="w-3.5 h-3.5" />
              Factures Vente
            </button>

            <button
              onClick={() => setActiveTab('credit_notes')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'credit_notes'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Avoirs Clients
            </button>

            <button
              onClick={() => setActiveTab('payments')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'payments'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <DollarSign className="w-3.5 h-3.5" />
              Règlements Client
            </button>

            <button
              onClick={() => setActiveTab('interventions')}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeTab === 'interventions'
                  ? 'bg-pesage-blue text-white shadow-xs'
                  : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
              }`}
            >
              <Wrench className="w-3.5 h-3.5" />
              Interventions
            </button>
          </>
        )}

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'documents'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5" />
          Documents & Pièces
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
          }`}
        >
          <BarChart3 className="w-3.5 h-3.5" />
          Analyse & KPI
        </button>
      </div>

      {/* Tab Content: Informations */}
      {activeTab === 'info' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
              <Building2 className="w-4 h-4 text-pesage-blue" />
              Identité & Coordonnées
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-app-text-muted block">Raison Sociale</span>
                <span className="font-semibold text-app-text">{partner.legal_name}</span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Nom Commercial</span>
                <span className="font-medium text-app-text">{partner.trade_name || '—'}</span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Téléphone</span>
                <span className="font-medium text-app-text flex items-center gap-1.5 mt-0.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {partner.phone || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Email</span>
                <span className="font-medium text-app-text flex items-center gap-1.5 mt-0.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  {partner.email || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Site Web</span>
                <span className="font-medium text-app-text flex items-center gap-1.5 mt-0.5">
                  <Globe className="w-3.5 h-3.5 text-slate-400" />
                  {partner.website ? (
                    <a href={partner.website} target="_blank" rel="noreferrer" className="text-pesage-blue underline">
                      {partner.website}
                    </a>
                  ) : (
                    '—'
                  )}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Pays</span>
                <span className="font-medium text-app-text">{partner.country || 'Maroc'}</span>
              </div>
            </div>

            <div className="pt-3 border-t border-app-border text-xs">
              <span className="text-[11px] text-app-text-muted block">Adresse principale déclarée</span>
              <span className="text-app-text mt-1 block">
                {partner.address ? `${partner.address}, ${partner.city || ''} ${partner.postal_code || ''}` : 'Non renseignée'}
              </span>
            </div>
          </div>

          <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-app-text flex items-center gap-2">
              <FileBadge className="w-4 h-4 text-pesage-orange" />
              Informations Légales & Fiscales
            </h3>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="text-[11px] text-app-text-muted block">Numéro ICE</span>
                <span className="font-mono font-bold text-slate-800 text-sm mt-0.5 block">
                  {partner.ice || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Identifiant Fiscal (IF)</span>
                <span className="font-mono font-semibold text-slate-800 mt-0.5 block">
                  {partner.tax_id || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Registre de Commerce (RC)</span>
                <span className="font-medium text-slate-800 mt-0.5 block">
                  {partner.registration_number || '—'}
                </span>
              </div>
              <div>
                <span className="text-[11px] text-app-text-muted block">Statut du Partenaire</span>
                <span className="font-semibold text-app-text mt-0.5 block">
                  {partner.is_active ? 'Actif' : 'Inactif'}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-app-border">
              <span className="text-[11px] text-app-text-muted block mb-1">Notes & Conditions Particulières</span>
              <div className="p-3 bg-app-surface-subtle rounded-xl text-xs text-app-text min-h-[60px]">
                {partner.notes || 'Aucune note enregistrée pour ce partenaire.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab Content: Contacts */}
      {activeTab === 'contacts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Interlocuteurs & Contacts</h3>
              <p className="text-xs text-app-text-muted">Gestion des contacts commerciaux, techniques et administratifs</p>
            </div>
            {canManageContacts && (
              <button
                onClick={handleOpenCreateContact}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Ajouter un contact
              </button>
            )}
          </div>

          {contacts.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <UserCheck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucun contact enregistré pour ce partenaire.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contacts.map((c) => (
                <div
                  key={c.id}
                  className={`p-4 rounded-2xl bg-app-surface border ${
                    c.is_primary ? 'border-pesage-blue/40 shadow-xs' : 'border-app-border'
                  } relative flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="font-bold text-sm text-app-text block">
                          {c.first_name} {c.last_name}
                        </span>
                        <span className="text-xs text-app-text-muted block">
                          {c.position || 'Poste non précisé'}
                        </span>
                      </div>
                      {c.is_primary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-pesage-blue text-[10px] font-bold border border-blue-200">
                          <Star className="w-3 h-3 fill-pesage-blue" />
                          Principal
                        </span>
                      )}
                    </div>

                    <div className="space-y-1.5 text-xs text-app-text mt-3 pt-3 border-t border-app-border">
                      {c.phone && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{c.phone}</span>
                        </div>
                      )}
                      {c.email && (
                        <div className="flex items-center gap-2 text-slate-700">
                          <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">{c.email}</span>
                        </div>
                      )}
                      {c.notes && (
                        <div className="text-[11px] text-app-text-muted bg-slate-50 p-2 rounded-lg mt-2">
                          {c.notes}
                        </div>
                      )}
                    </div>
                  </div>

                  {canManageContacts && (
                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-app-border">
                      <button
                        onClick={() => handleOpenEditContact(c)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingContact(c)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Addresses */}
      {activeTab === 'addresses' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Adresses & Sites</h3>
              <p className="text-xs text-app-text-muted">Gestion des adresses de livraison, facturation et dépôts</p>
            </div>
            {canManageAddresses && (
              <button
                onClick={handleOpenCreateAddress}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Ajouter une adresse
              </button>
            )}
          </div>

          {addresses.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucune adresse enregistrée pour ce partenaire.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {addresses.map((a) => (
                <div
                  key={a.id}
                  className={`p-4 rounded-2xl bg-app-surface border ${
                    a.is_primary ? 'border-pesage-blue/40 shadow-xs' : 'border-app-border'
                  } relative flex flex-col justify-between`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <span className="font-bold text-sm text-app-text block">
                          {a.label || addressTypeLabel(a.type)}
                        </span>
                        <span className="text-[11px] text-app-text-muted font-medium block">
                          Type: {addressTypeLabel(a.type)}
                        </span>
                      </div>
                      {a.is_primary && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-pesage-blue text-[10px] font-bold border border-blue-200">
                          <Star className="w-3 h-3 fill-pesage-blue" />
                          Principale
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-app-text mt-3 pt-3 border-t border-app-border space-y-1">
                      <p className="font-medium text-slate-800">{a.address_line}</p>
                      <p className="text-app-text-muted">
                        {a.city || ''} {a.postal_code ? `(${a.postal_code})` : ''} — {a.country || 'Maroc'}
                      </p>
                    </div>
                  </div>

                  {canManageAddresses && (
                    <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-app-border">
                      <button
                        onClick={() => handleOpenEditAddress(a)}
                        className="p-1.5 text-slate-500 hover:text-amber-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Modifier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingAddress(a)}
                        className="p-1.5 text-slate-500 hover:text-rose-600 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Supprimer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Quotes (Devis) */}
      {activeTab === 'quotes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Devis Commercial</h3>
              <p className="text-xs text-app-text-muted">Propositions commerciales adressées à {partner.legal_name}</p>
            </div>
            <button
              onClick={() => navigate('/devis')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Devis
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabQuotes.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <FileText className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucun devis trouvé pour ce client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Validité</th>
                    <th className="px-4 py-3 text-left font-semibold">Délai Livr.</th>
                    <th className="px-4 py-3 text-left font-semibold">Délai Réal.</th>
                    <th className="px-4 py-3 text-right font-semibold">Total HT</th>
                    <th className="px-4 py-3 text-right font-semibold">TTC</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabQuotes.map((q: any) => (
                    <tr key={q.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-pesage-blue">{q.reference}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(q.created_at)}</td>
                      <td className="px-4 py-3 text-app-text-muted">{q.valid_until ? formatDate(q.valid_until) : '—'}</td>
                      <td className="px-4 py-3 text-app-text">{q.delivery_delay || '—'}</td>
                      <td className="px-4 py-3 text-app-text">{q.realization_delay || '—'}</td>
                      <td className="px-4 py-3 text-right text-app-text-muted">{q.total_ht != null ? formatCurrency(q.total_ht) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-app-text-primary">{q.total_ttc != null ? formatCurrency(q.total_ttc) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          q.status === 'ACCEPTED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          q.status === 'SENT' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          q.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          q.status === 'EXPIRED' ? 'bg-slate-100 text-slate-600 border-slate-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{q.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/devis?search=${encodeURIComponent(q.reference)}`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Sales (Ventes) */}
      {activeTab === 'sales' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Commandes Ventes</h3>
              <p className="text-xs text-app-text-muted">Commandes et ventes confirmées pour {partner.legal_name}</p>
            </div>
            <button
              onClick={() => navigate('/ventes')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Ventes
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabSales.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <ShoppingCart className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucune vente trouvée pour ce client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Total HT</th>
                    <th className="px-4 py-3 text-right font-semibold">TVA</th>
                    <th className="px-4 py-3 text-right font-semibold">Total TTC</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabSales.map((s: any) => (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-pesage-blue">{s.reference}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(s.created_at)}</td>
                      <td className="px-4 py-3 text-right text-app-text-muted">{s.subtotal_ht != null ? formatCurrency(s.subtotal_ht) : '—'}</td>
                      <td className="px-4 py-3 text-right text-app-text-muted">{s.tax_amount != null ? formatCurrency(s.tax_amount) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-app-text-primary">{s.total_ttc != null ? formatCurrency(s.total_ttc) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          s.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          s.status === 'CANCELLED' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{s.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/ventes?search=${encodeURIComponent(s.reference)}`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Delivery Notes (BL) */}
      {activeTab === 'deliveries' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Bons de Livraison (BL)</h3>
              <p className="text-xs text-app-text-muted">Bons d'expédition et livraisons pour {partner.legal_name}</p>
            </div>
            <button
              onClick={() => navigate('/livraisons')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Livraisons
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabDeliveries.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucun bon de livraison trouvé pour ce client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence BL</th>
                    <th className="px-4 py-3 text-left font-semibold">Vente associée</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-left font-semibold">Articles</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabDeliveries.map((bl: any) => (
                    <tr key={bl.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-pesage-blue">{bl.reference}</td>
                      <td className="px-4 py-3 font-mono text-app-text-muted">{bl.sale?.reference || '—'}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(bl.created_at)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          bl.status === 'DELIVERED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          bl.status === 'IN_TRANSIT' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{bl.status}</span>
                      </td>
                      <td className="px-4 py-3 text-app-text">
                        {bl.items ? `${bl.items.length} article(s)` : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/livraisons?search=${encodeURIComponent(bl.reference)}`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Customer Invoices */}
      {activeTab === 'invoices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Factures Vente</h3>
              <p className="text-xs text-app-text-muted">Facturation émise pour {partner.legal_name}</p>
            </div>
            <button
              onClick={() => navigate('/factures-vente')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Factures Vente
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabInvoices.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucune facture émise pour ce client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Numéro</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Échéance</th>
                    <th className="px-4 py-3 text-right font-semibold">Total HT</th>
                    <th className="px-4 py-3 text-right font-semibold">TTC</th>
                    <th className="px-4 py-3 text-right font-semibold">Payé</th>
                    <th className="px-4 py-3 text-right font-semibold">Reste</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-pesage-blue">{inv.reference}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(inv.created_at)}</td>
                      <td className="px-4 py-3 text-app-text-muted">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                      <td className="px-4 py-3 text-right text-app-text-muted">{inv.total_ht != null ? formatCurrency(inv.total_ht) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-app-text-primary">{inv.total_ttc != null ? formatCurrency(inv.total_ttc) : '—'}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{inv.amount_paid != null ? formatCurrency(inv.amount_paid) : '0,00 DH'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${Number(inv.amount_due) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {inv.amount_due != null ? formatCurrency(inv.amount_due) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          inv.status === 'ISSUED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          inv.status === 'OVERDUE' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/factures-vente?search=${encodeURIComponent(inv.reference)}`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Credit Notes (Avoirs) */}
      {activeTab === 'credit_notes' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Avoirs Clients</h3>
              <p className="text-xs text-app-text-muted">Avoirs émis en déduction pour {partner.legal_name}</p>
            </div>
            <button
              onClick={() => navigate('/avoirs')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Avoirs
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabCreditNotes.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <RotateCcw className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucun avoir émis pour ce client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence Avoir</th>
                    <th className="px-4 py-3 text-left font-semibold">Facture d'origine</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Motif</th>
                    <th className="px-4 py-3 text-right font-semibold">Montant TTC</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabCreditNotes.map((cn: any) => (
                    <tr key={cn.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-purple-600">{cn.reference}</td>
                      <td className="px-4 py-3 font-mono text-app-text-muted">{cn.invoice?.reference || '—'}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(cn.created_at)}</td>
                      <td className="px-4 py-3 text-app-text">{cn.reason || '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-purple-700">{cn.amount_ttc != null ? formatCurrency(cn.amount_ttc) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          cn.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{cn.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/avoirs?search=${encodeURIComponent(cn.reference)}`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Payments (Règlements) */}
      {activeTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Paiements & Encaissements</h3>
              <p className="text-xs text-app-text-muted">Règlements encaissés pour {partner.legal_name}</p>
            </div>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabPayments.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucun règlement enregistré pour ce client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence</th>
                    <th className="px-4 py-3 text-left font-semibold">Date Règlement</th>
                    <th className="px-4 py-3 text-right font-semibold">Montant</th>
                    <th className="px-4 py-3 text-left font-semibold">Mode</th>
                    <th className="px-4 py-3 text-left font-semibold">Facture Source</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabPayments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-600">{p.reference || `#${p.id}`}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(p.payment_date || p.created_at)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(p.amount || 0)}</td>
                      <td className="px-4 py-3 text-app-text">{p.payment_method || 'Virement'}</td>
                      <td className="px-4 py-3 font-mono text-app-text-muted">{p.invoice?.reference || '—'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status || 'VALIDE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Interventions */}
      {activeTab === 'interventions' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Interventions SAV & Métrologie</h3>
              <p className="text-xs text-app-text-muted">Opérations sur site, étalonnages et maintenances pour ce client</p>
            </div>
            <button
              onClick={() => navigate('/maintenance')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Maintenance
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabInterventions.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <Wrench className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucune intervention enregistrée pour ce client.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Équipement</th>
                    <th className="px-4 py-3 text-left font-semibold">Type</th>
                    <th className="px-4 py-3 text-left font-semibold">Technicien</th>
                    <th className="px-4 py-3 text-left font-semibold">Priorité</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabInterventions.map((intv: any) => (
                    <tr key={intv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-pesage-blue">{intv.reference || `#${intv.id}`}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(intv.scheduled_date || intv.created_at)}</td>
                      <td className="px-4 py-3 text-app-text font-medium">{intv.equipment?.name || intv.equipment_name || '—'}</td>
                      <td className="px-4 py-3 text-app-text">{intv.intervention_type || intv.type || '—'}</td>
                      <td className="px-4 py-3 text-app-text-muted">{intv.technician_name || intv.assigned_to?.name || '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          intv.priority === 'HIGH' || intv.priority === 'URGENT' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          'bg-slate-100 text-slate-700 border-slate-200'
                        }`}>{intv.priority || 'NORMAL'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          intv.status === 'COMPLETED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          intv.status === 'IN_PROGRESS' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          intv.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{intv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/maintenance`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Supplier Purchases */}
      {activeTab === 'purchases' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Commandes d'Achat Fournisseur</h3>
              <p className="text-xs text-app-text-muted">Commandes passées auprès de {partner.legal_name}</p>
            </div>
            <button
              onClick={() => navigate('/achats')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Achats
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabPurchases.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <ClipboardList className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucune commande d'achat pour ce fournisseur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-right font-semibold">Total HT</th>
                    <th className="px-4 py-3 text-right font-semibold">Total TTC</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabPurchases.map((po: any) => (
                    <tr key={po.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-pesage-orange">{po.reference}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(po.created_at)}</td>
                      <td className="px-4 py-3 text-right text-app-text-muted">{po.subtotal_ht != null ? formatCurrency(po.subtotal_ht) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-app-text-primary">{po.total_ttc != null ? formatCurrency(po.total_ttc) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          po.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          po.status === 'RECEIVED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>{po.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/achats`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Supplier Receipts */}
      {activeTab === 'receipts' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Bons de Réception Magasin</h3>
              <p className="text-xs text-app-text-muted">Réceptions de marchandises pour {partner.legal_name}</p>
            </div>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabReceipts.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <Truck className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucun bon de réception trouvé pour ce fournisseur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence Réception</th>
                    <th className="px-4 py-3 text-left font-semibold">Commande Achat</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Dépôt Récepteur</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabReceipts.map((rc: any) => (
                    <tr key={rc.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-emerald-600">{rc.reference}</td>
                      <td className="px-4 py-3 font-mono text-app-text-muted">{rc.purchase_order?.reference || rc.purchase_order_id || '—'}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(rc.created_at)}</td>
                      <td className="px-4 py-3 text-app-text">{rc.warehouse?.name || 'Dépôt Principal'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {rc.status || 'VALIDE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Supplier Invoices */}
      {activeTab === 'supplier_invoices' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Factures Achat Fournisseur</h3>
              <p className="text-xs text-app-text-muted">Factures reçues et échéances de paiement</p>
            </div>
            <button
              onClick={() => navigate('/factures-achat')}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Module Factures Achat
            </button>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabSupplierInvoices.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <Receipt className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucune facture d'achat pour ce fournisseur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Numéro</th>
                    <th className="px-4 py-3 text-left font-semibold">Date</th>
                    <th className="px-4 py-3 text-left font-semibold">Échéance</th>
                    <th className="px-4 py-3 text-right font-semibold">Total HT</th>
                    <th className="px-4 py-3 text-right font-semibold">TTC</th>
                    <th className="px-4 py-3 text-right font-semibold">Payé</th>
                    <th className="px-4 py-3 text-right font-semibold">Reste</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                    <th className="px-4 py-3 text-right font-semibold">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabSupplierInvoices.map((inv: any) => (
                    <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-pesage-orange">{inv.reference}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(inv.created_at)}</td>
                      <td className="px-4 py-3 text-app-text-muted">{inv.due_date ? formatDate(inv.due_date) : '—'}</td>
                      <td className="px-4 py-3 text-right text-app-text-muted">{inv.total_ht != null ? formatCurrency(inv.total_ht) : '—'}</td>
                      <td className="px-4 py-3 text-right font-bold text-app-text-primary">{inv.total_ttc != null ? formatCurrency(inv.total_ttc) : '—'}</td>
                      <td className="px-4 py-3 text-right text-emerald-600 font-semibold">{inv.amount_paid != null ? formatCurrency(inv.amount_paid) : '0,00 DH'}</td>
                      <td className={`px-4 py-3 text-right font-bold ${Number(inv.amount_due) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                        {inv.amount_due != null ? formatCurrency(inv.amount_due) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          inv.status === 'PAID' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                          inv.status === 'ISSUED' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          inv.status === 'PARTIALLY_PAID' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>{inv.status}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => navigate(`/factures-achat?search=${encodeURIComponent(inv.reference)}`)}
                          className="text-xs text-pesage-blue hover:underline font-semibold"
                        >
                          Voir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Supplier Payments */}
      {activeTab === 'supplier_payments' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-sm font-bold text-app-text">Règlements Fournisseur</h3>
              <p className="text-xs text-app-text-muted">Paiements émis à l'ordre de {partner.legal_name}</p>
            </div>
          </div>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Chargement...</div>
          ) : tabSupplierPayments.length === 0 ? (
            <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border">
              <DollarSign className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs text-app-text-muted">Aucun règlement enregistré pour ce fournisseur.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-app-border">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Référence</th>
                    <th className="px-4 py-3 text-left font-semibold">Date Règlement</th>
                    <th className="px-4 py-3 text-right font-semibold">Montant</th>
                    <th className="px-4 py-3 text-left font-semibold">Mode de Paiement</th>
                    <th className="px-4 py-3 text-left font-semibold">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-app-border bg-app-surface">
                  {tabSupplierPayments.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-indigo-600">{p.reference || `#${p.id}`}</td>
                      <td className="px-4 py-3 text-app-text-muted">{formatDate(p.payment_date || p.created_at)}</td>
                      <td className="px-4 py-3 text-right font-bold text-indigo-600">{formatCurrency(p.amount || 0)}</td>
                      <td className="px-4 py-3 text-app-text">{p.payment_method || 'Virement'}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          {p.status || 'VALIDE'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: Documents & Attachments */}
      {activeTab === 'documents' && (
        <AttachmentsSection
          entityType={partner.partner_type === 'SUPPLIER' ? 'SUPPLIER' : 'CUSTOMER'}
          entityId={partner.id}
          title={`Documents & Justificatifs — ${partner.legal_name}`}
          subtitle="Contrats, certificats, rapports techniques, bons signés et pièces comptables"
        />
      )}

      {/* Tab Content: Analytics & KPI */}
      {activeTab === 'analytics' && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold text-app-text">
            {partner.partner_type === 'SUPPLIER' ? 'Analyse & KPI Fournisseur' : 'Analyse & KPI Client'}
          </h3>
          {isTabLoading ? (
            <div className="p-8 text-center text-xs text-app-text-muted"><Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />Calcul des indicateurs...</div>
          ) : partner.partner_type === 'SUPPLIER' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Commandes d'Achat</span>
                <p className="text-2xl font-bold text-app-text-primary">{summary?.supplier?.total_purchases ?? tabPurchases.length ?? 0}</p>
                <p className="text-[11px] text-pesage-blue">{summary?.supplier?.total_receipts ?? tabReceipts.length ?? 0} réceptions</p>
              </div>
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Factures Achat Émises</span>
                <p className="text-2xl font-bold text-pesage-orange">{summary?.supplier?.total_invoices ?? tabSupplierInvoices.length ?? 0}</p>
                <p className="text-[11px] text-app-text-muted">Total factures reçues</p>
              </div>
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Volume d'Achats Facturé</span>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(summary?.supplier?.amount_invoiced ?? 0)}
                </p>
                <p className="text-[11px] text-app-text-muted">Toutes factures confondues</p>
              </div>
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Reste Dû Fournisseur</span>
                <p className="text-xl font-bold text-rose-600">
                  {formatCurrency(summary?.supplier?.amount_due ?? 0)}
                </p>
                <p className="text-[11px] text-emerald-600">{formatCurrency(summary?.supplier?.amount_paid ?? 0)} déjà réglé</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Devis Envoyés</span>
                <p className="text-2xl font-bold text-app-text-primary">{summary?.customer?.total_quotes ?? tabQuotes.length ?? 0}</p>
                <p className="text-[11px] text-emerald-600">
                  {tabQuotes.filter((q: any) => q.status === 'ACCEPTED').length} acceptés
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Ventes Confirmées</span>
                <p className="text-2xl font-bold text-pesage-blue">{summary?.customer?.total_sales ?? tabSales.length ?? 0}</p>
                <p className="text-[11px] text-app-text-muted">
                  {summary?.customer?.total_delivery_notes ?? tabDeliveries.length ?? 0} BL livrés
                </p>
              </div>
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Total Facturé Client</span>
                <p className="text-xl font-bold text-emerald-600">
                  {formatCurrency(summary?.customer?.amount_invoiced ?? 0)}
                </p>
                <p className="text-[11px] text-app-text-muted">{summary?.customer?.total_invoices ?? tabInvoices.length ?? 0} facture(s)</p>
              </div>
              <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-1">
                <span className="text-[11px] text-app-text-muted block">Reste à Recouvrer (Dû)</span>
                <p className="text-xl font-bold text-rose-600">
                  {formatCurrency(summary?.customer?.amount_due ?? 0)}
                </p>
                <p className="text-[11px] text-emerald-600">{formatCurrency(summary?.customer?.amount_paid ?? 0)} déjà encaissé</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal Edit Partner */}
      <Modal
        isOpen={isEditPartnerOpen}
        onClose={() => !isSubmitting && setIsEditPartnerOpen(false)}
        title="Modifier la fiche partenaire"
        subtitle={`Modification des informations pour ${partner.legal_name}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitEditPartner} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Code Partenaire" required>
              <input
                type="text"
                required
                value={partnerFormData.code || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Type Partenaire" required>
              <select
                value={partnerFormData.partner_type}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, partner_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              >
                <option value="CUSTOMER">Client uniquement</option>
                <option value="SUPPLIER">Fournisseur uniquement</option>
                <option value="CUSTOMER_SUPPLIER">Client & Fournisseur</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Raison Sociale" required>
              <input
                type="text"
                required
                value={partnerFormData.legal_name || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, legal_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Nom Commercial">
              <input
                type="text"
                value={partnerFormData.trade_name || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, trade_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Numéro ICE">
              <input
                type="text"
                value={partnerFormData.ice || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, ice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Identifiant Fiscal (IF)">
              <input
                type="text"
                value={partnerFormData.tax_id || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, tax_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Registre Commerce (RC)">
              <input
                type="text"
                value={partnerFormData.registration_number || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, registration_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Téléphone">
              <input
                type="text"
                value={partnerFormData.phone || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={partnerFormData.email || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Site Web">
              <input
                type="text"
                value={partnerFormData.website || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, website: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Adresse">
                <input
                  type="text"
                  value={partnerFormData.address || ''}
                  onChange={(e) => setPartnerFormData({ ...partnerFormData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
                />
              </FormField>
            </div>
            <FormField label="Ville">
              <input
                type="text"
                value={partnerFormData.city || ''}
                onChange={(e) => setPartnerFormData({ ...partnerFormData, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <FormField label="Notes & Observations">
            <textarea
              rows={2}
              value={partnerFormData.notes || ''}
              onChange={(e) => setPartnerFormData({ ...partnerFormData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none resize-none"
            />
          </FormField>

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsEditPartnerOpen(false)}
              className="btn-secondary text-xs px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-5 py-2 inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Contact */}
      <Modal
        isOpen={isContactModalOpen}
        onClose={() => !isSubmitting && setIsContactModalOpen(false)}
        title={editingContact ? 'Modifier le contact' : 'Ajouter un interlocuteur'}
        subtitle={`Partenaire: ${partner.legal_name}`}
      >
        <form onSubmit={handleSubmitContact} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prénom" required>
              <input
                type="text"
                required
                value={contactForm.first_name}
                onChange={(e) => setContactForm({ ...contactForm, first_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Nom" required>
              <input
                type="text"
                required
                value={contactForm.last_name}
                onChange={(e) => setContactForm({ ...contactForm, last_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <FormField label="Fonction / Poste">
            <input
              type="text"
              value={contactForm.position || ''}
              onChange={(e) => setContactForm({ ...contactForm, position: e.target.value })}
              placeholder="ex: Responsable Achat, Directeur Commercial..."
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Téléphone">
              <input
                type="text"
                value={contactForm.phone || ''}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={contactForm.email || ''}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <input
              type="text"
              value={contactForm.notes || ''}
              onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_primary_contact"
              checked={contactForm.is_primary}
              onChange={(e) => setContactForm({ ...contactForm, is_primary: e.target.checked })}
              className="w-4 h-4 rounded text-pesage-blue focus:ring-pesage-blue"
            />
            <label htmlFor="is_primary_contact" className="text-xs font-semibold text-app-text cursor-pointer">
              Définir comme contact principal
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsContactModalOpen(false)}
              className="btn-secondary text-xs px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-5 py-2 inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingContact ? 'Enregistrer' : 'Ajouter le contact'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Address */}
      <Modal
        isOpen={isAddressModalOpen}
        onClose={() => !isSubmitting && setIsAddressModalOpen(false)}
        title={editingAddress ? 'Modifier l\'adresse' : 'Ajouter une adresse'}
        subtitle={`Partenaire: ${partner.legal_name}`}
      >
        <form onSubmit={handleSubmitAddress} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Type d'adresse" required>
              <select
                value={addressForm.type}
                onChange={(e) => setAddressForm({ ...addressForm, type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              >
                <option value="MAIN">Siège / Principal</option>
                <option value="BILLING">Facturation</option>
                <option value="SHIPPING">Livraison / Chantier</option>
                <option value="OTHER">Autre</option>
              </select>
            </FormField>

            <FormField label="Libellé du site">
              <input
                type="text"
                value={addressForm.label || ''}
                onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                placeholder="ex: Dépôt Ain Sebaa"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <FormField label="Adresse complète" required>
            <textarea
              required
              rows={2}
              value={addressForm.address_line}
              onChange={(e) => setAddressForm({ ...addressForm, address_line: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none resize-none"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Ville">
              <input
                type="text"
                value={addressForm.city || ''}
                onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Code Postal">
              <input
                type="text"
                value={addressForm.postal_code || ''}
                onChange={(e) => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <FormField label="Pays">
            <input
              type="text"
              value={addressForm.country || 'Maroc'}
              onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_primary_address"
              checked={addressForm.is_primary}
              onChange={(e) => setAddressForm({ ...addressForm, is_primary: e.target.checked })}
              className="w-4 h-4 rounded text-pesage-blue focus:ring-pesage-blue"
            />
            <label htmlFor="is_primary_address" className="text-xs font-semibold text-app-text cursor-pointer">
              Définir comme adresse principale
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsAddressModalOpen(false)}
              className="btn-secondary text-xs px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary text-xs px-5 py-2 inline-flex items-center gap-2"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {editingAddress ? 'Enregistrer' : 'Ajouter l\'adresse'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivation/Activation Partner */}
      <ConfirmDialog
        isOpen={isDeactivatingPartner}
        title={partner.is_active ? 'Désactiver le partenaire' : 'Réactiver le partenaire'}
        message={
          partner.is_active
            ? `Êtes-vous sûr de vouloir désactiver ${partner.legal_name} ?`
            : `Êtes-vous sûr de vouloir réactiver ${partner.legal_name} ?`
        }
        confirmLabel={partner.is_active ? 'Désactiver' : 'Réactiver'}
        isLoading={isSubmitting}
        onConfirm={handleTogglePartnerActive}
        onClose={() => setIsDeactivatingPartner(false)}
      />

      {/* Confirm Delete Contact */}
      <ConfirmDialog
        isOpen={!!deletingContact}
        title="Supprimer le contact"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le contact ${deletingContact?.first_name} ${deletingContact?.last_name} ?`}
        confirmLabel="Supprimer"
        isLoading={isSubmitting}
        onConfirm={handleDeleteContact}
        onClose={() => setDeletingContact(null)}
      />

      {/* Confirm Delete Address */}
      <ConfirmDialog
        isOpen={!!deletingAddress}
        title="Supprimer l'adresse"
        message={`Êtes-vous sûr de vouloir supprimer cette adresse (${deletingAddress?.address_line}) ?`}
        confirmLabel="Supprimer"
        isLoading={isSubmitting}
        onConfirm={handleDeleteAddress}
        onClose={() => setDeletingAddress(null)}
      />
    </div>
  );
};
