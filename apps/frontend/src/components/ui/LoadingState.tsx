import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Chargement des données en cours...',
}) => {
  return (
    <div className="p-12 rounded-2xl bg-app-surface border border-app-border text-center space-y-3">
      <Loader2 className="w-8 h-8 animate-spin text-pesage-blue dark:text-pesage-blue-light mx-auto" />
      <p className="text-xs font-semibold text-app-text-muted">{message}</p>
    </div>
  );
};
