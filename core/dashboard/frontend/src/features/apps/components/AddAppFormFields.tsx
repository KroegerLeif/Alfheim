'use client';

import { useTranslation } from '@alfheim/shared';

interface AddAppFormFieldsProps {
  title: string;
  setTitle: (val: string) => void;
  url: string;
  setUrl: (val: string) => void;
  description: string;
  setDescription: (val: string) => void;
  selectedIcon: string;
  setSelectedIcon: (val: string) => void;
  presetIcons: { name: string; label: string }[];
}

export function AddAppFormFields({
  title,
  setTitle,
  url,
  setUrl,
  description,
  setDescription,
  selectedIcon,
  setSelectedIcon,
  presetIcons,
}: AddAppFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
          {t('catalog.link_title_req')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('catalog.link_title_placeholder')}
          required
          className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
          {t('catalog.target_url_req')}
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('catalog.target_url_placeholder')}
          required
          className="w-full px-3.5 py-2.5 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs font-mono text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1">
          {t('catalog.description_opt')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('catalog.description_placeholder')}
          rows={2}
          className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] placeholder-[var(--text-muted)] focus:outline-none focus:border-[var(--primary-main)] transition-colors"
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-2">
          {t('catalog.select_icon')}
        </label>
        <div className="grid grid-cols-6 gap-2 p-2 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] max-h-36 overflow-y-auto">
          {presetIcons.map((item) => (
            <button
              key={item.name}
              type="button"
              onClick={() => setSelectedIcon(item.name)}
              title={t(`catalog.icons.${item.name}`) || item.label}
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
    </>
  );
}
