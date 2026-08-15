// Static reference data used by the frontend UI
// Device data is now served live from the backend API via useQuery hooks

import {
  Wind,
  Droplet,
  Zap,
  Tv,
  ShieldAlert,
  Sprout
} from "lucide-react";
import { Household } from "./types";

// Fallback static household list (overridden by the live API in SidebarHouseholdPicker)
export const households: Household[] = [];

export const currentUser = {
  name: "Authenticated User",
  role: "Maintenance User",
  avatarUrl: null as string | null
};

export const CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Appliances",
  "Security",
  "Garden"
] as const;

// Mapping of category names to their Lucide icon components
export const CATEGORY_ICONS = {
  HVAC: Wind,
  Plumbing: Droplet,
  Electrical: Zap,
  Appliances: Tv,
  Security: ShieldAlert,
  Garden: Sprout
};
