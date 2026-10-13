import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Calendar, X, ChevronDown, Clock, RotateCcw } from 'lucide-react';

export type PeriodPreset =
  | 'ALL'
  | 'TODAY'
  | 'THIS_WEEK'
  | 'THIS_MONTH'
  | 'THIS_QUARTER'
  | 'THIS_YEAR'
  | 'YEAR_MONTH'
  | 'CUSTOM';

export interface DatePeriodValue {
  preset: PeriodPreset;
  year?: number;
  month?: number; // 1-12 or undefined for whole year
  dateFrom?: string; // ISO string or YYYY-MM-DD
  dateTo?: string; // ISO string or YYYY-MM-DD
  label: string;
}

interface DatePeriodFilterProps {
  value?: DatePeriodValue;
  onChange: (value: DatePeriodValue) => void;
  onReset?: () => void;
  availableYears?: number[];
  className?: string;
  compact?: boolean;
}

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

export const DatePeriodFilter: React.FC<DatePeriodFilterProps> = ({
  value,
  onChange,
  onReset,
  availableYears = [2024, 2025, 2026, 2027],
  className = '',
  compact = false,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [mode, setMode] = useState<PeriodPreset>(value?.preset || 'ALL');
  const [selectedYear, setSelectedYear] = useState<number>(value?.year || currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number | undefined>(value?.month);
  const [customStart, setCustomStart] = useState<string>(value?.dateFrom ? value.dateFrom.substring(0, 10) : '');
  const [customEnd, setCustomEnd] = useState<string>(value?.dateTo ? value.dateTo.substring(0, 10) : '');
  const [isOpen, setIsOpen] = useState<boolean>(false);

  // Helper to format ISO date ranges
  const computePeriod = useCallback(
    (
      preset: PeriodPreset,
      yr: number,
      mo?: number,
      startStr?: string,
      endStr?: string
    ): DatePeriodValue => {
      const now = new Date();

      if (preset === 'ALL') {
        return {
          preset: 'ALL',
          label: 'Toutes les dates',
          dateFrom: undefined,
          dateTo: undefined,
        };
      }

      if (preset === 'TODAY') {
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const start = `${y}-${m}-${d}T00:00:00`;
        const end = `${y}-${m}-${d}T23:59:59`;
        return {
          preset: 'TODAY',
          dateFrom: start,
          dateTo: end,
          label: "Aujourd'hui",
        };
      }

      if (preset === 'THIS_WEEK') {
        const day = now.getDay();
        const diffToMonday = now.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(now);
        monday.setDate(diffToMonday);
        monday.setHours(0, 0, 0, 0);

        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const mY = monday.getFullYear();
        const mM = String(monday.getMonth() + 1).padStart(2, '0');
        const mD = String(monday.getDate()).padStart(2, '0');
        const sY = sunday.getFullYear();
        const sM = String(sunday.getMonth() + 1).padStart(2, '0');
        const sD = String(sunday.getDate()).padStart(2, '0');

        return {
          preset: 'THIS_WEEK',
          dateFrom: `${mY}-${mM}-${mD}T00:00:00`,
          dateTo: `${sY}-${sM}-${sD}T23:59:59`,
          label: 'Cette semaine',
        };
      }

      if (preset === 'THIS_MONTH') {
        const y = now.getFullYear();
        const m = now.getMonth() + 1;
        const lastDay = new Date(y, m, 0).getDate();
        const mm = String(m).padStart(2, '0');
        return {
          preset: 'THIS_MONTH',
          year: y,
          month: m,
          dateFrom: `${y}-${mm}-01T00:00:00`,
          dateTo: `${y}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59`,
          label: `Ce mois (${MONTH_NAMES[m - 1]} ${y})`,
        };
      }

      if (preset === 'THIS_QUARTER') {
        const y = now.getFullYear();
        const quarter = Math.floor(now.getMonth() / 3) + 1;
        const startMonth = (quarter - 1) * 3 + 1;
        const endMonth = quarter * 3;
        const lastDay = new Date(y, endMonth, 0).getDate();
        const smStr = String(startMonth).padStart(2, '0');
        const emStr = String(endMonth).padStart(2, '0');
        return {
          preset: 'THIS_QUARTER',
          year: y,
          dateFrom: `${y}-${smStr}-01T00:00:00`,
          dateTo: `${y}-${emStr}-${String(lastDay).padStart(2, '0')}T23:59:59`,
          label: `Trimestre T${quarter} ${y}`,
        };
      }

      if (preset === 'THIS_YEAR') {
        const y = now.getFullYear();
        return {
          preset: 'THIS_YEAR',
          year: y,
          dateFrom: `${y}-01-01T00:00:00`,
          dateTo: `${y}-12-31T23:59:59`,
          label: `Année ${y}`,
        };
      }

      if (preset === 'YEAR_MONTH') {
        if (mo && mo >= 1 && mo <= 12) {
          const lastDay = new Date(yr, mo, 0).getDate();
          const mm = String(mo).padStart(2, '0');
          return {
            preset: 'YEAR_MONTH',
            year: yr,
            month: mo,
            dateFrom: `${yr}-${mm}-01T00:00:00`,
            dateTo: `${yr}-${mm}-${String(lastDay).padStart(2, '0')}T23:59:59`,
            label: `${MONTH_NAMES[mo - 1]} ${yr}`,
          };
        } else {
          return {
            preset: 'YEAR_MONTH',
            year: yr,
            month: undefined,
            dateFrom: `${yr}-01-01T00:00:00`,
            dateTo: `${yr}-12-31T23:59:59`,
            label: `Toute l'année ${yr}`,
          };
        }
      }

      if (preset === 'CUSTOM') {
        if (!startStr && !endStr) {
          return {
            preset: 'CUSTOM',
            label: 'Période personnalisée',
            dateFrom: undefined,
            dateTo: undefined,
          };
        }
        const fromIso = startStr ? `${startStr}T00:00:00` : undefined;
        const toIso = endStr ? `${endStr}T23:59:59` : undefined;
        const startFormatted = startStr ? startStr.split('-').reverse().join('/') : '...';
        const endFormatted = endStr ? endStr.split('-').reverse().join('/') : '...';
        return {
          preset: 'CUSTOM',
          dateFrom: fromIso,
          dateTo: toIso,
          label: `Du ${startFormatted} au ${endFormatted}`,
        };
      }

      return {
        preset: 'ALL',
        label: 'Toutes les dates',
      };
    },
    []
  );

  const handlePresetSelect = (newPreset: PeriodPreset) => {
    setMode(newPreset);
    if (newPreset !== 'YEAR_MONTH' && newPreset !== 'CUSTOM') {
      const computed = computePeriod(newPreset, selectedYear);
      onChange(computed);
      setIsOpen(false);
    }
  };

  const handleYearChange = (yr: number) => {
    setSelectedYear(yr);
    setMode('YEAR_MONTH');
    const computed = computePeriod('YEAR_MONTH', yr, selectedMonth);
    onChange(computed);
  };

  const handleMonthChange = (mo?: number) => {
    setSelectedMonth(mo);
    setMode('YEAR_MONTH');
    const computed = computePeriod('YEAR_MONTH', selectedYear, mo);
    onChange(computed);
  };

  const handleApplyCustom = () => {
    setMode('CUSTOM');
    const computed = computePeriod('CUSTOM', selectedYear, undefined, customStart, customEnd);
    onChange(computed);
    setIsOpen(false);
  };

  const handleReset = () => {
    setMode('ALL');
    setSelectedYear(currentYear);
    setSelectedMonth(undefined);
    setCustomStart('');
    setCustomEnd('');
    const computed = computePeriod('ALL', currentYear);
    onChange(computed);
    if (onReset) onReset();
    setIsOpen(false);
  };

  const activeLabel = useMemo(() => {
    if (value?.label) return value.label;
    return computePeriod(mode, selectedYear, selectedMonth, customStart, customEnd).label;
  }, [value?.label, computePeriod, mode, selectedYear, selectedMonth, customStart, customEnd]);

  const isFiltered = mode !== 'ALL';

  return (
    <div className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`inline-flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-xl border transition-all shadow-xs ${
            isFiltered
              ? 'bg-pesage-blue-subtle text-pesage-blue border-pesage-blue/30 dark:bg-pesage-blue/20 dark:text-blue-200 dark:border-pesage-blue/50'
              : 'bg-app-surface text-app-text border-app-border hover:bg-app-surface-subtle'
          }`}
          title="Filtrer par période"
        >
          <Calendar className={`w-3.5 h-3.5 ${isFiltered ? 'text-pesage-blue dark:text-blue-300' : 'text-app-text-muted'}`} />
          <span className="truncate max-w-[160px]">{activeLabel}</span>
          <ChevronDown className="w-3.5 h-3.5 text-app-text-muted opacity-70" />
        </button>

        {isFiltered && (
          <button
            type="button"
            onClick={handleReset}
            className="p-2 text-app-text-muted hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 rounded-xl border border-app-border transition-colors shadow-xs"
            title="Réinitialiser la période"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute left-0 mt-2 w-80 sm:w-96 rounded-2xl bg-app-surface border border-app-border shadow-xl z-50 p-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-3 border-b border-app-border">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-pesage-blue" />
                <span className="text-xs font-bold text-app-text uppercase tracking-wider">
                  Filtrer par période
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg text-app-text-muted hover:bg-app-surface-subtle"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets Pills */}
            <div className="py-3">
              <span className="text-[11px] font-semibold text-app-text-muted block mb-2">
                Raccourcis rapides
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                {[
                  { key: 'ALL', label: 'Toutes dates' },
                  { key: 'TODAY', label: "Aujourd'hui" },
                  { key: 'THIS_WEEK', label: 'Cette semaine' },
                  { key: 'THIS_MONTH', label: 'Ce mois' },
                  { key: 'THIS_QUARTER', label: 'Ce trimestre' },
                  { key: 'THIS_YEAR', label: 'Cette année' },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handlePresetSelect(item.key as PeriodPreset)}
                    className={`px-2.5 py-1.5 text-xs font-semibold rounded-lg border text-left transition-all ${
                      mode === item.key
                        ? 'bg-pesage-blue text-white border-pesage-blue shadow-xs'
                        : 'bg-app-surface-subtle text-app-text border-app-border hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Specific Year & Month Filter */}
            <div className="py-3 border-t border-app-border">
              <span className="text-[11px] font-semibold text-app-text-muted block mb-2">
                Par Année & Mois
              </span>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <div>
                  <label className="text-[10px] text-app-text-muted uppercase font-bold block mb-1">
                    Année
                  </label>
                  <select
                    value={selectedYear}
                    onChange={(e) => handleYearChange(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-app-surface border border-app-border rounded-lg text-xs font-semibold text-app-text focus:outline-none focus:border-pesage-blue"
                  >
                    {availableYears.map((yr) => (
                      <option key={yr} value={yr}>
                        {yr}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-app-text-muted uppercase font-bold block mb-1">
                    Mois
                  </label>
                  <select
                    value={selectedMonth === undefined ? '' : selectedMonth}
                    onChange={(e) =>
                      handleMonthChange(e.target.value === '' ? undefined : Number(e.target.value))
                    }
                    className="w-full px-2.5 py-1.5 bg-app-surface border border-app-border rounded-lg text-xs font-semibold text-app-text focus:outline-none focus:border-pesage-blue"
                  >
                    <option value="">Toute l'année</option>
                    {MONTH_NAMES.map((name, idx) => (
                      <option key={idx + 1} value={idx + 1}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Custom Date Range */}
            <div className="py-3 border-t border-app-border">
              <span className="text-[11px] font-semibold text-app-text-muted block mb-2">
                Période personnalisée (du ... au ...)
              </span>
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div>
                  <label className="text-[10px] text-app-text-muted uppercase font-bold block mb-1">
                    Date début
                  </label>
                  <input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-app-surface border border-app-border rounded-lg text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-app-text-muted uppercase font-bold block mb-1">
                    Date fin
                  </label>
                  <input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-app-surface border border-app-border rounded-lg text-xs font-medium text-app-text focus:outline-none focus:border-pesage-blue"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 border-t border-app-border">
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-3 py-1.5 text-xs font-semibold text-app-text-muted hover:text-red-600 hover:bg-app-surface-subtle rounded-lg transition-colors"
                >
                  Réinitialiser
                </button>
                <button
                  type="button"
                  onClick={handleApplyCustom}
                  className="px-4 py-1.5 text-xs font-semibold bg-pesage-blue hover:bg-pesage-blue-dark text-white rounded-lg transition-all shadow-xs"
                >
                  Appliquer la période
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
