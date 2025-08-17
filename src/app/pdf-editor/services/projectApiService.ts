/**
 * API service for managing PDF editor project state with Supabase backend
 */

import { ProjectState } from "../hooks/states/useProjectState";
import { API_CONFIG, getApiUrl } from "../../../config/api";
import { isSupabaseUrl, extractFilePathFromUrl, uploadFileToSupabase } from "./fileUploadService";

// API configuration
const PROJECT_STATE_ENDPOINT = getApiUrl(API_CONFIG.PROJECT_STATE.BASE);

// Types for API requests/responses
export interface CreateProjectRequest {
  name: string;
  description?: string;
  project_data: any; // Complete project state
  tags?: string[];
  is_public?: boolean;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  project_data?: any; // Updated project state (now optional for share updates)
  tags?: string[];
  is_public?: boolean;
  local_version?: number;
  share_id?: string;
  share_permissions?: "viewer" | "editor";
  requires_auth?: boolean;
}

export interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  current_page: number;
  num_pages: number;
  current_workflow_step: string;
  source_language: string;
  desired_language: string;
  tags: string[];
  is_public: boolean;
  sync_status: string;
  server_version: number;
  document_url?: string;
  file_type?: string;
  text_boxes_count: number;
  images_count: number;
}

export interface ProjectResponse {
  id: string;
  name: string;
  description?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
  project_data: any;
  current_page: number;
  num_pages: number;
  current_workflow_step: string;
  source_language: string;
  desired_language: string;
  tags: string[];
  is_public: boolean;
  sync_status: string;
  local_version: number;
  server_version: number;
}

export interface SyncRequest {
  project_data: any;
  local_version: number;
}

export interface SyncResponse {
  status: "synced" | "conflict";
  project?: ProjectResponse;
  local_data?: any;
  server_data?: any;
  server_version?: number;
}

/**
 * Get authentication token from Supabase auth store
 */
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;

  // Import the auth store dynamically to avoid SSR issues
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
 * Create headers with authentication
 */
function createHeaders(): HeadersInit {
  const token = getAuthToken();
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

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
    const errorText = await response.text();
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = JSON.parse(errorText);
      errorMessage = errorData.detail || errorData.message || errorMessage;

      // If it's a validation error, include more details
      if (errorData.detail && typeof errorData.detail === "object") {
        errorMessage = JSON.stringify(errorData.detail);
      }
    } catch {
      // Use error text if JSON parsing fails
      errorMessage = errorText || errorMessage;
    }

    // Log error details safely to avoid serialization issues
    console.error("API Error Details:");
    console.error("- Status:", response.status);
    console.error("- Status Text:", response.statusText);
    console.error("- URL:", response.url);
    console.error("- Error Text:", errorText);
    console.error("- Error Message:", errorMessage);

    throw new Error(errorMessage);
  }

  return response.json();
}

/**
 * Create a new project
 */
export async function createProject(
  request: CreateProjectRequest
): Promise<ProjectResponse> {
  const response = await fetch(`${PROJECT_STATE_ENDPOINT}/projects`, {
    method: "POST",
    headers: createHeaders(),
    body: JSON.stringify(request),
  });

  return handleResponse<ProjectResponse>(response);
}

/**
 * Get all user projects (with pagination)
 */
export async function listProjects(
  limit = 50,
  offset = 0
): Promise<ProjectSummary[]> {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });

  const response = await fetch(`${PROJECT_STATE_ENDPOINT}/projects?${params}`, {
    method: "GET",
    headers: createHeaders(),
  });

  return handleResponse<ProjectSummary[]>(response);
}

/**
 * Get a specific project by ID
 */
export async function getProject(projectId: string): Promise<ProjectResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}`,
    {
      method: "GET",
      headers: createHeaders(),
    }
  );

  return handleResponse<ProjectResponse>(response);
}

/**
 * Update a project
 */
export async function updateProject(
  projectId: string,
  request: UpdateProjectRequest
): Promise<ProjectResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}`,
    {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify(request),
    }
  );

  return handleResponse<ProjectResponse>(response);
}

/**
 * Delete a project
 */
export async function deleteProject(projectId: string): Promise<void> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}`,
    {
      method: "DELETE",
      headers: createHeaders(),
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to delete project: ${response.statusText}`);
  }
}

/**
 * Sync project with server (for offline support)
 */
export async function syncProject(
  projectId: string,
  request: SyncRequest
): Promise<SyncResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}/sync`,
    {
      method: "POST",
      headers: createHeaders(),
      body: JSON.stringify(request),
    }
  );

  return handleResponse<SyncResponse>(response);
}

/**
 * Search projects
 */
export async function searchProjects(
  query: string,
  limit = 20
): Promise<ProjectSummary[]> {
  const params = new URLSearchParams({
    q: query,
    limit: limit.toString(),
  });

  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/search?${params}`,
    {
      method: "GET",
      headers: createHeaders(),
    }
  );

  return handleResponse<ProjectSummary[]>(response);
}

/**
 * Get project statistics
 */
export async function getProjectStats(): Promise<any> {
  const response = await fetch(`${PROJECT_STATE_ENDPOINT}/stats`, {
    method: "GET",
    headers: createHeaders(),
  });

  return handleResponse<any>(response);
}

/**
 * Check API health
 */
