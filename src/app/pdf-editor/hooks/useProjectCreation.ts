/**
 * Custom hook for automatically creating projects when documents are uploaded
 */

import { useCallback, useState } from "react";
import { toast } from "sonner";
import {
  createProjectFromUpload,
  ProjectApiError,
} from "../services/projectApiService";
import { UploadProgressCallback } from "../services/fileUploadService";
import { useAuthStore } from "../../../lib/store/AuthStore";
import {
  DocumentState,
  ViewState,
  ElementCollections,
  LayerState,
  EditorState,
} from "../types/pdf-editor.types";

interface UseProjectCreationProps {
  documentState: DocumentState;
  viewState: ViewState;
  elementCollections: ElementCollections;
  layerState: LayerState;
  editorState: EditorState;
  sourceLanguage: string;
  desiredLanguage: string;
}

interface ProjectCreationResult {
  projectId: string | null;
  isCreating: boolean;
  error: string | null;
}

export const useProjectCreation = (props: UseProjectCreationProps) => {
  const {
    documentState,
    viewState,
    elementCollections,
    layerState,
    editorState,
    sourceLanguage,
    desiredLanguage,
  } = props;

  // Use existing auth store
  const { user, session } = useAuthStore();
  const isUserAuthenticated = !!(user && session);

  const [projectCreationState, setProjectCreationState] =
    useState<ProjectCreationResult>({
      projectId: null,
      isCreating: false,
      error: null,
    });

  /**
   * Create a new project automatically when a document is uploaded
   */
  const createProjectOnUpload = useCallback(
    async (
      file: File,
      onUploadProgress?: UploadProgressCallback
    ): Promise<string | null> => {
      // Check if user is authenticated
      if (!isUserAuthenticated) {
        console.warn("User not authenticated, skipping project creation");
        return null;
      }

      setProjectCreationState((prev) => ({
        ...prev,
        isCreating: true,
        error: null,
      }));

      try {
        const project = await createProjectFromUpload(
          file,
          documentState,
          {
            viewState,
            elementCollections,
            layerState,
            editorState,
            sourceLanguage,
            desiredLanguage,
          },
          onUploadProgress
        );

        setProjectCreationState({
          projectId: project.id,
          isCreating: false,
          error: null,
        });

        toast.success(`Project "${project.name}" created successfully!`, {
          description:
            "Your document has been uploaded and a new project has been created.",
          duration: 4000,
        });

        return project.id;
      } catch (error) {
        const errorMessage =
          error instanceof ProjectApiError
            ? error.message
            : "Failed to create project";

        setProjectCreationState({
          projectId: null,
          isCreating: false,
          error: errorMessage,
        });

        // Show error toast but don't block the upload process
        toast.error("Project creation failed", {
          description:
            "Your document was uploaded but we couldn't create a project. You can save manually later.",
          duration: 5000,
        });

        console.error("Error creating project on upload:", error);
        return null;
      }
    },
    [
      isUserAuthenticated,
      documentState,
      viewState,
      elementCollections,
      layerState,
      editorState,
      sourceLanguage,
      desiredLanguage,
    ]
  );

  /**
   * Enhanced file upload handler that creates a project automatically
   */
  const handleFileUploadWithProjectCreation = useCallback(
    async (
      event: React.ChangeEvent<HTMLInputElement>,
      originalHandler: (event: React.ChangeEvent<HTMLInputElement>) => void
    ) => {
      const file = event.target.files?.[0];
      if (!file) return;

      // First, execute the original upload handler to process the file
      originalHandler(event);

      // Then, create a project in the background
      // We use a small delay to ensure the document state is updated
      setTimeout(async () => {
        await createProjectOnUpload(file);
      }, 1000);
    },
    [createProjectOnUpload]
  );

  /**
   * Reset project creation state
   */
  const resetProjectCreationState = useCallback(() => {
    setProjectCreationState({
      projectId: null,
      isCreating: false,
      error: null,
    });
  }, []);

  /**
   * Check if we should show project creation status
   */
  const shouldShowProjectStatus = useCallback(() => {
    return (
      isUserAuthenticated &&
      (projectCreationState.isCreating || projectCreationState.error)
    );
  }, [isUserAuthenticated, projectCreationState]);

  return {
    // State
    projectId: projectCreationState.projectId,
    isCreatingProject: projectCreationState.isCreating,
    projectCreationError: projectCreationState.error,

    // Actions
    createProjectOnUpload,
    handleFileUploadWithProjectCreation,
    resetProjectCreationState,

    // Helpers
    shouldShowProjectStatus,
    isAuthenticated: isUserAuthenticated,
  };
};
