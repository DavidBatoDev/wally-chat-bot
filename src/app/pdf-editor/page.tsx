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
  Eraser,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  TextFormatProvider,
  useTextFormat,
} from "@/components/editor/ElementFormatContext";
import { ElementFormatDrawer } from "@/components/editor/ElementFormatDrawer";
import { TextField } from "@/components/types";
import type { Image } from "@/components/types";

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
  const height = fontSize * 1.1; // Reduced line height for more compact text

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

// Function to convert any color format to rgba with opacity
const colorToRgba = (color: string, opacity: number): string => {
  // Handle hex colors
  if (color.startsWith("#")) {
    return hexToRgba(color, opacity);
  }

  // Handle rgb colors
  if (color.startsWith("rgb(")) {
    const rgbMatch = color.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/);
    if (rgbMatch) {
      const r = parseInt(rgbMatch[1]);
      const g = parseInt(rgbMatch[2]);
      const b = parseInt(rgbMatch[3]);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  // Handle rgba colors
  if (color.startsWith("rgba(")) {
    const rgbaMatch = color.match(
      /rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)/
    );
    if (rgbaMatch) {
      const r = parseInt(rgbaMatch[1]);
      const g = parseInt(rgbaMatch[2]);
      const b = parseInt(rgbaMatch[3]);
      return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
  }

  // Fallback to black
  return `rgba(0, 0, 0, ${opacity})`;
};

// Function to convert rgb string to hex
function rgbStringToHex(rgb: string): string {
  const result = rgb.match(/\d+/g);
  if (!result || result.length < 3) return "#000000";
  return (
    "#" +
    (
      (1 << 24) +
      (parseInt(result[0]) << 16) +
      (parseInt(result[1]) << 8) +
      parseInt(result[2])
    )
      .toString(16)
      .slice(1)
  );
}

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
  borderRadius?: number; // Add border radius support
}

interface DeletionRectangle {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  background?: string; // Add this for background color
  opacity?: number; // Add opacity control
  borderColor?: string; // Add border color for erasure tool
  borderWidth?: number; // Add border width for erasure tool
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
        enableResizing={false}
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
        style={{ transform: "none" }}
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

