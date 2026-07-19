import ky from "ky";
import { Household, Device, ServiceHistoryEvent, MaintenanceSubmitPayload } from "@/shared/types";

export interface ApiError {
  status?: number;
  message: string;
}

// Sanitize and resolve base host URLs to bypass client-side path mutations
const sanitizeUrl = (url: string | undefined, defaultFallback: string) => {
  let resolved = url || defaultFallback;
  if (resolved.startsWith("/")) {
    if (typeof window !== "undefined") {
      resolved = window.location.origin + resolved;
    } else {
      resolved = "http://loeger-os" + resolved;
    }
  }
  return resolved.endsWith("/") ? resolved : resolved + "/";
};

const MAINTENANCE_API_URL = sanitizeUrl(
  process.env.NEXT_PUBLIC_API_URL,
  "http://loeger-os/api/v1/maintenance/"
);

/**
 * Normalizes HTTP error payloads from FastAPI and throws custom ApiError objects.
 */
const handleResponseError = async (response: Response) => {
  let message = "maintenance.error.unrecognized_error";
  try {
    const data = await response.json();
    message = data?.detail || data?.message || message;
  } catch {
    message = response.statusText || message;
  }

  throw {
    status: response.status,
    message,
  } as ApiError;
};

// --- Maintenance Backend API Client ---
export const maintenanceClient = ky.create({
  prefixUrl: MAINTENANCE_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== "undefined") {
          const token = sessionStorage.getItem("token_maintenance-frontend");
          if (token) {
            request.headers.set("Authorization", `Bearer ${token}`);
          }
        }
      },
    ],
    afterResponse: [
      async (request, options, response) => {
        if (!response.ok) {
          await handleResponseError(response);
        }
      },
    ],
  },
});

export const getHouseholds = async (): Promise<Household[]> => {
  return await maintenanceClient.get("households").json<Household[]>();
};

export const getDevices = async (householdId?: number | null): Promise<Device[]> => {
  const searchParams: Record<string, string> = {};
  if (householdId !== undefined && householdId !== null) {
    searchParams["household_id"] = householdId.toString();
  }
  return await maintenanceClient.get("devices", { searchParams }).json<Device[]>();
};

export const submitMaintenance = async (payload: MaintenanceSubmitPayload): Promise<ServiceHistoryEvent> => {
  return await maintenanceClient.post("submit", { json: payload }).json<ServiceHistoryEvent>();
};

