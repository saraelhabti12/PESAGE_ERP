import React, { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Permission } from '@/types/auth';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchBar } from '@/components/ui/SearchBar';
import { DataTable, Column } from '@/components/ui/DataTable';
import { useNotification } from '@/context/NotificationContext';
import { Key, Layers } from 'lucide-react';

export const PermissionsPage: React.FC = () => {
  const { showError } = useNotification();
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setIsLoading(true);
    api
      .get<Permission[]>('/api/v1/permissions')
      .then((res) => setPermissions(res.data))
      .catch((err) => showError(err.response?.data?.error?.message || 'Impossible de charger la liste des permissions.'))
      .finally(() => setIsLoading(false));
  }, [showError]);

  const filteredPermissions = permissions.filter((p) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      p.code.toLowerCase().includes(q) ||
      p.module.toLowerCase().includes(q) ||
      p.action.toLowerCase().includes(q) ||
      (p.description && p.description.toLowerCase().includes(q))
    );
  });

  const columns: Column<Permission>[] = [
    {
      header: 'Code de la permission',
      accessor: (p) => (
        <span className="font-mono text-brand-400 font-bold flex items-center space-x-1.5">
          <Key className="w-3.5 h-3.5 text-brand-500" />
          <span>{p.code}</span>
        </span>
      ),
      width: '220px',
    },
    {
      header: 'Module',
      accessor: (p) => (
        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
          <Layers className="w-3 h-3" />
          <span>{p.module}</span>
        </span>
      ),
      width: '140px',
    },
    {
      header: 'Action',
      accessor: (p) => <span className="font-mono text-cyan-400 text-xs">{p.action}</span>,
      width: '120px',
    },
    {
      header: 'Description',
      accessor: (p) => <span className="text-slate-400">{p.description || '-'}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Référentiel des permissions"
        subtitle="Catalogue exhaustif des autorisations granulaires du système ERP"
        icon={Key}
      />

      <SearchBar
        value={search}
        onChange={setSearch}
        placeholder="Filtrer les permissions par code, module ou action..."
      />

      <DataTable
        columns={columns}
        data={filteredPermissions}
        keyExtractor={(p) => p.id}
        isLoading={isLoading}
        emptyTitle="Aucune permission trouvée"
        emptyDescription="Aucune permission système ne correspond à vos critères de recherche."
      />
    </div>
  );
};
