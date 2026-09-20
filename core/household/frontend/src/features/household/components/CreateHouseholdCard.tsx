'use client';

import { useState } from 'react';
import { useTranslation } from '@/i18n';
import { describeApiError } from '@/lib/apiErrors';
import { setActiveHousehold } from '@/lib/activeHousehold';
import { Household } from '@/shared/types';
import { useCreateHousehold } from '../hooks/queries';
import { HouseholdCreateModal } from './HouseholdCreateModal';

interface CreateHouseholdCardProps {
  title: string;
  description: string;
  /** Called after creation; the household is already active. */
  onCreated: (household: Household) => void;
}

/** Card with a "create household" button and the create dialog. */
export function CreateHouseholdCard({ title, description, onCreated }: CreateHouseholdCardProps) {
  const { t } = useTranslation();
  const createMutation = useCreateHousehold();
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState('');
  const [status, setStatus] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setStatus(null);
    createMutation.mutate(
      { name: name.trim() },
      {
        onSuccess: (household) => {
          setName('');
          setIsOpen(false);
          if (household?.id) setActiveHousehold(household.id);
          onCreated(household);
        },
        onError: (err) => setStatus(describeApiError(err, t)),
      },
    );
  };

  return (
    <div className="p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] flex flex-col justify-between space-y-4 shadow-lg">
      <div>
        <h2 className="flex items-center gap-2 text-sm font-bold text-[var(--text-main)] mb-1">
          <span className="material-symbols-outlined text-[var(--primary-main)]" aria-hidden="true">add_home</span>
          <span>{title}</span>
        </h2>
        <p className="text-xs text-[var(--text-muted)] leading-relaxed font-sans">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="w-full py-2.5 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-md"
      >
        {t('household_app.create.submit')}
      </button>

      <HouseholdCreateModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        newHouseholdName={name}
        setNewHouseholdName={setName}
        createStatus={status}
        onSubmit={handleSubmit}
        isPending={createMutation.isPending}
      />
    </div>
  );
}
