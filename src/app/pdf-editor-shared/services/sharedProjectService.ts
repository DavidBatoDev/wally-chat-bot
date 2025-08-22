/**
 * Service for handling shared project operations
 */

import { API_CONFIG, getApiUrl } from "../../../config/api";

const PROJECT_STATE_ENDPOINT = getApiUrl(API_CONFIG.PROJECT_STATE.BASE);

export interface SharedProjectResponse {
  id: string;
  name: string;
  description?: string;
  project_data: any;
  is_public: boolean;
  share_id: string;
  share_permissions: "viewer" | "editor";
  requires_auth: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Get a shared project by share ID (no authentication required)
 */
export async function getSharedProject(shareId: string): Promise<SharedProjectResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/shared/${shareId}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Update a shared project (for users with editor permissions)
 * Uses the shareId to identify the project
 */
export async function updateSharedProject(
  shareId: string,
  updates: {
    name?: string;
    project_data?: any;
  }
): Promise<SharedProjectResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/shared/${shareId}/update`,
    {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(updates),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
    
    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorData.message || errorMessage;
    } catch {
      errorMessage = errorText || errorMessage;
    }
    
    // Check for specific error types
    if (response.status === 403) {
      throw new Error("You don't have permission to edit this project");
    }
    
    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Check if user has editor permissions for a shared project
 */
export function hasEditorPermissions(): boolean {
  if (typeof window === "undefined") return false;
  
  const permissions = localStorage.getItem("pdf-editor-shared-permissions");
  return permissions === "editor";
}

/**
 * Check if currently in shared mode
 */
export function isInSharedMode(): boolean {
  if (typeof window === "undefined") return false;
  
  return localStorage.getItem("pdf-editor-shared-mode") === "true";
}

/**
 * Get current shared project ID
 */
export function getSharedProjectId(): string | null {
  if (typeof window === "undefined") return null;
  
  return localStorage.getItem("pdf-editor-shared-project-id");
}

/**
 * Clear shared mode data from localStorage
 */
export function clearSharedModeData(): void {
  if (typeof window === "undefined") return;
  
  localStorage.removeItem("pdf-editor-shared-mode");
  localStorage.removeItem("pdf-editor-shared-project-id");
  localStorage.removeItem("pdf-editor-shared-permissions");
  localStorage.removeItem("pdf-editor-share-id");
}