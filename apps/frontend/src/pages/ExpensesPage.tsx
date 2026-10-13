import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { customerService } from '@/services/customerService';
import {
  Expense,
  ExpenseCategory,
  RecurringExpense,
  ExpenseStats,
  ExpenseCreate,
  RecurringExpenseCreate,
  ExpenseFrequency,
  ExpenseStatus,
} from '@/types/expenses';
import { BusinessPartner } from '@/types/partner';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { Button } from '@/components/ui/Button';
import { DatePeriodFilter, DatePeriodValue } from '@/components/ui/DatePeriodFilter';
import { useNotification } from '@/context/NotificationContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  DollarSign,
  Calendar,
  Layers,
  Plus,
  Download,
  Repeat,
  CheckCircle,
  TrendingDown,
  PieChart as PieChartIcon,
  Tag,
  CreditCard,
  Building,
  RotateCcw,
  X,
} from 'lucide-react';

export const ExpensesPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();

  const [activeTab, setActiveTab] = useState<'expenses' | 'recurring' | 'categories'>('expenses');
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [suppliers, setSuppliers] = useState<BusinessPartner[]>([]);
  const [stats, setStats] = useState<ExpenseStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [periodFilter, setPeriodFilter] = useState<DatePeriodValue>({
    preset: 'ALL',
    label: 'Toutes les dates',
  });

  // Modals
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [isRecurringModalOpen, setIsRecurringModalOpen] = useState(false);
  const [isGeneratingRecurring, setIsGeneratingRecurring] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Expense Form State
  const [expenseForm, setExpenseForm] = useState<ExpenseCreate>({
    category_id: 0,
    label: '',
    amount: 0,
    expense_date: new Date().toISOString().split('T')[0],
    payment_method: 'Virement bancaire',
    status: ExpenseStatus.PAID,
    receipt_reference: '',
    notes: '',
  });

  // Recurring Form State
  const [recurringForm, setRecurringForm] = useState<RecurringExpenseCreate>({
    category_id: 0,
    label: '',
    amount: 0,
    frequency: ExpenseFrequency.MONTHLY,
    start_date: new Date().toISOString().split('T')[0],
    day_of_month: 1,
    supplier_id: null,
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (periodFilter.dateFrom) params.append('date_from', periodFilter.dateFrom);
      if (periodFilter.dateTo) params.append('date_to', periodFilter.dateTo);
      if (categoryFilter !== 'ALL') params.append('category_id', categoryFilter);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());

      const expensesUrl = params.toString() ? `/api/v1/expenses?${params.toString()}` : '/api/v1/expenses';

      const [expRes, recRes, catRes, suppList, statsRes] = await Promise.all([
        api.get<Expense[]>(expensesUrl),
        api.get<RecurringExpense[]>('/api/v1/expenses/recurring'),
        api.get<ExpenseCategory[]>('/api/v1/expenses/categories'),
        customerService.getSuppliers({ isActive: true }),
        api.get<ExpenseStats>('/api/v1/expenses/stats'),
      ]);
      setExpenses(expRes.data);
      setRecurringExpenses(recRes.data);
      setCategories(catRes.data);
      setSuppliers(suppList);
      setStats(statsRes.data);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du chargement des dépenses.'));
    } finally {
      setIsLoading(false);
    }
  }, [periodFilter, categoryFilter, searchTerm, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.category_id || expenseForm.amount <= 0 || !expenseForm.label.trim()) {
      showError('Veuillez remplir correctement les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/v1/expenses', expenseForm);
      showSuccess('Dépense enregistrée avec succès.');
      setIsExpenseModalOpen(false);
      setExpenseForm({
        category_id: categories.length > 0 ? categories[0].id : 0,
        label: '',
        amount: 0,
        expense_date: new Date().toISOString().split('T')[0],
        payment_method: 'Virement bancaire',
        status: ExpenseStatus.PAID,
        receipt_reference: '',
        notes: '',
      });
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de l'enregistrement de la dépense."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRecurring = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recurringForm.category_id || recurringForm.amount <= 0 || !recurringForm.label.trim()) {
      showError('Veuillez remplir correctement les champs obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/v1/expenses/recurring', recurringForm);
      showSuccess('Charge récurrente configurée avec succès.');
      setIsRecurringModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de la création de l'abonnement."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateRecurring = async () => {
    setIsGeneratingRecurring(true);
    try {
      const res = await api.post<{
        status: string;
        generated_count: number;
        active_recurring_expenses: number;
      }>('/api/v1/expenses/generate-recurring');
      const count = res.data?.generated_count ?? 0;
      if (count > 0) {
        showSuccess(`${count} dépense${count > 1 ? 's' : ''} récurrente${count > 1 ? 's' : ''} générée${count > 1 ? 's' : ''}.`);
      } else {
        showSuccess('Aucune nouvelle dépense générée : les occurrences sont déjà enregistrées.');
      }
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors de la génération automatique des dépenses.'));
    } finally {
      setIsGeneratingRecurring(false);
    }
  };

  const handleExportExcel = () => {
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/exports/expenses`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'depenses_et_caisse.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        showSuccess('Export Excel des dépenses téléchargé.');
      })
      .catch((e) => showError(getApiErrorMessage(e, "Erreur lors de l'exportation.")));
  };

  // Filtered lists
  const filteredExpenses = useMemo(() => {
    return expenses.filter((exp) => {
      const matchSearch =
        searchTerm.trim() === '' ||
        exp.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        exp.reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (exp.category?.name && exp.category.name.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchCat = categoryFilter === 'ALL' || exp.category_id.toString() === categoryFilter;

      return matchSearch && matchCat;
    });
  }, [expenses, searchTerm, categoryFilter]);

  const expenseColumns: Column<Expense>[] = [
    {
      header: 'Réf & Date',
      accessor: (exp) => (
        <div>
          <span className="font-semibold text-primary-600 font-mono block text-xs">
            {exp.reference}
          </span>
          <span className="text-gray-500 text-xs">{formatDate(exp.expense_date)}</span>
        </div>
      ),
    },
    {
      header: 'Libellé & Catégorie',
      accessor: (exp) => (
        <div>
          <span className="font-medium text-gray-900 dark:text-white block">{exp.label}</span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Tag className="w-3 h-3 text-primary-500" />
            {exp.category?.name || 'Général'}
          </span>
        </div>
      ),
    },
    {
      header: 'Type',
      accessor: (exp) =>
        exp.recurring_expense_id ? (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
            <Repeat className="w-3 h-3" /> Fixe / Récurrent
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
            Variable
          </span>
        ),
    },
    {
      header: 'Montant',
      accessor: (exp) => (
        <span className="font-bold text-gray-900 dark:text-white font-mono">
          {formatCurrency(exp.amount)}
        </span>
      ),
    },
    {
      header: 'Règlement & Pièce',
      accessor: (exp) => (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div>{exp.payment_method || 'Virement'}</div>
          {exp.receipt_reference && (
            <span className="text-gray-400 font-mono">Justif: {exp.receipt_reference}</span>
          )}
        </div>
      ),
    },
    {
      header: 'Statut',
      accessor: (exp) => (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
          <CheckCircle className="w-3 h-3" /> {exp.status}
        </span>
      ),
    },
  ];

  const recurringColumns: Column<RecurringExpense>[] = [
    {
      header: 'Libellé',
      accessor: (rec) => (
        <div>
          <span className="font-medium text-gray-900 dark:text-white block">{rec.label}</span>
          <span className="text-xs text-gray-500">{rec.category?.name}</span>
        </div>
      ),
    },
    {
      header: 'Fournisseur / Tiers',
      accessor: (rec) => (
        <span className="text-xs text-gray-700 dark:text-gray-300">
          {rec.supplier?.legal_name || '—'}
        </span>
      ),
    },
    {
      header: 'Périodicité',
      accessor: (rec) => (
        <span className="text-xs text-gray-600 dark:text-gray-300">
          {rec.frequency === ExpenseFrequency.MONTHLY
            ? `Mensuel (le ${rec.day_of_month})`
            : rec.frequency === ExpenseFrequency.QUARTERLY
            ? 'Trimestriel'
            : 'Annuel'}
        </span>
      ),
    },
    {
      header: 'Montant Périodique',
      accessor: (rec) => (
        <span className="font-bold text-gray-900 dark:text-white font-mono">
          {formatCurrency(rec.amount)}
        </span>
      ),
    },
    {
      header: 'Dernière Génération',
      accessor: (rec) => (
        <span className="text-xs text-gray-500 font-mono">
          {rec.last_generated_period || 'Non généré'}
        </span>
      ),
    },
    {
      header: 'Actif',
      accessor: (rec) =>
        rec.is_active ? (
          <span className="text-xs font-semibold text-emerald-600">Actif</span>
        ) : (
          <span className="text-xs text-gray-400">Désactivé</span>
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dépenses & Caisse"
        description="Suivi des charges d'exploitation, abonnements récurrents et trésorerie."
        actions={
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleExportExcel}
              className="btn-secondary px-3.5 py-2"
            >
              <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>Exporter Excel</span>
            </button>
            <button
              type="button"
              onClick={handleGenerateRecurring}
              disabled={isGeneratingRecurring}
              title="Crée automatiquement les dépenses prévues à partir des charges récurrentes pour la période sélectionnée."
              className="btn-secondary px-3.5 py-2 text-pesage-blue dark:text-blue-400 border-pesage-blue/30 dark:border-blue-500/30 hover:bg-pesage-blue/5 dark:hover:bg-blue-500/10"
            >
              <Repeat className={`w-4 h-4 ${isGeneratingRecurring ? 'animate-spin' : ''}`} />
              <span>{isGeneratingRecurring ? 'Génération en cours...' : 'Générer les dépenses récurrentes'}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                if (categories.length > 0 && expenseForm.category_id === 0) {
                  setExpenseForm((prev) => ({ ...prev, category_id: categories[0].id }));
                }
                setIsExpenseModalOpen(true);
              }}
              className="btn-primary px-4 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouvelle Dépense</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Dépenses du Mois
            </span>
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-900/30 text-rose-600">
              <TrendingDown className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.this_month || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Total charges constatées ce mois-ci</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Charges Fixes / Mois
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
              <Repeat className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.fixed_expenses || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Loyers, télécoms, abonnements</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Charges Variables / Mois
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.variable_expenses || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Carburant, entretien, fournitures</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Cumul Année en Cours
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
              <Calendar className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.this_year || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Total décaissé sur l'exercice</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-app-border">
        <button
          type="button"
          onClick={() => setActiveTab('expenses')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'expenses'
              ? 'border-pesage-blue text-pesage-blue dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Journal des Dépenses ({expenses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('recurring')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'recurring'
              ? 'border-pesage-blue text-pesage-blue dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Charges Récurrentes ({recurringExpenses.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('categories')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'categories'
              ? 'border-pesage-blue text-pesage-blue dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Répartition par Catégorie ({categories.length})
        </button>
      </div>

      {activeTab === 'expenses' && (
        <div className="space-y-4">
          <div className="bg-app-surface p-4 rounded-2xl border border-app-border shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
                <div className="w-64">
                  <SearchBar
                    value={searchTerm}
                    onChange={setSearchTerm}
                    placeholder="Rechercher une dépense, réf..."
                  />
                </div>

                <DatePeriodFilter
                  value={periodFilter}
                  onChange={setPeriodFilter}
                  onReset={() => setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' })}
                />

                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  aria-label="Filtrer par catégorie"
                  className="px-3 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue shadow-xs"
                >
                  <option value="ALL">Toutes les catégories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id.toString()}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              {(searchTerm.trim() !== '' || categoryFilter !== 'ALL' || periodFilter.preset !== 'ALL') && (
                <Button
                  variant="outline"
                  size="sm"
                  icon={RotateCcw}
                  onClick={() => {
                    setSearchTerm('');
                    setCategoryFilter('ALL');
                    setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' });
                  }}
                >
                  Réinitialiser
                </Button>
              )}
            </div>

            {(searchTerm.trim() !== '' || categoryFilter !== 'ALL' || periodFilter.preset !== 'ALL') && (
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-app-border text-xs">
                <span className="text-app-text-muted font-semibold">Filtres actifs :</span>
                {periodFilter.preset !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-pesage-blue-subtle text-pesage-blue border border-pesage-blue/20 font-medium">
                    Période : {periodFilter.label}
                    <button
                      type="button"
                      onClick={() => setPeriodFilter({ preset: 'ALL', label: 'Toutes les dates' })}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {categoryFilter !== 'ALL' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                    Catégorie : {categories.find((c) => c.id.toString() === categoryFilter)?.name || categoryFilter}
                    <button
                      type="button"
                      onClick={() => setCategoryFilter('ALL')}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
                {searchTerm.trim() !== '' && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-app-text border border-app-border font-medium">
                    Recherche : "{searchTerm}"
                    <button
                      type="button"
                      onClick={() => setSearchTerm('')}
                      className="hover:text-red-600"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="bg-app-surface rounded-2xl border border-app-border shadow-xs overflow-hidden">
            <DataTable
              columns={expenseColumns}
              data={filteredExpenses}
              isLoading={isLoading}
              keyExtractor={(exp) => exp.id.toString()}
              emptyTitle="Aucune dépense trouvée."
            />
          </div>
        </div>
      )}

      {activeTab === 'recurring' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700">
            <div>
              <h4 className="font-semibold text-gray-900 dark:text-white text-sm">
                Modèles de Charges Récurrentes Automatiques
              </h4>
              <p className="text-xs text-gray-500">
                Ces abonnements peuvent être générés chaque mois automatiquement en un clic.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (categories.length > 0 && recurringForm.category_id === 0) {
                  setRecurringForm((prev) => ({ ...prev, category_id: categories[0].id }));
                }
                setIsRecurringModalOpen(true);
              }}
              className="btn-primary px-3.5 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Ajouter une Charge Récurrente</span>
            </button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <DataTable
              columns={recurringColumns}
              data={recurringExpenses}
              isLoading={isLoading}
              keyExtractor={(rec) => rec.id.toString()}
              emptyTitle="Aucun abonnement récurrent configuré."
            />
          </div>
        </div>
      )}

      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <PieChartIcon className="w-4 h-4 text-primary-500" />
              Répartition des Dépenses Réelles
            </h4>
            <div className="space-y-3">
              {stats?.by_category && stats.by_category.length > 0 ? (
                stats.by_category.map((cat) => (
                  <div key={cat.category_id} className="flex justify-between items-center text-sm">
                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      {cat.category_name} ({cat.expense_count})
                    </span>
                    <span className="font-bold text-gray-900 dark:text-white font-mono">
                      {formatCurrency(cat.total_amount)}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">Aucune donnée de dépense ce mois-ci.</div>
              )}
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 p-6 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm space-y-4">
            <h4 className="font-semibold text-gray-900 dark:text-white text-sm flex items-center gap-2">
              <Layers className="w-4 h-4 text-purple-500" />
              Catégories Standardisées (16 Postes Comptables)
            </h4>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {categories.map((c) => (
                <div
                  key={c.id}
                  className="p-2 rounded-lg bg-gray-50 dark:bg-gray-900/50 border border-gray-100 dark:border-gray-800"
                >
                  <span className="font-mono text-primary-600 block text-[10px]">{c.code}</span>
                  <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATE EXPENSE MODAL */}
      <Modal
        isOpen={isExpenseModalOpen}
        onClose={() => setIsExpenseModalOpen(false)}
        title="Enregistrer une Dépense"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateExpense} className="space-y-4">
          <FormField label="Catégorie de Dépense" required>
            <select
              value={expenseForm.category_id}
              onChange={(e) =>
                setExpenseForm((prev) => ({ ...prev, category_id: Number(e.target.value) }))
              }
              required
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Libellé / Objet de la Dépense" required>
            <input
              type="text"
              value={expenseForm.label}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Ex: Achat fournitures bureau..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant TTC (DH)" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={expenseForm.amount || ''}
                onChange={(e) =>
                  setExpenseForm((prev) => ({ ...prev, amount: parseFloat(e.target.value) || 0 }))
                }
                required
                placeholder="0.00"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>

            <FormField label="Date de Paiement" required>
              <input
                type="date"
                value={expenseForm.expense_date}
                onChange={(e) =>
                  setExpenseForm((prev) => ({ ...prev, expense_date: e.target.value }))
                }
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Mode de Règlement">
              <select
                value={expenseForm.payment_method || 'Virement bancaire'}
                onChange={(e) =>
                  setExpenseForm((prev) => ({ ...prev, payment_method: e.target.value }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              >
                <option value="Virement bancaire">Virement bancaire</option>
                <option value="Espèces / Caisse">Espèces / Caisse</option>
                <option value="Chèque">Chèque</option>
                <option value="Carte bancaire">Carte bancaire</option>
                <option value="Prélèvement">Prélèvement</option>
              </select>
            </FormField>

            <FormField label="N° Pièce / Reçu">
              <input
                type="text"
                value={expenseForm.receipt_reference || ''}
                onChange={(e) =>
                  setExpenseForm((prev) => ({ ...prev, receipt_reference: e.target.value }))
                }
                placeholder="Facture N°..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <FormField label="Notes">
            <input
              type="text"
              value={expenseForm.notes || ''}
              onChange={(e) => setExpenseForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Remarques..."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsExpenseModalOpen(false)}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CREATE RECURRING EXPENSE MODAL */}
      <Modal
        isOpen={isRecurringModalOpen}
        onClose={() => setIsRecurringModalOpen(false)}
        title="Ajouter une Charge Récurrente"
        maxWidth="lg"
      >
        <form onSubmit={handleCreateRecurring} className="space-y-4">
          <FormField label="Catégorie" required>
            <select
              value={recurringForm.category_id}
              onChange={(e) =>
                setRecurringForm((prev) => ({ ...prev, category_id: Number(e.target.value) }))
              }
              required
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.code})
                </option>
              ))}
            </select>
          </FormField>

          <FormField label="Libellé de l'Abonnement" required>
            <input
              type="text"
              value={recurringForm.label}
              onChange={(e) => setRecurringForm((prev) => ({ ...prev, label: e.target.value }))}
              placeholder="Ex: Abonnement Connexion Fibre Maroc Telecom..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Montant Périodique (DH)" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={recurringForm.amount || ''}
                onChange={(e) =>
                  setRecurringForm((prev) => ({
                    ...prev,
                    amount: parseFloat(e.target.value) || 0,
                  }))
                }
                required
                placeholder="0.00"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>

            <FormField label="Jour d'Échéance du Mois" required>
              <input
                type="number"
                min="1"
                max="31"
                value={recurringForm.day_of_month}
                onChange={(e) =>
                  setRecurringForm((prev) => ({
                    ...prev,
                    day_of_month: parseInt(e.target.value) || 1,
                  }))
                }
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-center"
              />
            </FormField>
          </div>

          <FormField label="Fournisseur Lié">
            <select
              value={recurringForm.supplier_id || ''}
              onChange={(e) =>
                setRecurringForm((prev) => ({
                  ...prev,
                  supplier_id: Number(e.target.value) || null,
                }))
              }
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            >
              <option value="">Aucun fournisseur associé</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.legal_name} ({s.code})
                </option>
              ))}
            </select>
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsRecurringModalOpen(false)}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2"
            >
              {isSubmitting ? 'Création...' : 'Créer l’Abonnement'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
