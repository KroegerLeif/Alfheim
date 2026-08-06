import { api } from '@/core/api/client';
import { Contact, ContactCategory } from '@/shared/types';

/* Contact Categories API */
export async function fetchContactCategories(householdId: string): Promise<ContactCategory[]> {
  return await api.get(`api/v1/households/${householdId}/contact-categories`).json<ContactCategory[]>();
}

export async function createContactCategory(
  householdId: string,
  payload: { name: string; icon: string; color: string }
): Promise<ContactCategory> {
  return await api.post(`api/v1/households/${householdId}/contact-categories`, { json: payload }).json<ContactCategory>();
}

export async function updateContactCategory(
  householdId: string,
  catId: string,
  payload: { name: string; icon: string; color: string }
): Promise<ContactCategory> {
  return await api.put(`api/v1/households/${householdId}/contact-categories/${catId}`, { json: payload }).json<ContactCategory>();
}

export async function deleteContactCategory(householdId: string, catId: string): Promise<any> {
  return await api.delete(`api/v1/households/${householdId}/contact-categories/${catId}`).json();
}

/* Contacts API */
export async function fetchContacts(householdId: string): Promise<Contact[]> {
  return await api.get(`api/v1/households/${householdId}/contacts`).json<Contact[]>();
}

export async function createContact(
  householdId: string,
  payload: { category_id: string | null; name: string; phone: string; email: string; address: string; latitude: number | null; longitude: number | null; description: string; links: string[] }
): Promise<Contact> {
  return await api.post(`api/v1/households/${householdId}/contacts`, { json: payload }).json<Contact>();
}

export async function updateContact(
  householdId: string,
  contactId: string,
  payload: { category_id: string | null; name: string; phone: string; email: string; address: string; latitude: number | null; longitude: number | null; description: string; links: string[] }
): Promise<Contact> {
  return await api.put(`api/v1/households/${householdId}/contacts/${contactId}`, { json: payload }).json<Contact>();
}

export async function deleteContact(householdId: string, contactId: string): Promise<any> {
  return await api.delete(`api/v1/households/${householdId}/contacts/${contactId}`).json();
}
