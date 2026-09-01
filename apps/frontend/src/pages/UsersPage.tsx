import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { User, Role } from '@/types/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { StatusFilter } from '@/components/ui/StatusFilter';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { formatDate } from '@/lib/formatters';
import { Users as UsersIcon, UserPlus, Edit2, Ban, CheckCircle2, Loader2, Shield } from 'lucide-react';

export const UsersPage: React.FC = () => {
  const { user: currentUser } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [users, setUsers] = useState<User[]>([]);
  const [rolesList, setRolesList] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deactivatingUser, setDeactivatingUser] = useState<User | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    role_ids: [] as number[],
  });

  const [editFormData, setEditFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    password: '',
    is_active: true,
    role_ids: [] as number[],
  });

  const roleNames = currentUser?.roles?.map((r) => r.name) || [];
  const userPerms = currentUser?.roles?.flatMap((r) => r.permissions?.map((p) => p.code) || []) || [];
  const canCreate = roleNames.includes('ADMIN') || userPerms.includes('users.create');
  const canUpdate = roleNames.includes('ADMIN') || userPerms.includes('users.update');
  const canDelete = roleNames.includes('ADMIN') || userPerms.includes('users.delete');

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    try {
      let url = '/api/v1/users?size=100';
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (statusFilter !== 'all') url += `&is_active=${statusFilter === 'active'}`;

      const res = await api.get<User[]>(url);
      setUsers(res.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger la liste des utilisateurs.');
    } finally {
      setIsLoading(false);
    }
  }, [search, statusFilter, showError]);

  const fetchRoles = async () => {
    try {
      const res = await api.get<Role[]>('/api/v1/roles');
      setRolesList(res.data);
    } catch {
      // Ignore if non-admin
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/api/v1/users', formData);
      showSuccess('Utilisateur créé avec succès.');
      setIsCreateOpen(false);
      setFormData({ first_name: '', last_name: '', email: '', phone: '', password: '', role_ids: [] });
      fetchUsers();
    } catch (err: any) {
      if (!err.response) {
        setModalError('Impossible de contacter le serveur.');
      } else if (err.response.status === 409) {
        setModalError(err.response.data?.detail || err.response.data?.error?.message || 'Cette adresse e-mail est déjà utilisée.');
      } else if (err.response.status === 403) {
        setModalError("Vous n'avez pas l'autorisation de créer un utilisateur.");
      } else if (err.response.status === 422) {
        const details = err.response.data?.detail || err.response.data?.error?.details;
        if (Array.isArray(details)) {
          setModalError(details.map((d: any) => d.msg).join(', '));
        } else {
          setModalError('Veuillez vérifier les informations saisies.');
        }
      } else if (err.response.status >= 500) {
        setModalError('Une erreur interne est survenue. Consultez les journaux du serveur.');
      } else {
        setModalError(err.response.data?.detail || err.response.data?.error?.message || 'Échec de la création de l\'utilisateur.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      const payload: any = {
        first_name: editFormData.first_name,
        last_name: editFormData.last_name,
        email: editFormData.email,
        phone: editFormData.phone || undefined,
        is_active: editFormData.is_active,
        role_ids: editFormData.role_ids,
      };
      if (editFormData.password) {
        payload.password = editFormData.password;
      }
      await api.put(`/api/v1/users/${editingUser.id}`, payload);
      showSuccess('Utilisateur mis à jour avec succès.');
      setEditingUser(null);
      fetchUsers();
    } catch (err: any) {
      if (!err.response) {
        setModalError('Impossible de contacter le serveur.');
      } else if (err.response.status === 409) {
        setModalError(err.response.data?.detail || err.response.data?.error?.message || 'Cette adresse e-mail est déjà utilisée.');
      } else if (err.response.status === 403) {
        setModalError("Vous n'avez pas l'autorisation de modifier cet utilisateur.");
      } else if (err.response.status === 422) {
        setModalError('Veuillez vérifier les informations saisies.');
      } else if (err.response.status >= 500) {
        setModalError('Une erreur interne est survenue. Consultez les journaux du serveur.');
      } else {
        setModalError(err.response.data?.detail || err.response.data?.error?.message || 'Échec de la mise à jour de l\'utilisateur.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDeactivate = async () => {
    if (!deactivatingUser) return;
    setIsSubmitting(true);
    try {
      await api.delete(`/api/v1/users/${deactivatingUser.id}`);
      showSuccess(`Utilisateur "${deactivatingUser.email}" désactivé avec succès.`);
      setDeactivatingUser(null);
      fetchUsers();
    } catch (err: any) {
      if (!err.response) {
        showError('Impossible de contacter le serveur.');
      } else if (err.response.status === 403) {
        showError("Vous n'avez pas l'autorisation de désactiver cet utilisateur.");
      } else {
        showError(err.response?.data?.detail || err.response?.data?.error?.message || 'Échec de la désactivation de l\'utilisateur.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (u: User) => {
    setEditingUser(u);
    setEditFormData({
      first_name: u.first_name || '',
      last_name: u.last_name || '',
      email: u.email,
      phone: u.phone || '',
      password: '',
      is_active: u.is_active,
      role_ids: u.roles?.map((r) => r.id) || [],
    });
    setModalError(null);
  };

  const columns: Column<User>[] = [
    {
      header: 'Utilisateur',
      accessor: (u) => (
        <div>
          <span className="font-semibold text-slate-100 block">
            {u.first_name} {u.last_name}
          </span>
          <span className="text-[11px] text-slate-400 font-mono block">{u.email}</span>
        </div>
      ),
    },
    {
      header: 'Téléphone',
      accessor: (u) => <span className="text-slate-400 font-mono">{u.phone || '-'}</span>,
    },
    {
      header: 'Rôles attribués',
      accessor: (u) => (
        <div className="flex flex-wrap gap-1">
          {u.roles?.map((r) => (
            <span
              key={r.id}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-brand-500/10 text-brand-300 border border-brand-500/20 text-[10px] font-semibold"
            >
              <Shield className="w-2.5 h-2.5" />
              <span>{r.name}</span>
            </span>
          )) || <span className="text-slate-500">-</span>}
        </div>
      ),
    },
    {
      header: 'Dernière connexion',
      accessor: (u) => <span className="text-slate-400 text-[11px]">{formatDate(u.last_login_at)}</span>,
    },
    {
      header: 'Statut',
      accessor: (u) =>
        u.is_active ? (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            <span>Actif</span>
          </span>
        ) : (
          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <Ban className="w-3 h-3" />
            <span>Inactif</span>
          </span>
        ),
      width: '110px',
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des utilisateurs"
        subtitle="Administration des comptes utilisateurs, attributions de rôles et accès système"
        icon={UsersIcon}
        action={
          canCreate
            ? {
                label: 'Ajouter un utilisateur',
                onClick: () => {
                  setFormData({ first_name: '', last_name: '', email: '', phone: '', password: '', role_ids: [] });
                  setModalError(null);
                  setIsCreateOpen(true);
                },
                icon: UserPlus,
              }
            : undefined
        }
      />

      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Rechercher par nom, prénom ou e-mail..."
        />
        <StatusFilter value={statusFilter} onChange={setStatusFilter} />
      </div>

      <DataTable
        columns={columns}
        data={users}
        keyExtractor={(u) => u.id}
        isLoading={isLoading}
        emptyTitle="Aucun utilisateur trouvé"
        emptyDescription="Aucun compte ne correspond à vos critères de recherche."
        actions={(u) => (
          <div className="flex items-center justify-end space-x-1.5">
            {canUpdate && (
              <button
                onClick={() => openEditModal(u)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Modifier l'utilisateur"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && u.is_active && u.id !== currentUser?.id && (
              <button
                onClick={() => setDeactivatingUser(u)}
                className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 transition-colors border border-rose-500/20"
                title="Désactiver l'utilisateur"
              >
                <Ban className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Ajouter un utilisateur"
        subtitle="Création d'un nouveau compte d'accès à la plateforme ERP"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleCreateSubmit}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-pesage-blue/20"
            >
              {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>Enregistrer</span>
            </button>
          </>
        }
      >
        {modalError && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
            {modalError}
          </div>
        )}

        <form onSubmit={handleCreateSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Prénom" required>
              <input
                type="text"
                required
                placeholder="ex. Karim"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Nom" required>
              <input
                type="text"
                required
                placeholder="ex. Benani"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>
          </div>

          <FormField label="Adresse E-mail professionnelle" required>
            <input
              type="email"
              required
              placeholder="karim.benani@entreprise.ma"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <FormField label="Téléphone">
            <input
              type="tel"
              placeholder="+212 600 000000"
              value={formData.phone}
              onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
            />
          </FormField>

          <FormField label="Mot de passe" required>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <FormField label="Rôles attribués">
            <div className="grid grid-cols-2 gap-2 pt-1">
              {rolesList.map((role) => (
                <label
                  key={role.id}
                  className="flex items-center space-x-2 p-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text font-medium cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.role_ids.includes(role.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, role_ids: [...formData.role_ids, role.id] });
                      } else {
                        setFormData({ ...formData, role_ids: formData.role_ids.filter((id) => id !== role.id) });
                      }
                    }}
                    className="rounded bg-slate-900 border-slate-800 text-brand-600 focus:ring-0"
                  />
                  <span>{role.name}</span>
                </label>
              ))}
            </div>
          </FormField>
        </form>
      </Modal>

      {/* Edit User Modal */}
      {editingUser && (
        <Modal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          title="Modifier l'utilisateur"
          subtitle={`Modification du compte de ${editingUser.first_name} ${editingUser.last_name}`}
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white text-xs font-semibold flex items-center space-x-1.5 shadow-md shadow-pesage-blue/20"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Enregistrer les modifications</span>
              </button>
            </>
          }
        >
          {modalError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-medium">
              {modalError}
            </div>
          )}

          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField label="Prénom" required>
                <input
                  type="text"
                  required
                  value={editFormData.first_name}
                  onChange={(e) => setEditFormData({ ...editFormData, first_name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
                />
              </FormField>

              <FormField label="Nom" required>
                <input
                  type="text"
                  required
                  value={editFormData.last_name}
                  onChange={(e) => setEditFormData({ ...editFormData, last_name: e.target.value })}
                  className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
                />
              </FormField>
            </div>

            <FormField label="Adresse E-mail" required>
              <input
                type="email"
                required
                value={editFormData.email}
                onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Téléphone">
              <input
                type="tel"
                value={editFormData.phone}
                onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-brand-500 font-mono"
              />
            </FormField>

            <FormField label="Nouveau mot de passe (laisser vide pour ne pas modifier)">
              <input
                type="password"
                placeholder="••••••••"
                value={editFormData.password}
                onChange={(e) => setEditFormData({ ...editFormData, password: e.target.value })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
              />
            </FormField>

            <FormField label="Rôles attribués">
              <div className="grid grid-cols-2 gap-2 pt-1">
                {rolesList.map((role) => (
                  <label
                    key={role.id}
                    className="flex items-center space-x-2 p-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 font-medium cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editFormData.role_ids.includes(role.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditFormData({ ...editFormData, role_ids: [...editFormData.role_ids, role.id] });
                        } else {
                          setEditFormData({
                            ...editFormData,
                            role_ids: editFormData.role_ids.filter((id) => id !== role.id),
                          });
                        }
                      }}
                      className="rounded bg-slate-900 border-slate-800 text-brand-600 focus:ring-0"
                    />
                    <span>{role.name}</span>
                  </label>
                ))}
              </div>
            </FormField>

            <div className="flex items-center space-x-2 pt-1">
              <input
                type="checkbox"
                id="user_is_active"
                checked={editFormData.is_active}
                onChange={(e) => setEditFormData({ ...editFormData, is_active: e.target.checked })}
                className="rounded bg-slate-950 border-slate-800 text-brand-600 focus:ring-0 cursor-pointer"
              />
              <label htmlFor="user_is_active" className="text-xs text-slate-300 font-semibold cursor-pointer">
                Compte utilisateur actif
              </label>
            </div>
          </form>
        </Modal>
      )}

      {/* Confirm Deactivate Dialog */}
      <ConfirmDialog
        isOpen={!!deactivatingUser}
        onClose={() => setDeactivatingUser(null)}
        onConfirm={handleConfirmDeactivate}
        title="Désactiver l'utilisateur"
        message={`Êtes-vous sûr de vouloir désactiver le compte de ${deactivatingUser?.first_name} ${deactivatingUser?.last_name} (${deactivatingUser?.email}) ?`}
        confirmLabel="Désactiver"
        cancelLabel="Annuler"
        isLoading={isSubmitting}
      />
    </div>
  );
};
