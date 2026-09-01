import { WarehouseType } from '../types/warehouse';
import { StockMovementType, StockStatus, StockReservationStatus } from '../types/stock';
import { InventorySessionStatus } from '../types/inventory';

export const WAREHOUSE_TYPE_LABELS: Record<WarehouseType, { label: string; color: string }> = {
  MAIN: { label: 'Principal', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  WAREHOUSE: { label: 'Entrepôt', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  WORKSHOP: { label: 'Atelier', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  VEHICLE: { label: 'Véhicule Technique', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  OTHER: { label: 'Autre', color: 'bg-slate-50 text-slate-700 border-slate-200' },
};

export const STOCK_STATUS_LABELS: Record<StockStatus, { label: string; badgeClass: string }> = {
  OUT_OF_STOCK: {
    label: 'Rupture',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200 ring-1 ring-rose-600/10 font-semibold',
  },
  LOW: {
    label: 'Stock Faible',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 ring-1 ring-amber-600/10 font-semibold',
  },
  NORMAL: {
    label: 'Normal',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-600/10 font-semibold',
  },
  OVERSTOCK: {
    label: 'Surstock',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-1 ring-indigo-600/10 font-semibold',
  },
};

export const MOVEMENT_TYPE_CONFIG: Record<
  StockMovementType,
  { label: string; direction: '+' | '-'; badgeClass: string }
> = {
  PURCHASE_RECEIPT: {
    label: 'Réception Achat',
    direction: '+',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  SALE: {
    label: 'Vente / Sortie',
    direction: '-',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  RETURN_IN: {
    label: 'Retour Client',
    direction: '+',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  RETURN_OUT: {
    label: 'Retour Fournisseur',
    direction: '-',
    badgeClass: 'bg-orange-50 text-orange-700 border-orange-200',
  },
  ADJUSTMENT_IN: {
    label: 'Ajustement (+)',
    direction: '+',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  ADJUSTMENT_OUT: {
    label: 'Ajustement (-)',
    direction: '-',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
  TRANSFER_IN: {
    label: 'Transfert Entrant',
    direction: '+',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  TRANSFER_OUT: {
    label: 'Transfert Sortant',
    direction: '-',
    badgeClass: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  MANUAL_IN: {
    label: 'Entrée Manuelle',
    direction: '+',
    badgeClass: 'bg-green-50 text-green-700 border-green-200',
  },
  MANUAL_OUT: {
    label: 'Sortie Manuelle',
    direction: '-',
    badgeClass: 'bg-red-50 text-red-700 border-red-200',
  },
};

export const RESERVATION_STATUS_LABELS: Record<
  StockReservationStatus,
  { label: string; badgeClass: string }
> = {
  ACTIVE: {
    label: 'Active',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  RELEASED: {
    label: 'Libérée',
    badgeClass: 'bg-slate-50 text-slate-600 border-slate-200',
  },
  CONSUMED: {
    label: 'Consommée',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  CANCELLED: {
    label: 'Annulée',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};

export const INVENTORY_STATUS_LABELS: Record<
  InventorySessionStatus,
  { label: string; badgeClass: string }
> = {
  DRAFT: {
    label: 'Brouillon',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  IN_PROGRESS: {
    label: 'En Cours',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  COMPLETED: {
    label: 'Validé & Clôturé',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  CANCELLED: {
    label: 'Annulé',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
  },
};
