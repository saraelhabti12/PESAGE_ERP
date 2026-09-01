import React from 'react';
import { EmptyState } from './EmptyState';
import { LoadingState } from './LoadingState';

export interface Column<T> {
  header: string;
  accessor: (item: T) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string | number;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  actions?: (item: T) => React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyTitle = 'Aucune donnée trouvée',
  emptyDescription = 'Aucun élément ne correspond aux critères de recherche.',
  actions,
}: DataTableProps<T>) {
  if (isLoading) {
    return <LoadingState message="Chargement des données en cours..." />;
  }

  if (!data || data.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <div className="w-full rounded-2xl bg-app-surface border border-app-border shadow-xs overflow-hidden">
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-app-border bg-app-surface-subtle text-app-text-muted font-bold uppercase tracking-wider text-[11px]">
              {columns.map((col, index) => (
                <th
                  key={index}
                  style={{ width: col.width }}
                  className={`py-3.5 px-4 ${
                    col.align === 'right'
                      ? 'text-right'
                      : col.align === 'center'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  {col.header}
                </th>
              ))}
              {actions && <th className="py-3.5 px-4 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-app-border text-app-text">
            {data.map((item) => (
              <tr
                key={keyExtractor(item)}
                className="hover:bg-app-surface-hover/80 transition-colors duration-150"
              >
                {columns.map((col, index) => (
                  <td
                    key={index}
                    className={`py-3.5 px-4 font-semibold ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    }`}
                  >
                    {col.accessor(item)}
                  </td>
                ))}
                {actions && (
                  <td className="py-3.5 px-4 text-right">{actions(item)}</td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
