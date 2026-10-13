import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = '2xl',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl',
  }[maxWidth];

  const content = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/75 backdrop-blur-xs animate-in fade-in duration-200">

      {/* Backdrop Click Dismiss */}
      <div className="fixed inset-0" onClick={onClose} />

      {/* Modal Dialog Container */}
      <div
        className={`relative w-full ${maxWidthClasses} max-h-[90vh] flex flex-col rounded-2xl bg-app-surface text-app-text border border-app-border shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-150`}
      >
        {/* Pinned Header */}
        <div className="px-6 py-4 border-b border-app-border bg-app-surface-subtle flex items-center justify-between shrink-0">
          <div className="space-y-0.5 min-w-0 pr-4">
            <h3 className="text-base font-bold text-app-text truncate flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-pesage-orange shrink-0" />
              <span>{title}</span>
            </h3>
            {subtitle && (
              <p className="text-xs text-app-text-muted truncate">{subtitle}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-app-text-muted hover:text-app-text hover:bg-app-surface-hover transition-colors shrink-0"
            title="Fermer (Échap)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto flex-1 text-xs space-y-4">
          {children}
        </div>

        {/* Pinned Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-app-border bg-app-surface-subtle flex items-center justify-end space-x-3 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : null;
};

