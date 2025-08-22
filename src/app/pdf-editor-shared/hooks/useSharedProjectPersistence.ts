/**
 * Custom hook for shared project persistence - works independently of useProjectState
 * Uses the existing shared project endpoints that don't require authentication
 */

import { useCallback, useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { getSharedProject, updateSharedProject, getSharedProjectId, isInSharedMode } from "../services/sharedProjectService";
import { patchSharedEditorProject, canPatchSharedProject } from "../services/sharedEditorPatchService";
import { ProjectState } from "../../pdf-editor/hooks/states/useProjectState";

/**
 * Get shared context including both project ID and share ID
 */
function getSharedContext() {
  if (typeof window === "undefined") {
    return { projectId: null, shareId: null };
  }
  
  return {
    projectId: localStorage.getItem("pdf-editor-shared-project-id"),
    shareId: localStorage.getItem("pdf-editor-share-id"),
  };
}

interface UseSharedProjectPersistenceProps {
  // State getters to capture current state
  documentState: any;
  elementCollections: any;
  layerState: any;
  viewState: any;
  editorState: any;
  sourceLanguage: string;
  desiredLanguage: string;
  finalLayoutSettings?: any;
  
  // State setters to restore state
  setDocumentState?: (state: any) => void;
  setElementCollections?: (collections: any) => void;
  setLayerState?: (state: any) => void;
  setViewState?: (state: any) => void;
  setEditorState?: (state: any) => void;
  setSourceLanguage?: (lang: string) => void;
  setDesiredLanguage?: (lang: string) => void;
  setFinalLayoutSettings?: (settings: any) => void;
  
  // Document actions
  documentActions?: {
    loadDocumentFromUrl?: (url: string, fileType: any, supabaseFilePath?: string) => Promise<void>;
    loadFinalLayoutFromUrl?: (url: string, numPages?: number) => Promise<void>;
  };
}

export function useSharedProjectPersistence(props: UseSharedProjectPersistenceProps) {
  const {
    documentState,
    elementCollections,
    layerState,
    viewState,
    editorState,
    sourceLanguage,
    desiredLanguage,
    finalLayoutSettings,
    setDocumentState,
    setElementCollections,
    setLayerState,
    setViewState,
    setEditorState,
    setSourceLanguage,
    setDesiredLanguage,
    setFinalLayoutSettings,
    documentActions,
  } = props;

  const [isLoading, setIsLoading] = useState(false);
  const [lastSaveTime, setLastSaveTime] = useState<Date | null>(null);
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasLoadedInitialState = useRef(false);

  // Serialize document state (same as useProjectState)
  const serializeDocumentState = useCallback((docState: any) => {
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
      detectedPageBackgrounds: docState.detectedPageBackgrounds ? Object.fromEntries(
        docState.detectedPageBackgrounds
      ) : {},
      pages: docState.pages,
      deletedPages: docState.deletedPages ? Array.from(docState.deletedPages) : [],
      isTransforming: docState.isTransforming,
      supabaseFilePath: docState.supabaseFilePath,
      isSupabaseUrl: docState.isSupabaseUrl,
      finalLayoutUrl: docState.finalLayoutUrl,
      finalLayoutCurrentPage: docState.finalLayoutCurrentPage,
      finalLayoutNumPages: docState.finalLayoutNumPages,
      finalLayoutDeletedPages: docState.finalLayoutDeletedPages ? Array.from(docState.finalLayoutDeletedPages) : [],
    };

    return cleanDocState;
  }, []);

  /**
   * Save project for shared editor using the shared update endpoint
   */
  const saveProject = useCallback(async (projectName?: string) => {
    // Early return if not in shared mode to prevent any issues
    if (!isInSharedMode()) {
      return null;
    }

    const context = getSharedContext();
    if (!context.shareId || !context.projectId) {
      console.error("No share ID or project ID found");
      toast.error("Cannot save: Missing share context");
      return null;
    }

    if (isLoading) {
      console.log("Already saving, skipping");
      return null;
    }

    setIsLoading(true);

    try {
      // Create project state object - use the loaded project ID if available, fallback to context
      const projectId = loadedProjectId || context.projectId;
      console.log("SharedProject: Using project ID for save:", { loadedProjectId, contextProjectId: context.projectId, finalId: projectId });
      
      const projectState: ProjectState = {
        id: projectId,
        name: projectName || `Shared Project ${new Date().toLocaleDateString()}`,
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
          originalLayerOrder: [...(layerState.originalLayerOrder || [])],
          translatedLayerOrder: [...(layerState.translatedLayerOrder || [])],
          finalLayoutLayerOrder: [...(layerState.finalLayoutLayerOrder || [])],
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
        ...(viewState.currentWorkflowStep === "final-layout" &&
          finalLayoutSettings && {
            finalLayoutSettings: finalLayoutSettings,
          }),
      };

      console.log("SharedProject: Saving via updateSharedProject:", {
        shareId: context.shareId,
        projectId: context.projectId,
        projectName: projectState.name,
      });

      // Use the new PATCH endpoint specifically designed for shared editors
      console.log("SharedProject: Using shared editor PATCH endpoint");
      
      const patchValidation = canPatchSharedProject();
      if (!patchValidation.canPatch) {
        throw new Error(`Cannot patch shared project: ${patchValidation.reason}`);
      }
      
      const result = await patchSharedEditorProject(projectId, context.shareId, {
        name: projectState.name,
        project_data: projectState,
      });

      setLastSaveTime(new Date());
      localStorage.setItem("pdf-editor-last-saved", new Date().toISOString());
      
      toast.success("Project saved to database!");
      console.log("SharedProject: Save successful");
      
      return projectState;
    } catch (error) {
      console.error("SharedProject: Save failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to save project";
      toast.error(errorMessage);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    serializeDocumentState,
    documentState,
    viewState,
    elementCollections,
    layerState,
    editorState,
    sourceLanguage,
    desiredLanguage,
    finalLayoutSettings,
  ]);

  /**
   * Load project for shared editor using the shared get endpoint
   */
  const loadProject = useCallback(async (projectIdParam?: string) => {
    // Early return if not in shared mode to prevent any issues
    if (!isInSharedMode()) {
      return false;
    }

    const context = getSharedContext();
    const shareId = context.shareId;
    
    if (!shareId) {
      console.error("No share ID found for loading shared project");
      return false;
    }

    if (isLoading) {
      console.log("Already loading, skipping");
      return false;
    }

    setIsLoading(true);

    try {
      console.log("SharedProject: Loading via getSharedProject:", { shareId, projectId: context.projectId });

      // Use the getSharedProject endpoint with shareId (not projectId)
      const sharedProject = await getSharedProject(shareId);
      const projectState = sharedProject.project_data as ProjectState;

      if (!projectState) {
        throw new Error("No project data found");
      }

      // Store the loaded project ID for future saves
      setLoadedProjectId(projectState.id);
      
      console.log("SharedProject: Loaded successfully:", {
        name: projectState.name,
        id: projectState.id,
        deletedPagesType: typeof projectState.documentState?.deletedPages,
        deletedPagesValue: projectState.documentState?.deletedPages,
        finalLayoutDeletedPagesType: typeof projectState.documentState?.finalLayoutDeletedPages,
        finalLayoutDeletedPagesValue: projectState.documentState?.finalLayoutDeletedPages,
      });

      // Restore all state (only if setters are provided)
      if (setDocumentState && projectState.documentState) {
        // For editor mode, be extra careful with data restoration
        console.log("SharedProject: Restoring document state for editor, checking data types...");
        
        // Safely handle deletedPages - could be array, Set, null, undefined, or corrupted
        let deletedPagesArray = [];
        try {
          if (projectState.documentState.deletedPages !== null && projectState.documentState.deletedPages !== undefined) {
            if (Array.isArray(projectState.documentState.deletedPages)) {
              deletedPagesArray = projectState.documentState.deletedPages;
            } else if (projectState.documentState.deletedPages instanceof Set) {
              deletedPagesArray = Array.from(projectState.documentState.deletedPages);
            } else if (typeof projectState.documentState.deletedPages === 'object') {
              // Could be a plain object with numeric keys
              deletedPagesArray = Object.values(projectState.documentState.deletedPages).filter(v => typeof v === 'number');
            }
          }
        } catch (error) {
          console.warn("SharedProject: Error processing deletedPages, using empty array:", error);
          deletedPagesArray = [];
        }

        // Safely handle finalLayoutDeletedPages
        let finalLayoutDeletedPagesArray = [];
        try {
          if (projectState.documentState.finalLayoutDeletedPages !== null && projectState.documentState.finalLayoutDeletedPages !== undefined) {
            if (Array.isArray(projectState.documentState.finalLayoutDeletedPages)) {
              finalLayoutDeletedPagesArray = projectState.documentState.finalLayoutDeletedPages;
            } else if (projectState.documentState.finalLayoutDeletedPages instanceof Set) {
              finalLayoutDeletedPagesArray = Array.from(projectState.documentState.finalLayoutDeletedPages);
            } else if (typeof projectState.documentState.finalLayoutDeletedPages === 'object') {
              finalLayoutDeletedPagesArray = Object.values(projectState.documentState.finalLayoutDeletedPages).filter(v => typeof v === 'number');
            }
          }
        } catch (error) {
          console.warn("SharedProject: Error processing finalLayoutDeletedPages, using empty array:", error);
          finalLayoutDeletedPagesArray = [];
        }
        
        console.log("SharedProject: Processed arrays:", {
          deletedPagesArray,
          finalLayoutDeletedPagesArray,
        });
        
        try {
          setDocumentState((prev: any) => ({
            ...prev,
            ...projectState.documentState,
            deletedPages: new Set(deletedPagesArray),
            detectedPageBackgrounds: new Map(
              Object.entries(projectState.documentState.detectedPageBackgrounds || {})
                .map(([key, value]) => [parseInt(key), value])
            ),
            finalLayoutDeletedPages: new Set(finalLayoutDeletedPagesArray),
            fileType: projectState.documentState.fileType || null,
            isDocumentLoaded: true,
            isLoading: false,
            error: "",
          }));
          console.log("SharedProject: Document state restored successfully");
        } catch (error) {
          console.error("SharedProject: Error setting document state:", error);
          // Try with minimal state restoration
          setDocumentState((prev: any) => ({
            ...prev,
            deletedPages: new Set([]),
            finalLayoutDeletedPages: new Set([]),
            detectedPageBackgrounds: new Map(),
            isDocumentLoaded: true,
            isLoading: false,
            error: "",
          }));
        }
      }

      // Load documents if URLs exist
      if (documentActions?.loadDocumentFromUrl && projectState.documentState.url) {
        try {
          await documentActions.loadDocumentFromUrl(
            projectState.documentState.url,
            projectState.documentState.fileType,
            projectState.documentState.supabaseFilePath
          );
        } catch (error) {
          console.error("Failed to load document:", error);
        }
      }

      if (documentActions?.loadFinalLayoutFromUrl && projectState.documentState.finalLayoutUrl) {
        try {
          await documentActions.loadFinalLayoutFromUrl(
            projectState.documentState.finalLayoutUrl,
            projectState.documentState.finalLayoutNumPages
          );
        } catch (error) {
          console.error("Failed to load final layout:", error);
        }
      }

      // Restore other states
      if (setViewState) {
        setViewState((prev: any) => ({
          ...prev,
          ...projectState.viewState,
        }));
      }

      if (setElementCollections) {
        setElementCollections(projectState.elementCollections);
      }

      if (setLayerState) {
        setLayerState({
          originalLayerOrder: [...(projectState.layerState.originalLayerOrder || [])],
          translatedLayerOrder: [...(projectState.layerState.translatedLayerOrder || [])],
          finalLayoutLayerOrder: [...(projectState.layerState.finalLayoutLayerOrder || [])],
        });
      }

      if (setEditorState) {
        setEditorState((prev: any) => ({
          ...prev,
          ...projectState.editorState,
          selectedFieldId: null,
          selectedShapeId: null,
          isAddTextBoxMode: false,
          isTextSelectionMode: false,
          isImageUploadMode: false,
          isSelectionMode: false,
        }));
      }

      if (setSourceLanguage) {
        setSourceLanguage(projectState.sourceLanguage);
      }

      if (setDesiredLanguage) {
        setDesiredLanguage(projectState.desiredLanguage);
      }

      if (setFinalLayoutSettings && projectState.finalLayoutSettings) {
        setFinalLayoutSettings(projectState.finalLayoutSettings);
      }

      toast.success("Project loaded from database!");
      return true;
    } catch (error) {
      console.error("SharedProject: Load failed:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to load project";
      toast.error(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [
    isLoading,
    setDocumentState,
    setViewState,
    setElementCollections,
    setLayerState,
    setEditorState,
    setSourceLanguage,
    setDesiredLanguage,
    setFinalLayoutSettings,
    documentActions,
  ]);

  /**
   * Auto-save functionality (debounced)
   */
  const scheduleAutoSave = useCallback(() => {
    if (!isInSharedMode()) return;

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Schedule a new save in 5 seconds
    saveTimeoutRef.current = setTimeout(() => {
      console.log("SharedProject: Auto-saving...");
      saveProject();
    }, 5000);
  }, [saveProject]);

  /**
   * Load initial state on mount (only for shared editors)
   */
  useEffect(() => {
    if (isInSharedMode() && !hasLoadedInitialState.current && setDocumentState) {
      hasLoadedInitialState.current = true;
      console.log("SharedProject: Loading initial state");
      loadProject();
    }
  }, [loadProject, setDocumentState]);

  /**
   * Clean up on unmount
   */
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    // Main functions
    saveProject,
    loadProject,
    scheduleAutoSave,
    
    // State
    isLoading,
    lastSaveTime,
    isSharedEditor: isInSharedMode(),
  };
}