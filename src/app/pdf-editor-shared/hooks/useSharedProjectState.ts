import { useState, useCallback, useEffect } from "react";
import { toast } from "sonner";
import { 
  updateSharedProject, 
  hasEditorPermissions, 
  getSharedProjectId,
  isInSharedMode 
} from "../services/sharedProjectService";

interface UseSharedProjectStateOptions {
  autoSave?: boolean;
  autoSaveInterval?: number;
}

export function useSharedProjectState(options: UseSharedProjectStateOptions = {}) {
  const { autoSave = true, autoSaveInterval = 60000 } = options;
  
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  /**
   * Save the shared project to the server
   */
  const saveSharedProject = useCallback(async (projectData: any, projectName?: string) => {
    // Check if we're in shared mode and have editor permissions
    if (!isInSharedMode()) {
      console.log("Not in shared mode, skipping save");
      return null;
    }
    
    if (!hasEditorPermissions()) {
      toast.error("You don't have permission to save changes to this project");
      return null;
    }
    
    const projectId = getSharedProjectId();
    if (!projectId) {
      console.error("No shared project ID found");
      toast.error("Unable to save: Project ID not found");
      return null;
    }
    
    setIsSaving(true);
    
    try {
      console.log("Saving shared project:", { projectId, projectName });
      
      const result = await updateSharedProject(projectId, {
        name: projectName,
        project_data: projectData,
      });
      
      setLastSavedAt(new Date());
      setHasUnsavedChanges(false);
      
      toast.success("Changes saved successfully");
      
      console.log("Shared project saved:", result);
      return result;
    } catch (error) {
      console.error("Failed to save shared project:", error);
      
      const errorMessage = error instanceof Error 
        ? error.message 
        : "Failed to save changes";
      
      toast.error(errorMessage);
      return null;
    } finally {
      setIsSaving(false);
    }
  }, []);
  
  /**
   * Mark that there are unsaved changes
   */
  const markUnsavedChanges = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);
  
  /**
   * Auto-save functionality
   */
  useEffect(() => {
    if (!autoSave || !hasUnsavedChanges || !hasEditorPermissions()) {
      return;
    }
    
    const timer = setTimeout(() => {
      // Trigger auto-save
      console.log("Auto-saving shared project...");
      
      // Get the current project state from localStorage
      const currentProjectKey = localStorage.getItem("pdf-editor-current-project");
      if (currentProjectKey) {
        const projectDataStr = localStorage.getItem(currentProjectKey);
        if (projectDataStr) {
          try {
            const projectData = JSON.parse(projectDataStr);
            saveSharedProject(projectData);
          } catch (error) {
            console.error("Failed to parse project data for auto-save:", error);
          }
        }
      }
    }, autoSaveInterval);
    
    return () => clearTimeout(timer);
  }, [autoSave, autoSaveInterval, hasUnsavedChanges, saveSharedProject]);
  
  /**
   * Warn user about unsaved changes before leaving
   */
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges && hasEditorPermissions()) {
        e.preventDefault();
        e.returnValue = "You have unsaved changes. Are you sure you want to leave?";
        return e.returnValue;
      }
    };
    
    window.addEventListener("beforeunload", handleBeforeUnload);
    
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);
  
  return {
    isSaving,
    lastSavedAt,
    hasUnsavedChanges,
    saveSharedProject,
    markUnsavedChanges,
    canEdit: hasEditorPermissions(),
    isSharedMode: isInSharedMode(),
  };
}