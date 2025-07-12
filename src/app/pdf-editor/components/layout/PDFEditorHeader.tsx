import React from "react";
import { Button } from "@/components/ui/button";
import { Upload, Download, Save, Menu } from "lucide-react";

interface PDFEditorHeaderProps {
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  onFileUpload: () => void;
  onSaveProject: () => void;
  onExportData: () => void;
}

export const PDFEditorHeader: React.FC<PDFEditorHeaderProps> = ({
  isSidebarCollapsed,
  onSidebarToggle,
  onFileUpload,
  onSaveProject,
  onExportData,
}) => {
  return (
    <div className="bg-white border-b border-red-100 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <Button
            onClick={onSidebarToggle}
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors"
            title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            <Menu className="w-4 h-4" />
          </Button>

          {/* Logo and Title */}
          <div className="flex items-center space-x-3">
            {/* Circular W Logo */}
            <div className="w-10 h-10 bg-red-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Wally
              </h1>
              <p className="text-sm text-red-600 font-medium">
                Multimodal Translation
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center space-x-3">
          <Button
            onClick={onSaveProject}
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors"
          >
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button
            onClick={onExportData}
            className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-md transition-all duration-200 hover:shadow-lg"
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
};
