import axios, { AxiosError } from "axios";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

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
