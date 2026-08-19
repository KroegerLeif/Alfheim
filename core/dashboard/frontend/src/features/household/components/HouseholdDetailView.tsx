'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation } from '@alfheim/shared';

// Subcomponents
import { HouseholdHeader } from './HouseholdHeader';
import { MapAddressBanner } from './MapAddressBanner';
import { MemberTable } from './MemberTable';
import { AddressManagementModal } from './AddressManagementModal';
import { InviteModal } from './InviteModal';
import { HouseholdDetailSkeleton } from './HouseholdDetailSkeleton';

import {
  ContactCards,
  CategoryManager,
  ContactModal,
  CategoryModal,
  useContacts,
  useCreateContact,
  useUpdateContact,
  useDeleteContact,
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategory,
} from '@/features/contact';

import {
  useHousehold,
  useCreateInvite,
  useUpdateHouseholdAddress,
  useUpdateMemberRole,
  useRemoveMember,
} from '../hooks/queries';

import { InviteCodeResponse, Contact, ContactCategory } from '@/shared/types';

interface HouseholdDetailViewProps {
  householdId: string;
}

/**
 * Main household detail view orchestrator component.
 * Aggregates state, queries, and mutations, delegating rendering to SRP sub-components.
 */
export function HouseholdDetailView({ householdId }: HouseholdDetailViewProps) {
  const { t } = useTranslation();

  // Queries
  const { data: household, isLoading: isHhLoading } = useHousehold(householdId);
  const { data: contactsData, isLoading: isContactsLoading } = useContacts(householdId);
  const { data: categoriesData } = useCategories(householdId);

  const contacts = contactsData ?? [];
  const categories = categoriesData ?? [];

  // Household mutations
  const createInviteMutation = useCreateInvite();
  const updateAddressMutation = useUpdateHouseholdAddress();
  const updateMemberRoleMutation = useUpdateMemberRole(householdId);
  const removeMemberMutation = useRemoveMember(householdId);

  // Contact mutations
  const createContactMutation = useCreateContact(householdId);
  const updateContactMutation = useUpdateContact(householdId);
  const deleteContactMutation = useDeleteContact(householdId);

  // Category mutations
  const createCategoryMutation = useCreateCategory(householdId);
  const updateCategoryMutation = useUpdateCategory(householdId);
  const deleteCategoryMutation = useDeleteCategory(householdId);

  // Modal & View States
  const [activeInvite, setActiveInvite] = useState<InviteCodeResponse | null>(null);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<ContactCategory | null>(null);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [isMapView, setIsMapView] = useState(false);

  // Synchronize dynamic household headers & storage context
  useEffect(() => {
    if (householdId) {
      localStorage.setItem('alfheim_active_household_id', householdId);
      if (household) {
        localStorage.setItem('alfheim_active_household_role', household.role || 'MEMBER');
      }
      window.dispatchEvent(new Event('storage-household-changed'));
    }
  }, [householdId, household]);

  // Loading guard check
  if (isHhLoading || isContactsLoading) {
    return <HouseholdDetailSkeleton />;
  }

  // Safety/Not found checks
  if (!household) {
    return (
      <div className="col-span-12 flex flex-col items-center justify-center p-8 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 min-h-[40vh]">
        <span className="material-symbols-outlined text-4xl text-[var(--text-muted)]">error</span>
        <h3 className="text-lg font-bold text-[var(--text-main)]">
          {t('household.not_found')}
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          {t('household.not_found_desc')}
        </p>
        <Link
          href="/household"
          className="px-4 py-2 bg-[var(--primary-main)] text-slate-950 rounded-lg text-xs font-bold font-mono hover:bg-[var(--primary-hover)] transition-colors"
        >
          {t('household.back_to_list')}
        </Link>
      </div>
    );
  }

  // Role authorization details
  const activeRole = (household.role || 'MEMBER').toUpperCase();
  const isOwnerOrAdmin = activeRole === 'OWNER' || activeRole === 'ADMIN';
  const isGuest = activeRole === 'GUEST';

  const mapCenter: [number, number] = household.latitude && household.longitude
    ? [household.latitude, household.longitude]
    : [52.520008, 13.404954]; // Fallback Berlin center

  // Actions
  const handleGenerateInvite = () => {
    createInviteMutation.mutate(
      {
        household_id: household.id,
        role: 'MEMBER',
        ttl_minutes: 60,
        max_uses: 5,
      },
      {
        onSuccess: (data) => {
          setActiveInvite(data);
        },
      }
    );
  };

  const handleAddressSelect = (addr: any) => {
    updateAddressMutation.mutate(
      {
        householdId: household.id,
        payload: {
          street: addr.street,
          zip: addr.zip,
          city: addr.city,
          country: addr.country,
          latitude: addr.lat,
          longitude: addr.lng,
        },
      },
      {
        onSuccess: () => {
          setIsAddressModalOpen(false);
        },
      }
    );
  };

  const handleRoleChange = (userId: string, currentRole: string, newRole: string) => {
    if (currentRole === 'OWNER') return;
    updateMemberRoleMutation.mutate({ userId, role: newRole });
  };

  const handleRemoveMemberClick = (userId: string, displayName: string) => {
    if (confirm(`${t('household.confirm_remove')} (${displayName})`)) {
      removeMemberMutation.mutate(userId);
    }
  };

  const openCategoryModal = (cat: ContactCategory | null = null) => {
    setEditingCategory(cat);
    setIsCategoryModalOpen(true);
  };

  const handleCategorySubmit = (payload: { name: string; icon: string; color: string }) => {
    if (editingCategory) {
      updateCategoryMutation.mutate(
        { catId: editingCategory.id, payload },
        {
          onSuccess: () => setIsCategoryModalOpen(false),
        }
      );
    } else {
      createCategoryMutation.mutate(payload, {
        onSuccess: () => setIsCategoryModalOpen(false),
      });
    }
  };

  const handleDeleteCategory = (catId: string) => {
    if (confirm(t('household.confirm_delete_category'))) {
      deleteCategoryMutation.mutate(catId);
    }
  };

  const openContactModal = (c: Contact | null = null) => {
    setEditingContact(c);
    setIsContactModalOpen(true);
  };

  const handleContactSubmit = (payload: any) => {
    if (editingContact) {
      updateContactMutation.mutate(
        { contactId: editingContact.id, payload },
        {
          onSuccess: () => setIsContactModalOpen(false),
        }
      );
    } else {
      createContactMutation.mutate(payload, {
        onSuccess: () => setIsContactModalOpen(false),
      });
    }
  };

  const handleDeleteContact = (contactId: string) => {
    if (confirm(t('household.confirm_delete_contact'))) {
      deleteContactMutation.mutate(contactId);
    }
  };

  return (
    <>
      {/* Title & Invite action banner header */}
      <HouseholdHeader
        household={household}
        isOwnerOrAdmin={isOwnerOrAdmin}
        onGenerateInvite={handleGenerateInvite}
      />

      {/* Map & Address Info section */}
      <MapAddressBanner
        household={household}
        isOwnerOrAdmin={isOwnerOrAdmin}
        onUpdateAddressClick={() => setIsAddressModalOpen(true)}
      />

      {/* Members roster and Contacts details */}
      <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
        {/* Members registry table */}
        <MemberTable
          household={household}
          isOwnerOrAdmin={isOwnerOrAdmin}
          onRoleChange={handleRoleChange}
          onRemoveMember={handleRemoveMemberClick}
        />

        {/* Contacts registry */}
        <div className="lg:col-span-7 p-6 rounded-2xl bg-[var(--surface-card)] border border-[var(--border-subtle)] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)] mb-4">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-mono uppercase tracking-wide text-[var(--text-muted)]">
                  {t('household.contacts')}
                </h2>
                <button
                  onClick={() => setIsMapView(!isMapView)}
                  className="px-2 py-0.5 rounded bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] hover:border-[var(--primary-main)]/50 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[12px]">{isMapView ? 'list' : 'map'}</span>
                  <span>{isMapView ? t('household.list_view') : t('household.map_view')}</span>
                </button>
              </div>

              {!isGuest && (
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openCategoryModal()}
                    className="px-2 py-1 rounded bg-[var(--surface-canvas)] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-main)] flex items-center gap-1 hover:border-[var(--primary-main)]/40 cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">folder_open</span>
                    {t('household.add_category')}
                  </button>
                  <button
                    onClick={() => openContactModal()}
                    className="px-2.5 py-1 rounded bg-[var(--primary-main)] text-slate-950 font-bold text-[10px] flex items-center gap-1 hover:bg-[var(--primary-hover)] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-xs">person_add</span>
                    {t('household.add_contact')}
                  </button>
                </div>
              )}
            </div>

            {/* Category selection bar */}
            <CategoryManager
              categories={categories}
              isGuest={isGuest}
              onEditCategory={openCategoryModal}
              onDeleteCategory={handleDeleteCategory}
            />

            {/* Contacts visualizer */}
            <ContactCards
              contacts={contacts}
              categories={categories}
              isMapView={isMapView}
              isGuest={isGuest}
              mapCenter={mapCenter}
              onEditContact={openContactModal}
              onDeleteContact={handleDeleteContact}
            />
          </div>
        </div>
      </div>

      {/* Invites details modal */}
      {activeInvite && <InviteModal invite={activeInvite} onClose={() => setActiveInvite(null)} />}

      {/* Geocoding address update modal */}
      <AddressManagementModal
        isOpen={isAddressModalOpen}
        household={household}
        onClose={() => setIsAddressModalOpen(false)}
        onAddressSelect={handleAddressSelect}
      />

      {/* Category CRUD Modal */}
      {isCategoryModalOpen && (
        <CategoryModal
          editingCategory={editingCategory}
          onClose={() => setIsCategoryModalOpen(false)}
          onSubmit={handleCategorySubmit}
        />
      )}

      {/* Contact CRUD Modal */}
      {isContactModalOpen && (
        <ContactModal
          editingContact={editingContact}
          categories={categories}
          onClose={() => setIsContactModalOpen(false)}
          onSubmit={handleContactSubmit}
        />
      )}
    </>
  );
}
