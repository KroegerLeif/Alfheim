import axios, { AxiosError } from "axios";

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

const BASE_URL = sanitizeUrl(process.env.NEXT_PUBLIC_API_URL, "http://loeger-os/api/v1/pantry/");

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request Interceptor: Placeholder for Keycloak tokens and OTel headers
apiClient.interceptors.request.use(
  (config) => {
    // Future Keycloak token placement:
    // const token = getAuthToken();
    // if (token) {
    //   config.headers.Authorization = `Bearer ${token}`;
    // }

    // Future OpenTelemetry context propagation:
    // config.headers['traceparent'] = getTelemetryTraceId();

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Normalized error format
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    const status = error.response?.status;
    const data = error.response?.data;
    
    // Extract FastAPI detailed message: e.g. { detail: "..." }
    const message = 
      (data as any)?.detail || 
      error.message || 
      "An unexpected error occurred";

    console.error(`API Client Error [Status ${status}]:`, message);

    return Promise.reject({
      status,
      message,
      raw: error,
    });
  }
);
