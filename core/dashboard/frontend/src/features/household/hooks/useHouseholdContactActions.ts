'use client';

import { Contact, ContactCategory } from '@/shared/types';

interface HouseholdContactHandlers {
  openCategoryModal: (cat?: ContactCategory | null) => void;
  handleCategorySubmit: (payload: { name: string; icon: string; color: string }) => void;
  handleDeleteCategory: (catId: string) => void;
  openContactModal: (c?: Contact | null) => void;
  handleContactSubmit: (payload: any) => void;
  handleDeleteContact: (contactId: string) => void;
}

export function useHouseholdContactActions(
  editingCategory: ContactCategory | null,
  setIsCategoryModalOpen: (open: boolean) => void,
  setEditingCategory: (cat: ContactCategory | null) => void,
  createCategoryMutation: any,
  updateCategoryMutation: any,
  deleteCategoryMutation: any,
  editingContact: Contact | null,
  setIsContactModalOpen: (open: boolean) => void,
  setEditingContact: (c: Contact | null) => void,
  createContactMutation: any,
  updateContactMutation: any,
  deleteContactMutation: any,
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

  const handleContactSubmit = (payload: any) => {
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
