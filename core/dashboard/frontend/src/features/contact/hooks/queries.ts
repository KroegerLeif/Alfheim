import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
  fetchContactCategories,
  createContactCategory,
  updateContactCategory,
  deleteContactCategory,
} from '../api/contact';
import { Contact, ContactCategory } from '@/shared/types';

export const CONTACTS_KEY = (householdId: string) => ['contacts', householdId];
export const CATEGORIES_KEY = (householdId: string) => ['contact-categories', householdId];

/**
 * Query hook to fetch contacts for a given household ID.
 */
export function useContacts(householdId: string) {
  return useQuery<Contact[]>({
    queryKey: CONTACTS_KEY(householdId),
    queryFn: () => fetchContacts(householdId),
    enabled: !!householdId,
  });
}

/**
 * Mutation hook to create a contact.
 */
export function useCreateContact(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => {
      if (!householdId) throw new Error("Missing active household selection");
      return createContact(householdId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY(householdId) });
    },
  });
}

/**
 * Mutation hook to update a contact.
 */
export function useUpdateContact(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, payload }: { contactId: string; payload: any }) => {
      if (!householdId) throw new Error("Missing active household selection");
      return updateContact(householdId, contactId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY(householdId) });
    },
  });
}

/**
 * Mutation hook to delete a contact.
 */
export function useDeleteContact(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => {
      if (!householdId) throw new Error("Missing active household selection");
      return deleteContact(householdId, contactId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY(householdId) });
    },
  });
}

/**
 * Query hook to fetch contact categories for a given household ID.
 */
export function useCategories(householdId: string) {
  return useQuery<ContactCategory[]>({
    queryKey: CATEGORIES_KEY(householdId),
    queryFn: () => fetchContactCategories(householdId),
    enabled: !!householdId,
  });
}

/**
 * Mutation hook to create a contact category.
 */
export function useCreateCategory(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: any) => {
      if (!householdId) throw new Error("Missing active household selection");
      return createContactCategory(householdId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY(householdId) });
    },
  });
}

/**
 * Mutation hook to update a contact category.
 */
export function useUpdateCategory(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ catId, payload }: { catId: string; payload: any }) => {
      if (!householdId) throw new Error("Missing active household selection");
      return updateContactCategory(householdId, catId, payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY(householdId) });
    },
  });
}

/**
 * Mutation hook to delete a contact category.
 */
export function useDeleteCategory(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (catId: string) => {
      if (!householdId) throw new Error("Missing active household selection");
      return deleteContactCategory(householdId, catId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY(householdId) });
    },
  });
}
