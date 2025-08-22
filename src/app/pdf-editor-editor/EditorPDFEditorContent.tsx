"use client";

import React, { useLayoutEffect, useEffect, useState } from "react";
import { PDFEditorContent } from "../pdf-editor/PDFEditorContent";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { Edit3, Clock } from "lucide-react";

interface EditorPDFEditorContentProps {
  projectData: any;
  projectId: string;
  shareId: string;
  projectName: string;
}

export const EditorPDFEditorContent: React.FC<EditorPDFEditorContentProps> = ({
  projectData,
  projectId,
  shareId,
  projectName,
}) => {
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Set up shared editor context
  useLayoutEffect(() => {
    // Store context for the PDF editor
    localStorage.setItem("pdf-editor-shared-mode", "true");
    localStorage.setItem("pdf-editor-shared-permissions", "editor");
    localStorage.setItem("pdf-editor-shared-project-id", projectId);
    localStorage.setItem("pdf-editor-share-id", shareId);
    
    // Editor will load current state from database instead of using static project data
    console.log("Editor mode: Setting up for database loading", {
      projectId,
      shareId,
      projectName
    });

    // Cleanup on unmount
    return () => {
      localStorage.removeItem("pdf-editor-shared-mode");
      localStorage.removeItem("pdf-editor-shared-permissions");
      localStorage.removeItem("pdf-editor-shared-project-id");
      localStorage.removeItem("pdf-editor-share-id");
      // No additional cleanup needed
    };
  }, [projectId, shareId, projectData]);

  // Track last saved time for banner display (save highlighting handled by PDFEditorContent)
  useEffect(() => {
    let lastSaved = localStorage.getItem("pdf-editor-last-saved");

    const checkForSaveUpdates = () => {
      const currentLastSaved = localStorage.getItem("pdf-editor-last-saved");
      
      // Check for successful save
      if (currentLastSaved !== lastSaved) {
        lastSaved = currentLastSaved;
        if (currentLastSaved) {
          setLastSavedAt(new Date(currentLastSaved));
        }
      }
    };

    // Check for save updates every 2 seconds
    const interval = setInterval(checkForSaveUpdates, 2000);

    return () => {
      clearInterval(interval);
    };
  }, []);

  // beforeunload warning handled by main PDFEditorContent

  // Manual save and share removed - use blue icons in header instead

  return (
    <div className="relative h-screen flex flex-col">
      {/* Editor banner */}
      <div className="bg-green-50 border-b border-green-200">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Edit3 className="w-4 h-4 text-green-600" />
              <p className="text-sm font-medium text-green-800">
                Editing: {projectName}
              </p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Save status */}
              <div className="flex items-center space-x-2 text-xs text-green-600">
                {lastSavedAt && (
                  <>
                    <Clock className="w-3 h-3" />
                    <span>Last saved: {lastSavedAt.toLocaleTimeString()}</span>
                  </>
                )}
                {/* Unsaved changes indicator now shown in save button highlighting */}
              </div>

              {/* Use blue icons in header instead of redundant buttons */}
            </div>
          </div>
        </div>
      </div>

      {/* PDF Editor */}
      <div className="flex-1 overflow-hidden">
        <TextFormatProvider>
          <PDFEditorContent />
        </TextFormatProvider>
      </div>
    </div>
  );
};