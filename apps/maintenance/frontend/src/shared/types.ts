// Shared type definitions for the Maintenance application

export interface Device {
  id: string;
  name: string;
  type: string;
  status: "active" | "maintenance" | "inactive";
  location?: string;
  lastMaintenance?: string;
}

export interface MaintenanceTask {
  id: string;
  title: string;
  description?: string;
  deviceId: string;
  scheduledFor: string;
  status: "pending" | "in_progress" | "completed" | "overdue";
  priority: "low" | "medium" | "high" | "critical";
}