          {/* Resize handle - only show when selected and in edit mode and NOT in text selection mode */}
          {isEditMode && isSelected && !isTextSelectionMode && (
            <div
              className="absolute bottom-0 right-0 w-4 h-4 bg-gray-600 border-2 border-white rounded-full shadow-lg cursor-se-resize transform translate-x-1 translate-y-1 z-30 flex items-center justify-center hover:scale-110 transition-transform duration-200"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, transparent 30%, white 30%, white 40%, transparent 40%),
                  linear-gradient(45deg, transparent 60%, white 60%, white 70%, transparent 70%)
                `,
                backgroundSize: "8px 8px",
                backgroundRepeat: "no-repeat",
              }}
              onMouseDown={(e) => {
                e.stopPropagation();
                const startX = e.clientX;
                const startY = e.clientY;
                const startWidth = textBox.width * scale;
                const startHeight = textBox.height * scale;

                const handleMouseMove = (moveEvent: MouseEvent) => {
                  const deltaX = moveEvent.clientX - startX;
                  const deltaY = moveEvent.clientY - startY;
                  const newWidth = Math.max(50, startWidth + deltaX) / scale;
                  const newHeight = Math.max(20, startHeight + deltaY) / scale;

                  onUpdate(textBox.id, {
                    width: newWidth,
                    height: newHeight,
                  });
                };

                const handleMouseUp = () => {
                  document.removeEventListener("mousemove", handleMouseMove);
                  document.removeEventListener("mouseup", handleMouseUp);
                };

                document.addEventListener("mousemove", handleMouseMove);
                document.addEventListener("mouseup", handleMouseUp);
              }}
            />
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
                lineHeight: textBox.lineHeight || 1.1, // Reduced line height
                backgroundColor: isSelected
                  ? "rgba(107, 114, 128, 0.1)"
                  : textBox.backgroundColor || "transparent",
                border: textBox.borderWidth
                  ? `${textBox.borderWidth * scale}px solid ${
                      textBox.borderColor || "#000000"
                    }`
                  : "none",
                borderRadius:
                  textBox.borderTopLeftRadius !== undefined ||
                  textBox.borderTopRightRadius !== undefined ||
                  textBox.borderBottomLeftRadius !== undefined ||
                  textBox.borderBottomRightRadius !== undefined
                    ? `${(textBox.borderTopLeftRadius || 0) * scale}px ${
                        (textBox.borderTopRightRadius || 0) * scale
                      }px ${(textBox.borderBottomRightRadius || 0) * scale}px ${
                        (textBox.borderBottomLeftRadius || 0) * scale
                      }px`
                    : `${(textBox.borderRadius || 0) * scale}px`,
                padding: "0px",
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
        onDragStop={(e, d) => {
          onUpdate(shape.id, {
            x: d.x / scale,
            y: d.y / scale,
            type: shape.type,
          });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(shape.id, {
            x: position.x / scale,
            y: position.y / scale,
            width: parseInt(ref.style.width) / scale,
            height: parseInt(ref.style.height) / scale,
            type: shape.type,
          });
        }}
        className={`shape-element ${
          isSelected ? "ring-2 ring-gray-500 selected" : ""
        } ${isEditMode ? "edit-mode" : ""}`}
        style={{
          transform: "none",
        }}
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
              borderRadius:
                shape.type === "circle"
                  ? "50%"
                  : shape.borderRadius !== undefined
                  ? `${shape.borderRadius * scale}px`
                  : "0",
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
            </>
          )}
        </div>
      </Rnd>
    );
  }
);

MemoizedShape.displayName = "MemoizedShape";

// Memoized Image component to prevent unnecessary re-renders
const MemoizedImage = memo(
  ({
    image,
    isSelected,
    isEditMode,
    scale,
    onSelect,
    onUpdate,
    onDelete,
  }: {
    image: Image;
    isSelected: boolean;
    isEditMode: boolean;
    scale: number;
    onSelect: (id: string) => void;
    onUpdate: (id: string, updates: Partial<Image>) => void;
    onDelete: (id: string) => void;
  }) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(image.id);
      },
      [image.id, onSelect]
    );

    return (
      <Rnd
        key={image.id}
        position={{ x: image.x * scale, y: image.y * scale }}
        size={{ width: image.width * scale, height: image.height * scale }}
        bounds="parent"
        dragHandleClassName="drag-handle"
        disableDragging={!isEditMode}
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
        onDragStop={(e, d) => {
          onUpdate(image.id, { x: d.x / scale, y: d.y / scale });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(image.id, {
            x: position.x / scale,
            y: position.y / scale,
            width: parseInt(ref.style.width) / scale,
            height: parseInt(ref.style.height) / scale,
          });
        }}
        className={`image-element ${
          isSelected ? "ring-2 ring-blue-500 selected" : ""
        } ${isEditMode ? "edit-mode" : ""}`}
        style={{ transform: "none" }}
        onClick={handleClick}
      >
        <div className="w-full h-full relative group">
          {/* Delete button - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image.id);
              }}
              className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
              title="Delete image"
            >
              <Trash2 size={10} />
            </button>
          )}

          {/* Move handle - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
              <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                <Move size={10} />
              </div>
            </div>
          )}

          {/* Image content */}
          <div
            className="w-full h-full absolute"
            style={{
              transform: image.rotation
                ? `rotate(${image.rotation}deg)`
                : "none",
              transformOrigin: "center center",
            }}
          >
            <img
              src={image.src}
              alt="Document image"
              className="w-full h-full object-cover"
              style={{
                opacity: image.opacity || 1,
                border: image.borderWidth
                  ? `${image.borderWidth * scale}px solid ${
                      image.borderColor || "#000000"
                    }`
                  : "none",
                borderRadius: `${(image.borderRadius || 0) * scale}px`,
              }}
              draggable={false}
            />
          </div>
        </div>
      </Rnd>
    );
  }
);

MemoizedImage.displayName = "MemoizedImage";

const PDFEditorContent: React.FC = () => {
  const {
    isDrawerOpen,
    setIsDrawerOpen,
    selectedElementId,
    setSelectedElementId,
    selectedElementType,
    setSelectedElementType,
    currentFormat,
    setCurrentFormat,
    onFormatChange,
    setOnFormatChange,
    showPaddingPopup,
    setShowPaddingPopup,
    setLayerOrderFunctions,
    setLayerPositionHelpers,
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
  const [detectedPageBackgrounds, setDetectedPageBackgrounds] = useState<
    Map<number, string>
  >(new Map()); // Track detected backgrounds per page

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

  // Erasure tool state
  const [isErasureMode, setIsErasureMode] = useState<boolean>(false);
  const [isDrawingErasure, setIsDrawingErasure] = useState<boolean>(false);
  const [erasureDrawStart, setErasureDrawStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [erasureDrawEnd, setErasureDrawEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [erasureDrawTargetView, setErasureDrawTargetView] = useState<
    "original" | "translated" | null
  >(null);
  const [erasureSettings, setErasureSettings] = useState({
    width: 20,
    height: 20,
    background: "#ffffff",
    opacity: 1.0,
  });

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

  // Image state arrays for original and translated documents
  const [originalImages, setOriginalImages] = useState<Image[]>([]);
  const [translatedImages, setTranslatedImages] = useState<Image[]>([]);

  // Layer order arrays - determines rendering order (first = bottom, last = top)
  const [originalLayerOrder, setOriginalLayerOrder] = useState<string[]>([]);
  const [translatedLayerOrder, setTranslatedLayerOrder] = useState<string[]>(
    []
  );

  const [deletedPages, setDeletedPages] = useState<Set<number>>(new Set());

  // State for showing the transform button
  const [showTransformButton, setShowTransformButton] = useState(true);

  // Add new states for page translation tracking
  const [isPageTranslated, setIsPageTranslated] = useState<
    Map<number, boolean>
  >(new Map());
  const [isTransforming, setIsTransforming] = useState<boolean>(false);

  // Image upload state
  const [isImageUploadMode, setIsImageUploadMode] = useState<boolean>(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

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

  const getCurrentImages = () => {
    return currentView === "original" ? originalImages : translatedImages;
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

  const setCurrentImages = (updater: React.SetStateAction<Image[]>) => {
    if (currentView === "original") {
      setOriginalImages(updater);
    } else {
      setTranslatedImages(updater);
    }
  };

  // Helper functions for layer order management
  const getCurrentLayerOrder = () => {
    return currentView === "original"
      ? originalLayerOrder
      : translatedLayerOrder;
  };

  const setCurrentLayerOrder = (updater: React.SetStateAction<string[]>) => {
    if (currentView === "original") {
      setOriginalLayerOrder(updater);
    } else {
      setTranslatedLayerOrder(updater);
    }
  };

  // Add element to layer order
  const addToLayerOrder = (elementId: string) => {
    setCurrentLayerOrder((prev) => [...prev, elementId]);
  };

  // Remove element from layer order
  const removeFromLayerOrder = (elementId: string) => {
    setCurrentLayerOrder((prev) => prev.filter((id) => id !== elementId));
  };

  // Move element to front (end of array)
  const moveToFront = (elementId: string) => {
    setCurrentLayerOrder((prev) => {
      const filtered = prev.filter((id) => id !== elementId);
      return [...filtered, elementId];
    });
  };

  // Move element to back (beginning of array)
  const moveToBack = (elementId: string) => {
    setCurrentLayerOrder((prev) => {
      const filtered = prev.filter((id) => id !== elementId);
      return [elementId, ...filtered];
    });
  };

  // Move element forward by one position
  const moveForward = (elementId: string) => {
    setCurrentLayerOrder((prev) => {
      const index = prev.indexOf(elementId);
      if (index === -1 || index === prev.length - 1) return prev;

      const newOrder = [...prev];
      [newOrder[index], newOrder[index + 1]] = [
        newOrder[index + 1],
        newOrder[index],
      ];
      return newOrder;
    });
  };

  // Move element backward by one position
  const moveBackward = (elementId: string) => {
    setCurrentLayerOrder((prev) => {
      const index = prev.indexOf(elementId);
      if (index <= 0) return prev;

      const newOrder = [...prev];
      [newOrder[index], newOrder[index - 1]] = [
        newOrder[index - 1],
        newOrder[index],
      ];
      return newOrder;
    });
  };

  // Helper functions to check if element is at front or back
  const isElementAtFront = (elementId: string) => {
    const layerOrder = getCurrentLayerOrder();
    return (
      layerOrder.length > 0 && layerOrder[layerOrder.length - 1] === elementId
    );
  };

  const isElementAtBack = (elementId: string) => {
    const layerOrder = getCurrentLayerOrder();
    return layerOrder.length > 0 && layerOrder[0] === elementId;
  };

  // Get sorted elements based on layer order
  const getSortedElements = () => {
    const layerOrder = getCurrentLayerOrder();
    const textBoxes = getCurrentTextBoxes().filter(
      (box) => box.page === currentPage
    );
    const shapes = getCurrentShapes().filter(
      (shape) => shape.page === currentPage
    );
    const images = getCurrentImages().filter(
      (image) => image.page === currentPage
    );

    // Create a map of all elements
    const elementMap = new Map<
      string,
      {
        type: "textbox" | "shape" | "image";
        element: TextField | Shape | Image;
      }
    >();
    textBoxes.forEach((box) =>
      elementMap.set(box.id, { type: "textbox", element: box })
    );
    shapes.forEach((shape) =>
      elementMap.set(shape.id, { type: "shape", element: shape })
    );
    images.forEach((image) =>
      elementMap.set(image.id, { type: "image", element: image })
    );

    // Sort elements based on layer order
    const sortedElements: Array<{
      type: "textbox" | "shape" | "image";
      element: TextField | Shape | Image;
    }> = [];

    // Add elements in layer order
    layerOrder.forEach((id) => {
      const element = elementMap.get(id);
      if (element) {
        sortedElements.push(element);
        elementMap.delete(id);
      }
    });

    // Add any remaining elements (newly created ones not in layer order yet)
    elementMap.forEach((element) => {
      sortedElements.push(element);
    });

    return sortedElements;
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

  // Erasure drawing state refs for immediate access
  const isDrawingErasureRef = useRef<boolean>(false);
  const erasureDrawStartRef = useRef<{ x: number; y: number } | null>(null);
  const erasureDrawEndRef = useRef<{ x: number; y: number } | null>(null);
  const erasureDrawTargetViewRef = useRef<"original" | "translated" | null>(
    null
  );

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

      // Clean up erasure drawing state - only if not in erasure mode (fallback cleanup)
      if (isDrawingErasure && !isErasureMode) {
        console.log(
          "Global mouse up - cleaning up erasure state (not in erasure mode)"
        );
        setIsDrawingErasure(false);
        setErasureDrawStart(null);
        setErasureDrawEnd(null);
        setErasureDrawTargetView(null);
      } else if (isDrawingErasure && isErasureMode) {
        console.log("Global mouse up - erasure mode active, not interfering");
        // Don't interfere with erasure mode - let the document handler deal with it
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

  // Track scale changes to trigger loading state and update background color when changing pages
  useEffect(() => {
    setIsPageLoading(true);

    // Update background color when changing pages if already detected
    if (detectedPageBackgrounds.has(currentPage)) {
      const pageBgColor = detectedPageBackgrounds.get(currentPage);
      if (pageBgColor) {
        setPdfBackgroundColor(pageBgColor);
        console.log(
          `Switched to page ${currentPage} background color:`,
          pageBgColor
        );
      }
    }
  }, [scale, currentPage, detectedPageBackgrounds]);

  // Capture background color only once per page when page loads
  useEffect(() => {
    if (
      isDocumentLoaded &&
      !isPageLoading &&
      !detectedPageBackgrounds.has(currentPage)
    ) {
      setTimeout(() => {
        capturePdfBackgroundColor();
      }, 200);
    }
  }, [isDocumentLoaded, isPageLoading, currentPage, detectedPageBackgrounds]);

  // Clear textboxes for untranslated pages when switching pages
  useEffect(() => {
    if (!isPageTranslated.get(currentPage)) {
      // Remove textboxes for the current page if it's not translated
      setTranslatedTextBoxes((prev) =>
        prev.filter((box) => box.page !== currentPage)
      );
    }
  }, [currentPage, isPageTranslated]);

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

    // Capture PDF background color for this page if not already detected
    if (!detectedPageBackgrounds.has(currentPage)) {
      setTimeout(() => {
        capturePdfBackgroundColor();
      }, 100);
    }
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

  // Capture PDF background color from the first pixel and store it per page
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

          // Store the background color for this specific page
          setDetectedPageBackgrounds((prev) => {
            const newMap = new Map(prev);
            newMap.set(currentPage, bgColor);
            return newMap;
          });

          // Update the current PDF background color
          setPdfBackgroundColor(bgColor);

          console.log(
            `PDF background color captured for page ${currentPage}:`,
            bgColor
          );
        } catch (error) {
          console.warn("Failed to capture PDF background color:", error);
          setPdfBackgroundColor("white");
        }
      }
    }
  };

  // Create deletion rectangle for text span
  const createDeletionRectangleForSpan = (span: HTMLElement) => {
    const pdfPage = documentRef.current?.querySelector(".react-pdf__Page");
    if (!pdfPage) return;

    const spanRect = span.getBoundingClientRect();
    const pageRect = pdfPage.getBoundingClientRect();

    // Calculate position relative to PDF page (original scale)
    const pageX = (spanRect.left - pageRect.left) / scale;
    const pageY = (spanRect.top - pageRect.top) / scale;
    const pageWidth = spanRect.width / scale;
    const pageHeight = spanRect.height / scale;

    const deletionRect: DeletionRectangle = {
      id: generateUUID(),
      x: pageX,
      y: pageY,
      width: pageWidth,
      height: pageHeight,
      page: currentPage,
      background: pdfBackgroundColor, // Use current PDF background color setting
    };

    // In split view, add to original document
    if (currentView === "split") {
      setOriginalDeletionRectangles((prev) => [...prev, deletionRect]);
    } else {
      setCurrentDeletionRectangles((prev) => [...prev, deletionRect]);
    }
  };

  // Create text field from span and add deletion rectangle
  const createTextFieldFromSpan = (span: HTMLElement) => {
    const textContent = span.textContent || "";
    if (!textContent.trim()) return;

    const pdfPage = documentRef.current?.querySelector(".react-pdf__Page");
    if (!pdfPage) return;

    const spanRect = span.getBoundingClientRect();
    const pageRect = pdfPage.getBoundingClientRect();

    // Calculate dimensions in original scale
    const pageWidth = spanRect.width / scale;
    const pageHeight = spanRect.height / scale;
    const pageX = (spanRect.left - pageRect.left) / scale;
    const pageY = (spanRect.top - pageRect.top) / scale;

    // Clean text content by removing icon characters
    const cleanedTextContent = textContent.replace(/×✎/g, "").trim();

    // Create text field with actual font size (no minimum limit)
    const fontSize = Math.max(1, pageHeight * 0.8);
    const fontFamily = "Arial, sans-serif";
    const fieldId = generateUUID();

    const { width, height } = measureText(
      cleanedTextContent,
      fontSize,
      fontFamily
    );

    const newTextBox: TextField = {
      id: fieldId,
      x: pageX,
      y: pageY,
      width: Math.max(pageWidth, width),
      height: Math.max(pageHeight, height),
      value: cleanedTextContent,
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
      borderRadius: 0,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
      borderBottomLeftRadius: 0,
      borderBottomRightRadius: 0,
    };

    // In split view, add to original document
    if (currentView === "split") {
      setOriginalTextBoxes((prev) => [...prev, newTextBox]);
    } else {
      setCurrentTextBoxes((prev) => [...prev, newTextBox]);
    }
    setSelectedFieldId(fieldId);

    // Create deletion rectangle to cover original text
    createDeletionRectangleForSpan(span);

    // Remove icons after creating text field
    removeIconsFromSpan(span);

    // Exit add textfield mode
    setIsAddTextBoxMode(false);
  };

  // Remove icons from span
  const removeIconsFromSpan = (span: HTMLElement) => {
    const overlay = span.querySelector(".text-span-icons");
    if (overlay) {
      overlay.remove();
    }
    span.classList.remove("text-span-clicked");
  };

  // Create icon overlay for text spans (only shown on click)
  const createIconOverlay = (span: HTMLElement) => {
    // Remove existing overlay if any
    const existingOverlay = span.querySelector(".text-span-icons");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    // Add clicked class for styling
    span.classList.add("text-span-clicked");

    // Create overlay container
    const overlay = document.createElement("div");
    overlay.className = "text-span-icons";

    // Create delete icon
    const deleteIcon = document.createElement("div");
    deleteIcon.className = "text-span-icon-delete";
    deleteIcon.innerHTML = "×";
    deleteIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("Delete icon clicked for span:", span.textContent);
      // Create deletion rectangle to cover the text
      createDeletionRectangleForSpan(span);
      // Remove icons after deletion
      removeIconsFromSpan(span);
    });

    // Create edit icon
    const editIcon = document.createElement("div");
    editIcon.className = "text-span-icon-edit";
    editIcon.innerHTML = "✎";
    editIcon.addEventListener("click", (e) => {
      e.stopPropagation();
      console.log("Edit icon clicked for span:", span.textContent);
      // Create text field and deletion rectangle
      createTextFieldFromSpan(span);
    });

    // Add icons to overlay
    overlay.appendChild(deleteIcon);
    overlay.appendChild(editIcon);

    // Add overlay to span
    span.appendChild(overlay);
  };

  // Handle text span click during add text field mode - show icons instead of creating text field
  const handleTextSpanClick = useCallback(
    (e: MouseEvent) => {
      if (!isAddTextBoxMode) return;
      e.stopPropagation();

      const span = e.currentTarget as HTMLSpanElement;
      const textContent = span.textContent || "";

      if (!textContent.trim()) return;

      // Clear any existing icons from other spans
      const allSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );
      allSpans.forEach((otherSpan) => {
        if (otherSpan !== span) {
          removeIconsFromSpan(otherSpan as HTMLElement);
        }
      });

      // Check if this span already has icons
      const hasIcons = span.querySelector(".text-span-icons");
      if (hasIcons) {
        // Remove icons if clicking the same span again
        removeIconsFromSpan(span);
      } else {
        // Show icons for this span
        createIconOverlay(span);
      }
    },
    [isAddTextBoxMode]
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

      // Clean up all handlers and overlays
      const textSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );
      textSpans.forEach((span) => {
        span.removeEventListener("click", handleTextSpanClick as any);
        delete (span as any).hasListener;

        // Remove icon overlay and styling
        removeIconsFromSpan(span as HTMLElement);
      });
    };
  }, [
    isAddTextBoxMode,
    documentUrl,
    currentPage,
    handleTextSpanClick,
    isZooming,
  ]);

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

  // Update handleTextBoxSelectionMode
  const handleTextBoxSelectionMode = useCallback(
    (textBoxId: string, event: React.MouseEvent) => {
      if (!isTextSelectionMode) return;

      event.stopPropagation();
      setIsErasureMode(false); // Turn off erasure mode

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
    [isTextSelectionMode, calculateSelectionBounds]
  );

  // Handle moving selected textboxes
  const handleMoveSelectedTextBoxes = useCallback(
    (deltaX: number, deltaY: number) => {
      if (selectedTextBoxes.textBoxIds.length === 0) return;

      setIsErasureMode(false); // Turn off erasure mode

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
  // Function to create a blank PDF and add an image as an interactive element
  const createBlankPdfAndAddImage = async (imageFile: File) => {
    try {
      setIsLoading(true);

      // Import pdf-lib dynamically to avoid SSR issues
      const { PDFDocument, rgb } = await import("pdf-lib");

      // Create a new PDF document
      const pdfDoc = await PDFDocument.create();

      // Add a blank page (A4 size: 595.28 x 841.89 points)
      const page = pdfDoc.addPage([595.28, 841.89]);

      // Convert the PDF to bytes
      const pdfBytes = await pdfDoc.save();

      // Create a blob URL for the blank PDF
      const pdfBlob = new Blob([pdfBytes], { type: "application/pdf" });
      const pdfUrl = URL.createObjectURL(pdfBlob);

      // Set the blank PDF as the document
      setDocumentUrl(pdfUrl);
      setFileType("pdf");
      setCurrentPage(1);

      // Reset editor state
      setOriginalTextBoxes([]);
      setOriginalShapes([]);
      setOriginalDeletionRectangles([]);
      setOriginalImages([]);
      setTranslatedTextBoxes([]);
      setTranslatedShapes([]);
      setTranslatedDeletionRectangles([]);
      setTranslatedImages([]);
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      setSelectedElementId(null);
      setSelectedElementType(null);
      setCurrentFormat(null);
      setDeletedPages(new Set());
      setPdfBackgroundColor("white");
      setDetectedPageBackgrounds(new Map());

      // Switch to pages tab
      setActiveSidebarTab("pages");

      // Create image URL and add as interactive element
      const imageUrl = URL.createObjectURL(imageFile);

      // Create a new image element
      const newImage: Image = {
        id: generateUUID(),
        x: 50, // Center the image on the page
        y: 50,
        width: 300, // Default size
        height: 200,
        page: 1,
        src: imageUrl,
        rotation: 0,
        opacity: 1,
        borderColor: "#000000",
        borderWidth: 0,
        borderRadius: 0,
      };

      // Add the image to the original images array
      setOriginalImages((prev) => [...prev, newImage]);
      addToLayerOrder(newImage.id);
      setSelectedElementId(newImage.id);
      setSelectedElementType("image");
      setCurrentFormat(newImage);

      setIsLoading(false);
      toast.success("Image uploaded as interactive element on blank PDF");
    } catch (error) {
      console.error("Error creating blank PDF:", error);
      setIsLoading(false);
      toast.error("Failed to create blank PDF");
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const fileType = getFileType(file.name);

      if (fileType === "image") {
        // For images, create a blank PDF and add the image as an interactive element
        createBlankPdfAndAddImage(file);
      } else {
        // For PDFs, load normally
        const url = URL.createObjectURL(file);
        setDocumentUrl(url);
        setFileType(fileType);
        setIsLoading(true);
        setCurrentPage(1);

        // Reset editor state
        setOriginalTextBoxes([]);
        setOriginalShapes([]);
        setOriginalDeletionRectangles([]);
        setOriginalImages([]);
        setTranslatedTextBoxes([]);
        setTranslatedShapes([]);
        setTranslatedDeletionRectangles([]);
        setTranslatedImages([]);
        setSelectedFieldId(null);
        setSelectedShapeId(null);
        setSelectedElementId(null);
        setSelectedElementType(null);
        setCurrentFormat(null);
        setDeletedPages(new Set());
        setPdfBackgroundColor("white"); // Reset background color for new document
        setDetectedPageBackgrounds(new Map()); // Reset detected backgrounds for new document

        // Switch to pages tab when document is uploaded
        setActiveSidebarTab("pages");

        setTimeout(() => setIsLoading(false), 500);
      }
    }
  };

  // Image upload handler for adding images to the document
  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);

      // Create a new image element
      const newImage: Image = {
        id: generateUUID(),
        x: 100, // Default position
        y: 100,
        width: 200, // Default size
        height: 150,
        page: currentPage,
        src: url,
        rotation: 0,
        opacity: 1,
        borderColor: "#000000",
        borderWidth: 0,
        borderRadius: 0,
      };

      setCurrentImages((prev) => [...prev, newImage]);
      addToLayerOrder(newImage.id);
      setSelectedElementId(newImage.id);
      setSelectedElementType("image");
      setCurrentFormat(newImage);

      // Reset file input
      if (imageInputRef.current) {
        imageInputRef.current.value = "";
      }

      // Reset image upload mode
      setIsImageUploadMode(false);

      toast.success("Image added to document");
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
    setOriginalImages((prev) =>
      prev.filter((image) => image.page !== pageNumber)
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
    setTranslatedImages((prev) =>
      prev.filter((image) => image.page !== pageNumber)
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
        borderRadius: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
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
        background: pdfBackgroundColor, // Use current PDF background color setting
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
        borderRadius: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
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
        borderRadius: 0,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        borderBottomLeftRadius: 0,
        borderBottomRightRadius: 0,
        zIndex: 30, // Default z-index for new textboxes
      };

      // Determine which document to add to
      if (currentView === "split") {
        // In split view, determine target based on click position or default to original
        if (targetView === "translated") {
          setTranslatedTextBoxes((prev) => [...prev, newTextBox]);
          setTranslatedLayerOrder((prev) => [...prev, newTextBox.id]);
        } else {
          setOriginalTextBoxes((prev) => [...prev, newTextBox]);
          setOriginalLayerOrder((prev) => [...prev, newTextBox.id]);
        }
      } else {
        setCurrentTextBoxes((prev) => [...prev, newTextBox]);
        addToLayerOrder(newTextBox.id);
      }

      // Automatically select the new textbox
      setSelectedFieldId(fieldId);
      setSelectedElementId(fieldId);
      setSelectedElementType("textbox");
      setCurrentFormat(newTextBox);
      setIsDrawerOpen(true);

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
      // Update in both original and translated arrays to handle any textbox
      setOriginalTextBoxes((prev) =>
        prev.map((box) => (box.id === id ? { ...box, ...updates } : box))
      );
      setTranslatedTextBoxes((prev) =>
        prev.map((box) => (box.id === id ? { ...box, ...updates } : box))
      );
    },
    []
  );

  const deleteTextBox = useCallback(
    (id: string) => {
      setCurrentTextBoxes((prev) => prev.filter((box) => box.id !== id));
      removeFromLayerOrder(id);
      setSelectedFieldId((current) => (current === id ? null : current));
    },
    [currentView, removeFromLayerOrder]
  );

  // Memoized callbacks for text box interactions to prevent re-renders
  const handleTextBoxSelect = useCallback(
    (id: string) => {
      setSelectedFieldId(id);
      setSelectedShapeId(null); // Clear shape selection
      setSelectedElementType("textbox");
      setIsErasureMode(false); // Turn off erasure mode

      // Find the selected text box
      const allTextBoxes = [...originalTextBoxes, ...translatedTextBoxes];
      const selectedTextBox = allTextBoxes.find((box) => box.id === id);
      if (selectedTextBox) {
        setCurrentFormat(selectedTextBox);
      }

      // Turn off text selection mode when selecting a text box
      if (isTextSelectionMode) {
        setIsTextSelectionMode(false);
      }

      setIsDrawerOpen(true);
    },
    [
      isTextSelectionMode,
      originalTextBoxes,
      translatedTextBoxes,
      setSelectedElementType,
      setCurrentFormat,
      setIsDrawerOpen,
    ]
  );

  // Define updateShapeCallback first
  const updateShapeCallback = useCallback(
    (id: string, updates: Partial<Shape>) => {
      console.log("updateShapeCallback called with:", { id, updates });

      // Update the shape in the appropriate array
      if (currentView === "split") {
        // Handle split view updates
        const isTranslatedSide = translatedShapes.some(
          (shape) => shape.id === id
        );
        if (isTranslatedSide) {
          setTranslatedShapes((prev) =>
            prev.map((shape) =>
              shape.id === id ? { ...shape, ...updates } : shape
            )
          );
        } else {
          setOriginalShapes((prev) =>
            prev.map((shape) =>
              shape.id === id ? { ...shape, ...updates } : shape
            )
          );
        }
      } else {
        // Handle single view updates
        setCurrentShapes((prev) =>
          prev.map((shape) =>
            shape.id === id ? { ...shape, ...updates } : shape
          )
        );
      }

      // Update the format drawer if this is the selected shape
      if (selectedShapeId === id) {
        const allShapes = [...originalShapes, ...translatedShapes];
        const updatedShapeObj = allShapes.find((shape) => shape.id === id);
        if (updatedShapeObj) {
          const shapeFormat = {
            ...updatedShapeObj,
            ...updates,
          };
          setCurrentFormat(shapeFormat);
        }
      }
    },
    [
      currentView,
      selectedShapeId,
      originalShapes,
      translatedShapes,
      setCurrentFormat,
      setTranslatedShapes,
      setOriginalShapes,
      setCurrentShapes,
    ]
  );

  // Then define handleFormatChange
  const handleFormatChange = useCallback(
    (format: any) => {
      console.log("handleFormatChange called with:", format, {
        selectedFieldId,
        selectedShapeId,
        selectedElementType,
      });

      if (selectedFieldId) {
        // Handle text field format changes
        updateTextBox(selectedFieldId, format);
      } else if (selectedShapeId) {
        // Handle shape format changes
        const updates: Partial<Shape> = {};

        // Map shape-specific format changes
        if ("type" in format) updates.type = format.type;
        if ("fillColor" in format) updates.fillColor = format.fillColor;
        if ("fillOpacity" in format) updates.fillOpacity = format.fillOpacity;
        if ("borderColor" in format) updates.borderColor = format.borderColor;
        if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
        if ("rotation" in format) updates.rotation = format.rotation;
        if ("borderRadius" in format)
          updates.borderRadius = format.borderRadius;

        console.log("Updating shape with:", updates);
        updateShapeCallback(selectedShapeId, updates);
      } else if (selectedElementType === "image" && selectedElementId) {
        // Handle image format changes
        const updates: Partial<Image> = {};

        // Check for special resetAspectRatio command
        if ("resetAspectRatio" in format && format.resetAspectRatio) {
          // Find the current image
          const currentImage = getCurrentImages().find(
            (img) => img.id === selectedElementId
          );
          if (currentImage) {
            // Create a temporary image element to get natural dimensions
            const img = new Image();
            img.onload = () => {
              const originalAspectRatio = img.naturalWidth / img.naturalHeight;
              const newHeight = currentImage.width / originalAspectRatio;

              const aspectRatioUpdates: Partial<Image> = {
                height: newHeight,
              };

              // Update the image with new height to maintain aspect ratio
              setCurrentImages((prev) =>
                prev.map((img) =>
                  img.id === selectedElementId
                    ? { ...img, ...aspectRatioUpdates }
                    : img
                )
              );

              // Update the current format to keep drawer in sync
              if (currentFormat && "src" in currentFormat) {
                setCurrentFormat({
                  ...currentFormat,
                  ...aspectRatioUpdates,
                } as Image);
              }
            };
            img.src = currentImage.src;
            return; // Exit early since we're handling this specially
          }
        }

        // Map image-specific format changes
        if ("opacity" in format) updates.opacity = format.opacity;
        if ("borderColor" in format) updates.borderColor = format.borderColor;
        if ("borderWidth" in format) updates.borderWidth = format.borderWidth;
        if ("borderRadius" in format)
          updates.borderRadius = format.borderRadius;
        if ("rotation" in format) updates.rotation = format.rotation;

        console.log("Updating image with:", updates);

        // Update the image in the current images array
        setCurrentImages((prev) =>
          prev.map((img) =>
            img.id === selectedElementId ? { ...img, ...updates } : img
          )
        );

        // Update the current format to keep drawer in sync
        if (currentFormat && "src" in currentFormat) {
          setCurrentFormat({ ...currentFormat, ...updates } as Image);
        }
      }
    },
    [
      selectedFieldId,
      selectedShapeId,
      selectedElementType,
      selectedElementId,
      updateShapeCallback,
    ]
  );

  // Effect to handle text box selection and ElementFormatDrawer updates
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
            borderTopLeftRadius: selectedTextBox.borderTopLeftRadius || 0,
            borderTopRightRadius: selectedTextBox.borderTopRightRadius || 0,
            borderBottomLeftRadius: selectedTextBox.borderBottomLeftRadius || 0,
            borderBottomRightRadius:
              selectedTextBox.borderBottomRightRadius || 0,
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

  // Effect to set up layer ordering functions
  useEffect(() => {
    setLayerOrderFunctions({
      moveToFront,
      moveToBack,
      moveForward,
      moveBackward,
    });
  }, [
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    setLayerOrderFunctions,
  ]);

  // Effect to set up layer position helper functions
  useEffect(() => {
    setLayerPositionHelpers({
      isElementAtFront,
      isElementAtBack,
    });
  }, [isElementAtFront, isElementAtBack, setLayerPositionHelpers]);

  // Memoized callbacks for shape interactions to prevent re-renders
  const handleShapeSelect = useCallback(
    (id: string) => {
      console.log("handleShapeSelect", id);
      setSelectedShapeId(id);
      setSelectedFieldId(null);
      setSelectedElementId(id);
      setSelectedElementType("shape");
      setIsErasureMode(false); // Turn off erasure mode

      // Find the selected shape
      const allShapes = [...originalShapes, ...translatedShapes];
      const selectedShape = allShapes.find((shape) => shape.id === id);
      console.log("Selected shape:", selectedShape);

      if (selectedShape) {
        const shapeFormat = {
          id: selectedShape.id,
          type: selectedShape.type,
          x: selectedShape.x,
          y: selectedShape.y,
          width: selectedShape.width,
          height: selectedShape.height,
          page: selectedShape.page,
          fillColor: selectedShape.fillColor || "#ffffff",
          fillOpacity: selectedShape.fillOpacity || 0.5,
          borderColor: selectedShape.borderColor || "#000000",
          borderWidth: selectedShape.borderWidth || 1,
          rotation: selectedShape.rotation || 0,
          borderRadius: selectedShape.borderRadius || 0,
        };
        console.log("Setting shape format:", shapeFormat);
        setCurrentFormat(shapeFormat);
        setIsDrawerOpen(true);
      }
    },
    [
      originalShapes,
      translatedShapes,
      setSelectedElementType,
      setCurrentFormat,
      setIsDrawerOpen,
      setSelectedElementId,
    ]
  );

  // Add effect to monitor drawer state
  useEffect(() => {
    console.log("Drawer state changed:", {
      isDrawerOpen,
      selectedElementType,
      selectedShapeId,
      currentFormat,
      selectedElementId,
    });
  }, [
    isDrawerOpen,
    selectedElementType,
    selectedShapeId,
    currentFormat,
    selectedElementId,
  ]);

  const deleteShapeCallback = useCallback(
    (id: string) => {
      setCurrentShapes((prev) => prev.filter((shape) => shape.id !== id));
      removeFromLayerOrder(id);
      setSelectedShapeId((current) => (current === id ? null : current));
    },
    [currentView, removeFromLayerOrder]
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
        borderRadius: type === "rectangle" ? 0 : undefined, // Add default border radius for rectangles
      };

      // Determine which document to add to
      if (currentView === "split") {
        // In split view, determine target based on position or default to original
        if (targetView === "translated") {
          setTranslatedShapes((prev) => [...prev, newShape]);
          setTranslatedLayerOrder((prev) => [...prev, newShape.id]);
        } else {
          setOriginalShapes((prev) => [...prev, newShape]);
          setOriginalLayerOrder((prev) => [...prev, newShape.id]);
        }
      } else {
        setCurrentShapes((prev) => [...prev, newShape]);
        addToLayerOrder(newShape.id);
      }

      // Automatically select the new shape and open the format drawer
      setSelectedShapeId(newShape.id);
      setSelectedElementId(newShape.id);
      setSelectedElementType("shape");
      setCurrentFormat(newShape);
      setIsDrawerOpen(true);
    },
    [
      currentPage,
      currentView,
      setSelectedElementType,
      setCurrentFormat,
      setIsDrawerOpen,
    ]
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
        background: pdfBackgroundColor, // Use current PDF background color setting
      };

      setCurrentDeletionRectangles((prev) => [...prev, newRectangle]);
    },
    [currentPage, currentView, pdfBackgroundColor]
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
    } else if (isErasureMode) {
      // Handle erasure drawing start
      if (e.button !== 0) return; // Only left click

      const rect = documentRef.current?.getBoundingClientRect();
      if (!rect) return;

      let x = (e.clientX - rect.left) / scale;
      let y = (e.clientY - rect.top) / scale;
      let targetView: "original" | "translated" | undefined = undefined;

      // Set targetView based on currentView and click position
      if (currentView === "split") {
        const clickX = e.clientX - rect.left;
        const singleDocWidth = pageWidth * scale;
        const gap = 20; // Gap between documents

        if (clickX > singleDocWidth + gap) {
          x = (clickX - singleDocWidth - gap) / scale;
          targetView = "translated";
        } else if (clickX <= singleDocWidth) {
          targetView = "original";
        } else {
          return; // Click in gap - ignore
        }
      } else {
        targetView = currentView === "translated" ? "translated" : "original";
      }

      console.log("Document mouse down - erasure mode, starting erasure draw", {
        x,
        y,
        targetView,
      });
      setErasureDrawStart({ x, y });
      setErasureDrawTargetView(targetView);
      setIsDrawingErasure(true);

      // Update refs immediately
      erasureDrawStartRef.current = { x, y };
      erasureDrawTargetViewRef.current = targetView;
      isDrawingErasureRef.current = true;

      e.preventDefault();
    }
  };

  // Handle mouse move for text selection and erasure
  const handleDocumentMouseMove = (e: React.MouseEvent) => {
    if (isTextSelectionMode && isDrawingSelection && selectionStart) {
      const x = e.clientX;
      const y = e.clientY;

      setSelectionEnd({ x, y });
      e.preventDefault();
    } else if (isErasureMode && isDrawingErasure) {
      handleErasureDrawMove(e);
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
    } else if (isErasureMode && isDrawingErasure) {
      console.log(
        "Document mouse up - erasure mode, calling handleErasureDrawEnd"
      );
      e.preventDefault();
      e.stopPropagation();
      handleErasureDrawEnd();
      return; // Prevent further processing
    } else if (isErasureMode) {
      console.log("Document mouse up - erasure mode but not drawing");
    }
  };

  // Document container click handler
  const handleDocumentContainerClick = (e: React.MouseEvent) => {
    if (!documentRef.current) return;

    // Don't handle clicks on text boxes, shapes, or other interactive elements
    const target = e.target as HTMLElement;
    if (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.closest(".rnd") ||
      target.closest(".text-format-drawer") ||
      target.closest(".element-format-drawer")
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

      if (clickX > singleDocWidth + gap) {
        x = (clickX - singleDocWidth - gap) / scale;
        targetView = "translated";
      } else if (clickX <= singleDocWidth) {
        targetView = "original";
      } else {
        return; // Click in gap - ignore
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
    } else if (isErasureMode) {
      // Don't start erasure drawing on click - only on mouse down
    } else {
      // Only clear selections if not clicking on a shape or textbox
      if (!target.closest(".rnd")) {
        setSelectedFieldId(null);
        setSelectedShapeId(null);
        setSelectedElementId(null);
        setSelectedElementType(null);
        setCurrentFormat(null);
        setIsDrawerOpen(false);
        handleClearTextSelection();
      }
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

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate base coordinates
    let x = clickX / scale;
    let y = clickY / scale;

    // Adjust coordinates for split view
    if (currentView === "split") {
      const singleDocWidth = pageWidth;
      const gap = 20 / scale;

      // Check if we're drawing on the translated side
      if (shapeDrawTargetView === "translated") {
        x = (clickX - pageWidth * scale - 20) / scale; // Subtract document width and gap
      }
    }

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
    setIsErasureMode(false);
  };

  const handleErasureDrawMove = (e: React.MouseEvent) => {
    if (!isDrawingErasure || !erasureDrawStart) return;

    const rect = documentRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Calculate base coordinates
    let x = clickX / scale;
    let y = clickY / scale;

    // Adjust coordinates for split view
    if (currentView === "split") {
      const singleDocWidth = pageWidth;
      const gap = 20 / scale;

      // Check if we're drawing on the translated side
      if (erasureDrawTargetView === "translated") {
        x = (clickX - pageWidth * scale - 20) / scale; // Subtract document width and gap
      }
    }

    setErasureDrawEnd({ x, y });
    erasureDrawEndRef.current = { x, y };
  };

  const handleErasureDrawEnd = () => {
    console.log("handleErasureDrawEnd called", {
      isDrawingErasure,
      erasureDrawStart,
      erasureDrawEnd,
    });

    // Always reset the drawing state, regardless of conditions
    const wasDrawing = isDrawingErasure;
    const hadStart = erasureDrawStart;
    const hadEnd = erasureDrawEnd;
    const targetView = erasureDrawTargetView;

    // Reset state immediately to prevent any lingering preview
    setErasureDrawStart(null);
    setErasureDrawEnd(null);
    setErasureDrawTargetView(null);
    setIsDrawingErasure(false);

    // Reset refs immediately
    isDrawingErasureRef.current = false;
    erasureDrawStartRef.current = null;
    erasureDrawEndRef.current = null;
    erasureDrawTargetViewRef.current = null;

    // Only process if we were actually drawing
    if (!wasDrawing || !hadStart || !hadEnd) {
      console.log("Early return - not drawing or no start/end point");
      return;
    }

    const width = Math.abs(hadEnd.x - hadStart.x);
    const height = Math.abs(hadEnd.y - hadStart.y);

    console.log("Drawing dimensions", { width, height });

    if (width > 5 && height > 5) {
      const x = Math.min(hadStart.x, hadEnd.x);
      const y = Math.min(hadStart.y, hadEnd.y);

      // Create deletion rectangle with PDF background color and erasure opacity
      const deletionRect: DeletionRectangle = {
        id: generateUUID(),
        x,
        y,
        width,
        height,
        page: currentPage,
        background: pdfBackgroundColor,
        opacity: erasureSettings.opacity,
      };

      console.log(
        "Creating deletion rectangle",
        deletionRect,
        "for view:",
        targetView
      );

      // Apply to the correct view based on target view
      if (currentView === "split") {
        if (targetView === "translated") {
          setTranslatedDeletionRectangles((prev) => [...prev, deletionRect]);
        } else {
          setOriginalDeletionRectangles((prev) => [...prev, deletionRect]);
        }
      } else {
        setCurrentDeletionRectangles((prev) => [...prev, deletionRect]);
      }
    }

    console.log("Erasure drawing completed and state reset");
  };

  // Export functionality
  const exportData = () => {
    const data = {
      originalTextBoxes,
      originalShapes,
      originalDeletionRectangles,
      originalImages,
      translatedTextBoxes,
      translatedShapes,
      translatedDeletionRectangles,
      translatedImages,
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
        originalImages,
        translatedTextBoxes,
        translatedShapes,
        translatedDeletionRectangles,
        translatedImages,
        originalLayerOrder,
        translatedLayerOrder,
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
        setOriginalImages(data.originalImages || []);
        setTranslatedTextBoxes(data.translatedTextBoxes || []);
        setTranslatedShapes(data.translatedShapes || []);
        setTranslatedDeletionRectangles(
          data.translatedDeletionRectangles || []
        );
        setTranslatedImages(data.translatedImages || []);
        setOriginalLayerOrder(data.originalLayerOrder || []);
        setTranslatedLayerOrder(data.translatedLayerOrder || []);
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

  // Function to transform example_to_textbox.json into textboxes
  const transformJsonToTextboxes = useCallback(async () => {
    try {
      // Import the JSON file
      const response = await fetch("/example_to_textbox.json");
      const jsonData = await response.json();

      if (!jsonData.entities || !Array.isArray(jsonData.entities)) {
        console.error("Invalid JSON format: missing entities array");
        return;
      }

      const newTextBoxes: TextField[] = [];

      // Log all entities before processing
      console.log(
        "All entities before processing:",
        jsonData.entities.map((e: any) => ({
          type: e.type_,
          text: e.text,
          style: e.style,
        }))
      );

      jsonData.entities.forEach((entity: any) => {
        // Log each entity as it's being processed
        console.log("Processing entity:", {
          type: entity.type_,
          text: entity.text,
          style: entity.style,
          rawEntity: entity,
        });

        if (
          !entity.bounding_poly ||
          !entity.bounding_poly.vertices ||
          entity.bounding_poly.vertices.length < 4
        ) {
          console.warn("Skipping entity with invalid bounding_poly:", entity);
          return;
        }

        const vertices = entity.bounding_poly.vertices;

        // Calculate position and size from vertices (relative coordinates)
        const x = Math.min(...vertices.map((v: any) => v.x)) * pageWidth;
        const y = Math.min(...vertices.map((v: any) => v.y)) * pageHeight;
        const maxX = Math.max(...vertices.map((v: any) => v.x)) * pageWidth;
        const maxY = Math.max(...vertices.map((v: any) => v.y)) * pageHeight;
        const width = maxX - x;
        const height = maxY - y;

        // Convert style colors from [0-1] range to hex
        const rgbToHex = (rgb: number[]): string => {
          if (!rgb || rgb.length !== 3) return "#000000";
          const r = Math.round(rgb[0] * 255);
          const g = Math.round(rgb[1] * 255);
          const b = Math.round(rgb[2] * 255);
          return `#${r.toString(16).padStart(2, "0")}${g
            .toString(16)
            .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
        };

