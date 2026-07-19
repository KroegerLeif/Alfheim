import ky, { HTTPError } from "ky";

export interface ApiError {
  status?: number;
  message: string;
}

// Retrieve base host URLs from environment configs
const SHOPPING_API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8010";
const PANTRY_API_URL = process.env.NEXT_PUBLIC_PANTRY_API_URL || "http://localhost:8000";

/**
 * Normalizes HTTP error payloads from FastAPI and throws custom ApiError objects.
 */
const handleResponseError = async (response: Response) => {
  let message = "shopping.error.unrecognized_error";
  try {
    const data = await response.json();
    // Support FastAPI standard details or direct translatable strings
    message = data?.detail || data?.message || message;
  } catch {
    // Fallback if response body is not JSON
    message = response.statusText || message;
  }

  throw {
    status: response.status,
    message,
  } as ApiError;
};

// --- Shopping Backend API Client ---
export const shoppingClient = ky.create({
  prefixUrl: SHOPPING_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== "undefined") {
          const token = sessionStorage.getItem("token_shopping-frontend");
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

// --- Pantry Backend API Client ---
export const pantryClient = ky.create({
  prefixUrl: PANTRY_API_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
  hooks: {
    beforeRequest: [
      (request) => {
        if (typeof window !== "undefined") {
          const token = sessionStorage.getItem("token_shopping-frontend");
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
