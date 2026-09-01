import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { BusinessPartner, PartnerCreate, PartnerUpdate } from '@/types/partner';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusFilter } from '@/components/ui/StatusFilter';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import {
  Users,
  Plus,
  Edit2,
  Ban,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Phone,
  Mail,
  Building2,
  MapPin,
  FileBadge,
} from 'lucide-react';

export const ClientsPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [clients, setClients] = useState<BusinessPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<BusinessPartner | null>(null);
  const [deactivatingClient, setDeactivatingClient] = useState<BusinessPartner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<PartnerCreate>({
    code: '',
    legal_name: '',
    trade_name: '',
    partner_type: 'CUSTOMER',
    ice: '',
    tax_id: '',
    registration_number: '',
    phone: '',
    email: '',
    website: '',
    address: '',
    city: '',
    postal_code: '',
    country: 'Maroc',
    notes: '',
    is_active: true,
  });

  const roleNames = user?.roles?.map((r) => r.name) || [];
  const userPerms = user?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('partners.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('partners.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('partners.delete');

  const fetchClients = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/customers?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<BusinessPartner[]>(url);
      setClients(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger la liste des clients.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchClients();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchClients]);

  const handleOpenCreate = () => {
    setModalError(null);
    setFormData({
      code: '',
      legal_name: '',
      trade_name: '',
      partner_type: 'CUSTOMER',
      ice: '',
      tax_id: '',
      registration_number: '',
      phone: '',
      email: '',
      website: '',
      address: '',
      city: '',
      postal_code: '',
      country: 'Maroc',
      notes: '',
      is_active: true,
    });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (client: BusinessPartner) => {
    setModalError(null);
    setEditingClient(client);
    setFormData({
      code: client.code,
      legal_name: client.legal_name,
      trade_name: client.trade_name || '',
      partner_type: client.partner_type,
      ice: client.ice || '',
      tax_id: client.tax_id || '',
      registration_number: client.registration_number || '',
      phone: client.phone || '',
      email: client.email || '',
      website: client.website || '',
      address: client.address || '',
      city: client.city || '',
      postal_code: client.postal_code || '',
      country: client.country || 'Maroc',
      notes: client.notes || '',
      is_active: client.is_active,
    });
  };

  const handleSubmitCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload = {
        ...formData,
        email: formData.email ? formData.email : undefined,
      };
      await api.post('/api/v1/partners', payload);
      showSuccess('Client créé avec succès.');
      setIsCreateOpen(false);
      fetchClients();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || 'Échec de la création du client.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingClient) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload: PartnerUpdate = {
        ...formData,
        email: formData.email ? formData.email : undefined,
      };
      await api.put(`/api/v1/partners/${editingClient.id}`, payload);
      showSuccess('Client mis à jour avec succès.');
      setEditingClient(null);
      fetchClients();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || 'Échec de la mise à jour du client.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!deactivatingClient) return;
    setIsSubmitting(true);

    try {
      const newStatus = !deactivatingClient.is_active;
      await api.put(`/api/v1/partners/${deactivatingClient.id}`, {
        is_active: newStatus,
      });
      showSuccess(newStatus ? 'Client réactivé avec succès.' : 'Client désactivé avec succès.');
      setDeactivatingClient(null);
      fetchClients();
    } catch (err: any) {
      showError(err.response?.data?.detail || err.response?.data?.error?.message || 'Action impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<BusinessPartner>[] = [
    {
      header: 'Code',
      accessor: (c) => (
        <span className="font-mono font-bold text-xs text-pesage-blue bg-blue-50/90 px-2.5 py-1 rounded-md border border-blue-200/60 inline-flex items-center gap-1">
          {c.code}
        </span>
      ),
      width: '120px',
    },
    {
      header: 'Client / Raison Sociale',
      accessor: (c) => (
        <div className="flex flex-col">
          <span className="font-bold text-app-text hover:text-pesage-blue transition-colors cursor-pointer" onClick={() => navigate(`/partners/${c.id}`)}>
            {c.legal_name}
          </span>
          {c.trade_name && (
            <span className="text-[11px] text-app-text-muted font-normal">
              {c.trade_name}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'ICE / Fiscalité',
      accessor: (c) => (
        <div className="text-xs text-app-text space-y-0.5">
          {c.ice ? (
            <span className="font-mono text-slate-700 font-medium block">
              ICE: {c.ice}
            </span>
          ) : (
            <span className="text-slate-400 italic">Sans ICE</span>
          )}
          {c.city && (
            <span className="text-[11px] text-app-text-muted flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" /> {c.city}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Coordonnées',
      accessor: (c) => (
        <div className="space-y-1 text-xs">
          {c.phone && (
            <div className="flex items-center gap-1.5 text-app-text">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{c.phone}</span>
            </div>
          )}
          {c.email && (
            <div className="flex items-center gap-1.5 text-app-text-muted truncate max-w-[160px]">
              <Mail className="w-3 h-3 text-slate-400" />
              <span className="truncate">{c.email}</span>
            </div>
          )}
          {!c.phone && !c.email && <span className="text-slate-400 italic">Non renseigné</span>}
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: (c) => {
        if (c.partner_type === 'CUSTOMER_SUPPLIER') {
          return (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Client & Fournisseur
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-50 text-blue-700 border border-blue-200">
            Client
          </span>
        );
      },
    },
    {
      header: 'Statut',
      accessor: (c) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            c.is_active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {c.is_active ? 'Actif' : 'Inactif'}
        </span>
      ),
      align: 'center',
      width: '100px',
    },
  ];

  // Stats calculation
  const totalClients = clients.length;
  const activeClients = clients.filter((c) => c.is_active).length;
  const iceClients = clients.filter((c) => !!c.ice).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Clients"
        subtitle="Répertoire des clients, suivi des coordonnées et informations commerciales."
        icon={Users}
        action={
          canCreate
            ? {
                label: 'Nouveau Client',
                onClick: handleOpenCreate,
                icon: Plus,
              }
            : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-blue-50 text-pesage-blue border border-blue-100">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-app-text-muted block">Total Clients</span>
            <span className="text-lg font-bold text-app-text">{totalClients}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-app-text-muted block">Clients Actifs</span>
            <span className="text-lg font-bold text-emerald-600">{activeClients}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <FileBadge className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-app-text-muted block">Avec Numéro ICE</span>
            <span className="text-lg font-bold text-purple-600">{iceClients}</span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between items-stretch sm:items-center bg-app-surface p-3.5 rounded-2xl border border-app-border shadow-xs">
        <div className="flex-1 max-w-md">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Rechercher par code, raison sociale, ICE, ville, tel..."
          />
        </div>
        <StatusFilter
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={clients}
        keyExtractor={(c) => c.id}
        isLoading={isLoading}
        emptyTitle="Aucun client trouvé"
        emptyDescription="Aucun client ne correspond à vos critères de recherche ou aucun client n'a été créé."
        actions={(c) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => navigate(`/partners/${c.id}`)}
              title="Consulter la fiche détaillée"
              className="p-1.5 rounded-lg text-slate-500 hover:text-pesage-blue hover:bg-slate-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            {canUpdate && (
              <button
                onClick={() => handleOpenEdit(c)}
                title="Modifier les informations"
                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeactivatingClient(c)}
                title={c.is_active ? 'Désactiver le client' : 'Réactiver le client'}
                className={`p-1.5 rounded-lg transition-colors ${
                  c.is_active
                    ? 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
                    : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'
                }`}
              >
                {c.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
      />

      {/* Modal Create Client */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isSubmitting && setIsCreateOpen(false)}
        title="Ajouter un nouveau client"
        subtitle="Remplissez les informations administratives et fiscales du client"
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitCreate} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Code Client" required>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="ex: CLI-001"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Type Partenaire" required>
              <select
                value={formData.partner_type}
                onChange={(e) => setFormData({ ...formData, partner_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              >
                <option value="CUSTOMER">Client uniquement</option>
                <option value="CUSTOMER_SUPPLIER">Client & Fournisseur</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Raison Sociale (Nom officiel)" required>
              <input
                type="text"
                required
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                placeholder="ex: Société Marocaine de Pesage SARL"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Nom Commercial">
              <input
                type="text"
                value={formData.trade_name || ''}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                placeholder="ex: SMP Pesage"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Numéro ICE">
              <input
                type="text"
                value={formData.ice || ''}
                onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                placeholder="15 chiffres"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Identifiant Fiscal (IF)">
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="ex: 12345678"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Registre Commerce (RC)">
              <input
                type="text"
                value={formData.registration_number || ''}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                placeholder="ex: 98765 Casablanca"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Téléphone">
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="ex: 0522000000"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="contact@entreprise.ma"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Site Web">
              <input
                type="text"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Adresse">
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="Rue, Boulevard, Zone industrielle..."
                  className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
                />
              </FormField>
            </div>
            <FormField label="Ville">
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Casablanca, Tanger..."
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <FormField label="Notes & Observations">
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Informations supplémentaires, conditions particulières..."
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none resize-none"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active_create"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-pesage-blue focus:ring-pesage-blue"
            />
            <label htmlFor="is_active_create" className="text-xs font-semibold text-app-text cursor-pointer">
              Compte client actif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-app-text-muted hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm hover:shadow transition-all"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Créer le client
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Client */}
      <Modal
        isOpen={!!editingClient}
        onClose={() => !isSubmitting && setEditingClient(null)}
        title="Modifier le client"
        subtitle={`Mise à jour des informations pour ${editingClient?.legal_name}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Code Client" required>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Type Partenaire" required>
              <select
                value={formData.partner_type}
                onChange={(e) => setFormData({ ...formData, partner_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              >
                <option value="CUSTOMER">Client uniquement</option>
                <option value="CUSTOMER_SUPPLIER">Client & Fournisseur</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Raison Sociale (Nom officiel)" required>
              <input
                type="text"
                required
                value={formData.legal_name}
                onChange={(e) => setFormData({ ...formData, legal_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Nom Commercial">
              <input
                type="text"
                value={formData.trade_name || ''}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Numéro ICE">
              <input
                type="text"
                value={formData.ice || ''}
                onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Identifiant Fiscal (IF)">
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Registre Commerce (RC)">
              <input
                type="text"
                value={formData.registration_number || ''}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Téléphone">
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>

            <FormField label="Site Web">
              <input
                type="text"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <FormField label="Adresse">
                <input
                  type="text"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
                />
              </FormField>
            </div>
            <FormField label="Ville">
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
              />
            </FormField>
          </div>

          <FormField label="Notes & Observations">
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none resize-none"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active_edit"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-pesage-blue focus:ring-pesage-blue"
            />
            <label htmlFor="is_active_edit" className="text-xs font-semibold text-app-text cursor-pointer">
              Compte client actif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setEditingClient(null)}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-app-text-muted hover:bg-slate-100 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm hover:shadow transition-all"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivation/Activation */}
      <ConfirmDialog
        isOpen={!!deactivatingClient}
        title={deactivatingClient?.is_active ? 'Désactiver le client' : 'Réactiver le client'}
        message={
          deactivatingClient?.is_active
            ? `Êtes-vous sûr de vouloir désactiver le client ${deactivatingClient?.legal_name} ? Ce client ne pourra plus être sélectionné pour les nouvelles ventes.`
            : `Êtes-vous sûr de vouloir réactiver le client ${deactivatingClient?.legal_name} ?`
        }
        confirmLabel={deactivatingClient?.is_active ? 'Désactiver' : 'Réactiver'}
        isLoading={isSubmitting}
        onConfirm={handleToggleActive}
        onClose={() => setDeactivatingClient(null)}
      />
    </div>
  );
};
