import React from 'react';
import { LucideIcon, Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'success'
  | 'danger'
  | 'warning'
  | 'ghost'
  | 'outline';

export type ButtonSize = 'xs' | 'sm' | 'md' | 'lg';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  iconPosition?: 'left' | 'right';
  isLoading?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: 'bg-[#001BB7] hover:bg-[#001394] text-white shadow-sm shadow-[#001BB7]/25 dark:bg-blue-600 dark:hover:bg-blue-700 dark:text-white dark:shadow-blue-900/30 focus:ring-[#001BB7]',
  secondary: 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 shadow-xs focus:ring-slate-400',
  success: 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm focus:ring-emerald-500',
  danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm focus:ring-rose-500',
  warning: 'bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold shadow-sm focus:ring-amber-400',
  ghost: 'bg-transparent text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 focus:ring-slate-400',
  outline: 'bg-transparent border border-[#001BB7] dark:border-blue-500 text-[#001BB7] dark:text-blue-400 hover:bg-[#001BB7]/10 dark:hover:bg-blue-500/10 focus:ring-[#001BB7]',
};

const sizeClasses: Record<ButtonSize, string> = {
  xs: 'px-2.5 py-1 text-[11px] rounded-lg gap-1.5',
  sm: 'px-3 py-1.5 text-xs rounded-xl gap-2',
  md: 'px-4 py-2 text-xs font-semibold rounded-xl gap-2',
  lg: 'px-5 py-2.5 text-sm font-semibold rounded-xl gap-2.5',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      icon: Icon,
      iconPosition = 'left',
      isLoading = false,
      disabled = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const isActuallyDisabled = disabled || isLoading;

    return (
      <button
        ref={ref}
        disabled={isActuallyDisabled}
        className={`inline-flex items-center justify-center font-semibold transition-all select-none disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-offset-transparent ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
        ) : Icon && iconPosition === 'left' ? (
          <Icon className="w-4 h-4 shrink-0" />
        ) : null}

        {children && <span>{children}</span>}

        {!isLoading && Icon && iconPosition === 'right' && (
          <Icon className="w-4 h-4 shrink-0" />
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
