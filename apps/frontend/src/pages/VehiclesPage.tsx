import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import {
  Vehicle,
  VehicleMaintenance,
  FuelLog,
  VehicleStats,
  VehicleCreate,
  VehicleMaintenanceCreate,
  FuelLogCreate,
  VehicleStatus,
} from '@/types/vehicles';
import { Employee } from '@/types/employees';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { useNotification } from '@/context/NotificationContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import {
  Truck,
  Plus,
  Download,
  Wrench,
  Fuel,
  AlertTriangle,
  CheckCircle,
  Calendar,
  Gauge,
  UserCheck,
  DollarSign,
  Activity,
  Edit2,
  X,
} from 'lucide-react';

export const VehiclesPage: React.FC = () => {
  const { showSuccess, showError } = useNotification();

  const [activeTab, setActiveTab] = useState<'vehicles' | 'maintenance' | 'fuel' | 'costs'>('vehicles');
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintenances, setMaintenances] = useState<VehicleMaintenance[]>([]);
  const [fuelLogs, setFuelLogs] = useState<FuelLog[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<VehicleStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Modals
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isQuickDriverModalOpen, setIsQuickDriverModalOpen] = useState(false);
  const [isMaintenanceModalOpen, setIsMaintenanceModalOpen] = useState(false);
  const [isFuelModalOpen, setIsFuelModalOpen] = useState(false);
  const [selectedVehicleForAction, setSelectedVehicleForAction] = useState<Vehicle | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Quick Driver Form
  const [quickDriverForm, setQuickDriverForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    job_title: 'Chauffeur / Livreur',
    department: 'Logistique & Transport',
  });

  // Forms
  const [vehicleForm, setVehicleForm] = useState<VehicleCreate>({
    brand: '',
    model: '',
    registration_number: '',
    status: VehicleStatus.AVAILABLE,
    year: new Date().getFullYear(),
    mileage: 0,
    fuel_type: 'Diesel',
    driver_id: null,
    insurance_expiry: '',
    technical_inspection_expiry: '',
    notes: '',
  });

  const [maintForm, setMaintForm] = useState<VehicleMaintenanceCreate>({
    vehicle_id: 0,
    maintenance_type: 'Vidange & Filtres',
    maintenance_date: new Date().toISOString().split('T')[0],
    mileage_at_maintenance: 0,
    description: '',
    service_provider: '',
    parts_cost: 0,
    labor_cost: 0,
    invoice_reference: '',
    notes: '',
  });

  const [fuelForm, setFuelForm] = useState<FuelLogCreate>({
    vehicle_id: 0,
    date: new Date().toISOString().split('T')[0],
    quantity_liters: 0,
    price_per_liter: 13.5,
    mileage: 0,
    station_name: 'Afriquia / Total',
    fuel_card_number: '',
    invoice_reference: '',
  });

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [vRes, mRes, fRes, empRes, statsRes] = await Promise.all([
        api.get<Vehicle[]>('/api/v1/vehicles'),
        api.get<VehicleMaintenance[]>('/api/v1/vehicles/maintenances'),
        api.get<FuelLog[]>('/api/v1/vehicles/fuel-logs'),
        api.get<Employee[]>('/api/v1/employees'),
        api.get<VehicleStats>('/api/v1/vehicles/stats'),
      ]);
      setVehicles(vRes.data);
      setMaintenances(mRes.data);
      setFuelLogs(fRes.data);
      setEmployees(empRes.data.filter((e) => e.is_active));
      setStats(statsRes.data);
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors du chargement de la flotte.'));
    } finally {
      setIsLoading(false);
    }
  }, [showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleOpenCreateVehicle = () => {
    setEditingVehicle(null);
    setVehicleForm({
      brand: '',
      model: '',
      registration_number: '',
      status: VehicleStatus.AVAILABLE,
      year: new Date().getFullYear(),
      mileage: 0,
      fuel_type: 'Diesel',
      driver_id: null,
      insurance_expiry: '',
      technical_inspection_expiry: '',
      notes: '',
    });
    setIsVehicleModalOpen(true);
  };

  const handleOpenEditVehicle = (v: Vehicle) => {
    setEditingVehicle(v);
    setVehicleForm({
      brand: v.brand,
      model: v.model,
      registration_number: v.registration_number,
      status: v.status,
      year: v.year || new Date().getFullYear(),
      mileage: v.mileage || (v as any).current_mileage || 0,
      fuel_type: v.fuel_type || 'Diesel',
      driver_id: v.driver_id || (v as any).default_driver_id || null,
      insurance_expiry: v.insurance_expiry ? v.insurance_expiry.split('T')[0] : '',
      technical_inspection_expiry: v.technical_inspection_expiry ? v.technical_inspection_expiry.split('T')[0] : '',
      notes: v.notes || '',
    });
    setIsVehicleModalOpen(true);
  };

  const handleQuickCreateDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDriverForm.first_name.trim() || !quickDriverForm.last_name.trim()) {
      showError('Nom et prénom du chauffeur sont obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post<Employee>('/api/v1/employees', {
        first_name: quickDriverForm.first_name.trim(),
        last_name: quickDriverForm.last_name.trim(),
        phone: quickDriverForm.phone.trim() || undefined,
        email: quickDriverForm.email.trim() || undefined,
        job_title: quickDriverForm.job_title.trim() || 'Chauffeur',
        department: quickDriverForm.department.trim() || 'Logistique',
        is_active: true,
      });

      showSuccess(`Chauffeur ${res.data.first_name} ${res.data.last_name} créé dans le Personnel.`);
      const empRes = await api.get<Employee[]>('/api/v1/employees');
      const activeEmps = empRes.data.filter((emp) => emp.is_active);
      setEmployees(activeEmps);
      setVehicleForm((prev) => ({ ...prev, driver_id: res.data.id }));
      setIsQuickDriverModalOpen(false);
      setQuickDriverForm({
        first_name: '',
        last_name: '',
        phone: '',
        email: '',
        job_title: 'Chauffeur / Livreur',
        department: 'Logistique & Transport',
      });
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de l'enregistrement du chauffeur."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!vehicleForm.brand.trim() || !vehicleForm.model.trim() || !vehicleForm.registration_number.trim()) {
      showError('Marque, modèle et matricule sont obligatoires.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        brand: vehicleForm.brand.trim(),
        model: vehicleForm.model.trim(),
        registration_number: vehicleForm.registration_number.trim().toUpperCase(),
        status: vehicleForm.status || VehicleStatus.AVAILABLE,
        fuel_type: vehicleForm.fuel_type || 'DIESEL',
        current_mileage: Number(vehicleForm.mileage) || 0,
        year: vehicleForm.year ? Number(vehicleForm.year) : undefined,
        default_driver_id: vehicleForm.driver_id ? Number(vehicleForm.driver_id) : null,
        insurance_expiry: vehicleForm.insurance_expiry ? new Date(vehicleForm.insurance_expiry).toISOString() : null,
        technical_inspection_expiry: vehicleForm.technical_inspection_expiry ? new Date(vehicleForm.technical_inspection_expiry).toISOString() : null,
        notes: vehicleForm.notes?.trim() || null,
      };

      if (editingVehicle) {
        await api.put(`/api/v1/vehicles/${editingVehicle.id}`, payload);
        showSuccess(`Véhicule ${payload.brand} ${payload.model} mis à jour avec succès.`);
      } else {
        await api.post('/api/v1/vehicles', payload);
        showSuccess('Véhicule enregistré avec succès.');
      }
      setIsVehicleModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de l'enregistrement du véhicule."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateMaintenance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!maintForm.vehicle_id || !maintForm.description.trim()) {
      showError('Veuillez sélectionner un véhicule et renseigner une description.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/v1/vehicles/maintenances', maintForm);
      showSuccess('Entretien enregistré avec succès.');
      setIsMaintenanceModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, "Erreur lors de l'enregistrement de l'entretien."));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateFuel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fuelForm.vehicle_id || fuelForm.quantity_liters <= 0 || fuelForm.price_per_liter <= 0) {
      showError('Veuillez renseigner les quantités et prix au litre.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.post('/api/v1/vehicles/fuel-logs', fuelForm);
      showSuccess('Plein de carburant enregistré.');
      setIsFuelModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err, 'Erreur lors de la saisie carburant.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = () => {
    const token = localStorage.getItem('access_token');
    const url = `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/exports/vehicles`;
    fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      .then((res) => res.blob())
      .then((blob) => {
        const downloadUrl = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.setAttribute('download', 'parc_et_vehicules.xlsx');
        document.body.appendChild(link);
        link.click();
        link.remove();
        showSuccess('Export Excel de la flotte téléchargé.');
      })
      .catch((e) => showError(getApiErrorMessage(e, "Erreur lors de l'exportation.")));
  };

  const filteredVehicles = useMemo(() => {
    return vehicles.filter((v) => {
      const matchSearch =
        searchTerm.trim() === '' ||
        v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.registration_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.code.toLowerCase().includes(searchTerm.toLowerCase());

      const matchStatus = statusFilter === 'ALL' || v.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [vehicles, searchTerm, statusFilter]);

  const vehicleColumns: Column<Vehicle>[] = [
    {
      header: 'Véhicule',
      accessor: (v) => (
        <div>
          <span className="font-semibold text-gray-900 dark:text-white block">
            {v.brand} {v.model}
          </span>
          <span className="font-mono text-xs text-pesage-blue dark:text-blue-400">{v.code}</span>
        </div>
      ),
    },
    {
      header: 'Matricule',
      accessor: (v) => (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-mono font-bold bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
          {v.registration_number}
        </span>
      ),
    },
    {
      header: 'Chauffeur / Affectation',
      accessor: (v) => (
        <span className="text-xs text-gray-700 dark:text-gray-300">
          {v.driver ? `${v.driver.first_name} ${v.driver.last_name}` : 'Non assigné'}
        </span>
      ),
    },
    {
      header: 'Kilométrage',
      accessor: (v) => (
        <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white">
          {v.mileage.toLocaleString()} km
        </span>
      ),
    },
    {
      header: 'Échéances Documents',
      accessor: (v) => (
        <div className="text-xs space-y-0.5">
          <div className="text-gray-600 dark:text-gray-400">
            Assurance: {v.insurance_expiry ? formatDate(v.insurance_expiry) : '—'}
          </div>
          <div className="text-gray-600 dark:text-gray-400">
            Visite: {v.technical_inspection_expiry ? formatDate(v.technical_inspection_expiry) : '—'}
          </div>
        </div>
      ),
    },
    {
      header: 'Statut',
      accessor: (v) => {
        const badges: Record<string, { bg: string; text: string; label: string }> = {
          AVAILABLE: { bg: 'bg-emerald-100 dark:bg-emerald-900/30', text: 'text-emerald-800 dark:text-emerald-400', label: 'Disponible' },
          IN_USE: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', label: 'En mission' },
          MAINTENANCE: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-800 dark:text-amber-400', label: 'En révision' },
          OUT_OF_SERVICE: { bg: 'bg-rose-100 dark:bg-rose-900/30', text: 'text-rose-800 dark:text-rose-400', label: 'Hors service' },
        };
        const badge = badges[v.status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: v.status };
        return (
          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${badge.bg} ${badge.text}`}>
            {badge.label}
          </span>
        );
      },
    },
    {
      header: 'Actions',
      accessor: (v) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleOpenEditVehicle(v)}
            className="p-1.5 text-gray-500 hover:text-pesage-blue hover:bg-pesage-blue/10 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Modifier le Véhicule"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedVehicleForAction(v);
              setMaintForm((prev) => ({ ...prev, vehicle_id: v.id, mileage_at_maintenance: v.mileage }));
              setIsMaintenanceModalOpen(true);
            }}
            className="p-1.5 text-gray-500 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 rounded-lg transition-colors"
            title="Enregistrer Entretien"
          >
            <Wrench className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedVehicleForAction(v);
              setFuelForm((prev) => ({ ...prev, vehicle_id: v.id, mileage: v.mileage }));
              setIsFuelModalOpen(true);
            }}
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
            title="Enregistrer Plein Carburant"
          >
            <Fuel className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const maintenanceColumns: Column<VehicleMaintenance>[] = [
    {
      header: 'Date & Véhicule',
      accessor: (m) => (
        <div>
          <span className="font-semibold text-gray-900 dark:text-white block text-xs">
            {m.vehicle?.brand} {m.vehicle?.model} ({m.vehicle?.registration_number})
          </span>
          <span className="text-gray-500 text-xs">{formatDate(m.maintenance_date)}</span>
        </div>
      ),
    },
    {
      header: 'Intervention',
      accessor: (m) => (
        <div>
          <span className="font-medium text-gray-900 dark:text-white block">{m.maintenance_type}</span>
          <span className="text-xs text-gray-500">{m.description}</span>
        </div>
      ),
    },
    {
      header: 'Prestataire',
      accessor: (m) => (
        <span className="text-xs text-gray-600 dark:text-gray-400">
          {m.service_provider || 'Interne'}
        </span>
      ),
    },
    {
      header: 'Coût Pièces / MO',
      accessor: (m) => (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div>Pièces: {formatCurrency(m.parts_cost)}</div>
          <div>MO: {formatCurrency(m.labor_cost)}</div>
        </div>
      ),
    },
    {
      header: 'Total Entretien',
      accessor: (m) => (
        <span className="font-bold text-gray-900 dark:text-white font-mono">
          {formatCurrency(m.total_cost)}
        </span>
      ),
    },
  ];

  const fuelColumns: Column<FuelLog>[] = [
    {
      header: 'Date & Véhicule',
      accessor: (f) => (
        <div>
          <span className="font-semibold text-gray-900 dark:text-white block text-xs">
            {f.vehicle?.brand} {f.vehicle?.model} ({f.vehicle?.registration_number})
          </span>
          <span className="text-gray-500 text-xs">{formatDate(f.date)}</span>
        </div>
      ),
    },
    {
      header: 'Volume (Litres)',
      accessor: (f) => (
        <span className="font-mono font-bold text-gray-900 dark:text-white">
          {f.quantity_liters} L
        </span>
      ),
    },
    {
      header: 'Prix / Litre',
      accessor: (f) => (
        <span className="font-mono text-gray-600 dark:text-gray-400 text-xs">
          {f.price_per_liter.toFixed(2)} DH/L
        </span>
      ),
    },
    {
      header: 'Total Carburant',
      accessor: (f) => (
        <span className="font-bold text-gray-900 dark:text-white font-mono">
          {formatCurrency(f.total_cost)}
        </span>
      ),
    },
    {
      header: 'Kilométrage & Station',
      accessor: (f) => (
        <div className="text-xs text-gray-600 dark:text-gray-400">
          <div>{f.mileage ? `${f.mileage.toLocaleString()} km` : '—'}</div>
          <div className="text-gray-400">{f.station_name}</div>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Parc Véhicules & Flotte"
        description="Gestion des utilitaires, suivi des coûts d'entretien et consommations carburant."
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
              onClick={handleOpenCreateVehicle}
              className="btn-primary px-4 py-2"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau Véhicule</span>
            </button>
          </div>
        }
      />

      {/* Expiry Alerts Banner */}
      {stats && (stats.expiring_insurances_30d > 0 || stats.expiring_inspections_30d > 0) && (
        <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between text-amber-900 dark:text-amber-200">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm">
              <span className="font-bold">Alerte Échéances Documents Flotte : </span>
              {stats.expiring_insurances_30d > 0 && (
                <span className="mr-3">
                  {stats.expiring_insurances_30d} assurance(s) expirent sous 30 jours.
                </span>
              )}
              {stats.expiring_inspections_30d > 0 && (
                <span>
                  {stats.expiring_inspections_30d} contrôle(s) technique(s) à renouveler prochainement.
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Total Utilitaires
            </span>
            <div className="p-2 rounded-xl bg-pesage-blue/10 text-pesage-blue dark:text-blue-400">
              <Truck className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {stats?.total_vehicles || vehicles.length}
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {stats?.active_vehicles || 0} disponibles / actifs
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Carburant du Mois
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600">
              <Fuel className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.total_fuel_cost_month || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Dépenses gazole & essence</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Entretiens du Mois
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30 text-amber-600">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.total_maintenance_cost_month || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Vidanges, pneumatiques, réparations</p>
        </div>

        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
              Coût Total Flotte / Mois
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-2xl font-bold text-gray-900 dark:text-white">
            {formatCurrency(stats?.total_fleet_expenses_month || 0)}
          </div>
          <p className="mt-1 text-xs text-gray-500">Carburant + Entretiens cumulés</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-app-border">
        <button
          type="button"
          onClick={() => setActiveTab('vehicles')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'vehicles'
              ? 'border-pesage-blue text-pesage-blue dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Parc Véhicules ({vehicles.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'maintenance'
              ? 'border-pesage-blue text-pesage-blue dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Historique Entretiens ({maintenances.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('fuel')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'fuel'
              ? 'border-pesage-blue text-pesage-blue dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Pleins Carburant ({fuelLogs.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('costs')}
          className={`pb-3 px-4 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'costs'
              ? 'border-pesage-blue text-pesage-blue dark:border-blue-500 dark:text-blue-400'
              : 'border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
          }`}
        >
          Coûts par Véhicule
        </button>
      </div>

      {activeTab === 'vehicles' && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="w-full md:w-96">
              <SearchBar
                value={searchTerm}
                onChange={setSearchTerm}
                placeholder="Rechercher par matricule, marque, code..."
              />
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                aria-label="Filtrer par statut"
                className="px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="AVAILABLE">Disponible</option>
                <option value="IN_USE">En mission</option>
                <option value="MAINTENANCE">En révision</option>
                <option value="OUT_OF_SERVICE">Hors service</option>
              </select>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
            <DataTable
              columns={vehicleColumns}
              data={filteredVehicles}
              isLoading={isLoading}
              keyExtractor={(v) => v.id.toString()}
              emptyTitle="Aucun véhicule enregistré."
            />
          </div>
        </div>
      )}

      {activeTab === 'maintenance' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <DataTable
            columns={maintenanceColumns}
            data={maintenances}
            isLoading={isLoading}
            keyExtractor={(m) => m.id.toString()}
            emptyTitle="Aucun entretien enregistré."
          />
        </div>
      )}

      {activeTab === 'fuel' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <DataTable
            columns={fuelColumns}
            data={fuelLogs}
            isLoading={isLoading}
            keyExtractor={(f) => f.id.toString()}
            emptyTitle="Aucun enregistrement carburant."
          />
        </div>
      )}

      {activeTab === 'costs' && (
        <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 dark:bg-gray-900/50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="p-4">Véhicule & Matricule</th>
                <th className="p-4 text-right">Carburant Mois (DH)</th>
                <th className="p-4 text-right">Entretiens Mois (DH)</th>
                <th className="p-4 text-right">Coût Total Mois (DH)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats?.by_vehicle && stats.by_vehicle.length > 0 ? (
                stats.by_vehicle.map((v) => (
                  <tr key={v.vehicle_id} className="hover:bg-gray-50/50 dark:hover:bg-gray-800/50">
                    <td className="p-4">
                      <span className="font-semibold text-gray-900 dark:text-white block">
                        {v.brand} {v.model}
                      </span>
                      <span className="text-xs font-mono text-gray-500">{v.registration_number}</span>
                    </td>
                    <td className="p-4 text-right font-mono text-blue-600">
                      {formatCurrency(v.fuel_cost_month)}
                    </td>
                    <td className="p-4 text-right font-mono text-amber-600">
                      {formatCurrency(v.maintenance_cost_month)}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-gray-900 dark:text-white">
                      {formatCurrency(v.total_cost_month)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-gray-500 text-sm">
                    Aucune dépense de flotte enregistrée ce mois-ci.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE / EDIT VEHICLE MODAL */}
      <Modal
        isOpen={isVehicleModalOpen}
        onClose={() => setIsVehicleModalOpen(false)}
        title={editingVehicle ? `Modifier le Véhicule — ${editingVehicle.registration_number}` : 'Ajouter un Véhicule au Parc'}
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateVehicle} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Marque" required>
              <input
                type="text"
                value={vehicleForm.brand}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, brand: e.target.value }))}
                placeholder="Ex: Renault, Dacia, Peugeot..."
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Modèle" required>
              <input
                type="text"
                value={vehicleForm.model}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, model: e.target.value }))}
                placeholder="Ex: Master, Dokker, Partner..."
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Matricule (Immatriculation)" required>
              <input
                type="text"
                value={vehicleForm.registration_number}
                onChange={(e) =>
                  setVehicleForm((prev) => ({ ...prev, registration_number: e.target.value }))
                }
                placeholder="Ex: 12345-A-6"
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono"
              />
            </FormField>
            <FormField label="Type de Carburant">
              <select
                value={vehicleForm.fuel_type || 'Diesel'}
                onChange={(e) => setVehicleForm((prev) => ({ ...prev, fuel_type: e.target.value }))}
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              >
                <option value="Diesel">Diesel (Gazole)</option>
                <option value="Essence (Sans Plomb)">Essence (Sans Plomb)</option>
                <option value="Hybride">Hybride</option>
                <option value="Électrique">Électrique</option>
              </select>
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <FormField label="Kilométrage Actuel">
              <input
                type="number"
                min="0"
                value={vehicleForm.mileage}
                onChange={(e) =>
                  setVehicleForm((prev) => ({ ...prev, mileage: parseInt(e.target.value) || 0 }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>
            <FormField label="Année Mise en Service">
              <input
                type="number"
                min="1990"
                max="2035"
                value={vehicleForm.year || 2024}
                onChange={(e) =>
                  setVehicleForm((prev) => ({ ...prev, year: parseInt(e.target.value) || 2024 }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-center"
              />
            </FormField>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  Chauffeur affecté
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickDriverModalOpen(true)}
                  className="text-[11px] text-pesage-blue dark:text-blue-400 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Plus className="w-3 h-3" />
                  Ajouter chauffeur
                </button>
              </div>
              <select
                value={vehicleForm.driver_id || ''}
                onChange={(e) =>
                  setVehicleForm((prev) => ({ ...prev, driver_id: Number(e.target.value) || null }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              >
                <option value="">-- Aucun chauffeur (Optionnel) --</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.first_name} {e.last_name} {e.job_title ? `(${e.job_title})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField label="Date Échéance Assurance">
              <input
                type="date"
                value={vehicleForm.insurance_expiry || ''}
                onChange={(e) =>
                  setVehicleForm((prev) => ({ ...prev, insurance_expiry: e.target.value }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Date Échéance Visite Technique">
              <input
                type="date"
                value={vehicleForm.technical_inspection_expiry || ''}
                onChange={(e) =>
                  setVehicleForm((prev) => ({
                    ...prev,
                    technical_inspection_expiry: e.target.value,
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <FormField label="Notes & Observations">
            <textarea
              rows={2}
              value={vehicleForm.notes || ''}
              onChange={(e) => setVehicleForm((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Équipements spécifiques, carte carburant liée..."
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </FormField>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsVehicleModalOpen(false)}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2"
            >
              {isSubmitting ? 'Enregistrement...' : editingVehicle ? 'Mettre à jour' : 'Créer le Véhicule'}
            </button>
          </div>
        </form>
      </Modal>

      {/* QUICK CREATE DRIVER / EMPLOYEE MODAL */}
      <Modal
        isOpen={isQuickDriverModalOpen}
        onClose={() => setIsQuickDriverModalOpen(false)}
        title="Ajouter un Chauffeur dans le Personnel"
        maxWidth="md"
      >
        <form onSubmit={handleQuickCreateDriver} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Prénom" required>
              <input
                type="text"
                value={quickDriverForm.first_name}
                onChange={(e) => setQuickDriverForm((prev) => ({ ...prev, first_name: e.target.value }))}
                placeholder="Ex: Hassan"
                required
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Nom" required>
              <input
                type="text"
                value={quickDriverForm.last_name}
                onChange={(e) => setQuickDriverForm((prev) => ({ ...prev, last_name: e.target.value }))}
                placeholder="Ex: Tazi"
                required
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Téléphone">
              <input
                type="tel"
                value={quickDriverForm.phone}
                onChange={(e) => setQuickDriverForm((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder="+212 6 XX XX XX XX"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Email">
              <input
                type="email"
                value={quickDriverForm.email}
                onChange={(e) => setQuickDriverForm((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="hassan.tazi@pesage2000.ma"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fonction / Rôle">
              <input
                type="text"
                value={quickDriverForm.job_title}
                onChange={(e) => setQuickDriverForm((prev) => ({ ...prev, job_title: e.target.value }))}
                placeholder="Chauffeur / Livreur"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
            <FormField label="Département">
              <input
                type="text"
                value={quickDriverForm.department}
                onChange={(e) => setQuickDriverForm((prev) => ({ ...prev, department: e.target.value }))}
                placeholder="Logistique"
                className="w-full px-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <p className="text-xs text-gray-500">
            Ce chauffeur sera directement enregistré dans la gestion du Personnel (RH) et sélectionné pour ce véhicule.
          </p>

          <div className="flex justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsQuickDriverModalOpen(false)}
              className="btn-secondary px-3.5 py-1.5 text-xs"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-4 py-1.5 text-xs"
            >
              {isSubmitting ? 'Enregistrement...' : 'Créer et Sélectionner'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CREATE MAINTENANCE MODAL */}
      <Modal
        isOpen={isMaintenanceModalOpen}
        onClose={() => setIsMaintenanceModalOpen(false)}
        title={
          selectedVehicleForAction
            ? `Entretien — ${selectedVehicleForAction.brand} ${selectedVehicleForAction.model}`
            : 'Enregistrer un Entretien'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleCreateMaintenance} className="space-y-4">
          <FormField label="Type d'Intervention" required>
            <select
              value={maintForm.maintenance_type}
              onChange={(e) => setMaintForm((prev) => ({ ...prev, maintenance_type: e.target.value }))}
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            >
              <option value="Vidange & Filtres">Vidange & Filtres</option>
              <option value="Pneumatiques">Pneumatiques / Remplacement Pneus</option>
              <option value="Freinage / Plaquettes">Freinage / Plaquettes / Disques</option>
              <option value="Révision Générale">Révision Générale / Diagnostic</option>
              <option value="Batterie / Électricité">Batterie / Alternateur / Électricité</option>
              <option value="Carrosserie">Carrosserie / Peinture</option>
              <option value="Autre Réparation">Autre Réparation</option>
            </select>
          </FormField>

          <FormField label="Description des Travaux" required>
            <input
              type="text"
              value={maintForm.description}
              onChange={(e) => setMaintForm((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Ex: Changement huile 5W30 + filtre à huile et habitacle..."
              required
              className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Coût Pièces (DH)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={maintForm.parts_cost || ''}
                onChange={(e) =>
                  setMaintForm((prev) => ({ ...prev, parts_cost: parseFloat(e.target.value) || 0 }))
                }
                placeholder="0.00"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>
            <FormField label="Coût Main d'Œuvre (DH)">
              <input
                type="number"
                step="0.01"
                min="0"
                value={maintForm.labor_cost || ''}
                onChange={(e) =>
                  setMaintForm((prev) => ({ ...prev, labor_cost: parseFloat(e.target.value) || 0 }))
                }
                placeholder="0.00"
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Kilométrage Intervention">
              <input
                type="number"
                min="0"
                value={maintForm.mileage_at_maintenance || ''}
                onChange={(e) =>
                  setMaintForm((prev) => ({
                    ...prev,
                    mileage_at_maintenance: parseInt(e.target.value) || 0,
                  }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>
            <FormField label="Garage / Prestataire">
              <input
                type="text"
                value={maintForm.service_provider || ''}
                onChange={(e) =>
                  setMaintForm((prev) => ({ ...prev, service_provider: e.target.value }))
                }
                placeholder="Ex: Garage Renault..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsMaintenanceModalOpen(false)}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer l’Entretien'}
            </button>
          </div>
        </form>
      </Modal>

      {/* CREATE FUEL MODAL */}
      <Modal
        isOpen={isFuelModalOpen}
        onClose={() => setIsFuelModalOpen(false)}
        title={
          selectedVehicleForAction
            ? `Carburant — ${selectedVehicleForAction.brand} ${selectedVehicleForAction.model}`
            : 'Enregistrer un Plein Carburant'
        }
        maxWidth="lg"
      >
        <form onSubmit={handleCreateFuel} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Quantité (Litres)" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fuelForm.quantity_liters || ''}
                onChange={(e) =>
                  setFuelForm((prev) => ({
                    ...prev,
                    quantity_liters: parseFloat(e.target.value) || 0,
                  }))
                }
                placeholder="0.00"
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>
            <FormField label="Prix / Litre (DH)" required>
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={fuelForm.price_per_liter || ''}
                onChange={(e) =>
                  setFuelForm((prev) => ({
                    ...prev,
                    price_per_liter: parseFloat(e.target.value) || 0,
                  }))
                }
                required
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>
          </div>

          <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 flex justify-between items-center text-sm">
            <span className="text-gray-600 dark:text-gray-400">Total Plein Calculé :</span>
            <span className="font-bold text-gray-900 dark:text-white font-mono text-base">
              {formatCurrency(Number(fuelForm.quantity_liters || 0) * Number(fuelForm.price_per_liter || 0))}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Kilométrage Compteur">
              <input
                type="number"
                min="0"
                value={fuelForm.mileage || ''}
                onChange={(e) =>
                  setFuelForm((prev) => ({ ...prev, mileage: parseInt(e.target.value) || 0 }))
                }
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm font-mono text-right"
              />
            </FormField>
            <FormField label="Station Service">
              <input
                type="text"
                value={fuelForm.station_name || ''}
                onChange={(e) => setFuelForm((prev) => ({ ...prev, station_name: e.target.value }))}
                placeholder="Afriquia, Shell, Total..."
                className="w-full px-3.5 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
              />
            </FormField>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              type="button"
              onClick={() => setIsFuelModalOpen(false)}
              className="btn-secondary px-4 py-2"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-primary px-5 py-2"
            >
              {isSubmitting ? 'Enregistrement...' : 'Enregistrer le Plein'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
