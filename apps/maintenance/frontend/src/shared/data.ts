import { 
  Wind, 
  Droplet, 
  Zap, 
  Tv, 
  ShieldAlert, 
  Sprout 
} from "lucide-react";
import { Device } from "./types";

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

export const CATEGORIES = [
  "HVAC",
  "Plumbing",
  "Electrical",
  "Appliances",
  "Security",
  "Garden"
] as const;

export const CATEGORY_ICONS = {
  HVAC: Wind,
  Plumbing: Droplet,
  Electrical: Zap,
  Appliances: Tv,
  Security: ShieldAlert,
  Garden: Sprout
};

export const initialDevices: Device[] = [
  {
    id: "d1",
    name: "Heat Pump Daikin Altherma 3",
    model: "EHVH08S23EJ6V",
    serialNumber: "DK-90812903-HP",
    location: "Utility Room",
    category: "HVAC",
    status: "active",
    householdId: 1,
    imageUrl: undefined,
    assignedUser: { id: "u1", name: "Lena Müller" },
    manuals: [
      { id: "m1", title: "Installation Manual", fileSize: "4.2 MB", url: "#" },
      { id: "m2", title: "User Operation Guide", fileSize: "1.8 MB", url: "#" }
    ],
    serviceSteps: [
      { id: "s1", name: "Clean air filters", description: "Vacuum or wash air filter meshes", intervalMonths: 6, lastPerformed: "2026-02-15", nextDue: "2026-08-15" },
      { id: "s2", name: "Inspect outdoor fan", description: "Ensure fan blades are free of debris", intervalMonths: 12, lastPerformed: "2025-10-10", nextDue: "2026-10-10" }
    ],
    serviceHistory: [
      { id: "e1", title: "Annual Compressor Diagnostic", performedAt: "2025-10-10", performedBy: "Daikin Tech Service", notes: "Diagnostics check normal, pressure level optimal", cost: 180.00 },
      { id: "e2", title: "Filter mesh cleaning", performedAt: "2026-02-15", performedBy: "Lena Müller", notes: "Cleaned and reinstalled air filters", cost: 0 }
    ]
  },
  {
    id: "d2",
    name: "Water Filtration System EcoWater",
    model: "ESD2752R25",
    serialNumber: "EW-87291-WS",
    location: "Basement",
    category: "Plumbing",
    status: "active",
    householdId: 1,
    imageUrl: undefined,
    assignedUser: { id: "u1", name: "Lena Müller" },
    manuals: [
      { id: "m3", title: "Water Softener Spec Sheet", fileSize: "1.1 MB", url: "#" }
    ],
    serviceSteps: [
      { id: "s3", name: "Refill salt pellets", description: "Add salt pellets to brine tank", intervalMonths: 2, lastPerformed: "2026-06-10", nextDue: "2026-08-10" },
      { id: "s4", name: "Sanitize system", description: "Run system disinfection cycle", intervalMonths: 12, lastPerformed: "2025-07-20", nextDue: "2026-07-20" }
    ],
    serviceHistory: [
      { id: "e3", title: "Salt Pellets Refill", performedAt: "2026-06-10", performedBy: "Lena Müller", notes: "Added 2 bags of salt pellets", cost: 15.50 }
    ]
  },
  {
    id: "d3",
    name: "Main Electric Panel Siemens",
    model: "S3030B1100SEC",
    serialNumber: "SI-0912-EP",
    location: "Basement Corridor",
    category: "Electrical",
    status: "active",
    householdId: 1,
    imageUrl: undefined,
    assignedUser: { id: "u2", name: "Alex Becker" },
    manuals: [
      { id: "m4", title: "Panel Wiring Diagram", fileSize: "2.5 MB", url: "#" }
    ],
    serviceSteps: [
      { id: "s5", name: "Test GFCI breakers", description: "Press test buttons on all GFCIs", intervalMonths: 6, lastPerformed: "2025-12-15", nextDue: "2026-06-15" }
    ],
    serviceHistory: [
      { id: "e4", title: "Panel Inspection", performedAt: "2025-06-15", performedBy: "Certified Electrician", notes: "Thermal scan and terminal tightening completed", cost: 120.00 }
    ]
  },
  {
    id: "d4",
    name: "Smart Security CCTV System Reolink",
    model: "RLK8-810B4-A",
    serialNumber: "REO-449102-CAM",
    location: "Exterior Walls",
    category: "Security",
    status: "maintenance",
    householdId: 2,
    imageUrl: undefined,
    assignedUser: { id: "u1", name: "Lena Müller" },
    manuals: [
      { id: "m5", title: "NVR Setup Guide", fileSize: "5.8 MB", url: "#" }
    ],
    serviceSteps: [
      { id: "s6", name: "Clean camera lenses", description: "Wipe camera glass with microfiber cloth", intervalMonths: 3, lastPerformed: "2026-05-01", nextDue: "2026-08-01" },
      { id: "s7", name: "Firmware updates check", description: "Search and install latest NVR firmware", intervalMonths: 6, lastPerformed: "2026-01-10", nextDue: "2026-07-10" }
    ],
    serviceHistory: [
      { id: "e5", title: "Lens Cleaning", performedAt: "2026-05-01", performedBy: "Lena Müller", notes: "Cleaned front lens of patio and driveway cameras", cost: 0 }
    ]
  },
  {
    id: "d5",
    name: "Irrigation Pump Gardena",
    model: "6000/6E LCD",
    serialNumber: "GAR-90812-IP",
    location: "Garden Shed",
    category: "Garden",
    status: "inactive",
    householdId: 2,
    imageUrl: undefined,
    assignedUser: { id: "u2", name: "Alex Becker" },
    manuals: [
      { id: "m6", title: "Garden Pump Operating Manual", fileSize: "3.4 MB", url: "#" }
    ],
    serviceSteps: [
      { id: "s8", name: "Winterization drain", description: "Drain all water to prevent freezing", intervalMonths: 12, lastPerformed: "2025-11-05", nextDue: "2026-11-05" }
    ],
    serviceHistory: [
      { id: "e6", title: "Winterization Drain Completed", performedAt: "2025-11-05", performedBy: "Alex Becker", notes: "Drained water body and disconnected from power grid", cost: 0 }
    ]
  },
  {
    id: "d6",
    name: "Dishwasher Miele G 7000",
    model: "G 7150 SCVi",
    serialNumber: "MIE-09182390-DW",
    location: "Kitchen",
    category: "Appliances",
    status: "active",
    householdId: 1,
    imageUrl: undefined,
    assignedUser: { id: "u1", name: "Lena Müller" },
    manuals: [
      { id: "m7", title: "Dishwasher User Manual", fileSize: "2.9 MB", url: "#" }
    ],
    serviceSteps: [
      { id: "s9", name: "Clean filter sieve", description: "Rinse microfilter sieve under running water", intervalMonths: 1, lastPerformed: "2026-07-01", nextDue: "2026-08-01" },
      { id: "s10", name: "Refill rinse aid", description: "Top up rinse aid indicator compartment", intervalMonths: 3, lastPerformed: "2026-06-15", nextDue: "2026-09-15" }
    ],
    serviceHistory: [
      { id: "e7", title: "Filter Clean", performedAt: "2026-07-01", performedBy: "Lena Müller", notes: "Cleaned dishwasher filter screen", cost: 0 }
    ]
  }
];
