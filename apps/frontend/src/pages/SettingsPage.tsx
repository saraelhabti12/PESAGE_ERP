import React, { useState } from 'react';
import { useTheme } from '@/context/ThemeContext';
import { useNotification } from '@/context/NotificationContext';
import { PageHeader } from '@/components/ui/PageHeader';
import {
  Sun,
  Moon,
  Laptop,
  Globe,
  Coins,
  Calendar,
  Bell,
  CheckCircle2,
  Sliders,
  Sparkles,
  Save,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const { theme, setTheme } = useTheme();
  const { showSuccess } = useNotification();

  // Local state for preferences
  const [language, setLanguage] = useState(() => localStorage.getItem('erp_language') || 'fr');
  const [currency, setCurrency] = useState(() => localStorage.getItem('erp_currency') || 'MAD');
  const [dateFormat, setDateFormat] = useState(() => localStorage.getItem('erp_date_format') || 'DD/MM/YYYY');
  const [notifyPurchases, setNotifyPurchases] = useState(() => localStorage.getItem('erp_notify_purchases') !== 'false');
  const [notifyCatalog, setNotifyCatalog] = useState(() => localStorage.getItem('erp_notify_catalog') !== 'false');
  const [notifySound, setNotifySound] = useState(() => localStorage.getItem('erp_notify_sound') === 'true');

  const handleSaveSettings = () => {
    localStorage.setItem('erp_language', language);
    localStorage.setItem('erp_currency', currency);
    localStorage.setItem('erp_date_format', dateFormat);
    localStorage.setItem('erp_notify_purchases', String(notifyPurchases));
    localStorage.setItem('erp_notify_catalog', String(notifyCatalog));
    localStorage.setItem('erp_notify_sound', String(notifySound));

    showSuccess('Préférences enregistrées avec succès.');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Paramètres de l'Application"
          description="Personnalisez l'affichage, les préférences régionales et la gestion de vos alertes."
        />
        <button
          type="button"
          onClick={handleSaveSettings}
          className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-pesage-blue hover:bg-blue-700 rounded-xl transition shadow-sm"
        >
          <Save className="w-4 h-4" />
          Enregistrer les paramètres
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Section 1: Thème et Apparence */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-app-text-primary flex items-center gap-2 border-b border-app-border pb-3">
            <Sun className="w-5 h-5 text-amber-500" />
            Thème Visuel
          </h3>
          <p className="text-xs text-app-text-muted">
            Choisissez l'apparence de l'interface qui correspond à votre environnement de travail.
          </p>

          <div className="grid grid-cols-1 gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
                theme === 'light'
                  ? 'border-pesage-blue bg-blue-50/50 dark:bg-blue-950/40 text-pesage-blue ring-1 ring-pesage-blue'
                  : 'border-app-border bg-app-surface text-app-text-primary hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Sun className="w-4 h-4 text-amber-500" />
                <span>Mode Clair (Pesage 2000)</span>
              </div>
              {theme === 'light' && <CheckCircle2 className="w-4 h-4 text-pesage-blue" />}
            </button>

            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex items-center justify-between p-3 rounded-xl border text-sm font-medium transition ${
                theme === 'dark'
                  ? 'border-pesage-blue bg-blue-50/50 dark:bg-blue-950/40 text-pesage-blue ring-1 ring-pesage-blue'
                  : 'border-app-border bg-app-surface text-app-text-primary hover:bg-gray-50 dark:hover:bg-gray-800/60'
              }`}
            >
              <div className="flex items-center gap-3">
                <Moon className="w-4 h-4 text-indigo-400" />
                <span>Mode Sombre (Dark Slate)</span>
              </div>
              {theme === 'dark' && <CheckCircle2 className="w-4 h-4 text-pesage-blue" />}
            </button>
          </div>
        </div>

        {/* Section 2: Préférences Régionales */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-app-text-primary flex items-center gap-2 border-b border-app-border pb-3">
            <Globe className="w-5 h-5 text-pesage-blue" />
            Paramètres Régionaux
          </h3>
          <p className="text-xs text-app-text-muted">
            Configurez la langue, la devise et le format de date appliqués aux documents.
          </p>

          <div className="space-y-4 pt-1">
            <div>
              <label className="text-xs font-semibold text-app-text-muted block mb-1.5 flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-pesage-blue" />
                Langue de l'ERP
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-xl text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              >
                <option value="fr">Français (Maroc / France)</option>
                <option value="ar" disabled>
                  Arabe (Bientôt disponible)
                </option>
                <option value="en" disabled>
                  English (Bientôt disponible)
                </option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-text-muted block mb-1.5 flex items-center gap-1.5">
                <Coins className="w-3.5 h-3.5 text-pesage-orange" />
                Devise Principale
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-xl text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              >
                <option value="MAD">Dirham Marocain (MAD / DH)</option>
                <option value="EUR">Euro (€)</option>
                <option value="USD">Dollar Américain ($)</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-app-text-muted block mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                Format de Date
              </label>
              <select
                value={dateFormat}
                onChange={(e) => setDateFormat(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-app-surface border border-app-border rounded-xl text-app-text-primary focus:outline-none focus:ring-2 focus:ring-pesage-blue"
              >
                <option value="DD/MM/YYYY">JJ/MM/AAAA (ex: 27/08/2026)</option>
                <option value="YYYY-MM-DD">AAAA-MM-JJ (ex: 2026-08-27)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Section 3: Alertes et Notifications */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-base font-bold text-app-text-primary flex items-center gap-2 border-b border-app-border pb-3">
            <Bell className="w-5 h-5 text-pesage-orange" />
            Alertes & Notifications
          </h3>
          <p className="text-xs text-app-text-muted">
            Activez ou désactivez les flux d'alertes instantanées dans l'interface.
          </p>

          <div className="space-y-4 pt-1">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-app-border bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition">
              <input
                type="checkbox"
                checked={notifyPurchases}
                onChange={(e) => setNotifyPurchases(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-pesage-blue rounded border-app-border focus:ring-pesage-blue"
              />
              <div>
                <span className="text-sm font-semibold text-app-text-primary block">Achats & Réceptions</span>
                <span className="text-xs text-app-text-muted">
                  Recevoir une alerte lors de l'approbation d'une commande ou d'une réception.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-app-border bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition">
              <input
                type="checkbox"
                checked={notifyCatalog}
                onChange={(e) => setNotifyCatalog(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-pesage-blue rounded border-app-border focus:ring-pesage-blue"
              />
              <div>
                <span className="text-sm font-semibold text-app-text-primary block">Catalogue & Partenaires</span>
                <span className="text-xs text-app-text-muted">
                  Recevoir une alerte lors de la création d'un nouveau client ou article.
                </span>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-app-border bg-gray-50/50 dark:bg-gray-800/30 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition">
              <input
                type="checkbox"
                checked={notifySound}
                onChange={(e) => setNotifySound(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-pesage-blue rounded border-app-border focus:ring-pesage-blue"
              />
              <div>
                <span className="text-sm font-semibold text-app-text-primary block">Signal Sonore Discret</span>
                <span className="text-xs text-app-text-muted">
                  Émettre un signal sonore lors de l'arrivée d'une notification critique.
                </span>
              </div>
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
