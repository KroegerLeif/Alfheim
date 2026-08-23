'use client';

import { useTranslation } from '@alfheim/shared';

interface EditAppFormFieldsProps {
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

export function EditAppFormFields({
  title,
  setTitle,
  url,
  setUrl,
  description,
  setDescription,
  selectedIcon,
  setSelectedIcon,
  presetIcons,
}: EditAppFormFieldsProps) {
  const { t } = useTranslation();

  return (
    <>
      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
          {t('catalog.link_title_req')}
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('catalog.link_title_placeholder')}
          className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
          {t('catalog.target_url_req')}
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder={t('catalog.target_url_placeholder')}
          className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
          required
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
          {t('catalog.description')}
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('catalog.description_placeholder')}
          rows={2}
          className="w-full px-3.5 py-2 bg-[var(--surface-canvas)] border border-[var(--border-subtle)] rounded-lg text-xs text-[var(--text-main)] focus:outline-none focus:border-[var(--primary-main)]"
        />
      </div>

      <div>
        <label className="block text-xs font-mono uppercase text-[var(--text-muted)] mb-1.5">
          {t('catalog.select_icon')}
        </label>
        <div className="grid grid-cols-6 gap-2 max-h-28 overflow-y-auto p-2 rounded-lg bg-[var(--surface-canvas)] border border-[var(--border-subtle)]">
          {presetIcons.map((ic) => (
            <button
              key={ic.name}
              type="button"
              onClick={() => setSelectedIcon(ic.name)}
              title={t(`catalog.icons.${ic.name}`) || ic.label}
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
    </>
  );
}
