"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  memo,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Upload,
  Download,
  Plus,
  Trash2,
  Type,
  Square,
  Circle,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Save,
  FileText,
  Palette,
  Settings,
  Move,
  MoreHorizontal,
  X,
  Minus,
  Menu,
  MousePointer,
  Languages,
  Scan,
  MessageSquare,
  FileSearch,
  Globe,
  Files,
  Wrench,
  Edit2,
  Eye,
  SplitSquareHorizontal,
} from "lucide-react";
import { toast } from "sonner";
import {
  TextFormatProvider,
  useTextFormat,
} from "@/components/editor/TextFormatContext";
import { TextFormatDrawer } from "@/components/editor/TextFormatDrawer";
import { TextField } from "@/components/types";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Set up PDF.js worker - match DocumentCanvas setup
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Utility functions
const generateUUID = (): string => {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

const getCleanExtension = (url: string): string => {
  try {
    const pathname = new URL(url).pathname;
    const extension = pathname.split(".").pop()?.toLowerCase() || "";
    return extension;
  } catch {
    return url.split(".").pop()?.toLowerCase() || "";
  }
};

const getFileType = (url: string): "pdf" | "image" => {
  const extension = getCleanExtension(url);
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"];
  return imageExtensions.includes(extension) ? "image" : "pdf";
};

const isPdfFile = (url: string): boolean => {
  return getFileType(url) === "pdf";
};

const isImageFile = (url: string): boolean => {
  return getFileType(url) === "image";
};

const measureText = (
  text: string,
  fontSize: number,
  fontFamily: string,
  characterSpacing: number = 0
): { width: number; height: number } => {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return { width: 100, height: fontSize };

  context.font = `${fontSize}px ${fontFamily}`;
  const metrics = context.measureText(text);
  const width = metrics.width + characterSpacing * Math.max(0, text.length - 1);
  const height = fontSize * 1.2; // Approximate line height

  return { width, height };
};

const hexToRgba = (hex: string, opacity: number): string => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return `rgba(0, 0, 0, ${opacity})`;

  const r = parseInt(result[1], 16);
  const g = parseInt(result[2], 16);
  const b = parseInt(result[3], 16);

  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

// Interfaces
interface Shape {
  id: string;
  type: "circle" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  fillOpacity: number;
  rotation?: number;
}

interface DeletionRectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  background?: string; // Add this for background color
}

interface SelectedTextBoxes {
  textBoxIds: string[];
  bounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

// Memoized TextBox component to prevent unnecessary re-renders
const MemoizedTextBox = memo(
  ({
    textBox,
    isSelected,
    isEditMode,
    scale,
    showPaddingIndicator,
    onSelect,
    onUpdate,
    onDelete,
    isTextSelectionMode,
    isSelectedInTextMode,
    onTextSelectionClick,
  }: {
    textBox: TextField;
    isSelected: boolean;
    isEditMode: boolean;
    scale: number;
    showPaddingIndicator?: boolean;
    onSelect: (id: string) => void;
    onUpdate: (id: string, updates: Partial<TextField>) => void;
    onDelete: (id: string) => void;
    isTextSelectionMode?: boolean;
    isSelectedInTextMode?: boolean;
    onTextSelectionClick?: (id: string, event: React.MouseEvent) => void;
  }) => {
    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        onUpdate(textBox.id, { value: e.target.value });
      },
      [textBox.id, onUpdate]
    );

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();

        // In text selection mode, use the text selection handler
        if (isTextSelectionMode && onTextSelectionClick) {
          onTextSelectionClick(textBox.id, e);
        } else {
          onSelect(textBox.id);
        }
      },
      [textBox.id, onSelect, isTextSelectionMode, onTextSelectionClick]
    );

    const handleFocus = useCallback(() => {
      onSelect(textBox.id);
    }, [textBox.id, onSelect]);

    return (
      <Rnd
        key={textBox.id}
        position={{ x: textBox.x * scale, y: textBox.y * scale }}
        size={{ width: textBox.width * scale, height: textBox.height * scale }}
        bounds="parent"
        disableDragging={isTextSelectionMode}
        dragHandleClassName="drag-handle"
        enableResizing={
          isEditMode && isSelected && !isTextSelectionMode
            ? {
                top: true,
                right: true,
                bottom: true,
                left: true,
                topRight: true,
                bottomRight: true,
                bottomLeft: true,
                topLeft: true,
              }
            : false
        }
        resizeHandleStyles={{
          top: {
            width: "10px",
            height: "5px",
            top: "-2.5px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ns-resize",
          },
          right: {
            width: "5px",
            height: "10px",
            right: "-2.5px",
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ew-resize",
          },
          bottom: {
            width: "10px",
            height: "5px",
            bottom: "-2.5px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ns-resize",
          },
          left: {
            width: "5px",
            height: "10px",
            left: "-2.5px",
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ew-resize",
          },
          topRight: {
            width: "8px",
            height: "8px",
            top: "-4px",
            right: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "ne-resize",
          },
          bottomRight: {
            width: "8px",
            height: "8px",
            bottom: "-4px",
            right: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "se-resize",
          },
          bottomLeft: {
            width: "8px",
            height: "8px",
            bottom: "-4px",
            left: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "sw-resize",
          },
          topLeft: {
            width: "8px",
            height: "8px",
            top: "-4px",
            left: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "nw-resize",
          },
        }}
        resizeHandleClasses={{
          top: "resize-handle resize-handle-top",
          right: "resize-handle resize-handle-right",
          bottom: "resize-handle resize-handle-bottom",
          left: "resize-handle resize-handle-left",
          topRight: "resize-handle resize-handle-corner",
          bottomRight: "resize-handle resize-handle-corner",
          bottomLeft: "resize-handle resize-handle-corner",
          topLeft: "resize-handle resize-handle-corner",
        }}
        onDragStop={(e, d) => {
          onUpdate(textBox.id, { x: d.x / scale, y: d.y / scale });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(textBox.id, {
            x: position.x / scale,
            y: position.y / scale,
            width: parseInt(ref.style.width) / scale,
            height: parseInt(ref.style.height) / scale,
          });
        }}
        className={`${isSelected ? "ring-2 ring-gray-500 selected" : ""} ${
          isEditMode ? "edit-mode" : ""
        } ${
          isSelectedInTextMode
            ? "ring-2 ring-blue-500 text-selection-highlight"
            : ""
        }`}
        style={{ zIndex: 30, transform: "none" }}
        onClick={handleClick}
      >
        <div className="w-full h-full relative group">
          {/* Delete button - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(textBox.id);
              }}
              className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
              title="Delete text field"
            >
              <Trash2 size={10} />
            </button>
          )}

          {/* Move handle - only show when selected and in edit mode and NOT in text selection mode */}
          {isEditMode && isSelected && !isTextSelectionMode && (
            <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
              <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                <Move size={10} />
              </div>
            </div>
          )}

          {/* Text content */}
          <div
            className="w-full h-full absolute"
            style={{
              transform: textBox.rotation
                ? `rotate(${textBox.rotation}deg)`
                : "none",
              transformOrigin: "center center",
            }}
          >
            <textarea
              value={textBox.value}
              onChange={handleTextChange}
              onClick={handleClick}
              onFocus={handleFocus}
              className="absolute top-0 left-0 w-full h-full bg-transparent border-none outline-none cursor-text resize-none"
              style={{
                fontSize: `${textBox.fontSize * scale}px`,
                fontFamily: textBox.fontFamily,
                fontWeight: textBox.bold ? "bold" : "normal",
                fontStyle: textBox.italic ? "italic" : "normal",
                color: textBox.color || "#000000",
                letterSpacing: `${(textBox.letterSpacing || 0) * scale}px`,
                textAlign: textBox.textAlign || "left",
                textDecoration: textBox.underline ? "underline" : "none",
                lineHeight: textBox.lineHeight || 1.2,
                backgroundColor: isSelected
                  ? "rgba(107, 114, 128, 0.1)"
                  : textBox.backgroundColor || "transparent",
                border: textBox.borderWidth
                  ? `${textBox.borderWidth * scale}px solid ${
                      textBox.borderColor || "#000000"
                    }`
                  : "none",
                borderRadius: `${(textBox.borderRadius || 0) * scale}px`,
                padding: `${(textBox.paddingTop || 0) * scale}px ${
                  (textBox.paddingRight || 0) * scale
                }px ${(textBox.paddingBottom || 0) * scale}px ${
                  (textBox.paddingLeft || 0) * scale
                }px`,
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
              }}
            />

            {/* Padding Visual Indicator - only show when padding popup is open and this textbox is selected */}
            {showPaddingIndicator && isSelected && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Top Padding */}
                {(textBox.paddingTop || 0) > 0 && (
                  <div
                    className="absolute top-0 left-0 right-0 bg-yellow-300 bg-opacity-40 border-t-2 border-yellow-500"
                    style={{
                      height: `${(textBox.paddingTop || 0) * scale}px`,
                    }}
                  />
                )}

                {/* Right Padding */}
                {(textBox.paddingRight || 0) > 0 && (
                  <div
                    className="absolute top-0 right-0 bottom-0 bg-yellow-300 bg-opacity-40 border-r-2 border-yellow-500"
                    style={{
                      width: `${(textBox.paddingRight || 0) * scale}px`,
                    }}
                  />
                )}

                {/* Bottom Padding */}
                {(textBox.paddingBottom || 0) > 0 && (
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-yellow-300 bg-opacity-40 border-b-2 border-yellow-500"
                    style={{
                      height: `${(textBox.paddingBottom || 0) * scale}px`,
                    }}
                  />
                )}

                {/* Left Padding */}
                {(textBox.paddingLeft || 0) > 0 && (
                  <div
                    className="absolute top-0 bottom-0 left-0 bg-yellow-300 bg-opacity-40 border-l-2 border-yellow-500"
                    style={{
                      width: `${(textBox.paddingLeft || 0) * scale}px`,
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </Rnd>
    );
  }
);

MemoizedTextBox.displayName = "MemoizedTextBox";

// Memoized Shape component to prevent unnecessary re-renders
const MemoizedShape = memo(
  ({
    shape,
    isSelected,
    isEditMode,
    scale,
    onSelect,
    onUpdate,
    onDelete,
  }: {
    shape: Shape;
    isSelected: boolean;
    isEditMode: boolean;
    scale: number;
    onSelect: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Shape>) => void;
    onDelete: (id: string) => void;
  }) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(shape.id);
      },
      [shape.id, onSelect]
    );

    return (
      <Rnd
        key={shape.id}
        position={{ x: shape.x * scale, y: shape.y * scale }}
        size={{ width: shape.width * scale, height: shape.height * scale }}
        bounds="parent"
        disableDragging={false}
        dragHandleClassName="drag-handle"
        enableResizing={
          isEditMode && isSelected
            ? {
                top: true,
                right: true,
                bottom: true,
                left: true,
                topRight: true,
                bottomRight: true,
                bottomLeft: true,
                topLeft: true,
              }
            : false
        }
        resizeHandleStyles={{
          top: {
            width: "10px",
            height: "5px",
            top: "-2.5px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ns-resize",
          },
          right: {
            width: "5px",
            height: "10px",
            right: "-2.5px",
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ew-resize",
          },
          bottom: {
            width: "10px",
            height: "5px",
            bottom: "-2.5px",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ns-resize",
          },
          left: {
            width: "5px",
            height: "10px",
            left: "-2.5px",
            top: "50%",
            transform: "translateY(-50%)",
            backgroundColor: "#6b7280",
            borderRadius: "2px",
            cursor: "ew-resize",
          },
          topRight: {
            width: "8px",
            height: "8px",
            top: "-4px",
            right: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "ne-resize",
          },
          bottomRight: {
            width: "8px",
            height: "8px",
            bottom: "-4px",
            right: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "se-resize",
          },
          bottomLeft: {
            width: "8px",
            height: "8px",
            bottom: "-4px",
            left: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "sw-resize",
          },
          topLeft: {
            width: "8px",
            height: "8px",
            top: "-4px",
            left: "-4px",
            backgroundColor: "#6b7280",
            borderRadius: "50%",
            cursor: "nw-resize",
          },
        }}
        resizeHandleClasses={{
          top: "resize-handle resize-handle-top",
          right: "resize-handle resize-handle-right",
          bottom: "resize-handle resize-handle-bottom",
          left: "resize-handle resize-handle-left",
          topRight: "resize-handle resize-handle-corner",
          bottomRight: "resize-handle resize-handle-corner",
          bottomLeft: "resize-handle resize-handle-corner",
          topLeft: "resize-handle resize-handle-corner",
        }}
        onDragStop={(e, d) => {
          onUpdate(shape.id, { x: d.x / scale, y: d.y / scale });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(shape.id, {
            x: position.x / scale,
            y: position.y / scale,
            width: parseInt(ref.style.width) / scale,
            height: parseInt(ref.style.height) / scale,
          });
        }}
        className={`${isSelected ? "ring-2 ring-gray-500 selected" : ""} ${
          isEditMode ? "edit-mode" : ""
        }`}
        style={{ zIndex: isSelected ? 1000 : 200, transform: "none" }}
        onClick={handleClick}
      >
        <div className="w-full h-full relative group">
          {/* Shape Element */}
          <div
            className="w-full h-full"
            style={{
              backgroundColor: hexToRgba(shape.fillColor, shape.fillOpacity),
              border: `${shape.borderWidth * scale}px solid ${
                shape.borderColor
              }`,
              borderRadius: shape.type === "circle" ? "50%" : "0",
              transform: shape.rotation
                ? `rotate(${shape.rotation}deg)`
                : "none",
              transformOrigin: "center center",
            }}
          />

          {/* Shape Controls */}
          {isEditMode && isSelected && (
            <>
              {/* Move handle */}
              <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
                <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                  <Move size={10} />
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(shape.id);
                }}
                className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
                title="Delete shape"
              >
                <Trash2 size={10} />
              </button>

              {/* Resize indicator */}
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-red-500 rounded-tl-md opacity-75"></div>
            </>
          )}
        </div>
      </Rnd>
    );
  }
);

