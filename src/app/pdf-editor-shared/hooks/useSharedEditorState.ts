/**
 * Hook for managing shared editor state - separate from main useProjectState
 * Handles save/load operations specifically for shared editors
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ProjectState } from "../../pdf-editor/hooks/states/useProjectState";
import {
  saveSharedEditorProject,
  loadSharedEditorProject,
  getSharedEditorProjectInfo,
  isSharedEditorMode,
  SharedEditorApiError,
} from "../services/sharedEditorApiService";

export interface UseSharedEditorStateProps {
  // All the same props as useProjectState to maintain compatibility
  documentState: any;
  elementCollections: any;
  layerState: any;
  viewState: any;
  editorState: any;
  sourceLanguage: string;
  desiredLanguage: string;
  finalLayoutSettings?: any;
  
  // Document actions for loading documents from URLs
  documentActions?: {
    loadDocumentFromUrl: (
      url: string,
      fileType: "pdf" | "image" | null,
      supabaseFilePath?: string
    ) => Promise<void>;
    loadFinalLayoutFromUrl: (
      finalLayoutUrl: string,
      finalLayoutNumPages?: number
    ) => Promise<void>;
  };

  // Setters for state updates
  setDocumentState: (state: any) => void;
  setElementCollections: (collections: any) => void;
  setLayerState: (state: any) => void;
  setViewState: (state: any) => void;
  setEditorState: (state: any) => void;
  setSourceLanguage: (lang: string) => void;
  setDesiredLanguage: (lang: string) => void;
  setFinalLayoutSettings?: (settings: any) => void;
}

// Helper function to safely convert arrays
const safeToArray = (value: any): any[] => {
  if (Array.isArray(value)) {
    return value;
  }
  if (value && typeof value === 'object') {
    if (value.size !== undefined && typeof value.forEach === 'function') {
      return Array.from(value);
    }
    if (Object.keys(value).every(key => !isNaN(Number(key)))) {
      return Object.values(value);
    }
  }
  return [];
};

export const useSharedEditorState = (props: UseSharedEditorStateProps) => {
  const {
    documentState,
    elementCollections,
    layerState,
    viewState,
    editorState,
    sourceLanguage,
    desiredLanguage,
    finalLayoutSettings,
    documentActions,
    setDocumentState,
    setElementCollections,
    setLayerState,
    setViewState,
    setEditorState,
    setSourceLanguage,
    setDesiredLanguage,
    setFinalLayoutSettings,
  } = props;

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentProjectName, setCurrentProjectName] = useState<string | null>(null);

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
      detectedPageBackgrounds: Object.fromEntries(
        docState.detectedPageBackgrounds
      ),
      pages: docState.pages,
      deletedPages: Array.from(docState.deletedPages),
      isTransforming: docState.isTransforming,
      supabaseFilePath: docState.supabaseFilePath,
      isSupabaseUrl: docState.isSupabaseUrl,
      finalLayoutUrl: docState.finalLayoutUrl,
      finalLayoutCurrentPage: docState.finalLayoutCurrentPage,
      finalLayoutNumPages: docState.finalLayoutNumPages,
      finalLayoutDeletedPages: Array.from(docState.finalLayoutDeletedPages || []),
    };

    return cleanDocState;
  }, []);

  // Save project specifically for shared editors
  const saveProject = useCallback(
    async (projectName?: string) => {
      if (!isSharedEditorMode()) {
        console.warn("saveProject called but not in shared editor mode");
        return null;
      }

      if (isLoading) return null;

      setIsLoading(true);

      try {
        // Create project state
        const projectState: ProjectState = {
          id: currentProjectId || `shared_${Date.now()}`,
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
          ...(viewState.currentWorkflowStep === "final-layout" &&
            finalLayoutSettings && {
              finalLayoutSettings: finalLayoutSettings,
            }),
        };

        console.log("SharedEditor: Saving project:", {
          name: projectState.name,
          id: projectState.id,
        });

        const result = await saveSharedEditorProject(projectState);

        if (result.success) {
          // Update local state
          setCurrentProjectId(projectState.id);
          setCurrentProjectName(projectState.name);

          // Store last saved time for UI
          localStorage.setItem("pdf-editor-last-saved", new Date().toISOString());

          toast.success(`Project "${projectState.name}" saved to database!`);
          return projectState;
        } else {
          throw new Error(result.message || "Failed to save project");
        }
      } catch (error) {
        console.error("SharedEditor: Failed to save project:", error);
        
        const errorMessage = error instanceof SharedEditorApiError 
          ? error.message 
          : "Unknown error occurred";
          
        toast.error(`Failed to save project: ${errorMessage}`);
        return null;
      } finally {
        setIsLoading(false);
      }
    },
    [
      isLoading,
      currentProjectId,
      serializeDocumentState,
      documentState,
      viewState,
      elementCollections,
      layerState,
      editorState,
      sourceLanguage,
      desiredLanguage,
      finalLayoutSettings,
    ]
  );

  // Load project specifically for shared editors
  const loadProject = useCallback(
    async (projectId?: string) => {
      if (!isSharedEditorMode()) {
        console.warn("loadProject called but not in shared editor mode");
        return false;
      }

      if (isLoading) return false;

      setIsLoading(true);

      try {
        console.log("SharedEditor: Loading project from database");

        const projectState = await loadSharedEditorProject();

        if (!projectState) {
          toast.error("Project not found");
          return false;
        }

        console.log("SharedEditor: Project loaded successfully:", {
          name: projectState.name,
          id: projectState.id,
        });

        // Restore document state
        setDocumentState((prev: any) => ({
          ...prev,
          ...projectState.documentState,
          deletedPages: new Set(safeToArray(projectState.documentState.deletedPages)),
          detectedPageBackgrounds: new Map(
            Object.entries(
              projectState.documentState.detectedPageBackgrounds || {}
            ).map(([key, value]) => [parseInt(key), value])
          ),
          finalLayoutDeletedPages: projectState.documentState.finalLayoutDeletedPages 
            ? new Set(safeToArray(projectState.documentState.finalLayoutDeletedPages))
            : new Set<number>(),
          fileType: projectState.documentState.fileType as "pdf" | "image" | null || null,
          isDocumentLoaded: true,
          isLoading: false,
          error: "",
        }));

        // Load document into PDF viewer if URL exists
        if (projectState.documentState.url && documentActions?.loadDocumentFromUrl) {
          console.log("SharedEditor: Loading document from URL:", projectState.documentState.url);
          try {
            await documentActions.loadDocumentFromUrl(
              projectState.documentState.url,
              projectState.documentState.fileType as "pdf" | "image" | null,
              projectState.documentState.supabaseFilePath
            );
          } catch (error) {
            console.error("SharedEditor: Failed to load document:", error);
          }
        }

        // Load final layout if it exists
        if (projectState.documentState.finalLayoutUrl && documentActions?.loadFinalLayoutFromUrl) {
          try {
            await documentActions.loadFinalLayoutFromUrl(
              projectState.documentState.finalLayoutUrl,
              projectState.documentState.finalLayoutNumPages
            );
          } catch (error) {
            console.error("SharedEditor: Failed to load final layout:", error);
          }
        }

        // Restore view state
        setViewState((prev: any) => ({
          ...prev,
          ...projectState.viewState,
          activeSidebarTab: (["pages", "tools", "chat"].includes(
            projectState.viewState.activeSidebarTab
          )
            ? projectState.viewState.activeSidebarTab
            : "pages") as "pages" | "tools" | "chat",
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

        // Restore layer state
        setLayerState({
          originalLayerOrder: [...projectState.layerState.originalLayerOrder],
          translatedLayerOrder: [...projectState.layerState.translatedLayerOrder],
          finalLayoutLayerOrder: [...(projectState.layerState.finalLayoutLayerOrder || [])],
        });

        // Restore editor state
        setEditorState((prev: any) => ({
          ...prev,
          ...projectState.editorState,
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
            dragOffsets: {},
            isDragging: false,
          },
        }));

        // Restore languages
        setSourceLanguage(projectState.sourceLanguage);
        setDesiredLanguage(projectState.desiredLanguage);

        // Restore final layout settings
        if (projectState.finalLayoutSettings && setFinalLayoutSettings) {
          setFinalLayoutSettings(projectState.finalLayoutSettings);
        }

        // Update current project info
        setCurrentProjectId(projectState.id);
        setCurrentProjectName(projectState.name);

        toast.success(`Project "${projectState.name}" loaded from database!`);
        return true;
      } catch (error) {
        console.error("SharedEditor: Failed to load project:", error);
        
        const errorMessage = error instanceof SharedEditorApiError 
          ? error.message 
          : "Failed to load project";
          
        toast.error(errorMessage);
        return false;
      } finally {
        setIsLoading(false);
      }
    },
    [
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
    ]
  );

  // Check if we're in shared editor mode
  const isSharedEditor = isSharedEditorMode();

  return {
    // Main operations
    saveProject,
    loadProject,
    
    // State
    currentProjectId,
    setCurrentProjectId,
    currentProjectName,
    isLoading,
    isSharedEditor,
    
    // For compatibility with useProjectState interface
    exportToJson: () => null, // Not needed for shared editors
    importFromJson: () => Promise.resolve(false), // Not needed for shared editors
    getSavedProjects: () => Promise.resolve([]), // Not needed for shared editors
    deleteProject: () => Promise.resolve(false), // Not needed for shared editors
    isAuthenticated: true, // Shared editors are considered "authenticated" for their purposes
  };
};