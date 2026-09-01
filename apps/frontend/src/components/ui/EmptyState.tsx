import React from 'react';
import { Inbox } from 'lucide-react';

interface EmptyStateProps {
  title?: string;
  description?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'Aucune donnée disponible',
  description = 'Aucun élément ne correspond aux critères de recherche actuels.',
}) => {
  return (
    <div className="p-8 rounded-2xl bg-app-surface border border-app-border text-center space-y-3">
      <div className="w-12 h-12 rounded-2xl bg-pesage-blue/10 text-pesage-blue dark:text-pesage-blue-light border border-pesage-blue/20 flex items-center justify-center mx-auto">
        <Inbox className="w-6 h-6" />
      </div>
      <h4 className="text-sm font-bold text-app-text">{title}</h4>
      <p className="text-xs text-app-text-muted max-w-sm mx-auto">{description}</p>
    </div>
  );
};
