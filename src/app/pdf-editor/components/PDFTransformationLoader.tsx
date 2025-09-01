/**
 * PDF Transformation Loader Component
 * Shows progress during PDF A4 transformation
 */

import React from "react";
import { FileText, CheckCircle, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TransformationProgress } from "../services/pdfTransformService";

interface PDFTransformationLoaderProps {
  isVisible: boolean;
  progress: TransformationProgress;
  fileName?: string;
}

const stageMessages = {
  loading: "Loading PDF document...",
  analyzing: "Analyzing document for optimization...",
  transforming: "Converting and compressing pages...",
  saving: "Saving optimized document...",
  complete: "Transformation complete!",
};

const stageIcons = {
  loading: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  analyzing: <FileText className="h-5 w-5 text-yellow-500" />,
  transforming: <Loader2 className="h-5 w-5 animate-spin text-blue-500" />,
  saving: <Loader2 className="h-5 w-5 animate-spin text-green-500" />,
  complete: <CheckCircle className="h-5 w-5 text-green-500" />,
};

export const PDFTransformationLoader: React.FC<
  PDFTransformationLoaderProps
> = ({ isVisible, progress, fileName }) => {
  if (!isVisible) return null;

  // Calculate overall progress percentage
  const getProgressPercentage = () => {
    switch (progress.stage) {
      case "loading":
        return 10;
      case "analyzing":
        return 20;
      case "transforming":
        if (progress.currentPage && progress.totalPages) {
          return 20 + (progress.currentPage / progress.totalPages) * 60; // 20% to 80%
        }
        return 50;
      case "saving":
        return 90;
      case "complete":
        return 100;
      default:
        return 0;
    }
  };

  const progressPercentage = getProgressPercentage();

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="h-8 w-8 text-blue-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Transforming PDF to A4
          </h3>
          {fileName && (
            <p className="text-sm text-gray-600 truncate">{fileName}</p>
          )}
        </div>

        {/* Progress Section */}
        <div className="space-y-4">
          {/* Overall Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Progress</span>
              <span className="text-gray-900 font-medium">
                {Math.round(progressPercentage)}%
              </span>
            </div>
            <Progress value={progressPercentage} className="h-2" />
          </div>

          {/* Current Stage */}
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
            {stageIcons[progress.stage]}
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                {stageMessages[progress.stage]}
              </p>
              {progress.message &&
                progress.message !== stageMessages[progress.stage] && (
                  <p className="text-xs text-gray-600 mt-1">
                    {progress.message}
                  </p>
                )}
            </div>
          </div>

          {/* Page Progress (for transformation stage) */}
          {progress.stage === "transforming" &&
            progress.currentPage &&
            progress.totalPages && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Pages</span>
                  <span className="text-gray-900">
                    {progress.currentPage} of {progress.totalPages}
                  </span>
                </div>
                <Progress
                  value={(progress.currentPage / progress.totalPages) * 100}
                  className="h-1"
                />
              </div>
            )}

          {/* Stages Checklist */}
          <div className="space-y-2 pt-2">
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Transformation Steps
            </div>
            {Object.entries(stageMessages).map(([stage, message]) => {
              const isCompleted =
                getStageOrder(progress.stage) >
                getStageOrder(stage as keyof typeof stageMessages);
              const isCurrent = progress.stage === stage;

              return (
                <div
                  key={stage}
                  className={`flex items-center space-x-2 text-xs ${
                    isCompleted
                      ? "text-green-600"
                      : isCurrent
                      ? "text-blue-600"
                      : "text-gray-400"
                  }`}
                >
                  {isCompleted ? (
                    <CheckCircle className="h-3 w-3" />
                  ) : isCurrent ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-current" />
                  )}
                  <span>{message}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            This may take a moment depending on document size...
          </p>
        </div>
      </div>
    </div>
  );
};

// Helper function to determine stage order
function getStageOrder(stage: keyof typeof stageMessages): number {
  const order = {
    loading: 1,
    analyzing: 2,
    transforming: 3,
    saving: 4,
    complete: 5,
  };
  return order[stage] || 0;
}

export default PDFTransformationLoader;
