import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { api } from '@/lib/api';
import { PageHeader } from '@/components/ui/PageHeader';
import { formatCurrency } from '@/lib/formatters';
import { DashboardStatsResponse } from '@/types/dashboard';
import {
  LayoutDashboard,
  Package,
  Layers,
  Tag,
  Award,
  Scale,
  RefreshCw,
  CheckCircle2,
  Ban,
  Boxes,
  TrendingUp,
  ShoppingCart,
  ShoppingBag,
  Wrench,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Users,
  Building2,
  Receipt,
  Truck,
  Clock,
  ArrowUpRight,
  Activity,
  Calendar,
  DollarSign,
  FileText,
} from 'lucide-react';

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStatsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardStats = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    try {
      const res = await api.get<DashboardStatsResponse>('/api/v1/dashboard/stats');
      setStats(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Impossible de charger les statistiques du tableau de bord.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, [fetchDashboardStats]);

  const primaryRole = user?.roles?.[0]?.name || 'Utilisateur';

  const formatActivityTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <PageHeader
        title="Tableau de bord"
        description="Vue opérationnelle en direct des modules Catalogue, Partenaires et Achats Pesage 2000."
      />

      {/* Welcome & Session Banner */}
      <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 relative overflow-hidden">
        <div className="space-y-1 relative z-10">
          <div className="flex items-center gap-2.5">
            <h2 className="text-lg font-bold text-app-text-primary">
              Bienvenue, {user?.first_name} {user?.last_name}
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-pesage-blue/10 text-pesage-blue dark:text-pesage-blue-light border border-pesage-blue/20 uppercase tracking-wider">
              {primaryRole}
            </span>
          </div>
          <p className="text-xs text-app-text-muted">
            Données opérationnelles en temps réel connectées à la base PostgreSQL de l'ERP Pesage 2000.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0 relative z-10">
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-xs text-app-text-muted">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span className="font-medium text-app-text-primary">Session Sécurisée</span>
          </div>
          <button
            onClick={fetchDashboardStats}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-pesage-blue text-white text-xs font-semibold hover:bg-blue-700 transition shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Actualiser</span>
          </button>
        </div>
      </div>

      {/* Error State Banner */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="text-xs font-medium">{error}</span>
          </div>
          <button
            onClick={fetchDashboardStats}
            className="px-3.5 py-1.5 rounded-xl bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 transition-colors shadow-xs"
          >
            Réessayer
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SECTION 1: PURCHASES & COMMERCIAL OVERVIEW                                */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-pesage-orange" />
            Achats & Approvisionnements (Données Réelles)
          </h3>
          <button
            onClick={() => navigate('/achats')}
            className="text-xs text-pesage-blue hover:underline flex items-center gap-1 font-semibold"
          >
            Gérer les achats <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Commandes d'Achat */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Total Commandes d'Achat</span>
              <div className="p-2 rounded-xl bg-pesage-blue/10 text-pesage-blue">
                <FileText className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-app-text-primary tracking-tight">
                {isLoading ? '...' : stats?.purchases.total_orders ?? 0}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-app-text-muted">
                <span className="text-pesage-blue font-semibold">
                  {stats?.purchases.approved_orders ?? 0} approuvées
                </span>
                <span>•</span>
                <span>{stats?.purchases.draft_orders ?? 0} brouillons</span>
              </div>
            </div>
          </div>

          {/* Card 2: Montant Total Commandé (HT) */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Volume Achats (HT)</span>
              <div className="p-2 rounded-xl bg-pesage-orange/10 text-pesage-orange">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-pesage-blue tracking-tight">
                {isLoading ? '...' : formatCurrency(stats?.purchases.total_subtotal_ht || 0)}
              </p>
              <p className="text-[11px] text-app-text-muted mt-1.5">
                Total TTC : {isLoading ? '...' : formatCurrency(stats?.purchases.total_ttc || 0)}
              </p>
            </div>
          </div>

          {/* Card 3: Réceptions Partielle / Complète */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Réceptions de Marchandises</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <Truck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '...' : stats?.purchases.received_orders ?? 0}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-app-text-muted">
                <span className="text-amber-600 font-semibold">
                  {stats?.purchases.partially_received_orders ?? 0} partielles
                </span>
                <span>•</span>
                <span>{stats?.purchases.received_orders ?? 0} complètes</span>
              </div>
            </div>
          </div>

          {/* Card 4: Fournisseurs Actifs */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Fournisseurs Enregistrés</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-app-text-primary tracking-tight">
                {isLoading ? '...' : stats?.partners.total_suppliers ?? 0}
              </p>
              <p className="text-[11px] text-emerald-600 font-medium mt-1.5">
                {stats?.partners.active_suppliers ?? 0} fournisseurs actifs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: CATALOG & PARTNERS METRICS                                     */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Catalog Highlights (2 cols) */}
        <div className="lg:col-span-2 bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-app-border pb-3">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-pesage-blue" />
              <h3 className="text-sm font-bold text-app-text-primary">
                Catalogue Matériel & Métrologie Pesage 2000
              </h3>
            </div>
            <button
              onClick={() => navigate('/products')}
              className="text-xs text-pesage-blue hover:underline flex items-center gap-1 font-semibold"
            >
              Voir articles <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-app-border text-center">
              <span className="text-xs text-app-text-muted block mb-1">Total Articles</span>
              <span className="text-xl font-bold text-app-text-primary">
                {isLoading ? '...' : stats?.catalog.total_products ?? 0}
              </span>
              <span className="text-[10px] text-emerald-600 block mt-0.5">
                {stats?.catalog.active_products ?? 0} actifs
              </span>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-app-border text-center">
              <span className="text-xs text-app-text-muted block mb-1">Catégories</span>
              <span className="text-xl font-bold text-app-text-primary">
                {isLoading ? '...' : stats?.catalog.total_categories ?? 0}
              </span>
              <span className="text-[10px] text-app-text-muted block mt-0.5">Arborescence</span>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-app-border text-center">
              <span className="text-xs text-app-text-muted block mb-1">Types Produits</span>
              <span className="text-xl font-bold text-app-text-primary">
                {isLoading ? '...' : stats?.catalog.total_product_types ?? 0}
              </span>
              <span className="text-[10px] text-app-text-muted block mt-0.5">Familles</span>
            </div>

            <div className="p-3.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-app-border text-center">
              <span className="text-xs text-app-text-muted block mb-1">Marques / Unités</span>
              <span className="text-xl font-bold text-app-text-primary">
                {isLoading ? '...' : `${stats?.catalog.total_brands ?? 0} / ${stats?.catalog.total_units ?? 0}`}
              </span>
              <span className="text-[10px] text-app-text-muted block mt-0.5">Référencées</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-blue-50/40 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 flex items-center justify-between text-xs">
            <span className="text-app-text-muted">
              Clients référencés : <strong className="text-app-text-primary">{stats?.partners.total_customers ?? 0}</strong> ({stats?.partners.active_customers ?? 0} actifs)
            </span>
            <button
              onClick={() => navigate('/customers')}
              className="text-pesage-blue font-semibold hover:underline"
            >
              Consulter les clients →
            </button>
          </div>
        </div>

        {/* Real Activity Timeline (1 col) */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-app-border pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-pesage-blue" />
              <h3 className="text-sm font-bold text-app-text-primary">Journal d'Activité</h3>
            </div>
            <span className="text-[11px] text-app-text-muted">En direct</span>
          </div>

          <div className="space-y-3 max-h-[260px] overflow-y-auto pr-1">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-app-text-muted">
                Chargement des activités...
              </div>
            ) : !stats?.recent_activity || stats.recent_activity.length === 0 ? (
              <div className="p-6 text-center text-xs text-app-text-muted">
                Aucune activité récente enregistrée.
              </div>
            ) : (
              stats.recent_activity.map((item) => (
                <div key={item.id} className="p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/40 border border-app-border flex items-start justify-between gap-2 text-xs">
                  <div className="space-y-0.5 min-w-0">
                    <p className="font-semibold text-app-text-primary truncate">{item.title}</p>
                    <div className="flex items-center gap-2 text-[10px] text-app-text-muted">
                      {item.reference && <span className="font-mono bg-white dark:bg-gray-900 px-1 rounded border border-app-border">{item.reference}</span>}
                      {item.status && <span className="text-pesage-blue font-medium">{item.status}</span>}
                    </div>
                  </div>
                  <span className="text-[10px] text-app-text-muted shrink-0">
                    {formatActivityTime(item.created_at)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 3: FUTURE BUSINESS MODULES (Clear Non-Available Indicators)       */}
      {/* ========================================================================= */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center space-x-2">
          <TrendingUp className="w-4 h-4 text-app-text-muted" />
          <h3 className="text-xs font-bold text-app-text-muted uppercase tracking-wider">
            Indicateurs & Modules Futurs (Hors Périmètre Phase Actuelle)
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Card 1: Ventes & Facturation */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-4 opacity-85">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div className="flex items-center space-x-2">
                <ShoppingCart className="w-4 h-4 text-app-text-muted" />
                <h4 className="text-sm font-semibold text-app-text-primary">Ventes & Facturation</h4>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                Phase Ventes
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-app-text-muted">Chiffre d'affaires (HT)</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-app-text-muted">Devis & Commandes clients</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
              <div className="flex items-center justify-between py-1 border-t border-app-border pt-2">
                <span className="text-app-text-muted">Factures clients</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 text-center">
              <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                Non disponible — Disponible après activation du module Ventes
              </p>
            </div>
          </div>

          {/* Card 2: Valorisation & Mouvements de Stock */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-4 opacity-85">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div className="flex items-center space-x-2">
                <Boxes className="w-4 h-4 text-app-text-muted" />
                <h4 className="text-sm font-semibold text-app-text-primary">Dépôts & Stock</h4>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                Phase Stock
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-app-text-muted">Valorisation du stock (HT)</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-app-text-muted">Mouvements d'entrepôt</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
              <div className="flex items-center justify-between py-1 border-t border-app-border pt-2">
                <span className="text-app-text-muted">Seuils d'alerte rupture</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-900 text-center">
              <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">
                Non disponible — Disponible après activation du module Stock
              </p>
            </div>
          </div>

          {/* Card 3: Interventions & SAV */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-4 opacity-85">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div className="flex items-center space-x-2">
                <Wrench className="w-4 h-4 text-app-text-muted" />
                <h4 className="text-sm font-semibold text-app-text-primary">Interventions & SAV</h4>
              </div>
              <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Phase SAV
              </span>
            </div>

            <div className="space-y-2.5 text-xs">
              <div className="flex items-center justify-between py-1">
                <span className="text-app-text-muted">Interventions planifiées</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
              <div className="flex items-center justify-between py-1">
                <span className="text-app-text-muted">Tickets SAV en cours</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
              <div className="flex items-center justify-between py-1 border-t border-app-border pt-2">
                <span className="text-app-text-muted">Rapports d'étalonnage</span>
                <span className="font-medium text-app-text-muted">—</span>
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-900 text-center">
              <p className="text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                Non disponible — Disponible après activation du module SAV
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
