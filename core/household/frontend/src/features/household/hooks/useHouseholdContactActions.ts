'use client';

import { Contact, ContactCategory, ContactPayload, ContactCategoryPayload } from '@/shared/types';

/** The slice of a TanStack mutation result these handlers use. */
interface Mutation<TVariables> {
  mutate: (variables: TVariables, options?: { onSuccess?: () => void }) => void;
}

interface HouseholdContactHandlers {
  openCategoryModal: (cat?: ContactCategory | null) => void;
  handleCategorySubmit: (payload: { name: string; icon: string; color: string }) => void;
  handleDeleteCategory: (catId: string) => void;
  openContactModal: (c?: Contact | null) => void;
  handleContactSubmit: (payload: ContactPayload) => void;
  handleDeleteContact: (contactId: string) => void;
}

export function useHouseholdContactActions(
  editingCategory: ContactCategory | null,
  setIsCategoryModalOpen: (open: boolean) => void,
  setEditingCategory: (cat: ContactCategory | null) => void,
  createCategoryMutation: Mutation<ContactCategoryPayload>,
  updateCategoryMutation: Mutation<{ catId: string; payload: ContactCategoryPayload }>,
  deleteCategoryMutation: Mutation<string>,
  editingContact: Contact | null,
  setIsContactModalOpen: (open: boolean) => void,
  setEditingContact: (c: Contact | null) => void,
  createContactMutation: Mutation<ContactPayload>,
  updateContactMutation: Mutation<{ contactId: string; payload: ContactPayload }>,
  deleteContactMutation: Mutation<string>,
  t: (key: string) => string
): HouseholdContactHandlers {
  const openCategoryModal = (cat: ContactCategory | null = null) => {
    setEditingCategory(cat);
    setIsCategoryModalOpen(true);
  };

  const handleCategorySubmit = (payload: { name: string; icon: string; color: string }) => {
    if (editingCategory) {
      updateCategoryMutation.mutate({ catId: editingCategory.id, payload }, { onSuccess: () => setIsCategoryModalOpen(false) });
    } else {
      createCategoryMutation.mutate(payload, { onSuccess: () => setIsCategoryModalOpen(false) });
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

  const handleContactSubmit = (payload: ContactPayload) => {
    if (editingContact) {
      updateContactMutation.mutate({ contactId: editingContact.id, payload }, { onSuccess: () => setIsContactModalOpen(false) });
    } else {
      createContactMutation.mutate(payload, { onSuccess: () => setIsContactModalOpen(false) });
    }
  };

  const handleDeleteContact = (contactId: string) => {
    if (confirm(t('household.confirm_delete_contact'))) {
      deleteContactMutation.mutate(contactId);
    }
  };

  return {
    openCategoryModal,
    handleCategorySubmit,
    handleDeleteCategory,
    openContactModal,
    handleContactSubmit,
    handleDeleteContact,
  };
}
