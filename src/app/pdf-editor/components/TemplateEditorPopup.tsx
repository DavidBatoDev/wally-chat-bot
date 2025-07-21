import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { X, Plus, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MemoizedTextBox } from "./elements/TextBox";
import { TextField } from "../types/pdf-editor.types";
import { ElementFormatDrawer } from "@/components/editor/ElementFormatDrawer";
import { useTextSpanHandling } from "../hooks/states/useTextSpanHandling";
import { toast } from "sonner";
import { screenToDocumentCoordinates } from "../utils/coordinates";
import {
  TextFormatProvider,
  useTextFormat,
} from "@/components/editor/ElementFormatContext";

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

// Create the actual popup content component that will be wrapped by TextFormatProvider
const TemplateEditorPopupContent: React.FC<TemplateEditorPopupProps> = ({
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
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const documentRef = useRef<HTMLDivElement>(null);
  const scrollableContainerRef = useRef<HTMLDivElement>(null);
  const templatePath = "/export_template/export_first_page.pdf";

  // Update scale with bounds checking
  const updateScale = useCallback((newScale: number) => {
    const clampedScale = Math.max(1.0, Math.min(5.0, newScale)); // Prevent zoom below 100%
    setScale(clampedScale);
  }, []);

  // Zoom functionality
  useEffect(() => {
    const container = documentRef.current;
    const scrollableContainer = scrollableContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        const zoomFactor = 0.1;
        const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;
        const newScale = scale + delta;

        updateScale(newScale);
        return false;
      }
    };

    // Add the event listener with aggressive options
    container.addEventListener("wheel", handleWheel, {
      passive: false,
      capture: true,
    });

    // Also try adding to document as backup
    const documentHandler = (e: WheelEvent) => {
      if ((e.ctrlKey || e.metaKey) && container.contains(e.target as Node)) {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        handleWheel(e);
      }
    };

    document.addEventListener("wheel", documentHandler, {
      passive: false,
      capture: true,
    });

    // Also try adding to the scrollable container
    if (scrollableContainer) {
      scrollableContainer.addEventListener(
        "wheel",
        handleWheel as EventListener,
        {
          passive: false,
          capture: true,
        }
      );
    }

    return () => {
      container.removeEventListener("wheel", handleWheel as EventListener, {
        capture: true,
      });
      document.removeEventListener("wheel", documentHandler, { capture: true });
      if (scrollableContainer) {
        scrollableContainer.removeEventListener(
          "wheel",
          handleWheel as EventListener,
          {
            capture: true,
          }
        );
      }
    };
  }, [scale, updateScale]);

  // Track Ctrl key state and handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true);

        // Ctrl+0 to reset zoom
        if (e.key === "0") {
          e.preventDefault();
          updateScale(1.0);
          toast.success("Zoom reset to 100%");
        }

        // Ctrl+= or Ctrl++ to zoom in
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          updateScale(Math.min(5.0, scale + 0.1));
        }

        // Ctrl+- to zoom out
        if (e.key === "-") {
          e.preventDefault();
          updateScale(Math.max(1.0, scale - 0.1));
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false);
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
    };
  }, [scale, updateScale]);

  // Handle PDF load success
  const onDocumentLoadSuccess = useCallback((pdf: any) => {
    console.log("Template PDF loaded successfully");
  }, []);

  // Handle page load success
  const onPageLoadSuccess = useCallback((page: any) => {
    const { width, height } = page;
    setPageWidth((prev) => (prev === 0 ? width : prev));
    setPageHeight((prev) => (prev === 0 ? height : prev));
    console.log("Template page loaded:", { width, height });
  }, []);

  // Create deletion rectangle for text span
  const createDeletionRectangleForSpan = useCallback(
    (span: HTMLElement) => {
      const rect = span.getBoundingClientRect();
      const pdfPageEl = documentRef.current?.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;

      if (!pdfPageEl) return "";

      const pageRect = pdfPageEl.getBoundingClientRect();

      // Use proper coordinate transformation for zoom handling
      const topLeftCoords = screenToDocumentCoordinates(
        rect.left,
        rect.top,
        pageRect,
        scale,
        "original", // Template editor always uses original view
        "original", // Template editor always uses original view
        pageWidth
      );

      const bottomRightCoords = screenToDocumentCoordinates(
        rect.right,
        rect.bottom,
        pageRect,
        scale,
        "original", // Template editor always uses original view
        "original", // Template editor always uses original view
        pageWidth
      );

      const x = topLeftCoords.x;
      const y = topLeftCoords.y;
      const width = bottomRightCoords.x - topLeftCoords.x;
      const height = bottomRightCoords.y - topLeftCoords.y;

      // For template editor, we'll just hide the span instead of creating deletion rectangle
      span.style.display = "none";
      return "";
    },
    [scale, pageWidth]
  );

  // Create text field from text span
  const createTextFieldFromSpan = useCallback(
    (span: HTMLElement) => {
      const rect = span.getBoundingClientRect();
      const pdfPageEl = documentRef.current?.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;

      if (!pdfPageEl) return null;

      const pageRect = pdfPageEl.getBoundingClientRect();

      // Use proper coordinate transformation for zoom handling
      const topLeftCoords = screenToDocumentCoordinates(
        rect.left,
        rect.top,
        pageRect,
        scale,
        "original", // Template editor always uses original view
        "original", // Template editor always uses original view
        pageWidth
      );

      const bottomRightCoords = screenToDocumentCoordinates(
        rect.right,
        rect.bottom,
        pageRect,
        scale,
        "original", // Template editor always uses original view
        "original", // Template editor always uses original view
        pageWidth
      );

      const x = topLeftCoords.x;
      const y = topLeftCoords.y;
      const width = bottomRightCoords.x - topLeftCoords.x;
      const height = bottomRightCoords.y - topLeftCoords.y;

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
    [scale, pageWidth]
  );

  // Add deletion rectangle (not used in template editor but required by hook)
  const addDeletionRectangle = useCallback(() => "", []);

  // Update text box
  const updateTextBox = useCallback(
    (id: string, updates: Partial<TextField>) => {
      console.log(
        "TemplateEditorPopup: updateTextBox called with id:",
        id,
        "updates:",
        updates
      );
      setTextBoxes((prev) => {
        const newTextBoxes = prev.map((textBox) =>
          textBox.id === id ? { ...textBox, ...updates } : textBox
        );
        console.log("TemplateEditorPopup: Updated textBoxes:", newTextBoxes);
        return newTextBoxes;
      });
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
      // Check if we clicked on a textbox or its children
      const target = e.target as HTMLElement;
      const isTextboxClick =
        target.closest(".rnd") !== null ||
        target.closest("[data-textbox-id]") !== null ||
        target.tagName === "TEXTAREA" ||
        target.classList.contains("drag-handle") ||
        target.closest(".drag-handle") !== null;

      if (!isAddTextBoxMode && !isTextboxClick) {
        // Clear selection if we're not in add text box mode and didn't click on a textbox
        console.log(
          "TemplateEditorPopup: Clearing selection due to empty space click"
        );
        setSelectedTextBoxId(null);
        return;
      }

      if (!isAddTextBoxMode) return;

      const pdfPageEl = documentRef.current?.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;

      if (!pdfPageEl) return;

      const pageRect = pdfPageEl.getBoundingClientRect();

      // Use proper coordinate transformation for zoom handling
      const coords = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        pageRect,
        scale,
        "original", // Template editor always uses original view
        "original", // Template editor always uses original view
        pageWidth
      );

      const x = coords.x;
      const y = coords.y;

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
    [isAddTextBoxMode, scale, pageWidth, setSelectedTextBoxId]
  );

  // Helper function to capture template at high quality (170% zoom)
  const captureTemplateAtHighQuality = useCallback(async () => {
    if (!documentRef.current) {
      console.error("Document ref not available");
      throw new Error("Document ref not available");
    }

    // Store original scale
    const originalScale = scale;

    try {
      // Temporarily set zoom to 170% for high quality capture
      updateScale(1.7);

      // Wait a bit for the PDF to re-render at new scale
      await new Promise((resolve) => setTimeout(resolve, 100));

      console.log("Capturing template at 170% zoom for high quality");

      // Import html2canvas dynamically
      const html2canvas = (await import("html2canvas")).default;

      // Capture the template document
      const canvas = await html2canvas(documentRef.current, {
        scale: 2, // Additional scale factor for even higher quality
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
          const clonedContainer = clonedDoc.querySelector(
            "[data-template-editor]"
          );

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

      console.log("Template canvas captured successfully at 170% zoom:", {
        width: canvas.width,
        height: canvas.height,
        toDataURL: typeof canvas.toDataURL,
      });

      // Test that toDataURL works
      try {
        const dataUrl = canvas.toDataURL("image/png", 1.0);
        console.log(
          "Template canvas data URL created successfully, length:",
          dataUrl.length
        );
      } catch (error) {
        console.error("Error creating template canvas data URL:", error);
        throw error;
      }

      return canvas;
    } finally {
      // Restore original scale
      updateScale(originalScale);
    }
  }, [scale, updateScale]);

  // Handle continue button click
  const handleContinue = useCallback(async () => {
    try {
      const canvas = await captureTemplateAtHighQuality();
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
  }, [captureTemplateAtHighQuality, onContinue]);

  // --- Sync selected textbox to ElementFormatDrawer context ---
  const {
    setIsDrawerOpen,
    setSelectedElementId,
    setSelectedElementType,
    setCurrentFormat,
    setOnFormatChange,
  } = useTextFormat();

  // Set up the format change handler for the drawer
  useEffect(() => {
    console.log("TemplateEditorPopup: Setting up onFormatChange handler");
    setOnFormatChange((updates: Partial<TextField>) => {
      console.log("TemplateEditorPopup: onFormatChange called with:", updates);
      console.log("TemplateEditorPopup: selectedTextBoxId:", selectedTextBoxId);
      if (selectedTextBoxId) {
        console.log(
          "TemplateEditorPopup: Updating textbox with updates:",
          updates
        );
        updateTextBox(selectedTextBoxId, updates);
      } else {
        console.log("TemplateEditorPopup: No selectedTextBoxId, cannot update");
      }
    });
  }, [selectedTextBoxId, updateTextBox, setOnFormatChange]);

  useEffect(() => {
    console.log(
      "TemplateEditorPopup: selectedTextBoxId changed:",
      selectedTextBoxId
    );
    if (selectedTextBoxId) {
      console.log("TemplateEditorPopup: Setting drawer open and format");
      setIsDrawerOpen(true); // Ensure drawer is open
      setSelectedElementId(selectedTextBoxId);
      setSelectedElementType("textbox");
      const tb = textBoxes.find((t) => t.id === selectedTextBoxId) || null;
      console.log("TemplateEditorPopup: Found textbox:", tb);
      setCurrentFormat(tb);
    } else {
      console.log("TemplateEditorPopup: No textbox selected, closing drawer");
      setIsDrawerOpen(false); // Hide drawer if nothing selected
      setSelectedElementId(null);
      setSelectedElementType(null);
      setCurrentFormat(null);
    }
  }, [
    selectedTextBoxId,
    textBoxes,
    setIsDrawerOpen,
    setSelectedElementId,
    setSelectedElementType,
    setCurrentFormat,
  ]);

  // Also update currentFormat when textBoxes change (to reflect updates)
  useEffect(() => {
    if (selectedTextBoxId) {
      const tb = textBoxes.find((t) => t.id === selectedTextBoxId) || null;
      console.log(
        "TemplateEditorPopup: Updating currentFormat due to textBoxes change:",
        tb
      );
      setCurrentFormat(tb);
    }
  }, [textBoxes, selectedTextBoxId, setCurrentFormat]);

  // Debug the context state
  const {
    isDrawerOpen,
    currentFormat,
    selectedElementId: contextSelectedId,
  } = useTextFormat();
  useEffect(() => {
    console.log("TemplateEditorPopup: Context state:", {
      isDrawerOpen,
      currentFormat: !!currentFormat,
      contextSelectedId,
    });
  }, [isDrawerOpen, currentFormat, contextSelectedId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
      <style>{`
          [data-template-editor] .react-pdf__Page__canvas {
            width: 100% !important;
            height: 100% !important;
            display: block;
          }
        `}</style>
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

        {/* ElementFormatDrawer at the top when a textbox is selected */}
        <div className="w-full border-b bg-white z-[9999]">
          <ElementFormatDrawer />
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

          {/* Zoom Controls */}
          <div className="flex items-center gap-1 ml-4 border-l border-gray-300 pl-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateScale(Math.max(1.0, scale - 0.1))}
              className="h-8 w-8 p-0"
              title="Zoom Out (Ctrl+-)"
              disabled={scale <= 1.0}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <div className="text-sm text-gray-600 px-2 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateScale(Math.min(5.0, scale + 0.1))}
              className="h-8 w-8 p-0"
              title="Zoom In (Ctrl+=)"
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => updateScale(1.0)}
              className="h-8 w-8 p-0"
              title="Reset Zoom (Ctrl+0)"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          <div className="text-sm text-gray-600 ml-4">
            {isAddTextBoxMode
              ? "Click on the template to add a text box or click on text to replace it"
              : isCtrlPressed
              ? "Use Ctrl+scroll to zoom, Ctrl+0 to reset"
              : "Use the toolbar to edit the template"}
          </div>
        </div>

        {/* Template Editor */}
        <div
          ref={scrollableContainerRef}
          className="flex-1 overflow-auto"
          style={{
            scrollBehavior: "smooth",
            overflow: "auto",
            paddingTop: "20px",
          }}
        >
          <div
            className="document-wrapper"
            style={{
              minHeight: Math.max(100, pageHeight * scale + 80),
              height: Math.max(100, pageHeight * scale + 80),
              width: Math.max(100, pageWidth * scale + 80),
              minWidth: Math.max(100, pageWidth * scale + 80),
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              paddingTop: "40px",
              paddingBottom: "40px",
              paddingLeft: "40px",
              paddingRight: "40px",
              margin: "0 auto",
            }}
          >
            <div
              ref={documentRef}
              data-template-editor
              className="relative border border-gray-300 shadow-lg bg-white"
              onClick={handleDocumentClick}
              style={{
                cursor: isAddTextBoxMode ? "crosshair" : "default",
                width: pageWidth * scale,
                height: pageHeight * scale,
                minWidth: pageWidth * scale,
                minHeight: pageHeight * scale,
                display: "block",
                position: "relative",
              }}
            >
              {/* Zoom Indicator */}
              {isCtrlPressed && (
                <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs z-50 pointer-events-none">
                  Ctrl+Scroll to Zoom
                </div>
              )}
              <Document
                file={templatePath}
                onLoadSuccess={onDocumentLoadSuccess}
                className={"border border-blue-500"}
                loading={
                  <div className="flex items-center justify-center h-96">
                    <div className="text-gray-500">Loading template...</div>
                  </div>
                }
                error={
                  <div className="flex items-center justify-center h-96">
                    <div className="text-red-500">Failed to load template</div>
                  </div>
                }
              >
                <Page
                  pageNumber={1}
                  width={pageWidth * scale}
                  onLoadSuccess={onPageLoadSuccess}
                  renderTextLayer={!isTextSpanZooming}
                  renderAnnotationLayer={false}
                />
              </Document>
              {/* Render text boxes as siblings to the PDF page, not in an overlay */}
              <div className="z-[10000] absolute inset-0">
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
            Add text boxes to customize your export template • Zoom:{" "}
            {Math.round(scale * 100)}%
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={async () => {
                // Test export just the template
                try {
                  console.log("Testing template export at high quality...");

                  // Capture template at high quality
                  const canvas = await captureTemplateAtHighQuality();

                  // Import pdf-lib
                  const { PDFDocument, StandardFonts, rgb } = await import(
                    "pdf-lib"
                  );

                  // Create PDF with just the template
                  const pdfDoc = await PDFDocument.create();
                  const templateDataUrl = canvas.toDataURL("image/png", 1.0);
                  const templateImageBytes = await fetch(templateDataUrl).then(
                    (res) => res.arrayBuffer()
                  );
                  const templateImage = await pdfDoc.embedPng(
                    templateImageBytes
                  );

                  const templatePage = pdfDoc.addPage([612, 792]);
                  const { width: pageWidth, height: pageHeight } =
                    templatePage.getSize();

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
                  // templatePage.drawText("TEMPLATE TEST (170% Zoom)", {
                  //   x: pageWidth / 2 - 80,
                  //   y: pageHeight - 30,
                  //   size: 16,
                  //   font: font,
                  //   color: rgb(0, 0, 0),
                  // });

                  const pdfBytes = await pdfDoc.save();
                  const blob = new Blob([pdfBytes], {
                    type: "application/pdf",
                  });
                  const url = URL.createObjectURL(blob);

                  const link = document.createElement("a");
                  link.href = url;
                  link.download = `template-test-170zoom.pdf`;
                  link.click();

                  URL.revokeObjectURL(url);
                  console.log("Template test export completed at 170% zoom");
                  toast.success(
                    "Template test exported at 170% zoom for high quality"
                  );
                } catch (error) {
                  console.error("Template test export failed:", error);
                  toast.error("Template test export failed");
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
      </div>
    </div>
  );
};

export const TemplateEditorPopup: React.FC<TemplateEditorPopupProps> = ({
  isOpen,
  onClose,
  onContinue,
}) => {
  return (
    <TextFormatProvider>
      <TemplateEditorPopupContent
        isOpen={isOpen}
        onClose={onClose}
        onContinue={onContinue}
      />
    </TextFormatProvider>
  );
};
