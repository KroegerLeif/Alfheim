'use client';

import { Contact, ContactCategory, InviteCodeResponse, Household } from '@/shared/types';
import { AddressManagementModal } from './AddressManagementModal';
import { InviteModal } from './InviteModal';
import { ContactModal, CategoryModal } from '@/features/contact';

interface HouseholdModalsProps {
  activeInvite: InviteCodeResponse | null;
  setActiveInvite: (invite: InviteCodeResponse | null) => void;
  isAddressModalOpen: boolean;
  setIsAddressModalOpen: (open: boolean) => void;
  household: Household;
  handleAddressSelect: (addr: any) => void;
  isCategoryModalOpen: boolean;
  setIsCategoryModalOpen: (open: boolean) => void;
  editingCategory: ContactCategory | null;
  handleCategorySubmit: (payload: { name: string; icon: string; color: string }) => void;
  isContactModalOpen: boolean;
  setIsContactModalOpen: (open: boolean) => void;
  editingContact: Contact | null;
  categories: ContactCategory[];
  handleContactSubmit: (payload: any) => void;
}

export function HouseholdModals({
  activeInvite,
  setActiveInvite,
  isAddressModalOpen,
  setIsAddressModalOpen,
  household,
  handleAddressSelect,
  isCategoryModalOpen,
  setIsCategoryModalOpen,
  editingCategory,
  handleCategorySubmit,
  isContactModalOpen,
  setIsContactModalOpen,
  editingContact,
  categories,
  handleContactSubmit,
}: HouseholdModalsProps) {
  return (
    <>
      {activeInvite && <InviteModal invite={activeInvite} onClose={() => setActiveInvite(null)} />}

      <AddressManagementModal
        isOpen={isAddressModalOpen}
        household={household}
        onClose={() => setIsAddressModalOpen(false)}
        onAddressSelect={handleAddressSelect}
      />

      {isCategoryModalOpen && (
        <CategoryModal
          editingCategory={editingCategory}
          onClose={() => setIsCategoryModalOpen(false)}
          onSubmit={handleCategorySubmit}
        />
      )}

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
