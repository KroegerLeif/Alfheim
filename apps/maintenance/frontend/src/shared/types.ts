// Shared type definitions for the Maintenance application

export interface AssignedUser {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

export interface Manual {
  id: string;
  title: string;
  fileSize: string;
  url: string;
}

export interface ServiceStep {
  id: string;
  name: string;
  description?: string;
  intervalMonths: number;
  lastPerformed?: string;
  nextDue?: string;
}

export interface ServiceEvent {
  id: string;
  title: string;
  performedAt: string;
  performedBy: string;
  notes?: string;
  cost?: number;
}

export interface Device {
  id: string;
  name: string;
  model: string;
  serialNumber: string;
  location: string;
  category: string;
  status: "active" | "maintenance" | "inactive";
  householdId: number;
  imageUrl?: string;
  assignedUser?: AssignedUser;
  manuals?: Manual[];
  serviceSteps?: ServiceStep[];
  serviceHistory?: ServiceEvent[];
}
