export interface SelectOption {
  value: string;
  label: string;
}

export const PAYMENT_METHODS: SelectOption[] = [
  { value: 'bank_transfer', label: 'Virement bancaire' },
  { value: 'check', label: 'Chèque' },
  { value: 'cash', label: 'Espèces' },
  { value: 'direct_debit', label: 'Prélèvement bancaire' },
  { value: 'card', label: 'Carte bancaire' },
  { value: 'other', label: 'Autre' },
];

export const PAYMENT_TERMS: SelectOption[] = [
  { value: 'Comptant', label: 'Comptant' },
  { value: '15 jours', label: '15 jours' },
  { value: '30 jours', label: '30 jours' },
  { value: '45 jours', label: '45 jours' },
  { value: '60 jours', label: '60 jours' },
  { value: 'Fin de mois', label: 'Fin de mois' },
  { value: '30 jours fin de mois', label: '30 jours fin de mois' },
];
