import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { Employee, EmployeeCreate } from '@/types/employees';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { useNotification } from '@/context/NotificationContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Users,
  UserPlus,
  Download,
  Briefcase,
  DollarSign,
  Building,
  CheckCircle,
  Phone,
  Mail,
  Edit2,
  Trash2,
} from 'lucide-react';

export const PersonnelPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('ALL');

  // Modals
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form
  const [formData, setFormData] = useState<EmployeeCreate>({
    first_name: '',
    last_name: '',
    cin: '',
    cnss_number: '',
    email: '',
    phone: '',
    job_title: '',
    department: 'Technique / SAV',
    hire_date: new Date().toISOString().split('T')[0],
    salary: 0,
    contract_type: 'CDI',
    notes: '',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await api.get<Employee[]>('/api/v1/employees');
      setEmployees(res.data);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du chargement du personnel.'));
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreate = () => {
    setEditingEmployee(null);
    setFormData({
      first_name: '',
      last_name: '',
      cin: '',
      cnss_number: '',
      email: '',
      phone: '',
      job_title: '',
      department: 'Technique / SAV',
      hire_date: new Date().toISOString().split('T')[0],
      salary: 0,
      contract_type: 'CDI',
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setFormData({
      first_name: emp.first_name,
      last_name: emp.last_name,
      cin: emp.cin || '',
      cnss_number: emp.cnss_number || '',
      email: emp.email || '',
      phone: emp.phone || '',
      job_title: emp.job_title || '',
      department: emp.department || 'Technique / SAV',
      hire_date: emp.hire_date ? emp.hire_date.split('T')[0] : '',
      salary: emp.salary || 0,
      contract_type: emp.contract_type || 'CDI',
      notes: emp.notes || '',
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.first_name.trim() || !formData.last_name.trim()) {
      showError('Le nom et prénom sont obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingEmployee) {
        await api.put(`/api/v1/employees/${editingEmployee.id}`, formData);
        showSuccess('Fiche collaborateur mise à jour.');
      } else {
        await api.post('/api/v1/employees', formData);
        showSuccess('Collaborateur enregistré avec succès.');
      }
      setIsModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de l'enregistrement du collaborateur."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      await api.put(`/api/v1/employees/${emp.id}`, { is_active: !emp.is_active });
      showSuccess(`Statut de ${emp.first_name} ${emp.last_name} actualisé.`);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du changement de statut.'));
    }
  };

  const handleExportExcel = () => {
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/exports/employees`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'personnel_et_salaries.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        showSuccess('Export Excel du personnel téléchargé.');
      })
      .catch((e) => showError(getApiErrorMessage(e, "Erreur lors de l'exportation.")));
  };

  // KPIs
  const kpis = useMemo(() => {
    const total = employees.length;
    const active = employees.filter((e) => e.is_active).length;
    const payroll = employees
      .filter((e) => e.is_active)
      .reduce((sum, e) => sum + (Number(e.salary) || 0), 0);
    const depts = new Set(employees.map((e) => e.department).filter(Boolean)).size;
    return { total, active, payroll, depts };
  }, [employees]);

  // Filters
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const matchSearch =
        searchTerm.trim() === '' ||
        emp.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        emp.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (emp.cin && emp.cin.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (emp.job_title && emp.job_title.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchDept = departmentFilter === 'ALL' || emp.department === departmentFilter;

      return matchSearch && matchDept;
    });
  }, [employees, searchTerm, departmentFilter]);

  const columns: Column<Employee>[] = [
    {
      header: 'Collaborateur',
      accessor: (emp) => (
        <div>
          <span className="font-semibold text-gray-900 dark:text-white block">
            {emp.first_name} {emp.last_name}
          </span>
          <span className="font-mono text-xs text-pesage-blue dark:text-blue-400">
            {emp.code}
          </span>
        </div>
      ),
    },
    {
      header: 'CIN & CNSS',
      accessor: (emp) => (
        <div className="text-xs text-gray-600 dark:text-gray-300 font-mono">
          <div>CIN: {emp.cin || '—'}</div>
          <div className="text-gray-400">CNSS: {emp.cnss_number || '—'}</div>
        </div>
      ),
    },
    {
      header: 'Poste & Département',
      accessor: (emp) => (
        <div>
          <span className="font-medium text-gray-900 dark:text-white block text-sm">
            {emp.job_title || 'Non renseigné'}
          </span>
          <span className="inline-flex items-center gap-1 text-xs text-gray-500">
            <Building className="w-3 h-3 text-gray-400" />
            {emp.department || 'Général'}
          </span>
        </div>
      ),
    },
    {
      header: 'Contrat & Embauche',
      accessor: (emp) => (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <span className="px-2 py-0.5 rounded bg-gray-100 dark:bg-gray-800 font-semibold text-gray-700 dark:text-gray-300">
            {emp.contract_type || 'CDI'}
          </span>
          {emp.hire_date && <div className="mt-1">Depuis {formatDate(emp.hire_date)}</div>}
        </div>
      ),
    },
    {
      header: 'Salaire Mensuel',
      accessor: (emp) => (
        <span className="font-bold text-gray-900 dark:text-white font-mono">
          {emp.salary ? formatCurrency(emp.salary) : '—'}
        </span>
      ),
    },
    {
      header: 'Contact',
      accessor: (emp) => (
        <div className="text-xs text-gray-600 dark:text-gray-400 space-y-0.5">
          {emp.phone && (
            <div className="flex items-center gap-1">
              <Phone className="w-3 h-3 text-gray-400" /> {emp.phone}
            </div>
          )}
          {emp.email && (
            <div className="flex items-center gap-1">
              <Mail className="w-3 h-3 text-gray-400" /> {emp.email}
            </div>
          )}
        </div>
      ),
    },
    {
      header: 'Statut',
      accessor: (emp) =>
        emp.is_active ? (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
            <CheckCircle className="w-3 h-3" /> Actif
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
            Inactif
          </span>
        ),
    },
    {
      header: 'Actions',
      accessor: (emp) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(emp)}
            className="p-1.5 text-gray-500 hover:text-pesage-blue dark:hover:text-blue-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            title="Modifier la fiche"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => handleToggleActive(emp)}
            className={`p-1.5 rounded-lg transition-colors text-xs font-semibold ${
              emp.is_active
                ? 'text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20'
                : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20'
            }`}
            title={emp.is_active ? 'Désactiver' : 'Activer'}
          >
            {emp.is_active ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Gestion du Personnel"
        description="Répertoire des collaborateurs, effectifs et masse salariale."
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
              onClick={handleOpenCreate}
              className="btn-primary px-4 py-2"
            >
              <UserPlus className="w-4 h-4" />
              <span>Nouveau Collaborateur</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Effectif Total
            </span>
            <div className="p-2 rounded-xl bg-pesage-blue/10 text-pesage-blue dark:text-blue-400">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{kpis.total}</div>
          <p className="mt-1 text-xs text-gray-500">Collaborateurs enregistrés</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Effectif Actif
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600">
              <CheckCircle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{kpis.active}</div>
          <p className="mt-1 text-xs text-gray-500">En poste actuellement</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Masse Salariale / Mois
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(kpis.payroll)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Total salaires nets mensuels</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Départements
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">{kpis.depts}</div>
          <p className="mt-1 text-xs text-gray-500">Pôles d'activité représentés</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
        <div className="w-full md:w-96">
          <SearchBar
            value={searchTerm}
            onChange={setSearchTerm}
            placeholder="Rechercher par nom, CIN, code, poste..."
          />
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
            aria-label="Filtrer par département"
            className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
          >
            <option value="ALL">Tous les départements</option>
            <option value="Technique / SAV">Technique / SAV</option>
            <option value="Commercial">Commercial</option>
            <option value="Logistique">Logistique & Dépôt</option>
            <option value="Comptabilité / RH">Comptabilité / RH</option>
            <option value="Direction">Direction</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        <DataTable
          columns={columns}
          data={filteredEmployees}
          isLoading={isLoading}
          keyExtractor={(emp) => emp.id.toString()}
          emptyTitle="Aucun collaborateur trouvé."
        />
      </div>

      {/* CREATE / EDIT MODAL */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingEmployee ? 'Modifier la Fiche Collaborateur' : 'Nouveau Collaborateur'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Prénom" required>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Nom" required>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="N° CIN">
              <input
                type="text"
                value={formData.cin || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, cin: e.target.value }))}
                placeholder="Ex: AB123456"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Immatriculation CNSS">
              <input
                type="text"
                value={formData.cnss_number || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, cnss_number: e.target.value }))}
                placeholder="Ex: 123456789"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Poste / Fonction">
              <input
                type="text"
                value={formData.job_title || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, job_title: e.target.value }))}
                placeholder="Ex: Technicien de pesage / SAV"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Département">
              <select
                value={formData.department || 'Technique / SAV'}
                onChange={(e) => setFormData((prev) => ({ ...prev, department: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              >
                <option value="Technique / SAV">Technique / SAV</option>
                <option value="Commercial">Commercial</option>
                <option value="Logistique">Logistique & Dépôt</option>
                <option value="Comptabilité / RH">Comptabilité / RH</option>
                <option value="Direction">Direction</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Type de Contrat">
              <select
                value={formData.contract_type || 'CDI'}
                onChange={(e) => setFormData((prev) => ({ ...prev, contract_type: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              >
                <option value="CDI">CDI</option>
                <option value="CDD">CDD</option>
                <option value="Stage">Stage (ANAPEC)</option>
                <option value="Intérim">Intérim</option>
              </select>
            </FormField>
            <FormField label="Date d'Embauche">
              <input
                type="date"
                value={formData.hire_date || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, hire_date: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Salaire Net (DH)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={formData.salary || ''}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, salary: parseFloat(e.target.value) || 0 }))
                }
                placeholder="0.00"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-right font-mono"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Téléphone">
              <input
                type="tel"
                value={formData.phone || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+212 6..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Email Pro / Perso">
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="collaborateur@pesage2000.ma"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2"
            >
              {isSubmitting ? 'Enregistrement...' : editingEmployee ? 'Enregistrer les Modifications' : 'Créer le Collaborateur'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
