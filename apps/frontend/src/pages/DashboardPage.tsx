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
  PackageCheck,
  PackageX,
  AlertTriangle,
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
        description="Vue opérationnelle en direct des modules Ventes, Achats, Catalogue et Stocks Pesage 2000."
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
      {/* SECTION 1: FACTURATION & RÈGLEMENTS (DONNÉES RÉELLES POSTGRESQL)            */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-600" />
            Facturation & Règlements (Données Réelles)
          </h3>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/factures-vente')}
              className="text-xs text-pesage-blue hover:underline flex items-center gap-1 font-semibold"
            >
              Factures Vente <ArrowUpRight className="w-3 h-3" />
            </button>
            <span className="text-app-text-muted">•</span>
            <button
              onClick={() => navigate('/factures-achat')}
              className="text-xs text-pesage-orange hover:underline flex items-center gap-1 font-semibold"
            >
              Factures Achat <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
          {/* Card 1: Factures clients émises */}
          <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1.5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-app-text-muted">Factures clients émises</span>
              <div className="p-1.5 rounded-lg bg-pesage-blue/10 text-pesage-blue">
                <Receipt className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-app-text-primary tracking-tight">
                {isLoading ? '...' : stats?.invoices?.issued_invoices ?? stats?.invoices?.total_invoices ?? 0}
              </p>
              <p className="text-[10px] text-pesage-blue font-semibold truncate mt-0.5">
                {isLoading ? '...' : formatCurrency(stats?.invoices?.total_invoiced_ttc ?? 0)} TTC
              </p>
            </div>
          </div>

          {/* Card 2: Factures clients impayées */}
          <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1.5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-app-text-muted">Factures impayées</span>
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <Clock className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-amber-600 tracking-tight">
                {isLoading ? '...' : Math.max(0, (stats?.invoices?.issued_invoices ?? 0) - (stats?.invoices?.paid_invoices ?? 0))}
              </p>
              <p className="text-[10px] text-app-text-muted font-medium truncate mt-0.5">
                Dû : {isLoading ? '...' : formatCurrency(stats?.invoices?.total_amount_due ?? 0)}
              </p>
            </div>
          </div>

          {/* Card 3: Factures en retard */}
          <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1.5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-app-text-muted">Factures en retard</span>
              <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
                <AlertTriangle className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-rose-600 tracking-tight">
                {isLoading ? '...' : stats?.invoices?.overdue_invoices ?? 0}
              </p>
              <p className="text-[10px] text-rose-600 font-medium truncate mt-0.5">
                Échéance dépassée
              </p>
            </div>
          </div>

          {/* Card 4: Encaissements du mois */}
          <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1.5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-app-text-muted">Encaissements mois</span>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
                <DollarSign className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '...' : formatCurrency(stats?.invoices?.month_collected_amount ?? stats?.payments?.total_collected_amount ?? 0)}
              </p>
              <p className="text-[10px] text-emerald-600 font-medium truncate mt-0.5">
                Trésorerie encaissée
              </p>
            </div>
          </div>

          {/* Card 5: Factures fournisseurs */}
          <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1.5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-app-text-muted">Factures fournisseurs</span>
              <div className="p-1.5 rounded-lg bg-pesage-orange/10 text-pesage-orange">
                <ShoppingBag className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-pesage-orange tracking-tight">
                {isLoading ? '...' : stats?.invoices?.supplier_invoices_total ?? 0}
              </p>
              <p className="text-[10px] text-app-text-muted font-medium truncate mt-0.5">
                {isLoading ? '...' : formatCurrency(stats?.invoices?.supplier_invoiced_ttc ?? 0)} TTC
              </p>
            </div>
          </div>

          {/* Card 6: Règlements fournisseurs */}
          <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1.5 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-medium text-app-text-muted">Règlements fourn.</span>
              <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
            </div>
            <div>
              <p className="text-xl font-bold text-indigo-600 tracking-tight">
                {isLoading ? '...' : formatCurrency(stats?.invoices?.supplier_payments_amount ?? 0)}
              </p>
              <p className="text-[10px] text-app-text-muted font-medium truncate mt-0.5">
                {stats?.invoices?.supplier_payments_count ?? 0} règlement(s) enregistré(s)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 1B: INTERVENTIONS & MAINTENANCE (DONNÉES RÉELLES POSTGRESQL)       */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
            <Wrench className="w-4 h-4 text-pesage-blue" />
            Interventions & Maintenance Pesage 2000 (Données Réelles)
          </h3>
          <button
            onClick={() => navigate('/maintenance')}
            className="text-xs text-pesage-blue hover:underline flex items-center gap-1 font-semibold"
          >
            Module Maintenance <ArrowUpRight className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
          {/* Card 1: Interventions du mois */}
          <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1 hover:shadow-md transition">
            <span className="text-[11px] font-medium text-app-text-muted block">Interventions mois</span>
            <p className="text-lg font-bold text-app-text-primary">
              {isLoading ? '...' : stats?.maintenance?.month_interventions ?? 0}
            </p>
            <span className="text-[10px] text-app-text-muted block">Planifiées / Réalisées</span>
          </div>

          {/* Card 2: En cours */}
          <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1 hover:shadow-md transition">
            <span className="text-[11px] font-medium text-app-text-muted block">En cours</span>
            <p className="text-lg font-bold text-blue-600">
              {isLoading ? '...' : stats?.maintenance?.in_progress_interventions ?? 0}
            </p>
            <span className="text-[10px] text-blue-600 font-medium block">Techniciens sur site</span>
          </div>

          {/* Card 3: Terminées */}
          <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1 hover:shadow-md transition">
            <span className="text-[11px] font-medium text-app-text-muted block">Terminées</span>
            <p className="text-lg font-bold text-emerald-600">
              {isLoading ? '...' : stats?.maintenance?.completed_interventions ?? 0}
            </p>
            <span className="text-[10px] text-emerald-600 font-medium block">Clôturées avec succès</span>
          </div>

          {/* Card 4: Urgentes */}
          <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1 hover:shadow-md transition">
            <span className="text-[11px] font-medium text-app-text-muted block">Urgentes / Critiques</span>
            <p className="text-lg font-bold text-rose-600">
              {isLoading ? '...' : stats?.maintenance?.urgent_interventions ?? 0}
            </p>
            <span className="text-[10px] text-rose-600 font-medium block">Priorité haute</span>
          </div>

          {/* Card 5: Équipements suivis */}
          <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1 hover:shadow-md transition">
            <span className="text-[11px] font-medium text-app-text-muted block">Équipements suivis</span>
            <p className="text-lg font-bold text-app-text-primary">
              {isLoading ? '...' : stats?.maintenance?.total_equipments ?? 0}
            </p>
            <span className="text-[10px] text-app-text-muted block">Balances & ponts</span>
          </div>

          {/* Card 6: Prochaines maintenances */}
          <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1 hover:shadow-md transition">
            <span className="text-[11px] font-medium text-app-text-muted block">À venir (30j)</span>
            <p className="text-lg font-bold text-pesage-orange">
              {isLoading ? '...' : stats?.maintenance?.upcoming_maintenances ?? 0}
            </p>
            <span className="text-[10px] text-pesage-orange font-medium block">Étalonnages prévus</span>
          </div>

          {/* Card 7: Coût maintenance */}
          <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-1 hover:shadow-md transition">
            <span className="text-[11px] font-medium text-app-text-muted block">Coût maintenance (an)</span>
            <p className="text-base font-bold text-pesage-blue truncate">
              {isLoading ? '...' : formatCurrency(stats?.maintenance?.maintenance_cost_year ?? 0)}
            </p>
            <span className="text-[10px] text-app-text-muted block">Pièces & main-d'œuvre</span>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: SALES & COMMERCIAL OVERVIEW (REAL DATA)                        */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
            <ShoppingCart className="w-4 h-4 text-pesage-blue" />
            Ventes & Commandes Clients (Données Réelles)
          </h3>
          <button
            onClick={() => navigate('/ventes')}
            className="text-xs text-pesage-blue hover:underline flex items-center gap-1 font-semibold"
          >
            Gérer les ventes <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Ventes */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Nombre de ventes</span>
              <div className="p-2 rounded-xl bg-pesage-blue/10 text-pesage-blue">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-app-text-primary tracking-tight">
                {isLoading ? '...' : stats?.sales?.total_orders ?? 0}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-app-text-muted">
                <span className="text-amber-600 font-semibold">{stats?.sales?.draft_orders ?? 0} brouillons</span>
                <span>•</span>
                <span className="text-emerald-600 font-semibold">{stats?.sales?.confirmed_orders ?? 0} confirmées</span>
              </div>
            </div>
          </div>

          {/* Card 2: Chiffre d'Affaires HT */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Chiffre d'affaires (HT)</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '...' : formatCurrency(stats?.sales?.total_subtotal_ht ?? 0)}
              </p>
              <p className="text-[11px] text-app-text-muted mt-1.5">
                Sur les ventes actives validées
              </p>
            </div>
          </div>

          {/* Card 3: Total TTC Ventes */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Chiffre d'affaires (TTC)</span>
              <div className="p-2 rounded-xl bg-pesage-orange/10 text-pesage-orange">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-pesage-blue tracking-tight">
                {isLoading ? '...' : formatCurrency(stats?.sales?.total_ttc ?? 0)}
              </p>
              <p className="text-[11px] text-app-text-muted mt-1.5">
                TVA collectée : {isLoading ? '...' : formatCurrency(stats?.sales?.total_tax_amount ?? 0)}
              </p>
            </div>
          </div>

          {/* Card 4: Clients Référencés */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Clients Actifs</span>
              <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-600">
                <Building2 className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-app-text-primary tracking-tight">
                {isLoading ? '...' : stats?.partners.active_customers ?? 0}
              </p>
              <p className="text-[11px] text-app-text-muted mt-1.5">
                Sur {stats?.partners.total_customers ?? 0} clients référencés
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 2: PURCHASES & APPROVISIONNEMENTS (REAL DATA)                     */}
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
                <span className="text-amber-600 font-semibold">{stats?.purchases.draft_orders ?? 0} brouillons</span>
                <span>•</span>
                <span className="text-pesage-blue font-semibold">{stats?.purchases.approved_orders ?? 0} approuvées</span>
              </div>
            </div>
          </div>

          {/* Card 2: Montant Total Engagé TTC */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Montant Engagé (TTC)</span>
              <div className="p-2 rounded-xl bg-pesage-orange/10 text-pesage-orange">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-pesage-orange tracking-tight">
                {isLoading ? '...' : formatCurrency(stats?.purchases.total_ttc ?? 0)}
              </p>
              <p className="text-[11px] text-app-text-muted mt-1.5">
                Dont HT : {isLoading ? '...' : formatCurrency(stats?.purchases.total_subtotal_ht ?? 0)}
              </p>
            </div>
          </div>

          {/* Card 3: Réceptions Fournisseurs */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Réceptions Effectuées</span>
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
      {/* SECTION 3: STOCKS & DISPONIBILITÉS (DONNÉES RÉELLES)                      */}
      {/* ========================================================================= */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-app-text-primary uppercase tracking-wider flex items-center gap-2">
            <Boxes className="w-4 h-4 text-pesage-blue" />
            Gestion des Stocks & Disponibilités (Données Réelles)
          </h3>
          <button
            onClick={() => navigate('/stock')}
            className="text-xs text-pesage-blue hover:underline flex items-center gap-1 font-semibold"
          >
            Gérer les stocks <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Articles Gérés en Stock */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Articles Gérés en Stock</span>
              <div className="p-2 rounded-xl bg-pesage-blue/10 text-pesage-blue">
                <PackageCheck className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-app-text-primary tracking-tight">
                {isLoading ? '...' : stats?.stock?.managed_products ?? 0}
              </p>
              <div className="flex items-center gap-2 mt-1.5 text-[11px] text-app-text-muted">
                <span>{stats?.stock?.active_warehouses ?? 0} dépôts actifs</span>
                <span>•</span>
                <span>{stats?.stock?.movement_count ?? 0} mouvements</span>
              </div>
            </div>
          </div>

          {/* Card 2: Valeur Totale Stock HT */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Valeur Totale Stock (HT)</span>
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-emerald-600 tracking-tight">
                {isLoading ? '...' : formatCurrency(stats?.stock?.total_value_ht ?? 0)}
              </p>
              <p className="text-[11px] text-app-text-muted mt-1.5">
                Quantité totale : {isLoading ? '...' : stats?.stock?.total_quantity ?? 0}
              </p>
            </div>
          </div>

          {/* Card 3: Alertes Stock Faible */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Alertes Stock Faible</span>
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600 tracking-tight">
                {isLoading ? '...' : stats?.stock?.low_stock ?? 0}
              </p>
              <p className="text-[11px] text-app-text-muted mt-1.5">
                Quantité ≤ seuil minimum
              </p>
            </div>
          </div>

          {/* Card 4: Ruptures Immédiates */}
          <div className="p-5 rounded-2xl bg-app-surface border border-app-border shadow-sm space-y-2 hover:shadow-md transition">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-app-text-muted">Ruptures Immédiates</span>
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                <PackageX className="w-4 h-4" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-bold text-rose-600 tracking-tight">
                {isLoading ? '...' : stats?.stock?.out_of_stock ?? 0}
              </p>
              <p className="text-[11px] text-rose-600 font-medium mt-1.5">
                Disponibilité = 0
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SECTION 4: CATALOG & REAL ACTIVITY LOG                                    */}
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
              onClick={() => navigate('/clients')}
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
      {/* SECTION 5: FACTURATION EXTENDED + DÉPENSES + FLOTTE                       */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Card: Facturation Détail */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-app-border">
            <div className="flex items-center gap-2">
              <Receipt className="w-4 h-4 text-pesage-blue" />
              <h4 className="text-sm font-bold text-app-text-primary">Facturation Détail</h4>
            </div>
            <button
              onClick={() => navigate('/factures')}
              className="text-[11px] text-pesage-blue hover:underline font-semibold flex items-center gap-1"
            >
              Voir <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Factures émises</span>
              <span className="font-bold text-app-text-primary">{isLoading ? '...' : stats?.invoices?.issued_invoices ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Partiellement réglées</span>
              <span className="font-semibold text-amber-600">{isLoading ? '...' : stats?.invoices?.partially_paid_invoices ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Entièrement payées</span>
              <span className="font-semibold text-emerald-600">{isLoading ? '...' : stats?.invoices?.paid_invoices ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">En retard (overdue)</span>
              <span className="font-bold text-rose-600">{isLoading ? '...' : stats?.invoices?.overdue_invoices ?? 0}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-app-border">
              <span className="text-app-text-muted">Avoirs émis</span>
              <span className="font-semibold text-purple-600">
                {isLoading ? '...' : stats?.invoices?.credit_notes_total ?? 0} ({isLoading ? '...' : formatCurrency(stats?.invoices?.credit_notes_amount ?? 0)})
              </span>
            </div>
          </div>
        </div>

        {/* Card: Dépenses du mois */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-app-border">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pesage-orange" />
              <h4 className="text-sm font-bold text-app-text-primary">Dépenses Opérationnelles</h4>
            </div>
            <button
              onClick={() => navigate('/depenses')}
              className="text-[11px] text-pesage-blue hover:underline font-semibold flex items-center gap-1"
            >
              Voir <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Ce mois-ci</span>
              <span className="font-bold text-pesage-orange">{isLoading ? '...' : formatCurrency(stats?.expenses?.this_month ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Cette année</span>
              <span className="font-semibold text-app-text-primary">{isLoading ? '...' : formatCurrency(stats?.expenses?.this_year ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Charges fixes / mois</span>
              <span className="font-semibold text-indigo-600">{isLoading ? '...' : formatCurrency(stats?.expenses?.fixed_expenses ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Charges variables / mois</span>
              <span className="font-semibold text-amber-600">{isLoading ? '...' : formatCurrency(stats?.expenses?.variable_expenses ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-app-border">
              <span className="text-app-text-muted font-semibold">Total cumulé</span>
              <span className="font-bold text-app-text-primary">{isLoading ? '...' : formatCurrency(stats?.expenses?.total_expenses ?? 0)}</span>
            </div>
          </div>
        </div>

        {/* Card: Flotte & Maintenance */}
        <div className="bg-app-surface border border-app-border rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-app-border">
            <div className="flex items-center gap-2">
              <Wrench className="w-4 h-4 text-emerald-600" />
              <h4 className="text-sm font-bold text-app-text-primary">Flotte & Maintenance</h4>
            </div>
            <button
              onClick={() => navigate('/vehicules')}
              className="text-[11px] text-pesage-blue hover:underline font-semibold flex items-center gap-1"
            >
              Voir <ArrowUpRight className="w-3 h-3" />
            </button>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Véhicules enregistrés</span>
              <span className="font-bold text-app-text-primary">{isLoading ? '...' : stats?.vehicles?.total_vehicles ?? 0}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Coût carburant (mois)</span>
              <span className="font-semibold text-amber-600">{isLoading ? '...' : formatCurrency(stats?.vehicles?.fuel_cost_month ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-app-text-muted">Entretien / mois</span>
              <span className="font-semibold text-rose-600">{isLoading ? '...' : formatCurrency(stats?.vehicles?.maintenance_cost_month ?? 0)}</span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-app-border">
              <span className="text-app-text-muted font-semibold">Total flotte / mois</span>
              <span className="font-bold text-app-text-primary">{isLoading ? '...' : formatCurrency(stats?.vehicles?.total_expenses_month ?? 0)}</span>
            </div>
          </div>
          <div className="pt-1">
            <button
              onClick={() => navigate('/maintenance')}
              className="w-full text-xs text-center py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-700 font-semibold border border-emerald-200 hover:bg-emerald-100 transition"
            >
              Module Maintenance & Interventions →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
