'use client';

import { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'alfheim_active_household_id';
const CACHE_KEY = 'alfheim_cached_households';
const LEGACY_CACHE_KEY = 'loeger_os_cached_households';

export interface Household {
  id: string;
  name: string;
  slug: string;
  is_default?: boolean;
}

export interface KeycloakWindow extends Window {
  __keycloak_instance__?: {
    token?: string;
    authenticated?: boolean;
    updateToken?: (minValidity?: number) => Promise<boolean>;
    login?: (options?: unknown) => Promise<void> | void;
  };
}

function getKeycloakInstance() {
  if (typeof window === 'undefined') return undefined;
  return (window as unknown as KeycloakWindow).__keycloak_instance__;
}

function resolveSessionToken(): string | null {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;
  const sharedToken = sessionStorage.getItem('alfheim_access_token');
  if (sharedToken) return sharedToken;

  try {
    const len = sessionStorage.length ?? 0;
    for (let i = 0; i < len; i++) {
      const key = typeof sessionStorage.key === 'function' ? sessionStorage.key(i) : Object.keys(sessionStorage)[i];
      if (key && key.startsWith('token_')) {
        const val = sessionStorage.getItem(key);
        if (val) return val;
      }
    }
  } catch {
    // Ignore cross-origin / storage errors
  }
  return null;
}

export function useHouseholdSwitcher() {
  const [households, setHouseholds] = useState<Household[]>(() => {
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem(CACHE_KEY) || localStorage.getItem(LEGACY_CACHE_KEY);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {
        // Ignore cache parse error
      }
    }
    return [];
  });

  const [activeId, setActiveId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(STORAGE_KEY);
    }
    return null;
  });

  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const getFreshToken = async (): Promise<string | null> => {
      if (typeof window === 'undefined') return null;
      const keycloak = getKeycloakInstance();
      if (keycloak && typeof keycloak.updateToken === 'function') {
        try {
          await keycloak.updateToken(30);
          if (typeof keycloak.token === 'string') {
            sessionStorage.setItem('alfheim_access_token', keycloak.token);
            return keycloak.token;
          }
        } catch {
          // Token update failed, fall back to storage resolution
        }
      }
      return (
        (typeof keycloak?.token === 'string' ? keycloak.token : null) ||
        resolveSessionToken()
      );
    };

    const fetchHouseholds = async (url: string): Promise<boolean> => {
      try {
        let token = await getFreshToken();
        if (!token) return false;

        let res = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (res.status === 401 && typeof window !== 'undefined') {
          const keycloak = getKeycloakInstance();
          if (keycloak && typeof keycloak.updateToken === 'function') {
            try {
              const refreshed = await keycloak.updateToken(-1);
              if (refreshed && typeof keycloak.token === 'string') {
                const freshToken: string = keycloak.token;
                token = freshToken;
                sessionStorage.setItem('alfheim_access_token', freshToken);
                res = await fetch(url, {
                  headers: {
                    'Authorization': `Bearer ${freshToken}`
                  }
                });
              }
            } catch {
              // Retry refresh failed
            }
          }
        }

        if (!res.ok) throw new Error(`Status ${res.status}`);
        const data = await res.json();
        if (Array.isArray(data)) {
          setHouseholds(data);
          try {
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
            localStorage.setItem(LEGACY_CACHE_KEY, JSON.stringify(data));
          } catch {
            // Ignore storage quota errors
          }
          const activeSaved = localStorage.getItem(STORAGE_KEY);
          const exists = data.some(h => h.id === activeSaved);
          if ((!activeSaved || !exists) && data.length > 0) {
            const defaultHh = data.find(h => h.is_default) || data[0];
            localStorage.setItem(STORAGE_KEY, defaultHh.id);
            setActiveId(defaultHh.id);
            window.dispatchEvent(new Event('storage-household-changed'));
          }
          return true;
        }
      } catch (err) {
        console.warn(`Failed to fetch households from ${url}:`, err);
      }
      return false;
    };

    fetchHouseholds('/api/v1/households/me');

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setActiveId(e.newValue);
      }
    };

    const handleLocalChange = () => {
      setActiveId(localStorage.getItem(STORAGE_KEY));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('storage-household-changed', handleLocalChange);

    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('storage-household-changed', handleLocalChange);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleSelect = (id: string) => {
    localStorage.setItem(STORAGE_KEY, id);
    setActiveId(id);
    setIsOpen(false);
    window.dispatchEvent(new Event('storage-household-changed'));
  };

  const selectedHousehold = households.find(h => h.id === activeId) || households[0];

  return {
    households,
    activeId,
    selectedHousehold,
    isOpen,
    setIsOpen,
    dropdownRef,
    handleSelect,
  };
}
