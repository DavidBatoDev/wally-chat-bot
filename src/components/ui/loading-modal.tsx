import React from "react";
import { X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface LoadingModalProps {
  isOpen: boolean;
  title?: string;
  message?: string;
  progress?: {
    current: number;
    total: number;
  } | null;
  onCancel?: () => void;
  cancelText?: string;
}

export const LoadingModal: React.FC<LoadingModalProps> = ({
  isOpen,
  title = "Processing...",
  message = "Please wait while we process your request.",
  progress,
  onCancel,
  cancelText = "Cancel",
}) => {
  if (!isOpen) return null;

  const progressPercentage = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/90 backdrop-blur-sm transition-opacity duration-300" />
      
      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="bg-white rounded-lg shadow-2xl border border-gray-200 overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              {onCancel && (
                <Button
                  onClick={onCancel}
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          
          {/* Content */}
          <div className="px-6 pb-6">
            {/* Loading animation */}
            <div className="flex items-center justify-center mb-4">
              <div className="relative">
                <Loader2 className="h-8 w-8 text-blue-600 animate-spin" />
                <div className="absolute inset-0 rounded-full border-2 border-blue-100" />
              </div>
            </div>
            
            {/* Message */}
            <p className="text-sm text-gray-600 text-center mb-4">{message}</p>
            
            {/* Progress */}
            {progress && progress.total > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">
                    {progress.current} of {progress.total} pages
                  </span>
                  <span className="text-blue-600 font-medium">
                    {progressPercentage}%
                  </span>
                </div>
                
                {/* Progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-blue-600 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
            )}
            
            {/* Cancel button */}
            {onCancel && (
              <div className="mt-6 flex justify-center">
                <Button
                  onClick={onCancel}
                  variant="outline"
                  className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300"
                >
                  {cancelText}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};