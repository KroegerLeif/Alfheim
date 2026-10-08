// Static reference data used by the frontend UI.
// Device data is served live from the backend API via useQuery hooks.

import {
  Wind,
  Droplet,
  Zap,
  Tv,
  ShieldAlert,
  Sprout
} from "lucide-react";

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
