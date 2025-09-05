/**
 * API configuration for the PDF Editor application
 */

export const API_CONFIG = {
  // Base URL for the backend API
  BASE_URL:
    process.env.NEXT_PUBLIC_API_URL ||
    "https://wally-backend-523614903618.us-central1.run.app",

  // Project state endpoints
  PROJECT_STATE: {
    BASE: "/api/v1/project-state",
    PROJECTS: "/api/v1/project-state/projects",
    SYNC: (projectId: string) =>
      `/api/v1/project-state/projects/${projectId}/sync`,
    SEARCH: "/api/v1/project-state/projects/search",
    STATS: "/api/v1/project-state/stats",
    HEALTH: "/api/v1/project-state/health",
  },

  // Authentication endpoints (if needed)
  AUTH: {
    BASE: "/auth",
    LOGIN: "/auth/token",
    SIGNUP: "/auth/signup",
    ME: "/auth/me",
  },

  // Request timeout settings
  TIMEOUT: {
    DEFAULT: 30000, // 30 seconds
    UPLOAD: 120000, // 2 minutes for file uploads
    SYNC: 60000, // 1 minute for sync operations
  },

  // Retry settings
  RETRY: {
    MAX_ATTEMPTS: 3,
    DELAY: 1000, // 1 second base delay
  },
} as const;

/**
 * Get the full API URL for a given endpoint
 */
export function getApiUrl(endpoint: string): string {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
}

/**
 * Check if the API is configured correctly
 */
export function validateApiConfig(): boolean {
  return Boolean(API_CONFIG.BASE_URL);
}
