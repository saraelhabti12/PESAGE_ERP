import React, { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { useNotification } from '@/context/NotificationContext';
import { formatDate } from '@/lib/formatters';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  Paperclip,
  Upload,
  Download,
  Trash2,
  FileText,
  FileCheck,
  FileSpreadsheet,
  Image,
  Loader2,
  Plus,
  Tag,
  AlertCircle,
} from 'lucide-react';

export interface AttachmentItem {
  id: number;
  entity_type: string;
  entity_id: string | number;
  filename?: string;
  original_filename?: string;
  file_type?: string | null;
  content_type?: string | null;
  file_size?: number | null;
  category?: string | null;
  description?: string | null;
  created_at: string;
  uploaded_by?: {
    id?: number;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
  } | number | null;
  uploader_name?: string | null;
}

interface AttachmentsSectionProps {
  entityType: string;
  entityId: string | number;
  title?: string;
  subtitle?: string;
  canUpload?: boolean;
  canDelete?: boolean;
}

const CATEGORIES = [
  'Contrat',
  'Certificat d’étalonnage',
  'Rapport d’intervention',
  'Bon signé / BL',
  'Facture / Reçu',
  'Fiche technique',
  'Photo / Image',
  'Autre document',
];

export const AttachmentsSection: React.FC<AttachmentsSectionProps> = ({
  entityType,
  entityId,
  title = 'Pièces Jointes & Documents Numérisés',
  subtitle = 'Gestion centralisée des justificatifs et documents rattachés',
  canUpload = true,
  canDelete = true,
}) => {
  const { showSuccess, showError } = useNotification();
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingAttachment, setDeletingAttachment] = useState<AttachmentItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Form states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [category, setCategory] = useState<string>('Contrat');
  const [description, setDescription] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAttachments = useCallback(async () => {
    if (!entityId) return;
    setIsLoading(true);
    try {
      const res = await api.get<AttachmentItem[]>('/api/v1/attachments', {
        params: {
          entity_type: entityType,
          entity_id: String(entityId),
        },
      });
      setAttachments(Array.isArray(res.data) ? res.data : []);
    } catch (_err) {
      // Silently fail if table is empty or error
      setAttachments([]);
    } finally {
      setIsLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      showError('Veuillez sélectionner un fichier à téléverser.');
      return;
    }

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('entity_type', entityType);
      formData.append('entity_id', String(entityId));
      if (category) formData.append('category', category);
      if (description) formData.append('description', description);

      await api.post('/api/v1/attachments/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      showSuccess('Document téléversé avec succès.');
      setIsUploadModalOpen(false);
      setSelectedFile(null);
      setDescription('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchAttachments();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Erreur lors du téléversement du document.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownload = async (attachment: AttachmentItem) => {
    try {
      const res = await api.get(`/api/v1/attachments/${attachment.id}/download`, {
        responseType: 'blob',
      });
      const downloadName = attachment.filename || attachment.original_filename || 'document';
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (_err) {
      showError('Impossible de télécharger le fichier.');
    }
  };

  const handleDelete = async () => {
    if (!deletingAttachment) return;
    setIsDeleting(true);
    try {
      await api.delete(`/api/v1/attachments/${deletingAttachment.id}`);
      showSuccess('Document supprimé avec succès.');
      setDeletingAttachment(null);
      fetchAttachments();
    } catch (err: any) {
      showError(err.response?.data?.detail || 'Impossible de supprimer le document.');
    } finally {
      setIsDeleting(false);
    }
  };

  const formatFileSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return '—';
    if (bytes < 1024) return `${bytes} o`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
  };

  const getFileIcon = (filename?: string | null) => {
    if (!filename || typeof filename !== 'string') {
      return <FileCheck className="w-5 h-5 text-pesage-blue" />;
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'webp', 'svg'].includes(ext || '')) {
      return <Image className="w-5 h-5 text-indigo-500" />;
    }
    if (['pdf'].includes(ext || '')) {
      return <FileText className="w-5 h-5 text-rose-500" />;
    }
    if (['xls', 'xlsx', 'csv'].includes(ext || '')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600" />;
    }
    return <FileCheck className="w-5 h-5 text-pesage-blue" />;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-app-text-primary flex items-center gap-2">
            <Paperclip className="w-4 h-4 text-pesage-blue" />
            {title}
          </h3>
          <p className="text-xs text-app-text-muted">{subtitle}</p>
        </div>

        {canUpload && (
          <button
            type="button"
            onClick={() => setIsUploadModalOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-pesage-blue hover:bg-pesage-blue-dark text-white font-semibold text-xs shadow-sm transition-all"
          >
            <Plus className="w-4 h-4" />
            Ajouter une pièce jointe
          </button>
        )}
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="p-8 text-center bg-app-surface rounded-2xl border border-app-border text-xs text-app-text-muted">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-pesage-blue" />
          Chargement des pièces jointes...
        </div>
      ) : attachments.length === 0 ? (
        <div className="p-10 text-center bg-app-surface rounded-2xl border border-app-border space-y-2">
          <Paperclip className="w-8 h-8 text-slate-300 mx-auto" />
          <h4 className="text-xs font-semibold text-app-text-primary">Aucun document joint</h4>
          <p className="text-[11px] text-app-text-muted max-w-sm mx-auto">
            Vous pouvez rattacher des contrats, certificats d'étalonnage, photos ou bons signés à cette fiche.
          </p>
          {canUpload && (
            <button
              type="button"
              onClick={() => setIsUploadModalOpen(true)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-app-border hover:bg-app-surface-subtle text-xs font-medium text-pesage-blue transition"
            >
              <Upload className="w-3.5 h-3.5" />
              Téléverser un premier fichier
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-app-border bg-app-surface shadow-xs">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-app-text-muted border-b border-app-border">
              <tr>
                <th className="px-4 py-3 font-semibold">Document</th>
                <th className="px-4 py-3 font-semibold">Catégorie</th>
                <th className="px-4 py-3 font-semibold">Taille</th>
                <th className="px-4 py-3 font-semibold">Ajouté le</th>
                <th className="px-4 py-3 font-semibold">Par</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-app-border">
              {attachments.map((item) => {
                const displayName = item.filename || item.original_filename || 'Document';
                const uploaderDisplay =
                  item.uploader_name ||
                  (typeof item.uploaded_by === 'object' && item.uploaded_by
                    ? `${item.uploaded_by.first_name || ''} ${item.uploaded_by.last_name || ''}`.trim() || item.uploaded_by.email
                    : null) ||
                  'Système';

                return (
                  <tr key={item.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 shrink-0">
                          {getFileIcon(displayName)}
                        </div>
                        <div className="min-w-0">
                          <span className="font-semibold text-app-text-primary truncate block">
                            {displayName}
                          </span>
                          {item.description && (
                            <span className="text-[11px] text-app-text-muted truncate block">
                              {item.description}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-50 text-pesage-blue border border-blue-200">
                        <Tag className="w-2.5 h-2.5" />
                        {item.category || 'Document'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-app-text-muted font-mono">
                      {formatFileSize(item.file_size)}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted whitespace-nowrap">
                      {formatDate(item.created_at)}
                    </td>
                    <td className="px-4 py-3 text-app-text-muted">
                      {uploaderDisplay}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          className="p-1.5 text-pesage-blue hover:bg-blue-50 rounded-lg transition"
                          title="Télécharger"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeletingAttachment(item)}
                            className="p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg transition"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Upload */}
      <Modal
        isOpen={isUploadModalOpen}
        onClose={() => !isUploading && setIsUploadModalOpen(false)}
        title="Ajouter une pièce jointe"
        subtitle="Téléverser un document ou fichier lié"
        maxWidth="md"
      >
        <form onSubmit={handleUploadSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-app-text-primary block mb-1">
              Fichier *
            </label>
            <input
              ref={fileInputRef}
              type="file"
              required
              onChange={handleFileChange}
              className="w-full text-xs text-app-text-muted file:mr-3 file:py-2 file:px-3.5 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-pesage-blue/10 file:text-pesage-blue hover:file:bg-pesage-blue/20 cursor-pointer"
            />
            {selectedFile && (
              <p className="text-[11px] text-emerald-600 mt-1 font-medium">
                {selectedFile.name} ({formatFileSize(selectedFile.size)})
              </p>
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-app-text-primary block mb-1">
              Type / Catégorie de document
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-app-text-primary block mb-1">
              Description / Notes (optionnel)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="ex: Contrat signé révisé pour l'exercice 2026..."
              className="w-full px-3 py-2 rounded-xl border border-app-border bg-app-surface text-xs focus:ring-2 focus:ring-pesage-blue outline-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-app-border">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => setIsUploadModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-app-text-muted hover:bg-slate-100 rounded-xl transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isUploading || !selectedFile}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-pesage-blue hover:bg-pesage-blue-dark rounded-xl transition shadow-sm disabled:opacity-50"
            >
              {isUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
              Téléverser
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={!!deletingAttachment}
        title="Supprimer la pièce jointe"
        message={`Êtes-vous sûr de vouloir supprimer définitivement le document "${deletingAttachment?.filename || deletingAttachment?.original_filename || 'sélectionné'}" ?`}
        confirmLabel="Supprimer"
        isLoading={isDeleting}
        onConfirm={handleDelete}
        onClose={() => setDeletingAttachment(null)}
      />
    </div>
  );
};
