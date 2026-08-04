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
  updateHouseholdAddress,
  updateMemberRole,
  removeMember
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
    mutationFn: (payload: any) => createContact(householdId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY(householdId) });
    },
  });
}

export function useUpdateContact(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, payload }: { contactId: string; payload: any }) =>
      updateContact(householdId, contactId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONTACTS_KEY(householdId) });
    },
  });
}

export function useDeleteContact(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (contactId: string) => deleteContact(householdId, contactId),
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
    mutationFn: (payload: any) => createContactCategory(householdId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY(householdId) });
    },
  });
}

export function useUpdateCategory(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ catId, payload }: { catId: string; payload: any }) =>
      updateContactCategory(householdId, catId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY(householdId) });
    },
  });
}

export function useDeleteCategory(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (catId: string) => deleteContactCategory(householdId, catId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY(householdId) });
    },
  });
}

export function useUpdateHouseholdAddress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ householdId, payload }: { householdId: string; payload: any }) =>
      updateHouseholdAddress(householdId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households', 'me'] });
    },
  });
}

export function useUpdateMemberRole(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      updateMemberRole(householdId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households', 'me'] });
    },
  });
}

export function useRemoveMember(householdId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => removeMember(householdId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['households', 'me'] });
    },
  });
}
