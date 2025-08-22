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
  FolderOpen,
  RefreshCw,
  Share2,
  ArrowLeft,
  Menu,
} from "lucide-react";
import { WorkflowStep } from "../../types/pdf-editor.types";
import { permissions } from "../../../pdf-editor-shared/utils/permissions";

interface PDFEditorHeaderProps {
  onFileUpload: () => void;
  onSaveProject: () => Promise<any>;
  hasUnsavedChanges?: boolean;
  onProjectManagement?: () => void;
  onShareProject?: () => void;
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
  onRecreateFinalLayout?: () => void;
  isCapturingSnapshots?: boolean;
  // New props for project name and navigation
  projectName?: string | null;
  onBackToDashboard?: () => void;
  hasFinalLayout?: boolean;
}

export const PDFEditorHeader: React.FC<PDFEditorHeaderProps> = ({
  onFileUpload,
  onSaveProject,
  hasUnsavedChanges = false,
  onProjectManagement,
  onShareProject,
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
  onRecreateFinalLayout,
  isCapturingSnapshots,
  projectName,
  onBackToDashboard,
  hasFinalLayout = false,
}) => {
  return (
    <div className="bg-white border-b border-primary/20 shadow-sm">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center space-x-4">
          {/* Wally Logo and Project Name */}
          <div 
            className="flex items-center space-x-3 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={onBackToDashboard}
            title="Back to Dashboard"
          >
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center shadow-md">
              <span className="text-white font-bold text-lg">W</span>
            </div>
            {projectName ? (
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  {projectName}
                </h1>
                <p className="text-sm text-primary font-medium">
                  Project Document
                </p>
              </div>
            ) : (
              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight">
                  Wally
                </h1>
                <p className="text-sm text-primary font-medium">
                  Multimodal Translation
                </p>
              </div>
            )}
          </div>

          {/* Undo/Redo Buttons (left) */}
          {hasPages && (
            <>
              <Button
                onClick={onUndo}
                variant="outline"
                size="sm"
                className="border-primary/20 text-gray-900 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 hover:scale-105 w-10 h-10 p-0"
                disabled={!canUndo}
                title="Undo (Ctrl+Z)"
              >
                <Undo2 className="w-4 h-4" />
              </Button>
              <Button
                onClick={onRedo}
                variant="outline"
                size="sm"
                className="border-primary/20 text-gray-900 hover:bg-primary/10 hover:border-primary/30 transition-all duration-200 hover:scale-105 w-10 h-10 p-0"
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
                      ? "bg-primary text-white"
                      : "bg-primary/10 text-gray-900 hover:bg-primary/20"
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
                      ? "text-primary"
                      : "text-gray-900 hover:text-primaryLight"
                  }`}
                  onClick={() => onWorkflowStepChange("translate")}
                >
                  Translate
                </span>
              </div>

              {/* Connector Line */}
              <div className="w-8 h-0.5 bg-primary/20"></div>

              {/* Step 2: Layout */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors cursor-pointer ${
                    currentWorkflowStep === "layout"
                      ? "bg-primary text-white"
                      : "bg-primary/10 text-gray-900 hover:bg-primary/20"
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
                      ? "text-primary"
                      : "text-gray-900 hover:text-primaryLight"
                  }`}
                  onClick={() => onWorkflowStepChange("layout")}
                >
                  Layout
                </span>
              </div>

              {/* Connector Line */}
              <div className="w-8 h-0.5 bg-primary/20"></div>

              {/* Step 3: Final Layout */}
              <div className="flex items-center space-x-2">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
                    permissions.canAccessFinalLayoutStep(hasFinalLayout) 
                      ? "cursor-pointer" 
                      : "cursor-not-allowed opacity-50"
                  } ${
                    currentWorkflowStep === "final-layout"
                      ? "bg-primary text-white"
                      : "bg-primary/10 text-gray-900 hover:bg-primary/20"
                  }`}
                  onClick={() => permissions.canAccessFinalLayoutStep(hasFinalLayout) && onWorkflowStepChange("final-layout")}
                >
                  {currentWorkflowStep !== "final-layout" ? (
                    "3"
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                </div>
                <span
                  className={`text-sm font-medium transition-colors ${
                    permissions.canAccessFinalLayoutStep(hasFinalLayout) 
                      ? "cursor-pointer" 
                      : "cursor-not-allowed opacity-50"
                  } ${
                    currentWorkflowStep === "final-layout"
                      ? "text-primary"
                      : "text-gray-900 hover:text-primaryLight"
                  }`}
                  onClick={() => permissions.canAccessFinalLayoutStep(hasFinalLayout) && onWorkflowStepChange("final-layout")}
                >
                  Final Layout
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Right-aligned Action Buttons */}
        <div className="flex items-center space-x-3">
          {onProjectManagement && (
            <Button
              onClick={onProjectManagement}
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primaryLight hover:bg-primary/10 transition-colors"
              title="Project Management"
            >
              <FolderOpen className="w-4 h-4" />
            </Button>
          )}
          {permissions.shouldShowSaveButton() && (
            <Button
              onClick={async () => {
                try {
                  await onSaveProject();
                } catch (error) {
                  console.error("Save failed:", error);
                }
              }}
              variant="ghost"
              size="sm"
              className={`transition-colors ${
                hasUnsavedChanges
                  ? "text-orange-600 hover:text-orange-700 hover:bg-orange-50 bg-orange-50/50"
                  : "text-primary hover:text-primaryLight hover:bg-primary/10"
              }`}
              title={hasUnsavedChanges ? "Save Project (Unsaved Changes)" : "Save Project"}
            >
              <Save 
                className={`w-4 h-4 ${hasUnsavedChanges ? "animate-pulse" : ""}`} 
              />
            </Button>
          )}
          {onShareProject && (
            <Button
              onClick={onShareProject}
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primaryLight hover:bg-primary/10 transition-colors"
              title="Share Project"
            >
              <Share2 className="w-4 h-4" />
            </Button>
          )}
          {onOpenSettings && (
            <Button
              onClick={onOpenSettings}
              variant="ghost"
              size="sm"
              className="text-primary hover:text-primaryLight hover:bg-primary/10 transition-colors"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
            </Button>
          )}
          {/* {onRunOcrAllPages && hasPages && !isBulkOcrRunning && (
            <Button
              onClick={onRunOcrAllPages}
              variant="outline"
              size="sm"
              className="border-green-200 text-green-700 hover:bg-green-50 hover:border-green-300 transition-colors"
              title="Run OCR to all pages"
            >
              <span className="font-semibold">Run OCR to All Page</span>
            </Button>
          )} */}
          {/* {isBulkOcrRunning && (
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
          )} */}
          {hasPages && (
            <>
              {currentWorkflowStep === "translate" && (
                <Button
                  onClick={() => onWorkflowStepChange("layout")}
                  className="bg-primary hover:bg-primaryLight text-white border-primary hover:border-primaryLight shadow-md transition-all duration-200 hover:shadow-lg"
                  size="sm"
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Go to Layout
                </Button>
              )}
              {currentWorkflowStep === "layout" && permissions.canGenerateFinalLayout() && (
                <Button
                  onClick={() => onWorkflowStepChange("final-layout")}
                  className="bg-primary hover:bg-primaryLight text-white border-primary hover:border-primaryLight shadow-md transition-all duration-200 hover:shadow-lg"
                  size="sm"
                >
                  <ChevronRight className="w-4 h-4 mr-2" />
                  Go to Final Layout
                </Button>
              )}
              {currentWorkflowStep === "final-layout" && permissions.canGenerateFinalLayout() && (
                <Button
                  onClick={onRecreateFinalLayout}
                  disabled={isCapturingSnapshots}
                  className="bg-primary hover:bg-primaryLight text-white border-primary hover:border-primaryLight shadow-md transition-all duration-200 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                  size="sm"
                >
                  {isCapturingSnapshots ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Recreating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Recreate Final-Layout
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
