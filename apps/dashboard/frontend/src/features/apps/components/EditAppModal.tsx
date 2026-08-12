'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@alfheim/shared';
import { useUpdateUserLink, useDeleteUserLink } from '../queries';
import { AppItem } from '@/shared/types';

interface EditAppModalProps {
  app: AppItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appName: string) => void;
}

const PRESET_ICONS = [
  { name: 'link', label: 'Bookmark Link' },
  { name: 'folder', label: 'Folder / Storage' },
  { name: 'cloud', label: 'Cloud Drive' },
  { name: 'home', label: 'Home System' },
  { name: 'language', label: 'Web Portal' },
  { name: 'dashboard', label: 'Analytics' },
  { name: 'movie', label: 'Media Streaming' },
  { name: 'code', label: 'Developer Tool' },
  { name: 'terminal', label: 'Console Tool' },
  { name: 'psychology', label: 'AI Assistant' },
  { name: 'security', label: 'Vault Access' },
  { name: 'checklist', label: 'Task List' },
];

/**
 * Interactive Edit Tier 3 User Link Modal Component.
 * Enables editing or deleting an existing user custom link/bookmark.
 */
export function EditAppModal({
  app,
  isOpen,
  onClose,
  onSuccess,
}: EditAppModalProps) {
  const { t } = useTranslation();
  const updateLinkMutation = useUpdateUserLink();
  const deleteLinkMutation = useDeleteUserLink();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('link');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (app) {
      setTitle(app.title || app.name || '');
      setDescription(app.description || '');
      setUrl(app.url || app.app_url || '');
      setSelectedIcon(app.icon || app.icon_url || 'link');
      setErrorMessage(null);
      setConfirmDelete(false);
    }
  }, [app]);

  if (!isOpen || !app) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setErrorMessage('Title is required');
      return;
    }
    if (!trimmedUrl) {
      setErrorMessage('URL is required');
      return;
    }

    updateLinkMutation.mutate(
      {
        id: app.id,
        payload: {
          title: trimmedTitle,
          description: description.trim(),
          icon: selectedIcon,
          url: trimmedUrl,
        },
      },
      {
        onSuccess: (updatedItem) => {
          if (onSuccess) {
            onSuccess(updatedItem.title || updatedItem.name || trimmedTitle);
          }
          onClose();
        },
        onError: (err) => {
          setErrorMessage(err.message || 'Failed to update user link');
        },
      }
    );
  };

  const handleDelete = () => {
    deleteLinkMutation.mutate(app.id, {
      onSuccess: () => {
        if (onSuccess) {
          onSuccess(`Deleted link "${app.title || app.name}"`);
        }
        onClose();
      },
      onError: (err) => {
        setErrorMessage(err.message || 'Failed to delete user link');
      },
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">edit_square</span>
            <h2 className="text-base font-bold text-[var(--text-main)]">
              Edit Personal Link
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono">
            {errorMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              Link Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. My Google Drive"
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              required
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              Target URL *
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com"
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description..."
              rows={2}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              Icon
            </label>
            <div className="grid grid-cols-6 gap-2 max-h-28 overflow-y-auto p-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic.name}
                  type="button"
                  onClick={() => setSelectedIcon(ic.name)}
                  title={ic.label}
                  className={`p-2 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer ${
                    selectedIcon === ic.name
                      ? 'bg-[var(--primary-main)]/20 border border-[var(--primary-main)] text-[var(--primary-main)]'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-[var(--surface-elevated)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{ic.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-between">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-rose-400 font-mono">Delete link?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleteLinkMutation.isPending}
                  className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs cursor-pointer"
                >
                  Confirm
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDelete(false)}
                  className="px-2.5 py-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="px-3 py-1.5 rounded-lg bg-rose-950/40 border border-rose-800/40 text-rose-400 font-mono text-xs hover:bg-rose-900/40 cursor-pointer flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">delete</span>
                <span>Delete Link</span>
              </button>
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                {t('common.cancel')}
              </button>
              <button
                type="submit"
                disabled={updateLinkMutation.isPending}
                className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50 transition-all shadow-md"
              >
                {updateLinkMutation.isPending ? t('common.loading') : t('common.save_changes')}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
