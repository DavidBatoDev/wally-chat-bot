/**
 * API service for managing PDF editor project state with Supabase backend
 */

import { ProjectState } from "../hooks/states/useProjectState";
import { API_CONFIG, getApiUrl } from "../../../config/api";
import {
  isSupabaseUrl,
  extractFilePathFromUrl,
  uploadFileToSupabase,
} from "./fileUploadService";
import {
  getPdfPageCountFromFile,
  getFileTypeInfo,
  generateBlankCanvas,
  generateOcrBlankCanvas,
  isBirthCertificateOcrFile,
  isNBIClearanceOcrFile,
} from "../utils/pdfUtils";

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
    const { useAuthStore } = require("@/lib/store/AuthStore");
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
export async function getProject(
  projectId: string,
  authToken?: string | null
): Promise<ProjectResponse> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (authToken) {
    headers["Authorization"] = `Bearer ${authToken}`;
  } else {
    // Fallback to the old method
    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}`,
    {
      method: "GET",
      headers,
    }
  );

  return handleResponse<ProjectResponse>(response);
}

/**
 * Get a specific project by ID without authentication (public access)
 */
export async function getPublicProject(
  projectId: string
): Promise<ProjectResponse> {
  const response = await fetch(
    `${PROJECT_STATE_ENDPOINT}/projects/${projectId}/public`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
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

  // Get file type information and page count
  const fileInfo = getFileTypeInfo(file);
  let actualNumPages = 1; // Default to 1 page
  let actualPageWidth = 595; // Default A4 width in points
  let actualPageHeight = 842; // Default A4 height in points

  console.log("DEBUG: File upload - File info:", fileInfo);

  try {
    if (fileInfo.isPdf) {
      // Get actual page count and dimensions from PDF file
      console.log(
        "DEBUG: Processing PDF file, getting page count and dimensions..."
      );
      const pdfInfo = await getPdfPageCountFromFile(file);
      actualNumPages = pdfInfo.pageCount;
      actualPageWidth = pdfInfo.pageWidth;
      actualPageHeight = pdfInfo.pageHeight;
      console.log(
        `DEBUG: PDF file has ${actualNumPages} pages, dimensions: ${actualPageWidth}x${actualPageHeight}`
      );
    } else if (fileInfo.isImage) {
      // For images, we'll create a blank document page and place the image as an interactive element
      actualNumPages = 1;
      // For images, we'll use the actual image dimensions if available
      try {
        const img = new Image();
        const objectUrl = URL.createObjectURL(file);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = objectUrl;
        });
        actualPageWidth = img.width;
        actualPageHeight = img.height;
        URL.revokeObjectURL(objectUrl);
        console.log(
          `DEBUG: Image file dimensions: ${actualPageWidth}x${actualPageHeight}`
        );
      } catch (imgError) {
        console.warn(
          "Could not get image dimensions, using defaults:",
          imgError
        );
        actualPageWidth = 800;
        actualPageHeight = 600;
      }
      console.log(
        "DEBUG: Image file will be placed as interactive element on blank page"
      );
    } else {
      console.log("DEBUG: Unknown file type, treating as single page");
    }
  } catch (error) {
    console.warn(
      "Could not determine page count or dimensions, using defaults:",
      error
    );
    actualNumPages = 1;
    actualPageWidth = 595;
    actualPageHeight = 842;
  }

  console.log("DEBUG: Final page count and dimensions determined:", {
    numPages: actualNumPages,
    pageWidth: actualPageWidth,
    pageHeight: actualPageHeight,
  });

  // Generate image element if this is an image file
  let imageElement = null;
  let blankCanvasUrl = null;
  let isBirthCertificateOcr = false;
  let isNBIClearanceOcr = false;

  // Function to determine birth certificate template type based on filename
  const getBirthCertTemplateInfo = (fileName: string) => {
    const lowerFileName = fileName.toLowerCase();

    // Detect language and year from filename
    const isSpanish =
      lowerFileName.includes("spanish") ||
      lowerFileName.includes("español") ||
      lowerFileName.includes("espanol");
    const isFrench =
      lowerFileName.includes("french") ||
      lowerFileName.includes("français") ||
      lowerFileName.includes("francais");

    // Extract year (look for 4-digit numbers)
    const yearMatch = fileName.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? yearMatch[0] : "1993";

    // Determine template type
    let templateType = "English";
    if (isSpanish) templateType = "Spanish";
    else if (isFrench) templateType = "French";

    return {
      type: `${templateType}_${year}_template`,
      variation: `${templateType}_${year}`,
      language: templateType.toLowerCase(),
      year: year,
    };
  };

  // Function to determine NBI clearance template type based on filename
  const getNBIClearanceTemplateInfo = (fileName: string) => {
    const lowerFileName = fileName.toLowerCase();

    // Detect language from filename
    const isSpanish =
      lowerFileName.includes("spanish") ||
      lowerFileName.includes("español") ||
      lowerFileName.includes("espanol");
    const isFrench =
      lowerFileName.includes("french") ||
      lowerFileName.includes("français") ||
      lowerFileName.includes("francais");

    // Determine template type
    let templateType = "English";
    if (isSpanish) templateType = "Spanish";
    else if (isFrench) templateType = "French";

    return {
      type: `${templateType}_template`,
      variation: `${templateType}`,
      language: templateType.toLowerCase(),
    };
  };

  if (fileInfo.isImage) {
    const imageId = `img_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;

    // Check if this is for birth certificate OCR processing
    isBirthCertificateOcr = isBirthCertificateOcrFile(file);

    // Check if this is for NBI clearance OCR processing
    isNBIClearanceOcr = isNBIClearanceOcrFile(file);

    console.log("DEBUG: Image upload type:", {
      fileName: file.name,
      isBirthCertificateOcr,
      isNBIClearanceOcr,
      useOcrCanvas: isBirthCertificateOcr || isNBIClearanceOcr,
    });

    // Calculate image positioning - center the image on the page with some padding
    const padding = 50; // pixels of padding from edges
    const maxImageWidth = actualPageWidth - padding * 2;
    const maxImageHeight = actualPageHeight - padding * 2;

    // Scale image to fit within page bounds while maintaining aspect ratio
    const imageAspectRatio = actualPageWidth / actualPageHeight;
    let imageWidth = maxImageWidth;
    let imageHeight = maxImageHeight;

    if (imageWidth / imageHeight > imageAspectRatio) {
      // Page is wider than image aspect ratio
      imageWidth = maxImageHeight * imageAspectRatio;
    } else {
      // Page is taller than image aspect ratio
      imageHeight = maxImageWidth / imageAspectRatio;
    }

    // Center the image on the page
    const imageX = (actualPageWidth - imageWidth) / 2;
    const imageY = (actualPageHeight - imageHeight) / 2;

    imageElement = {
      id: imageId,
      x: imageX,
      y: imageY,
      width: imageWidth,
      height: imageHeight,
      page: 1,
      src: uploadResult.publicUrl,
      rotation: 0,
      opacity: 1,
      borderColor: "#cccccc",
      borderWidth: 1,
      borderRadius: 0,
      isSupabaseUrl: true,
      filePath: uploadResult.filePath,
      fileName: file.name,
      fileObjectId: uploadResult.fileObjectId,
    };

    console.log("DEBUG: Created image element:", imageElement);

    // Generate and upload a blank canvas as the main document
    try {
      let blankCanvas: Blob;

      if (isBirthCertificateOcr) {
        console.log(
          "DEBUG: Generating OCR-optimized blank canvas for birth certificate..."
        );
        // Use OCR-specific canvas with standard A4 dimensions
        blankCanvas = await generateOcrBlankCanvas();

        // Update page dimensions to match OCR canvas
        actualPageWidth = 595; // A4 width in points
        actualPageHeight = 842; // A4 height in points

        console.log("DEBUG: Updated dimensions for OCR processing:", {
          originalWidth: actualPageWidth,
          originalHeight: actualPageHeight,
          ocrWidth: actualPageWidth,
          ocrHeight: actualPageHeight,
        });
      } else {
        console.log(
          "DEBUG: Generating custom-sized blank canvas for image upload..."
        );
        blankCanvas = await generateBlankCanvas(
          actualPageWidth,
          actualPageHeight
        );
      }

      // Create a File object from the canvas blob
      const blankCanvasFile = new File([blankCanvas], "blank-canvas.png", {
        type: "image/png",
      });

      // Upload the blank canvas to Supabase
      const blankCanvasUploadResult = await uploadFileToSupabase(
        blankCanvasFile,
        "project-uploads"
      );
      blankCanvasUrl = blankCanvasUploadResult.publicUrl;

      console.log(
        "DEBUG: Blank canvas uploaded successfully:",
        blankCanvasUploadResult.publicUrl
      );
    } catch (canvasError) {
      console.warn(
        "Failed to generate/upload blank canvas, using original image as document:",
        canvasError
      );
      blankCanvasUrl = uploadResult.publicUrl; // Fallback to original image
    }
  }

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
      // Set the URL to the blank canvas for images, or original file for PDFs
      url: blankCanvasUrl || uploadResult.publicUrl,
      isSupabaseUrl: true,
      supabaseFilePath: blankCanvasUrl
        ? uploadResult.filePath.replace(file.name, "blank-canvas.png")
        : uploadResult.filePath,
      // Set the correct page count and dimensions from the actual file
      numPages: actualNumPages,
      pageWidth: actualPageWidth,
      pageHeight: actualPageHeight,
      // Set file type information - use PDF type for images since we're creating a document
      fileType: fileInfo.isImage ? "application/pdf" : fileInfo.mimeType,
      isDocumentLoaded: true,
      // Convert Map and Set to serializable formats
      detectedPageBackgrounds: Object.fromEntries(
        documentState.detectedPageBackgrounds || new Map()
      ),
      deletedPages: Array.from(documentState.deletedPages || new Set()),
      // Create pages array with blank page
      pages: Array.from({ length: actualNumPages }, (_, index) => {
        const pageData: any = {
          pageNumber: index + 1,
          isTranslated: false,
          elements: imageElement && index === 0 ? [imageElement.id] : [],
        };

        // Add universal template data for the first page if this is a template OCR project
        if (index === 0 && (isBirthCertificateOcr || isNBIClearanceOcr)) {
          const isBirthCert = isBirthCertificateOcr;
          const templateInfo = isBirthCert
            ? getBirthCertTemplateInfo(file.name)
            : getNBIClearanceTemplateInfo(file.name);

          pageData.pageType = isBirthCert ? "birth_cert" : "nbi_clearance";
          pageData.templateType = templateInfo.type;
          pageData.template = {
            id: `${pageData.pageType}_${templateInfo.language}${
              isBirthCert ? `_${(templateInfo as any).year}` : ""
            }`,
            doc_type: isBirthCert ? "birth_certificate" : "nbi_clearance",
            variation: templateInfo.variation,
            file_url: blankCanvasUrl, // Use the blank canvas as template
            info_json: {
              name: `${
                templateInfo.language.charAt(0).toUpperCase() +
                templateInfo.language.slice(1)
              } ${
                isBirthCert ? "Birth Certificate" : "NBI Clearance"
              } Template${isBirthCert ? ` ${(templateInfo as any).year}` : ""}`,
              width: actualPageWidth,
              height: actualPageHeight,
              language: templateInfo.language,
              ...(isBirthCert && { year: (templateInfo as any).year }),
            },
          };
        }

        return pageData;
      }),
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
    elementCollections: {
      ...initialState.elementCollections,
      // Add the uploaded image as an interactive element if it's an image file
      originalImages: imageElement ? [imageElement] : [],
    },
    layerState: {
      originalLayerOrder: imageElement
        ? [...initialState.layerState.originalLayerOrder, imageElement.id]
        : [...initialState.layerState.originalLayerOrder],
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

  console.log("DEBUG: Document state created with:", {
    originalNumPages: documentState.numPages,
    newNumPages: actualNumPages,
    originalPageWidth: documentState.pageWidth,
    newPageWidth: actualPageWidth,
    originalPageHeight: documentState.pageHeight,
    newPageHeight: actualPageHeight,
    url: blankCanvasUrl || uploadResult.publicUrl,
    originalImageUrl: fileInfo.isImage ? uploadResult.publicUrl : null,
    blankCanvasUrl: blankCanvasUrl,
    fileType: fileInfo.isImage ? "application/pdf" : fileInfo.mimeType,
    isDocumentLoaded: true,
    imageElement: imageElement
      ? {
          id: imageElement.id,
          dimensions: `${imageElement.width}x${imageElement.height}`,
          position: `(${imageElement.x}, ${imageElement.y})`,
        }
      : null,
    pages: imageElement
      ? "Created with image element on page 1"
      : "No image elements",
    isBirthCertificateOcr,
    isNBIClearanceOcr,
  });

  console.log("DEBUG: Auto-creation - Project data being created:", {
    projectData,
    documentStateKeys: Object.keys(projectData.documentState),
    uploadResult,
    fileInfo,
    actualNumPages,
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
    tags: [
      fileInfo.isImage
        ? isBirthCertificateOcr
          ? "birth-certificate-ocr"
          : "image-project"
        : file.type.includes("pdf")
        ? "pdf"
        : "document",
      "auto-created",
      fileInfo.isImage
        ? isBirthCertificateOcr
          ? "ocr-optimized"
          : "blank-canvas"
        : "original-file",
    ],
    is_public: false,
  };

  console.log("DEBUG: Final create request:", {
    name: createRequest.name,
    description: createRequest.description,
    tags: createRequest.tags,
    is_public: createRequest.is_public,
    project_data_keys: Object.keys(createRequest.project_data),
    documentState_keys: Object.keys(createRequest.project_data.documentState),
    numPages: createRequest.project_data.documentState.numPages,
    pageWidth: createRequest.project_data.documentState.pageWidth,
    pageHeight: createRequest.project_data.documentState.pageHeight,
    documentUrl: createRequest.project_data.documentState.url,
    isImageProject: fileInfo.isImage,
    hasImageElement: !!imageElement,
    isBirthCertificateOcr,
  });

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
export async function getSharedProject(
  shareId: string
): Promise<ProjectResponse> {
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
export async function getProjectShareSettings(projectId: string): Promise<{
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