MemoizedShape.displayName = "MemoizedShape";

const PDFEditorContent: React.FC = () => {
  const {
    setIsDrawerOpen,
    setSelectedElementId,
    setCurrentFormat,
    setOnFormatChange,
    showPaddingPopup,
  } = useTextFormat();
  // Document state
  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [pageWidth, setPageWidth] = useState<number>(612);
  const [pageHeight, setPageHeight] = useState<number>(792);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [fileType, setFileType] = useState<"pdf" | "image" | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState<boolean>(false);
  const [isPageLoading, setIsPageLoading] = useState<boolean>(false);
  const [isScaleChanging, setIsScaleChanging] = useState<boolean>(false);
  const [pdfBackgroundColor, setPdfBackgroundColor] = useState<string>("white"); // Store PDF background color

  // Editor state
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [isAddTextBoxMode, setIsAddTextBoxMode] = useState<boolean>(false);
  const [isTextSelectionMode, setIsTextSelectionMode] =
    useState<boolean>(false);
  const [showDeletionRectangles, setShowDeletionRectangles] =
    useState<boolean>(false);

  // New state for refactored approach
  const [selectedTextBoxes, setSelectedTextBoxes] = useState<SelectedTextBoxes>(
    { textBoxIds: [] }
  );

  // Selection rectangle state for text selection mode
  const [isDrawingSelection, setIsDrawingSelection] = useState(false);
  const [selectionStart, setSelectionStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [selectionEnd, setSelectionEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Calculate selection rectangle for text selection
  const selectionRect = useMemo(() => {
    if (!selectionStart || !selectionEnd) return null;

    const left = Math.min(selectionStart.x, selectionEnd.x);
    const top = Math.min(selectionStart.y, selectionEnd.y);
    const width = Math.abs(selectionEnd.x - selectionStart.x);
    const height = Math.abs(selectionEnd.y - selectionStart.y);

    return { left, top, width, height };
  }, [selectionStart, selectionEnd]);

  // Shape drawing state
  const [isDrawingShape, setIsDrawingShape] = useState<boolean>(false);
  const [shapeDrawingMode, setShapeDrawingMode] = useState<
    "circle" | "rectangle" | null
  >(null);
  const [selectedShapeType, setSelectedShapeType] = useState<
    "circle" | "rectangle"
  >("rectangle");
  const [shapeDrawStart, setShapeDrawStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [shapeDrawEnd, setShapeDrawEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isDrawingInProgress, setIsDrawingInProgress] =
    useState<boolean>(false);

  // Add state to track which document side the shape drawing started on
  const [shapeDrawTargetView, setShapeDrawTargetView] = useState<
    "original" | "translated" | null
  >(null);

  // Drag and interaction state
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [rotatingFieldId, setRotatingFieldId] = useState<string | null>(null);
  const [initialRotation, setInitialRotation] = useState<number>(0);
  const [rotationCenter, setRotationCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);

  // Zoom and view state
  const [zoomMode, setZoomMode] = useState<"page" | "width">("page");
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [isCtrlPressed, setIsCtrlPressed] = useState<boolean>(false);
  const [transformOrigin, setTransformOrigin] =
    useState<string>("center center");
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [activeSidebarTab, setActiveSidebarTab] = useState<"pages" | "tools">(
    "pages"
  );

  // Document view state
  const [currentView, setCurrentView] = useState<
    "original" | "translated" | "split"
  >("original");

  // SEPARATE STATE ARRAYS FOR ORIGINAL AND TRANSLATED DOCUMENTS
  const [originalTextBoxes, setOriginalTextBoxes] = useState<TextField[]>([]);
  const [originalShapes, setOriginalShapes] = useState<Shape[]>([]);
  const [originalDeletionRectangles, setOriginalDeletionRectangles] = useState<
    DeletionRectangle[]
  >([]);

  const [translatedTextBoxes, setTranslatedTextBoxes] = useState<TextField[]>(
    []
  );
  const [translatedShapes, setTranslatedShapes] = useState<Shape[]>([]);
  const [translatedDeletionRectangles, setTranslatedDeletionRectangles] =
    useState<DeletionRectangle[]>([]);

  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());

  // Helper functions to get current state arrays based on view
  const getCurrentTextBoxes = () => {
    return currentView === "original" ? originalTextBoxes : translatedTextBoxes;
  };

  const getCurrentShapes = () => {
    return currentView === "original" ? originalShapes : translatedShapes;
  };

  const getCurrentDeletionRectangles = () => {
    return currentView === "original"
      ? originalDeletionRectangles
      : translatedDeletionRectangles;
  };

  const setCurrentTextBoxes = (updater: React.SetStateAction<TextField[]>) => {
    if (currentView === "original") {
      setOriginalTextBoxes(updater);
    } else {
      setTranslatedTextBoxes(updater);
    }
  };

  const setCurrentShapes = (updater: React.SetStateAction<Shape[]>) => {
    if (currentView === "original") {
      setOriginalShapes(updater);
    } else {
      setTranslatedShapes(updater);
    }
  };

  const setCurrentDeletionRectangles = (
    updater: React.SetStateAction<DeletionRectangle[]>
  ) => {
    if (currentView === "original") {
      setOriginalDeletionRectangles(updater);
    } else {
      setTranslatedDeletionRectangles(updater);
    }
  };

  // Refs
  const documentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scaleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to reset scale changing state with debounce
  const resetScaleChanging = useCallback(() => {
    if (scaleTimeoutRef.current) {
      clearTimeout(scaleTimeoutRef.current);
    }
    scaleTimeoutRef.current = setTimeout(() => {
      setIsScaleChanging(false);
      scaleTimeoutRef.current = null;
    }, 150);
  }, []);

  // Drag state refs for performance
  const dragStatesRef = useRef<
    Record<string, { x: number; y: number; element: HTMLElement | null }>
  >({});
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const isDraggingRef = useRef<Record<string, boolean>>({});

  // Shape drag state refs
  const shapeDragStatesRef = useRef<
    Record<string, { x: number; y: number; element: HTMLElement | null }>
  >({});
  const shapeDragRafRef = useRef<number | null>(null);
  const isShapeDraggingRef = useRef<Record<string, boolean>>({});

  // Global mouse event handlers
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Clear all active field drags
      Object.keys(isDraggingRef.current).forEach((fieldId) => {
        if (isDraggingRef.current[fieldId]) {
          try {
            const dragState = dragStatesRef.current[fieldId];
            if (dragState?.element) {
              const element = dragState.element;
              if (element && element.style) {
                element.style.transform = "";
                element.style.willChange = "auto";
              }
            }
          } catch (error) {
            console.warn("Error cleaning up field transform:", error);
          }
          delete dragStatesRef.current[fieldId];
          delete isDraggingRef.current[fieldId];
        }
      });

      // Clear all active shape drags
      Object.keys(isShapeDraggingRef.current).forEach((shapeId) => {
        if (isShapeDraggingRef.current[shapeId]) {
          try {
            const dragState = shapeDragStatesRef.current[shapeId];
            if (dragState?.element) {
              const element = dragState.element;
              if (element && element.style) {
                element.style.transform = "";
                element.style.willChange = "auto";
              }
            }
          } catch (error) {
            console.warn("Error cleaning up shape transform:", error);
          }
          delete shapeDragStatesRef.current[shapeId];
          delete isShapeDraggingRef.current[shapeId];
        }
      });

      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      if (shapeDragRafRef.current) {
        cancelAnimationFrame(shapeDragRafRef.current);
        shapeDragRafRef.current = null;
      }
    };

    document.addEventListener("mouseup", handleGlobalMouseUp);
    document.addEventListener("mouseleave", handleGlobalMouseUp);

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mouseleave", handleGlobalMouseUp);

      // Cleanup timeouts on unmount
      if (scaleTimeoutRef.current) {
        clearTimeout(scaleTimeoutRef.current);
      }
    };
  }, []);

  // Container width tracking
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Auto-switch to tools tab when no document is loaded
  useEffect(() => {
    if (!documentUrl && activeSidebarTab === "pages") {
      setActiveSidebarTab("tools");
    }
  }, [documentUrl, activeSidebarTab]);

  // Zoom adjustment
  useEffect(() => {
    if (zoomMode === "width" && containerWidth > 0 && pageWidth > 0) {
      const calculatedScale = containerWidth / pageWidth;
      setScale(Math.min(calculatedScale, 3.0));
    }
  }, [containerWidth, pageWidth, zoomMode]);

  // Add wheel event listener directly to container for zoom
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      console.log("Wheel event detected:", {
        ctrlKey: e.ctrlKey,
        metaKey: e.metaKey,
        deltaY: e.deltaY,
      });

      if (e.ctrlKey || e.metaKey) {
        console.log("Ctrl+wheel detected - preventing default and zooming");
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();

        // Always zoom to center
        setTransformOrigin("center center");

        const zoomFactor = 0.1;
        const delta = e.deltaY > 0 ? -zoomFactor : zoomFactor;

        setIsScaleChanging(true);
        setScale((prevScale) => {
          const newScale = Math.max(0.1, Math.min(5.0, prevScale + delta));
          console.log("Scale changed from", prevScale, "to", newScale);
          return newScale;
        });

        setZoomMode("page");

        resetScaleChanging();
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
        console.log("Document-level wheel handler triggered");
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

    return () => {
      container.removeEventListener("wheel", handleWheel, { capture: true });
      document.removeEventListener("wheel", documentHandler, { capture: true });
    };
  }, []);

  // Track scale changes to trigger loading state
  useEffect(() => {
    setIsPageLoading(true);
  }, [scale, currentPage]);

  // Capture background color only once when document is first loaded
  useEffect(() => {
    if (isDocumentLoaded && !isPageLoading && pdfBackgroundColor === "white") {
      setTimeout(() => {
        capturePdfBackgroundColor();
      }, 200);
    }
  }, [isDocumentLoaded, isPageLoading, pdfBackgroundColor]);

  // Track Ctrl key state for zoom indicator and handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        setIsCtrlPressed(true);

        // Ctrl+0 to reset zoom
        if (e.key === "0") {
          e.preventDefault();
          setIsScaleChanging(true);
          setScale(1.0);
          setZoomMode("page");
          setTransformOrigin("center center"); // Reset to center
          resetScaleChanging();
          toast.success("Zoom reset to 100%");
        }

        // Ctrl+= or Ctrl++ to zoom in
        if (e.key === "=" || e.key === "+") {
          e.preventDefault();
          setIsScaleChanging(true);
          setTransformOrigin("center center"); // Always zoom to center
          setScale((prevScale) => Math.min(5.0, prevScale + 0.1));
          setZoomMode("page");
          resetScaleChanging();
        }

        // Ctrl+- to zoom out
        if (e.key === "-") {
          e.preventDefault();
          setIsScaleChanging(true);
          setTransformOrigin("center center"); // Always zoom to center
          setScale((prevScale) => Math.max(0.1, prevScale - 0.1));
          setZoomMode("page");
          resetScaleChanging();
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) {
        setIsCtrlPressed(false);
      }
    };

    const handleBlur = () => {
      setIsCtrlPressed(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
    };
  }, [resetScaleChanging]);

  // Document loading handlers
  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsDocumentLoaded(true);
    setError("");
  };

  const handleDocumentLoadError = (error: Error) => {
    setError(`Failed to load document: ${error.message}`);
    setIsDocumentLoaded(false);
  };

  const handlePageLoadSuccess = (page: any) => {
    const viewport = page.getViewport({ scale: 1 });
    setPageWidth(viewport.width);
    setPageHeight(viewport.height);
    setIsPageLoading(false);

    // Capture PDF background color once when page loads
    setTimeout(() => {
      capturePdfBackgroundColor();
    }, 100);
  };

  const handlePageLoadError = (error: any) => {
    // Suppress text layer cancellation warnings as they're expected during zoom/mode changes
    if (
      error?.message?.includes("TextLayer task cancelled") ||
      error?.message?.includes("AbortException") ||
      error?.name === "AbortException" ||
      error?.name === "AbortError" ||
      error?.toString?.().includes("TextLayer task cancelled") ||
      error?.toString?.().includes("AbortException") ||
      // Handle cases where error might be wrapped
      (error?.error &&
        (error.error.message?.includes("TextLayer task cancelled") ||
          error.error.name === "AbortException"))
    ) {
      // Don't log anything for these expected cancellations during zoom/mode changes
      return;
    }

    console.error("PDF page load error:", error);
    setIsPageLoading(false);
  };

  // Detect font properties from a span element
  const detectFontProperties = (span: HTMLSpanElement) => {
    const computedStyle = window.getComputedStyle(span);

    // Extract font family with fallbacks
    const fontFamily = computedStyle.fontFamily || "Arial, sans-serif";

    // Detect bold
    const fontWeight = computedStyle.fontWeight;
    const isBold =
      fontWeight === "bold" ||
      fontWeight === "700" ||
      parseInt(fontWeight) >= 700;

    // Detect italic
    const fontStyle = computedStyle.fontStyle;
    const isItalic = fontStyle === "italic" || fontStyle === "oblique";

    // Get font size
    const fontSize = parseFloat(computedStyle.fontSize) || 12;

    return {
      fontFamily,
      isBold,
      isItalic,
      fontSize,
    };
  };

  // Capture PDF background color from the first pixel and store it
  const capturePdfBackgroundColor = () => {
    const canvas = document.querySelector(
      ".react-pdf__Page__canvas"
    ) as HTMLCanvasElement;

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          // Sample the very first pixel (0, 0) to get the main PDF background color
          const pixel = ctx.getImageData(0, 0, 1, 1).data;
          const bgColor = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
          setPdfBackgroundColor(bgColor);
          console.log(
            "PDF background color captured from first pixel:",
            bgColor
          );
        } catch (error) {
          console.warn("Failed to capture PDF background color:", error);
          setPdfBackgroundColor("white");
        }
      }
    }
  };

  // Handle text span click during add text field mode (like DocumentCanvas)
  const handleTextSpanClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (!isAddTextBoxMode) return;
      e.stopPropagation();

      const span = e.currentTarget;
      const textContent = span.textContent || "";

      if (!textContent.trim()) return;

      const pdfPage = documentRef.current?.querySelector(".react-pdf__Page");
      if (!pdfPage) return;

      const spanRect = span.getBoundingClientRect();

      // Calculate dimensions in original scale (like DocumentCanvas)
      const pageWidth = spanRect.width / scale;
      const pageHeight = spanRect.height / scale;

      // Calculate position relative to PDF page (original scale)
      const pageRect = pdfPage.getBoundingClientRect();
      const pageX = (spanRect.left - pageRect.left) / scale;
      const pageY = (spanRect.top - pageRect.top) / scale;

      // Create text field from the selected text
      const fontSize = Math.max(8, pageHeight * 0.8); // Estimate font size
      const fontFamily = "Arial, sans-serif";
      const fieldId = generateUUID();

      const { width, height } = measureText(textContent, fontSize, fontFamily);

      const newTextBox: TextField = {
        id: fieldId,
        x: pageX,
        y: pageY,
        width: Math.max(pageWidth, width),
        height: Math.max(pageHeight, height),
        value: textContent,
        fontSize: fontSize,
        fontFamily: fontFamily,
        page: currentPage,
        color: "#000000",
        bold: false,
        italic: false,
        underline: false,
        textAlign: "left",
        listType: "none",
        letterSpacing: 0,
        lineHeight: 1.2,
        rotation: 0,
      };

      setCurrentTextBoxes((prev) => [...prev, newTextBox]);
      setSelectedFieldId(fieldId);
      setIsAddTextBoxMode(false);
    },
    [isAddTextBoxMode, scale, currentPage, currentView]
  );

  // State to track if we're currently zooming to temporarily disable text layer
  const [isZooming, setIsZooming] = useState(false);
  const zoomTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle zoom state changes
  useEffect(() => {
    if (zoomTimeoutRef.current) {
      clearTimeout(zoomTimeoutRef.current);
    }

    setIsZooming(true);

    // Set a timeout to mark zooming as complete
    zoomTimeoutRef.current = setTimeout(() => {
      setIsZooming(false);
    }, 500); // Wait 500ms after scale change to re-enable text layer

    return () => {
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }
    };
  }, [scale]);

  // Attach click handlers to text spans for add text field mode (like DocumentCanvas)
  useEffect(() => {
    if (!isAddTextBoxMode || !documentUrl || isZooming) return;

    let debounceTimer: NodeJS.Timeout;

    const attachHandlers = () => {
      // Clear any existing timer
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      // Debounce to prevent excessive re-attachments during zoom/render
      debounceTimer = setTimeout(() => {
        // Only proceed if we're still in add textbox mode and not zooming
        if (!isAddTextBoxMode || isZooming) return;

        const textLayerDiv = document.querySelector(
          ".react-pdf__Page__textContent"
        );
        const textSpans = document.querySelectorAll(
          ".react-pdf__Page__textContent span"
        );

        // Only attach if text layer exists and has content
        if (!textLayerDiv || textSpans.length === 0) return;

        textSpans.forEach((span) => {
          // Only attach handler once and ensure span has content
          if (!(span as any).hasListener && span.textContent?.trim()) {
            span.addEventListener("click", handleTextSpanClick as any);
            (span as any).hasListener = true;
          }
        });
      }, 200); // Increased debounce to 200ms for better stability
    };

    // Only create observer if not zooming
    let observer: MutationObserver | null = null;

    if (!isZooming) {
      // Create a mutation observer to detect when text layer updates
      observer = new MutationObserver((mutations) => {
        // Skip if we're zooming
        if (isZooming) return;

        // Only process mutations that involve text content changes
        const hasTextChanges = mutations.some((mutation) =>
          Array.from(mutation.addedNodes).some(
            (node) =>
              node.nodeType === Node.ELEMENT_NODE &&
              (node as Element).classList?.contains(
                "react-pdf__Page__textContent"
              )
          )
        );

        if (hasTextChanges) {
          attachHandlers();
        }
      });

      if (documentRef.current) {
        const config = {
          childList: true,
          subtree: true,
          // Only observe specific changes to reduce noise
          attributeFilter: ["class"],
        };
        observer.observe(documentRef.current, config);

        // Initial attachment with delay to ensure text layer is ready
        setTimeout(() => {
          attachHandlers();
        }, 300);
      }
    }

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      if (observer) {
        observer.disconnect();
      }

      // Clean up all handlers
      const textSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );
      textSpans.forEach((span) => {
        span.removeEventListener("click", handleTextSpanClick as any);
        delete (span as any).hasListener;
      });
    };
  }, [
    isAddTextBoxMode,
    documentUrl,
    currentPage,
    handleTextSpanClick,
    isZooming,
  ]);

  // Handle textbox selection in Text Selection mode
  const handleTextBoxSelectionMode = useCallback(
    (textBoxId: string, event: React.MouseEvent) => {
      if (!isTextSelectionMode) return;

      event.stopPropagation();

      // Check if Ctrl/Cmd is pressed for multi-selection
      const isMultiSelect = event.ctrlKey || event.metaKey;

      setSelectedTextBoxes((prev) => {
        if (isMultiSelect) {
          // Multi-select: toggle the textbox
          const isSelected = prev.textBoxIds.includes(textBoxId);
          if (isSelected) {
            // Remove from selection
            const newIds = prev.textBoxIds.filter((id) => id !== textBoxId);
            return {
              textBoxIds: newIds,
              bounds:
                newIds.length > 0
                  ? calculateSelectionBounds(newIds)
                  : undefined,
            };
          } else {
            // Add to selection
            const newIds = [...prev.textBoxIds, textBoxId];
            return {
              textBoxIds: newIds,
              bounds: calculateSelectionBounds(newIds),
            };
          }
        } else {
          // Single select: replace selection
          return {
            textBoxIds: [textBoxId],
            bounds: calculateSelectionBounds([textBoxId]),
          };
        }
      });
    },
    [isTextSelectionMode]
  );

  // Calculate bounding box for selected textboxes
  const calculateSelectionBounds = useCallback(
    (textBoxIds: string[]) => {
      if (textBoxIds.length === 0) return undefined;

      const allTextBoxes = [...originalTextBoxes, ...translatedTextBoxes];
      const selectedBoxes = allTextBoxes.filter((box) =>
        textBoxIds.includes(box.id)
      );

      if (selectedBoxes.length === 0) return undefined;

      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity;

      selectedBoxes.forEach((box) => {
        minX = Math.min(minX, box.x);
        minY = Math.min(minY, box.y);
        maxX = Math.max(maxX, box.x + box.width);
        maxY = Math.max(maxY, box.y + box.height);
      });

      return {
        x: minX,
        y: minY,
        width: maxX - minX,
        height: maxY - minY,
      };
    },
    [originalTextBoxes, translatedTextBoxes]
  );

  // Handle moving selected textboxes
  const handleMoveSelectedTextBoxes = useCallback(
    (deltaX: number, deltaY: number) => {
      if (selectedTextBoxes.textBoxIds.length === 0) return;

      // Update all selected textboxes
      setCurrentTextBoxes((prev) =>
        prev.map((box) => {
          if (selectedTextBoxes.textBoxIds.includes(box.id)) {
            return {
              ...box,
              x: box.x + deltaX,
              y: box.y + deltaY,
            };
          }
          return box;
        })
      );

      // Update selection bounds
      setSelectedTextBoxes((prev) => ({
        ...prev,
        bounds: prev.bounds
          ? {
              ...prev.bounds,
              x: prev.bounds.x + deltaX,
              y: prev.bounds.y + deltaY,
            }
          : undefined,
      }));
    },
    [selectedTextBoxes.textBoxIds, currentView]
  );

  // Clear text selection when clicking outside
  const handleClearTextSelection = useCallback(() => {
    if (isTextSelectionMode) {
      setSelectedTextBoxes({ textBoxIds: [], bounds: undefined });
      setIsDrawingSelection(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  }, [isTextSelectionMode]);

  const handleImageLoadSuccess = (
    event: React.SyntheticEvent<HTMLImageElement>
  ) => {
    const img = event.currentTarget;
    setImageDimensions({
      width: img.naturalWidth,
      height: img.naturalHeight,
    });
    setPageWidth(img.naturalWidth);
    setPageHeight(img.naturalHeight);
    setIsDocumentLoaded(true);
    setError("");
  };

  const handleImageLoadError = () => {
    setError("Failed to load image");
    setIsDocumentLoaded(false);
  };

  // Calculate popup position for text selection
  const calculatePopupPosition = (
    top: number,
    height: number
  ): { top: number; position: "above" | "below" } => {
    const viewportHeight = window.innerHeight;
    const spaceBelow = viewportHeight - top - height;
    const spaceAbove = top;

    // If there's more space below, position below
    if (spaceBelow > spaceAbove) {
      return { top: top + height + 5, position: "below" };
    } else {
      return { top: top - 5, position: "above" };
    }
  };

  // File upload handler
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      setDocumentUrl(url);
      setFileType(getFileType(file.name));
      setIsLoading(true);
      setCurrentPage(1);

      // Reset editor state
      setOriginalTextBoxes([]);
      setOriginalShapes([]);
      setOriginalDeletionRectangles([]);
      setTranslatedTextBoxes([]);
      setTranslatedShapes([]);
      setTranslatedDeletionRectangles([]);
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      setDeletedPages(new Set());
      setPdfBackgroundColor("white"); // Reset background color for new document

      // Switch to pages tab when document is uploaded
      setActiveSidebarTab("pages");

      setTimeout(() => setIsLoading(false), 500);
    }
  };

  // Handle page deletion
  const handleDeletePage = (pageNumber: number) => {
    const remainingPages = numPages - deletedPages.size;

    if (remainingPages <= 1) {
      toast.error("Cannot delete the last remaining page");
      return;
    }

    // Add page to deleted pages set
    setDeletedPages((prev) => new Set([...prev, pageNumber]));

    // Remove all elements from the deleted page (both original and translated)
    setOriginalTextBoxes((prev) =>
      prev.filter((box) => box.page !== pageNumber)
    );
    setOriginalShapes((prev) =>
      prev.filter((shape) => shape.page !== pageNumber)
    );
    setOriginalDeletionRectangles((prev) =>
      prev.filter((rect) => rect.page !== pageNumber)
    );
    setTranslatedTextBoxes((prev) =>
      prev.filter((box) => box.page !== pageNumber)
    );
    setTranslatedShapes((prev) =>
      prev.filter((shape) => shape.page !== pageNumber)
    );
    setTranslatedDeletionRectangles((prev) =>
      prev.filter((rect) => rect.page !== pageNumber)
    );

    // If current page is being deleted, switch to the first available page
    if (currentPage === pageNumber) {
      const availablePages = Array.from(
        { length: numPages },
        (_, i) => i + 1
      ).filter((page) => !deletedPages.has(page) && page !== pageNumber);

      if (availablePages.length > 0) {
        setCurrentPage(availablePages[0]);
      }
    }

    toast.success(`Page ${pageNumber} deleted`);
  };

  // Create text field from selected text with proper font size estimation
  const createTextFieldFromSelection = useCallback(
    (selection: {
      text: string;
      pagePosition: { x: number; y: number };
      pageSize: { width: number; height: number };
    }) => {
      const value = selection.text;
      const fieldId = generateUUID();

      // Estimate font size based on text height
      // PDF text height is usually about 1.2x the font size
      const estimatedFontSize = Math.max(
        8,
        Math.round(selection.pageSize.height / 1.2)
      );

      // Use actual dimensions from selection
      const width = Math.max(selection.pageSize.width, 50);
      const height = Math.max(selection.pageSize.height, 20);

      const newTextBox: TextField = {
        id: fieldId,
        x: selection.pagePosition.x,
        y: selection.pagePosition.y,
        width: width,
        height: height,
        value: value,
        fontSize: estimatedFontSize,
        fontFamily: "Arial, sans-serif",
        page: currentPage,
        color: "#000000",
        bold: false,
        italic: false,
        underline: false,
        textAlign: "left",
        listType: "none",
        letterSpacing: 0,
        lineHeight: 1.2,
        rotation: 0,
      };

      setCurrentTextBoxes((prev) => [...prev, newTextBox]);
      setSelectedFieldId(fieldId);
    },
    [currentPage, currentView]
  );

  // Create deletion rectangle from selected text
  const createDeletionFromSelection = useCallback(
    (selection: {
      text: string;
      pagePosition: { x: number; y: number };
      pageSize: { width: number; height: number };
    }) => {
      const newRectangle: DeletionRectangle = {
        id: generateUUID(),
        x: selection.pagePosition.x,
        y: selection.pagePosition.y,
        width: selection.pageSize.width + 1, // Add 1px for better coverage
        height: selection.pageSize.height + 1, // Add 1px for better coverage
        page: currentPage,
        background: pdfBackgroundColor, // Use the stored PDF background color
      };

      setCurrentDeletionRectangles((prev) => [...prev, newRectangle]);
    },
    [currentPage, currentView, pdfBackgroundColor]
  );

  // Create text field from selected text with font properties
  const createTextFieldFromSelectionWithFont = useCallback(
    (selection: {
      text: string;
      pagePosition: { x: number; y: number };
      pageSize: { width: number; height: number };
      fontProperties: {
        fontFamily: string;
        isBold: boolean;
        isItalic: boolean;
        fontSize: number;
      };
    }) => {
      const value = selection.text;
      const fieldId = generateUUID();

      // Use detected font properties
      const { fontFamily, isBold, isItalic, fontSize } =
        selection.fontProperties;

      // Convert font size from screen pixels to PDF coordinates
      const pdfFontSize = fontSize / scale;

      // Use actual dimensions from selection
      const width = Math.max(selection.pageSize.width, 50);
      const height = Math.max(selection.pageSize.height, 20);

      const newTextBox: TextField = {
        id: fieldId,
        x: selection.pagePosition.x,
        y: selection.pagePosition.y,
        width: width,
        height: height,
        value: value,
        fontSize: Math.max(8, pdfFontSize),
        fontFamily: fontFamily,
        page: currentPage,
        color: "#000000",
        bold: isBold,
        italic: isItalic,
        underline: false,
        textAlign: "left",
        listType: "none",
        letterSpacing: 0,
        lineHeight: 1.2,
        rotation: 0,
      };

      setCurrentTextBoxes((prev) => [...prev, newTextBox]);
      setSelectedFieldId(fieldId);
    },
    [currentPage, currentView, scale]
  );

  // Text box management
  const addTextBox = useCallback(
    (x: number, y: number, targetView?: "original" | "translated") => {
      const value = "New Text Field";
      const fontSize = 8;
      const fontFamily = "Arial, sans-serif";
      const fieldId = generateUUID();

      const { width, height } = measureText(value, fontSize, fontFamily);

      const newTextBox: TextField = {
        id: fieldId,
        x: x,
        y: y,
        width: width,
        height: height,
        value: value,
        fontSize: fontSize,
        fontFamily: fontFamily,
        page: currentPage,
        color: "#000000",
        bold: false,
        italic: false,
        underline: false,
        textAlign: "left",
        listType: "none",
        letterSpacing: 0,
        lineHeight: 1.2,
        rotation: 0,
      };

      // Determine which document to add to
      if (currentView === "split") {
        // In split view, determine target based on click position or default to original
        if (targetView === "translated") {
          setTranslatedTextBoxes((prev) => [...prev, newTextBox]);
        } else {
          setOriginalTextBoxes((prev) => [...prev, newTextBox]);
        }
      } else {
        setCurrentTextBoxes((prev) => [...prev, newTextBox]);
      }

      setSelectedFieldId(fieldId);
      setIsAddTextBoxMode(false);
      setIsTextSelectionMode(false);
      setShapeDrawingMode(null);
      setIsDrawingInProgress(false);
      setShapeDrawStart(null);
      setShapeDrawEnd(null);
      setShapeDrawTargetView(null);
    },
    [currentPage, currentView]
  );

  const updateTextBox = useCallback(
    (id: string, updates: Partial<TextField>) => {
      setCurrentTextBoxes((prev) =>
        prev.map((box) => (box.id === id ? { ...box, ...updates } : box))
      );
    },
    [currentView]
  );

  const deleteTextBox = useCallback(
    (id: string) => {
      setCurrentTextBoxes((prev) => prev.filter((box) => box.id !== id));
      setSelectedFieldId((current) => (current === id ? null : current));
    },
    [currentView]
  );

  // Memoized callbacks for text box interactions to prevent re-renders
  const handleTextBoxSelect = useCallback(
    (id: string) => {
      setSelectedFieldId(id);
      // Turn off text selection mode when selecting a text box
      if (isTextSelectionMode) {
        setIsTextSelectionMode(false);
      }
    },
    [isTextSelectionMode]
  );

  // Create a stable format change handler using useCallback
  const handleFormatChange = useCallback(
    (format: any) => {
      console.log(
        "handleFormatChange called with:",
        format,
        "selectedFieldId:",
        selectedFieldId
      );

      // Safety check: ensure format is defined and is an object
      if (!format || typeof format !== "object") {
        console.warn("Invalid format object:", format);
        return;
      }

      if (selectedFieldId) {
        const updates: Partial<TextField> = {};

        // Map format changes back to TextField properties
        if (format.value !== undefined) updates.value = format.value;
        if (format.fontFamily !== undefined)
          updates.fontFamily = format.fontFamily;
        if (format.fontSize !== undefined) updates.fontSize = format.fontSize;
        if (format.color !== undefined) updates.color = format.color;
        if (format.bold !== undefined) updates.bold = format.bold;
        if (format.italic !== undefined) updates.italic = format.italic;
        if (format.letterSpacing !== undefined)
          updates.letterSpacing = format.letterSpacing;
        if (format.underline !== undefined)
          updates.underline = format.underline;
        if (format.textAlign !== undefined)
          updates.textAlign = format.textAlign;
        if (format.listType !== undefined) updates.listType = format.listType;
        if (format.lineHeight !== undefined)
          updates.lineHeight = format.lineHeight;
        if (format.backgroundColor !== undefined)
          updates.backgroundColor = format.backgroundColor;
        if (format.borderColor !== undefined)
          updates.borderColor = format.borderColor;
        if (format.borderWidth !== undefined)
          updates.borderWidth = format.borderWidth;
        if (format.borderRadius !== undefined)
          updates.borderRadius = format.borderRadius;
        if (format.paddingTop !== undefined)
          updates.paddingTop = format.paddingTop;
        if (format.paddingRight !== undefined)
          updates.paddingRight = format.paddingRight;
        if (format.paddingBottom !== undefined)
          updates.paddingBottom = format.paddingBottom;
        if (format.paddingLeft !== undefined)
          updates.paddingLeft = format.paddingLeft;

        console.log("Applying updates:", updates);
        updateTextBox(selectedFieldId, updates);
      } else {
        console.warn("No selected field ID when trying to update format");
      }
    },
    [selectedFieldId, updateTextBox]
  );

  // Effect to handle text box selection and TextFormatDrawer updates
  useEffect(() => {
    // Use setTimeout to ensure state updates happen after render
    const timeoutId = setTimeout(() => {
      if (selectedFieldId) {
        // Find the selected text box from all text boxes
        const allTextBoxes = [...originalTextBoxes, ...translatedTextBoxes];
        const selectedTextBox = allTextBoxes.find(
          (box) => box.id === selectedFieldId
        );

        if (selectedTextBox) {
          console.log("Selected text box:", selectedTextBox);

          // Ensure all required properties exist with safe defaults
          const safeTextBox = {
            id: selectedTextBox.id || "",
            x: selectedTextBox.x || 0,
            y: selectedTextBox.y || 0,
            width: selectedTextBox.width || 100,
            height: selectedTextBox.height || 20,
            value: selectedTextBox.value || "", // Ensure value is never undefined
            fontSize: selectedTextBox.fontSize || 12,
            fontFamily: selectedTextBox.fontFamily || "Arial",
            page: selectedTextBox.page || 1,
            rotation: selectedTextBox.rotation || 0,
            // Text formatting properties
            bold: selectedTextBox.bold || false,
            italic: selectedTextBox.italic || false,
            underline: selectedTextBox.underline || false,
            color: selectedTextBox.color || "#000000",
            textAlign: selectedTextBox.textAlign || "left",
            listType: selectedTextBox.listType || "none",
            // Spacing and layout
            lineHeight: selectedTextBox.lineHeight || 1.2,
            letterSpacing: selectedTextBox.letterSpacing || 0,
            // Border and background
            borderColor: selectedTextBox.borderColor || "#000000",
            borderWidth: selectedTextBox.borderWidth || 0,
            backgroundColor: selectedTextBox.backgroundColor || "transparent",
            borderRadius: selectedTextBox.borderRadius || 0,
            // Padding
            paddingTop: selectedTextBox.paddingTop || 0,
            paddingRight: selectedTextBox.paddingRight || 0,
            paddingBottom: selectedTextBox.paddingBottom || 0,
            paddingLeft: selectedTextBox.paddingLeft || 0,
            // State
            isEditing: selectedTextBox.isEditing || false,
          };

          console.log("Setting safeTextBox format:", safeTextBox);

          // Update the format drawer state
          setCurrentFormat(safeTextBox);
          setSelectedElementId(selectedFieldId);
          setIsDrawerOpen(true);
        } else {
          console.warn("Selected text box not found:", selectedFieldId);
          // Close drawer if selected text box is not found
          setIsDrawerOpen(false);
          setSelectedElementId(null);
          setCurrentFormat(null);
        }
      } else {
        // Close drawer when no text box is selected
        setIsDrawerOpen(false);
        setSelectedElementId(null);
        setCurrentFormat(null);
      }
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [
    selectedFieldId,
    originalTextBoxes,
    translatedTextBoxes,
    setIsDrawerOpen,
    setSelectedElementId,
    setCurrentFormat,
  ]);

  // Set the format change handler when it changes
  useEffect(() => {
    console.log("Setting onFormatChange handler:", handleFormatChange);
    if (typeof handleFormatChange === "function") {
      setOnFormatChange(handleFormatChange);
    } else {
      console.error(
        "handleFormatChange is not a function:",
        handleFormatChange
      );
    }
  }, [handleFormatChange, setOnFormatChange]);

  // Memoized callbacks for shape interactions to prevent re-renders
  const handleShapeSelect = useCallback(
    (id: string) => {
      setSelectedShapeId(id);
      setSelectedFieldId(null); // Clear text field selection
      setIsDrawerOpen(false); // Close the format drawer when selecting shapes
    },
    [setIsDrawerOpen]
  );

  const updateShapeCallback = useCallback(
    (id: string, updates: Partial<Shape>) => {
      setCurrentShapes((prev) =>
        prev.map((shape) =>
          shape.id === id ? { ...shape, ...updates } : shape
        )
      );
    },
    [currentView]
  );

  const deleteShapeCallback = useCallback(
    (id: string) => {
      setCurrentShapes((prev) => prev.filter((shape) => shape.id !== id));
      setSelectedShapeId((current) => (current === id ? null : current));
    },
    [currentView]
  );

  // Shape management
  const addShape = useCallback(
    (
      type: "circle" | "rectangle",
      x: number,
      y: number,
      width: number,
      height: number,
      targetView?: "original" | "translated"
    ) => {
      const newShape: Shape = {
        id: generateUUID(),
        type,
        x,
        y,
        width,
        height,
        page: currentPage,
        borderColor: "#000000",
        borderWidth: 2,
        fillColor: "#ffffff",
        fillOpacity: 0.5,
        rotation: 0,
      };

      // Determine which document to add to
      if (currentView === "split") {
        // In split view, determine target based on position or default to original
        if (targetView === "translated") {
          setTranslatedShapes((prev) => [...prev, newShape]);
        } else {
          setOriginalShapes((prev) => [...prev, newShape]);
        }
      } else {
        setCurrentShapes((prev) => [...prev, newShape]);
      }

      setSelectedShapeId(newShape.id);
    },
    [currentPage, currentView]
  );

  const updateShape = useCallback(
    (id: string, updates: Partial<Shape>) => {
      setCurrentShapes((prev) =>
        prev.map((shape) =>
          shape.id === id ? { ...shape, ...updates } : shape
        )
      );
    },
    [currentView]
  );

  const deleteShape = useCallback(
    (id: string) => {
      setCurrentShapes((prev) => prev.filter((shape) => shape.id !== id));
      if (selectedShapeId === id) {
        setSelectedShapeId(null);
      }
    },
    [currentView, selectedShapeId]
  );

  // Deletion rectangle management
  const addDeletionRectangle = useCallback(
    (x: number, y: number, width: number, height: number) => {
      const newRectangle: DeletionRectangle = {
        id: generateUUID(),
        x,
        y,
        width,
        height,
        page: currentPage,
        background: "#ffffff",
      };

      setCurrentDeletionRectangles((prev) => [...prev, newRectangle]);
    },
    [currentPage, currentView]
  );

  const updateDeletionRectangle = useCallback(
    (id: string, updates: Partial<DeletionRectangle>) => {
      setCurrentDeletionRectangles((prev) =>
        prev.map((rect) => (rect.id === id ? { ...rect, ...updates } : rect))
      );
    },
    [currentView]
  );

  const deleteDeletionRectangle = useCallback(
    (id: string) => {
      setCurrentDeletionRectangles((prev) =>
        prev.filter((rect) => rect.id !== id)
      );
    },
    [currentView]
  );

  // Handle mouse down for text selection
  const handleDocumentMouseDown = (e: React.MouseEvent) => {
    if (isTextSelectionMode) {
      // Handle drag-to-select for textboxes
      if (e.button !== 0) return; // Only left click

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX;
      const y = e.clientY;

      setIsDrawingSelection(true);
      setSelectionStart({ x, y });
      setSelectionEnd({ x, y });

      // Clear previous selections unless holding Ctrl/Cmd
      if (!e.ctrlKey && !e.metaKey) {
        setSelectedTextBoxes({ textBoxIds: [], bounds: undefined });
      }

      e.preventDefault();
    }
  };

  // Handle mouse move for text selection
  const handleDocumentMouseMove = (e: React.MouseEvent) => {
    if (isTextSelectionMode && isDrawingSelection && selectionStart) {
      const x = e.clientX;
      const y = e.clientY;

      setSelectionEnd({ x, y });
      e.preventDefault();
    }
  };

  // Handle mouse up for text selection
  const handleDocumentMouseUp = (e: React.MouseEvent) => {
    if (isTextSelectionMode && isDrawingSelection) {
      // Find textboxes within the selection rectangle
      if (
        selectionRect &&
        selectionRect.width > 5 &&
        selectionRect.height > 5
      ) {
        const rect = documentRef.current?.getBoundingClientRect();
        if (rect) {
          const currentTextBoxes = getCurrentPageTextBoxes;
          const selectedIds: string[] = [];

          currentTextBoxes.forEach((textBox) => {
            // Convert textbox coordinates to screen coordinates
            const textBoxLeft = rect.left + textBox.x * scale;
            const textBoxTop = rect.top + textBox.y * scale;
            const textBoxRight = textBoxLeft + textBox.width * scale;
            const textBoxBottom = textBoxTop + textBox.height * scale;

            // Check if textbox intersects with selection rectangle
            const intersects = !(
              textBoxRight < selectionRect.left ||
              textBoxLeft > selectionRect.left + selectionRect.width ||
              textBoxBottom < selectionRect.top ||
              textBoxTop > selectionRect.top + selectionRect.height
            );

            if (intersects) {
              selectedIds.push(textBox.id);
            }
          });

          // Update selection (merge with existing if Ctrl/Cmd held)
          if (e.ctrlKey || e.metaKey) {
            setSelectedTextBoxes((prev) => {
              const newIds = [...new Set([...prev.textBoxIds, ...selectedIds])];
              return {
                textBoxIds: newIds,
                bounds:
                  newIds.length > 0
                    ? calculateSelectionBounds(newIds)
                    : undefined,
              };
            });
          } else {
            setSelectedTextBoxes({
              textBoxIds: selectedIds,
              bounds:
                selectedIds.length > 0
                  ? calculateSelectionBounds(selectedIds)
                  : undefined,
            });
          }
        }
      }

      // Reset selection state
      setIsDrawingSelection(false);
      setSelectionStart(null);
      setSelectionEnd(null);
    }
  };

  // Document container click handler
  const handleDocumentContainerClick = (e: React.MouseEvent) => {
    if (!documentRef.current) return;

    // Don't handle clicks on text boxes or other interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest(".rnd")
    ) {
      return;
    }

    const rect = documentRef.current.getBoundingClientRect();
    let x = (e.clientX - rect.left) / scale;
    let y = (e.clientY - rect.top) / scale;
    let targetView: "original" | "translated" | undefined = undefined;

    // For split screen view, determine which side was clicked and adjust coordinates
    if (currentView === "split") {
      const clickX = e.clientX - rect.left;
      const singleDocWidth = pageWidth * scale;
      const gap = 20; // Gap between documents

      // If click is on the right side (translated document)
      if (clickX > singleDocWidth + gap) {
        // Adjust x coordinate for the translated document side
        x = (clickX - singleDocWidth - gap) / scale;
        targetView = "translated";
      } else if (clickX <= singleDocWidth) {
        // Click is on the left side (original document)
        targetView = "original";
      } else {
        // Click is in the gap - ignore
        return;
      }
    }

    if (isAddTextBoxMode) {
      addTextBox(x, y, targetView);
    } else if (shapeDrawingMode) {
      if (!isDrawingInProgress) {
        setShapeDrawStart({ x, y });
        setShapeDrawTargetView(targetView || null);
        setIsDrawingInProgress(true);
      }
    } else {
      // Clear selections only if clicking on empty space
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      // Clear text selection in text selection mode
      handleClearTextSelection();
      // Close the format drawer when clicking on empty space
      setIsDrawerOpen(false);
    }
  };

  // Shape drawing handlers
  const handleShapeDrawStart = (e: React.MouseEvent) => {
    if (!shapeDrawingMode) return;

    const rect = documentRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setShapeDrawStart({ x, y });
    setIsDrawingInProgress(true);
  };

  const handleShapeDrawMove = (e: React.MouseEvent) => {
    if (!isDrawingInProgress || !shapeDrawStart) return;

    const rect = documentRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = (e.clientX - rect.left) / scale;
    const y = (e.clientY - rect.top) / scale;

    setShapeDrawEnd({ x, y });
  };

  const handleShapeDrawEnd = () => {
    if (!isDrawingInProgress || !shapeDrawStart || !shapeDrawEnd) return;

    const width = Math.abs(shapeDrawEnd.x - shapeDrawStart.x);
    const height = Math.abs(shapeDrawEnd.y - shapeDrawStart.y);

    if (width > 10 && height > 10) {
      const x = Math.min(shapeDrawStart.x, shapeDrawEnd.x);
      const y = Math.min(shapeDrawStart.y, shapeDrawEnd.y);

      if (shapeDrawingMode) {
        addShape(
          shapeDrawingMode,
          x,
          y,
          width,
          height,
          shapeDrawTargetView || undefined
        );
      }
    }

    setShapeDrawStart(null);
    setShapeDrawEnd(null);
    setShapeDrawTargetView(null);
    setIsDrawingInProgress(false);
    setShapeDrawingMode(null);
    setIsAddTextBoxMode(false);
    setIsTextSelectionMode(false);
  };

  // Export functionality
  const exportData = () => {
    const data = {
      originalTextBoxes,
      originalShapes,
      originalDeletionRectangles,
      translatedTextBoxes,
      translatedShapes,
      translatedDeletionRectangles,
      documentInfo: {
        url: documentUrl,
        currentPage,
        numPages,
        scale,
        pageWidth,
        pageHeight,
      },
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pdf-editor-data.json";
    a.click();
    URL.revokeObjectURL(url);

    toast.success("Data exported successfully!");
  };

  const saveProject = () => {
    // This would typically save to a backend
    localStorage.setItem(
      "pdf-editor-project",
      JSON.stringify({
        originalTextBoxes,
        originalShapes,
        originalDeletionRectangles,
        translatedTextBoxes,
        translatedShapes,
        translatedDeletionRectangles,
        documentUrl,
        currentPage,
      })
    );
    toast.success("Project saved!");
  };

  const loadProject = () => {
    const saved = localStorage.getItem("pdf-editor-project");
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setOriginalTextBoxes(data.originalTextBoxes || data.textBoxes || []);
        setOriginalShapes(data.originalShapes || data.shapes || []);
        setOriginalDeletionRectangles(
          data.originalDeletionRectangles || data.deletionRectangles || []
        );
        setTranslatedTextBoxes(data.translatedTextBoxes || []);
        setTranslatedShapes(data.translatedShapes || []);
        setTranslatedDeletionRectangles(
          data.translatedDeletionRectangles || []
        );
        if (data.documentUrl) {
          setDocumentUrl(data.documentUrl);
          setCurrentPage(data.currentPage || 1);
        }
        toast.success("Project loaded!");
      } catch (error) {
        toast.error("Failed to load project");
      }
    }
  };

  // Get current page items - memoized for performance
  const getCurrentPageTextBoxes = useMemo(
    () => getCurrentTextBoxes().filter((box) => box.page === currentPage),
    [currentView, originalTextBoxes, translatedTextBoxes, currentPage]
  );
  const getCurrentPageShapes = useMemo(
    () => getCurrentShapes().filter((shape) => shape.page === currentPage),
    [currentView, originalShapes, translatedShapes, currentPage]
  );
  const getCurrentPageDeletionRectangles = useMemo(
    () =>
      getCurrentDeletionRectangles().filter(
        (rect) => rect.page === currentPage
      ),
    [
      currentView,
      originalDeletionRectangles,
      translatedDeletionRectangles,
      currentPage,
    ]
  );

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-red-100 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center space-x-4">
            <Button
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
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
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              accept=".pdf,.jpg,.jpeg,.png,.gif,.bmp,.webp"
              className="hidden"
            />
            <Button
              onClick={saveProject}
              variant="outline"
              size="sm"
              className="border-red-200 text-red-700 hover:bg-red-50 hover:border-red-300 transition-colors"
            >
              <Save className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              onClick={exportData}
              className="bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-md transition-all duration-200 hover:shadow-lg"
              size="sm"
            >
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Sidebar */}
        <div
          className={`bg-white border-r border-red-100 p-4 overflow-y-auto transition-all duration-300 shadow-sm ${
            isSidebarCollapsed ? "w-0 p-0 border-r-0" : "w-80"
          }`}
        >
          {!isSidebarCollapsed && (
            <div className="flex flex-col h-full">
              {/* Tab Navigation */}
              <div className="flex border-b border-red-100 mb-4">
                <button
                  onClick={() => setActiveSidebarTab("tools")}
                  className={`${
                    documentUrl ? "flex-1" : "w-full"
                  } px-4 py-3 text-sm font-medium text-center transition-all duration-200 relative ${
                    activeSidebarTab === "tools"
                      ? "text-red-600 border-b-2 border-red-600 bg-red-50"
                      : "text-gray-500 hover:text-red-600 hover:bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Wrench className="w-4 h-4" />
                    <span>Tools</span>
                  </div>
                </button>
                {documentUrl && (
                  <button
                    onClick={() => setActiveSidebarTab("pages")}
                    className={`flex-1 px-4 py-3 text-sm font-medium text-center transition-all duration-200 relative ${
                      activeSidebarTab === "pages"
                        ? "text-red-600 border-b-2 border-red-600 bg-red-50"
                        : "text-gray-500 hover:text-red-600 hover:bg-red-50"
                    }`}
                  >
                    <div className="flex items-center justify-center space-x-2">
                      <Files className="w-4 h-4" />
                      <span>Pages</span>
                    </div>
                  </button>
                )}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto">
                {activeSidebarTab === "pages" ? (
                  <div className="flex flex-col h-full">
                    {/* Pages Preview */}
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold mb-3">Pages</h3>

                      {!documentUrl ? (
                        <div className="flex flex-col items-center justify-center h-32 text-center">
                          <div className="text-gray-400 mb-2">
                            No document loaded
                          </div>
                          <div className="text-sm text-gray-500">
                            Upload a document to get started
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {Array.from({ length: numPages }, (_, index) => {
                            const pageNum = index + 1;

                            // Skip deleted pages
                            if (deletedPages.has(pageNum)) {
                              return null;
                            }

                            const pageTextBoxes = [
                              ...originalTextBoxes,
                              ...translatedTextBoxes,
                            ].filter((box) => box.page === pageNum);
                            const pageShapes = [
                              ...originalShapes,
                              ...translatedShapes,
                            ].filter((shape) => shape.page === pageNum);
                            const pageDeletions = [
                              ...originalDeletionRectangles,
                              ...translatedDeletionRectangles,
                            ].filter((rect) => rect.page === pageNum);
                            const totalElements =
                              pageTextBoxes.length +
                              pageShapes.length +
                              pageDeletions.length;

                            return (
                              <div
                                key={pageNum}
                                className={`border rounded-lg p-3 cursor-pointer transition-all duration-200 hover:shadow-md group relative ${
                                  currentPage === pageNum
                                    ? "border-red-500 bg-red-50 shadow-sm ring-1 ring-red-200"
                                    : "border-gray-200 hover:border-red-300 hover:bg-red-25"
                                }`}
                                onClick={() => setCurrentPage(pageNum)}
                              >
                                {/* Delete Button - Only show on hover and if more than 1 page */}
                                {numPages - deletedPages.size > 1 && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleDeletePage(pageNum);
                                    }}
                                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-red-600 z-10 shadow-md"
                                    title={`Delete page ${pageNum}`}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                )}

                                {/* Page Thumbnail */}
                                <div className="relative mb-2">
                                  <div
                                    className="w-full bg-white flex items-center justify-center relative overflow-hidden shadow-sm"
                                    style={{
                                      aspectRatio: "8.5/11", // Letter size ratio
                                      height: "120px",
                                    }}
                                  >
                                    {/* Mini document preview */}
                                    {isPdfFile(documentUrl) ? (
                                      <div className="w-full h-full bg-white relative">
                                        <Document
                                          file={documentUrl}
                                          loading={null}
                                          error={null}
                                        >
                                          <Page
                                            pageNumber={pageNum}
                                            width={200}
                                            renderTextLayer={false}
                                            renderAnnotationLayer={false}
                                            loading={null}
                                            error={null}
                                            onRenderError={handlePageLoadError}
                                          />
                                        </Document>
                                      </div>
                                    ) : (
                                      <img
                                        src={documentUrl}
                                        alt={`Page ${pageNum}`}
                                        className="w-full h-full object-contain"
                                      />
                                    )}

                                    {/* Page number overlay */}
                                    <div className="absolute bottom-1 right-1 bg-black bg-opacity-60 text-white text-xs px-1 py-0.5 rounded">
                                      {pageNum}
                                    </div>

                                    {/* Current page indicator */}
                                    {currentPage === pageNum && (
                                      <div className="absolute inset-0 bg-red-500 bg-opacity-10 rounded" />
                                    )}
                                  </div>
                                </div>

                                {/* Page Info */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between">
                                    <span className="font-medium text-sm">
                                      Page {pageNum}
                                    </span>
                                    {totalElements > 0 && (
                                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                        {totalElements} element
                                        {totalElements !== 1 ? "s" : ""}
                                      </span>
                                    )}
                                  </div>

                                  {totalElements > 0 && (
                                    <div className="flex items-center space-x-3 text-xs text-gray-500">
                                      {pageTextBoxes.length > 0 && (
                                        <span className="flex items-center space-x-1">
                                          <Type className="w-3 h-3" />
                                          <span>{pageTextBoxes.length}</span>
                                        </span>
                                      )}
                                      {pageShapes.length > 0 && (
                                        <span className="flex items-center space-x-1">
                                          <Square className="w-3 h-3" />
                                          <span>{pageShapes.length}</span>
                                        </span>
                                      )}
                                      {pageDeletions.length > 0 && (
                                        <span className="flex items-center space-x-1">
                                          <Trash2 className="w-3 h-3" />
                                          <span>{pageDeletions.length}</span>
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Upload Button at Bottom */}
                    <div className="border-t border-red-100 pt-4 mt-4">
                      <Button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full bg-red-600 hover:bg-red-700 text-white border-red-600 hover:border-red-700 shadow-md transition-all duration-200 hover:shadow-lg"
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        {documentUrl
                          ? "Upload New Document"
                          : "Upload Document"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Tools Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Wrench className="w-5 h-5" />
                        <span>Tools</span>
                      </h3>
                      <div className="space-y-3">
                        <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                              <FileSearch className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                Document Extraction
                              </div>
                              <div className="text-xs text-gray-500">
                                Extract data from documents
                              </div>
                            </div>
                          </div>
                        </button>

                        <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                              <MousePointer className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                Select & Translate Field
                              </div>
                              <div className="text-xs text-gray-500">
                                Select and translate specific fields
                              </div>
                            </div>
                          </div>
                        </button>

                        <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                              <Scan className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                Scan & OCR
                              </div>
                              <div className="text-xs text-gray-500">
                                Optical character recognition
                              </div>
                            </div>
                          </div>
                        </button>

                        <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                              <MessageSquare className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                Chat with Wally AI Assistant
                              </div>
                              <div className="text-xs text-gray-500">
                                Get AI-powered assistance
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* Translation Section */}
                    <div>
                      <h3 className="text-lg font-semibold mb-4 flex items-center space-x-2">
                        <Languages className="w-5 h-5" />
                        <span>Translation</span>
                      </h3>
                      <div className="space-y-3">
                        <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                              <FileText className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                Translate Birth Certificate
                              </div>
                              <div className="text-xs text-gray-500">
                                Specialized birth certificate translation
                              </div>
                            </div>
                          </div>
                        </button>

                        <button className="w-full p-4 text-left border border-gray-200 rounded-lg hover:border-red-300 hover:bg-red-50 transition-all duration-200 group">
                          <div className="flex items-center space-x-3">
                            <div className="p-2 bg-red-100 rounded-lg group-hover:bg-red-200 transition-colors">
                              <Globe className="w-5 h-5 text-red-600" />
                            </div>
                            <div>
                              <div className="font-medium text-sm text-gray-900">
                                Translate Dynamic Content
                              </div>
                              <div className="text-xs text-gray-500">
                                Real-time content translation
                              </div>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* TextFormatDrawer - Positioned at top of main content area */}
          <div
            className={`relative z-40 transition-all duration-300 ${
              isSidebarCollapsed ? "" : ""
            }`}
          >
            <TextFormatDrawer />
          </div>

          {/* Floating Toolbar - Moved down to account for format drawer */}
          <div
            className={`absolute z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300 ${
              isSidebarCollapsed ? "left-4" : "left-4"
            }`}
            style={{
              top: "80px", // Moved down from top-4 to account for format drawer
            }}
          >
            <div className="bg-white rounded-lg shadow-lg border border-red-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
              <button
                onClick={() => {
                  // Toggle text selection mode and disable other modes
                  const newMode = !isTextSelectionMode;
                  setIsTextSelectionMode(newMode);
                  if (newMode) {
                    setIsAddTextBoxMode(false);
                    setShapeDrawingMode(null);
                    setIsDrawingInProgress(false);
                    setShapeDrawStart(null);
                    setShapeDrawEnd(null);
                    setShapeDrawTargetView(null);
                  }
                }}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  isTextSelectionMode
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Add Text Field from Document (Click text to create editable field)"
              >
                <MousePointer className="w-5 h-5" />
              </button>
              <button
                onClick={() => {
                  // Toggle add text box mode and disable other modes
                  const newMode = !isAddTextBoxMode;
                  setIsAddTextBoxMode(newMode);
                  if (newMode) {
                    setIsTextSelectionMode(false);
                    setShapeDrawingMode(null);
                    setIsDrawingInProgress(false);
                    setShapeDrawStart(null);
                    setShapeDrawEnd(null);
                    setShapeDrawTargetView(null);
                  }
                }}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  isAddTextBoxMode
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Add Text Field"
              >
                <Type className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  // Toggle rectangle drawing mode and disable other modes
                  const newMode =
                    shapeDrawingMode === "rectangle" ? null : "rectangle";
                  setShapeDrawingMode(newMode);
                  setSelectedShapeType("rectangle");
                  if (newMode) {
                    setIsTextSelectionMode(false);
                    setIsAddTextBoxMode(false);
                    setIsDrawingInProgress(false);
                    setShapeDrawStart(null);
                    setShapeDrawEnd(null);
                    setShapeDrawTargetView(null);
                  }
                }}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  shapeDrawingMode === "rectangle"
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Draw Rectangle"
              >
                <Square className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  // Toggle circle drawing mode and disable other modes
                  const newMode =
                    shapeDrawingMode === "circle" ? null : "circle";
                  setShapeDrawingMode(newMode);
                  setSelectedShapeType("circle");
                  if (newMode) {
                    setIsTextSelectionMode(false);
                    setIsAddTextBoxMode(false);
                    setIsDrawingInProgress(false);
                    setShapeDrawStart(null);
                    setShapeDrawEnd(null);
                    setShapeDrawTargetView(null);
                  }
                }}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  shapeDrawingMode === "circle"
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Draw Circle"
              >
                <Circle className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Right Floating Toolbar - View Controls - Also moved down */}
          <div
            className="absolute right-4 z-50 flex flex-col space-y-2 floating-toolbar transition-all duration-300"
            style={{
              top: "80px", // Moved down from top-4 to account for format drawer
            }}
          >
            <div className="bg-white rounded-lg shadow-lg border border-red-100 p-2 flex flex-col space-y-1 backdrop-blur-sm bg-white/95">
              <button
                onClick={() => setCurrentView("original")}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  currentView === "original"
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Original Document"
              >
                <FileText className="w-5 h-5" />
              </button>

              <button
                onClick={() => setCurrentView("translated")}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  currentView === "translated"
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Translated Document"
              >
                <Globe className="w-5 h-5" />
              </button>

              <button
                onClick={() => setCurrentView("split")}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  currentView === "split"
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Split Screen"
              >
                <SplitSquareHorizontal className="w-5 h-5" />
              </button>

              <button
                onClick={() => setIsEditMode(!isEditMode)}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  isEditMode
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Toggle Edit Mode"
              >
                <Edit2 className="w-5 h-5" />
              </button>

              <button
                onClick={() =>
                  setShowDeletionRectangles(!showDeletionRectangles)
                }
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  showDeletionRectangles
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title={
                  showDeletionRectangles
                    ? "Hide Deletion Areas"
                    : "Show Deletion Areas"
                }
              >
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Document Viewer - Added top padding */}
          <div
            className="flex-1 document-viewer document-container"
            ref={containerRef}
            style={{
              scrollBehavior: "smooth",
              overflow: "auto",
              overflowX: "auto",
              overflowY: "auto",
              paddingTop: "20px", // Added top padding to account for format drawer
            }}
          >
            {error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-red-500 text-lg mb-2">Error</div>
                  <div className="text-gray-600">{error}</div>
                </div>
              </div>
            )}

            {!documentUrl && !error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">
                    No document loaded
                  </div>
                  <Button onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Document
                  </Button>
                </div>
              </div>
            )}

            {documentUrl && !error && (
              <div
                className="document-wrapper"
                style={{
                  minHeight: `${Math.max(100, pageHeight * scale + 80)}px`,
                  height: `${Math.max(100, pageHeight * scale + 80)}px`,
                  width: `${Math.max(
                    100,
                    currentView === "split"
                      ? pageWidth * scale * 2 + 100 // Double width for split view plus gap and padding
                      : pageWidth * scale + 80
                  )}px`,
                  minWidth: `${Math.max(
                    100,
                    currentView === "split"
                      ? pageWidth * scale * 2 + 100
                      : pageWidth * scale + 80
                  )}px`,
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
                  className={`relative bg-white document-page ${
                    isScaleChanging ? "" : "zoom-transition"
                  } ${isAddTextBoxMode ? "add-text-box-mode" : ""} ${
                    isTextSelectionMode ? "text-selection-mode" : ""
                  } ${isAddTextBoxMode ? "cursor-crosshair" : ""} ${
                    shapeDrawingMode ? "cursor-crosshair" : ""
                  } ${isCtrlPressed ? "cursor-zoom-in" : ""}`}
                  onClick={handleDocumentContainerClick}
                  onMouseDown={
                    isTextSelectionMode ? handleDocumentMouseDown : undefined
                  }
                  onMouseMove={
                    shapeDrawingMode
                      ? handleShapeDrawMove
                      : isTextSelectionMode
                      ? handleDocumentMouseMove
                      : undefined
                  }
                  onMouseUp={
                    shapeDrawingMode
                      ? handleShapeDrawEnd
                      : isTextSelectionMode
                      ? handleDocumentMouseUp
                      : undefined
                  }
                  style={{
                    width:
                      currentView === "split"
                        ? pageWidth * scale * 2 + 20 // Double width plus gap for split view
                        : pageWidth * scale,
                    height: pageHeight * scale,
                    minWidth:
                      currentView === "split"
                        ? pageWidth * scale * 2 + 20
                        : pageWidth * scale,
                    minHeight: pageHeight * scale,
                    display: "block",
                  }}
                >
                  {/* Document Rendering - Show different content based on view */}
                  {currentView === "original" && (
                    <>
                      {isPdfFile(documentUrl) ? (
                        <div className="relative">
                          <Document
                            file={documentUrl}
                            onLoadSuccess={handleDocumentLoadSuccess}
                            onLoadError={handleDocumentLoadError}
                            loading={
                              <div className="flex items-center justify-center p-8">
                                <div className="text-center">
                                  <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                  <div className="text-gray-600">
                                    Loading PDF...
                                  </div>
                                </div>
                              </div>
                            }
                          >
                            <Page
                              pageNumber={currentPage}
                              onLoadSuccess={handlePageLoadSuccess}
                              onLoadError={handlePageLoadError}
                              onRenderSuccess={() => setIsPageLoading(false)}
                              onRenderError={handlePageLoadError}
                              renderTextLayer={isAddTextBoxMode && !isZooming}
                              renderAnnotationLayer={false}
                              loading={
                                <div
                                  className="flex items-center justify-center bg-gray-50"
                                  style={{
                                    width: pageWidth * scale,
                                    height: pageHeight * scale,
                                  }}
                                >
                                  <div className="text-center">
                                    <div className="w-6 h-6 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                                    <div className="text-gray-500 text-sm">
                                      Rendering page...
                                    </div>
                                  </div>
                                </div>
                              }
                              width={pageWidth * scale}
                            />
                          </Document>

                          {/* Loading overlay during scale changes */}
                          {isScaleChanging && (
                            <div
                              className="absolute inset-0 bg-gray-50 bg-opacity-50 flex items-center justify-center z-50"
                              style={{
                                width: pageWidth * scale,
                                height: pageHeight * scale,
                              }}
                            >
                              <div className="bg-white rounded-lg shadow-md p-3 flex items-center space-x-2">
                                <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-gray-600">
                                  Adjusting zoom...
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <img
                          src={documentUrl}
                          alt="Document"
                          onLoad={handleImageLoadSuccess}
                          onError={handleImageLoadError}
                          style={{
                            width: pageWidth * scale,
                            height: pageHeight * scale,
                            maxWidth: "none",
                            display: "block",
                          }}
                          className="select-none"
                        />
                      )}
                    </>
                  )}

                  {/* Translated Document View */}
                  {currentView === "translated" && (
                    <div className="relative">
                      {/* Blank document page */}
                      <div
                        className="bg-white border border-gray-200 shadow-sm"
                        style={{
                          width: pageWidth * scale,
                          height: pageHeight * scale,
                        }}
                      />

                      {/* Page number indicator */}
                      <div className="absolute bottom-4 right-4 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                        Page {currentPage} of {numPages}
                      </div>
                    </div>
                  )}

                  {/* Split Screen View */}
                  {currentView === "split" && (
                    <div
                      className="flex"
                      style={{
                        width: pageWidth * scale * 2 + 20, // Double width plus gap
                        height: pageHeight * scale,
                      }}
                    >
                      {/* Original Document Side */}
                      <div
                        className="relative bg-white border border-gray-200 shadow-sm"
                        style={{
                          width: pageWidth * scale,
                          height: pageHeight * scale,
                        }}
                      >
                        {/* Original Document Header */}
                        <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                          <div className="bg-blue-500 text-white px-3 py-1 rounded-t-lg text-sm font-medium">
                            Original Document
                          </div>
                        </div>

                        {/* Original Document Content */}
                        {isPdfFile(documentUrl) ? (
                          <div className="relative w-full h-full">
                            <Document
                              file={documentUrl}
                              onLoadSuccess={handleDocumentLoadSuccess}
                              onLoadError={handleDocumentLoadError}
                              loading={null}
                            >
                              <Page
                                pageNumber={currentPage}
                                onLoadSuccess={handlePageLoadSuccess}
                                onLoadError={handlePageLoadError}
                                onRenderSuccess={() => setIsPageLoading(false)}
                                onRenderError={handlePageLoadError}
                                renderTextLayer={isAddTextBoxMode && !isZooming}
                                renderAnnotationLayer={false}
                                loading={null}
                                width={pageWidth * scale}
                              />
                            </Document>
                          </div>
                        ) : (
                          <img
                            src={documentUrl}
                            alt="Original Document"
                            style={{
                              width: pageWidth * scale,
                              height: pageHeight * scale,
                              maxWidth: "none",
                              display: "block",
                            }}
                            className="select-none"
                          />
                        )}

                        {/* Original Document Elements */}
                        {/* Deletion Rectangles */}
                        {originalDeletionRectangles
                          .filter((rect) => rect.page === currentPage)
                          .map((rect) => (
                            <div
                              key={`orig-del-${rect.id}`}
                              className={`absolute ${
                                showDeletionRectangles
                                  ? "border border-red-400"
                                  : ""
                              }`}
                              style={{
                                left: rect.x * scale,
                                top: rect.y * scale,
                                width: rect.width * scale,
                                height: rect.height * scale,
                                zIndex: showDeletionRectangles ? 20 : 5,
                                backgroundColor: rect.background || "white",
                              }}
                            >
                              {showDeletionRectangles && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOriginalDeletionRectangles((prev) =>
                                      prev.filter((r) => r.id !== rect.id)
                                    );
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                                  title="Delete area"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}

                        {/* Original Shapes */}
                        {originalShapes
                          .filter((shape) => shape.page === currentPage)
                          .map((shape) => (
                            <MemoizedShape
                              key={`orig-shape-${shape.id}`}
                              shape={shape}
                              isSelected={selectedShapeId === shape.id}
                              isEditMode={isEditMode}
                              scale={scale}
                              onSelect={handleShapeSelect}
                              onUpdate={(id, updates) => {
                                setOriginalShapes((prev) =>
                                  prev.map((s) =>
                                    s.id === id ? { ...s, ...updates } : s
                                  )
                                );
                              }}
                              onDelete={(id) => {
                                setOriginalShapes((prev) =>
                                  prev.filter((s) => s.id !== id)
                                );
                                if (selectedShapeId === id) {
                                  setSelectedShapeId(null);
                                }
                              }}
                            />
                          ))}

                        {/* Original Text Boxes */}
                        {originalTextBoxes
                          .filter((box) => box.page === currentPage)
                          .map((textBox) => (
                            <MemoizedTextBox
                              key={`orig-text-${textBox.id}`}
                              textBox={textBox}
                              isSelected={selectedFieldId === textBox.id}
                              isEditMode={isEditMode}
                              scale={scale}
                              showPaddingIndicator={showPaddingPopup}
                              onSelect={handleTextBoxSelect}
                              onUpdate={(id, updates) => {
                                setOriginalTextBoxes((prev) =>
                                  prev.map((box) =>
                                    box.id === id ? { ...box, ...updates } : box
                                  )
                                );
                              }}
                              onDelete={(id) => {
                                setOriginalTextBoxes((prev) =>
                                  prev.filter((box) => box.id !== id)
                                );
                                setSelectedFieldId((current) =>
                                  current === id ? null : current
                                );
                              }}
                              isTextSelectionMode={isTextSelectionMode}
                              isSelectedInTextMode={selectedTextBoxes.textBoxIds.includes(
                                textBox.id
                              )}
                              onTextSelectionClick={handleTextBoxSelectionMode}
                            />
                          ))}
                      </div>

                      {/* Gap between documents */}
                      <div className="w-5 flex items-center justify-center">
                        <div className="w-px h-full bg-gray-300"></div>
                      </div>

                      {/* Translated Document Side */}
                      <div
                        className="relative bg-white border border-gray-200 shadow-sm"
                        style={{
                          width: pageWidth * scale,
                          height: pageHeight * scale,
                        }}
                      >
                        {/* Translated Document Header */}
                        <div className="absolute -top-8 left-0 right-0 flex items-center justify-center">
                          <div className="bg-green-500 text-white px-3 py-1 rounded-t-lg text-sm font-medium">
                            Translated Document
                          </div>
                        </div>

                        {/* Blank translated document background */}
                        <div className="w-full h-full bg-white">
                          {/* Page number indicator */}
                          <div className="absolute bottom-4 right-4 bg-gray-100 text-gray-600 px-2 py-1 rounded text-xs">
                            Page {currentPage} of {numPages}
                          </div>
                        </div>

                        {/* Translated Document Elements */}
                        {/* Deletion Rectangles */}
                        {translatedDeletionRectangles
                          .filter((rect) => rect.page === currentPage)
                          .map((rect) => (
                            <div
                              key={`trans-del-${rect.id}`}
                              className={`absolute ${
                                showDeletionRectangles
                                  ? "border border-red-400"
                                  : ""
                              }`}
                              style={{
                                left: rect.x * scale,
                                top: rect.y * scale,
                                width: rect.width * scale,
                                height: rect.height * scale,
                                zIndex: showDeletionRectangles ? 20 : 5,
                                backgroundColor: rect.background || "white",
                              }}
                            >
                              {showDeletionRectangles && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setTranslatedDeletionRectangles((prev) =>
                                      prev.filter((r) => r.id !== rect.id)
                                    );
                                  }}
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                                  title="Delete area"
                                >
                                  ×
                                </button>
                              )}
                            </div>
                          ))}

                        {/* Translated Shapes */}
                        {translatedShapes
                          .filter((shape) => shape.page === currentPage)
                          .map((shape) => (
                            <MemoizedShape
                              key={`trans-shape-${shape.id}`}
                              shape={shape}
                              isSelected={selectedShapeId === shape.id}
                              isEditMode={isEditMode}
                              scale={scale}
                              onSelect={handleShapeSelect}
                              onUpdate={(id, updates) => {
                                setTranslatedShapes((prev) =>
                                  prev.map((s) =>
                                    s.id === id ? { ...s, ...updates } : s
                                  )
                                );
                              }}
                              onDelete={(id) => {
                                setTranslatedShapes((prev) =>
                                  prev.filter((s) => s.id !== id)
                                );
                                if (selectedShapeId === id) {
                                  setSelectedShapeId(null);
                                }
                              }}
                            />
                          ))}

                        {/* Translated Text Boxes */}
                        {translatedTextBoxes
                          .filter((box) => box.page === currentPage)
                          .map((textBox) => (
                            <MemoizedTextBox
                              key={`trans-text-${textBox.id}`}
                              textBox={textBox}
                              isSelected={selectedFieldId === textBox.id}
                              isEditMode={isEditMode}
                              scale={scale}
                              showPaddingIndicator={showPaddingPopup}
                              onSelect={handleTextBoxSelect}
                              onUpdate={(id, updates) => {
                                setTranslatedTextBoxes((prev) =>
                                  prev.map((box) =>
                                    box.id === id ? { ...box, ...updates } : box
                                  )
                                );
                              }}
                              onDelete={(id) => {
                                setTranslatedTextBoxes((prev) =>
                                  prev.filter((box) => box.id !== id)
                                );
                                setSelectedFieldId((current) =>
                                  current === id ? null : current
                                );
                              }}
                              isTextSelectionMode={isTextSelectionMode}
                              isSelectedInTextMode={selectedTextBoxes.textBoxIds.includes(
                                textBox.id
                              )}
                              onTextSelectionClick={handleTextBoxSelectionMode}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Show interactive elements in both original and translated views */}
                  {(currentView === "original" ||
                    currentView === "translated") && (
                    <>
                      {/* Deletion Rectangles */}
                      {getCurrentPageDeletionRectangles.map((rect) => (
                        <div
                          key={rect.id}
                          className={`absolute ${
                            showDeletionRectangles
                              ? "border border-red-400"
                              : ""
                          }`}
                          style={{
                            left: rect.x * scale,
                            top: rect.y * scale,
                            width: rect.width * scale,
                            height: rect.height * scale,
                            zIndex: showDeletionRectangles ? 20 : 5,
                            backgroundColor: rect.background || "white",
                          }}
                        >
                          {showDeletionRectangles && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteDeletionRectangle(rect.id);
                              }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                              title="Delete area"
                            >
                              ×
                            </button>
                          )}
                        </div>
                      ))}

                      {/* Shapes */}
                      {getCurrentPageShapes.map((shape) => (
                        <MemoizedShape
                          key={shape.id}
                          shape={shape}
                          isSelected={selectedShapeId === shape.id}
                          isEditMode={isEditMode}
                          scale={scale}
                          onSelect={handleShapeSelect}
                          onUpdate={updateShapeCallback}
                          onDelete={deleteShapeCallback}
                        />
                      ))}

                      {/* Text Boxes */}
                      {getCurrentPageTextBoxes.map((textBox) => (
                        <MemoizedTextBox
                          key={textBox.id}
                          textBox={textBox}
                          isSelected={selectedFieldId === textBox.id}
                          isEditMode={isEditMode}
                          scale={scale}
                          showPaddingIndicator={showPaddingPopup}
                          onSelect={handleTextBoxSelect}
                          onUpdate={updateTextBox}
                          onDelete={deleteTextBox}
                          isTextSelectionMode={isTextSelectionMode}
                          isSelectedInTextMode={selectedTextBoxes.textBoxIds.includes(
                            textBox.id
                          )}
                          onTextSelectionClick={handleTextBoxSelectionMode}
                        />
                      ))}

                      {/* Multi-Selection Overlay - Show in Text Selection mode */}
                      {isTextSelectionMode && selectedTextBoxes.bounds && (
                        <div
                          className="absolute border-2 border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none"
                          style={{
                            left: selectedTextBoxes.bounds.x * scale,
                            top: selectedTextBoxes.bounds.y * scale,
                            width: selectedTextBoxes.bounds.width * scale,
                            height: selectedTextBoxes.bounds.height * scale,
                            zIndex: 40,
                            borderRadius: "4px",
                          }}
                        >
                          {/* Selection info */}
                          <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-md">
                            {selectedTextBoxes.textBoxIds.length} selected
                          </div>

                          {/* Move handle - center of selection */}
                          <div
                            className="absolute w-4 h-4 bg-blue-500 rounded-full cursor-move shadow-md border-2 border-white pointer-events-auto"
                            style={{
                              left: "50%",
                              top: "50%",
                              transform: "translate(-50%, -50%)",
                              zIndex: 50,
                            }}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();

                              const startX = e.clientX;
                              const startY = e.clientY;

                              const handleMouseMove = (
                                moveEvent: MouseEvent
                              ) => {
                                const deltaX =
                                  (moveEvent.clientX - startX) / scale;
                                const deltaY =
                                  (moveEvent.clientY - startY) / scale;
                                handleMoveSelectedTextBoxes(deltaX, deltaY);
                              };

                              const handleMouseUp = () => {
                                document.removeEventListener(
                                  "mousemove",
                                  handleMouseMove
                                );
                                document.removeEventListener(
                                  "mouseup",
                                  handleMouseUp
                                );
                              };

                              document.addEventListener(
                                "mousemove",
                                handleMouseMove
                              );
                              document.addEventListener(
                                "mouseup",
                                handleMouseUp
                              );
                            }}
                            title="Drag to move selected textboxes"
                          />
                        </div>
                      )}

                      {/* Selection Rectangle - Show during drag-to-select */}
                      {isTextSelectionMode &&
                        isDrawingSelection &&
                        selectionRect && (
                          <div
                            className="fixed border-2 border-dashed border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none z-50"
                            style={{
                              left: selectionRect.left,
                              top: selectionRect.top,
                              width: selectionRect.width,
                              height: selectionRect.height,
                              borderRadius: "2px",
                            }}
                          >
                            {/* Selection info */}
                            <div className="absolute -top-6 left-0 bg-blue-500 text-white text-xs px-2 py-1 rounded shadow-md">
                              Selecting textboxes...
                            </div>
                          </div>
                        )}

                      {/* Shape Drawing Preview */}
                      {isDrawingInProgress &&
                        shapeDrawStart &&
                        shapeDrawEnd && (
                          <div
                            className="absolute border-2 border-dashed border-red-500 bg-red-100 bg-opacity-30 pointer-events-none"
                            style={{
                              left:
                                Math.min(shapeDrawStart.x, shapeDrawEnd.x) *
                                scale,
                              top:
                                Math.min(shapeDrawStart.y, shapeDrawEnd.y) *
                                scale,
                              width:
                                Math.abs(shapeDrawEnd.x - shapeDrawStart.x) *
                                scale,
                              height:
                                Math.abs(shapeDrawEnd.y - shapeDrawStart.y) *
                                scale,
                              borderRadius:
                                shapeDrawingMode === "circle" ? "50%" : "0",
                              zIndex: 50,
                            }}
                          />
                        )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Text Selection Popup - Removed for new approach */}
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            {currentView === "split" ? (
              <>
                <span className="flex items-center space-x-2">
                  <span className="text-blue-600 font-medium">Original:</span>
                  <span>
                    {
                      originalTextBoxes.filter(
                        (box) => box.page === currentPage
                      ).length
                    }{" "}
                    text
                  </span>
                  <span>
                    {
                      originalShapes.filter(
                        (shape) => shape.page === currentPage
                      ).length
                    }{" "}
                    shapes
                  </span>
                  <span>
                    {
                      originalDeletionRectangles.filter(
                        (rect) => rect.page === currentPage
                      ).length
                    }{" "}
                    deletions
                  </span>
                </span>
                <span className="text-gray-400">|</span>
                <span className="flex items-center space-x-2">
                  <span className="text-green-600 font-medium">
                    Translated:
                  </span>
                  <span>
                    {
                      translatedTextBoxes.filter(
                        (box) => box.page === currentPage
                      ).length
                    }{" "}
                    text
                  </span>
                  <span>
                    {
                      translatedShapes.filter(
                        (shape) => shape.page === currentPage
                      ).length
                    }{" "}
                    shapes
                  </span>
                  <span>
                    {
                      translatedDeletionRectangles.filter(
                        (rect) => rect.page === currentPage
                      ).length
                    }{" "}
                    deletions
                  </span>
                </span>
              </>
            ) : (
              <>
                <span>Text Boxes: {getCurrentPageTextBoxes.length}</span>
                <span>Shapes: {getCurrentPageShapes.length}</span>
                <span>
                  Deletion Areas: {getCurrentPageDeletionRectangles.length}
                </span>
              </>
            )}
            {/* Current View Indicator */}
            <span className="flex items-center space-x-1">
              <span>View:</span>
              <span className="font-medium text-red-600 capitalize">
                {currentView === "original"
                  ? "Original"
                  : currentView === "translated"
                  ? "Translated"
                  : "Split Screen"}
              </span>
            </span>
          </div>
          <div className="flex items-center space-x-4">
            {documentUrl && (
              <span>
                Page {currentPage} of {numPages} ({numPages - deletedPages.size}{" "}
                available)
              </span>
            )}
            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setIsScaleChanging(true);
                  setTransformOrigin("center center");
                  setScale(Math.max(0.1, scale - 0.1));
                  setZoomMode("page");
                  resetScaleChanging();
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Zoom out (Ctrl+-)"
              >
                <ZoomOut className="w-3 h-3" />
              </button>

              <div className="flex items-center space-x-2">
                <input
                  type="range"
                  min="10"
                  max="500"
                  step="10"
                  value={Math.round(scale * 100)}
                  onChange={(e) => {
                    const newScale = parseInt(e.target.value) / 100;
                    setIsScaleChanging(true);
                    setTransformOrigin("center center");
                    setScale(newScale);
                    setZoomMode("page");
                    resetScaleChanging();
                  }}
                  className="zoom-slider w-20 h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                  title="Zoom level"
                  style={
                    {
                      "--value": `${
                        ((Math.round(scale * 100) - 10) / (500 - 10)) * 100
                      }%`,
                    } as React.CSSProperties
                  }
                />
                <button
                  onClick={() => {
                    setIsScaleChanging(true);
                    setScale(1.0);
                    setZoomMode("page");
                    setTransformOrigin("center center");
                    resetScaleChanging();
                  }}
                  className="text-xs px-2 py-1 hover:bg-gray-100 rounded transition-colors min-w-[40px] text-center"
                  title="Reset zoom to 100% (Ctrl+0)"
                >
                  {Math.round(scale * 100)}%
                </button>
              </div>

              <button
                onClick={() => {
                  setIsScaleChanging(true);
                  setTransformOrigin("center center");
                  setScale(Math.min(5.0, scale + 0.1));
                  setZoomMode("page");
                  resetScaleChanging();
                }}
                className="p-1 hover:bg-gray-100 rounded transition-colors"
                title="Zoom in (Ctrl++)"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSS Styles */}
      <style jsx>{`
        /* Default text layer styling - matches DocumentCanvas approach */
        .react-pdf__Page__textContent {
          padding: 0 !important;
          box-sizing: border-box !important;
        }

        /* Text spans positioning */
        .react-pdf__Page__textContent span {
          position: absolute !important;
          white-space: nowrap !important;
          color: transparent !important;
          line-height: 1 !important;
          pointer-events: none !important;
          transform-origin: 0% 0% !important;
        }

        /* Enable pointer events and styling only in add text box mode */
        .add-text-box-mode .react-pdf__Page__textContent {
          pointer-events: auto !important;
          z-index: 50 !important;
        }

        .add-text-box-mode .react-pdf__Page__textContent span {
          cursor: pointer !important;
          color: rgba(0, 0, 0, 0.1) !important;
          background-color: rgba(34, 197, 94, 0.2) !important;
          transition: background-color 0.2s !important;
          pointer-events: auto !important;
          border-radius: 2px !important;
        }

        .add-text-box-mode .react-pdf__Page__textContent span:hover {
          background-color: rgba(34, 197, 94, 0.4) !important;
          color: rgba(0, 0, 0, 0.3) !important;
        }

        /* Keep text selection mode styles for text selection functionality */
        .text-selection-mode .react-pdf__Page__textContent {
          pointer-events: auto !important;
          z-index: 50 !important;
        }

        .text-selection-mode .react-pdf__Page__textContent span {
          cursor: pointer !important;
          color: rgba(0, 0, 0, 0.1) !important;
          background-color: rgba(59, 130, 246, 0.2) !important;
          transition: all 0.2s ease !important;
          pointer-events: auto !important;
          border-radius: 2px !important;
          border: 1px solid transparent !important;
          box-sizing: border-box !important;
        }

        .text-selection-mode .react-pdf__Page__textContent span:hover {
          background-color: rgba(59, 130, 246, 0.4) !important;
          color: rgba(0, 0, 0, 0.3) !important;
          border: 1px solid rgba(59, 130, 246, 0.8) !important;
          box-shadow: 0 0 3px rgba(59, 130, 246, 0.5) !important;
        }

        /* Highlighted text selection */
        .text-selection-mode .react-pdf__Page__textContent span.selected {
          background-color: rgba(59, 130, 246, 0.6) !important;
          color: rgba(0, 0, 0, 0.8) !important;
          border: 1px solid rgba(59, 130, 246, 1) !important;
          box-shadow: 0 0 5px rgba(59, 130, 246, 0.7) !important;
        }

        /* Prevent text selection during drag */
        .text-selection-mode {
          user-select: none;
          -webkit-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
        }

        /* Selection rectangle animation */
        .selection-rectangle {
          animation: selectionPulse 0.5s ease-in-out infinite alternate;
        }

        @keyframes selectionPulse {
          from {
            border-color: rgba(59, 130, 246, 0.8);
            background-color: rgba(59, 130, 246, 0.1);
          }
          to {
            border-color: rgba(59, 130, 246, 1);
            background-color: rgba(59, 130, 246, 0.2);
          }
        }

        /* Zoom cursor */
        .cursor-zoom-in {
          cursor: zoom-in !important;
        }

        /* Override other cursors when zoom mode is active */
        .cursor-zoom-in * {
          cursor: zoom-in !important;
        }

        /* Smooth zoom transitions */
        .zoom-transition {
          transition: transform 0.1s ease-out, transform-origin 0.05s ease-out;
        }

        /* Prevent flash during scale changes */
        .document-page {
          transition: width 0.05s ease-out, height 0.05s ease-out;
        }

        /* Smooth loading overlay */
        .document-page .loading-overlay {
          backdrop-filter: blur(1px);
          transition: opacity 0.1s ease-out;
        }

        /* Custom Word-like scrollbars */
        .document-viewer {
          scrollbar-width: thin;
          scrollbar-color: #c1c1c1 #f1f1f1;
        }

        .document-viewer::-webkit-scrollbar {
          width: 17px;
          height: 17px;
        }

        .document-viewer::-webkit-scrollbar-track {
          background: #f1f1f1;
          border-radius: 0;
          border: 1px solid #e5e5e5;
        }

        .document-viewer::-webkit-scrollbar-thumb {
          background: #c1c1c1;
          border-radius: 0;
          border: 1px solid #a8a8a8;
          background-clip: padding-box;
        }

        .document-viewer::-webkit-scrollbar-thumb:hover {
          background: #a8a8a8;
          border-color: #909090;
        }

        .document-viewer::-webkit-scrollbar-thumb:active {
          background: #909090;
          border-color: #7a7a7a;
        }

        .document-viewer::-webkit-scrollbar-corner {
          background: #f1f1f1;
          border: 1px solid #e5e5e5;
        }

        /* Horizontal scrollbar specific styling */
        .document-viewer::-webkit-scrollbar:horizontal {
          height: 17px;
        }

        .document-viewer::-webkit-scrollbar-track:horizontal {
          background: #f1f1f1;
          border-top: 1px solid #e5e5e5;
          border-bottom: 1px solid #e5e5e5;
        }

        .document-viewer::-webkit-scrollbar-thumb:horizontal {
          background: #c1c1c1;
          border-top: 1px solid #a8a8a8;
          border-bottom: 1px solid #a8a8a8;
          min-width: 30px;
        }

        .document-viewer::-webkit-scrollbar-thumb:horizontal:hover {
          background: #a8a8a8;
        }

        .document-viewer::-webkit-scrollbar-thumb:horizontal:active {
          background: #909090;
        }

        /* Document container styling for better visual feedback */
        .document-container {
          background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
          position: relative;
        }

        .document-container::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: radial-gradient(
              circle at 20% 20%,
              rgba(59, 130, 246, 0.05) 0%,
              transparent 50%
            ),
            radial-gradient(
              circle at 80% 80%,
              rgba(139, 92, 246, 0.05) 0%,
              transparent 50%
            );
          pointer-events: none;
          z-index: 1;
        }

        .document-wrapper {
          position: relative;
          z-index: 2;
        }

        /* Smooth scrolling enhancement */
        .document-viewer {
          scroll-behavior: smooth;
        }

        /* Page shadow enhancement */
        .document-page {
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1),
            0 2px 4px -1px rgba(0, 0, 0, 0.06), 0 0 0 1px rgba(0, 0, 0, 0.05);
          transition: box-shadow 0.2s ease;
        }

        .document-page:hover {
          box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1),
            0 4px 6px -2px rgba(0, 0, 0, 0.05), 0 0 0 1px rgba(0, 0, 0, 0.05);
        }

        .rnd .react-resizable-handle-se {
          background: none !important;
          border: none !important;
          width: 12px !important;
          height: 12px !important;
          bottom: 0 !important;
          right: 0 !important;
        }

        .rnd .react-resizable-handle-se::after {
          content: "";
          position: absolute;
          bottom: 2px;
          right: 2px;
          width: 8px;
          height: 8px;
          background-image: linear-gradient(
              45deg,
              transparent 40%,
              #666 40%,
              #666 60%,
              transparent 60%
            ),
            linear-gradient(
              45deg,
              transparent 40%,
              #666 40%,
              #666 60%,
              transparent 60%
            );
          background-size: 4px 1px, 1px 4px;
          background-position: 2px 6px, 6px 2px;
          background-repeat: no-repeat;
          opacity: 0.6;
          transition: opacity 0.2s;
        }

        .rnd:hover .react-resizable-handle-se::after {
          opacity: 1;
        }

        .rnd .react-resizable-handle:not(.react-resizable-handle-se) {
          display: none !important;
        }

        /* Floating toolbar styling */
        .floating-toolbar {
          backdrop-filter: blur(10px);
        }

        .floating-toolbar .bg-white {
          background: rgba(255, 255, 255, 0.95);
          backdrop-filter: blur(10px);
        }

        .floating-toolbar button {
          position: relative;
          overflow: hidden;
        }

        .floating-toolbar button::before {
          content: "";
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          background: rgba(59, 130, 246, 0.1);
          border-radius: 50%;
          transition: all 0.3s ease;
          transform: translate(-50%, -50%);
        }

        .floating-toolbar button:hover::before {
          width: 100%;
          height: 100%;
        }

        /* Google Docs-like zoom slider */
        .zoom-slider {
          -webkit-appearance: none;
          appearance: none;
          background: #e5e7eb;
          outline: none;
          border-radius: 2px;
          height: 3px;
        }

        .zoom-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .zoom-slider::-webkit-slider-thumb:hover {
          background: #4338ca;
          transform: scale(1.1);
        }

        .zoom-slider::-webkit-slider-thumb:active {
          background: #3730a3;
          transform: scale(0.95);
        }

        .zoom-slider::-moz-range-thumb {
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #4f46e5;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
          transition: all 0.2s ease;
        }

        .zoom-slider::-moz-range-thumb:hover {
          background: #4338ca;
          transform: scale(1.1);
        }

        .zoom-slider::-moz-range-thumb:active {
          background: #3730a3;
          transform: scale(0.95);
        }

        .zoom-slider::-moz-range-track {
          background: #e5e7eb;
          height: 3px;
          border-radius: 2px;
        }

        /* Zoom slider track fill effect */
        .zoom-slider {
          background: linear-gradient(
            to right,
            #4f46e5 0%,
            #4f46e5 var(--value, 20%),
            #e5e7eb var(--value, 20%),
            #e5e7eb 100%
          );
        }

        /* Deletion rectangle styles */
        .deletion-rectangle {
          pointer-events: none;
          user-select: none;
        }

        /* Resize handle styles */
        .resize-handle {
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease,
            background-color 0.2s ease;
          z-index: 100;
        }

        .rnd:hover .resize-handle,
        .rnd.selected .resize-handle {
          opacity: 1;
        }

        .resize-handle:hover {
          transform: scale(1.2);
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        /* Blue handles for text boxes */
        .rnd .resize-handle:hover {
          background-color: #2563eb !important;
        }

        /* Red handles for shapes */
        .rnd .resize-handle[style*="#ef4444"]:hover {
          background-color: #dc2626 !important;
        }

        .resize-handle-corner {
          border: 1px solid #ffffff;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        .resize-handle-top,
        .resize-handle-bottom,
        .resize-handle-left,
        .resize-handle-right {
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
        }

        /* Hide resize handles when not in edit mode */
        .rnd:not(.edit-mode) .resize-handle {
          display: none !important;
        }
      `}</style>
    </div>
  );
};

const PDFEditor: React.FC = () => {
  return (
    <TextFormatProvider>
      <PDFEditorContent />
    </TextFormatProvider>
  );
};

export default PDFEditor;
