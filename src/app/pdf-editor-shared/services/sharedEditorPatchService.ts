/**
 * Patch service specifically for shared editors to update projects without authentication
 * Uses a dedicated endpoint that validates shared editor permissions via share ID
 */

import { API_CONFIG, getApiUrl } from "../../../config/api";
import { ProjectState } from "../../pdf-editor/hooks/states/useProjectState";

const PROJECT_STATE_ENDPOINT = getApiUrl(API_CONFIG.PROJECT_STATE.BASE);

export interface SharedEditorPatchRequest {
  share_id: string;
  project_data: ProjectState;
  name?: string;
}

export interface SharedEditorPatchResponse {
  success: boolean;
  message: string;
  project?: {
    id: string;
    name: string;
    updated_at: string;
  };
}

/**
 * Patch project data for shared editors using share ID validation
 * This endpoint doesn't require authentication - it validates permissions via share ID
 */
export async function patchSharedEditorProject(
  projectId: string,
  shareId: string,
  updates: {
    name?: string;
    project_data: ProjectState;
  }
): Promise<SharedEditorPatchResponse> {
  const request: SharedEditorPatchRequest = {
    share_id: shareId,
    project_data: updates.project_data,
    name: updates.name,
  };

  console.log("SharedEditorPatch: Sending PATCH request:", {
    projectId,
    shareId,
    endpoint: `${PROJECT_STATE_ENDPOINT}/projects/${projectId}/shared-editor-patch`,
  });

  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}/shared-editor-patch`,
    {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "X-Shared-Editor": "true",
        "X-Share-ID": shareId,
      },
      body: JSON.stringify(request),
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
    
    // Provide specific error messages for common cases
    if (response.status === 403) {
      throw new Error("You don't have editor permissions for this shared project");
    } else if (response.status === 404) {
      throw new Error("Shared project not found or no longer available");
    } else if (response.status === 400) {
      throw new Error("Invalid project data or share ID");
    }
    
    throw new Error(`Failed to update shared project: ${errorMessage}`);
  }

  return response.json();
}

/**
 * Validate if the current context has the required data for patching
 */
export function canPatchSharedProject(): { canPatch: boolean; reason?: string } {
  if (typeof window === "undefined") {
    return { canPatch: false, reason: "Not in browser environment" };
  }

  const isSharedMode = localStorage.getItem("pdf-editor-shared-mode") === "true";
  const permissions = localStorage.getItem("pdf-editor-shared-permissions");
  const shareId = localStorage.getItem("pdf-editor-share-id");
  const projectId = localStorage.getItem("pdf-editor-shared-project-id");

  if (!isSharedMode) {
    return { canPatch: false, reason: "Not in shared mode" };
  }

  if (permissions !== "editor") {
    return { canPatch: false, reason: "No editor permissions" };
  }

  if (!shareId) {
    return { canPatch: false, reason: "No share ID found" };
  }

  if (!projectId) {
    return { canPatch: false, reason: "No project ID found" };
  }

  return { canPatch: true };
}