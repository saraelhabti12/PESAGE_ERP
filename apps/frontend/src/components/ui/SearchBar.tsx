import React from 'react';
import { Search } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  placeholder = 'Rechercher...',
}) => {
  return (
    <div className="relative flex-1 min-w-[240px]">
      <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-app-text-muted" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-2 bg-app-surface text-app-text placeholder:text-app-text-muted border border-app-border rounded-xl text-xs focus:outline-none focus:border-pesage-blue transition-colors shadow-xs"
      />
    </div>
  );
};
