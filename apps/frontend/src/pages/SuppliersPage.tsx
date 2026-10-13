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
  ShoppingBag,
  Plus,
  Edit2,
  Ban,
  CheckCircle2,
  Loader2,
  ExternalLink,
  Phone,
  Mail,
  Building,
  MapPin,
  FileBadge,
} from 'lucide-react';

export const SuppliersPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [suppliers, setSuppliers] = useState<BusinessPartner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<BusinessPartner | null>(null);
  const [deactivatingSupplier, setDeactivatingSupplier] = useState<BusinessPartner | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState<PartnerCreate>({
    code: '',
    legal_name: '',
    trade_name: '',
    partner_type: 'SUPPLIER',
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

  const fetchSuppliers = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/suppliers?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<BusinessPartner[]>(url);
      setSuppliers(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger la liste des fournisseurs.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchSuppliers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchSuppliers]);

  const handleOpenCreate = () => {
    setModalError(null);
    setFormData({
      code: '',
      legal_name: '',
      trade_name: '',
      partner_type: 'SUPPLIER',
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

  const handleOpenEdit = (supplier: BusinessPartner) => {
    setModalError(null);
    setEditingSupplier(supplier);
    setFormData({
      code: supplier.code,
      legal_name: supplier.legal_name,
      trade_name: supplier.trade_name || '',
      partner_type: supplier.partner_type,
      ice: supplier.ice || '',
      tax_id: supplier.tax_id || '',
      registration_number: supplier.registration_number || '',
      phone: supplier.phone || '',
      email: supplier.email || '',
      website: supplier.website || '',
      address: supplier.address || '',
      city: supplier.city || '',
      postal_code: supplier.postal_code || '',
      country: supplier.country || 'Maroc',
      notes: supplier.notes || '',
      is_active: supplier.is_active,
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
      showSuccess('Fournisseur créé avec succès.');
      setIsCreateOpen(false);
      fetchSuppliers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || 'Échec de la création du fournisseur.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSupplier) return;
    setIsSubmitting(true);
    setModalError(null);

    try {
      const payload: PartnerUpdate = {
        ...formData,
        email: formData.email ? formData.email : undefined,
      };
      await api.put(`/api/v1/partners/${editingSupplier.id}`, payload);
      showSuccess('Fournisseur mis à jour avec succès.');
      setEditingSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      const msg = err.response?.data?.detail || err.response?.data?.error?.message || 'Échec de la mise à jour du fournisseur.';
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async () => {
    if (!deactivatingSupplier) return;
    setIsSubmitting(true);

    try {
      const newStatus = !deactivatingSupplier.is_active;
      await api.put(`/api/v1/partners/${deactivatingSupplier.id}`, {
        is_active: newStatus,
      });
      showSuccess(newStatus ? 'Fournisseur réactivé avec succès.' : 'Fournisseur désactivé avec succès.');
      setDeactivatingSupplier(null);
      fetchSuppliers();
    } catch (err: any) {
      showError(err.response?.data?.detail || err.response?.data?.error?.message || 'Action impossible.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns: Column<BusinessPartner>[] = [
    {
      header: 'Code',
      accessor: (s) => (
        <span className="font-mono font-bold text-xs text-pesage-orange bg-orange-50/90 px-2.5 py-1 rounded-md border border-orange-200/60 inline-flex items-center gap-1">
          {s.code}
        </span>
      ),
      width: '120px',
    },
    {
      header: 'Fournisseur / Raison Sociale',
      accessor: (s) => (
        <div className="flex flex-col">
          <span className="font-bold text-app-text hover:text-pesage-blue transition-colors cursor-pointer" onClick={() => navigate(`/partners/${s.id}`)}>
            {s.legal_name}
          </span>
          {s.trade_name && (
            <span className="text-[11px] text-app-text-muted font-normal">
              {s.trade_name}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'ICE / Fiscalité',
      accessor: (s) => (
        <div className="text-xs text-app-text space-y-0.5">
          {s.ice ? (
            <span className="font-mono text-slate-700 font-medium block">
              ICE: {s.ice}
            </span>
          ) : (
            <span className="text-slate-400 italic">Sans ICE</span>
          )}
          {s.city && (
            <span className="text-[11px] text-app-text-muted flex items-center gap-1">
              <MapPin className="w-3 h-3 text-slate-400" /> {s.city}
            </span>
          )}
        </div>
      ),
    },
    {
      header: 'Coordonnées',
      accessor: (s) => (
        <div className="space-y-1 text-xs">
          {s.phone && (
            <div className="flex items-center gap-1.5 text-app-text">
              <Phone className="w-3 h-3 text-slate-400" />
              <span>{s.phone}</span>
            </div>
          )}
          {s.email && (
            <div className="flex items-center gap-1.5 text-app-text-muted truncate max-w-[160px]">
              <Mail className="w-3 h-3 text-slate-400" />
              <span className="truncate">{s.email}</span>
            </div>
          )}
          {!s.phone && !s.email && <span className="text-slate-400 italic">Non renseigné</span>}
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: (s) => {
        if (s.partner_type === 'CUSTOMER_SUPPLIER') {
          return (
            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-50 text-purple-700 border border-purple-200">
              Client & Fournisseur
            </span>
          );
        }
        return (
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-amber-50 text-amber-700 border border-amber-200">
            Fournisseur
          </span>
        );
      },
    },
    {
      header: 'Statut',
      accessor: (s) => (
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${
            s.is_active
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-slate-100 text-slate-600 border-slate-200'
          }`}
        >
          {s.is_active ? 'Actif' : 'Inactif'}
        </span>
      ),
      align: 'center',
      width: '100px',
    },
  ];

  // Stats calculation
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s) => s.is_active).length;
  const iceSuppliers = suppliers.filter((s) => !!s.ice).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des Fournisseurs"
        subtitle="Répertoire des fournisseurs et partenaires d'approvisionnement."
        icon={ShoppingBag}
        action={
          canCreate
            ? {
                label: 'Nouveau Fournisseur',
                onClick: handleOpenCreate,
                icon: Plus,
              }
            : undefined
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-orange-50 text-pesage-orange border border-orange-100">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-app-text-muted block">Total Fournisseurs</span>
            <span className="text-lg font-bold text-app-text">{totalSuppliers}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-app-text-muted block">Fournisseurs Actifs</span>
            <span className="text-lg font-bold text-emerald-600">{activeSuppliers}</span>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 border border-purple-100">
            <FileBadge className="w-5 h-5" />
          </div>
          <div>
            <span className="text-xs text-app-text-muted block">Avec Numéro ICE</span>
            <span className="text-lg font-bold text-purple-600">{iceSuppliers}</span>
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
        data={suppliers}
        keyExtractor={(s) => s.id}
        isLoading={isLoading}
        emptyTitle="Aucun fournisseur trouvé"
        emptyDescription="Aucun fournisseur ne correspond à vos critères de recherche ou aucun fournisseur n'a été créé."
        actions={(s) => (
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => navigate(`/partners/${s.id}`)}
              title="Consulter la fiche détaillée"
              className="p-1.5 rounded-lg text-slate-500 hover:text-pesage-blue hover:bg-slate-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </button>
            {canUpdate && (
              <button
                onClick={() => handleOpenEdit(s)}
                title="Modifier les informations"
                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 transition-colors"
              >
                <Edit2 className="w-4 h-4" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => setDeactivatingSupplier(s)}
                title={s.is_active ? 'Désactiver le fournisseur' : 'Réactiver le fournisseur'}
                className={`p-1.5 rounded-lg transition-colors ${
                  s.is_active
                    ? 'text-slate-500 hover:text-rose-600 hover:bg-slate-100'
                    : 'text-slate-500 hover:text-emerald-600 hover:bg-slate-100'
                }`}
              >
                {s.is_active ? <Ban className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
              </button>
            )}
          </div>
        )}
      />

      {/* Modal Create Supplier */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => !isSubmitting && setIsCreateOpen(false)}
        title="Ajouter un nouveau fournisseur"
        subtitle="Remplissez les coordonnées et informations fiscales du fournisseur"
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitCreate} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Code Fournisseur" required>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                placeholder="ex: FRS-001"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Type Partenaire" required>
              <select
                value={formData.partner_type}
                onChange={(e) => setFormData({ ...formData, partner_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              >
                <option value="SUPPLIER">Fournisseur uniquement</option>
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
                placeholder="ex: Fabricant Pesage Industriel SA"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Nom Commercial">
              <input
                type="text"
                value={formData.trade_name || ''}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                placeholder="ex: FPI Maroc"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
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
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Identifiant Fiscal (IF)">
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                placeholder="ex: 12345678"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Registre Commerce (RC)">
              <input
                type="text"
                value={formData.registration_number || ''}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                placeholder="ex: 65432 Tanger"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Téléphone">
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="ex: 0539000000"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="fournisseur@societe.ma"
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Site Web">
              <input
                type="text"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                placeholder="https://..."
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
                />
              </FormField>
            </div>
            <FormField label="Ville">
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="Tanger, Casablanca..."
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>
          </div>

          <FormField label="Notes & Observations">
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Conditions de règlement, délais de livraison, remarques..."
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none resize-none"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active_create_supplier"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-pesage-orange focus:ring-pesage-orange"
            />
            <label htmlFor="is_active_create_supplier" className="text-xs font-semibold text-app-text cursor-pointer">
              Compte fournisseur actif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setIsCreateOpen(false)}
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
              Créer le fournisseur
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Edit Supplier */}
      <Modal
        isOpen={!!editingSupplier}
        onClose={() => !isSubmitting && setEditingSupplier(null)}
        title="Modifier le fournisseur"
        subtitle={`Mise à jour des informations pour ${editingSupplier?.legal_name}`}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmitEdit} className="space-y-4">
          {modalError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs font-medium">
              {modalError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Code Fournisseur" required>
              <input
                type="text"
                required
                value={formData.code}
                onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Type Partenaire" required>
              <select
                value={formData.partner_type}
                onChange={(e) => setFormData({ ...formData, partner_type: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              >
                <option value="SUPPLIER">Fournisseur uniquement</option>
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
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Nom Commercial">
              <input
                type="text"
                value={formData.trade_name || ''}
                onChange={(e) => setFormData({ ...formData, trade_name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Numéro ICE">
              <input
                type="text"
                value={formData.ice || ''}
                onChange={(e) => setFormData({ ...formData, ice: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Identifiant Fiscal (IF)">
              <input
                type="text"
                value={formData.tax_id || ''}
                onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Registre Commerce (RC)">
              <input
                type="text"
                value={formData.registration_number || ''}
                onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FormField label="Téléphone">
              <input
                type="text"
                value={formData.phone || ''}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Email">
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>

            <FormField label="Site Web">
              <input
                type="text"
                value={formData.website || ''}
                onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
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
                  className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
                />
              </FormField>
            </div>
            <FormField label="Ville">
              <input
                type="text"
                value={formData.city || ''}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none"
              />
            </FormField>
          </div>

          <FormField label="Notes & Observations">
            <textarea
              rows={2}
              value={formData.notes || ''}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-orange outline-none resize-none"
            />
          </FormField>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active_edit_supplier"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4 rounded text-pesage-orange focus:ring-pesage-orange"
            />
            <label htmlFor="is_active_edit_supplier" className="text-xs font-semibold text-app-text cursor-pointer">
              Compte fournisseur actif
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => setEditingSupplier(null)}
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
              Enregistrer les modifications
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Deactivation/Activation */}
      <ConfirmDialog
        isOpen={!!deactivatingSupplier}
        title={deactivatingSupplier?.is_active ? 'Désactiver le fournisseur' : 'Réactiver le fournisseur'}
        message={
          deactivatingSupplier?.is_active
            ? `Êtes-vous sûr de vouloir désactiver le fournisseur ${deactivatingSupplier?.legal_name} ? Ce fournisseur ne pourra plus être sélectionné pour les nouveaux achats.`
            : `Êtes-vous sûr de vouloir réactiver le fournisseur ${deactivatingSupplier?.legal_name} ?`
        }
        confirmLabel={deactivatingSupplier?.is_active ? 'Désactiver' : 'Réactiver'}
        isLoading={isSubmitting}
        onConfirm={handleToggleActive}
        onClose={() => setDeactivatingSupplier(null)}
      />
    </div>
  );
};
