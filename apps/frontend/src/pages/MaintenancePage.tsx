import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { api, getApiErrorMessage } from '@/lib/api';
import { customerService } from '@/services/customerService';
import {
  Equipment,
  EquipmentCreate,
  EquipmentStatus,
  EquipmentType,
  Intervention,
  InterventionCreate,
  InterventionPriority,
  InterventionStatus,
  InterventionType,
  MaintenanceStats,
  TaskStatus,
} from '@/types/maintenance';
import { BusinessPartner } from '@/types/partner';
import { Employee } from '@/types/employees';
import { Product } from '@/types/catalog';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { Modal } from '@/components/ui/Modal';
import { FormField } from '@/components/ui/FormField';
import { useNotification } from '@/context/NotificationContext';
import { formatCurrency, formatDate } from '@/lib/formatters';
import { DocumentFooter, InterventionReportDocument } from '@/components/common/DocumentPrintTemplate';
import { DocumentPreviewModal } from '@/components/common/DocumentPreviewModal';
import { AttachmentsSection } from '@/components/common/AttachmentsSection';

import {
  Wrench,
  Plus,
  Printer,
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Scale,
  UserCheck,
  DollarSign,
  History,
  Trash2,
  Edit2,
  Eye,
  CheckSquare,
  Square,
  Package,
  RefreshCw,
} from 'lucide-react';

const EQUIPMENT_TYPE_LABELS: Record<EquipmentType, string> = {
  [EquipmentType.PONTS_BASCULES]: 'Pont-bascule',
  [EquipmentType.BALANCES_INDUSTRIELLES]: 'Balance industrielle',
  [EquipmentType.BALANCES_PLATEFORMES]: 'Balance plateforme',
  [EquipmentType.INDICATEURS_POIDS]: 'Indicateur de poids',
  [EquipmentType.CAPTEURS_CHARGE]: 'Capteur de charge',
  [EquipmentType.TERMINAUX_PESAGE]: 'Terminal de pesage',
  [EquipmentType.IMPRIMANTES_TICKETS]: 'Imprimante tickets',
  [EquipmentType.AUTRE]: 'Autre équipement',
};

const INTERVENTION_TYPE_LABELS: Record<InterventionType, string> = {
  [InterventionType.PREVENTIVE_MAINTENANCE]: 'Maintenance préventive',
  [InterventionType.CORRECTIVE_MAINTENANCE]: 'Maintenance corrective',
  [InterventionType.BREAKDOWN_REPAIR]: 'Dépannage urgent',
  [InterventionType.CALIBRATION]: 'Étalonnage / Calibration',
  [InterventionType.INSTALLATION]: 'Installation & Mise en service',
  [InterventionType.INSPECTION]: 'Contrôle / Inspection',
  [InterventionType.METROLOGY_LEGAL]: 'Métrologie légale',
  [InterventionType.STAMPING]: 'Poinçonnage',
  [InterventionType.OTHER]: 'Autre',
};

const COMMON_PESAGE_TASKS = [
  'Démontage de la plateforme et accès butées',
  'Nettoyage et contrôle étanchéité de la boîte de jonction',
  'Ajustage et contrôle des capteurs de pesage',
  'Vérification des butées longitudinales et transversales',
  'Réglage du zéro et contrôle de sensibilité',
  'Contrôle de linéarité et d’excentration avec masses étalons classe M1',
  'Vérification et calibrage de l’indicateur de poids',
  'Poinçonnage / Vignette de métrologie légale',
  'Graissage des rotules et pièces d’usure',
  'Peinture et traitement anticorrosion du tablier',
];

