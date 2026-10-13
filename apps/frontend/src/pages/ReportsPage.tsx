import React, { useState, useEffect, useCallback } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { CommercialReportResponse } from '@/types/reports';
import { PageHeader } from '@/components/ui/PageHeader';
import { DatePeriodFilter, DatePeriodValue } from '@/components/ui/DatePeriodFilter';
import { useNotification } from '@/context/NotificationContext';
import { formatCurrency } from '@/lib/formatters';
import {
  BarChart3,
  TrendingUp,
  Download,
  Calendar,
  Users,
  Package,
  DollarSign,
  ArrowUpRight,
  ShieldAlert,
  Percent,
  Layers,
} from 'lucide-react';

export const ReportsPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();

  const [report, setReport] = useState<CommercialReportResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Date period filter
  const [periodFilter, setPeriodFilter] = useState<DatePeriodValue>(() => {
    const currentYear = new Date().getFullYear();
    return {
      preset: 'THIS_YEAR',
      year: currentYear,
      label: `Année ${currentYear}`,
      dateFrom: `${currentYear}-01-01T00:00:00`,
      dateTo: `${currentYear + 1}-01-01T00:00:00`,
    };
  });

  const fetchReport = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodFilter.dateFrom) params.append('period_start', periodFilter.dateFrom.split('T')[0]);
      if (periodFilter.dateTo) params.append('period_end', periodFilter.dateTo.split('T')[0]);

      const res = await api.get<CommercialReportResponse>(`/api/v1/reports/commercial?${params.toString()}`);
      setReport(res.data);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du calcul des rapports commerciaux.'));
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter, showError]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  const handleExportExcel = () => {
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/exports/invoices`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', `rapport_commercial_${periodFilter.label.replace(/\s+/g, '_')}.xlsx`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        showSuccess('Rapport comptable et commercial téléchargé.');
      })
      .catch((e) => showError(getApiErrorMessage(e, "Erreur lors de l'exportation Excel.")));
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Rapports & Statistiques"
        description="Analyses décisionnelles en temps réel, rentabilité, top ventes et situation financière."
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-secondary px-3.5 py-2"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Exporter Synthèse Excel</span>
            </button>
          </div>
        }
      />

      {/* Date Period Filter Bar */}
      <DatePeriodFilter
        value={periodFilter}
        onChange={setPeriodFilter}
        onReset={() => {
          const currentYear = new Date().getFullYear();
          setPeriodFilter({
            preset: 'THIS_YEAR',
            year: currentYear,
            label: `Année ${currentYear}`,
            dateFrom: `${currentYear}-01-01T00:00:00`,
            dateTo: `${currentYear + 1}-01-01T00:00:00`,
          });
        }}
      />

      {/* Executive Financial Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Chiffre d'Affaires HT
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(report?.total_turnover_ht || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500 font-mono">
            TTC: {formatCurrency(report?.total_turnover_ttc || 0)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Règlements Encaissés
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(report?.total_collected_ttc || 0)}
          </div>
          <p className="mt-1 text-xs text-emerald-600 font-medium">
            Trésorerie effectivement perçue
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Créances Clients (Reste Dû)
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(report?.total_outstanding_due || 0)}
          </div>
          <p className="mt-1 text-xs text-amber-600">Solde factures non soldées</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Avoirs Émis
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
              <Percent className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(report?.total_credit_notes_amount_ttc || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Retours et remises accordées</p>
        </div>
      </div>

      {/* Top Customers & Top Products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Customers */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <Users className="w-5 h-5 text-pesage-blue dark:text-blue-400" />
              Top 10 Clients (Chiffre d'Affaires)
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase">
                <tr>
                  <th className="p-3.5">Client</th>
                  <th className="p-3.5 text-center">Commandes</th>
                  <th className="p-3.5 text-right">Total HT</th>
                  <th className="p-3.5 text-right">Total TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {report?.top_customers && report.top_customers.length > 0 ? (
                  report.top_customers.map((c, i) => (
                    <tr key={c.customer_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-pesage-blue/10 text-pesage-blue dark:bg-pesage-blue/20 dark:text-blue-300 flex items-center justify-center font-bold text-[10px]">
                            {i + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-white block">
                              {c.name}
                            </span>
                            <span className="font-mono text-gray-400 text-[10px]">{c.code}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-gray-700 dark:text-gray-300">
                        {c.orders_count}
                      </td>
                      <td className="p-3.5 text-right font-mono font-medium text-gray-900 dark:text-white">
                        {formatCurrency(c.total_ht)}
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-pesage-blue dark:text-blue-400">
                        {formatCurrency(c.total_ttc)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-gray-500">
                      Aucune vente enregistrée sur cette période.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <Package className="w-5 h-5 text-emerald-500" />
              Top 10 Produits les Plus Vendus
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase">
                <tr>
                  <th className="p-3.5">Produit / Matériel</th>
                  <th className="p-3.5 text-center">Quantité</th>
                  <th className="p-3.5 text-right">Total HT Généré</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {report?.top_products && report.top_products.length > 0 ? (
                  report.top_products.map((p, i) => (
                    <tr key={p.product_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                      <td className="p-3.5">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300 flex items-center justify-center font-bold text-[10px]">
                            {i + 1}
                          </span>
                          <div>
                            <span className="font-semibold text-gray-900 dark:text-white block">
                              {p.designation}
                            </span>
                            <span className="font-mono text-gray-400 text-[10px]">
                              {p.sku} {p.category_name ? `• ${p.category_name}` : ''}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3.5 text-center font-bold text-gray-900 dark:text-white">
                        {p.total_quantity} unités
                      </td>
                      <td className="p-3.5 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(p.total_ht)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-gray-500">
                      Aucune ligne de vente trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Monthly Trend Table */}
      {report?.monthly_trend && report.monthly_trend.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-gray-100 dark:border-gray-700">
            <h3 className="font-bold text-gray-900 dark:text-white text-base flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-500" />
              Évolution Mensuelle du Compte de Résultat d'Exploitation
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase">
                <tr>
                  <th className="p-3.5">Mois</th>
                  <th className="p-3.5 text-right">Ventes HT (DH)</th>
                  <th className="p-3.5 text-right">Achats HT (DH)</th>
                  <th className="p-3.5 text-right">Charges Fixes & Var. (DH)</th>
                  <th className="p-3.5 text-right">Marge Brute Estimée (DH)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {report.monthly_trend.map((m) => (
                  <tr key={m.period} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50 font-mono">
                    <td className="p-3.5 font-sans font-semibold text-gray-900 dark:text-white">
                      {m.period}
                    </td>
                    <td className="p-3.5 text-right text-emerald-600 font-bold">
                      {formatCurrency(m.sales_ht)}
                    </td>
                    <td className="p-3.5 text-right text-rose-600 font-medium">
                      {formatCurrency(m.purchases_ht)}
                    </td>
                    <td className="p-3.5 text-right text-amber-600 font-medium">
                      {formatCurrency(m.expenses_ht)}
                    </td>
                    <td
                      className={`p-3.5 text-right font-bold ${
                        m.margin_ht >= 0 ? 'text-pesage-blue dark:text-blue-400' : 'text-rose-600'
                      }`}
                    >
                      {formatCurrency(m.margin_ht)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
