"use client";

import React from "react";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { PDFEditorContent } from "../PDFEditorContent";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

const CreateNewProject: React.FC = () => {
  const router = useRouter();

  const handleBackToDashboard = () => {
    router.push("/pdf-editor");
  };

  return (
    <div className="h-screen flex flex-col">
      {/* Navigation Header */}
      <div className="border-b bg-white px-4 py-2 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBackToDashboard}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Dashboard</span>
          </Button>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">|</span>
            <h1 className="text-lg font-semibold text-gray-900">
              New Project
            </h1>
          </div>
        </div>
      </div>

      {/* PDF Editor Content */}
      <div className="flex-1">
        <TextFormatProvider>
          <PDFEditorContent />
        </TextFormatProvider>
      </div>
    </div>
  );
};

export default CreateNewProject;