export const MaintenancePage: React.FC = () => {
  const { showSuccess, showError } = useNotification();

  const [activeTab, setActiveTab] = useState<'interventions' | 'equipments'>('interventions');
  const [interventions, setInterventions] = useState<Intervention[]>([]);
  const [equipments, setEquipments] = useState<Equipment[]>([]);
  const [partners, setPartners] = useState<BusinessPartner[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [stats, setStats] = useState<MaintenanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');

  // Modals
  const [isInterventionModalOpen, setIsInterventionModalOpen] = useState(false);
  const [isEquipmentModalOpen, setIsEquipmentModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [isQuickTechModalOpen, setIsQuickTechModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Selected items for view/edit
  const [selectedIntervention, setSelectedIntervention] = useState<Intervention | null>(null);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const [equipmentHistory, setEquipmentHistory] = useState<Intervention[]>([]);

  // Form State: Equipment
  const [equipmentForm, setEquipmentForm] = useState<Partial<EquipmentCreate>>({
    customer_id: 0,
    designation: '',
    equipment_type: EquipmentType.PONTS_BASCULES,
    brand: '',
    model: '',
    serial_number: '',
    site_name: '',
    site_address: '',
    city: '',
    installation_date: '',
    capacity_max: 60000,
    capacity_min: 400,
    graduation: 20,
    status: EquipmentStatus.OPERATIONAL,
    notes: '',
  });

  // Form State: Intervention
  const [interventionForm, setInterventionForm] = useState<Partial<InterventionCreate>>({
    customer_id: 0,
    equipment_id: null,
    site: '',
    assigned_technician_id: null,
    date_start: new Date().toISOString().slice(0, 16),
    date_end: '',
    intervention_type: InterventionType.PREVENTIVE_MAINTENANCE,
    priority: InterventionPriority.NORMAL,
    status: InterventionStatus.SCHEDULED,
    problem_description: '',
    diagnosis: '',
    work_performed: '',
    observations: '',
    recommendations: '',
    next_maintenance_date: '',
    labor_cost: 0,
    parts_cost: 0,
    travel_cost: 0,
    other_cost: 0,
    total_cost: 0,
    tasks: [],
    parts: [],
  });

  // Quick Technician Form
  const [techForm, setTechForm] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    email: '',
    position: 'Technicien Métrologue',
  });

  // ----------------------------------------------------
  // DATA FETCHING
  // ----------------------------------------------------
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      const params = new URLSearchParams();
      if (selectedYear) params.append('year', selectedYear.toString());
      if (selectedMonth !== 'ALL') params.append('month', selectedMonth);
      if (statusFilter !== 'ALL') params.append('status', statusFilter);
      if (typeFilter !== 'ALL') params.append('intervention_type', typeFilter);
      if (priorityFilter !== 'ALL') params.append('priority', priorityFilter);
      if (selectedCustomerId !== 'ALL') params.append('customer_id', selectedCustomerId);
      if (searchTerm) params.append('search', searchTerm);

      const [interventionsRes, equipmentsRes, statsRes, partnersList, employeesRes, productsRes] =
        await Promise.all([
          api.get<Intervention[]>(`/api/v1/maintenance?${params.toString()}`),
          api.get<Equipment[]>('/api/v1/maintenance/equipments'),
          api.get<MaintenanceStats>(`/api/v1/maintenance/stats?year=${selectedYear}${selectedMonth !== 'ALL' ? `&month=${selectedMonth}` : ''}`),
          customerService.getCustomers({ isActive: true }),
          api.get<Employee[]>('/api/v1/employees'),
          api.get<Product[]>('/api/v1/products'),
        ]);

      setInterventions(interventionsRes.data);
      setEquipments(equipmentsRes.data);
      setStats(statsRes.data);
      setPartners(partnersList);
      setEmployees(employeesRes.data.filter((e) => e.is_active));
      setProducts(productsRes.data);
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [selectedYear, selectedMonth, statusFilter, typeFilter, priorityFilter, selectedCustomerId, searchTerm, showError]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Recalculate totals in intervention form
  const computedPartsCost = useMemo(() => {
    return (interventionForm.parts || []).reduce((sum, p) => {
      const qty = Number(p.quantity) || 1;
      const price = Number(p.unit_price) || 0;
      return sum + qty * price;
    }, 0);
  }, [interventionForm.parts]);

  const computedTotalCost = useMemo(() => {
    const labor = Number(interventionForm.labor_cost) || 0;
    const travel = Number(interventionForm.travel_cost) || 0;
    const other = Number(interventionForm.other_cost) || 0;
    return labor + computedPartsCost + travel + other;
  }, [interventionForm.labor_cost, computedPartsCost, interventionForm.travel_cost, interventionForm.other_cost]);

  // ----------------------------------------------------
  // HANDLERS: INTERVENTIONS
  // ----------------------------------------------------
  const handleOpenNewIntervention = (presetEquipment?: Equipment) => {
    setSelectedIntervention(null);
    setInterventionForm({
      customer_id: presetEquipment ? presetEquipment.customer_id : partners[0]?.id || 0,
      equipment_id: presetEquipment ? presetEquipment.id : null,
      site: presetEquipment ? (presetEquipment.site_name || presetEquipment.city || '') : '',
      assigned_technician_id: employees[0]?.id || null,
      date_start: new Date().toISOString().slice(0, 16),
      date_end: '',
      intervention_type: InterventionType.PREVENTIVE_MAINTENANCE,
      priority: InterventionPriority.NORMAL,
      status: InterventionStatus.SCHEDULED,
      problem_description: presetEquipment ? `Entretien périodique pour ${presetEquipment.designation}` : '',
      diagnosis: '',
      work_performed: '',
      observations: '',
      recommendations: '',
      next_maintenance_date: '',
      labor_cost: 500,
      parts_cost: 0,
      travel_cost: 150,
      other_cost: 0,
      total_cost: 650,
      tasks: COMMON_PESAGE_TASKS.slice(0, 5).map((desc, idx) => ({
        description: desc,
        status: TaskStatus.PENDING,
        order_index: idx + 1,
      })),
      parts: [],
    });
    setIsInterventionModalOpen(true);
  };

  const handleEditIntervention = (item: Intervention) => {
    setSelectedIntervention(item);
    setInterventionForm({
      customer_id: item.customer_id,
      equipment_id: item.equipment_id,
      site: item.site || '',
      assigned_technician_id: item.assigned_technician_id,
      date_start: item.date_start ? item.date_start.slice(0, 16) : '',
      date_end: item.date_end ? item.date_end.slice(0, 16) : '',
      intervention_type: item.intervention_type,
      priority: item.priority,
      status: item.status,
      problem_description: item.problem_description || '',
      diagnosis: item.diagnosis || '',
      work_performed: item.work_performed || '',
      observations: item.observations || '',
      recommendations: item.recommendations || '',
      next_maintenance_date: item.next_maintenance_date ? item.next_maintenance_date.slice(0, 10) : '',
      labor_cost: item.labor_cost,
      parts_cost: item.parts_cost,
      travel_cost: item.travel_cost,
      other_cost: item.other_cost,
      total_cost: item.total_cost,
      tasks: (item.tasks || []).map((t) => ({
        description: t.description,
        status: t.status,
        notes: t.notes || '',
        order_index: t.order_index,
      })),
      parts: (item.parts || []).map((p) => ({
        product_id: p.product_id,
        designation: p.designation,
        quantity: p.quantity,
        unit_price: p.unit_price,
        tax_rate: p.tax_rate,
      })),
    });
    setIsInterventionModalOpen(true);
  };

  const handleSaveIntervention = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!interventionForm.customer_id) {
      showError('Veuillez sélectionner un client.');
      return;
    }

    try {
      setIsSubmitting(true);
      const payload = {
        ...interventionForm,
        parts_cost: computedPartsCost,
        total_cost: computedTotalCost,
        tasks: interventionForm.tasks,
        parts: interventionForm.parts,
      };

      if (selectedIntervention) {
        await api.put(`/api/v1/maintenance/${selectedIntervention.id}`, payload);
        showSuccess(`Intervention ${selectedIntervention.intervention_code} mise à jour avec succès.`);
      } else {
        const res = await api.post<Intervention>('/api/v1/maintenance', payload);
        showSuccess(`Intervention ${res.data.intervention_code} enregistrée avec succès.`);
      }

      setIsInterventionModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickStatusChange = async (intervention: Intervention, newStatus: InterventionStatus) => {
    try {
      await api.patch(`/api/v1/maintenance/${intervention.id}/status`, {
        status: newStatus,
        observations: newStatus === InterventionStatus.COMPLETED ? 'Intervention validée conforme.' : undefined,
      });
      showSuccess(`Statut de l'intervention ${intervention.intervention_code} mis à jour : ${newStatus}.`);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  };

  const handleDeleteIntervention = async (intervention: Intervention) => {
    if (!window.confirm(`Confirmez-vous la suppression de l'intervention ${intervention.intervention_code} ?`)) {
      return;
    }
    try {
      await api.delete(`/api/v1/maintenance/${intervention.id}`);
      showSuccess(`Intervention ${intervention.intervention_code} supprimée.`);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  };

  // ----------------------------------------------------
  // HANDLERS: EQUIPMENTS
  // ----------------------------------------------------
  const handleOpenNewEquipment = () => {
    setSelectedEquipment(null);
    setEquipmentForm({
      customer_id: partners[0]?.id || 0,
      designation: 'Pont-Bascule Métallique 60T (Fosse)',
      equipment_type: EquipmentType.PONTS_BASCULES,
      brand: 'Pesage 2000 Pro',
      model: 'PB-60T-18M',
      serial_number: `SN-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      site_name: 'Site Principal',
      site_address: '',
      city: 'Casablanca',
      installation_date: new Date().toISOString().slice(0, 10),
      capacity_max: 60000,
      capacity_min: 400,
      graduation: 20,
      status: EquipmentStatus.OPERATIONAL,
      notes: 'Matériel conforme classe III de métrologie légale.',
    });
    setIsEquipmentModalOpen(true);
  };

  const handleEditEquipment = (item: Equipment) => {
    setSelectedEquipment(item);
    setEquipmentForm({
      customer_id: item.customer_id,
      designation: item.designation,
      equipment_type: item.equipment_type,
      brand: item.brand || '',
      model: item.model || '',
      serial_number: item.serial_number || '',
      site_name: item.site_name || '',
      site_address: item.site_address || '',
      city: item.city || '',
      installation_date: item.installation_date ? item.installation_date.slice(0, 10) : '',
      capacity_max: item.capacity_max,
      capacity_min: item.capacity_min,
      graduation: item.graduation,
      status: item.status,
      notes: item.notes || '',
    });
    setIsEquipmentModalOpen(true);
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!equipmentForm.customer_id || !equipmentForm.designation) {
      showError('Veuillez renseigner le client et la désignation.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (selectedEquipment) {
        await api.put(`/api/v1/maintenance/equipments/${selectedEquipment.id}`, equipmentForm);
        showSuccess(`Équipement ${selectedEquipment.equipment_code} mis à jour.`);
      } else {
        const res = await api.post<Equipment>('/api/v1/maintenance/equipments', equipmentForm);
        showSuccess(`Équipement ${res.data.equipment_code} enregistré avec succès.`);
      }
      setIsEquipmentModalOpen(false);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleViewEquipmentHistory = async (item: Equipment) => {
    try {
      setSelectedEquipment(item);
      const res = await api.get<Intervention[]>(`/api/v1/maintenance/equipments/${item.id}/history`);
      setEquipmentHistory(res.data);
      setIsHistoryModalOpen(true);
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  };

  const handleDeleteEquipment = async (item: Equipment) => {
    if (!window.confirm(`Confirmez-vous la suppression de l'équipement ${item.equipment_code} ?`)) {
      return;
    }
    try {
      await api.delete(`/api/v1/maintenance/equipments/${item.id}`);
      showSuccess(`Équipement ${item.equipment_code} supprimé.`);
      fetchData();
    } catch (err) {
      showError(getApiErrorMessage(err));
    }
  };

  // ----------------------------------------------------
  // QUICK TECHNICIAN CREATION
  // ----------------------------------------------------
  const handleCreateQuickTech = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!techForm.first_name || !techForm.last_name) {
      showError('Nom et prénom obligatoires.');
      return;
    }
    try {
      setIsSubmitting(true);
      const res = await api.post<Employee>('/api/v1/employees', {
        first_name: techForm.first_name,
        last_name: techForm.last_name,
        phone: techForm.phone,
        email: techForm.email || undefined,
        job_title: techForm.position,
        department: 'Technique & Métrologie',
        is_active: true,
      });

      const newTech = res.data;
      setEmployees((prev) => [...prev, newTech]);
      setInterventionForm((prev) => ({ ...prev, assigned_technician_id: newTech.id }));
      setIsQuickTechModalOpen(false);
      setTechForm({ first_name: '', last_name: '', phone: '', email: '', position: 'Technicien Métrologue' });
      showSuccess(`Technicien ${newTech.first_name} ${newTech.last_name} ajouté et sélectionné.`);
    } catch (err) {
      showError(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  // ----------------------------------------------------
  // REPORT VIEW / PRINT
  // ----------------------------------------------------
  const handleOpenReport = (item: Intervention) => {
    setSelectedIntervention(item);
    setIsReportModalOpen(true);
  };

  const handlePrintReport = () => {
    window.print();
  };

  // Filtered customer equipments in form
  const customerEquipments = useMemo(() => {
    if (!interventionForm.customer_id) return [];
    return equipments.filter((eq) => eq.customer_id === Number(interventionForm.customer_id));
  }, [equipments, interventionForm.customer_id]);

  // ----------------------------------------------------
  // DATA TABLE COLUMNS
  // ----------------------------------------------------
  const interventionColumns: Column<Intervention>[] = [
    {
      header: 'Code / Date',
      accessor: (item) => (
        <div>
          <div className="font-bold text-app-text flex items-center space-x-1.5">
            <Wrench className="w-3.5 h-3.5 text-pesage-orange" />
            <span>{item.intervention_code}</span>
          </div>
          <div className="text-[11px] text-app-text-muted mt-0.5">
            {formatDate(item.date_start)}
          </div>
        </div>
      ),
    },
    {
      header: 'Client & Site',
      accessor: (item) => (
        <div>
          <div className="font-semibold text-app-text">
            {item.customer?.legal_name || item.customer?.trade_name || item.customer?.company_name || `Client #${item.customer_id}`}
          </div>
          <div className="text-xs text-app-text-muted">{item.site || item.customer?.city || 'Site client'}</div>
        </div>
      ),
    },
    {
      header: 'Équipement Pesage',
      accessor: (item) => (
        <div>
          {item.equipment ? (
            <>
              <div className="font-medium text-app-text text-xs flex items-center space-x-1">
                <Scale className="w-3 h-3 text-pesage-blue" />
                <span>{item.equipment.designation}</span>
              </div>
              <div className="text-[11px] text-app-text-muted">
                {EQUIPMENT_TYPE_LABELS[item.equipment.equipment_type] || item.equipment.equipment_type}
                {item.equipment.serial_number ? ` • N° ${item.equipment.serial_number}` : ''}
              </div>
            </>
          ) : (
            <span className="text-xs text-app-text-muted italic">Non spécifié</span>
          )}
        </div>
      ),
    },
    {
      header: 'Type & Priorité',
      accessor: (item) => (
        <div className="space-y-1">
          <span className="inline-block px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            {INTERVENTION_TYPE_LABELS[item.intervention_type] || item.intervention_type}
          </span>
          <div>
            {item.priority === InterventionPriority.CRITICAL && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-600 border border-rose-500/20">Critique</span>
            )}
            {item.priority === InterventionPriority.HIGH && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-500/10 text-amber-600 border border-amber-500/20">Urgente</span>
            )}
            {item.priority === InterventionPriority.NORMAL && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-500/10 text-slate-600 dark:text-slate-400">Normale</span>
            )}
            {item.priority === InterventionPriority.LOW && (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-normal bg-slate-500/10 text-slate-500">Faible</span>
            )}
          </div>
        </div>
      ),
    },
    {
      header: 'Technicien',
      accessor: (item) => (
        <div className="text-xs">
          {item.technician ? (
            <div className="flex items-center space-x-1.5 font-medium text-app-text">
              <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>{item.technician.first_name} {item.technician.last_name}</span>
            </div>
          ) : (
            <span className="text-app-text-muted italic">Non affecté</span>
          )}
        </div>
      ),
    },
    {
      header: 'Statut',
      accessor: (item) => {
        const statusConfigs: Record<InterventionStatus, { label: string; bg: string; text: string; border: string }> = {
          [InterventionStatus.SCHEDULED]: { label: 'Planifiée', bg: 'bg-indigo-500/10', text: 'text-indigo-600 dark:text-indigo-400', border: 'border-indigo-500/20' },
          [InterventionStatus.PENDING]: { label: 'En attente', bg: 'bg-amber-500/10', text: 'text-amber-600 dark:text-amber-400', border: 'border-amber-500/20' },
          [InterventionStatus.IN_PROGRESS]: { label: 'En cours', bg: 'bg-pesage-orange/10', text: 'text-pesage-orange', border: 'border-pesage-orange/30' },
          [InterventionStatus.COMPLETED]: { label: 'Terminée', bg: 'bg-emerald-500/10', text: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-500/20' },
          [InterventionStatus.CANCELLED]: { label: 'Annulée', bg: 'bg-rose-500/10', text: 'text-rose-600 dark:text-rose-400', border: 'border-rose-500/20' },
        };
        const conf = statusConfigs[item.status] || { label: item.status, bg: 'bg-slate-100', text: 'text-slate-600', border: 'border-slate-200' };
        return (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${conf.bg} ${conf.text} ${conf.border}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      header: 'Coût Total',
      accessor: (item) => (
        <div className="font-bold text-app-text text-right">
          {formatCurrency(item.total_cost || 0)}
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <div className="flex items-center justify-end space-x-1">
          <button
            onClick={() => handleOpenReport(item)}
            title="Voir & Imprimer Rapport Technique"
            className="p-1.5 rounded-lg text-pesage-blue hover:bg-pesage-blue/10 transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEditIntervention(item)}
            title="Modifier l'intervention"
            className="p-1.5 rounded-lg text-app-text-muted hover:text-pesage-orange hover:bg-app-surface-hover transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {item.status !== InterventionStatus.COMPLETED && (
            <button
              onClick={() => handleQuickStatusChange(item, InterventionStatus.COMPLETED)}
              title="Marquer comme Terminée"
              className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => handleDeleteIntervention(item)}
            title="Supprimer"
            className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  const equipmentColumns: Column<Equipment>[] = [
    {
      header: 'Code / Matériel',
      accessor: (item) => (
        <div>
          <div className="font-bold text-app-text flex items-center space-x-1.5">
            <Scale className="w-3.5 h-3.5 text-pesage-blue" />
            <span>{item.equipment_code}</span>
          </div>
          <div className="text-xs font-medium text-app-text mt-0.5">{item.designation}</div>
        </div>
      ),
    },
    {
      header: 'Type d’Équipement',
      accessor: (item) => (
        <div>
          <span className="font-medium text-xs text-app-text">
            {EQUIPMENT_TYPE_LABELS[item.equipment_type] || item.equipment_type}
          </span>
          <div className="text-[11px] text-app-text-muted">
            {item.brand ? item.brand : ''} {item.model ? `• ${item.model}` : ''}
          </div>
        </div>
      ),
    },
    {
      header: 'Client & Emplacement',
      accessor: (item) => (
        <div>
          <div className="font-semibold text-app-text text-xs">
            {item.customer?.legal_name || item.customer?.trade_name || item.customer?.company_name || `Client #${item.customer_id}`}
          </div>
          <div className="text-[11px] text-app-text-muted">
            {item.site_name ? `${item.site_name}, ` : ''}{item.city || 'Maroc'}
          </div>
        </div>
      ),
    },
    {
      header: 'Caractéristiques Métrologiques',
      accessor: (item) => (
        <div className="text-xs text-app-text-secondary space-y-0.5">
          <div>
            <span className="text-app-text-muted">Max: </span>
            <span className="font-semibold text-app-text">
              {item.capacity_max ? `${item.capacity_max >= 1000 ? `${item.capacity_max / 1000} T` : `${item.capacity_max} kg`}` : '-'}
            </span>
          </div>
          <div className="text-[11px]">
            <span className="text-app-text-muted">Échelon (e): </span>
            <span>{item.graduation ? `${item.graduation} kg` : '-'}</span>
            {item.serial_number ? <span className="ml-1 text-app-text-muted">• SN: {item.serial_number}</span> : null}
          </div>
        </div>
      ),
    },
    {
      header: 'Statut',
      accessor: (item) => {
        const configs: Record<EquipmentStatus, { label: string; bg: string }> = {
          [EquipmentStatus.OPERATIONAL]: { label: 'En service', bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' },
          [EquipmentStatus.UNDER_MAINTENANCE]: { label: 'En révision', bg: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
          [EquipmentStatus.OUT_OF_SERVICE]: { label: 'Hors service', bg: 'bg-rose-500/10 text-rose-600 border-rose-500/20' },
          [EquipmentStatus.DECOMMISSIONED]: { label: 'Réformé', bg: 'bg-slate-500/10 text-slate-600 border-slate-500/20' },
        };
        const c = configs[item.status] || { label: item.status, bg: 'bg-slate-100 text-slate-600 border-slate-200' };
        return (
          <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold border ${c.bg}`}>
            {c.label}
          </span>
        );
      },
    },
    {
      header: 'Interventions',
      accessor: (item) => (
        <div className="text-xs font-medium text-app-text flex items-center space-x-1">
          <History className="w-3.5 h-3.5 text-pesage-orange" />
          <span>{item.interventions_count || 0} fiches</span>
        </div>
      ),
    },
    {
      header: 'Actions',
      accessor: (item) => (
        <div className="flex items-center justify-end space-x-1">
          <button
            onClick={() => handleViewEquipmentHistory(item)}
            title="Historique des interventions"
            className="p-1.5 rounded-lg text-pesage-blue hover:bg-pesage-blue/10 transition-colors cursor-pointer"
          >
            <History className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenNewIntervention(item)}
            title="Créer une intervention sur cet équipement"
            className="p-1.5 rounded-lg text-emerald-600 hover:bg-emerald-500/10 transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleEditEquipment(item)}
            title="Modifier l'équipement"
            className="p-1.5 rounded-lg text-app-text-muted hover:text-pesage-orange hover:bg-app-surface-hover transition-colors cursor-pointer"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleDeleteEquipment(item)}
            title="Supprimer"
            className="p-1.5 rounded-lg text-app-text-muted hover:text-rose-600 hover:bg-rose-500/10 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. Header with Actions */}
      <PageHeader
        title="Interventions & Maintenance Pesage"
        description="Gestion du parc d'équipements installés, étalonnages, maintenance préventive/corrective et rapports d'intervention."
        actions={
          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleOpenNewEquipment()}
              className="px-3.5 py-2 rounded-xl bg-app-surface hover:bg-app-surface-hover text-app-text text-xs font-semibold border border-app-border transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Scale className="w-4 h-4 text-pesage-blue" />
              <span>+ Nouvel Équipement</span>
            </button>
            <button
              onClick={() => handleOpenNewIntervention()}
              className="px-4 py-2 rounded-xl bg-pesage-orange hover:bg-pesage-orange/90 text-white text-xs font-semibold shadow-xs transition-all flex items-center space-x-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nouvelle Intervention</span>
            </button>
          </div>
        }
      />

      {/* 2. Real Business KPI Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-app-text-muted uppercase">Ce Mois</span>
            <Calendar className="w-4 h-4 text-pesage-blue" />
          </div>
          <div className="text-xl font-black text-app-text mt-1">{stats?.interventions_month ?? 0}</div>
          <div className="text-[10px] text-app-text-muted mt-0.5">Interventions du mois</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 uppercase">En Cours</span>
            <Clock className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-xl font-black text-app-text mt-1">{stats?.in_progress_count ?? 0}</div>
          <div className="text-[10px] text-app-text-muted mt-0.5">Opérations actives</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase">Terminées</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-xl font-black text-app-text mt-1">{stats?.completed_count ?? 0}</div>
          <div className="text-[10px] text-app-text-muted mt-0.5">Clôturées & signées</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase">Urgentes</span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-xl font-black text-app-text mt-1">{stats?.urgent_count ?? 0}</div>
          <div className="text-[10px] text-app-text-muted mt-0.5">Dépannages critiques</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-app-text-muted uppercase">Parc Équipements</span>
            <Scale className="w-4 h-4 text-pesage-orange" />
          </div>
          <div className="text-xl font-black text-app-text mt-1">{stats?.equipment_count ?? 0}</div>
          <div className="text-[10px] text-app-text-muted mt-0.5">Matériels suivis</div>
        </div>

        <div className="p-3.5 rounded-2xl bg-app-surface border border-app-border shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold text-pesage-blue dark:text-blue-400 uppercase">Coût Annuel</span>
            <DollarSign className="w-4 h-4 text-pesage-blue" />
          </div>
          <div className="text-lg font-black text-pesage-blue dark:text-blue-400 mt-1 truncate">
            {formatCurrency(stats?.annual_cost ?? 0)}
          </div>
          <div className="text-[10px] text-app-text-muted mt-0.5">Total prestations {selectedYear}</div>
        </div>
      </div>

      {/* 3. Navigation Tabs */}
      <div className="flex items-center border-b border-app-border space-x-6">
        <button
          onClick={() => setActiveTab('interventions')}
          className={`pb-3 text-xs font-semibold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'interventions'
              ? 'border-pesage-orange text-pesage-orange'
              : 'border-transparent text-app-text-secondary hover:text-app-text'
          }`}
        >
          <Wrench className="w-4 h-4" />
          <span>Fiches d'Intervention ({interventions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('equipments')}
          className={`pb-3 text-xs font-semibold transition-all border-b-2 cursor-pointer flex items-center space-x-2 ${
            activeTab === 'equipments'
              ? 'border-pesage-orange text-pesage-orange'
              : 'border-transparent text-app-text-secondary hover:text-app-text'
          }`}
        >
          <Scale className="w-4 h-4" />
          <span>Parc Matériel & Équipements Clients ({equipments.length})</span>
        </button>
      </div>

      {/* 4. Filters Bar */}
      <div className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Search Input */}
          <div className="w-full sm:w-72">
            <SearchBar
              value={searchTerm}
              onChange={setSearchTerm}
              placeholder="Rechercher code, client, site, matériel..."
            />
          </div>

          {/* Period & Filter Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Year Selector */}
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 rounded-xl bg-app-surface-subtle border border-app-border text-app-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-pesage-blue"
            >
              {[2024, 2025, 2026, 2027].map((y) => (
                <option key={y} value={y}>
                  Année {y}
                </option>
              ))}
            </select>

            {/* Month Selector */}
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-app-surface-subtle border border-app-border text-app-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-pesage-blue"
            >
              <option value="ALL">Tous les mois</option>
              {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                <option key={m} value={m.toString()}>
                  {new Date(2026, m - 1, 1).toLocaleString('fr-FR', { month: 'long' })}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            {activeTab === 'interventions' && (
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-app-surface-subtle border border-app-border text-app-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-pesage-blue"
              >
                <option value="ALL">Tous les statuts</option>
                <option value="SCHEDULED">Planifiée</option>
                <option value="PENDING">En attente</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="COMPLETED">Terminée</option>
                <option value="CANCELLED">Annulée</option>
              </select>
            )}

            {/* Type Filter */}
            {activeTab === 'interventions' && (
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="px-3 py-1.5 rounded-xl bg-app-surface-subtle border border-app-border text-app-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-pesage-blue"
              >
                <option value="ALL">Tous les types</option>
                {Object.entries(INTERVENTION_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            )}

            {/* Customer Filter */}
            <select
              value={selectedCustomerId}
              onChange={(e) => setSelectedCustomerId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-app-surface-subtle border border-app-border text-app-text text-xs font-medium focus:outline-none focus:ring-1 focus:ring-pesage-blue max-w-[180px]"
            >
              <option value="ALL">Tous les clients</option>
              {partners.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.legal_name || p.trade_name || `Client #${p.id}`}
                </option>
              ))}
            </select>

            <button
              onClick={() => fetchData()}
              title="Actualiser"
              className="p-1.5 rounded-xl bg-app-surface-subtle hover:bg-app-surface-hover border border-app-border text-app-text-muted hover:text-app-text transition-colors cursor-pointer"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Main Content View */}
      {activeTab === 'interventions' ? (
        <DataTable<Intervention>
          columns={interventionColumns}
          data={interventions}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyTitle="Aucune intervention trouvée"
          emptyDescription="Aucune intervention ne correspond aux critères de recherche ou filtres sélectionnés."
        />
      ) : (
        <DataTable<Equipment>
          columns={equipmentColumns}
          data={equipments}
          keyExtractor={(item) => item.id}
          isLoading={isLoading}
          emptyTitle="Aucun équipement trouvé"
          emptyDescription="Aucun matériel client enregistré dans le parc pour l'instant."
        />
      )}

      {/* ==================================================== */}
      {/* MODAL: NOUVELLE / ÉDITION INTERVENTION               */}
      {/* ==================================================== */}
      <Modal
        isOpen={isInterventionModalOpen}
        onClose={() => setIsInterventionModalOpen(false)}
        title={selectedIntervention ? `Modifier Intervention ${selectedIntervention.intervention_code}` : "Nouvelle Fiche d'Intervention & Maintenance"}
        maxWidth="4xl"
      >
        <form onSubmit={handleSaveIntervention} className="space-y-5">
          {/* Header Row: Client, Equipment, Site */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Client *" required>
              <select
                value={interventionForm.customer_id}
                onChange={(e) => setInterventionForm({ ...interventionForm, customer_id: Number(e.target.value), equipment_id: null })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
                required
              >
                <option value="">
                  {partners.length === 0 ? 'Aucun client disponible' : 'Sélectionner un client'}
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.legal_name || p.trade_name} ({p.code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Équipement Pesage Installé">
              <select
                value={interventionForm.equipment_id || ''}
                onChange={(e) => {
                  const eqId = e.target.value ? Number(e.target.value) : null;
                  const eq = equipments.find((x) => x.id === eqId);
                  setInterventionForm({
                    ...interventionForm,
                    equipment_id: eqId,
                    site: eq?.site_name || eq?.city || interventionForm.site,
                  });
                }}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              >
                <option value="">Sélectionner l'équipement client</option>
                {customerEquipments.map((eq) => (
                  <option key={eq.id} value={eq.id}>
                    {eq.equipment_code} - {eq.designation} ({EQUIPMENT_TYPE_LABELS[eq.equipment_type]})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Site / Lieu d'intervention">
              <input
                type="text"
                value={interventionForm.site || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, site: e.target.value })}
                placeholder="Ex: Usine Ain Sebaa - Fosse Pont 1"
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              />
            </FormField>
          </div>

          {/* Row 2: Type, Priority, Status, Technician */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <FormField label="Type d'opération *">
              <select
                value={interventionForm.intervention_type}
                onChange={(e) => setInterventionForm({ ...interventionForm, intervention_type: e.target.value as InterventionType })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange font-medium"
              >
                {Object.entries(INTERVENTION_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Priorité">
              <select
                value={interventionForm.priority}
                onChange={(e) => setInterventionForm({ ...interventionForm, priority: e.target.value as InterventionPriority })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              >
                <option value="LOW">Faible</option>
                <option value="NORMAL">Normale</option>
                <option value="HIGH">Urgente</option>
                <option value="CRITICAL">Critique</option>
              </select>
            </FormField>

            <FormField label="Statut">
              <select
                value={interventionForm.status}
                onChange={(e) => setInterventionForm({ ...interventionForm, status: e.target.value as InterventionStatus })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange font-bold text-pesage-orange"
              >
                <option value="SCHEDULED">Planifiée</option>
                <option value="PENDING">En attente</option>
                <option value="IN_PROGRESS">En cours</option>
                <option value="COMPLETED">Terminée</option>
                <option value="CANCELLED">Annulée</option>
              </select>
            </FormField>

            <FormField label="Technicien Responsable">
              <div className="flex space-x-1.5">
                <select
                  value={interventionForm.assigned_technician_id || ''}
                  onChange={(e) => setInterventionForm({ ...interventionForm, assigned_technician_id: e.target.value ? Number(e.target.value) : null })}
                  className="flex-1 px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
                >
                  <option value="">Sélectionner technicien</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.first_name} {emp.last_name} ({emp.job_title || 'Personnel'})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsQuickTechModalOpen(true)}
                  title="Ajouter un technicien dans Personnel"
                  className="px-2 py-2 rounded-xl bg-app-surface-subtle hover:bg-pesage-blue hover:text-white border border-app-border text-app-text text-xs transition-colors cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </FormField>
          </div>

          {/* Row 3: Dates */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Date & Heure Début *">
              <input
                type="datetime-local"
                value={interventionForm.date_start || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, date_start: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
                required
              />
            </FormField>

            <FormField label="Date & Heure Fin">
              <input
                type="datetime-local"
                value={interventionForm.date_end || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, date_end: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              />
            </FormField>

            <FormField label="Prochaine Maintenance / Étalonnage">
              <input
                type="date"
                value={interventionForm.next_maintenance_date || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, next_maintenance_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              />
            </FormField>
          </div>

          {/* Technical Diagnostics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Problème signalé / Demande client">
              <textarea
                rows={2}
                value={interventionForm.problem_description || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, problem_description: e.target.value })}
                placeholder="Ex: Dérive de pesée sur le coin nord-est du pont-bascule, message d'erreur indicateur..."
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              />
            </FormField>

            <FormField label="Diagnostic technique & Constats">
              <textarea
                rows={2}
                value={interventionForm.diagnosis || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, diagnosis: e.target.value })}
                placeholder="Ex: Humidité détectée dans la boîte de dérivation, câble du capteur 3 écrasé..."
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              />
            </FormField>
          </div>

          {/* SECTION: TRAVAUX EFFECTUÉS / TÂCHES (Checklist) */}
          <div className="p-3.5 rounded-2xl bg-app-surface-subtle border border-app-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <CheckSquare className="w-4 h-4 text-pesage-blue" />
                <span className="text-xs font-bold text-app-text uppercase tracking-wider">
                  Travaux & Étape Techniques Réalisées
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const tasks = interventionForm.tasks || [];
                  setInterventionForm({
                    ...interventionForm,
                    tasks: [
                      ...tasks,
                      { description: '', status: TaskStatus.PENDING, order_index: tasks.length + 1 },
                    ],
                  });
                }}
                className="px-2.5 py-1 rounded-lg bg-pesage-blue text-white text-xs font-medium hover:bg-pesage-blue/90 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Ajouter tâche</span>
              </button>
            </div>

            <div className="space-y-2">
              {(interventionForm.tasks || []).map((t, idx) => (
                <div key={idx} className="flex items-center space-x-2 bg-app-surface p-2 rounded-xl border border-app-border">
                  <button
                    type="button"
                    onClick={() => {
                      const updated = [...(interventionForm.tasks || [])];
                      updated[idx].status =
                        updated[idx].status === TaskStatus.COMPLETED
                          ? TaskStatus.PENDING
                          : TaskStatus.COMPLETED;
                      setInterventionForm({ ...interventionForm, tasks: updated });
                    }}
                    className="text-app-text-muted hover:text-emerald-600 transition-colors cursor-pointer"
                  >
                    {t.status === TaskStatus.COMPLETED ? (
                      <CheckSquare className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="text"
                    value={t.description}
                    onChange={(e) => {
                      const updated = [...(interventionForm.tasks || [])];
                      updated[idx].description = e.target.value;
                      setInterventionForm({ ...interventionForm, tasks: updated });
                    }}
                    placeholder="Description de l'opération technique (ex: Réglage et étalonnage masses étalons)"
                    className="flex-1 px-2 py-1 text-xs bg-transparent border-none text-app-text focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const updated = (interventionForm.tasks || []).filter((_, i) => i !== idx);
                      setInterventionForm({ ...interventionForm, tasks: updated });
                    }}
                    className="text-app-text-muted hover:text-rose-600 p-1 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION: PIÈCES & CONSOMMABLES (Catalogue ERP) */}
          <div className="p-3.5 rounded-2xl bg-app-surface-subtle border border-app-border space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Package className="w-4 h-4 text-pesage-orange" />
                <span className="text-xs font-bold text-app-text uppercase tracking-wider">
                  Pièces Détachées & Consommables Utilisés
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  const parts = interventionForm.parts || [];
                  setInterventionForm({
                    ...interventionForm,
                    parts: [
                      ...parts,
                      { product_id: null, designation: '', quantity: 1, unit_price: 0, tax_rate: 20 },
                    ],
                  });
                }}
                className="px-2.5 py-1 rounded-lg bg-pesage-orange text-white text-xs font-medium hover:bg-pesage-orange/90 transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Ajouter pièce</span>
              </button>
            </div>

            <div className="space-y-2">
              {(interventionForm.parts || []).map((p, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 bg-app-surface p-2 rounded-xl border border-app-border items-center">
                  <div className="col-span-5">
                    <select
                      value={p.product_id || ''}
                      onChange={(e) => {
                        const prodId = e.target.value ? Number(e.target.value) : null;
                        const prod = products.find((x) => x.id === prodId);
                        const updated = [...(interventionForm.parts || [])];
                        updated[idx].product_id = prodId;
                        if (prod) {
                          updated[idx].designation = prod.designation;
                          updated[idx].unit_price = Number(prod.sale_price) || 0;
                        }
                        setInterventionForm({ ...interventionForm, parts: updated });
                      }}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-app-surface border border-app-border text-app-text"
                    >
                      <option value="">Sélectionner dans le catalogue</option>
                      {products.map((prod) => (
                        <option key={prod.id} value={prod.id}>
                          {prod.sku ? `[${prod.sku}] ` : ''}{prod.designation} ({formatCurrency(prod.sale_price || 0)})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-3">
                    <input
                      type="text"
                      value={p.designation}
                      onChange={(e) => {
                        const updated = [...(interventionForm.parts || [])];
                        updated[idx].designation = e.target.value;
                        setInterventionForm({ ...interventionForm, parts: updated });
                      }}
                      placeholder="Désignation de la pièce"
                      className="w-full px-2 py-1 text-xs rounded-lg bg-app-surface border border-app-border text-app-text"
                    />
                  </div>

                  <div className="col-span-1">
                    <input
                      type="number"
                      min="1"
                      value={p.quantity}
                      onChange={(e) => {
                        const updated = [...(interventionForm.parts || [])];
                        updated[idx].quantity = Number(e.target.value) || 1;
                        setInterventionForm({ ...interventionForm, parts: updated });
                      }}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-app-surface border border-app-border text-app-text text-center"
                    />
                  </div>

                  <div className="col-span-2">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={p.unit_price}
                      onChange={(e) => {
                        const updated = [...(interventionForm.parts || [])];
                        updated[idx].unit_price = Number(e.target.value) || 0;
                        setInterventionForm({ ...interventionForm, parts: updated });
                      }}
                      className="w-full px-2 py-1 text-xs rounded-lg bg-app-surface border border-app-border text-app-text text-right"
                    />
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (interventionForm.parts || []).filter((_, i) => i !== idx);
                        setInterventionForm({ ...interventionForm, parts: updated });
                      }}
                      className="text-app-text-muted hover:text-rose-600 p-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* SECTION: COÛTS DE L'INTERVENTION */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3.5 rounded-2xl bg-app-surface-subtle border border-app-border items-end">
            <FormField label="Main d'œuvre (DH)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={interventionForm.labor_cost || 0}
                onChange={(e) => setInterventionForm({ ...interventionForm, labor_cost: Number(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Pièces (Auto-calculé)">
              <div className="px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs font-semibold">
                {formatCurrency(computedPartsCost)}
              </div>
            </FormField>

            <FormField label="Déplacement (DH)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={interventionForm.travel_cost || 0}
                onChange={(e) => setInterventionForm({ ...interventionForm, travel_cost: Number(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Autres frais (DH)">
              <input
                type="number"
                min="0"
                step="0.01"
                value={interventionForm.other_cost || 0}
                onChange={(e) => setInterventionForm({ ...interventionForm, other_cost: Number(e.target.value) || 0 })}
                className="w-full px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <div>
              <div className="text-[11px] font-bold text-pesage-orange uppercase">TOTAL HT</div>
              <div className="text-base font-black text-pesage-blue dark:text-blue-400 mt-1">
                {formatCurrency(computedTotalCost)}
              </div>
            </div>
          </div>

          {/* Observations & Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Observations & Remarques métrologiques">
              <textarea
                rows={2}
                value={interventionForm.observations || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, observations: e.target.value })}
                placeholder="Ex: Écart maximal constaté inférieur à l'échelon toléré..."
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              />
            </FormField>

            <FormField label="Recommandations techniques">
              <textarea
                rows={2}
                value={interventionForm.recommendations || ''}
                onChange={(e) => setInterventionForm({ ...interventionForm, recommendations: e.target.value })}
                placeholder="Ex: Prévoir le remplacement du capteur C4 lors de la prochaine visite..."
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-orange"
              />
            </FormField>
          </div>

          {/* Modal Actions */}
          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsInterventionModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-app-surface hover:bg-app-surface-hover text-app-text text-xs font-semibold border border-app-border transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-pesage-orange hover:bg-pesage-orange/90 text-white text-xs font-semibold shadow-xs transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{selectedIntervention ? 'Mettre à jour' : 'Enregistrer Intervention'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: NOUVEL / ÉDITION ÉQUIPEMENT CLIENT            */}
      {/* ==================================================== */}
      <Modal
        isOpen={isEquipmentModalOpen}
        onClose={() => setIsEquipmentModalOpen(false)}
        title={selectedEquipment ? `Modifier Équipement ${selectedEquipment.equipment_code}` : 'Nouvel Équipement / Matériel Installé'}
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveEquipment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <FormField label="Client Propriétaire *" required>
              <select
                value={equipmentForm.customer_id}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, customer_id: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-blue"
                required
              >
                <option value="">
                  {partners.length === 0 ? 'Aucun client disponible' : 'Sélectionner le client propriétaire'}
                </option>
                {partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.legal_name || p.trade_name} ({p.code})
                  </option>
                ))}
              </select>
            </FormField>

            <FormField label="Type de matériel *" required>
              <select
                value={equipmentForm.equipment_type}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, equipment_type: e.target.value as EquipmentType })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-blue font-semibold"
                required
              >
                {Object.entries(EQUIPMENT_TYPE_LABELS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Désignation du matériel *" required>
            <input
              type="text"
              value={equipmentForm.designation || ''}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, designation: e.target.value })}
              placeholder="Ex: Pont-Bascule Métallique 60T (Fosse)"
              className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs focus:ring-1 focus:ring-pesage-blue"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Marque">
              <input
                type="text"
                value={equipmentForm.brand || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, brand: e.target.value })}
                placeholder="Ex: Pesage 2000 / Bilanciai"
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Modèle">
              <input
                type="text"
                value={equipmentForm.model || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, model: e.target.value })}
                placeholder="Ex: PB-60T-18M"
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Numéro de Série">
              <input
                type="text"
                value={equipmentForm.serial_number || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, serial_number: e.target.value })}
                placeholder="Ex: SN-2026-PB-088"
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <FormField label="Site d'implantation">
              <input
                type="text"
                value={equipmentForm.site_name || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, site_name: e.target.value })}
                placeholder="Ex: Usine Ain Sebaa - Entrée 1"
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Ville">
              <input
                type="text"
                value={equipmentForm.city || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, city: e.target.value })}
                placeholder="Ex: Casablanca"
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Date d'installation">
              <input
                type="date"
                value={equipmentForm.installation_date || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, installation_date: e.target.value })}
                className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>
          </div>

          {/* Metrological Specs */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-3 rounded-2xl bg-app-surface-subtle border border-app-border">
            <FormField label="Portée Max (kg)">
              <input
                type="number"
                value={equipmentForm.capacity_max || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, capacity_max: Number(e.target.value) || null })}
                placeholder="Ex: 60000"
                className="w-full px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Portée Min (kg)">
              <input
                type="number"
                value={equipmentForm.capacity_min || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, capacity_min: Number(e.target.value) || null })}
                placeholder="Ex: 400"
                className="w-full px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="Échelon e (kg)">
              <input
                type="number"
                step="0.001"
                value={equipmentForm.graduation || ''}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, graduation: Number(e.target.value) || null })}
                placeholder="Ex: 20"
                className="w-full px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              />
            </FormField>

            <FormField label="État de service">
              <select
                value={equipmentForm.status}
                onChange={(e) => setEquipmentForm({ ...equipmentForm, status: e.target.value as EquipmentStatus })}
                className="w-full px-3 py-1.5 rounded-xl bg-app-surface border border-app-border text-app-text text-xs font-semibold"
              >
                <option value="OPERATIONAL">En service</option>
                <option value="UNDER_MAINTENANCE">En maintenance</option>
                <option value="OUT_OF_SERVICE">Hors service</option>
                <option value="DECOMMISSIONED">Réformé</option>
              </select>
            </FormField>
          </div>

          <FormField label="Notes & Spécifications techniques">
            <textarea
              rows={2}
              value={equipmentForm.notes || ''}
              onChange={(e) => setEquipmentForm({ ...equipmentForm, notes: e.target.value })}
              placeholder="Contrat d'entretien, caractéristiques des capteurs, etc."
              className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
            />
          </FormField>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsEquipmentModalOpen(false)}
              className="px-4 py-2 rounded-xl bg-app-surface hover:bg-app-surface-hover text-app-text text-xs font-semibold border border-app-border transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue/90 text-white text-xs font-semibold shadow-xs transition-all flex items-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{selectedEquipment ? 'Mettre à jour' : 'Enregistrer Équipement'}</span>
            </button>
          </div>
        </form>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: HISTORIQUE DES INTERVENTIONS SUR ÉQUIPEMENT   */}
      {/* ==================================================== */}
      <Modal
        isOpen={isHistoryModalOpen}
        onClose={() => setIsHistoryModalOpen(false)}
        title={`Historique de Maintenance - ${selectedEquipment?.equipment_code || ''} (${selectedEquipment?.designation || ''})`}
        maxWidth="4xl"
      >
        <div className="space-y-4">
          {/* Header Card */}
          <div className="p-3.5 rounded-2xl bg-app-surface-subtle border border-app-border flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-app-text">
                {selectedEquipment?.customer?.legal_name || selectedEquipment?.customer?.trade_name || 'Client'}
              </div>
              <div className="text-[11px] text-app-text-muted">
                {selectedEquipment?.site_name ? `${selectedEquipment.site_name} • ` : ''}
                {selectedEquipment?.city} • SN: {selectedEquipment?.serial_number || 'N/A'}
              </div>
            </div>
            <button
              onClick={() => {
                setIsHistoryModalOpen(false);
                if (selectedEquipment) handleOpenNewIntervention(selectedEquipment);
              }}
              className="px-3 py-1.5 rounded-xl bg-pesage-orange text-white text-xs font-semibold shadow-xs flex items-center space-x-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Nouvelle Intervention</span>
            </button>
          </div>

          {/* Timeline List */}
          {equipmentHistory.length === 0 ? (
            <div className="text-center py-8 text-app-text-muted text-xs italic">
              Aucune intervention enregistrée pour cet équipement.
            </div>
          ) : (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
              {equipmentHistory.map((item) => (
                <div key={item.id} className="p-4 rounded-2xl bg-app-surface border border-app-border shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-xs text-pesage-orange">{item.intervention_code}</span>
                      <span className="text-xs text-app-text-muted">• {formatDate(item.date_start)}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/10 text-blue-600 border border-blue-500/20">
                        {INTERVENTION_TYPE_LABELS[item.intervention_type] || item.intervention_type}
                      </span>
                    </div>
                    <span className="text-xs font-black text-app-text">
                      {formatCurrency(item.total_cost || 0)}
                    </span>
                  </div>

                  {item.problem_description && (
                    <div className="text-xs text-app-text-secondary">
                      <span className="font-semibold text-app-text">Demande: </span>
                      {item.problem_description}
                    </div>
                  )}

                  {item.work_performed && (
                    <div className="text-xs text-app-text-secondary">
                      <span className="font-semibold text-app-text">Travaux: </span>
                      {item.work_performed}
                    </div>
                  )}

                  {item.tasks && item.tasks.length > 0 && (
                    <div className="pt-2 border-t border-app-border flex flex-wrap gap-1.5">
                      {item.tasks.map((t, idx) => (
                        <span key={idx} className="px-2 py-0.5 rounded-lg text-[10px] bg-app-surface-subtle text-app-text border border-app-border flex items-center space-x-1">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span>{t.description}</span>
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-app-text-muted pt-1">
                    <span>Technicien: {item.technician ? `${item.technician.first_name} ${item.technician.last_name}` : 'Non assigné'}</span>
                    <button
                      onClick={() => {
                        setIsHistoryModalOpen(false);
                        handleOpenReport(item);
                      }}
                      className="text-pesage-blue hover:underline font-semibold flex items-center space-x-1 cursor-pointer"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Voir Rapport</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* ==================================================== */}
      {/* MODAL: RAPPORT D'INTERVENTION PESAGE 2000 (PRINT)    */}
      {/* ==================================================== */}
      {selectedIntervention && (
        <DocumentPreviewModal
          isOpen={isReportModalOpen}
          onClose={() => setIsReportModalOpen(false)}
          title="Rapport Technique d'Intervention"
          documentRef={selectedIntervention.intervention_code}
        >
          <InterventionReportDocument intervention={selectedIntervention} />

          {/* Attachments Section (Certificats d'étalonnage, photos, rapports) */}
          <div className="print:hidden mt-8 pt-6 border-t border-slate-200">
            <AttachmentsSection
              entityType="intervention"
              entityId={selectedIntervention.id}
              title="Pièces Jointes & Certificats d'Étalonnage de l'Intervention"
            />
          </div>
        </DocumentPreviewModal>
      )}


      {/* ==================================================== */}
      {/* QUICK TECHNICIAN MODAL                               */}
      {/* ==================================================== */}
      <Modal
        isOpen={isQuickTechModalOpen}
        onClose={() => setIsQuickTechModalOpen(false)}
        title="Ajouter un Technicien Métrologue (Personnel)"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateQuickTech} className="space-y-3">
          <FormField label="Prénom *" required>
            <input
              type="text"
              value={techForm.first_name}
              onChange={(e) => setTechForm({ ...techForm, first_name: e.target.value })}
              placeholder="Ex: Omar"
              className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              required
            />
          </FormField>

          <FormField label="Nom *" required>
            <input
              type="text"
              value={techForm.last_name}
              onChange={(e) => setTechForm({ ...techForm, last_name: e.target.value })}
              placeholder="Ex: Bennani"
              className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
              required
            />
          </FormField>

          <FormField label="Téléphone">
            <input
              type="text"
              value={techForm.phone}
              onChange={(e) => setTechForm({ ...techForm, phone: e.target.value })}
              placeholder="Ex: +212 6 12 34 56 78"
              className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs"
            />
          </FormField>

          <FormField label="Poste / Fonction">
            <input
              type="text"
              value={techForm.position}
              onChange={(e) => setTechForm({ ...techForm, position: e.target.value })}
              className="w-full px-3 py-2 rounded-xl bg-app-surface border border-app-border text-app-text text-xs font-semibold"
            />
          </FormField>

          <div className="flex items-center justify-end space-x-2 pt-3 border-t border-app-border">
            <button
              type="button"
              onClick={() => setIsQuickTechModalOpen(false)}
              className="px-3 py-1.5 rounded-xl bg-app-surface text-app-text text-xs border border-app-border cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 rounded-xl bg-pesage-blue text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              Enregistrer
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
