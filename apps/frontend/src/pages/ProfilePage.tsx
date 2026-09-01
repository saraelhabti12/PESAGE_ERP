import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/NotificationContext';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import {
  User as UserIcon,
  Mail,
  Phone,
  Shield,
  KeyRound,
  Edit,
  CheckCircle2,
  Calendar,
  Lock,
  AlertTriangle,
  Clock,
  Sparkles,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const { user, login } = useAuth();
  const { showSuccess, showError } = useNotification();

  // Profile Edit Modal State
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [profileForm, setProfileForm] = useState({
    first_name: user?.first_name || '',
    last_name: user?.last_name || '',
    email: user?.email || '',
    phone: user?.phone || '',
  });

  // Password Change Modal State
  const [isPasswordOpen, setIsPasswordOpen] = useState(false);
  const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  const handleOpenEdit = () => {
    setProfileForm({
      first_name: user?.first_name || '',
      last_name: user?.last_name || '',
      email: user?.email || '',
      phone: user?.phone || '',
    });
    setEditError(null);
    setIsEditOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError(null);
    setIsEditSubmitting(true);

    try {
      const res = await api.put('/api/v1/auth/me', profileForm);
      showSuccess('Profil mis à jour avec succès.');
      setIsEditOpen(false);
      // Reload window or trigger soft reload
      window.location.reload();
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Erreur lors de la mise à jour du profil.';
      setEditError(msg);
      showError(msg);
    } finally {
      setIsEditSubmitting(false);
    }
  };

  const handleOpenPassword = () => {
    setPasswordForm({
      current_password: '',
      new_password: '',
      confirm_password: '',
    });
    setPasswordError(null);
    setIsPasswordOpen(true);
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setPasswordError('Le nouveau mot de passe et la confirmation ne correspondent pas.');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      setPasswordError('Le nouveau mot de passe doit comporter au moins 8 caractères.');
      return;
    }

    setIsPasswordSubmitting(true);
    try {
      await api.post('/api/v1/auth/change-password', passwordForm);
      showSuccess('Mot de passe modifié avec succès.');
      setIsPasswordOpen(false);
    } catch (err: any) {
      const msg = err.response?.data?.error?.message || 'Erreur lors de la modification du mot de passe.';
      setPasswordError(msg);
      showError(msg);
    } finally {
      setIsPasswordSubmitting(false);
    }
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="Mon Profil"
        description="Gérez vos informations personnelles, votre sécurité et consultez vos habilitations d'accès."
      />

      {/* Main Profile Header Card */}
      <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-br from-pesage-blue/10 to-pesage-orange/10 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-pesage-blue to-blue-700 flex items-center justify-center text-white text-2xl font-bold shadow-md shadow-pesage-blue/20">
              {user?.first_name ? user.first_name[0].toUpperCase() : 'U'}
              {user?.last_name ? user.last_name[0].toUpperCase() : ''}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-app-text-primary">
                  {user?.first_name} {user?.last_name}
                </h2>
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                    user?.is_active
                      ? 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                      : 'bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                  }`}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  {user?.is_active ? 'Compte Actif' : 'Inactif'}
                </span>
              </div>
              <p className="text-sm text-app-text-muted mt-1 flex items-center gap-2">
                <Mail className="w-3.5 h-3.5" />
                {user?.email}
              </p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                {(user?.roles || []).map((role) => (
                  <span
                    key={role.id}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 dark:bg-blue-950/40 text-pesage-blue dark:text-blue-300 border border-blue-200 dark:border-blue-800"
                  >
                    <Shield className="w-3 h-3" />
                    {role.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <button
              type="button"
              onClick={handleOpenEdit}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-app-text-primary bg-app-surface border border-app-border hover:bg-gray-50 dark:hover:bg-gray-800/80 rounded-xl transition shadow-sm"
            >
              <Edit className="w-4 h-4 text-pesage-blue" />
              Modifier mes informations
            </button>
            <button
              type="button"
              onClick={handleOpenPassword}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-pesage-blue hover:bg-blue-700 rounded-xl transition shadow-sm"
            >
              <KeyRound className="w-4 h-4" />
              Changer mon mot de passe
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personal details card */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-app-text-primary flex items-center gap-2 border-b border-app-border pb-3">
            <UserIcon className="w-5 h-5 text-pesage-blue" />
            Informations du Compte
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-app-text-muted text-xs block mb-1">Prénom</span>
              <span className="font-semibold text-app-text-primary">{user?.first_name || '—'}</span>
            </div>
            <div>
              <span className="text-app-text-muted text-xs block mb-1">Nom</span>
              <span className="font-semibold text-app-text-primary">{user?.last_name || '—'}</span>
            </div>
            <div>
              <span className="text-app-text-muted text-xs block mb-1">Adresse Email</span>
              <span className="font-semibold text-app-text-primary">{user?.email}</span>
            </div>
            <div>
              <span className="text-app-text-muted text-xs block mb-1">Téléphone</span>
              <span className="font-semibold text-app-text-primary">{user?.phone || 'Non renseigné'}</span>
            </div>
            <div>
              <span className="text-app-text-muted text-xs block mb-1">Date de création</span>
              <span className="text-app-text-primary font-medium flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-app-text-muted" />
                {formatDate(user?.created_at)}
              </span>
            </div>
            <div>
              <span className="text-app-text-muted text-xs block mb-1">Dernière mise à jour</span>
              <span className="text-app-text-primary font-medium flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-app-text-muted" />
                {formatDate(user?.updated_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Security & Access Rights Card */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-app-text-primary flex items-center gap-2 border-b border-app-border pb-3">
            <Shield className="w-5 h-5 text-pesage-orange" />
            Sécurité & Droits d'Accès
          </h3>

          <div className="space-y-3 text-sm">
            <div>
              <span className="text-app-text-muted text-xs block mb-1.5">Rôles attribués</span>
              <div className="flex flex-wrap gap-2">
                {(user?.roles || []).map((role) => (
                  <div
                    key={role.id}
                    className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/60 border border-app-border flex-1 min-w-[140px]"
                  >
                    <div className="font-bold text-app-text-primary text-xs">{role.name}</div>
                    <div className="text-[11px] text-app-text-muted mt-0.5">
                      {role.description || 'Rôle standard du système'}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2">
              <span className="text-app-text-muted text-xs block mb-1.5">Permissions effectives</span>
              <div className="max-h-36 overflow-y-auto p-2 bg-gray-50 dark:bg-gray-800/40 border border-app-border rounded-xl flex flex-wrap gap-1.5">
                {Array.from(
                  new Set((user?.roles || []).flatMap((r) => r.permissions?.map((p) => p.code) || []))
                ).map((permCode) => (
                  <span
                    key={permCode}
                    className="px-2 py-0.5 rounded text-[11px] font-mono bg-white dark:bg-gray-900 text-app-text-muted border border-app-border"
                  >
                    {permCode}
                  </span>
                ))}
                {(!user?.roles || user.roles.length === 0) && (
                  <span className="text-xs text-app-text-muted italic">Aucune permission spécifique</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* EDIT PROFILE MODAL                                                        */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isEditOpen}
        onClose={() => !isEditSubmitting && setIsEditOpen(false)}
        title="Modifier mes informations"
        maxWidth="lg"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          {editError && (
            <div className="p-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Prénom *" required>
              <input
                type="text"
                value={profileForm.first_name}
                onChange={(e) => setProfileForm({ ...profileForm, first_name: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              />
            </FormField>

            <FormField label="Nom *" required>
              <input
                type="text"
                value={profileForm.last_name}
                onChange={(e) => setProfileForm({ ...profileForm, last_name: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              />
            </FormField>
          </div>

          <FormField label="Adresse Email *" required>
            <input
              type="email"
              value={profileForm.email}
              onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
              required
              className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
            />
          </FormField>

          <FormField label="Téléphone">
            <input
              type="tel"
              value={profileForm.phone}
              onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
              placeholder="Ex: +212 6 00 00 00 00"
              className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isEditSubmitting}
              onClick={() => setIsEditOpen(false)}
              className="px-4 py-2 text-sm font-medium text-app-text-muted hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isEditSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-pesage-blue hover:bg-blue-700 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              {isEditSubmitting ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </button>
          </div>
        </form>
      </Modal>

      {/* ========================================================================= */}
      {/* CHANGE PASSWORD MODAL                                                     */}
      {/* ========================================================================= */}
      <Modal
        isOpen={isPasswordOpen}
        onClose={() => !isPasswordSubmitting && setIsPasswordOpen(false)}
        title="Changer mon mot de passe"
        maxWidth="md"
      >
        <form onSubmit={handleSavePassword} className="space-y-4">
          {passwordError && (
            <div className="p-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <FormField label="Mot de passe actuel *" required>
            <div className="relative">
              <input
                type="password"
                value={passwordForm.current_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, current_password: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              />
              <Lock className="w-4 h-4 text-app-text-muted absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </FormField>

          <FormField label="Nouveau mot de passe (min 8 caractères) *" required>
            <div className="relative">
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                required
                minLength={8}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              />
              <Lock className="w-4 h-4 text-app-text-muted absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </FormField>

          <FormField label="Confirmer le nouveau mot de passe *" required>
            <div className="relative">
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                required
                minLength={8}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-lg text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              />
              <Lock className="w-4 h-4 text-app-text-muted absolute right-3 top-2.5 pointer-events-none" />
            </div>
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-app-border">
            <button
              type="button"
              disabled={isPasswordSubmitting}
              onClick={() => setIsPasswordOpen(false)}
              className="px-4 py-2 text-sm font-medium text-app-text-muted hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isPasswordSubmitting}
              className="px-5 py-2 text-sm font-semibold text-white bg-pesage-blue hover:bg-blue-700 rounded-lg transition shadow-sm disabled:opacity-50"
            >
              {isPasswordSubmitting ? 'Modification...' : 'Modifier le mot de passe'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
