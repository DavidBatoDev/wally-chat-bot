import React from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Download,
  Save,
  Menu,
  Undo2,
  Redo2,
  RotateCcw,
  FileText,
} from "lucide-react";

interface PDFEditorHeaderProps {
  isSidebarCollapsed: boolean;
  onSidebarToggle: () => void;
  onFileUpload: () => void;
  onSaveProject: () => void;
  onExportData: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onClearAllTranslations?: () => void;
  onLoadSampleData?: () => void;
  onRunOcrAllPages?: () => void;
  isBulkOcrRunning?: boolean;
  bulkOcrProgress?: { current: number; total: number } | null;
  onCancelBulkOcr?: () => void;
}

export const PDFEditorHeader: React.FC<PDFEditorHeaderProps> = ({
  isSidebarCollapsed,
  onSidebarToggle,
  onFileUpload,
  onSaveProject,
  onExportData,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearAllTranslations,
  onLoadSampleData,
  onRunOcrAllPages,
  isBulkOcrRunning,
  bulkOcrProgress,
  onCancelBulkOcr,
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
          {onLoadSampleData && (
            <Button
              onClick={onLoadSampleData}
              variant="outline"
              size="sm"
              className="border-blue-200 text-blue-700 hover:bg-blue-50 hover:border-blue-300 transition-colors"
              title="Load sample data"
            >
              <FileText className="w-4 h-4 mr-2" />
              Load Sample
            </Button>
          )}
          <Button
            onClick={onUndo}
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors"
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="w-4 h-4 mr-2" />
            Undo
          </Button>
          <Button
            onClick={onRedo}
            variant="outline"
            size="sm"
            className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors"
            disabled={!canRedo}
            title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
          >
            <Redo2 className="w-4 h-4 mr-2" />
            Redo
          </Button>
          {onClearAllTranslations && (
            <Button
              onClick={onClearAllTranslations}
              variant="outline"
              size="sm"
              className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 transition-colors"
              title="Clear all translations"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Clear Translations
            </Button>
          )}
          {/* Run OCR to All Page Button and Progress */}
          {onRunOcrAllPages && !isBulkOcrRunning && (
            <Button
              onClick={onRunOcrAllPages}
              variant="outline"
              size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-colors"
              title="Run OCR to all pages"
            >
              <span className="font-semibold">Run OCR to All Page</span>
            </Button>
          )}
          {isBulkOcrRunning && (
            <div className="flex items-center space-x-2">
              <span className="text-green-700 font-medium text-sm">
                Transforming: {bulkOcrProgress?.current ?? 0} /{" "}
                {bulkOcrProgress?.total ?? 0} pages
              </span>
              <Button
                onClick={onCancelBulkOcr}
                variant="destructive"
                size="sm"
                className="ml-2"
              >
                Cancel
              </Button>
            </div>
          )}
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
            Export PDF
          </Button>
        </div>
      </div>
    </div>
  );
};
