'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useTranslation, AddressAutocomplete } from '@loeger-os/shared';
import { useAuth } from '@/core/providers';

// Subcomponents
import { MapAddressBanner } from './MapAddressBanner';
import { MemberGrid } from './MemberGrid';
import { InviteModal } from './InviteModal';
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

import { HouseholdDetailSkeleton } from './HouseholdDetailSkeleton';
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
 * Main household view component.
 * Orchestrates layout and aggregates core states, modals, and mutations.
 */
export function HouseholdDetailView({ householdId }: HouseholdDetailViewProps) {
  const { t } = useTranslation();
  const { user: currentUser } = useAuth();

  // Queries
  const { data: household, isLoading: isHhLoading } = useHousehold(householdId);
  const { data: contacts = [], isLoading: isContactsLoading } = useContacts(householdId);
  const { data: categories = [] } = useCategories(householdId);

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
      localStorage.setItem('loeger_os_active_household_id', householdId);
      if (household) {
        localStorage.setItem('loeger_os_active_household_role', household.role || 'MEMBER');
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
          The requested household does not exist or you do not have permission to view it.
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
      {/* Title & Invite action banner */}
      <div className="col-span-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-2">
        <div className="space-y-1">
          <Link
            href="/household"
            className="flex items-center gap-1 text-xs text-[var(--text-muted)] hover:text-[var(--primary-main)] transition-colors mb-1 self-start"
          >
            <span className="material-symbols-outlined text-sm">arrow_back</span>
            <span>{t('household.back_to_list')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-[var(--text-main)]">{household.name}</h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase bg-[var(--primary-main)]/10 text-[var(--primary-main)] border border-[var(--border-accent)]">
              {household.role || 'MEMBER'}
            </span>
          </div>
        </div>

        {isOwnerOrAdmin && (
          <button
            onClick={handleGenerateInvite}
            className="px-3.5 py-2 rounded-lg bg-[var(--primary-main)] text-slate-950 font-bold text-xs flex items-center gap-1.5 hover:bg-[var(--primary-hover)] transition-all cursor-pointer shadow-md"
          >
            <span className="material-symbols-outlined text-sm">person_add</span>
            <span>{t('household.invite_member')}</span>
          </button>
        )}
      </div>

      {/* Map & Address Info section */}
      <MapAddressBanner
        household={household}
        isOwnerOrAdmin={isOwnerOrAdmin}
        onUpdateAddressClick={() => setIsAddressModalOpen(true)}
      />

      {/* Members roster and Contacts details */}
      <div className="col-span-12 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start mt-2">
        {/* Members registry */}
        <MemberGrid
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

      {/* Geocoding address update search modal */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--surface-card)] border border-[var(--border-subtle)] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
              <h3 className="text-base font-bold text-[var(--text-main)]">{t('household.address_search')}</h3>
              <button
                onClick={() => setIsAddressModalOpen(false)}
                className="text-[var(--text-muted)] hover:text-[var(--text-main)] cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="space-y-4">
              <AddressAutocomplete placeholder={t('household.address_search')} onSelect={handleAddressSelect} />
            </div>
          </div>
        </div>
      )}

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
