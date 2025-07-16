import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { X, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemoizedTextBox } from "./elements/TextBox";
import { TextField } from "../types/pdf-editor.types";
import { ElementFormatDrawer } from "@/components/editor/ElementFormatDrawer";
import { useTextSpanHandling } from "../hooks/useTextSpanHandling";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface TemplateEditorPopupProps {
  isOpen: boolean;
  onClose: () => void;
  onContinue: (templateCanvas: HTMLCanvasElement) => void;
}

const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export const TemplateEditorPopup: React.FC<TemplateEditorPopupProps> = ({
  isOpen,
  onClose,
  onContinue,
}) => {
  const [textBoxes, setTextBoxes] = useState<TextField[]>([]);
  const [isAddTextBoxMode, setIsAddTextBoxMode] = useState(false);
  const [selectedTextBoxId, setSelectedTextBoxId] = useState<string | null>(
    null
  );
  const [scale, setScale] = useState(1.0);
  const [pageWidth, setPageWidth] = useState(0);
  const [pageHeight, setPageHeight] = useState(0);
  const [autoFocusTextBoxId, setAutoFocusTextBoxId] = useState<string | null>(
    null
  );
  const documentRef = useRef<HTMLDivElement>(null);
  const templatePath = "/export_template/export_first_page.pdf";

  // Handle PDF load success
  const onDocumentLoadSuccess = useCallback((pdf: any) => {
    console.log("Template PDF loaded successfully");
  }, []);

  // Handle page load success
  const onPageLoadSuccess = useCallback((page: any) => {
    const { width, height } = page;
    setPageWidth(width);
    setPageHeight(height);
    console.log("Template page loaded:", { width, height });
  }, []);

  // Create deletion rectangle for text span
  const createDeletionRectangleForSpan = useCallback(
    (span: HTMLElement) => {
      const rect = span.getBoundingClientRect();
      const documentRect = documentRef.current?.getBoundingClientRect();

      if (!documentRect) return "";

      const x = (rect.left - documentRect.left) / scale;
      const y = (rect.top - documentRect.top) / scale;
      const width = rect.width / scale;
      const height = rect.height / scale;

      // For template editor, we'll just hide the span instead of creating deletion rectangle
      span.style.display = "none";
      return "";
    },
    [scale]
  );

  // Create text field from text span
  const createTextFieldFromSpan = useCallback(
    (span: HTMLElement) => {
      const rect = span.getBoundingClientRect();
      const documentRect = documentRef.current?.getBoundingClientRect();

      if (!documentRect) return null;

      const x = (rect.left - documentRect.left) / scale;
      const y = (rect.top - documentRect.top) / scale;
      const width = rect.width / scale;
      const height = rect.height / scale;

      const newTextBox: TextField = {
        id: generateUUID(),
        x,
        y,
        width: Math.max(width, 100),
        height: Math.max(height, 20),
        value: span.textContent || "",
        fontSize: 14,
        fontFamily: "Arial",
        color: "#000000",
        bold: false,
        italic: false,
        underline: false,
        textAlign: "left",
        page: 1,
        rotation: 0,
        lineHeight: 1.2,
        letterSpacing: 0,
        borderColor: "#000000",
        borderWidth: 0,
        backgroundColor: "transparent",
        borderRadius: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        textOpacity: 1,
        backgroundOpacity: 1,
        isEditing: false,
        listType: "none",
      };

      setTextBoxes((prev) => [...prev, newTextBox]);
      setSelectedTextBoxId(newTextBox.id);

      // Hide the original span
      span.style.display = "none";

      return {
        textFieldId: newTextBox.id,
        properties: newTextBox,
      };
    },
    [scale]
  );

  // Add deletion rectangle (not used in template editor but required by hook)
  const addDeletionRectangle = useCallback(() => "", []);

  // Update text box
  const updateTextBox = useCallback(
    (id: string, updates: Partial<TextField>) => {
      setTextBoxes((prev) =>
        prev.map((textBox) =>
          textBox.id === id ? { ...textBox, ...updates } : textBox
        )
      );
    },
    []
  );

  // Delete text box
  const deleteTextBox = useCallback(
    (id: string) => {
      setTextBoxes((prev) => prev.filter((textBox) => textBox.id !== id));
      if (selectedTextBoxId === id) {
        setSelectedTextBoxId(null);
      }
    },
    [selectedTextBoxId]
  );

  // Handle auto focus completion
  const handleAutoFocusComplete = useCallback(() => {
    setAutoFocusTextBoxId(null);
  }, []);

  // Text span handling hook
  const { isZooming: isTextSpanZooming } = useTextSpanHandling({
    isAddTextBoxMode,
    scale,
    currentPage: 1,
    pdfBackgroundColor: "#ffffff",
    erasureSettings: {
      width: 20,
      height: 20,
      background: "#ffffff",
      opacity: 1,
    },
    createDeletionRectangleForSpan,
    createTextFieldFromSpan,
    addDeletionRectangle,
    updateTextBox,
    setAutoFocusTextBoxId,
  });

  // Add text box at clicked position
  const handleDocumentClick = useCallback(
    (e: React.MouseEvent) => {
      if (!isAddTextBoxMode) return;

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = (e.clientX - rect.left) / scale;
      const y = (e.clientY - rect.top) / scale;

      const newTextBox: TextField = {
        id: generateUUID(),
        x,
        y,
        width: 200,
        height: 30,
        value: "New Text",
        fontSize: 14,
        fontFamily: "Arial",
        color: "#000000",
        bold: false,
        italic: false,
        underline: false,
        textAlign: "left",
        page: 1,
        rotation: 0,
        lineHeight: 1.2,
        letterSpacing: 0,
        borderColor: "#000000",
        borderWidth: 0,
        backgroundColor: "transparent",
        borderRadius: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        paddingTop: 0,
        paddingRight: 0,
        paddingBottom: 0,
        paddingLeft: 0,
        textOpacity: 1,
        backgroundOpacity: 1,
        isEditing: false,
        listType: "none",
      };

      setTextBoxes((prev) => [...prev, newTextBox]);
      setIsAddTextBoxMode(false);
      setSelectedTextBoxId(newTextBox.id);
    },
    [isAddTextBoxMode, scale]
  );

  // Handle continue button click
  const handleContinue = useCallback(async () => {
    if (!documentRef.current) {
      console.error("Document ref not available");
      return;
    }

    try {
      console.log("Capturing template from document ref");

      // Import html2canvas dynamically
      const html2canvas = (await import("html2canvas")).default;

      // Capture the template document
      const canvas = await html2canvas(documentRef.current, {
        scale: 2, // Higher resolution for better quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        foreignObjectRendering: false,
        ignoreElements: (element) => {
          // Ignore control elements but keep the PDF and text boxes
          return (
            element.classList.contains("template-header") ||
            element.classList.contains("template-toolbar") ||
            element.classList.contains("template-footer") ||
            element.tagName === "BUTTON" ||
            element.classList.contains("drag-handle") ||
            element.classList.contains("react-resizable-handle") ||
            element.closest("button") !== null
          );
        },
        onclone: (clonedDoc) => {
          console.log("Cloning template document for capture...");

          // Find the cloned document container
          const clonedContainer = clonedDoc.querySelector('[data-template-editor]');

          if (clonedContainer) {
            // Remove control elements but keep content
            clonedContainer
              .querySelectorAll(
                "button, .drag-handle, .react-resizable-handle, .template-header, .template-toolbar, .template-footer"
              )
              .forEach((el) => el.remove());

            // Clean up Rnd containers for text boxes
            clonedContainer.querySelectorAll(".rnd").forEach((rnd) => {
              if (rnd instanceof HTMLElement) {
                // Remove border and controls but keep the content
                rnd.style.border = "none";
                rnd.style.backgroundColor = "transparent";
                rnd.style.boxShadow = "none";
                rnd.style.outline = "none";
                rnd.style.cursor = "default";

                // Clean up textarea styling
                const textarea = rnd.querySelector("textarea");
                if (textarea && textarea instanceof HTMLElement) {
                  textarea.style.border = "none";
                  textarea.style.outline = "none";
                  textarea.style.resize = "none";
                  textarea.style.padding = "2px";
                  textarea.style.margin = "0";
                  textarea.style.backgroundColor = "transparent";
                  textarea.style.cursor = "default";
                  textarea.style.overflow = "visible";
                  textarea.style.whiteSpace = "pre-wrap";
                  textarea.style.wordWrap = "break-word";
                }
              }
            });

            // Ensure the PDF canvas is visible in the clone
            const clonedCanvas = clonedContainer.querySelector(
              ".react-pdf__Page__canvas"
            ) as HTMLCanvasElement;
            if (clonedCanvas) {
              clonedCanvas.style.display = "block";
              clonedCanvas.style.position = "relative";
              clonedCanvas.style.zIndex = "1";
            }
          }
        },
      });

      console.log("Template canvas captured successfully:", {
        width: canvas.width,
        height: canvas.height,
        toDataURL: typeof canvas.toDataURL,
      });

      // Test that toDataURL works
      try {
        const dataUrl = canvas.toDataURL("image/png", 1.0);
        console.log(
          "Template canvas data URL created successfully, length:",
          dataUrl
        );
      } catch (error) {
        console.error("Error creating template canvas data URL:", error);
        throw error;
      }

      onContinue(canvas);
    } catch (error) {
      console.error("Error capturing template:", error);

      // Create a fallback canvas if capture fails
      const fallbackCanvas = document.createElement("canvas");
      const scale = 2;
      fallbackCanvas.width = 612 * scale;
      fallbackCanvas.height = 792 * scale;

      const ctx = fallbackCanvas.getContext("2d");
      if (ctx) {
        ctx.scale(scale, scale);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 612, 792);
        
        ctx.fillStyle = "#000000";
        ctx.font = "16px Arial";
        ctx.textAlign = "center";
        ctx.fillText("Template Page", 612 / 2, 792 / 2);
        ctx.fillText("(Template capture failed)", 612 / 2, 792 / 2 + 30);
        
        ctx.strokeStyle = "#cccccc";
        ctx.lineWidth = 1;
        ctx.strokeRect(0, 0, 612, 792);
      }

      console.log("Using fallback template canvas");
      onContinue(fallbackCanvas);
    }
  }, [onContinue]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl max-h-[90vh] w-full mx-4 flex flex-col">
        {/* Header */}
        <div className="template-header flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Edit Export Template</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Toolbar */}
        <div className="template-toolbar flex items-center gap-2 p-4 border-b bg-gray-50">
          <Button
            variant={isAddTextBoxMode ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAddTextBoxMode(!isAddTextBoxMode)}
            className="flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Text Box
          </Button>
          <div className="text-sm text-gray-600 ml-4">
            {isAddTextBoxMode
              ? "Click on the template to add a text box or click on text to replace it"
              : "Use the toolbar to edit the template"}
          </div>
        </div>

        {/* Template Editor */}
        <div className="flex-1 overflow-auto p-4">
          <div className="flex justify-center">
            <div
              ref={documentRef}
              data-template-editor
              className="relative border border-gray-300 shadow-lg"
              onClick={handleDocumentClick}
              style={{ cursor: isAddTextBoxMode ? "crosshair" : "default" }}
            >
              <div className="relative w-full h-full">
                <Document
                  file={templatePath}
                  onLoadSuccess={onDocumentLoadSuccess}
                  loading={
                    <div className="flex items-center justify-center h-96">
                      <div className="text-gray-500">Loading template...</div>
                    </div>
                  }
                  error={
                    <div className="flex items-center justify-center h-96">
                      <div className="text-red-500">
                        Failed to load template
                      </div>
                    </div>
                  }
                >
                  <Page
                    pageNumber={1}
                    scale={scale}
                    onLoadSuccess={onPageLoadSuccess}
                    renderTextLayer={!isTextSpanZooming}
                    renderAnnotationLayer={false}
                  />
                </Document>
              </div>

              {/* Template Elements - Wrapped for proper z-index */}
              <div className="absolute inset-0" style={{ zIndex: 10000 }}>
                {/* Render text boxes */}
                {textBoxes.map((textBox) => (
                  <MemoizedTextBox
                    key={textBox.id}
                    textBox={textBox}
                    isSelected={selectedTextBoxId === textBox.id}
                    isEditMode={true}
                    scale={scale}
                    onSelect={(id) => setSelectedTextBoxId(id)}
                    onUpdate={(id, updates) => updateTextBox(id, updates)}
                    onDelete={(id) => deleteTextBox(id)}
                    autoFocusId={autoFocusTextBoxId}
                    onAutoFocusComplete={handleAutoFocusComplete}
                    isMultiSelected={false}
                    selectedElementIds={[]}
                    onMultiSelectDragStart={() => {}}
                    onMultiSelectDrag={() => {}}
                    onMultiSelectDragStop={() => {}}
                    isInSelectionPreview={false}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="template-footer flex items-center justify-between p-4 border-t bg-gray-50">
          <div className="text-sm text-gray-600">
            Add text boxes to customize your export template
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Test export just the template
                try {
                  if (!documentRef.current) {
                    console.error("Document ref not available");
                    return;
                  }

                  console.log("Testing template export...");
                  
                  // Import html2canvas and pdf-lib
                  const html2canvas = (await import("html2canvas")).default;
                  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

                  // Capture the template
                  const canvas = await html2canvas(documentRef.current, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: "#ffffff",
                    logging: false,
                  });

                  // Create PDF with just the template
                  const pdfDoc = await PDFDocument.create();
                  const templateDataUrl = canvas.toDataURL("image/png", 1.0);
                  const templateImageBytes = await fetch(templateDataUrl).then((res) =>
                    res.arrayBuffer()
                  );
                  const templateImage = await pdfDoc.embedPng(templateImageBytes);

                  const templatePage = pdfDoc.addPage([612, 792]);
                  const { width: pageWidth, height: pageHeight } = templatePage.getSize();

                  const templateDims = templateImage.scale(1);
                  const scaleX = pageWidth / templateDims.width;
                  const scaleY = pageHeight / templateDims.height;
                  const templateScale = Math.min(scaleX, scaleY);

                  const scaledWidth = templateDims.width * templateScale;
                  const scaledHeight = templateDims.height * templateScale;

                  const x = (pageWidth - scaledWidth) / 2;
                  const y = (pageHeight - scaledHeight) / 2;

                  templatePage.drawImage(templateImage, {
                    x: x,
                    y: y,
                    width: scaledWidth,
                    height: scaledHeight,
                  });

                  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
                  templatePage.drawText("TEMPLATE TEST", {
                    x: pageWidth / 2 - 50,
                    y: pageHeight - 30,
                    size: 16,
                    font: font,
                    color: rgb(0, 0, 0),
                  });

                  const pdfBytes = await pdfDoc.save();
                  const blob = new Blob([pdfBytes], { type: "application/pdf" });
                  const url = URL.createObjectURL(blob);

                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `template-test.pdf`;
                  link.click();

                  URL.revokeObjectURL(url);
                  console.log("Template test export completed");
                } catch (error) {
                  console.error("Template test export failed:", error);
                }
              }}
              variant="outline"
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Test Template
            </Button>
            <Button
              onClick={handleContinue}
              className="bg-blue-600 hover:bg-blue-700"
            >
              Continue
            </Button>
          </div>
        </div>

        {/* ElementFormatDrawer */}
        <ElementFormatDrawer />
      </div>
    </div>
  );
};
