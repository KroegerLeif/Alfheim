'use client';

import type { AddressResult } from '@alfheim/shared';
import { Contact, ContactCategory, ContactPayload, InviteCodeResponse, Household } from '@/shared/types';
import { AddressManagementModal } from './AddressManagementModal';
import { InviteModal } from './InviteModal';
import { ContactModal, CategoryModal } from '@/features/contact';

interface HouseholdModalsProps {
  activeInvite: InviteCodeResponse | null;
  setActiveInvite: (invite: InviteCodeResponse | null) => void;
  isAddressModalOpen: boolean;
  setIsAddressModalOpen: (open: boolean) => void;
  household: Household;
  handleAddressSelect: (addr: AddressResult) => void;
  isCategoryModalOpen: boolean;
  setIsCategoryModalOpen: (open: boolean) => void;
  editingCategory: ContactCategory | null;
  handleCategorySubmit: (payload: { name: string; icon: string; color: string }) => void;
  isContactModalOpen: boolean;
  setIsContactModalOpen: (open: boolean) => void;
  editingContact: Contact | null;
  categories: ContactCategory[];
  handleContactSubmit: (payload: ContactPayload) => void;
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
      <InviteModal isOpen={!!activeInvite} invite={activeInvite} onClose={() => setActiveInvite(null)} />

      <AddressManagementModal
        isOpen={isAddressModalOpen}
        household={household}
        onClose={() => setIsAddressModalOpen(false)}
        onAddressSelect={handleAddressSelect}
      />

      <CategoryModal
        key={`category-${isCategoryModalOpen}-${editingCategory?.id ?? 'new'}`}
        isOpen={isCategoryModalOpen}
        editingCategory={editingCategory}
        onClose={() => setIsCategoryModalOpen(false)}
        onSubmit={handleCategorySubmit}
      />

      <ContactModal
        key={`contact-${isContactModalOpen}-${editingContact?.id ?? 'new'}`}
        isOpen={isContactModalOpen}
        editingContact={editingContact}
        categories={categories}
        onClose={() => setIsContactModalOpen(false)}
        onSubmit={handleContactSubmit}
      />
    </>
  );
}
