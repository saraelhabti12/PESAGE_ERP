import React, { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Role, Permission } from '@/types/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { useNotification } from '@/context/NotificationContext';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Plus, Edit2, Loader2, Key } from 'lucide-react';

export const RolesPage: React.FC = () => {
  const { user } = useAuth();
  const { showSuccess, showError } = useNotification();

  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    permission_ids: [] as number[],
  });

  const [editFormData, setEditFormData] = useState({
    name: '',
    description: '',
    permission_ids: [] as number[],
  });

  const roleNames = user?.roles?.map((r) => r.name) || [];
  const canManage = roleNames.includes('ADMIN');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get<Role[]>('/api/v1/roles'),
        api.get<Permission[]>('/api/v1/permissions'),
      ]);
      setRoles(rolesRes.data);
      setPermissions(permsRes.data);
    } catch (err: any) {
      showError(err.response?.data?.error?.message || 'Impossible de charger la liste des rôles.');
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.post('/api/v1/roles', formData);
      showSuccess('Rôle créé avec succès.');
      setIsCreateOpen(false);
      setFormData({ name: '', description: '', permission_ids: [] });
      fetchData();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la création du rôle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRole) return;
    setIsSubmitting(true);
    setModalError(null);
    try {
      await api.put(`/api/v1/roles/${editingRole.id}`, editFormData);
      showSuccess('Rôle mis à jour avec succès.');
      setEditingRole(null);
      fetchData();
    } catch (err: any) {
      setModalError(err.response?.data?.error?.message || 'Échec de la mise à jour du rôle.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const openEditModal = (r: Role) => {
    setEditingRole(r);
    setEditFormData({
      name: r.name,
      description: r.description || '',
      permission_ids: r.permissions?.map((p) => p.id) || [],
    });
    setModalError(null);
  };

  const columns: Column<Role>[] = [
    {
      header: 'Rôle',
      accessor: (r) => (
        <span className="inline-flex items-center space-x-1.5 font-bold text-slate-100">
          <ShieldCheck className="w-4 h-4 text-brand-400" />
          <span>{r.name}</span>
        </span>
      ),
      width: '180px',
    },
    {
      header: 'Description',
      accessor: (r) => <span className="text-slate-400">{r.description || '-'}</span>,
    },
    {
      header: 'Permissions attribuées',
      accessor: (r) => (
        <div className="flex flex-wrap gap-1">
          {r.permissions?.map((p) => (
            <span
              key={p.id}
              className="inline-flex items-center space-x-1 px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 text-[10px] font-mono"
            >
              <Key className="w-2.5 h-2.5 text-cyan-400" />
              <span>{p.code}</span>
            </span>
          )) || <span className="text-slate-500">-</span>}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion des rôles (RBAC)"
        subtitle="Définition des profils d'accès et des habilitations système"
        icon={ShieldCheck}
        action={
          canManage
            ? {
                label: 'Ajouter un rôle',
                onClick: () => {
                  setFormData({ name: '', description: '', permission_ids: [] });
                  setModalError(null);
                  setIsCreateOpen(true);
                },
                icon: Plus,
              }
            : undefined
        }
      />

      <DataTable
        columns={columns}
        data={roles}
        keyExtractor={(r) => r.id}
        isLoading={isLoading}
        emptyTitle="Aucun rôle défini"
        emptyDescription="Aucun rôle n'est actuellement configuré dans le système."
        actions={(r) => (
          <div className="flex items-center justify-end space-x-1.5">
            {canManage && (
              <button
                onClick={() => openEditModal(r)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                title="Modifier le rôle"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      />

      {/* Create Role Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Ajouter un rôle"
        subtitle="Définition d'un profil de droits et attribution de permissions"
        maxWidth="4xl"
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
          <FormField label="Nom du rôle" required>
            <input
              type="text"
              required
              placeholder="ex. GESTIONNAIRE_COMMERCIAL"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
            />
          </FormField>

          <FormField label="Description">
            <textarea
              rows={2}
              placeholder="Description des responsabilités du rôle..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue"
            />
          </FormField>

          <FormField label="Permissions attribuées au rôle">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-60 overflow-y-auto">
              {permissions.map((perm) => (
                <label
                  key={perm.id}
                  className="flex items-center space-x-2 p-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text font-mono cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={formData.permission_ids.includes(perm.id)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFormData({ ...formData, permission_ids: [...formData.permission_ids, perm.id] });
                      } else {
                        setFormData({
                          ...formData,
                          permission_ids: formData.permission_ids.filter((id) => id !== perm.id),
                        });
                      }
                    }}
                    className="rounded bg-slate-900 border-slate-800 text-brand-600 focus:ring-0 cursor-pointer"
                  />
                  <span>{perm.code}</span>
                </label>
              ))}
            </div>
          </FormField>
        </form>
      </Modal>

      {/* Edit Role Modal */}
      {editingRole && (
        <Modal
          isOpen={!!editingRole}
          onClose={() => setEditingRole(null)}
          title="Modifier le rôle"
          subtitle={`Modification du rôle ${editingRole.name}`}
          maxWidth="4xl"
          footer={
            <>
              <button
                type="button"
                onClick={() => setEditingRole(null)}
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
            <FormField label="Nom du rôle" required>
              <input
                type="text"
                required
                value={editFormData.name}
                onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value.toUpperCase() })}
                className="w-full px-3.5 py-2 bg-app-surface border border-app-border rounded-xl text-app-text text-xs focus:outline-none focus:border-pesage-blue font-mono"
              />
            </FormField>

            <FormField label="Description">
              <textarea
                rows={2}
                value={editFormData.description}
                onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-slate-200 text-xs focus:outline-none focus:border-brand-500"
              />
            </FormField>

            <FormField label="Permissions attribuées au rôle">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1 max-h-60 overflow-y-auto">
                {permissions.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex items-center space-x-2 p-2 rounded-xl bg-app-surface border border-app-border text-xs text-app-text font-mono cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={editFormData.permission_ids.includes(perm.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditFormData({
                            ...editFormData,
                            permission_ids: [...editFormData.permission_ids, perm.id],
                          });
                        } else {
                          setEditFormData({
                            ...editFormData,
                            permission_ids: editFormData.permission_ids.filter((id) => id !== perm.id),
                          });
                        }
                      }}
                      className="rounded bg-slate-900 border-slate-800 text-brand-600 focus:ring-0 cursor-pointer"
                    />
                    <span>{perm.code}</span>
                  </label>
                ))}
              </div>
            </FormField>
          </form>
        </Modal>
      )}
    </div>
  );
};
