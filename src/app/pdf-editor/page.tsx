"use client";

import React from "react";
import { TextFormatProvider } from "@/components/editor/ElementFormatContext";
import { PDFEditorContent } from "./PDFEditorContent";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

const PDFEditor: React.FC = () => {
  return (
    <TextFormatProvider>
      <PDFEditorContent />
    </TextFormatProvider>
  );
};

export default PDFEditor;
