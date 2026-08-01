'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@loeger-os/shared';
import { useUpdateApp } from '../queries';
import { AppItem } from '@/shared/types';

interface EditAppModalProps {
  app: AppItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appName: string) => void;
}

const PRESET_ICONS = [
  { name: 'kitchen', label: 'Pantry' },
  { name: 'shopping_cart', label: 'Shopping' },
  { name: 'build', label: 'Tools' },
  { name: 'checklist', label: 'Tasks' },
  { name: 'home', label: 'Home Automation' },
  { name: 'movie', label: 'Media Stream' },
  { name: 'cloud', label: 'Storage' },
  { name: 'link', label: 'Portal Link' },
  { name: 'language', label: 'Web Service' },
  { name: 'search', label: 'Search Engine' },
  { name: 'dashboard', label: 'Analytics' },
  { name: 'security', label: 'IAM Access' },
];

/**
 * Interactive Edit App / Service Link Modal Component.
 * Enables editing an existing app catalog item's title, description, url, icon, is_external, and status.
 */
export function EditAppModal({
  app,
  isOpen,
  onClose,
  onSuccess,
}: EditAppModalProps) {
  const { t } = useTranslation();
  const updateAppMutation = useUpdateApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('grid_view');
  const [isExternal, setIsExternal] = useState(false);
  const [status, setStatus] = useState<'active' | 'in_progress' | 'maintenance'>('active');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (app) {
      setTitle(app.title || app.name || '');
      setDescription(app.description || '');
      setUrl(app.url || app.app_url || '');
      setSelectedIcon(app.icon || app.icon_url || 'grid_view');
      setIsExternal(Boolean(app.is_external || app.category === 'external'));
      setStatus((app.status as 'active' | 'in_progress' | 'maintenance') || 'active');
      setErrorMessage(null);
    }
  }, [app]);

  if (!isOpen || !app) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setErrorMessage(t('catalog.title_required_error'));
      return;
    }
    if (!trimmedUrl) {
      setErrorMessage(t('catalog.url_required_error'));
      return;
    }

    updateAppMutation.mutate(
      {
        id: app.id,
        payload: {
          title: trimmedTitle,
          description: description.trim(),
          icon: selectedIcon,
          url: trimmedUrl,
          is_external: isExternal,
          category: isExternal ? 'external' : 'internal',
          status,
        },
      },
      {
        onSuccess: (updatedApp) => {
          if (onSuccess) {
            onSuccess(updatedApp.title || updatedApp.name);
          }
          onClose();
        },
        onError: (err) => {
          setErrorMessage(err.message || t('catalog.update_failed_error'));
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[var(--primary-main)]">edit_square</span>
            <h2 className="text-base font-bold text-[var(--text-main)]">
              {t('catalog.edit_app_title')} ({app.title || app.name})
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors"
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
              {t('catalog.app_name')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Nextcloud Storage"
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              required
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              {t('catalog.description')}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief summary of service capabilities..."
              rows={2}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
            />
          </div>

          {/* URL */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              {t('catalog.app_url')}
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="e.g. /pantry or http://homeassistant.local"
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              required
            />
          </div>

          {/* Icon Picker */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              {t('catalog.icon')}
            </label>
            <div className="grid grid-cols-6 gap-2 max-h-28 overflow-y-auto p-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
              {PRESET_ICONS.map((ic) => (
                <button
                  key={ic.name}
                  type="button"
                  onClick={() => setSelectedIcon(ic.name)}
                  title={ic.label}
                  className={`p-2 rounded-lg flex flex-col items-center justify-center transition-all ${
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

          {/* Type & Status Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
                {t('catalog.category')}
              </label>
              <select
                value={isExternal ? 'external' : 'internal'}
                onChange={(e) => setIsExternal(e.target.value === 'external')}
                className="w-full px-3 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              >
                <option value="internal">{t('catalog.internal_category')}</option>
                <option value="external">{t('catalog.external_category')}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
                {t('catalog.status')}
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'active' | 'in_progress' | 'maintenance')}
                className="w-full px-3 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
              >
                <option value="active">{t('common.active')}</option>
                <option value="in_progress">{t('common.in_progress')}</option>
                <option value="maintenance">{t('common.maintenance')}</option>
              </select>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)]"
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={updateAppMutation.isPending}
              className="px-4 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] cursor-pointer disabled:opacity-50 transition-all shadow-md"
            >
              {updateAppMutation.isPending ? t('common.loading') : t('common.save_changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