export async function checkHealth(): Promise<any> {
  const response = await fetch(`${PROJECT_STATE_ENDPOINT}/health`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  return handleResponse<any>(response);
}

/**
 * Create a project automatically when a document is uploaded
 * This function generates an initial project state from the uploaded file
 */
export async function createProjectFromUpload(
  file: File,
  documentState: any,
  initialState: {
    viewState: any;
    elementCollections: any;
    layerState: any;
    editorState: any;
    sourceLanguage: string;
    desiredLanguage: string;
  }
): Promise<ProjectResponse> {
  // First, upload the file to Supabase storage
  const uploadResult = await uploadFileToSupabase(file, "project-uploads");
  
  // Generate a project name based on the file
  const fileName = file.name.replace(/\.[^/.]+$/, ""); // Remove extension
  const projectName = `${fileName} - ${new Date().toLocaleDateString()}`;

  // Create project data structure matching the saveProject format
  // Note: Removed custom ID generation - letting Supabase handle project IDs
  const projectData = {
    name: projectName,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    version: "1.0.0",
    documentState: {
      ...documentState,
      // Set the URL to the uploaded file URL from Supabase
      url: uploadResult.publicUrl,
      isSupabaseUrl: true,
      supabaseFilePath: uploadResult.filePath,
      // Convert Map and Set to serializable formats
      detectedPageBackgrounds: Object.fromEntries(
        documentState.detectedPageBackgrounds || new Map()
      ),
      deletedPages: Array.from(documentState.deletedPages || new Set()),
    },
    viewState: {
      currentView: initialState.viewState.currentView,
      currentWorkflowStep: initialState.viewState.currentWorkflowStep,
      activeSidebarTab: initialState.viewState.activeSidebarTab,
      isSidebarCollapsed: initialState.viewState.isSidebarCollapsed,
      isCtrlPressed: initialState.viewState.isCtrlPressed,
      zoomMode: initialState.viewState.zoomMode,
      containerWidth: initialState.viewState.containerWidth,
      transformOrigin: initialState.viewState.transformOrigin,
    },
    elementCollections: initialState.elementCollections,
    layerState: {
      originalLayerOrder: [...initialState.layerState.originalLayerOrder],
      translatedLayerOrder: [...initialState.layerState.translatedLayerOrder],
    },
    editorState: {
      selectedFieldId: null,
      selectedShapeId: null,
      isEditMode: initialState.editorState.isEditMode,
      isAddTextBoxMode: false,
      isTextSelectionMode: false,
      showDeletionRectangles: initialState.editorState.showDeletionRectangles,
      isImageUploadMode: false,
      isSelectionMode: false,
    },
    sourceLanguage: initialState.sourceLanguage,
    desiredLanguage: initialState.desiredLanguage,
  };

  console.log("DEBUG: Auto-creation - Project data being created:", {
    projectData,
    documentStateKeys: Object.keys(projectData.documentState),
    uploadResult,
    hasRequiredFields: {
      url: !!projectData.documentState.url,
      isDocumentLoaded: projectData.documentState.isDocumentLoaded,
      fileType: projectData.documentState.fileType,
      numPages: projectData.documentState.numPages,
    },
  });

  const createRequest: CreateProjectRequest = {
    name: projectName,
    description: `Project created from uploaded file: ${file.name}`,
    project_data: projectData,
    tags: [file.type.includes("pdf") ? "pdf" : "image", "auto-created"],
    is_public: false,
  };

  // Create the project and then update the project_data to include the ID
  const result = await createProject(createRequest);

  // Update the project data to include the generated ID
  if (result && result.id) {
    const updatedProjectData = {
      ...projectData,
      id: result.id, // Include the generated project ID
    };

    console.log("DEBUG: Updating project data to include ID:", result.id);

    // Update the project with the ID-inclusive project data
    await updateProject(result.id, {
      project_data: updatedProjectData,
    });

    // Return the result with updated project_data
    return {
      ...result,
      project_data: updatedProjectData,
    };
  }

  return result;
}

/**
 * Helper function to convert File to base64
 */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      if (typeof reader.result === "string") {
        // Remove the data:mime/type;base64, prefix
        const base64 = reader.result.split(",")[1];
        resolve(base64);
      } else {
        reject(new Error("Failed to convert file to base64"));
      }
    };
    reader.onerror = (error) => reject(error);
  });
}

/**
 * Check if user is authenticated using the auth store
 */
export function isAuthenticated(): boolean {
  if (typeof window === "undefined") return false;

  try {
    const { useAuthStore } = require("../../../lib/store/AuthStore");
    const state = useAuthStore.getState();
    return !!(state.user && state.session);
  } catch (error) {
    console.warn("Could not access auth store:", error);
    return false;
  }
}

/**
 * Get a shared project by share ID
 */
export async function getSharedProject(shareId: string): Promise<ProjectResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/shared/${shareId}`,
    {
      method: "GET",
      headers: createHeaders(),
    }
  );

  return handleResponse<ProjectResponse>(response);
}

/**
 * Update project sharing settings
 */
export async function updateProjectShareSettings(
  projectId: string,
  shareSettings: {
    is_public: boolean;
    share_id?: string;
    share_permissions?: "viewer" | "editor";
    requires_auth?: boolean;
  }
): Promise<ProjectResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}/share`,
    {
      method: "PUT",
      headers: createHeaders(),
      body: JSON.stringify(shareSettings),
    }
  );

  return handleResponse<ProjectResponse>(response);
}

/**
 * Get project share settings
 */
export async function getProjectShareSettings(
  projectId: string
): Promise<{
  is_public: boolean;
  share_id?: string;
  share_permissions?: "viewer" | "editor";
  requires_auth?: boolean;
  share_link?: string;
}> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}/share`,
    {
      method: "GET",
      headers: createHeaders(),
    }
  );

  return handleResponse(response);
}

/**
 * Error class for API-related errors
 */
export class ProjectApiError extends Error {
  constructor(message: string, public statusCode?: number) {
    super(message);
    this.name = "ProjectApiError";
  }
}
