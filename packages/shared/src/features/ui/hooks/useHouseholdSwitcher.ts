'use client';

import { useState, useEffect, useRef } from 'react';
import { useActiveHousehold } from '../../household/HouseholdProvider';

export type { Household } from '../../household/householdStore';
export type { OidcWindow } from '../../household/householdApi';

/**
 * Dropdown state for the header switcher on top of the shared
 * `HouseholdProvider` (which owns fetching, default selection and sync).
 */
export function useHouseholdSwitcher() {
  const { households, householdId, household, setActiveHousehold } = useActiveHousehold();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (id: string) => {
    setActiveHousehold(id);
    setIsOpen(false);
  };

  return {
    households,
    activeId: householdId,
    selectedHousehold: household ?? households[0],
    isOpen,
    setIsOpen,
    dropdownRef,
    handleSelect,
  };
}