        // Extract styling information
        const style = entity.style || {};
        const backgroundColor = style.background_color
          ? rgbToHex(style.background_color)
          : "transparent";
        const textColor = style.text_color
          ? rgbToHex(style.text_color)
          : "#000000";
        const borderColor = style.border_color
          ? rgbToHex(style.border_color)
          : "#000000";
        const borderWidth = style.has_border ? 1 : 0;
        const borderRadius = style.border_radius || 0;
        const padding = style.padding || 0;
        const fontWeight = style.font_weight === "bold";
        const textAlign = style.alignment || "left";

        // Calculate font size more accurately for MessengerTextBox
        let estimatedFontSize = 12; // Default font size

        // Debug log for entity type and conditions
        console.log("Font size calculation - entity check:", {
          type: entity.type_,
          isExactChatTime: entity.type_ === "chat_time",
          isExactMessenger: entity.type_ === "MessengerTextBox",
          height,
          text: entity.text,
          rawType: entity.type_,
          typeComparison: {
            typeValue: entity.type_,
            chatTimeMatch: entity.type_ === "chat_time",
            messengerMatch: entity.type_ === "MessengerTextBox",
            typeof: typeof entity.type_,
          },
        });

        if (entity.type_ === "chat_time") {
          console.log("Applying chat_time font size rules:", {
            initialHeight: height,
            condition1: height > 14,
            condition2: height > 16,
          });
          // For chat_time, force font size between 5-7px regardless of height
          estimatedFontSize = 5; // Start with minimum
          if (height > 14) {
            // If height is large enough for 6px
            estimatedFontSize = 6;
          }
          if (height > 16) {
            // If height is large enough for 7px
            estimatedFontSize = 7;
          }

          console.log("Final chat_time font size:", {
            height,
            estimatedFontSize,
            text: entity.text,
          });
          // We'll adjust the height when creating the text box
        } else if (entity.type === "MessengerTextBox") {
          // Calculate available space inside the border, with extra padding
          const borderHeight = borderWidth * 2;
          const extraPadding = 1; // Vertical padding of 1px
          const availableHeight = height - borderHeight - extraPadding * 2;

          // Count number of lines in the text
          const textLines = (entity.text || "").split("\n");
          const numberOfLines = textLines.length;

          // Calculate font size based on available height and number of lines
          // Account for line height (1.1 is our default now)
          const lineHeight = 1.1;
          const fontSizeFromHeight =
            availableHeight / (numberOfLines * lineHeight);

          // Calculate based on the longest line to ensure text fits horizontally
          const borderWidth2x = borderWidth * 2;
          const extraHorizontalPadding = 2; // Horizontal padding of 2px
          const availableWidth =
            width - borderWidth2x - extraHorizontalPadding * 2;

          // Find the longest line
          const longestLine = textLines.reduce(
            (longest: string, current: string) =>
              current.length > longest.length ? current : longest,
            ""
          );

          // Use a binary search approach to find the optimal font size for width
          let fontSizeFromWidth = 24; // Start with max size
          let testFontSize = fontSizeFromWidth;

          // Binary search for the largest font size that fits the width
          let minSize = 6;
          let maxSize = 24;

          while (minSize <= maxSize) {
            testFontSize = Math.floor((minSize + maxSize) / 2);
            const { width: textWidth } = measureText(
              longestLine,
              testFontSize,
              "Arial, sans-serif"
            );

            if (textWidth <= availableWidth) {
              fontSizeFromWidth = testFontSize;
              minSize = testFontSize + 1;
            } else {
              maxSize = testFontSize - 1;
            }
          }

          // Use the smaller of the two calculations to ensure text fits both dimensions
          estimatedFontSize = Math.min(fontSizeFromHeight, fontSizeFromWidth);

          // Apply reasonable bounds (minimum 3px, maximum 12px for messenger text)
          estimatedFontSize = Math.max(
            3,
            Math.min(12, Math.round(estimatedFontSize))
          );

          // Debug logging for MessengerTextBox font size calculation
          console.log(`MessengerTextBox font size calculation:`, {
            entityId: entity.id,
            originalHeight: height,
            originalWidth: width,
            availableHeight,
            availableWidth,
            numberOfLines,
            longestLineLength: longestLine.length,
            fontSizeFromHeight,
            fontSizeFromWidth,
            finalFontSize: estimatedFontSize,
            borderWidth,
            extraPadding,
            extraHorizontalPadding,
          });
        } else {
          // For non-MessengerTextBox entities, use the original calculation
          estimatedFontSize = Math.max(6, Math.round(height * 0.4)); // Changed from 0.6 to 0.4
        }

