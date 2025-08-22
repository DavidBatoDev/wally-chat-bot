"use client";

import React, { useEffect } from "react";
import { PDFEditorContent } from "../pdf-editor/PDFEditorContent";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { Eye, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ViewerPDFEditorContentProps {
  projectData: any;
  projectName: string;
  shareId: string;
}

export const ViewerPDFEditorContent: React.FC<ViewerPDFEditorContentProps> = ({
  projectData,
  projectName,
  shareId,
}) => {
  useEffect(() => {
    // Set up shared viewer context
    localStorage.setItem("pdf-editor-shared-mode", "true");
    localStorage.setItem("pdf-editor-shared-permissions", "viewer");
    localStorage.setItem("pdf-editor-shared-project-id", projectData.id);
    localStorage.setItem("pdf-editor-share-id", shareId);
    
    // Store the project data for the PDF editor to load
    const storageKey = `pdf-editor-shared-${shareId}`;
    if (projectData?.project_data) {
      localStorage.setItem(storageKey, JSON.stringify(projectData.project_data));
      localStorage.setItem("pdf-editor-current-project", storageKey);
    }

    // Cleanup on unmount
    return () => {
      localStorage.removeItem("pdf-editor-shared-mode");
      localStorage.removeItem("pdf-editor-shared-permissions");
      localStorage.removeItem("pdf-editor-shared-project-id");
      localStorage.removeItem("pdf-editor-share-id");
    };
  }, [projectData, shareId]);

  const handleCopyShareLink = () => {
    const shareLink = `${window.location.origin}/pdf-editor/shared/${shareId}`;
    navigator.clipboard.writeText(shareLink);
    toast.success("Share link copied to clipboard!");
  };

  return (
    <div className="relative h-screen flex flex-col">
      {/* Viewer banner */}
      <div className="bg-yellow-50 border-b border-yellow-200">
        <div className="max-w-7xl mx-auto px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-yellow-600" />
              <p className="text-sm font-medium text-yellow-800">
                Viewing: {projectName} (Read-only)
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Button
                onClick={handleCopyShareLink}
                variant="ghost"
                size="sm"
                className="text-yellow-700 hover:text-yellow-800"
              >
                <Share2 className="w-4 h-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* PDF Editor (read-only mode will be handled by the editor based on shared permissions) */}
      <div className="flex-1 overflow-hidden">
        <TextFormatProvider>
          <PDFEditorContent />
        </TextFormatProvider>
      </div>
    </div>
  );
};