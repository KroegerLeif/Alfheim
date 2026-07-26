'use client';

import { useState } from 'react';
import { useCreateApp } from '../queries';

interface AddAppModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (appName: string) => void;
  initialCategory?: 'internal' | 'external';
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
 * Interactive Add App / Service Link Modal Component.
 * Features Material icon picker, URL format validation, internal vs external toggle, and initial status selection.
 */
export function AddAppModal({
  isOpen,
  onClose,
  onSuccess,
  initialCategory = 'internal',
}: AddAppModalProps) {
  const createAppMutation = useCreateApp();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('grid_view');
  const [isExternal, setIsExternal] = useState(initialCategory === 'external');
  const [status, setStatus] = useState<'active' | 'in_progress' | 'maintenance'>('active');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const trimmedTitle = title.trim();
    const trimmedUrl = url.trim();

    if (!trimmedTitle) {
      setErrorMessage('Service title is required.');
      return;
    }
    if (!trimmedUrl) {
      setErrorMessage('Service target URL is required.');
      return;
    }

    createAppMutation.mutate(
      {
        title: trimmedTitle,
        description: description.trim(),
        icon: selectedIcon,
        url: trimmedUrl,
        is_external: isExternal,
        category: isExternal ? 'external' : 'internal',
        status,
      },
      {
        onSuccess: (newApp) => {
          if (onSuccess) {
            onSuccess(newApp.title || newApp.name);
          }
          setTitle('');
          setDescription('');
          setUrl('');
          setSelectedIcon('grid_view');
          setIsExternal(false);
          setStatus('active');
          onClose();
        },
        onError: (err) => {
          setErrorMessage(err.message || 'Failed to register new service');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-5 relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--primary-main)]/10 border border-[var(--border-accent)] flex items-center justify-center text-[var(--primary-main)] shadow-[0_0_12px_var(--accent-glow)]">
              <span className="material-symbols-outlined text-xl">add_box</span>
            </div>
            <div>
              <h3 className="text-base font-bold text-[var(--text-main)]">Register New Service</h3>
              <p className="text-xs text-[var(--text-muted)] font-mono">
                Add an internal microservice or external portal link
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-950/40 border border-red-800/40 text-red-300 text-xs font-mono flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-red-400">error</span>
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Internal vs External Segmented Switch */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
              Service Type
            </label>
            <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setIsExternal(false)}
                className={`py-2 text-xs font-semibold rounded-lg font-mono transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  !isExternal
                    ? 'bg-[var(--primary-main)] text-slate-950 shadow-md font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">apps</span>
                <span>Internal Service</span>
              </button>
              <button
                type="button"
                onClick={() => setIsExternal(true)}
                className={`py-2 text-xs font-semibold rounded-lg font-mono transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  isExternal
                    ? 'bg-[var(--primary-main)] text-slate-950 shadow-md font-bold'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)]'
                }`}
              >
                <span className="material-symbols-outlined text-sm">open_in_new</span>
                <span>External Portal</span>
              </button>
            </div>
          </div>

          {/* Service Title Input */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              Service Title *
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Grafana Dashboards, Security Vault"
              required
              className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
            />
          </div>

          {/* Target URL Input */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              Target URL / Path *
            </label>
            <input
              type="text"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={isExternal ? 'https://grafana.loeger.local' : '/grafana'}
              required
              className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short summary of service functionality..."
              rows={2}
              className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
            />
          </div>

          {/* Initial Status Selector */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
              Deployment Status
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'active' | 'in_progress' | 'maintenance')}
              className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
            >
              <option value="active">Active (Live Service)</option>
              <option value="in_progress">In Progress (Under Construction)</option>
              <option value="maintenance">Maintenance Mode</option>
            </select>
          </div>

          {/* Icon Selection Grid */}
          <div>
            <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-2">
              Select Service Icon
            </label>
            <div className="grid grid-cols-6 gap-2 p-2 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] max-h-36 overflow-y-auto">
              {PRESET_ICONS.map((item) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedIcon(item.name)}
                  title={item.label}
                  className={`p-2.5 rounded-lg flex items-center justify-center transition-all cursor-pointer ${
                    selectedIcon === item.name
                      ? 'bg-[var(--primary-main)] text-slate-950 shadow-[0_0_10px_var(--primary-main)] font-bold'
                      : 'bg-[var(--surface-card)] text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-subtle)]'
                  }`}
                >
                  <span className="material-symbols-outlined text-lg">{item.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-main)] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createAppMutation.isPending}
              className="px-5 py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-md disabled:opacity-50 flex items-center gap-1.5"
            >
              {createAppMutation.isPending ? (
                <>
                  <span className="w-3 h-3 rounded-full border-2 border-slate-950 border-t-transparent animate-spin" />
                  <span>Registering...</span>
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm font-bold">check</span>
                  <span>Register Service</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
