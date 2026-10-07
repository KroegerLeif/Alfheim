'use client';

import { useTranslation } from '@/i18n';
import { Contact, ContactCategory } from '@/shared/types';

interface ContactCardItemProps {
  contact: Contact;
  category?: ContactCategory;
  isGuest: boolean;
  onEdit: (contact: Contact) => void;
  onDelete: (contactId: string) => void;
}

const iconAction =
  'p-2 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] hover:border-[var(--primary-main)]/50 text-[var(--text-main)] cursor-pointer inline-flex items-center';

/** One contact in the list view: avatar/icon, details and quick actions. */
export function ContactCardItem({ contact: c, category: cat, isGuest, onEdit, onDelete }: ContactCardItemProps) {
  const { t } = useTranslation();
  const links = c.links ?? [];
  const icon = c.icon || cat?.icon || 'person';
  const name = { name: c.name };

  return (
    <div className="p-3.5 rounded-xl bg-[var(--surface-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-accent)] transition-colors duration-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
      <div className="flex items-start gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-[var(--surface-canvas)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 overflow-hidden">
          {c.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={c.avatar_url}
              alt={c.name}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide a broken image instead of showing the browser's placeholder.
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
          ) : (
            <span className="material-symbols-outlined text-lg" aria-hidden="true" style={{ color: cat?.color || 'var(--text-muted)' }}>
              {icon}
            </span>
          )}
        </div>

        <div className="space-y-1.5 flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            <span className="font-semibold text-[var(--text-main)] text-sm truncate max-w-full" title={c.name}>{c.name}</span>
            {cat && (
              <span
                className="px-1.5 py-0.5 rounded text-[9px] font-mono font-bold uppercase border truncate max-w-[12rem]"
                title={cat.name}
                style={{ borderColor: `${cat.color}40`, backgroundColor: `${cat.color}10`, color: cat.color }}
              >
                {cat.name}
              </span>
            )}
          </div>
          {c.description && <p className="text-[var(--text-muted)] font-sans wrap-anywhere">{c.description}</p>}
          <div className="text-[10px] font-mono text-[var(--text-muted)] flex flex-wrap gap-x-3 gap-y-1 min-w-0">
            {c.phone && (
              <span className="flex items-center gap-0.5 min-w-0 wrap-anywhere">
                <span className="material-symbols-outlined text-xs" aria-hidden="true">phone</span>
                {c.phone}
              </span>
            )}
            {c.email && (
              <span className="flex items-center gap-0.5 min-w-0 wrap-anywhere">
                <span className="material-symbols-outlined text-xs" aria-hidden="true">mail</span>
                {c.email}
              </span>
            )}
            {c.address && (
              <span className="flex items-center gap-0.5 min-w-0 wrap-anywhere">
                <span className="material-symbols-outlined text-xs" aria-hidden="true">map</span>
                {c.address}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
        {c.phone && (
          <a href={`tel:${c.phone}`} aria-label={t('household_app.contacts.call', name)} className={iconAction}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">call</span>
          </a>
        )}
        {c.email && (
          <a href={`mailto:${c.email}`} aria-label={t('household_app.contacts.email', name)} className={iconAction}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">mail</span>
          </a>
        )}
        {links.length > 0 && (
          <a href={links[0]} target="_blank" rel="noreferrer" aria-label={t('household_app.contacts.open_link', name)} className={iconAction}>
            <span className="material-symbols-outlined text-sm" aria-hidden="true">open_in_new</span>
          </a>
        )}

        {!isGuest && (
          <div className="flex items-center gap-1 border-l border-[var(--border-subtle)] pl-1.5 ml-1">
            <button
              type="button"
              onClick={() => onEdit(c)}
              aria-label={t('household_app.contacts.edit', name)}
              className="p-2 rounded hover:bg-[var(--surface-canvas)] text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer inline-flex items-center"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">edit</span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(c.id)}
              aria-label={t('household_app.contacts.delete', name)}
              className="p-2 rounded hover:bg-[var(--surface-canvas)] text-red-400 hover:text-red-300 cursor-pointer inline-flex items-center"
            >
              <span className="material-symbols-outlined text-sm" aria-hidden="true">delete</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
