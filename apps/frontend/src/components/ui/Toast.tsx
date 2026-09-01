import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
}

interface ToastProps {
  toast: ToastMessage;
  onClose: (id: string) => void;
}

export const ToastItem: React.FC<ToastProps> = ({ toast, onClose }) => {
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div
      className={`flex items-start justify-between p-4 rounded-xl shadow-xl border backdrop-blur-md transition-all animate-in fade-in slide-in-from-top-2 duration-200 max-w-sm w-full ${
        isSuccess
          ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
          : isError
          ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
          : 'bg-slate-900/90 border-slate-700 text-slate-100'
      }`}
      role="alert"
    >
      <div className="flex items-start space-x-3">
        {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />}
        {isError && <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />}
        {!isSuccess && !isError && <Info className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />}
        <div className="space-y-0.5">
          {toast.title && <h4 className="font-semibold text-xs uppercase tracking-wider opacity-90">{toast.title}</h4>}
          <p className="text-xs leading-relaxed font-medium">{toast.message}</p>
        </div>
      </div>
      <button
        onClick={() => onClose(toast.id)}
        className="text-slate-400 hover:text-slate-200 p-1 rounded-lg transition-colors ml-2"
        aria-label="Fermer la notification"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
