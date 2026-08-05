import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  fetchContacts,
  createContact,
  updateContact,
  deleteContact,
  fetchContactCategories,
  createContactCategory,
  updateContactCategory,
  deleteContactCategory
} from '@/shared/api';
import { Contact, ContactCategory } from '@/shared/types';

export const CONTACTS_KEY = (householdId: string) => ['contacts', householdId];
export const CATEGORIES_KEY = (householdId: string) => ['contact-categories', householdId];

export function useContacts(householdId: string) {
  return useQuery<Contact[]>({
    queryKey: CONTACTS_KEY(householdId),
    queryFn: () => fetchContacts(householdId),
    enabled: !!householdId,
  });
}

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

export function useCategories(householdId: string) {
  return useQuery<ContactCategory[]>({
    queryKey: CATEGORIES_KEY(householdId),
    queryFn: () => fetchContactCategories(householdId),
    enabled: !!householdId,
  });
}

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