        // Adjust height for chat_time and MessengerTextBox
        let adjustedHeight = height;
        let adjustedWidth = width;

        if (entity.type_ === "chat_time") {
          adjustedHeight = height + 2;
        } else if (entity.type_ === "MessengerTextBox") {
          adjustedHeight = height + 2; // Extra height for padding (1px * 2)
          adjustedWidth = width + 4; // Extra width for padding (2px * 2)
        }

        // Debug log for text box creation
        console.log("Creating text box:", {
          type: entity.type,
          text: entity.text,
          fontSize: estimatedFontSize,
        });

        const newTextBox: TextField = {
          id: generateUUID(),
          x: x,
          y: y,
          width: adjustedWidth,
          height: adjustedHeight,
          value: entity.text || "",
          fontSize: estimatedFontSize,
          fontFamily: "Arial, sans-serif",
          page: currentPage,
          type: entity.type_, // Fix: use entity.type_ instead of entity.type
          color: textColor,
          bold: fontWeight,
          italic: false,
          underline: false,
          textAlign: textAlign as "left" | "center" | "right" | "justify",
          listType: "none",
          letterSpacing: 0,
          lineHeight: 1.1, // Reduced line height
          rotation: 0,
          backgroundColor: backgroundColor,
          borderColor: borderColor,
          borderWidth: borderWidth,
          borderRadius: borderRadius,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
          borderBottomLeftRadius: borderRadius,
          borderBottomRightRadius: borderRadius,
          paddingTop: entity.type_ === "MessengerTextBox" ? 1 : 0,
          paddingRight: entity.type_ === "MessengerTextBox" ? 2 : 0,
          paddingBottom: entity.type_ === "MessengerTextBox" ? 1 : 0,
          paddingLeft: entity.type_ === "MessengerTextBox" ? 2 : 0,
        };

