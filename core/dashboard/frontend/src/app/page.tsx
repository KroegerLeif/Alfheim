'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@alfheim/shared';
import {
  useDashboardApps,
  AddAppModal,
  EditAppModal,
  CoreAppsSection,
  StackAppsSection,
  UserAppsSection,
} from '@/features/apps';
import { SystemShellLogs } from '@/features/dashboard/components/SystemShellLogs';
import { AppItem } from '@/shared/types';

/**
 * Root Dashboard View.
 * Renders live telemetry stats, interactive terminal log shell, and 3-tier application management:
 * 1. Tier 1 (Core Apps): Pre-built platform modules.
 * 2. Tier 2 (Stack Apps): Server-level YAML defined integrations.
 * 3. Tier 3 (User Links): User-bound custom bookmarks with full CRUD capabilities.
 */
export default function DashboardPage() {
  const { t } = useTranslation();
  const { data: dashboard, isLoading, isError, refetch } = useDashboardApps();

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<AppItem | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Trigger graceful error toast on API load failure
  useEffect(() => {
    if (isError) {
      setToastMessage(t('dashboard.error_load_catalog'));
    }
  }, [isError, t]);

  const openAddModal = () => {
    setIsAddModalOpen(true);
  };

  const openEditModal = (app: AppItem) => {
    setEditingApp(app);
    setIsEditModalOpen(true);
  };

  const handleSuccess = (appName: string) => {
    setToastMessage(t('dashboard.toast_bookmark_saved', { name: appName }));
    setTimeout(() => setToastMessage(null), 4000);
  };

  return (
    <>
      {/* Toast Success Notification */}
      {toastMessage && (
        <div className="col-span-12 p-3.5 rounded-xl bg-emerald-950/80 border border-emerald-500/50 text-emerald-300 text-xs font-mono flex items-center justify-between shadow-2xl animate-in slide-in-from-top-3 duration-200">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-base text-emerald-400">check_circle</span>
            <span>{toastMessage}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-emerald-400 hover:text-white"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* Live System Shell / Terminal Log Feed */}
      <SystemShellLogs />

      {/* TIER 1: CORE APPLICATIONS */}
      <CoreAppsSection
        isLoading={isLoading}
        isError={isError}
        apps={dashboard?.core}
        refetch={refetch}
      />

      {/* TIER 2: STACK INTEGRATIONS */}
      <StackAppsSection
        isLoading={isLoading}
        isError={isError}
        apps={dashboard?.stack}
      />

      {/* TIER 3: PERSONAL USER LINKS */}
      <UserAppsSection
        isLoading={isLoading}
        isError={isError}
        apps={dashboard?.user}
        onOpenAddModal={openAddModal}
        onOpenEditModal={openEditModal}
      />

      {/* Add Personal Link Modal */}
      <AddAppModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSuccess={handleSuccess}
      />

      {/* Edit Personal Link Modal */}
      <EditAppModal
        app={editingApp}
        isOpen={isEditModalOpen}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingApp(null);
        }}
        onSuccess={handleSuccess}
      />
    </>
  );
}
