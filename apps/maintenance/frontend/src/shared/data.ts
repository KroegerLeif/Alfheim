// Shared static data and constants for the Maintenance application

export interface Household {
  id: number;
  name: string;
}

export const households: Household[] = [
  { id: 1, name: "Main Residence" },
  { id: 2, name: "Summer Cottage" },
  { id: 3, name: "Office HQ" }
];

export const currentUser = {
  name: "Lena Müller",
  role: "Admin",
  avatarUrl: null as string | null
};
