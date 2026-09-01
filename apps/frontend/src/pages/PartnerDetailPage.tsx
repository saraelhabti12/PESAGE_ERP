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
} from '@/types/partner';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { LoadingState } from '@/components/ui/LoadingState';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/formatters';
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
  Truck,
  CreditCard,
  Wrench,
  FolderArchive,
  BarChart3,
  Info,
  Calendar,
} from 'lucide-react';

type TabType =
  | 'info'
  | 'contacts'
  | 'addresses'
  | 'quotes'
  | 'sales'
  | 'deliveries'
  | 'invoices'
  | 'payments'
  | 'interventions'
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
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');

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
      const [partnerRes, contactsRes, addressesRes] = await Promise.all([
        api.get<BusinessPartner>(`/api/v1/partners/${id}`),
        api.get<PartnerContact[]>(`/api/v1/partners/${id}/contacts`),
        api.get<PartnerAddress[]>(`/api/v1/partners/${id}/addresses`),
      ]);
      setPartner(partnerRes.data);
      setContacts(contactsRes.data);
      setAddresses(addressesRes.data);
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Impossible de charger les détails du partenaire.');
    } finally {
      setIsLoading(false);
    }
  }, [id, showError]);

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
      </div>

      {/* Tabs Navigation */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-app-border pb-1">
        <button
          onClick={() => setActiveTab('info')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'info'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
          }`}
        >
          <Building2 className="w-3.5 h-3.5" />
          Informations
        </button>

        <button
          onClick={() => setActiveTab('contacts')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
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
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
            activeTab === 'addresses'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-app-text-muted hover:text-app-text hover:bg-slate-100'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          Adresses ({addresses.length})
        </button>

        <button
          onClick={() => setActiveTab('quotes')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'quotes'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          Devis
        </button>

        <button
          onClick={() => setActiveTab('sales')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'sales'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <ShoppingCart className="w-3.5 h-3.5" />
          Ventes
        </button>

        <button
          onClick={() => setActiveTab('deliveries')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'deliveries'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Truck className="w-3.5 h-3.5" />
          Bons de Livraison
        </button>

        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'invoices'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          Factures
        </button>

        <button
          onClick={() => setActiveTab('interventions')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'interventions'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Interventions
        </button>

        <button
          onClick={() => setActiveTab('documents')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'documents'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
          }`}
        >
          <FolderArchive className="w-3.5 h-3.5" />
          Documents
        </button>

        <button
          onClick={() => setActiveTab('analytics')}
          className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs font-medium transition-all whitespace-nowrap ${
            activeTab === 'analytics'
              ? 'bg-pesage-blue text-white shadow-xs'
              : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
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

      {/* Future Tabs Placeholders */}
      {activeTab !== 'info' && activeTab !== 'contacts' && activeTab !== 'addresses' && (
        <div className="p-10 rounded-2xl bg-app-surface border border-app-border text-center space-y-3">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 mx-auto flex items-center justify-center">
            <Info className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-app-text">Module non disponible pour le moment</h3>
          <p className="text-xs text-app-text-muted max-w-md mx-auto">
            Ce module commercial ou technique sera relié à cette fiche partenaire lors des prochaines phases du système ERP Pesage 2000.
          </p>
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-app-text-muted hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-app-text-muted hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
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
              className="px-4 py-2 rounded-xl text-xs font-semibold text-app-text-muted hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
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
