/**
 * Dedicated API service for shared editor operations
 * Handles saving and loading projects for shared editors without authentication
 */

import { ProjectState } from "../../pdf-editor/hooks/states/useProjectState";
import { API_CONFIG, getApiUrl } from "../../../config/api";

// API configuration
const PROJECT_STATE_ENDPOINT = getApiUrl(API_CONFIG.PROJECT_STATE.BASE);

// Types for shared editor operations
export interface SharedEditorSaveRequest {
  name: string;
  project_data: ProjectState;
  shared_project_id: string;
}

export interface SharedEditorLoadRequest {
  shared_project_id: string;
}

export interface SharedEditorResponse {
  success: boolean;
  message: string;
  project?: any;
}

/**
 * Get shared project context from localStorage
 */
function getSharedEditorContext() {
  if (typeof window === "undefined") {
    return { isSharedEditor: false, projectId: null, shareId: null };
  }

  try {
    const isSharedMode = localStorage.getItem("pdf-editor-shared-mode") === "true";
    const permissions = localStorage.getItem("pdf-editor-shared-permissions");
    const projectId = localStorage.getItem("pdf-editor-shared-project-id");
    const shareId = localStorage.getItem("pdf-editor-share-id");
    
    return {
      isSharedEditor: isSharedMode && permissions === "editor",
      projectId,
      shareId,
    };
  } catch (error) {
    console.warn("Failed to get shared editor context:", error);
    return { isSharedEditor: false, projectId: null, shareId: null };
  }
}

/**
 * Get auth token (same logic as main API service)
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const { useAuthStore } = require("../../../lib/store/AuthStore");
    const getToken = useAuthStore.getState().getAuthToken;
    return getToken();
  } catch (error) {
    console.warn("Could not access auth store:", error);
    return null;
  }
}

/**
 * Create headers for shared editor requests
 * Include auth token if available, plus shared editor identification
 */
function createSharedEditorHeaders(projectId: string): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "X-Shared-Editor": "true",
    "X-Shared-Project-Id": projectId,
  };

  // Include auth token if available (for users who are logged in)
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Handle API response errors
 */
async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = await response.json();
      if (errorData.message || errorData.error) {
        errorMessage = errorData.message || errorData.error;
      }
    } catch (parseError) {
      console.warn("Could not parse error response:", parseError);
    }

    throw new SharedEditorApiError(errorMessage, response.status);
  }

  try {
    return await response.json();
  } catch (parseError) {
    console.warn("Could not parse success response:", parseError);
    throw new SharedEditorApiError("Invalid response format", 500);
  }
}

/**
 * Save project state for shared editor using existing updateProject API
 */
export async function saveSharedEditorProject(projectState: ProjectState): Promise<SharedEditorResponse> {
  const context = getSharedEditorContext();
  
  if (!context.isSharedEditor || !context.projectId) {
    throw new SharedEditorApiError("Not in shared editor mode or missing project ID", 400);
  }

  console.log("SharedEditor: Saving project using updateProject API:", {
    projectId: context.projectId,
    projectName: projectState.name,
  });

  try {
    // Use the existing updateProject API endpoint
    const updateRequest = {
      name: projectState.name,
      project_data: projectState,
    };

    const response = await fetch(
      `${PROJECT_STATE_ENDPOINT}/projects/${context.projectId}`,
      {
        method: "PUT",
        headers: createSharedEditorHeaders(context.projectId),
        body: JSON.stringify(updateRequest),
      }
    );

    const result = await handleResponse<any>(response);
    
    return {
      success: true,
      message: "Project saved successfully",
      project: result,
    };
  } catch (error) {
    console.warn("SharedEditor: API call failed, trying direct import:", error);
    
    // Fallback: Try to use the existing projectApiService directly
    try {
      const { updateProject } = await import("../../pdf-editor/services/projectApiService");
      const result = await updateProject(context.projectId, {
        name: projectState.name,
        project_data: projectState,
      });
      
      return {
        success: true,
        message: "Project saved successfully via fallback",
        project: result,
      };
    } catch (fallbackError) {
      console.error("SharedEditor: Save fallback also failed:", fallbackError);
      throw new SharedEditorApiError("Failed to save project via API and fallback", 500);
    }
  }
}

/**
 * Load project state for shared editor using existing getProject API
 */
export async function loadSharedEditorProject(): Promise<ProjectState> {
  const context = getSharedEditorContext();
  
  if (!context.isSharedEditor || !context.projectId) {
    throw new SharedEditorApiError("Not in shared editor mode or missing project ID", 400);
  }

  console.log("SharedEditor: Loading project using getProject API:", {
    projectId: context.projectId,
  });

  try {
    // Try using the existing getProject API endpoint
    const response = await fetch(
      `${PROJECT_STATE_ENDPOINT}/projects/${context.projectId}`,
      {
        method: "GET",
        headers: createSharedEditorHeaders(context.projectId),
      }
    );

    const result = await handleResponse<{ project_data: ProjectState }>(response);
    return result.project_data;
  } catch (error) {
    console.warn("SharedEditor: API call failed, trying direct import:", error);
    
    // Fallback: Try to use the existing projectApiService directly
    try {
      const { getProject } = await import("../../pdf-editor/services/projectApiService");
      const project = await getProject(context.projectId);
      return project.project_data as ProjectState;
    } catch (fallbackError) {
      console.error("SharedEditor: Fallback also failed:", fallbackError);
      throw new SharedEditorApiError("Failed to load project from API and fallback", 500);
    }
  }
}

/**
 * Get current project info for shared editor using existing getProject API
 */
export async function getSharedEditorProjectInfo(): Promise<{ id: string; name: string; updated_at: string }> {
  const context = getSharedEditorContext();
  
  if (!context.isSharedEditor || !context.projectId) {
    throw new SharedEditorApiError("Not in shared editor mode or missing project ID", 400);
  }

  console.log("SharedEditor: Getting project info using getProject API:", {
    projectId: context.projectId,
  });

  // Use the existing getProject API endpoint  
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${context.projectId}`,
    {
      method: "GET",
      headers: createSharedEditorHeaders(context.projectId),
    }
  );

  const result = await handleResponse<{ id: string; name: string; updated_at: string }>(response);
  return {
    id: result.id,
    name: result.name,
    updated_at: result.updated_at,
  };
}

/**
 * Check if current user is in shared editor mode
 */
export function isSharedEditorMode(): boolean {
  return getSharedEditorContext().isSharedEditor;
}

/**
 * Error class for shared editor API errors
 */
export class SharedEditorApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "SharedEditorApiError";
  }
}