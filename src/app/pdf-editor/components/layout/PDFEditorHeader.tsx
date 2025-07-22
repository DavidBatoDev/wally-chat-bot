import React from "react";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Download,
  Save,
  ChevronLeft,
  ChevronRight,
  Undo2,
  Redo2,
  RotateCcw,
  FileText,
  Settings,
  Check,
} from "lucide-react";
import { WorkflowStep } from "../../types/pdf-editor.types";

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
  onLoadSampleData?: () => void;
  onRunOcrAllPages?: () => void;
  isBulkOcrRunning?: boolean;
  bulkOcrProgress?: { current: number; total: number } | null;
  onCancelBulkOcr?: () => void;
  hasPages?: boolean;
  onOpenSettings?: () => void;
  onClearPageTranslation?: () => void;
  isCurrentPageTranslated?: boolean;
  currentWorkflowStep: WorkflowStep;
  onWorkflowStepChange: (step: WorkflowStep) => void;
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
  onLoadSampleData,
  onRunOcrAllPages,
  isBulkOcrRunning,
  bulkOcrProgress,
  onCancelBulkOcr,
  hasPages,
  onOpenSettings,
  onClearPageTranslation,
  isCurrentPageTranslated,
  currentWorkflowStep,
  onWorkflowStepChange,
}) => {
  return (
    <div className="bg-white border-b border-blue-100 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          <Button
            onClick={onSidebarToggle}
            variant="ghost"
            size="sm"
            className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition-colors w-10 h-10 p-0"
            title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </Button>

          {/* Wally Logo and Title (added back) */}
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">
                Wally
              </h1>
              <p className="text-sm text-blue-600 font-medium">
                Multimodal Translation
              </p>
            </div>
          </div>

          {/* Undo/Redo Buttons (left) */}
          {hasPages && (
            <>
              <Button
                onClick={onUndo}
                variant="outline"
                size="sm"
                className="border-blue-200 text-gray-900 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:scale-105 w-10 h-10 p-0"
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                onClick={onRedo}
                variant="outline"
                size="sm"
                className="border-blue-200 text-gray-900 hover:bg-blue-50 hover:border-blue-300 transition-all duration-200 hover:scale-105 w-10 h-10 p-0"
                disabled={!canRedo}
                title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
              >
                <Redo2 className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>

        {/* Centered Workflow Steps */}
        {hasPages && (
          <div className="flex-1 flex justify-center">
            <div className="flex items-center space-x-6">
              {/* Step 1: Translate */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer ${
                    currentWorkflowStep === "translate"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-gray-900 hover:bg-blue-100"
                  }`}
                  onClick={() => onWorkflowStepChange("translate")}
                >
                  {currentWorkflowStep !== "translate" ? (
                    "1"
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium cursor-pointer transition-colors ${
                    currentWorkflowStep === "translate"
                      ? "text-blue-600"
                      : "text-gray-900 hover:text-blue-700"
                  }`}
                  onClick={() => onWorkflowStepChange("translate")}
                >
                  Translate
                </span>
              </div>

              {/* Connector Line */}
              <div className="w-8 h-0.5 bg-blue-100"></div>

              {/* Step 2: Layout */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer ${
                    currentWorkflowStep === "layout"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-gray-900 hover:bg-blue-100"
                  }`}
                  onClick={() => onWorkflowStepChange("layout")}
                >
                  {currentWorkflowStep !== "layout" ? (
                    "2"
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium cursor-pointer transition-colors ${
                    currentWorkflowStep === "layout"
                      ? "text-blue-600"
                      : "text-gray-900 hover:text-blue-700"
                  }`}
                  onClick={() => onWorkflowStepChange("layout")}
                >
                  Layout
                </span>
              </div>

              {/* Connector Line */}
              <div className="w-8 h-0.5 bg-blue-100"></div>

              {/* Step 3: Final Layout */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer ${
                    currentWorkflowStep === "final-layout"
                      ? "bg-blue-600 text-white"
                      : "bg-blue-50 text-gray-900 hover:bg-blue-100"
                  }`}
                  onClick={() => onWorkflowStepChange("final-layout")}
                >
                  {currentWorkflowStep !== "final-layout" ? (
                    "3"
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium cursor-pointer transition-colors ${
                    currentWorkflowStep === "final-layout"
                      ? "text-blue-600"
                      : "text-gray-900 hover:text-blue-700"
                  }`}
                  onClick={() => onWorkflowStepChange("final-layout")}
                >
                  Final Layout
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Right-aligned Action Buttons */}
        <div className="flex items-center space-x-3">
          {onOpenSettings && (
            <Button
              onClick={onOpenSettings}
              variant="ghost"
              size="sm"
              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
          {onRunOcrAllPages && hasPages && !isBulkOcrRunning && (
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
          {hasPages && (
            <Button
              onClick={onExportData}
              className="bg-blue-600 hover:bg-blue-700 text-white border-blue-600 hover:border-blue-700 shadow-md transition-all duration-200 hover:shadow-lg"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
