import { useCallback } from "react";
import { toast } from "sonner";
import {
  DocumentState,
  ElementCollections,
  LayerState,
  ViewState,
  EditorState,
} from "../../types/pdf-editor.types";

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
    fileType: string | null;
    imageDimensions: { width: number; height: number } | null;
    pdfBackgroundColor: string;
    detectedPageBackgrounds: Record<number, string>; // Convert Map to Record for serialization
    pages: any[]; // PageData array
    deletedPages: number[]; // Convert Set to Array for serialization
    isTransforming: boolean;
  };
  viewState: {
    currentView: "original" | "translated" | "split";
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
  originalDocumentFile?: {
    name: string;
    size: number;
    type: string;
    data: string; // base64 encoded file data
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
}

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

  // Generate unique project ID
  const generateProjectId = useCallback(() => {
    return `project_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  // Convert Map and Set objects to serializable formats
  const serializeDocumentState = useCallback((docState: DocumentState) => {
    return {
      ...docState,
      detectedPageBackgrounds: Object.fromEntries(
        docState.detectedPageBackgrounds
      ),
      deletedPages: Array.from(docState.deletedPages),
    };
  }, []);

  // Convert serialized formats back to Map and Set objects
  const deserializeDocumentState = useCallback(
    (serializedDocState: any): DocumentState => {
      return {
        ...serializedDocState,
        detectedPageBackgrounds: new Map(
          Object.entries(serializedDocState.detectedPageBackgrounds || {})
        ),
        deletedPages: new Set(serializedDocState.deletedPages || []),
      };
    },
    []
  );

  // Save project to localStorage with complete state
  const saveProject = useCallback(
    (projectName?: string) => {
      try {
        const projectState: ProjectState = {
          id: generateProjectId(),
          name: projectName || `Project ${new Date().toLocaleDateString()}`,
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
        };

        // Save to localStorage
        const storageKey = `pdf-editor-project-${projectState.id}`;
        localStorage.setItem(storageKey, JSON.stringify(projectState));

        // Also update the "current project" reference
        localStorage.setItem("pdf-editor-current-project", storageKey);

        toast.success(`Project "${projectState.name}" saved successfully!`);
        return projectState;
      } catch (error) {
        console.error("Error saving project:", error);
        toast.error("Failed to save project");
        return null;
      }
    },
    [
      generateProjectId,
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

  // Load project from localStorage and restore all states
  const loadProject = useCallback(
    (projectId?: string) => {
      try {
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

        const projectState: ProjectState = JSON.parse(savedProject);

        // Restore document state
        const restoredDocumentState = deserializeDocumentState(
          projectState.documentState
        );
        setDocumentState(restoredDocumentState);

        // Restore view state
        setViewState((prev) => ({
          ...prev,
          currentView: projectState.viewState.currentView,
          currentWorkflowStep: projectState.viewState
            .currentWorkflowStep as any,
          activeSidebarTab: projectState.viewState.activeSidebarTab as any,
          isSidebarCollapsed: projectState.viewState.isSidebarCollapsed,
          isCtrlPressed: projectState.viewState.isCtrlPressed,
          zoomMode: projectState.viewState.zoomMode || prev.zoomMode,
          containerWidth:
            projectState.viewState.containerWidth || prev.containerWidth,
          transformOrigin:
            projectState.viewState.transformOrigin || prev.transformOrigin,
        }));

        // Restore element collections
        setElementCollections(projectState.elementCollections);

        // Restore layer state
        setLayerState(projectState.layerState);

        // Restore editor state (but clear transient selection states)
        setEditorState((prev) => ({
          ...prev,
          selectedFieldId: null, // Clear selection for safety
          selectedShapeId: null,
          isEditMode: projectState.editorState.isEditMode,
          isAddTextBoxMode: false, // Reset modes for safety
          isTextSelectionMode: false,
          showDeletionRectangles:
            projectState.editorState.showDeletionRectangles,
          isImageUploadMode: false,
          isSelectionMode: false,
          // Keep current multiSelection state (transient)
          multiSelection: prev.multiSelection,
        }));

        // Restore language settings
        setSourceLanguage(projectState.sourceLanguage);
        setDesiredLanguage(projectState.desiredLanguage);

        toast.success(`Project "${projectState.name}" loaded successfully!`);
        return true;
      } catch (error) {
        console.error("Error loading project:", error);
        toast.error("Failed to load project");
        return false;
      }
    },
    [
      deserializeDocumentState,
      setDocumentState,
      setViewState,
      setElementCollections,
      setLayerState,
      setEditorState,
      setSourceLanguage,
      setDesiredLanguage,
    ]
  );

  // Export project data as JSON file
  const exportToJson = useCallback(
    (projectName?: string) => {
      try {
        const projectState: ProjectState = {
          id: generateProjectId(),
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
      generateProjectId,
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

  // Get list of saved projects
  const getSavedProjects = useCallback(() => {
    const projects: Array<{
      id: string;
      name: string;
      createdAt: string;
      storageKey: string;
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
  }, []);

  // Delete a saved project
  const deleteProject = useCallback((projectId: string) => {
    try {
      const storageKey = `pdf-editor-project-${projectId}`;
      localStorage.removeItem(storageKey);

      // If this was the current project, clear the reference
      const currentProjectKey = localStorage.getItem(
        "pdf-editor-current-project"
      );
      if (currentProjectKey === storageKey) {
        localStorage.removeItem("pdf-editor-current-project");
      }

      toast.success("Project deleted successfully");
      return true;
    } catch (error) {
      console.error("Error deleting project:", error);
      toast.error("Failed to delete project");
      return false;
    }
  }, []);

  return {
    saveProject,
    loadProject,
    exportToJson,
    getSavedProjects,
    deleteProject,
  };
};
