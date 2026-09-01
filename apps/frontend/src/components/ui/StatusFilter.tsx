import React from 'react';
import { Filter } from 'lucide-react';

interface StatusFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export const StatusFilter: React.FC<StatusFilterProps> = ({ value, onChange }) => {
  return (
    <div className="relative">
      <Filter className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-app-text-muted pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="pl-9 pr-8 py-2 bg-app-surface text-app-text border border-app-border rounded-xl text-xs font-semibold focus:outline-none focus:border-pesage-blue transition-colors cursor-pointer shadow-xs appearance-none"
      >
        <option value="all">Tous les statuts</option>
        <option value="active">Actifs seulement</option>
        <option value="inactive">Inactifs seulement</option>
      </select>
    </div>
  );
};
