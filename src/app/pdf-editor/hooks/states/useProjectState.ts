import { useCallback, useState, useEffect } from "react";
import { toast } from "sonner";
import {
  DocumentState,
  ElementCollections,
  LayerState,
  ViewState,
  EditorState,
} from "../../types/pdf-editor.types";
import {
  createProject,
  updateProject,
  getProject,
  listProjects,
  deleteProject as deleteProjectApi,
  isAuthenticated,
  ProjectApiError,
} from "../../services/projectApiService";
import { useAuthStore } from "../../../../lib/store/AuthStore";
import {
  deleteFileFromSupabase,
  isSupabaseUrl,
  extractFilePathFromUrl,
} from "../../services/fileUploadService";

// Enhanced project state interface that captures all necessary data
export interface ProjectState {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: string; // For future compatibility
  documentState: {
    url: string;
    currentPage: number;
    numPages: number;
    scale: number;
    pageWidth: number;
    pageHeight: number;
    isLoading: boolean;
    error: string;
    fileType: string | null;
    imageDimensions: { width: number; height: number } | null;
    isDocumentLoaded: boolean;
    isPageLoading: boolean;
    isScaleChanging: boolean;
    pdfBackgroundColor: string;
    detectedPageBackgrounds: Record<number, string>; // Convert Map to Record for serialization
    pages: any[]; // PageData array
    deletedPages: number[]; // Convert Set to Array for serialization
    isTransforming: boolean;
    // Supabase storage fields
    supabaseFilePath?: string;
    isSupabaseUrl?: boolean;
    // Final layout fields
    finalLayoutUrl?: string;
    finalLayoutCurrentPage?: number;
    finalLayoutNumPages?: number;
    finalLayoutDeletedPages?: number[]; // Convert Set to Array for serialization
  };
  viewState: {
    currentView: "original" | "translated" | "split" | "final-layout";
    currentWorkflowStep: string;
    activeSidebarTab: string;
    isSidebarCollapsed: boolean;
    isCtrlPressed: boolean;
    zoomMode?: "page" | "width";
    containerWidth?: number;
    transformOrigin?: string;
  };
  elementCollections: ElementCollections;
  layerState: {
    originalLayerOrder: string[];
    translatedLayerOrder: string[];
    finalLayoutLayerOrder: string[];
  };
  editorState: {
    selectedFieldId: string | null;
    selectedShapeId: string | null;
    isEditMode: boolean;
    isAddTextBoxMode: boolean;
    isTextSelectionMode: boolean;
    showDeletionRectangles: boolean;
    isImageUploadMode: boolean;
    isSelectionMode: boolean;
    // Note: We don't save multiSelection as it's transient UI state
  };
  sourceLanguage: string;
  desiredLanguage: string;
  // Final layout settings
  finalLayoutSettings?: {
    exportSettings: {
      format: "pdf" | "png" | "jpg";
      quality: number;
      includeOriginal: boolean;
      includeTranslated: boolean;
      pageRange: "all" | "current" | "custom";
      customRange: string;
    };
    activeTab: "export" | "preview" | "settings";
    isPreviewMode: boolean;
  };
}

interface UseProjectStateProps {
  documentState: DocumentState;
  setDocumentState: (
    state: DocumentState | ((prev: DocumentState) => DocumentState)
  ) => void;
  elementCollections: ElementCollections;
  setElementCollections: (
    collections:
      | ElementCollections
      | ((prev: ElementCollections) => ElementCollections)
  ) => void;
  layerState: LayerState;
  setLayerState: (
    state: LayerState | ((prev: LayerState) => LayerState)
  ) => void;
  viewState: ViewState;
  setViewState: (state: ViewState | ((prev: ViewState) => ViewState)) => void;
  editorState: EditorState;
  setEditorState: (
    state: EditorState | ((prev: EditorState) => EditorState)
  ) => void;
  sourceLanguage: string;
  setSourceLanguage: (lang: string) => void;
  desiredLanguage: string;
  setDesiredLanguage: (lang: string) => void;
  // Final layout settings
  finalLayoutSettings?: {
    exportSettings: {
      format: "pdf" | "png" | "jpg";
      quality: number;
      includeOriginal: boolean;
      includeTranslated: boolean;
      pageRange: "all" | "current" | "custom";
      customRange: string;
    };
    activeTab: "export" | "preview" | "settings";
    isPreviewMode: boolean;
  };
  setFinalLayoutSettings?: (settings: {
    exportSettings: {
      format: "pdf" | "png" | "jpg";
      quality: number;
      includeOriginal: boolean;
      includeTranslated: boolean;
      pageRange: "all" | "current" | "custom";
      customRange: string;
    };
    activeTab: "export" | "preview" | "settings";
    isPreviewMode: boolean;
  }) => void;
}

// Helper function to safely convert various data types to arrays
const safeToArray = (value: any): any[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    // Handle Set-like objects
    if (value.size !== undefined && typeof value.forEach === 'function') {
      return Array.from(value);
    }
    // Handle plain objects that might have numeric keys
    if (Object.keys(value).every(key => !isNaN(Number(key)))) {
      return Object.values(value);
    }
  }
  return [];
};

