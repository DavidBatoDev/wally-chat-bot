/**
 * Utility functions for checking shared project permissions
 */

export type UserRole = "creator" | "editor" | "viewer";

/**
 * Get the current user's role based on context
 */
export function getCurrentUserRole(): UserRole {
  if (typeof window === "undefined") return "creator";
  
  try {
    const isSharedMode = localStorage.getItem("pdf-editor-shared-mode") === "true";
    if (!isSharedMode) return "creator";
    
    const permissions = localStorage.getItem("pdf-editor-shared-permissions");
    return (permissions as UserRole) || "viewer";
  } catch (error) {
    // Fallback to creator if localStorage is not available
    return "creator";
  }
}

/**
 * Check if current user is in shared mode
 */
export function isInSharedMode(): boolean {
  if (typeof window === "undefined") return false;
  
  try {
    return localStorage.getItem("pdf-editor-shared-mode") === "true";
  } catch (error) {
    return false;
  }
}

/**
 * Permission checks for different functionalities
 */
export const permissions = {
  // File operations
  canUploadFiles: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Only creator can upload files
  },

  canSaveProject: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Creator and editor can save
  },

  canExportProject: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Only creator can export
  },

  // OCR and processing
  canUseOCR: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Only creator can use OCR
  },

  canChangeDocumentType: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Only creator can change document type
  },

  // Layout operations
  canGenerateFinalLayout: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Creator and editor can generate final layout
  },

  canViewFinalLayout: (hasFinalLayout: boolean): boolean => {
    const role = getCurrentUserRole();
    if (role === "creator") return true; // Creator can always view
    if (role === "editor") return true; // Editor can always view
    return hasFinalLayout; // Viewer can only view if final layout exists
  },

  canAccessFinalLayoutStep: (hasFinalLayout: boolean): boolean => {
    const role = getCurrentUserRole();
    if (role === "creator") return true; // Creator can always access
    if (role === "editor") return true; // Editor can always access
    return hasFinalLayout; // Viewer can only access if final layout exists
  },

  // Tool access
  canAccessTools: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Creator and editor can access tools
  },

  canSwitchViews: (): boolean => {
    return true; // Everyone can switch views
  },

  // Edit operations
  canEditContent: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Creator and editor can edit
  },

  canDeleteElements: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Creator and editor can delete
  },

  canAddElements: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Creator and editor can add elements
  },

  // UI restrictions
  shouldShowToolbar: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Hide toolbar for viewers
  },

  shouldShowSaveButton: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator" || role === "editor"; // Hide save button for viewers
  },

  shouldShowUploadButton: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Hide upload button for shared users
  },

  shouldShowExportButton: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Hide export button for shared users
  },

  shouldShowOCRButton: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Hide OCR button for shared users
  },

  shouldShowDocumentTypeSelector: (): boolean => {
    const role = getCurrentUserRole();
    return role === "creator"; // Hide document type selector for shared users
  }
};

/**
 * Get user role display information
 */
export function getRoleDisplayInfo(role: UserRole) {
  switch (role) {
    case "creator":
      return {
        label: "Owner",
        color: "blue",
        description: "Full access to all features"
      };
    case "editor":
      return {
        label: "Editor",
        color: "green", 
        description: "Can edit content and generate layouts"
      };
    case "viewer":
      return {
        label: "Viewer",
        color: "yellow",
        description: "Read-only access"
      };
  }
}