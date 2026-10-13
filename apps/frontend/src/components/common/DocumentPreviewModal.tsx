import React, { useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X, Download, FileText } from 'lucide-react';

interface DocumentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  documentRef?: string;
  children: React.ReactNode;
  extraActions?: React.ReactNode;
}

export const DocumentPreviewModal: React.FC<DocumentPreviewModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle = 'Format A4 portrait standard (210 × 297 mm)',
  documentRef,
  children,
  extraActions,
}) => {
  // Handle keyboard shortcuts (Escape = close, Ctrl/Cmd+P = print)
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P')) {
        e.preventDefault();
        window.print();
      }
    },
    [isOpen, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      document.body.classList.add('has-print-modal');
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);

      return () => {
        document.body.classList.remove('has-print-modal');
        document.body.style.overflow = prevOverflow;
        window.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className="document-preview-portal fixed inset-0 z-[9999] flex flex-col bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Pinned Top Navigation Toolbar (Strictly hidden in print) */}
      <header className="no-print print:hidden px-4 sm:px-6 py-3.5 bg-slate-900/95 border-b border-slate-800 text-white flex items-center justify-between shrink-0 shadow-lg z-20">
        <div className="flex items-center space-x-3 min-w-0">
          <div className="p-2 rounded-xl bg-pesage-blue/20 text-pesage-blue border border-pesage-blue/30 shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center space-x-2">
              <h2 className="text-sm sm:text-base font-bold text-white truncate">{title}</h2>
              {documentRef && (
                <span className="hidden sm:inline-block px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-800 text-blue-300 border border-slate-700">
                  {documentRef}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 truncate">{subtitle}</p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3 shrink-0">
          {extraActions}

          <button
            type="button"
            onClick={() => window.print()}
            className="px-4 py-2 rounded-xl bg-[#001BB7] hover:bg-[#001394] text-white font-semibold text-xs flex items-center space-x-2 shadow-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400"
            title="Imprimer ou enregistrer en PDF (Ctrl+P)"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Imprimer / Enregistrer PDF</span>
            <span className="sm:hidden">Imprimer</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700 cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-500"
            title="Fermer l'aperçu (Échap)"
          >
            <X className="w-4 h-4" />
            <span className="hidden sm:inline">Fermer</span>
          </button>
        </div>
      </header>

      {/* Scrollable Document Canvas Viewport */}
      <main
        className="flex-1 overflow-y-auto p-4 sm:p-8 md:p-12 flex justify-center items-start bg-slate-900/60 print:p-0 print:m-0 print:bg-white print:overflow-visible"
        onClick={(e) => {
          // If clicked directly on the canvas background, close preview
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
      >
        {/* A4 Paper Sheet (Centered, consistent proportions, legible font size) */}
        <div className="printable-document w-full max-w-[210mm] min-h-[297mm] bg-white text-slate-900 shadow-2xl rounded-sm p-8 sm:p-12 transition-all font-sans my-2 print:my-0 print:p-0 print:shadow-none print:w-full print:max-w-none print:min-h-0 print:rounded-none">
          {children}
        </div>
      </main>
    </div>
  );

  return typeof document !== 'undefined'
    ? createPortal(modalContent, document.body)
    : null;
};
