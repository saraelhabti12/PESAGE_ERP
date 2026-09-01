import React from 'react';

interface FormFieldProps {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  required,
  children,
}) => {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-bold text-app-text">
        {label}
        {required && <span className="text-rose-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] font-medium text-rose-500">{error}</p>}
    </div>
  );
};
