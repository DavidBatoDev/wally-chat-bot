// client/src/lib/api.ts
// Diagnostic-focused API interceptor that logs errors but doesn't redirect
import axios from "axios";
import { useAuthStore } from "@/lib/store/AuthStore";
import { clearAuthTokens } from "@/utils/clearAuth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// Create axios instance with base URL
const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token and log for debugging
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().getAuthToken();

  // Log request details for debugging
  console.log(`Request to: ${config.url}`);

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
    console.log("Token present:", token.substring(0, 10) + "...");
  } else {
    console.warn("⚠️ No auth token available for request to:", config.url);
  }

  return config;
});

// Response interceptor for error handling - DIAGNOSTIC MODE
// This version logs errors but doesn't redirect so we can see the actual errors
api.interceptors.response.use(
  (response) => {
    console.log(
      `✅ Success response from ${response.config.url}:`,
      response.status
    );
    return response;
  },
  async (error) => {
    // Create detailed error log
    const errorDetails = {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      headers: error.config?.headers
        ? {
            contentType: error.config.headers["Content-Type"],
            authorization: error.config.headers.Authorization
              ? "Bearer " +
                error.config.headers.Authorization.split(" ")[1]?.substring(
                  0,
                  10
                ) +
                "..."
              : "None",
          }
        : "None",
    };

    // Log the error with request details
    console.error("🔴 API Error Details:", errorDetails);

    // Handle auth errors but DON'T redirect yet - just log for diagnosis
    if (error.response?.status === 401) {
      console.error(
        "🔑 Authentication error (401): Token might be invalid or expired"
      );
      clearAuthTokens();
      // redirect to login page if needed
      window.location.href = "/auth/login";
    }

    if (error.response?.status === 403) {
      console.error(
        "🚫 Permission error (403): User may not have sufficient permissions"
      );
      clearAuthTokens();
      // redirect to login page if needed
      window.location.href = "/auth/login";
    }

    // Forward the error for component-level handling
    return Promise.reject(error);
  }
);

// Helper method for processing files with FormData
export const processFile = async (formData: FormData) => {
  try {
    const response = await api.post("/projects/process-file", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    return response.data;
  } catch (error) {
    console.error("Error processing file:", error);
    throw error;
  }
};

export default api;
