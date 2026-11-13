import { api } from '@/core/api/client';
import { Contact, ContactCategory, ContactPayload } from '@/shared/types';

/* Contact Categories API */
export async function fetchContactCategories(householdId: string): Promise<ContactCategory[]> {
  return await api.get(`households/${householdId}/contact-categories`).json<ContactCategory[]>();
}

export async function createContactCategory(
  householdId: string,
  payload: { name: string; icon: string; color: string }
): Promise<ContactCategory> {
  return await api.post(`households/${householdId}/contact-categories`, payload).json<ContactCategory>();
}

export async function updateContactCategory(
  householdId: string,
  catId: string,
  payload: { name: string; icon: string; color: string }
): Promise<ContactCategory> {
  return await api.put(`households/${householdId}/contact-categories/${catId}`, payload).json<ContactCategory>();
}

export async function deleteContactCategory(householdId: string, catId: string): Promise<void> {
  await api.delete(`households/${householdId}/contact-categories/${catId}`);
}

/* Contacts API */
export async function fetchContacts(householdId: string): Promise<Contact[]> {
  return await api.get(`households/${householdId}/contacts`).json<Contact[]>();
}

export async function createContact(
  householdId: string,
  payload: ContactPayload
): Promise<Contact> {
  return await api.post(`households/${householdId}/contacts`, payload).json<Contact>();
}

export async function updateContact(
  householdId: string,
  contactId: string,
  payload: ContactPayload
): Promise<Contact> {
  return await api.put(`households/${householdId}/contacts/${contactId}`, payload).json<Contact>();
}

export async function deleteContact(householdId: string, contactId: string): Promise<void> {
  await api.delete(`households/${householdId}/contacts/${contactId}`);
}
