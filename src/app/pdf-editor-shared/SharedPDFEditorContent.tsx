"use client";

import React, { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { PDFEditorContent } from "../pdf-editor/PDFEditorContent";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { Eye, Edit3, Save } from "lucide-react";

interface SharedPDFEditorContentProps {
  projectId: string;
  shareId: string;
  permissions: "viewer" | "editor";
  projectData: any;
  requiresAuth: boolean;
}

export const SharedPDFEditorContent: React.FC<SharedPDFEditorContentProps> = ({
  projectId,
  shareId,
  permissions,
  projectData,
  requiresAuth,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Store shared project context in localStorage for the PDF editor to access
  useEffect(() => {
    // Set up shared project context
    localStorage.setItem("pdf-editor-shared-mode", "true");
    localStorage.setItem("pdf-editor-shared-project-id", projectId);
    localStorage.setItem("pdf-editor-shared-permissions", permissions);
    localStorage.setItem("pdf-editor-share-id", shareId);
    
    // Store the project data
    const storageKey = `pdf-editor-shared-${shareId}`;
    if (projectData && projectData.project_data) {
      localStorage.setItem(storageKey, JSON.stringify(projectData.project_data));
      localStorage.setItem("pdf-editor-current-project", storageKey);
    }

    // Cleanup on unmount
    return () => {
      localStorage.removeItem("pdf-editor-shared-mode");
      localStorage.removeItem("pdf-editor-shared-project-id");
      localStorage.removeItem("pdf-editor-shared-permissions");
      localStorage.removeItem("pdf-editor-share-id");
      localStorage.removeItem("pdf-editor-temp-state");
    };
  }, [projectId, shareId, permissions, projectData]);

  // Auto-save functionality for editor mode
  useEffect(() => {
    if (permissions !== "editor") return;

    const autoSaveInterval = setInterval(() => {
      // The PDF editor will handle the actual saving through useProjectState
      console.log("Auto-save check for shared project");
    }, 60000); // Auto-save every minute

    return () => clearInterval(autoSaveInterval);
  }, [permissions]);

  const renderPermissionBanner = () => {
    if (permissions === "viewer") {
      return (
        <div className="fixed top-0 left-0 right-0 bg-yellow-50 border-b border-yellow-200 z-50">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Eye className="w-4 h-4 text-yellow-600" />
                <p className="text-sm font-medium text-yellow-800">
                  You are viewing this project in read-only mode
                </p>
              </div>
              {requiresAuth && (
                <p className="text-xs text-yellow-600">
                  Sign in required for full access
                </p>
              )}
            </div>
          </div>
        </div>
      );
    } else if (permissions === "editor") {
      return (
        <div className="fixed top-0 left-0 right-0 bg-green-50 border-b border-green-200 z-50">
          <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Edit3 className="w-4 h-4 text-green-600" />
                <p className="text-sm font-medium text-green-800">
                  You have editor access to this shared project
                </p>
              </div>
              <div className="flex items-center space-x-4">
                {lastSavedAt && (
                  <p className="text-xs text-green-600">
                    Last saved: {lastSavedAt.toLocaleTimeString()}
                  </p>
                )}
                {isSaving && (
                  <div className="flex items-center space-x-1">
                    <Save className="w-3 h-3 text-green-600 animate-pulse" />
                    <p className="text-xs text-green-600">Saving...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="relative">
      {renderPermissionBanner()}
      <div className={permissions === "viewer" || permissions === "editor" ? "pt-10" : ""}>
        <TextFormatProvider>
          <PDFEditorContent />
        </TextFormatProvider>
      </div>
    </div>
  );
};