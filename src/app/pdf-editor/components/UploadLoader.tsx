/**
 * Upload Loader Component
 * Shows a simple loading state during file upload and project creation
 */

import React from "react";
import { Upload, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface UploadLoaderProps {
  isVisible: boolean;
  fileName?: string;
  stage: "uploading" | "processing" | "complete" | "error";
  message?: string;
  progress?: number; // Progress percentage (0-100)
}

const stageConfig = {
  uploading: {
    icon: <Loader2 className="h-8 w-8 animate-spin text-blue-500" />,
    title: "Uploading File",
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  processing: {
    icon: <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />,
    title: "Creating Project",
    color: "text-yellow-600",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  complete: {
    icon: <CheckCircle className="h-8 w-8 text-green-500" />,
    title: "Upload Complete",
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-green-200",
  },
  error: {
    icon: <AlertCircle className="h-8 w-8 text-red-500" />,
    title: "Upload Failed",
    color: "text-red-600",
    bgColor: "bg-red-50",
    borderColor: "border-red-200",
  },
};

export const UploadLoader: React.FC<UploadLoaderProps> = ({
  isVisible,
  fileName,
  stage,
  message,
  progress,
}) => {
  if (!isVisible) return null;

  const config = stageConfig[stage];

  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-40">
      <div
        className={`bg-white rounded-lg shadow-lg p-6 max-w-sm w-full mx-4 border-2 ${config.borderColor}`}
      >
        {/* Icon and Status */}
        <div className="text-center mb-4">
          <div
            className={`w-16 h-16 ${config.bgColor} rounded-full flex items-center justify-center mx-auto mb-3`}
          >
            {config.icon}
          </div>
          <h3 className={`text-lg font-semibold ${config.color} mb-1`}>
            {config.title}
          </h3>
          {fileName && (
            <p className="text-sm text-gray-600 truncate">{fileName}</p>
          )}
        </div>

        {/* Progress Bar (for uploading stage with progress) */}
        {stage === "uploading" && progress !== undefined && (
          <div className="mb-4">
            <div className="flex justify-between items-center text-xs text-gray-600 mb-1">
              <span>Upload Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Message */}
        {message && (
          <div className="text-center mb-4">
            <p className="text-sm text-gray-700">{message}</p>
          </div>
        )}

        {/* Progress Dots (for processing stages without specific progress) */}
        {((stage === "uploading" && progress === undefined) ||
          stage === "processing") && (
          <div className="flex justify-center space-x-1">
            <div
              className={`w-2 h-2 ${config.bgColor} rounded-full animate-bounce`}
              style={{ animationDelay: "0ms" }}
            ></div>
            <div
              className={`w-2 h-2 ${config.bgColor} rounded-full animate-bounce`}
              style={{ animationDelay: "150ms" }}
            ></div>
            <div
              className={`w-2 h-2 ${config.bgColor} rounded-full animate-bounce`}
              style={{ animationDelay: "300ms" }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadLoader;