export const useProjectState = (props: UseProjectStateProps) => {
  const {
    documentState,
    setDocumentState,
    elementCollections,
    setElementCollections,
    layerState,
    setLayerState,
    viewState,
    setViewState,
    editorState,
    setEditorState,
    sourceLanguage,
    setSourceLanguage,
    desiredLanguage,
    setDesiredLanguage,
  } = props;

  // Auth store for checking authentication status
  const { user, session } = useAuthStore();
  const isUserAuthenticated = !!(user && session);

  // State for tracking current project (no localStorage persistence)
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // Debug: Log when currentProjectId changes
  useEffect(() => {
    console.log("DEBUG: currentProjectId changed to:", currentProjectId);
  }, [currentProjectId]);

  // Clear project ID when user logs out
  useEffect(() => {
    if (!isUserAuthenticated) {
      console.log("User logged out, clearing current project ID");
      setCurrentProjectId(null);
    }
  }, [isUserAuthenticated]);

  // Note: Removed UUID validation since we're using Supabase-generated IDs
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Note: Removed custom ID generation - letting Supabase handle project IDs

  // Convert Map and Set objects to serializable formats and remove circular references
  const serializeDocumentState = useCallback((docState: DocumentState) => {
    // Create a clean copy without potential circular references
    const cleanDocState = {
      url: docState.url,
      currentPage: docState.currentPage,
      numPages: docState.numPages,
      scale: docState.scale,
      pageWidth: docState.pageWidth,
      pageHeight: docState.pageHeight,
      isLoading: docState.isLoading,
      error: docState.error,
      fileType: docState.fileType,
      imageDimensions: docState.imageDimensions,
      isDocumentLoaded: docState.isDocumentLoaded,
      isPageLoading: docState.isPageLoading,
      isScaleChanging: docState.isScaleChanging,
      pdfBackgroundColor: docState.pdfBackgroundColor,
      detectedPageBackgrounds: Object.fromEntries(
        docState.detectedPageBackgrounds
      ),
      pages: docState.pages,
      deletedPages: Array.from(docState.deletedPages),
      isTransforming: docState.isTransforming,
      supabaseFilePath: docState.supabaseFilePath,
      isSupabaseUrl: docState.isSupabaseUrl,
      // Final layout fields
      finalLayoutUrl: docState.finalLayoutUrl,
      finalLayoutCurrentPage: docState.finalLayoutCurrentPage,
      finalLayoutNumPages: docState.finalLayoutNumPages,
      finalLayoutDeletedPages: Array.from(docState.finalLayoutDeletedPages || []),
    };

    return cleanDocState;
  }, []);

  // Helper to get current project's created date
  const getCurrentProjectCreatedAt = useCallback(async () => {
    if (!currentProjectId || !isUserAuthenticated) {
      return new Date().toISOString();
    }

    try {
      console.log("Fetching project created date for:", currentProjectId);
      const project = await getProject(currentProjectId);
      console.log("Project fetched successfully:", {
        id: project?.id,
        created_at: project?.created_at,
      });
      return project?.created_at || new Date().toISOString();
    } catch (error) {
      // Log error details safely to avoid serialization issues
      console.error("Could not fetch project created date:");
      console.error("- Project ID:", currentProjectId);
      console.error(
        "- Error message:",
        error instanceof Error ? error.message : String(error)
      );
      console.error("- Error type:", typeof error);
      console.error("- Error constructor:", error?.constructor?.name);

      // If project doesn't exist (404), clear the invalid project ID
      if (error instanceof Error) {
        if (
          error.message.includes("404") ||
          error.message.includes("Not Found") ||
          error.message.includes("No data returned")
        ) {
          console.log(
            "Project not found, clearing invalid project ID:",
            currentProjectId
          );
          setCurrentProjectId(null);
        }
      }

      return new Date().toISOString();
    }
  }, [currentProjectId, isUserAuthenticated]);

  // Safe JSON serialization to prevent circular references and handle Next.js async params
  const safeSerialize = useCallback((obj: any) => {
    const seen = new WeakSet();

    const replacer = (key: string, val: any) => {
      // Skip functions
      if (typeof val === "function") {
        return "[Function]";
      }

      // Skip null/undefined
      if (val == null) {
        return val;
      }

      // Handle primitives
      if (typeof val !== "object") {
        return val;
      }

      // Check for circular references
      if (seen.has(val)) {
        return "[Circular Reference]";
      }
      seen.add(val);

      try {
        // Skip Next.js async params/searchParams that cause enumeration warnings
        if (
          val.constructor &&
          (val.constructor.name === "AsyncLocalStorage" ||
            val.constructor.name === "Promise" ||
            val.constructor.name.includes("Proxy") ||
            typeof val.then === "function")
        ) {
          return "[Next.js Async Param]";
        }

        // Skip specific problematic keys
        if (key === "params" || key === "searchParams") {
          return "[Next.js Param]";
        }

        // Skip DOM elements and React elements
        if (
          val.nodeType ||
          val._reactInternalFiber ||
          val.__reactFiber$ ||
          (val.$$typeof && val.$$typeof.toString().includes("Symbol"))
        ) {
          return "[DOM/React Element]";
        }

        // Skip objects that might have enumeration issues
        const descriptor = Object.getOwnPropertyDescriptor(val, "constructor");
        if (
          descriptor &&
          !descriptor.enumerable &&
          val.constructor.name.includes("HTML")
        ) {
          return "[HTML Element]";
        }

        return val;
      } catch (error) {
        // If we can't safely access the object, skip it
        console.warn(
          "Skipping problematic object during serialization:",
          error
        );
        return "[Problematic Object]";
      }
    };

    try {
      return JSON.parse(JSON.stringify(obj, replacer));
    } catch (error) {
      console.error("Safe serialization failed:", error);
      // Return a minimal safe version
      return {
        error: "Serialization failed",
        originalType: typeof obj,
        keys:
          obj && typeof obj === "object" ? Object.keys(obj).slice(0, 10) : [],
      };
    }
  }, []);

  // Convert serialized formats back to Map and Set objects

  // Save project to database (or localStorage as fallback)
  const saveProject = useCallback(
    async (projectNameOrEvent?: string | Event) => {
      if (isLoading) return null;

      // Handle case where React event is passed instead of project name
      let projectName: string | undefined;
      if (typeof projectNameOrEvent === "string") {
        projectName = projectNameOrEvent;
      } else if (
        projectNameOrEvent &&
        typeof projectNameOrEvent === "object" &&
        "type" in projectNameOrEvent
      ) {
        // It's a React event, ignore it and use default name
        console.warn(
          "React event passed to saveProject instead of project name, using default name"
        );
        projectName = undefined;
      } else {
        projectName = projectNameOrEvent as string | undefined;
      }

      setIsLoading(true);

      try {
        // Store the original project ID to determine if this should be an update
        const originalProjectId = currentProjectId;

        // Get created date safely, handling cases where project doesn't exist
        let createdAt: string;
        if (originalProjectId) {
          try {
            createdAt = await getCurrentProjectCreatedAt();
          } catch (error) {
            console.warn(
              "Failed to get project created date, using current time:",
              error
            );
            createdAt = new Date().toISOString();
            // Clear the invalid project ID since it doesn't exist
            setCurrentProjectId(null);
          }
        } else {
          createdAt = new Date().toISOString();
        }

        // Create the raw project state - include current project ID if available
        const rawProjectState = {
          id: originalProjectId || currentProjectId, // Include the project ID in the data
          name: projectName || `Project ${new Date().toLocaleDateString()}`,
          createdAt,
          updatedAt: new Date().toISOString(), // Always update the timestamp
          version: "1.0.0",
          documentState: serializeDocumentState(documentState),
          viewState: {
            currentView: viewState.currentView,
            currentWorkflowStep: viewState.currentWorkflowStep,
            activeSidebarTab: viewState.activeSidebarTab,
            isSidebarCollapsed: viewState.isSidebarCollapsed,
            isCtrlPressed: viewState.isCtrlPressed,
            zoomMode: viewState.zoomMode,
            containerWidth: viewState.containerWidth,
            transformOrigin: viewState.transformOrigin,
          },
          elementCollections,
          layerState: {
            originalLayerOrder: [...layerState.originalLayerOrder],
            translatedLayerOrder: [...layerState.translatedLayerOrder],
            finalLayoutLayerOrder: [...layerState.finalLayoutLayerOrder],
          },
          editorState: {
            selectedFieldId: editorState.selectedFieldId,
            selectedShapeId: editorState.selectedShapeId,
            isEditMode: editorState.isEditMode,
            isAddTextBoxMode: editorState.isAddTextBoxMode,
            isTextSelectionMode: editorState.isTextSelectionMode,
            showDeletionRectangles: editorState.showDeletionRectangles,
            isImageUploadMode: editorState.isImageUploadMode,
            isSelectionMode: editorState.isSelectionMode,
          },
          sourceLanguage,
          desiredLanguage,
          // Include final layout settings if we're in final-layout mode
          ...(viewState.currentWorkflowStep === "final-layout" &&
            props.finalLayoutSettings && {
              finalLayoutSettings: props.finalLayoutSettings,
            }),
        };

        // Apply safe serialization to prevent circular references
        console.log("DEBUG: Raw project state before serialization:", {
          keys: Object.keys(rawProjectState),
          elementCollectionsKeys: Object.keys(
            rawProjectState.elementCollections || {}
          ),
          documentStateKeys: Object.keys(rawProjectState.documentState || {}),
        });

        const projectState: ProjectState = safeSerialize(rawProjectState);

        console.log("DEBUG: Manual save - Project state being saved:");
        console.log("- Original Project ID:", originalProjectId);
        console.log("- Current Project ID:", currentProjectId);
        console.log("- Is Update:", !!originalProjectId);
        console.log("- Project Name:", projectState.name);
        console.log(
          "- Will Update:",
          !!(originalProjectId && currentProjectId)
        );
        console.log("- Will Create:", !(originalProjectId && currentProjectId));

        if (isUserAuthenticated) {
          // Save to Supabase for authenticated users
          try {
            let result;

            if (originalProjectId && currentProjectId) {
              // First, verify the project still exists before attempting to update
              console.log("DEBUG: Verifying project exists before update:", currentProjectId);
              
              try {
                await getProject(currentProjectId);
                console.log("DEBUG: Project exists, proceeding with update");
                
                // Update existing project
                console.log("DEBUG: Updating existing project:", {
                  projectId: currentProjectId,
                  updateData: {
                    name: projectState.name,
                    project_data: projectState,
                  },
                });

                result = await updateProject(currentProjectId, {
                  name: projectState.name,
                  project_data: projectState,
                });

                console.log("DEBUG: Update result:", result);

                // Ensure the project ID is preserved after update
                if (result && !result.id) {
                  console.log(
                    "DEBUG: Update result missing ID, preserving current project ID"
                  );
                  result.id = currentProjectId;
                } else if (result && result.id !== currentProjectId) {
                  console.log(
                    "DEBUG: Update result has different ID, updating current project ID:",
                    {
                      from: currentProjectId,
                      to: result.id,
                    }
                  );
                  setCurrentProjectId(result.id);
                }
              } catch (verifyError) {
                console.log("DEBUG: Project no longer exists, creating new one instead:", {
                  originalProjectId: currentProjectId,
                  error: verifyError instanceof Error ? verifyError.message : String(verifyError),
                });
                
                // Clear the invalid project ID
                setCurrentProjectId(null);
                
                // Fall through to create new project
                result = await createProject({
                  name: projectState.name,
                  description: `Project created on ${new Date().toLocaleDateString()}`,
                  project_data: projectState,
                  tags: ["manual-save"],
                  is_public: false,
                });

                console.log("DEBUG: Create result (from failed update):", result);

                // Set the current project ID for future saves
                setCurrentProjectId(result.id);
              }
            } else {
              // Create new project (either no original ID or project was deleted)
              console.log("DEBUG: Creating new project:", {
                reason: originalProjectId
                  ? "Original project not found"
                  : "No existing project",
                name: projectState.name,
                project_data: projectState,
              });

              result = await createProject({
                name: projectState.name,
                description: `Project created on ${new Date().toLocaleDateString()}`,
                project_data: projectState,
                tags: ["manual-save"],
                is_public: false,
              });

              console.log("DEBUG: Create result:", result);

              // Set the current project ID for future saves
              setCurrentProjectId(result.id);
            }

            toast.success(
              `Project "${projectState.name}" saved to your account!`
            );

            // Ensure we return the correct project ID
            const finalProjectId =
              result.id || currentProjectId || originalProjectId;
            console.log("DEBUG: Final project ID for return:", finalProjectId);

            return { ...projectState, id: finalProjectId };
          } catch (apiError) {
            console.error("Failed to save project to Supabase:", {
              error: apiError,
              errorMessage:
                apiError instanceof Error ? apiError.message : String(apiError),
              projectState: {
                id: projectState.id,
                name: projectState.name,
                currentProjectId,
              },
            });

            const errorMessage =
              apiError instanceof Error
                ? apiError.message
                : "Unknown error occurred";
            toast.error(`Failed to save project: ${errorMessage}`);
            return null;
          }
        } else {
          // Save to localStorage for non-authenticated users
          const storageKey = `pdf-editor-project-${projectState.id}`;
          localStorage.setItem(storageKey, JSON.stringify(projectState));
          localStorage.setItem("pdf-editor-current-project", storageKey);

          toast.success(`Project "${projectState.name}" saved locally!`);
          return projectState;
        }
      } catch (error) {
        console.error("Error saving project:", error);
        toast.error("Failed to save project");
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      currentProjectId,
      serializeDocumentState,
      getCurrentProjectCreatedAt,
      safeSerialize,
      documentState,
      viewState,
      elementCollections,
      layerState,
      editorState,
      sourceLanguage,
      desiredLanguage,
      isUserAuthenticated,
    ]
  );

  // Load project from database (prioritize Supabase for authenticated users)
  const loadProject = useCallback(
    async (projectId?: string) => {
      if (isLoading) return false;

      setIsLoading(true);

      try {
        let projectState: ProjectState | null = null;

        if (isUserAuthenticated) {
          try {
            if (projectId) {
              // Load specific project by ID
              const apiProject = await getProject(projectId);
              if (apiProject) {
                projectState = apiProject.project_data as ProjectState;
                console.log(
                  "DEBUG: Setting current project ID from loaded project:",
                  apiProject.id
                );
                setCurrentProjectId(apiProject.id);

                console.log(
                  "DEBUG: Current project ID after setting:",
                  apiProject.id
                );

                console.log("DEBUG: Loaded specific project from Supabase:", {
                  projectId,
                  projectState,
                  documentStateKeys: Object.keys(projectState.documentState),
                  hasRequiredFields: {
                    url: !!projectState.documentState.url,
                    isDocumentLoaded:
                      projectState.documentState.isDocumentLoaded,
                    fileType: projectState.documentState.fileType,
                    numPages: projectState.documentState.numPages,
                  },
                });
              }
            } else {
              // Load user's most recent project
              const userProjects = await listProjects(1, 0);
              if (userProjects.length > 0) {
                const mostRecentProject = userProjects[0];
                const apiProject = await getProject(mostRecentProject.id);
                if (apiProject) {
                  projectState = apiProject.project_data as ProjectState;
                  console.log(
                    "DEBUG: Setting current project ID from most recent project:",
                    apiProject.id
                  );
                  setCurrentProjectId(apiProject.id);

                  console.log(
                    "DEBUG: Current project ID after setting (most recent):",
                    apiProject.id
                  );

                  console.log(
                    "DEBUG: Loaded most recent project from Supabase:",
                    {
                      projectState,
                      documentStateKeys: Object.keys(
                        projectState.documentState
                      ),
                      hasRequiredFields: {
                        url: !!projectState.documentState.url,
                        isDocumentLoaded:
                          projectState.documentState.isDocumentLoaded,
                        fileType: projectState.documentState.fileType,
                        numPages: projectState.documentState.numPages,
                      },
                    }
                  );
                }
              }
            }
          } catch (apiError) {
            console.error("Failed to load project from Supabase:", apiError);
            toast.error("Failed to load project from your account");
            return false;
          }
        } else {
          // For non-authenticated users, still use localStorage as fallback
          let storageKey: string;

          if (projectId) {
            storageKey = `pdf-editor-project-${projectId}`;
          } else {
            // Load the current project
            const currentProjectKey = localStorage.getItem(
              "pdf-editor-current-project"
            );
            if (!currentProjectKey) {
              toast.error("No saved project found");
              return false;
            }
            storageKey = currentProjectKey;
          }

          const savedProject = localStorage.getItem(storageKey);
          if (!savedProject) {
            toast.error("Project not found");
            return false;
          }

          projectState = JSON.parse(savedProject);
        }

        if (!projectState) {
          toast.error("Project not found");
          return false;
        }

        // Debug logging for project state structure
        console.log("DEBUG: Project state loaded:", {
          hasDocumentState: !!projectState.documentState,
          deletedPagesType: typeof projectState.documentState?.deletedPages,
          deletedPagesValue: projectState.documentState?.deletedPages,
          isDeletedPagesArray: Array.isArray(projectState.documentState?.deletedPages),
        });

        // Restore document state (similar to importFromJson)
        setDocumentState((prev) => ({
          ...prev,
          ...projectState.documentState,
          // Convert arrays back to Sets/Maps where needed
          deletedPages: new Set(safeToArray(projectState.documentState.deletedPages)),
          detectedPageBackgrounds: new Map(
            Object.entries(
              projectState.documentState.detectedPageBackgrounds || {}
            ).map(([key, value]) => [parseInt(key), value])
          ),
          // Convert final layout deleted pages back to Set if it exists
          finalLayoutDeletedPages: projectState.documentState.finalLayoutDeletedPages 
            ? new Set(safeToArray(projectState.documentState.finalLayoutDeletedPages))
            : new Set<number>(),
          // Ensure fileType is properly typed
          fileType:
            (projectState.documentState.fileType as "pdf" | "image" | null) ||
            null,
          isDocumentLoaded: true, // Ensure document is marked as loaded
          isLoading: false, // Ensure loading state is false
          error: "", // Clear any errors
        }));

        // Restore view state with proper type validation (similar to importFromJson)
        setViewState((prev) => ({
          ...prev,
          ...projectState.viewState,
          // Ensure activeSidebarTab is properly typed
          activeSidebarTab: (["pages", "tools", "chat"].includes(
            projectState.viewState.activeSidebarTab
          )
            ? projectState.viewState.activeSidebarTab
            : "pages") as "pages" | "tools" | "chat",
          // Ensure currentWorkflowStep is properly typed
          currentWorkflowStep: ([
            "translate",
            "layout",
            "final-layout",
          ].includes(projectState.viewState.currentWorkflowStep)
            ? projectState.viewState.currentWorkflowStep
            : "translate") as "translate" | "layout" | "final-layout",
        }));

        // Restore element collections
        setElementCollections(projectState.elementCollections);

        // Restore layer state (ensure arrays are properly copied)
        setLayerState({
          originalLayerOrder: [...projectState.layerState.originalLayerOrder],
          translatedLayerOrder: [
            ...projectState.layerState.translatedLayerOrder,
          ],
          finalLayoutLayerOrder: [...(projectState.layerState.finalLayoutLayerOrder || [])],
        });

        // Restore editor state (similar to importFromJson)
        setEditorState((prev) => ({
          ...prev,
          ...projectState.editorState,
          // Reset transient state for safety
          selectedFieldId: null,
          selectedShapeId: null,
          isAddTextBoxMode: false,
          isTextSelectionMode: false,
          isImageUploadMode: false,
          isSelectionMode: false,
          multiSelection: {
            selectedElements: [],
            selectionBounds: null,
            isDrawingSelection: false,
            selectionStart: null,
            selectionEnd: null,
            isMovingSelection: false,
            moveStart: null,
            targetView: null,
          },
        }));

        // Restore language settings
        setSourceLanguage(projectState.sourceLanguage);
        setDesiredLanguage(projectState.desiredLanguage);

        // Restore final layout settings if they exist
        if (projectState.finalLayoutSettings && props.setFinalLayoutSettings) {
          console.log(
            "DEBUG: Restoring final layout settings:",
            projectState.finalLayoutSettings
          );
          props.setFinalLayoutSettings(projectState.finalLayoutSettings);
        }

        // Log final layout URL restoration
        if (projectState.documentState.finalLayoutUrl) {
          console.log(
            "DEBUG: Final layout URL restored:",
            {
              finalLayoutUrl: projectState.documentState.finalLayoutUrl,
              finalLayoutCurrentPage: projectState.documentState.finalLayoutCurrentPage,
              finalLayoutNumPages: projectState.documentState.finalLayoutNumPages,
              finalLayoutDeletedPages: projectState.documentState.finalLayoutDeletedPages,
            }
          );
        } else {
          console.log("DEBUG: No final layout URL found in project data");
        }

        // Update current project info - use the actual project ID we loaded, not projectState.id
        if (isUserAuthenticated && (projectId || projectState.id)) {
          // Prefer the projectId we used to load, fallback to projectState.id
          const actualProjectId = projectId || projectState.id;
          console.log(
            "DEBUG: Final setCurrentProjectId call with:",
            actualProjectId,
            {
              projectId,
              projectStateId: projectState.id,
              using: projectId ? "projectId parameter" : "projectState.id",
            }
          );
          setCurrentProjectId(actualProjectId);
          console.log(
            "DEBUG: Load project completed - currentProjectId should be:",
            actualProjectId
          );
        } else if (!isUserAuthenticated) {
          console.log(
            "DEBUG: User not authenticated, not setting currentProjectId"
          );
        } else {
          console.log("DEBUG: No project ID available to set");
        }

        const source = isUserAuthenticated && projectId ? "account" : "locally";
        toast.success(`Project "${projectState.name}" loaded ${source}!`);
        return true;
      } catch (error) {
        console.error("Error loading project:", error);
        toast.error("Failed to load project");
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      isUserAuthenticated,
      setDocumentState,
      setViewState,
      setElementCollections,
      setLayerState,
      setEditorState,
      setSourceLanguage,
      setDesiredLanguage,
      setCurrentProjectId,
    ]
  );

  // Export project data as JSON file
  const exportToJson = useCallback(
    (projectName?: string) => {
      try {
        const projectState: ProjectState = {
          id: `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: projectName || `Export ${new Date().toLocaleDateString()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          version: "1.0.0",
          documentState: serializeDocumentState(documentState),
          viewState: {
            currentView: viewState.currentView,
            currentWorkflowStep: viewState.currentWorkflowStep,
            activeSidebarTab: viewState.activeSidebarTab,
            isSidebarCollapsed: viewState.isSidebarCollapsed,
            isCtrlPressed: viewState.isCtrlPressed,
            zoomMode: viewState.zoomMode,
            containerWidth: viewState.containerWidth,
            transformOrigin: viewState.transformOrigin,
          },
          elementCollections,
          layerState: {
            originalLayerOrder: [...layerState.originalLayerOrder],
            translatedLayerOrder: [...layerState.translatedLayerOrder],
            finalLayoutLayerOrder: [...layerState.finalLayoutLayerOrder],
          },
          editorState: {
            selectedFieldId: editorState.selectedFieldId,
            selectedShapeId: editorState.selectedShapeId,
            isEditMode: editorState.isEditMode,
            isAddTextBoxMode: editorState.isAddTextBoxMode,
            isTextSelectionMode: editorState.isTextSelectionMode,
            showDeletionRectangles: editorState.showDeletionRectangles,
            isImageUploadMode: editorState.isImageUploadMode,
            isSelectionMode: editorState.isSelectionMode,
          },
          sourceLanguage,
          desiredLanguage,
          // Include final layout settings if we're in final-layout mode
          ...(viewState.currentWorkflowStep === "final-layout" &&
            props.finalLayoutSettings && {
              finalLayoutSettings: props.finalLayoutSettings,
            }),
        };

        // Create and download JSON file
        const jsonString = JSON.stringify(projectState, null, 2);
        const blob = new Blob([jsonString], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = url;
        link.download = `${projectState.name.replace(
          /[^a-zA-Z0-9]/g,
          "_"
        )}_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        URL.revokeObjectURL(url);

        toast.success("Project exported as JSON successfully!");
        return projectState;
      } catch (error) {
        console.error("Error exporting project:", error);
        toast.error("Failed to export project");
        return null;
      }
    },
    [
      serializeDocumentState,
      documentState,
      viewState,
      elementCollections,
      layerState,
      editorState,
      sourceLanguage,
      desiredLanguage,
    ]
  );

  // Get list of saved projects from database (or localStorage as fallback)
  const getSavedProjects = useCallback(async () => {
    try {
      if (isUserAuthenticated) {
        // Get projects from Supabase for authenticated users
        try {
          const apiProjects = await listProjects(50, 0);
          return apiProjects.map((project) => ({
            id: project.id,
            name: project.name,
            createdAt: project.created_at,
            storageKey: `api-project-${project.id}`,
            source: "database" as const,
          }));
        } catch (apiError) {
          console.error("Failed to fetch projects from Supabase:", apiError);
          toast.error("Failed to load your projects");
          return [];
        }
      }

      // For non-authenticated users, use localStorage
      const projects: Array<{
        id: string;
        name: string;
        createdAt: string;
        storageKey: string;
        source: "localStorage";
      }> = [];

      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith("pdf-editor-project-")) {
          try {
            const projectData = localStorage.getItem(key);
            if (projectData) {
              const project: ProjectState = JSON.parse(projectData);
              projects.push({
                id: project.id,
                name: project.name,
                createdAt: project.createdAt,
                storageKey: key,
                source: "localStorage",
              });
            }
          } catch (error) {
            console.warn(`Failed to parse project from key ${key}:`, error);
          }
        }
      }

      // Sort by creation date (newest first)
      return projects.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
    } catch (error) {
      console.error("Error getting saved projects:", error);
      return [];
    }
  }, [isUserAuthenticated]);

  // Delete a saved project from database (or localStorage as fallback)
  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        let projectData: any = null;

        // Try to get project data first to clean up files
        if (isUserAuthenticated) {
          try {
            const project = await getProject(projectId);
            projectData = project?.project_data;
          } catch (error) {
            console.warn("Could not fetch project data for cleanup:", error);
          }
        } else {
          // Try to get from localStorage
          const storageKey = `pdf-editor-project-${projectId}`;
          const storedData = localStorage.getItem(storageKey);
          if (storedData) {
            try {
              projectData = JSON.parse(storedData);
            } catch (error) {
              console.warn("Could not parse stored project data:", error);
            }
          }
        }

        // Clean up Supabase files if project data is available
        if (projectData) {
          const cleanupTasks: Promise<void>[] = [];

          // Clean up main document file
          if (projectData.documentState?.supabaseFilePath) {
            cleanupTasks.push(
              deleteFileFromSupabase(projectData.documentState.supabaseFilePath)
                .then(() => {})
                .catch((error) =>
                  console.warn("Failed to delete main document file:", error)
                )
            );
          } else if (
            projectData.documentState?.url &&
            isSupabaseUrl(projectData.documentState.url)
          ) {
            const filePath = extractFilePathFromUrl(
              projectData.documentState.url
            );
            if (filePath) {
              cleanupTasks.push(
                deleteFileFromSupabase(filePath)
                  .then(() => {})
                  .catch((error) =>
                    console.warn("Failed to delete main document file:", error)
                  )
              );
            }
          }

          // Clean up original document file if stored in Supabase
          if (projectData.originalDocumentFile?.supabaseFilePath) {
            cleanupTasks.push(
              deleteFileFromSupabase(
                projectData.originalDocumentFile.supabaseFilePath
              )
                .then(() => {})
                .catch((error) =>
                  console.warn(
                    "Failed to delete original document file:",
                    error
                  )
                )
            );
          }

          // Clean up image files from element collections
          const cleanupImageFiles = (images: any[]) => {
            images?.forEach((image) => {
              if (image.src && isSupabaseUrl(image.src)) {
                const filePath =
                  image.filePath || extractFilePathFromUrl(image.src);
                if (filePath) {
                  cleanupTasks.push(
                    deleteFileFromSupabase(filePath, image.fileObjectId)
                      .then(() => {})
                      .catch((error) =>
                        console.warn(
                          `Failed to delete image file ${filePath}:`,
                          error
                        )
                      )
                  );
                }
              }
            });
          };

          // Clean up images from both original and translated collections
          if (projectData.elementCollections) {
            cleanupImageFiles(projectData.elementCollections.originalImages);
            cleanupImageFiles(projectData.elementCollections.translatedImages);
          }

          // Execute all cleanup tasks in parallel (don't wait for completion)
          if (cleanupTasks.length > 0) {
            Promise.allSettled(cleanupTasks).then((results) => {
              const failures = results.filter(
                (r) => r.status === "rejected"
              ).length;
              if (failures > 0) {
                console.warn(
                  `${failures} file cleanup tasks failed during project deletion`
                );
              } else {
                console.log("All project files cleaned up successfully");
              }
            });
          }
        }

        // Delete the project record
        if (isUserAuthenticated) {
          try {
            await deleteProjectApi(projectId);

            // Clear current project if it was deleted
            if (currentProjectId === projectId) {
              setCurrentProjectId(null);
            }

            toast.success(
              "Project and associated files deleted from your account"
            );
            return true;
          } catch (apiError) {
            console.error("Failed to delete project from Supabase:", apiError);
            toast.error("Failed to delete project from your account");
            return false;
          }
        } else {
          // Delete from localStorage for non-authenticated users
          const storageKey = `pdf-editor-project-${projectId}`;
          localStorage.removeItem(storageKey);

          // If this was the current project, clear the reference
          const currentProjectKey = localStorage.getItem(
            "pdf-editor-current-project"
          );
          if (currentProjectKey === storageKey) {
            localStorage.removeItem("pdf-editor-current-project");
          }

          toast.success("Project deleted locally");
          return true;
        }
      } catch (error) {
        console.error("Error deleting project:", error);
        toast.error("Failed to delete project");
        return false;
      }
    },
    [isUserAuthenticated, currentProjectId]
  );

  // Import project data from JSON file
  const importFromJson = useCallback(
    async (file: File): Promise<boolean> => {
      try {
        const fileContent = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => {
            if (event.target?.result) {
              resolve(event.target.result as string);
            } else {
              reject(new Error("Failed to read file"));
            }
          };
          reader.onerror = () => reject(new Error("File reading error"));
          reader.readAsText(file);
        });

        // Parse and validate JSON
        let projectData: ProjectState;
        try {
          projectData = JSON.parse(fileContent);
        } catch (parseError) {
          toast.error("Invalid JSON file format");
          return false;
        }

        // Validate that it's a valid project state
        if (
          !projectData.id ||
          !projectData.name ||
          !projectData.documentState
        ) {
          toast.error("Invalid project file - missing required fields");
          return false;
        }

        // Apply the imported state
        setDocumentState((prev) => ({
          ...prev,
          ...projectData.documentState,
          // Convert arrays back to Sets/Maps where needed
          deletedPages: new Set(safeToArray(projectData.documentState.deletedPages)),
          detectedPageBackgrounds: new Map(
            Object.entries(
              projectData.documentState.detectedPageBackgrounds || {}
            ).map(([key, value]) => [parseInt(key), value])
          ),
          // Convert final layout deleted pages back to Set if it exists
          finalLayoutDeletedPages: projectData.documentState.finalLayoutDeletedPages 
            ? new Set(safeToArray(projectData.documentState.finalLayoutDeletedPages))
            : new Set<number>(),
          // Ensure fileType is properly typed
          fileType:
            (projectData.documentState.fileType as "pdf" | "image" | null) ||
            null,
        }));

        // Restore view state with proper type validation
        setViewState((prev) => ({
          ...prev,
          ...projectData.viewState,
          // Ensure activeSidebarTab is properly typed
          activeSidebarTab: (["pages", "tools", "chat"].includes(
            projectData.viewState.activeSidebarTab
          )
            ? projectData.viewState.activeSidebarTab
            : "pages") as "pages" | "tools" | "chat",
          // Ensure currentWorkflowStep is properly typed
          currentWorkflowStep: ([
            "translate",
            "layout",
            "final-layout",
          ].includes(projectData.viewState.currentWorkflowStep)
            ? projectData.viewState.currentWorkflowStep
            : "translate") as "translate" | "layout" | "final-layout",
        }));

        // Restore element collections
        setElementCollections(projectData.elementCollections);

        // Restore layer state
        setLayerState({
          originalLayerOrder: [...projectData.layerState.originalLayerOrder],
          translatedLayerOrder: [
            ...projectData.layerState.translatedLayerOrder,
          ],
          finalLayoutLayerOrder: [...(projectData.layerState.finalLayoutLayerOrder || [])],
        });

        // Restore editor state
        setEditorState((prev) => ({
          ...prev,
          ...projectData.editorState,
          // Reset transient state
          multiSelection: {
            selectedElements: [],
            selectionBounds: null,
            isDrawingSelection: false,
            selectionStart: null,
            selectionEnd: null,
            isMovingSelection: false,
            moveStart: null,
            targetView: null,
          },
        }));

        // Restore languages
        setSourceLanguage(projectData.sourceLanguage);
        setDesiredLanguage(projectData.desiredLanguage);

        // Log final layout URL restoration for import
        if (projectData.documentState.finalLayoutUrl) {
          console.log(
            "DEBUG: Final layout URL imported:",
            {
              finalLayoutUrl: projectData.documentState.finalLayoutUrl,
              finalLayoutCurrentPage: projectData.documentState.finalLayoutCurrentPage,
              finalLayoutNumPages: projectData.documentState.finalLayoutNumPages,
              finalLayoutDeletedPages: projectData.documentState.finalLayoutDeletedPages,
            }
          );
        } else {
          console.log("DEBUG: No final layout URL found in imported project data");
        }

        // Update current project info
        setCurrentProjectId(projectData.id);
        setIsLoading(false);

        toast.success(`Project "${projectData.name}" imported successfully!`);
        return true;
      } catch (error) {
        console.error("Error importing project:", error);
        toast.error("Failed to import project");
        return false;
      }
    },
    [
      setDocumentState,
      setViewState,
      setElementCollections,
      setLayerState,
      setEditorState,
      setSourceLanguage,
      setDesiredLanguage,
      setCurrentProjectId,
      setIsLoading,
    ]
  );

  // Note: Removed UUID validation effect since we're using Supabase-generated IDs

  return {
    saveProject,
    loadProject,
    exportToJson,
    importFromJson,
    getSavedProjects,
    deleteProject,
    // New state values
    currentProjectId,
    setCurrentProjectId,
    isLoading,
    isAuthenticated: isUserAuthenticated,
  };
};
