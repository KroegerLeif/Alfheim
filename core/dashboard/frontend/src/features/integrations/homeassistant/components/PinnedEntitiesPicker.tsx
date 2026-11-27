'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useTranslation } from '@alfheim/shared';
import { ENTITY_ID_PATTERN } from '../types';

/** The backend caps a household's pinned entities at this number. */
export const MAX_PINNED = 50;

interface PinnedEntitiesPickerProps {
  value: string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
}

/** Lets an admin pin Home Assistant entities by id (`sensor.living_room`), validated like the backend. */
export function PinnedEntitiesPicker({ value, onChange, disabled }: PinnedEntitiesPickerProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const add = () => {
    const id = draft.trim().toLowerCase();
    if (!ENTITY_ID_PATTERN.test(id)) return setError(t('dashboard.integrations.homeassistant.entity_invalid'));
    if (value.includes(id)) return setError(t('dashboard.integrations.homeassistant.entity_duplicate'));
    if (value.length >= MAX_PINNED) return setError(t('dashboard.integrations.homeassistant.entity_limit', { max: MAX_PINNED }));
    setError(null);
    setDraft('');
    onChange([...value, id]);
  };

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled}>
      <legend className="text-xs font-semibold text-[var(--text-main)]">
        {t('dashboard.integrations.homeassistant.pinned_entities')}
      </legend>
      <ul className="flex flex-wrap gap-2">
        {value.map((id) => (
          <li key={id} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-mono bg-[var(--surface-elevated)] text-[var(--text-main)]">
            {id}
            <button
              type="button"
              onClick={() => onChange(value.filter((v) => v !== id))}
              aria-label={t('dashboard.integrations.homeassistant.entity_remove', { id })}
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>
      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
          placeholder={t('dashboard.integrations.homeassistant.entity_placeholder')}
          aria-label={t('dashboard.integrations.homeassistant.entity_add_label')}
          className="flex-1 min-w-0 px-3 py-1.5 rounded-lg text-xs font-mono bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-main)]"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[var(--border-subtle)] text-[var(--text-main)]"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden="true" />
          {t('dashboard.integrations.homeassistant.entity_add')}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </fieldset>
  );
}
