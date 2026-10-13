import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Loader2 } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  cancelText?: string;
  variant?: 'danger' | 'primary' | 'warning' | string;
  isLoading?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  confirmText,
  cancelLabel,
  cancelText,
  variant = 'danger',
  isLoading = false,
}) => {
  const finalConfirmLabel = confirmText || confirmLabel || 'Confirmer';
  const finalCancelLabel = cancelText || cancelLabel || 'Annuler';
  const isDanger = variant === 'danger';
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="btn-secondary px-4 py-2"
          >
            {finalCancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 ${isDanger ? 'btn-danger' : 'btn-primary'}`}
          >
            {isLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{finalConfirmLabel}</span>
          </button>
        </>
      }
    >
      <div className="flex items-start space-x-3 py-2">
        <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 border border-rose-500/20 shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <p className="text-xs text-app-text font-medium leading-relaxed">{message}</p>
      </div>
    </Modal>
  );
};