        newTextBoxes.push(newTextBox);
      });

      // Add all textboxes to the translated document
      setTranslatedTextBoxes((prev) => [...prev, ...newTextBoxes]);

      // Add new textbox IDs to the layer order
      const newTextBoxIds = newTextBoxes.map((box) => box.id);
      setTranslatedLayerOrder((prev) => [...prev, ...newTextBoxIds]);

      // Hide the transform button after transformation
      setShowTransformButton(false);

      console.log(`Transformed ${newTextBoxes.length} entities into textboxes`);
      toast.success(
        `Transformed ${newTextBoxes.length} entities into textboxes`
      );
    } catch (error) {
      console.error("Error transforming JSON to textboxes:", error);
      toast.error("Failed to transform JSON to textboxes");
    }
  }, [currentPage, pageWidth, pageHeight]);

  // Transform page to textboxes using OCR
  const handleTransformPageToTextbox = useCallback(async () => {
    const previousView = currentView; // Declare at the top to fix scope

    try {
      setIsTransforming(true);

      // Switch to original view
      setCurrentView("original");

      // Wait for the view change to apply and document to render
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Get the document element after view change
      const documentElement = documentRef.current;
      if (!documentElement) {
        throw new Error("Document element not found");
      }

      // Get the PDF page element
      const pdfPage = documentElement.querySelector(
        ".react-pdf__Page"
      ) as HTMLElement;
      if (!pdfPage) {
        throw new Error("PDF page element not found");
      }

      // Temporarily set scale to 500%
      const originalScale = scale;
      const captureScale = 5;

      // Save original state
      const wasAddTextBoxMode = isAddTextBoxMode;
      setIsAddTextBoxMode(false);

      // Set the scale
      setScale(captureScale);

      // Wait for the scale change to apply
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Import html2canvas dynamically
      const html2canvasModule = await import("html2canvas");
      const html2canvas = html2canvasModule.default;

      // Capture the PDF page as an image
      const canvas = await html2canvas(pdfPage, {
        scale: 1,
        logging: false,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        ignoreElements: (element) => {
          // Ignore any overlay elements, only capture the PDF content
          return (
            element.classList.contains("text-format-drawer") ||
            element.classList.contains("rnd") ||
            element.classList.contains("shape-element")
          );
        },
      });

      // Reset scale
      setScale(originalScale);
      setIsAddTextBoxMode(wasAddTextBoxMode);

      // Convert canvas to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
        }, "image/png");
      });

      // Create FormData and send to API
      const formData = new FormData();
      formData.append("file", blob, `page-${currentPage}.png`);

      // Call the OCR API
      const response = await fetch("/api/proxy/process-file", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to process document");
      }

      const data = await response.json();

      // Extract entities from the response
      if (data.layout && data.layout.pages && data.layout.pages.length > 0) {
        const entities = data.layout.pages[0].entities || [];

        // Convert entities to textboxes
        const newTextBoxes: TextField[] = [];

        entities.forEach((entity: any) => {
          if (
            !entity.bounding_poly ||
            !entity.bounding_poly.vertices ||
            entity.bounding_poly.vertices.length < 4
          ) {
            return;
          }

          const vertices = entity.bounding_poly.vertices;
          const x = Math.min(...vertices.map((v: any) => v.x)) * pageWidth;
          const y = Math.min(...vertices.map((v: any) => v.y)) * pageHeight;
          const maxX = Math.max(...vertices.map((v: any) => v.x)) * pageWidth;
          const maxY = Math.max(...vertices.map((v: any) => v.y)) * pageHeight;
          let width = maxX - x;
          let height = maxY - y;

          // Convert style colors from [0-1] range to hex
          const rgbToHex = (rgb: number[]): string => {
            if (!rgb || rgb.length !== 3) return "#000000";
            const r = Math.round(rgb[0] * 255);
            const g = Math.round(rgb[1] * 255);
            const b = Math.round(rgb[2] * 255);
            return `#${r.toString(16).padStart(2, "0")}${g
              .toString(16)
              .padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
          };

          // Extract styling information
          const style = entity.style || {};
          const backgroundColor = style.background_color
            ? rgbToHex(style.background_color)
            : "transparent";
          const textColor = style.text_color
            ? rgbToHex(style.text_color)
            : "#000000";
          const borderColor = style.border_color
            ? rgbToHex(style.border_color)
            : "#000000";
          const borderWidth = style.has_border ? 1 : 0;
          const borderRadius = style.border_radius || 0;
          const padding = style.padding || 0;
          const fontWeight = style.font_weight === "bold";
          const textAlign = style.alignment || "left";

          // Calculate text dimensions and font size for the textbox
          const lineHeight = 1.2;
          const textPadding = 5; // Small padding for visual comfort
          const minFontSize = entity.type === "MessengerTextBox" ? 4 : 6; // Further reduced font sizes
          const maxFontSize = entity.type === "MessengerTextBox" ? 10 : 14; // Further reduced font sizes
          let estimatedFontSize = maxFontSize;

          // Split text into lines
          const textLines = (entity.text || "").split("\n");
          const numberOfLines = textLines.length;

          // Find the longest line
          let longestLine = "";
          for (const line of textLines) {
            if (line.length > longestLine.length) {
              longestLine = line;
            }
          }

          // Calculate text dimensions
          const { width: textWidth, height: textHeight } = measureText(
            longestLine,
            estimatedFontSize,
            "Arial, sans-serif"
          );

          // No padding for maximum compactness
          width = textWidth;
          height = textHeight * numberOfLines * lineHeight;

          // Add border space if present
          if (borderWidth > 0) {
            width += borderWidth * 2;
            height += borderWidth * 2;
          }

          // Minimal extra padding for messenger text boxes
          // No extra padding for messenger text boxes

          const newTextBox: TextField = {
            id: generateUUID(),
            x: x,
            y: y,
            width: width,
            height: height,
            value: entity.text || "",
            fontSize: estimatedFontSize,
            fontFamily: "Arial, sans-serif",
            page: currentPage,
            color: textColor,
            bold: fontWeight,
            italic: false,
            underline: false,
            textAlign: textAlign as "left" | "center" | "right" | "justify",
            listType: "none",
            letterSpacing: 0,
            lineHeight: 1.2,
            rotation: 0,
            backgroundColor: backgroundColor,
            borderColor: borderColor,
            borderWidth: borderWidth,
            borderRadius: borderRadius,
            borderTopLeftRadius: borderRadius,
            borderTopRightRadius: borderRadius,
            borderBottomLeftRadius: borderRadius,
            borderBottomRightRadius: borderRadius,
            paddingTop: padding,
            paddingRight: padding,
            paddingBottom: padding,
            paddingLeft: padding,
          };

          newTextBoxes.push(newTextBox);
        });

        // Add all textboxes to the translated document
        setTranslatedTextBoxes((prev) => [...prev, ...newTextBoxes]);

        // Add new textbox IDs to the layer order
        const newTextBoxIds = newTextBoxes.map((box) => box.id);
        setTranslatedLayerOrder((prev) => [...prev, ...newTextBoxIds]);

        // Mark the page as translated
        setIsPageTranslated((prev) => new Map(prev).set(currentPage, true));

        // Switch back to the previous view
        setCurrentView(previousView);

        console.log(
          `Transformed ${newTextBoxes.length} entities into textboxes`
        );
        toast.success(
          `Transformed ${newTextBoxes.length} entities into textboxes`
        );
      }

      setIsTransforming(false);
    } catch (error) {
      console.error("Error transforming page to textboxes:", error);
      toast.error("Failed to transform page to textboxes");
      setIsTransforming(false);

      // Reset view if error occurred
      setCurrentView(previousView);
    }
  }, [
    currentPage,
    pageWidth,
    pageHeight,
    scale,
    currentView,
    isAddTextBoxMode,
  ]);

  // Get current page items - memoized for performance
  const getCurrentPageTextBoxes = useMemo(
    () => getCurrentTextBoxes().filter((box) => box.page === currentPage),
    [currentView, originalTextBoxes, translatedTextBoxes, currentPage]
  );
  const getCurrentPageShapes = useMemo(
    () => getCurrentShapes().filter((shape) => shape.page === currentPage),
    [currentView, originalShapes, translatedShapes, currentPage]
  );
  const getCurrentPageImages = useMemo(
    () => getCurrentImages().filter((image) => image.page === currentPage),
    [currentView, originalImages, translatedImages, currentPage]
  );

  // Get sorted elements for current page - memoized for performance
  const getCurrentPageSortedElements = useMemo(
    () => getSortedElements(),
    [
      currentView,
      originalTextBoxes,
      originalShapes,
      originalImages,
      translatedTextBoxes,
      translatedShapes,
      translatedImages,
      originalLayerOrder,
      translatedLayerOrder,
      currentPage,
    ]
  );

  // Helper functions for split view sorted elements
  const getOriginalSortedElements = useMemo(() => {
    const originalTextBoxesForPage = originalTextBoxes.filter(
      (box) => box.page === currentPage
    );
    const originalShapesForPage = originalShapes.filter(
      (shape) => shape.page === currentPage
    );
    const originalImagesForPage = originalImages.filter(
      (image) => image.page === currentPage
    );

    // Create a map of all original elements
    const elementMap = new Map<
      string,
      {
        type: "textbox" | "shape" | "image";
        element: TextField | Shape | Image;
      }
    >();
    originalTextBoxesForPage.forEach((box) =>
      elementMap.set(box.id, { type: "textbox", element: box })
    );
    originalShapesForPage.forEach((shape) =>
      elementMap.set(shape.id, { type: "shape", element: shape })
    );
    originalImagesForPage.forEach((image) =>
      elementMap.set(image.id, { type: "image", element: image })
    );

    // Sort elements based on original layer order
    const sortedElements: Array<{
      type: "textbox" | "shape" | "image";
      element: TextField | Shape | Image;
    }> = [];

    // Add elements in layer order
    originalLayerOrder.forEach((id) => {
      const element = elementMap.get(id);
      if (element) {
        sortedElements.push(element);
        elementMap.delete(id);
      }
    });

    // Add any remaining elements (newly created ones not in layer order yet)
    elementMap.forEach((element) => {
      sortedElements.push(element);
    });

    return sortedElements;
  }, [
    originalTextBoxes,
    originalShapes,
    originalImages,
    originalLayerOrder,
    currentPage,
  ]);

  const getTranslatedSortedElements = useMemo(() => {
    const translatedTextBoxesForPage = translatedTextBoxes.filter(
      (box) => box.page === currentPage
    );
    const translatedShapesForPage = translatedShapes.filter(
      (shape) => shape.page === currentPage
    );
    const translatedImagesForPage = translatedImages.filter(
      (image) => image.page === currentPage
    );

    // Create a map of all translated elements
    const elementMap = new Map<
      string,
      {
        type: "textbox" | "shape" | "image";
        element: TextField | Shape | Image;
      }
    >();
    translatedTextBoxesForPage.forEach((box) =>
      elementMap.set(box.id, { type: "textbox", element: box })
    );
    translatedShapesForPage.forEach((shape) =>
      elementMap.set(shape.id, { type: "shape", element: shape })
    );
    translatedImagesForPage.forEach((image) =>
      elementMap.set(image.id, { type: "image", element: image })
    );

    // Sort elements based on translated layer order
    const sortedElements: Array<{
      type: "textbox" | "shape" | "image";
      element: TextField | Shape | Image;
    }> = [];

    // Add elements in layer order
    translatedLayerOrder.forEach((id) => {
      const element = elementMap.get(id);
      if (element) {
        sortedElements.push(element);
        elementMap.delete(id);
      }
    });

    // Add any remaining elements (newly created ones not in layer order yet)
    elementMap.forEach((element) => {
      sortedElements.push(element);
    });

    return sortedElements;
  }, [
    translatedTextBoxes,
    translatedShapes,
    translatedImages,
    translatedLayerOrder,
    currentPage,
  ]);
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

  // Helper function to adjust coordinates for split view
  const adjustSplitViewCoordinates = (
    x: number,
    y: number,
    targetView: "original" | "translated" | null
  ) => {
    if (currentView === "split" && targetView === "translated") {
      const singleDocWidth = pageWidth;
      const gap = 20 / scale; // Convert gap to document coordinates
      return {
        x: x - singleDocWidth - gap,
        y,
      };
    }
    return { x, y };
  };

  // Update shape preview rendering
  const getPreviewLeft = (x: number, isTranslated: boolean) => {
    if (currentView === "split" && isTranslated) {
      return x * scale + pageWidth * scale + 20;
    }
    return x * scale;
  };

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Add the additional styles */}
      <style>{`
        /* EXACT COPY FROM DocumentCanvas - PDF Canvas styling */
        .react-pdf__Page__canvas {
          display: block !important;
          position: relative !important;
          z-index: 1 !important;
        }

        /* CRITICAL: Text layer positioning - must exactly overlay the canvas */
        .react-pdf__Page__textContent {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 2 !important;
          pointer-events: none !important;
          overflow: hidden !important;
          /* Ensure text layer doesn't interfere with layout */
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }

        /* CRITICAL: Force PDF content to stay below interactive elements */
        .react-pdf__Document {
          position: relative !important;
          z-index: 1 !important;
        }

        .react-pdf__Page {
          position: relative !important;
          z-index: 1 !important;
          pointer-events: none !important;
        }

        .react-pdf__Page__canvas {
          z-index: 1 !important;
          pointer-events: auto !important;
        }

        .react-pdf__Page__textContent {
          z-index: 2 !important;
          pointer-events: none !important;
        }

        /* Enable pointer events for text content only in specific modes */
        .add-text-box-mode .react-pdf__Page__textContent {
          pointer-events: auto !important;
        }

        .text-selection-mode .react-pdf__Page__textContent {
          pointer-events: auto !important;
        }

        /* Ensure document container has proper stacking context */
        .document-page {
          position: relative !important;
          z-index: 1 !important;
        }

        /* CRITICAL: Interactive elements must be above PDF */
        .rnd {
          z-index: 10000 !important;
          position: absolute !important;
        }

        /* Ensure selected elements are on top */
        .rnd.selected {
          z-index: 20000 !important;
        }

        /* Ensure textboxes and shapes are visible above PDF */
        .text-field-overlay {
          position: absolute !important;
          z-index: 10000 !important;
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
        
        /* Text span click styling - shows icons on click */
        .text-span-clicked {
          position: relative !important;
        }
        
        .text-span-icons {
          position: absolute !important;
          pointer-events: auto !important;
          z-index: 100 !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
        }
        
        /* Delete icon - top left */
        .text-span-icon-delete {
          position: absolute !important;
          top: -8px !important;
          left: -8px !important;
          width: 16px !important;
          height: 16px !important;
          background-color: #ef4444 !important;
          color: white !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 12px !important;
          font-weight: bold !important;
          opacity: 1 !important;
          cursor: pointer !important;
          z-index: 101 !important;
          line-height: 1 !important;
          pointer-events: auto !important;
        }
        
        /* Edit icon - top right */
        .text-span-icon-edit {
          position: absolute !important;
          top: -8px !important;
          right: -8px !important;
          width: 16px !important;
          height: 16px !important;
          background-color: #3b82f6 !important;
          color: white !important;
          border-radius: 50% !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          font-size: 10px !important;
          font-weight: bold !important;
          opacity: 1 !important;
          cursor: pointer !important;
          z-index: 101 !important;
          line-height: 1 !important;
          pointer-events: auto !important;
        }
        
        /* Hover effects for icons */
        .text-span-icon-delete:hover {
          background-color: #dc2626 !important;
          transform: scale(1.1) !important;
        }
        
        .text-span-icon-edit:hover {
          background-color: #2563eb !important;
          transform: scale(1.1) !important;
        }

        /* Ensure text fields are properly layered above text layer */
        .text-field-overlay {
          position: absolute !important;
          z-index: 100 !important;
        }

        /* Fix any potential scaling issues */
        .add-text-box-mode .react-pdf__Page {
          transform-origin: top left !important;
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
          width: 14px !important;
          height: 14px !important;
          bottom: -7px !important;
          right: -7px !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          opacity: 1 !important;
          transition: opacity 0.2s ease !important;
        }

        .rnd .react-resizable-handle-se::after {
          content: "" !important;
          position: absolute !important;
          width: 8px !important;
          height: 8px !important;
          background-image: 
            linear-gradient(45deg, transparent 30%, white 30%, white 40%, transparent 40%),
            linear-gradient(45deg, transparent 60%, white 60%, white 70%, transparent 70%) !important;
          background-size: 8px 8px !important;
          background-repeat: no-repeat !important;
          opacity: 1 !important;
        }

        .rnd:hover .react-resizable-handle-se,
        .rnd.selected .react-resizable-handle-se {
          opacity: 1 !important;
        }

        /* Also target the resize-handle class for better compatibility */
        .rnd .resize-handle {
          opacity: 1 !important;
        }

        .rnd .resize-handle::after {
          content: "" !important;
          position: absolute !important;
          width: 8px !important;
          height: 8px !important;
          background-image: 
            linear-gradient(45deg, transparent 30%, white 30%, white 40%, transparent 40%),
            linear-gradient(45deg, transparent 60%, white 60%, white 70%, transparent 70%) !important;
          background-size: 8px 8px !important;
          background-repeat: no-repeat !important;
          opacity: 1 !important;
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

        /* Add CSS to prevent click events from bubbling through shapes */
        .shape-element {
          pointer-events: auto !important;
        }
        
        .shape-content {
          pointer-events: none;
        }
        
        .text-format-drawer {
          pointer-events: auto !important;
        }

        /* Image element specific styles */
        .image-element {
          pointer-events: auto !important;
        }

        /* Image resize handle styles */
        .image-element .react-resizable-handle {
          background-color: #3b82f6 !important;
          border: 2px solid #ffffff;
          border-radius: 50%;
          width: 12px !important;
          height: 12px !important;
          opacity: 0;
          transition: opacity 0.2s ease, transform 0.2s ease;
          z-index: 100;
        }

        .image-element:hover .react-resizable-handle,
        .image-element.selected .react-resizable-handle {
          opacity: 1;
        }

        .image-element .react-resizable-handle:hover {
          transform: scale(1.3);
          background-color: #1d4ed8 !important;
          box-shadow: 0 2px 8px rgba(59, 130, 246, 0.4);
        }

        /* Corner handles for images */
        .image-element .react-resizable-handle-se,
        .image-element .react-resizable-handle-sw,
        .image-element .react-resizable-handle-ne,
        .image-element .react-resizable-handle-nw {
          width: 14px !important;
          height: 14px !important;
        }

        /* Edge handles for images */
        .image-element .react-resizable-handle-n,
        .image-element .react-resizable-handle-s,
        .image-element .react-resizable-handle-e,
        .image-element .react-resizable-handle-w {
          width: 12px !important;
          height: 12px !important;
        }

        /* Hide image resize handles when not in edit mode */
        .image-element:not(.edit-mode) .react-resizable-handle {
          display: none !important;
        }
      `}</style>

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
            <input
              type="file"
              ref={imageInputRef}
              onChange={handleImageUpload}
              accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
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
                            const pageImages = [
                              ...originalImages,
                              ...translatedImages,
                            ].filter((image) => image.page === pageNum);
                            const totalElements =
                              pageTextBoxes.length +
                              pageShapes.length +
                              pageDeletions.length +
                              pageImages.length;

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
                                      {pageImages.length > 0 && (
                                        <span className="flex items-center space-x-1">
                                          <ImageIcon className="w-3 h-3" />
                                          <span>{pageImages.length}</span>
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
          {/* ElementFormatDrawer - Positioned at top of main content area */}
          <div
            className={`relative z-40 transition-all duration-300 ${
              isSidebarCollapsed ? "" : ""
            }`}
          >
            <ElementFormatDrawer />
          </div>

          {/* Erasure Tool Controls */}
          {isErasureMode && (
            <div
              className={`absolute z-50 bg-white/95 backdrop-blur-sm shadow-lg border border-gray-200 p-4 rounded-lg transition-all duration-300 ${
                isSidebarCollapsed ? "left-4" : "left-4"
              }`}
              style={{
                top: "300px", // Below the floating toolbar
                minWidth: "280px",
              }}
            >
              <div className="space-y-3">
                {/* Opacity */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-20">Opacity:</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={erasureSettings.opacity}
                    onChange={(e) =>
                      setErasureSettings((prev) => ({
                        ...prev,
                        opacity: parseFloat(e.target.value),
                      }))
                    }
                    className="flex-1 w-5"
                  />
                  <span className="text-xs text-gray-500 w-10">
                    {Math.round(erasureSettings.opacity * 100)}%
                  </span>
                </div>

                {/* Page Background Color Picker */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-600 w-20">Page BG:</label>
                  <input
                    type="color"
                    value={
                      pdfBackgroundColor.startsWith("#")
                        ? pdfBackgroundColor
                        : rgbStringToHex(pdfBackgroundColor)
                    }
                    onChange={(e) => {
                      const newColor = e.target.value;
                      setPdfBackgroundColor(newColor);

                      // Update all existing deletion rectangles to use the new background color
                      setOriginalDeletionRectangles((prev) =>
                        prev.map((rect) => ({
                          ...rect,
                          background: newColor,
                        }))
                      );
                      setTranslatedDeletionRectangles((prev) =>
                        prev.map((rect) => ({
                          ...rect,
                          background: newColor,
                        }))
                      );
                    }}
                    className="w-8 h-8 rounded border border-gray-300 cursor-pointer"
                  />
                  <span className="text-xs text-gray-500">
                    {pdfBackgroundColor}
                  </span>
                </div>
              </div>
            </div>
          )}

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
                    setIsErasureMode(false);
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
                    setIsErasureMode(false);
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
                    setIsErasureMode(false);
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
                    setIsErasureMode(false);
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

              <button
                onClick={() => {
                  // Toggle erasure mode and disable other modes
                  const newMode = !isErasureMode;
                  setIsErasureMode(newMode);
                  if (newMode) {
                    setIsTextSelectionMode(false);
                    setIsAddTextBoxMode(false);
                    setShapeDrawingMode(null);
                    setIsDrawingInProgress(false);
                    setShapeDrawStart(null);
                    setShapeDrawEnd(null);
                    setShapeDrawTargetView(null);
                  }
                }}
                className={`p-2 rounded-md transition-all duration-200 hover:bg-red-50 ${
                  isErasureMode
                    ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
                    : "text-gray-700 hover:text-red-600"
                }`}
                title="Erasure Tool (Draw deletion rectangles)"
              >
                <Eraser className="w-5 h-5" />
              </button>

              <button
                onClick={() => {
                  // Disable other modes
                  setIsTextSelectionMode(false);
                  setIsAddTextBoxMode(false);
                  setShapeDrawingMode(null);
                  setIsErasureMode(false);
                  setIsDrawingInProgress(false);
                  setShapeDrawStart(null);
                  setShapeDrawEnd(null);
                  setShapeDrawTargetView(null);
                  // Trigger file input directly
                  imageInputRef.current?.click();
                }}
                className="p-2 rounded-md transition-all duration-200 hover:bg-red-50 text-gray-700 hover:text-red-600"
                title="Add Image to Document"
              >
                <ImageIcon className="w-5 h-5" />
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
                  } ${isErasureMode ? "cursor-crosshair" : ""} ${
                    isCtrlPressed ? "cursor-zoom-in" : ""
                  }`}
                  onClick={handleDocumentContainerClick}
                  onMouseDown={
                    isTextSelectionMode || isErasureMode
                      ? handleDocumentMouseDown
                      : undefined
                  }
                  onMouseMove={
                    shapeDrawingMode
                      ? handleShapeDrawMove
                      : isTextSelectionMode
                      ? handleDocumentMouseMove
                      : isErasureMode
                      ? handleErasureDrawMove
                      : undefined
                  }
                  onMouseUp={
                    shapeDrawingMode
                      ? handleShapeDrawEnd
                      : isTextSelectionMode
                      ? handleDocumentMouseUp
                      : isErasureMode
                      ? handleErasureDrawEnd
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
                      >
                        {/* Transform button if page not translated */}
                        {!isPageTranslated.get(currentPage) && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <button
                              onClick={handleTransformPageToTextbox}
                              disabled={isTransforming}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 flex items-center space-x-2"
                              title="Transform current page to textboxes using OCR"
                            >
                              {isTransforming ? (
                                <>
                                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                  <span>Transforming...</span>
                                </>
                              ) : (
                                <>
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                                    />
                                  </svg>
                                  <span>Transform JSON to Textbox</span>
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>

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

                        {/* Original Document Elements - Wrapped for proper z-index */}
                        <div
                          className="absolute inset-0"
                          style={{ zIndex: 10000 }}
                        >
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
                                  zIndex: showDeletionRectangles ? 40 : 25,
                                  backgroundColor: rect.background
                                    ? colorToRgba(
                                        rect.background,
                                        rect.opacity || 1.0
                                      )
                                    : "white",
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

                          {/* Original Elements in Layer Order */}
                          {getOriginalSortedElements.map(
                            ({ type, element }) => {
                              if (type === "textbox") {
                                const textBox = element as TextField;
                                return (
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
                                          box.id === id
                                            ? { ...box, ...updates }
                                            : box
                                        )
                                      );
                                    }}
                                    onDelete={(id) => {
                                      setOriginalTextBoxes((prev) =>
                                        prev.filter((box) => box.id !== id)
                                      );
                                      removeFromLayerOrder(id);
                                      setSelectedFieldId((current) =>
                                        current === id ? null : current
                                      );
                                    }}
                                    isTextSelectionMode={isTextSelectionMode}
                                    isSelectedInTextMode={selectedTextBoxes.textBoxIds.includes(
                                      textBox.id
                                    )}
                                    onTextSelectionClick={
                                      handleTextBoxSelectionMode
                                    }
                                  />
                                );
                              } else if (type === "shape") {
                                const shape = element as Shape;
                                return (
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
                                      removeFromLayerOrder(id);
                                      if (selectedShapeId === id) {
                                        setSelectedShapeId(null);
                                      }
                                    }}
                                  />
                                );
                              } else if (type === "image") {
                                const image = element as Image;
                                return (
                                  <MemoizedImage
                                    key={`orig-image-${image.id}`}
                                    image={image}
                                    isSelected={selectedElementId === image.id}
                                    isEditMode={isEditMode}
                                    scale={scale}
                                    onSelect={(id) => {
                                      setSelectedElementId(id);
                                      setSelectedElementType("image");
                                      setCurrentFormat(image);
                                      setIsDrawerOpen(true);
                                    }}
                                    onUpdate={(id, updates) => {
                                      setOriginalImages((prev) =>
                                        prev.map((img) =>
                                          img.id === id
                                            ? { ...img, ...updates }
                                            : img
                                        )
                                      );
                                      setCurrentFormat({
                                        ...image,
                                        ...updates,
                                      });
                                    }}
                                    onDelete={(id) => {
                                      setOriginalImages((prev) =>
                                        prev.filter((img) => img.id !== id)
                                      );
                                      removeFromLayerOrder(id);
                                      if (selectedElementId === id) {
                                        setSelectedElementId(null);
                                        setSelectedElementType(null);
                                        setCurrentFormat(null);
                                      }
                                    }}
                                  />
                                );
                              }
                              return null;
                            }
                          )}
                        </div>
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

                          {/* Transform JSON Button - positioned in the middle */}
                          {!isPageTranslated.get(currentPage) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <button
                                onClick={handleTransformPageToTextbox}
                                disabled={isTransforming}
                                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg shadow-lg transition-all duration-200 hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100 flex items-center space-x-2"
                                title="Transform current page to textboxes using OCR"
                              >
                                {isTransforming ? (
                                  <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Transforming...</span>
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="w-5 h-5"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                                      />
                                    </svg>
                                    <span>Transform JSON to Textbox</span>
                                  </>
                                )}
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Translated Document Elements - Wrapped for proper z-index */}
                        <div
                          className="absolute inset-0"
                          style={{ zIndex: 10000 }}
                        >
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
                                  zIndex: showDeletionRectangles ? 40 : 25,
                                  backgroundColor: rect.background
                                    ? colorToRgba(
                                        rect.background,
                                        rect.opacity || 1.0
                                      )
                                    : "white",
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

                          {/* Translated Elements in Layer Order */}
                          {getTranslatedSortedElements.map(
                            ({ type, element }) => {
                              if (type === "textbox") {
                                const textBox = element as TextField;
                                return (
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
                                          box.id === id
                                            ? { ...box, ...updates }
                                            : box
                                        )
                                      );
                                    }}
                                    onDelete={(id) => {
                                      setTranslatedTextBoxes((prev) =>
                                        prev.filter((box) => box.id !== id)
                                      );
                                      removeFromLayerOrder(id);
                                      setSelectedFieldId((current) =>
                                        current === id ? null : current
                                      );
                                    }}
                                    isTextSelectionMode={isTextSelectionMode}
                                    isSelectedInTextMode={selectedTextBoxes.textBoxIds.includes(
                                      textBox.id
                                    )}
                                    onTextSelectionClick={
                                      handleTextBoxSelectionMode
                                    }
                                  />
                                );
                              } else if (type === "shape") {
                                const shape = element as Shape;
                                return (
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
                                      removeFromLayerOrder(id);
                                      if (selectedShapeId === id) {
                                        setSelectedShapeId(null);
                                      }
                                    }}
                                  />
                                );
                              } else if (type === "image") {
                                const image = element as Image;
                                return (
                                  <MemoizedImage
                                    key={`trans-image-${image.id}`}
                                    image={image}
                                    isSelected={selectedElementId === image.id}
                                    isEditMode={isEditMode}
                                    scale={scale}
                                    onSelect={(id) => {
                                      setSelectedElementId(id);
                                      setSelectedElementType("image");
                                      setCurrentFormat(image);
                                      setIsDrawerOpen(true);
                                    }}
                                    onUpdate={(id, updates) => {
                                      setTranslatedImages((prev) =>
                                        prev.map((img) =>
                                          img.id === id
                                            ? { ...img, ...updates }
                                            : img
                                        )
                                      );
                                      setCurrentFormat({
                                        ...image,
                                        ...updates,
                                      });
                                    }}
                                    onDelete={(id) => {
                                      setTranslatedImages((prev) =>
                                        prev.filter((img) => img.id !== id)
                                      );
                                      removeFromLayerOrder(id);
                                      if (selectedElementId === id) {
                                        setSelectedElementId(null);
                                        setSelectedElementType(null);
                                        setCurrentFormat(null);
                                      }
                                    }}
                                  />
                                );
                              }
                              return null;
                            }
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Show interactive elements in both original and translated views */}
                  {(currentView === "original" ||
                    currentView === "translated") && (
                    <div className="absolute inset-0" style={{ zIndex: 10000 }}>
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
                            zIndex: showDeletionRectangles ? 40 : 25,
                            backgroundColor: rect.background
                              ? colorToRgba(
                                  rect.background,
                                  rect.opacity || 1.0
                                )
                              : "white",
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

                      {/* Render elements in layer order */}
                      {getCurrentPageSortedElements.map(({ type, element }) => {
                        if (type === "textbox") {
                          const textBox = element as TextField;
                          return (
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
                          );
                        } else if (type === "shape") {
                          const shape = element as Shape;
                          return (
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
                          );
                        } else if (type === "image") {
                          const image = element as Image;
                          return (
                            <MemoizedImage
                              key={image.id}
                              image={image}
                              isSelected={selectedElementId === image.id}
                              isEditMode={isEditMode}
                              scale={scale}
                              onSelect={(id) => {
                                setSelectedElementId(id);
                                setSelectedElementType("image");
                                setCurrentFormat(image);
                                setIsDrawerOpen(true);
                              }}
                              onUpdate={(id, updates) => {
                                setCurrentImages((prev) =>
                                  prev.map((img) =>
                                    img.id === id ? { ...img, ...updates } : img
                                  )
                                );
                                setCurrentFormat({ ...image, ...updates });
                              }}
                              onDelete={(id) => {
                                setCurrentImages((prev) =>
                                  prev.filter((img) => img.id !== id)
                                );
                                removeFromLayerOrder(id);
                                if (selectedElementId === id) {
                                  setSelectedElementId(null);
                                  setSelectedElementType(null);
                                  setCurrentFormat(null);
                                }
                              }}
                            />
                          );
                        }
                        return null;
                      })}

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
                              left: getPreviewLeft(
                                Math.min(shapeDrawStart.x, shapeDrawEnd.x),
                                currentView === "translated"
                              ),
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

                      {/* Erasure Drawing Preview */}
                      {isDrawingErasure &&
                        erasureDrawStart &&
                        erasureDrawEnd && (
                          <div
                            className="absolute border-2 border-dashed pointer-events-none"
                            style={{
                              left: getPreviewLeft(
                                Math.min(erasureDrawStart.x, erasureDrawEnd.x),
                                currentView === "translated"
                              ),
                              top:
                                Math.min(erasureDrawStart.y, erasureDrawEnd.y) *
                                scale,
                              width:
                                Math.abs(
                                  erasureDrawEnd.x - erasureDrawStart.x
                                ) * scale,
                              height:
                                Math.abs(
                                  erasureDrawEnd.y - erasureDrawStart.y
                                ) * scale,
                              backgroundColor: colorToRgba(
                                pdfBackgroundColor,
                                erasureSettings.opacity
                              ),
                              zIndex: 50,
                            }}
                          />
                        )}
                    </div>
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
                      originalImages.filter(
                        (image) => image.page === currentPage
                      ).length
                    }{" "}
                    images
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
                      translatedImages.filter(
                        (image) => image.page === currentPage
                      ).length
                    }{" "}
                    images
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
                <span>Images: {getCurrentPageImages.length}</span>
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
