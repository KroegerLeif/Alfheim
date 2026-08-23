'use client';

import { useState } from 'react';
import { useTranslation } from '@alfheim/shared';
import { useCreateUserLink } from '../queries';
import { AddAppFormFields } from './AddAppFormFields';

interface AddAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appName: string) => void;
  initialCategory?: string;
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

export function AddAppModal({
  isOpen,
  onClose,
  onSuccess,
  initialCategory = 'user',
}: AddAppModalProps) {
  const { t } = useTranslation();
  const createLinkMutation = useCreateUserLink();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('link');
  const [category] = useState(initialCategory);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setErrorMessage(t('catalog.title_required_error') || 'Title is required');
      return;
    }
    if (!trimmedUrl) {
      setErrorMessage(t('catalog.url_required_error') || 'URL is required');
      return;
    }

    createLinkMutation.mutate(
      {
        title: trimmedTitle,
        description: description.trim(),
        icon: selectedIcon,
        url: trimmedUrl,
        category: category.trim() || 'user',
      },
      {
        onSuccess: (newLink) => {
          if (onSuccess) {
            onSuccess(newLink.title || newLink.name || trimmedTitle);
          }
          setTitle('');
          setDescription('');
          setUrl('');
          setSelectedIcon('link');
          onClose();
        },
        onError: (err) => {
          setErrorMessage(err.message || t('catalog.register_failed_error') || 'Failed to save user link');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative">
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]">
              <span className="material-symbols-outlined text-xl">bookmark_add</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('catalog.add_user_link_title')}</h3>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                {t('catalog.add_user_link_desc')}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            aria-label={t('common.close')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-red-400">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <AddAppFormFields
            title={title}
            setTitle={setTitle}
            url={url}
            setUrl={setUrl}
            description={description}
            setDescription={setDescription}
            selectedIcon={selectedIcon}
            setSelectedIcon={setSelectedIcon}
            presetIcons={PRESET_ICONS}
          />

          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={createLinkMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {createLinkMutation.isPending ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  <span>{t('common.loading')}</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm font-bold">check</span>
                  <span>{t('catalog.save_bookmark')}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
