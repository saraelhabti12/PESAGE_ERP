import React from 'react';
import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  icon?: LucideIcon;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  actions?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  description,
  icon: Icon,
  action,
  actions,
}) => {
  const ActionIcon = action?.icon;
  const displaySubtitle = subtitle || description;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-app-border">
      <div className="flex items-center space-x-3 min-w-0">
        {Icon && (
          <div className="p-3 rounded-2xl bg-pesage-blue/10 text-pesage-blue dark:text-pesage-blue-light border border-pesage-blue/20 shrink-0">
            <Icon className="w-6 h-6" />
          </div>
        )}
        <div className="min-w-0">
          <h1 className="text-xl font-extrabold text-app-text tracking-tight truncate">
            {title}
          </h1>
          {displaySubtitle && (
            <p className="text-xs text-app-text-muted mt-0.5 truncate">{displaySubtitle}</p>
          )}
        </div>
      </div>

      {actions ? (
        <div className="flex items-center space-x-2 shrink-0">{actions}</div>
      ) : action ? (
        <button
          onClick={action.onClick}
          className="inline-flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white text-xs font-bold transition-all shadow-md shadow-pesage-blue/20 shrink-0"
        >
          {ActionIcon && <ActionIcon className="w-4 h-4" />}
          <span>{action.label}</span>
        </button>
      ) : null}
    </div>
  );
};
