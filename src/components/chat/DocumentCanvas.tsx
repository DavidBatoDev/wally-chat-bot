// client/src/components/chat/DocumentCanvas.tsx
import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  X,
  Download,
  Save,
  Edit3,
  Type,
  Plus,
  Trash2,
  Move,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Minus,
  Layout,
  MousePointer2,
  Maximize2,
  MoreHorizontal,
  Circle,
  Square,
  Palette,
  File,
  FileText,
  Languages,
  Loader2,
  Undo,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";

// Add the useWorkflowData hook import
import { useWorkflowData } from "./DepractedDocumentCanvas/hooks/useWorkflowData";
import { WorkflowData, TemplateMapping } from "./DepractedDocumentCanvas/types/workflow";
import api from "@/lib/api";
import { getLanguageCode } from "@/lib/languageUtils";

// Helper function to generate UUID
const generateUUID = (): string => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback UUID generation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

// Helper function to extract clean file extension from URL (handles query parameters)
const getCleanExtension = (url: string): string => {
  if (!url) return "";

  // Remove query parameters first (everything after ?)
  const urlWithoutQuery = url.split("?")[0];

  // Extract extension
  const extension = urlWithoutQuery.split(".").pop()?.toLowerCase() || "";

  return extension;
};

// Helper function to detect file type from URL
const getFileType = (url: string): "pdf" | "image" => {
  if (!url) return "image"; // Changed default to image to be safer

  const extension = getCleanExtension(url);
  const imageExtensions = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "svg",
    "tiff",
    "tif",
  ];
  const pdfExtensions = ["pdf"];

  if (imageExtensions.includes(extension)) {
    return "image";
  }

  if (pdfExtensions.includes(extension)) {
    return "pdf";
  }

  // Default to image for unknown extensions to be safe
  return "image";
};

// Additional helper to absolutely ensure we never load images in PDF.js
const isPdfFile = (url: string): boolean => {
  if (!url) return false;
  const extension = getCleanExtension(url);
  return extension === "pdf";
};

const isImageFile = (url: string): boolean => {
  if (!url) return false;
  const extension = getCleanExtension(url);
  const imageExtensions = [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "bmp",
    "webp",
    "svg",
    "tiff",
    "tif",
  ];
  return imageExtensions.includes(extension);
};

const measureText = (
  text: string,
  fontSize: number,
  fontFamily: string,
  characterSpacing: number = 0
): { width: number; height: number } => {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: 0, height: 0 };

  ctx.font = `${fontSize}px ${fontFamily}`;
  const lines = text.split("\n");

  let maxWidth = 0;
  lines.forEach((line) => {
    let width = ctx.measureText(line).width;
    if (line.length > 0) {
      // Add extra width for character spacing
      width += characterSpacing * (line.length - 1);
    }
    if (width > maxWidth) maxWidth = width;
  });

  // Match the textarea's lineHeight: "1.1" instead of 1.2
  const lineHeight = fontSize * 1.1;
  const height = lines.length * lineHeight;

  return {
    width: maxWidth,
    height,
  };
};

// Helper function to convert hex color to rgba with opacity
const hexToRgba = (hex: string, opacity: number): string => {
  // Remove # if present and validate hex format
  const cleanHex = hex.replace("#", "");

  // Handle short hex format (e.g., "fff" becomes "ffffff")
  const fullHex =
    cleanHex.length === 3
      ? cleanHex
          .split("")
          .map((c) => c + c)
          .join("")
      : cleanHex;

  // Validate hex format
  if (!/^[0-9A-Fa-f]{6}$/.test(fullHex)) {
    console.warn(`Invalid hex color: ${hex}, using black as fallback`);
    return `rgba(0, 0, 0, ${opacity})`;
  }

  // Parse the hex color
  const r = parseInt(fullHex.substring(0, 2), 16);
  const g = parseInt(fullHex.substring(2, 4), 16);
  const b = parseInt(fullHex.substring(4, 6), 16);

  // Clamp opacity between 0 and 1
  const clampedOpacity = Math.max(0, Math.min(1, opacity));

  return `rgba(${r}, ${g}, ${b}, ${clampedOpacity})`;
};

// Set up PDF.js worker with unpkg CDN (more reliable)
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface DocumentCanvasProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId?: string; // Optional for workflow context
}

interface TextField {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  value: string;
  fontSize: number;
  fontColor: string;
  fontFamily: string;
  page: number;
  fieldKey?: string;
  isFromWorkflow?: boolean;
  characterSpacing?: number; // Optional for character spacing
  fontWeight?: "normal" | "bold";
  fontStyle?: "normal" | "italic";
  rotation?: number; // Rotation angle in degrees
  status?: string; // Field status for styling
}

// Extended TemplateMapping interface for new fields
interface ExtendedTemplateMapping extends TemplateMapping {
  character_spacing?: number;
  font_weight?: "normal" | "bold";
  font_style?: "normal" | "italic";
  rotation?: number;
  font_color?: string;
}

// Use imported WorkflowData and TemplateMapping types from the workflow types file

interface TextSelectionPopupState {
  texts: {
    pageSize: any;
    text: string;
    position: { top: number; left: number };
    pagePosition: { x: number; y: number };
  }[];
  popupPosition: {
    top: number;
    left: number;
    position: "above" | "below";
  };
}

interface Rectangles {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  tab: TabType; // Add tab property to make rectangles tab-specific
  pagePosition: { x: number; y: number };
  pageSize: { width: number; height: number };
  background?: string; // Add this for background color
}

// Add new Shape interface
interface Shape {
  id: string;
  type: "circle" | "rectangle";
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  tab: TabType;
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  fillOpacity: number;
  rotation?: number;
}

// Add tab type
type TabType = "document" | "original" | "translated";

interface TranslateFieldButtonProps {
  fieldKey: string;
  conversationId: string;
  originalValue: string;
  setTranslatedValue: (val: string) => void;
  translateTo: string;
  translateFrom?: string;
}

const TranslateFieldButton: React.FC<TranslateFieldButtonProps> = ({
  fieldKey,
  conversationId,
  originalValue,
  setTranslatedValue,
  translateTo,
  translateFrom,
}) => {
  const [loading, setLoading] = React.useState(false);
  const [hasBeenTranslated, setHasBeenTranslated] = React.useState(false);
  const [prevValue, setPrevValue] = React.useState<string>("");

  const handleTranslate = async () => {
    if (!originalValue) return;
    if (hasBeenTranslated) {
      setTranslatedValue(prevValue);
      setHasBeenTranslated(false);
      return;
    }
    setLoading(true);
    setPrevValue("");
    try {
      setPrevValue("");
      const targetLanguage = getLanguageCode(translateTo);
      const sourceLanguage = translateFrom
        ? getLanguageCode(translateFrom)
        : undefined;
      setPrevValue("");
      const response = await api.post(
        `api/workflow/${conversationId}/translate-field`,
        {
          field_key: fieldKey,
          target_language: targetLanguage,
          source_language: sourceLanguage,
          use_gemini: false,
        }
      );
      if (response.data.success) {
        setPrevValue("");
        setTranslatedValue(response.data.translated_value);
        setHasBeenTranslated(true);
      } else {
        throw new Error(response.data.message || "Translation failed");
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Field translation error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            onClick={handleTranslate}
            disabled={loading || !originalValue}
            className="h-7 text-xs whitespace-nowrap"
          >
            {loading ? (
              <span className="flex items-center">
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                ...
              </span>
            ) : hasBeenTranslated ? (
              <span className="flex items-center">
                <Undo size={12} className="mr-1" />
                Undo
              </span>
            ) : (
              <span className="flex items-center">
                <Languages size={12} className="mr-1" />
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            {!originalValue
              ? "No original value to translate from"
              : hasBeenTranslated
              ? "Undo translation and restore original value"
              : "Translate field based on the original value"}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  // Add workflow data state
  const {
    workflowData: originalWorkflowData,
    loading: workflowLoading,
    error: workflowError,
    fetchWorkflowData,
  } = useWorkflowData(conversationId || "");

  // Add tab state
  const [currentTab, setCurrentTab] = useState<TabType>("original");

  // Local editable copy of workflow data
  const [localWorkflowData, setLocalWorkflowData] =
    useState<WorkflowData | null>(null);

  // Add unsaved changes tracking
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState<boolean>(false);

  // Add translate all state
  const [isTranslatingAll, setIsTranslatingAll] = useState<boolean>(false);
  const [initialWorkflowData, setInitialWorkflowData] =
    useState<WorkflowData | null>(null);
  const [showSaveConfirmation, setShowSaveConfirmation] =
    useState<boolean>(false);
  const [showSavedIndicator, setShowSavedIndicator] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Status color mapping
  const getStatusColor = (status: string): string => {
    switch (status) {
      case "pending":
        return "#f59e0b"; // amber
      case "ocr":
        return "#3b82f6"; // blue
      case "translated":
        return "#10b981"; // emerald
      case "edited":
        return "#f97316"; // orange
      case "confirmed":
        return "#22c55e"; // green
      default:
        return "#6b7280"; // gray
    }
  };

  // Get status label
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case "pending":
        return "Pending";
      case "ocr":
        return "OCR Extracted";
      case "translated":
        return "Translated";
      case "edited":
        return "Edited";
      case "confirmed":
        return "Confirmed";
      default:
        return "Unknown";
    }
  };

  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [showWorkflowFields, setShowWorkflowFields] = useState<boolean>(true);
  const [isTextSelectionMode, setIsTextSelectionMode] =
    useState<boolean>(false);
  const [pageWidth, setPageWidth] = useState<number>(612);
  const [pageHeight, setPageHeight] = useState<number>(792);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isAddTextBoxMode, setIsAddTextBoxMode] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [textSelectionPopup, setTextSelectionPopup] =
    useState<TextSelectionPopupState | null>(null);
  const [zoomMode, setZoomMode] = useState<"page" | "width">("page");
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [settingsPopupFor, setSettingsPopupFor] = useState<string | null>(null);
  const [fileType, setFileType] = useState<"pdf" | "image" | null>(null);
  const [imageDimensions, setImageDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [isFileTypeDetected, setIsFileTypeDetected] = useState<boolean>(false);
  const [isDocumentLoaded, setIsDocumentLoaded] = useState<boolean>(false);

  // Add drag state for smooth dragging - using refs instead of state for performance
  const dragStatesRef = useRef<
    Record<string, { x: number; y: number; element: HTMLElement | null }>
  >({});
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const isDraggingRef = useRef<Record<string, boolean>>({});

  // Add shape drag state for smooth shape dragging
  const shapeDragStatesRef = useRef<
    Record<string, { x: number; y: number; element: HTMLElement | null }>
  >({});
  const shapeDragRafRef = useRef<number | null>(null);
  const isShapeDraggingRef = useRef<Record<string, boolean>>({});

  // Global mouse event handlers to ensure drag stops work properly
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      // Clear all active field drags on global mouse up
      Object.keys(isDraggingRef.current).forEach((fieldId) => {
        if (isDraggingRef.current[fieldId]) {
          try {
            const dragState = dragStatesRef.current[fieldId];
            if (dragState?.element) {
              const element = dragState.element;
              if (
                element &&
                typeof element === "object" &&
                element.isConnected &&
                element.style &&
                typeof element.style === "object"
              ) {
                element.style.transform = "";
                element.style.willChange = "auto";
              }
            }
          } catch (error) {
            console.warn(
              "Error cleaning up field transform on global mouse up:",
              error
            );
          }
          delete dragStatesRef.current[fieldId];
          delete isDraggingRef.current[fieldId];
        }
      });

      // Clear all active shape drags on global mouse up
      Object.keys(isShapeDraggingRef.current).forEach((shapeId) => {
        if (isShapeDraggingRef.current[shapeId]) {
          try {
            const dragState = shapeDragStatesRef.current[shapeId];
            if (dragState?.element) {
              const element = dragState.element;
              if (
                element &&
                typeof element === "object" &&
                element.isConnected &&
                element.style &&
                typeof element.style === "object"
              ) {
                element.style.transform = "";
                element.style.willChange = "auto";
              }
            }
          } catch (error) {
            console.warn(
              "Error cleaning up shape transform on global mouse up:",
              error
            );
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
    document.addEventListener("mouseleave", handleGlobalMouseUp); // Also handle when mouse leaves window

    return () => {
      document.removeEventListener("mouseup", handleGlobalMouseUp);
      document.removeEventListener("mouseleave", handleGlobalMouseUp);
    };
  }, []);

  // Add new shape-related state
  const [isDrawingShape, setIsDrawingShape] = useState<boolean>(false);
  const [shapeDrawingMode, setShapeDrawingMode] = useState<
    "circle" | "rectangle" | null
  >(null);
  const [selectedShapeType, setSelectedShapeType] = useState<
    "circle" | "rectangle"
  >("rectangle");
  const [shapeDropdownOpen, setShapeDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const shapeButtonRef = useRef<HTMLButtonElement>(null);
  const [fieldStatusDropdownOpen, setFieldStatusDropdownOpen] = useState(false);
  const fieldStatusButtonRef = useRef<HTMLButtonElement>(null);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [isDrawingInProgress, setIsDrawingInProgress] =
    useState<boolean>(false);
  const [shapeDrawStart, setShapeDrawStart] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [shapeDrawEnd, setShapeDrawEnd] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const documentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(
    null
  );
  const [dragEnd, setDragEnd] = useState<{ x: number; y: number } | null>(null);
  const [mouseDownTime, setMouseDownTime] = useState<number | null>(null);
  const [showRectangles, setShowRectangles] = useState(true);
  const [isRotating, setIsRotating] = useState<boolean>(false);
  const [rotatingFieldId, setRotatingFieldId] = useState<string | null>(null);
  const [initialRotation, setInitialRotation] = useState<number>(0);
  const [rotationCenter, setRotationCenter] = useState<{
    x: number;
    y: number;
  } | null>(null);

  const styles = `
    .drag-handle:active {
      transform: scale(0.95) !important;
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
      content: '';
      position: absolute;
      bottom: 2px;
      right: 2px;
      width: 8px;
      height: 8px;
      background-image: 
        linear-gradient(45deg, transparent 40%, #666 40%, #666 60%, transparent 60%),
        linear-gradient(45deg, transparent 40%, #666 40%, #666 60%, transparent 60%);
      background-size: 4px 1px, 1px 4px;
      background-position: 2px 6px, 6px 2px;
      background-repeat: no-repeat;
      opacity: 0.6;
      transition: opacity 0.2s;
    }

    .rnd:hover .react-resizable-handle-se::after {
      opacity: 1;
    }

    /* Hide all other resize handles */
    .rnd .react-resizable-handle:not(.react-resizable-handle-se) {
      display: none !important;
    }

    /* CRITICAL: PDF Page Container Fixes */
    .react-pdf__Page {
      position: relative !important;
      display: inline-block !important;
      vertical-align: top !important;
    }
    
    /* CRITICAL: Canvas positioning */
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
    
    /* Text spans positioning */
    .react-pdf__Page__textContent span {
      position: absolute !important;
      white-space: nowrap !important;
      color: transparent !important;
      line-height: 1 !important;
      pointer-events: none !important;
      transform-origin: 0% 0% !important;
    }
    
    /* Enable pointer events and styling only in text selection mode */
    .text-selection-mode .react-pdf__Page__textContent {
      pointer-events: auto !important;
      z-index: 50 !important;
    }
    
    .text-selection-mode .react-pdf__Page__textContent span {
      cursor: pointer !important;
      color: rgba(0, 0, 0, 0.1) !important;
      background-color: rgba(59, 130, 246, 0.2) !important;
      transition: background-color 0.2s !important;
      pointer-events: auto !important;
      border-radius: 2px !important;
    }
    
    .text-selection-mode .react-pdf__Page__textContent span:hover {
      background-color: rgba(59, 130, 246, 0.4) !important;
      color: rgba(0, 0, 0, 0.3) !important;
    }
    
    /* Ensure text fields are properly layered above text layer */
    .text-field-overlay {
      position: absolute !important;
      z-index: 100 !important;
    }
    
    /* Fix any potential scaling issues */
    .text-selection-mode .react-pdf__Page {
      transform-origin: top left !important;
    }

    /* Custom vertical slider styling - Fixed */
    input[type="range"] {
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }

    input[type="range"]::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 16px;
      height: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
    }

    input[type="range"]::-moz-range-thumb {
      width: 16px;
      height: 12px;
      background: transparent;
      border: none;
      cursor: pointer;
      -moz-appearance: none;
    }

    input[type="range"]::-webkit-slider-track {
      background: transparent;
      height: 100%;
    }

    input[type="range"]::-moz-range-track {
      background: transparent;
      height: 100%;
      border: none;
    }

    input[type="range"]:focus {
      outline: none;
    }

    /* Shape drag handle styling */
    .shape-drag-handle {
      cursor: move;
      transition: transform 0.1s ease-out;
    }

    .shape-drag-handle:hover {
      cursor: move;
    }

    .shape-drag-handle:active {
      transform: scale(0.98) !important;
    }

    /* Shape resizing handles - customize for shapes */
    .rnd .react-resizable-handle {
      opacity: 0;
      transition: opacity 0.2s;
    }

    .rnd:hover .react-resizable-handle {
      opacity: 1;
    }

    /* Hide resize handles during drawing */
    .document-drawing .rnd .react-resizable-handle {
      display: none !important;
    }

    /* Enhanced Slider Styling for Better Visibility */
    .shape-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 8px;
      background: linear-gradient(to right, #e5e7eb 0%, #3b82f6 50%, #e5e7eb 100%);
      border-radius: 4px;
      outline: none;
      transition: all 0.2s ease;
      border: 1px solid #d1d5db;
    }

    .shape-slider:hover {
      background: linear-gradient(to right, #d1d5db 0%, #2563eb 50%, #d1d5db 100%);
      border-color: #3b82f6;
    }

    .shape-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #3b82f6;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.2);
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .shape-slider::-webkit-slider-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 0 0 2px rgba(59, 130, 246, 0.3);
      background: #2563eb;
    }

    .shape-slider::-webkit-slider-thumb:active {
      transform: scale(1.2);
      box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5), 0 0 0 3px rgba(59, 130, 246, 0.4);
    }

    .shape-slider::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: #3b82f6;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(59, 130, 246, 0.3), 0 0 0 1px rgba(59, 130, 246, 0.2);
      cursor: pointer;
      transition: all 0.2s ease;
      -moz-appearance: none;
    }

    .shape-slider::-moz-range-thumb:hover {
      transform: scale(1.1);
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 0 0 2px rgba(59, 130, 246, 0.3);
      background: #2563eb;
    }

    .shape-slider::-moz-range-track {
      background: transparent;
      border: none;
      height: 8px;
    }

    .shape-slider:focus {
      outline: none;
      border-color: #3b82f6;
    }

    .shape-slider:focus::-webkit-slider-thumb {
      box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4), 0 0 0 3px rgba(59, 130, 246, 0.3);
    }

    /* Rotation Slider Styling */
    .rotation-slider {
      -webkit-appearance: none;
      appearance: none;
      height: 12px;
      border-radius: 6px;
      outline: none;
      transition: all 0.2s ease;
      border: 2px solid #ef4444;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1);
      cursor: pointer;
    }

    .rotation-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4), 0 0 0 2px rgba(239, 68, 68, 0.2);
      cursor: pointer;
      transition: all 0.2s ease;
      position: relative;
    }

    .rotation-slider::-webkit-slider-thumb:hover {
      transform: scale(1.15);
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5), 0 0 0 3px rgba(239, 68, 68, 0.3);
      background: linear-gradient(135deg, #dc2626, #b91c1c);
    }

    .rotation-slider::-webkit-slider-thumb:active {
      transform: scale(1.25);
      box-shadow: 0 8px 20px rgba(239, 68, 68, 0.6), 0 0 0 4px rgba(239, 68, 68, 0.4);
    }

    .rotation-slider::-moz-range-thumb {
      width: 24px;
      height: 24px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ef4444, #dc2626);
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(239, 68, 68, 0.4), 0 0 0 2px rgba(239, 68, 68, 0.2);
      cursor: pointer;
      transition: all 0.2s ease;
      -moz-appearance: none;
    }

    .rotation-slider::-moz-range-thumb:hover {
      transform: scale(1.15);
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5), 0 0 0 3px rgba(239, 68, 68, 0.3);
      background: linear-gradient(135deg, #dc2626, #b91c1c);
    }

    .rotation-slider::-moz-range-track {
      background: transparent;
      border: none;
      height: 12px;
    }

    .rotation-slider:focus {
      outline: none;
      border-color: #dc2626;
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.1), 0 0 0 3px rgba(239, 68, 68, 0.2);
    }

    .rotation-slider:focus::-webkit-slider-thumb {
      box-shadow: 0 6px 16px rgba(239, 68, 68, 0.5), 0 0 0 4px rgba(239, 68, 68, 0.3);
    }

  `;

  // Initialize with workflow data when available
  useEffect(() => {
    if (conversationId) {
      fetchWorkflowData();
    }
  }, [conversationId, fetchWorkflowData]);

  // Initialize local workflow data from original data
  useEffect(() => {
    if (originalWorkflowData) {
      const localCopy = JSON.parse(JSON.stringify(originalWorkflowData));
      // Ensure shapes and deletion_rectangles are proper objects
      if (!localCopy.shapes || typeof localCopy.shapes !== "object") {
        localCopy.shapes = {};
      }
      if (
        !localCopy.deletion_rectangles ||
        typeof localCopy.deletion_rectangles !== "object"
      ) {
        localCopy.deletion_rectangles = {};
      }

      // Convert arrays to objects if needed (backend might send arrays)
      if (Array.isArray(localCopy.shapes)) {
        const shapesObj: Record<string, any> = {};
        localCopy.shapes.forEach((shape: any) => {
          if (shape && shape.id) {
            shapesObj[shape.id] = shape;
          }
        });
        localCopy.shapes = shapesObj;
      }

      if (Array.isArray(localCopy.deletion_rectangles)) {
        const rectanglesObj: Record<string, any> = {};
        localCopy.deletion_rectangles.forEach((rect: any) => {
          if (rect && rect.id) {
            rectanglesObj[rect.id] = rect;
          }
        });
        localCopy.deletion_rectangles = rectanglesObj;
      }

      console.log("Initializing local workflow data:", {
        shapes: localCopy.shapes,
        shapesCount: Object.keys(localCopy.shapes).length,
        deletion_rectangles: localCopy.deletion_rectangles,
        rectanglesCount: Object.keys(localCopy.deletion_rectangles).length,
      });

      setLocalWorkflowData(localCopy);
      setHasUnsavedChanges(false); // Reset unsaved changes when loading fresh data
    }
  }, [originalWorkflowData]);

  // Store initial workflow data for change detection
  useEffect(() => {
    if (localWorkflowData) {
      // Always update initial data when local data changes (to handle fresh loads)
      const currentDataString = JSON.stringify(localWorkflowData);
      const initialDataString = initialWorkflowData
        ? JSON.stringify(initialWorkflowData)
        : null;

      // Only update if the data actually changed or if we don't have initial data
      if (!initialWorkflowData || currentDataString !== initialDataString) {
        setInitialWorkflowData(JSON.parse(JSON.stringify(localWorkflowData)));

        // Only reset unsaved changes if this is the first time setting initial data
        // or if we're loading fresh data from the backend
        if (!initialWorkflowData) {
          setHasUnsavedChanges(false);
        }
      }
    }
  }, [localWorkflowData]);

  // Debug: Log localWorkflowData changes
  useEffect(() => {
    console.log("localWorkflowData state changed:", localWorkflowData);
  }, [localWorkflowData]);

  // Set document URL based on current tab and workflow data
  useEffect(() => {
    if (localWorkflowData) {
      let url = "";
      switch (currentTab) {
        case "document":
          url = localWorkflowData.base_file_public_url || "";
          break;
        case "original":
          url = localWorkflowData.template_file_public_url || "";
          break;
        case "translated":
          url = localWorkflowData.template_translated_file_public_url || "";
          break;
        default:
          url = "";
      }

      // Completely reset all states first
      setDocumentUrl("");
      setFileType(null);
      setError("");
      setIsFileTypeDetected(false);
      setNumPages(0);
      setCurrentPage(1);

      if (url) {
        // Detect file type synchronously and set everything at once
        const detectedFileType = getFileType(url);

        // Debug logging
        console.log("DocumentCanvas: File type detection", {
          url,
          detectedFileType,
          isImage: isImageFile(url),
          isPdf: isPdfFile(url),
          extension: getCleanExtension(url),
          originalUrl: url,
        });

        // Set all states together to prevent race conditions
        setTimeout(() => {
          setFileType(detectedFileType);
          setDocumentUrl(url);
          setIsFileTypeDetected(true);
        }, 100);
      } else {
        setIsFileTypeDetected(true);
      }
    }
  }, [
    currentTab,
    localWorkflowData?.base_file_public_url,
    localWorkflowData?.template_file_public_url,
    localWorkflowData?.template_translated_file_public_url,
  ]);

  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      if (isDragging) {
        e.preventDefault();
      }
    };

    document.addEventListener("contextmenu", handleContextMenu);
    return () => document.removeEventListener("contextmenu", handleContextMenu);
  }, [isDragging]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        settingsPopupFor &&
        !(e.target as Element).closest(".settings-popup")
      ) {
        setSettingsPopupFor(null);
      }

      // Close shape dropdown when clicking outside
      if (
        shapeDropdownOpen &&
        !(e.target as Element).closest(".shape-dropdown")
      ) {
        setShapeDropdownOpen(false);
      }

      // Close field status dropdown when clicking outside
      if (
        fieldStatusDropdownOpen &&
        !(e.target as Element).closest(".field-status-dropdown")
      ) {
        setFieldStatusDropdownOpen(false);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [settingsPopupFor, shapeDropdownOpen, fieldStatusDropdownOpen]);

  // Note: Workflow fields are now automatically derived from getTextFieldsFromWorkflowData

  // Calculate container width on resize
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerWidth(rect.width);
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize(); // Initial measurement

    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Adjust scale when in width mode
  useEffect(() => {
    if (zoomMode === "width" && containerWidth > 0 && pageWidth > 0) {
      const calculatedScale = containerWidth / pageWidth;
      setScale(Math.min(calculatedScale, 3.0)); // Max zoom 300%
    }
  }, [containerWidth, pageWidth, zoomMode]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (mouseDownTime && !isDragging) {
        // Mouse has been held for 100ms without moving
        setMouseDownTime(null);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [mouseDownTime, isDragging]);

  // Helper functions to work with shapes and rectangles
  const getShapesAsArray = useCallback((): Shape[] => {
    if (!localWorkflowData?.shapes) return [];
    return Object.values(localWorkflowData.shapes) as Shape[];
  }, [localWorkflowData?.shapes]);

  const getRectanglesAsArray = useCallback((): Rectangles[] => {
    if (!localWorkflowData?.deletion_rectangles) return [];
    return Object.values(localWorkflowData.deletion_rectangles) as Rectangles[];
  }, [localWorkflowData?.deletion_rectangles]);

  // Helper function to get current template mappings based on tab
  const getCurrentTemplateMappings = useCallback((): Record<
    string,
    ExtendedTemplateMapping
  > => {
    if (!localWorkflowData) return {};

    switch (currentTab) {
      case "original":
        return (localWorkflowData.origin_template_mappings || {}) as Record<
          string,
          ExtendedTemplateMapping
        >;
      case "translated":
        return (localWorkflowData.translated_template_mappings || {}) as Record<
          string,
          ExtendedTemplateMapping
        >;
      default:
        return {};
    }
  }, [localWorkflowData, currentTab]);

  // Helper function to derive text fields from workflow data
  const getTextFieldsFromWorkflowData = useCallback((): TextField[] => {
    if (!localWorkflowData || !pageWidth || !pageHeight) return [];

    const fields: TextField[] = [];
    const mappings = getCurrentTemplateMappings();

    Object.entries(mappings).forEach(([key, mapping]) => {
      const fieldData = localWorkflowData.fields?.[key];
      if (fieldData && mapping) {
        // Determine which value and status to use based on current tab
        let fieldValue = "";
        let fieldStatus = "pending";
        switch (currentTab) {
          case "original":
            fieldValue = fieldData.value || "";
            fieldStatus = fieldData.value_status || "pending";
            break;
          case "translated":
            fieldValue = fieldData.translated_value || "";
            fieldStatus = fieldData.translated_status || "pending";
            break;
        }

        // Calculate dimensions based on the value and font from mapping
        const { width, height } = calculateFieldDimensions(
          fieldValue,
          mapping.font.size,
          mapping.font.name || "Arial, sans-serif",
          mapping.character_spacing || 0
        );

        const field: TextField = {
          id: key, // Use the field key as ID
          x: mapping.position.x0,
          y: mapping.position.y0,
          width,
          height,
          value: fieldValue,
          fontSize: mapping.font.size,
          fontColor: mapping.font_color || "#000000", // Use font color from mapping or default to black
          fontFamily: mapping.font.name || "Arial, sans-serif",
          page: mapping.page_number,
          fieldKey: key,
          isFromWorkflow: !fieldData.isCustomField, // Custom fields are NOT from workflow
          characterSpacing: mapping.character_spacing || 0,
          fontWeight: mapping.font_weight || "normal",
          fontStyle: mapping.font_style || "normal",
          rotation: mapping.rotation || 0,
          status: fieldStatus,
        };

        fields.push(field);
      }
    });

    return fields;
  }, [
    localWorkflowData,
    pageHeight,
    pageWidth,
    currentTab,
    getCurrentTemplateMappings,
  ]);

  // Change tracking functions
  const markAsUnsaved = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  const checkForChanges = useCallback(() => {
    if (!localWorkflowData || !initialWorkflowData) return false;

    // Deep comparison of workflow data
    const currentDataString = JSON.stringify({
      fields: localWorkflowData.fields,
      origin_template_mappings: localWorkflowData.origin_template_mappings,
      translated_template_mappings:
        localWorkflowData.translated_template_mappings,
      shapes: localWorkflowData.shapes,
      deletion_rectangles: localWorkflowData.deletion_rectangles,
    });

    const initialDataString = JSON.stringify({
      fields: initialWorkflowData.fields,
      origin_template_mappings: initialWorkflowData.origin_template_mappings,
      translated_template_mappings:
        initialWorkflowData.translated_template_mappings,
      shapes: initialWorkflowData.shapes,
      deletion_rectangles: initialWorkflowData.deletion_rectangles,
    });

    return currentDataString !== initialDataString;
  }, [localWorkflowData, initialWorkflowData]);

  const updateTextField = useCallback(
    (fieldId: string, updates: Partial<TextField>) => {
      if (!localWorkflowData) return;

      setLocalWorkflowData((prev) => {
        if (!prev) return prev;

        const updatedData = { ...prev };

        // Update the appropriate template mapping
        const mappingKey =
          currentTab === "original"
            ? "origin_template_mappings"
            : "translated_template_mappings";
        const mappings = { ...(updatedData[mappingKey] || {}) };

        if (mappings[fieldId]) {
          const currentMapping = mappings[fieldId] as ExtendedTemplateMapping;

          // Update template mapping with positioning and styling info
          const positionUpdates: any = {};
          if (updates.x !== undefined || updates.y !== undefined) {
            const currentWidth =
              currentMapping.position.x1 - currentMapping.position.x0;
            const currentHeight =
              currentMapping.position.y1 - currentMapping.position.y0;
            const newX =
              updates.x !== undefined ? updates.x : currentMapping.position.x0;
            const newY =
              updates.y !== undefined ? updates.y : currentMapping.position.y0;

            positionUpdates.position = {
              ...currentMapping.position,
              x0: newX,
              x1: newX + currentWidth,
              y0: newY,
              y1: newY + currentHeight,
            };

            // Update bbox_center as well
            positionUpdates.bbox_center = {
              x: newX + currentWidth / 2,
              y: newY + currentHeight / 2,
            };
          }

          mappings[fieldId] = {
            ...currentMapping,
            ...positionUpdates,
            ...(updates.fontSize !== undefined && {
              font: { ...currentMapping.font, size: updates.fontSize },
            }),
            ...(updates.fontFamily !== undefined && {
              font: { ...currentMapping.font, name: updates.fontFamily },
            }),
            ...(updates.fontColor !== undefined && {
              font_color: updates.fontColor,
            }),
            ...(updates.characterSpacing !== undefined && {
              character_spacing: updates.characterSpacing,
            }),
            ...(updates.fontWeight !== undefined && {
              font_weight: updates.fontWeight,
            }),
            ...(updates.fontStyle !== undefined && {
              font_style: updates.fontStyle,
            }),
            ...(updates.rotation !== undefined && {
              rotation: updates.rotation,
            }),
          };

          updatedData[mappingKey] = mappings;
        }

        // Update field value if provided
        if (updates.value !== undefined && updatedData.fields?.[fieldId]) {
          const updatedFields = { ...updatedData.fields };
          const valueKey =
            currentTab === "original" ? "value" : "translated_value";
          const statusKey =
            currentTab === "original" ? "value_status" : "translated_status";

          // Set status based on whether the value is empty
          const newStatus = updates.value.trim() === "" ? "pending" : "edited";

          updatedFields[fieldId] = {
            ...updatedFields[fieldId],
            [valueKey]: updates.value,
            [statusKey]: newStatus,
          };
          updatedData.fields = updatedFields;
        }

        return updatedData as WorkflowData;
      });

      // Mark as unsaved when text field is updated
      markAsUnsaved();
    },
    [localWorkflowData, currentTab, markAsUnsaved]
  );

  // Handle rotation dragging
  useEffect(() => {
    const handleRotationMouseMove = (e: MouseEvent) => {
      if (!isRotating || !rotatingFieldId || !rotationCenter) return;

      // Calculate angle from field center to mouse position
      const deltaX = e.clientX - rotationCenter.x;
      const deltaY = e.clientY - rotationCenter.y;
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      // Normalize angle to 0-360 degrees
      const normalizedAngle = (angle + 90 + 360) % 360;

      updateTextField(rotatingFieldId, {
        rotation: Math.round(normalizedAngle),
      });
    };

    const handleRotationMouseUp = () => {
      setIsRotating(false);
      setRotatingFieldId(null);
      setRotationCenter(null);
    };

    if (isRotating) {
      document.addEventListener("mousemove", handleRotationMouseMove);
      document.addEventListener("mouseup", handleRotationMouseUp);
    }

    return () => {
      document.removeEventListener("mousemove", handleRotationMouseMove);
      document.removeEventListener("mouseup", handleRotationMouseUp);
    };
  }, [isRotating, rotatingFieldId, rotationCenter]);

  // Cleanup drag timeout and animation frame on unmount
  useEffect(() => {
    return () => {
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
      }
      if (shapeDragRafRef.current) {
        cancelAnimationFrame(shapeDragRafRef.current);
      }
      // Reset any lingering field transforms with safety checks
      Object.values(dragStatesRef.current).forEach(({ element }) => {
        try {
          if (
            element &&
            typeof element === "object" &&
            element.isConnected &&
            element.style &&
            typeof element.style === "object"
          ) {
            element.style.transform = "";
            element.style.willChange = "auto";
          }
        } catch (error) {
          console.warn("Error cleaning up field transform on unmount:", error);
        }
      });
      // Reset any lingering shape transforms with safety checks
      Object.values(shapeDragStatesRef.current).forEach(({ element }) => {
        try {
          if (
            element &&
            typeof element === "object" &&
            element.isConnected &&
            element.style &&
            typeof element.style === "object"
          ) {
            element.style.transform = "";
            element.style.willChange = "auto";
          }
        } catch (error) {
          console.warn("Error cleaning up shape transform on unmount:", error);
        }
      });
      dragStatesRef.current = {};
      isDraggingRef.current = {};
      shapeDragStatesRef.current = {};
      isShapeDraggingRef.current = {};
    };
  }, []);

  // Add beforeunload event listener to warn about unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [hasUnsavedChanges]);

  // Handle keyboard shortcuts for formatting
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Handle Escape key to deselect
      if (e.key === "Escape") {
        setSelectedFieldId(null);
        setSelectedShapeId(null);
        setIsTextSelectionMode(false);
        setIsAddTextBoxMode(false);
        setShapeDrawingMode(null);
        setSettingsPopupFor(null);
        return;
      }

      // Only handle other shortcuts when a field is selected and not in text selection mode
      if (!selectedFieldId || isTextSelectionMode) return;

      const textFields = getTextFieldsFromWorkflowData();

      // Check for Ctrl+B (Bold) or Cmd+B on Mac
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        const currentField = textFields.find(
          (field) => field.id === selectedFieldId
        );
        if (currentField) {
          updateTextField(selectedFieldId, {
            fontWeight: currentField.fontWeight === "bold" ? "normal" : "bold",
          });
        }
      }

      // Check for Ctrl+I (Italic) or Cmd+I on Mac
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "i") {
        e.preventDefault();
        const currentField = textFields.find(
          (field) => field.id === selectedFieldId
        );
        if (currentField) {
          updateTextField(selectedFieldId, {
            fontStyle:
              currentField.fontStyle === "italic" ? "normal" : "italic",
          });
        }
      }
    };

    document.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("keydown", handleKeydown);
    };
  }, [selectedFieldId, getTextFieldsFromWorkflowData, isTextSelectionMode]);

  // Deactivate all tool modes when switching to view mode
  useEffect(() => {
    if (!isEditMode) {
      setIsAddTextBoxMode(false);
      setShapeDrawingMode(null);
      setIsTextSelectionMode(false);
      setShapeDropdownOpen(false);
      setIsDrawingInProgress(false);
      setShapeDrawStart(null);
      setShapeDrawEnd(null);
    }
  }, [isEditMode]);

  // Note: loadWorkflowFields is now replaced by getTextFieldsFromWorkflowData

  const selectionRect = useMemo(() => {
    if (!dragStart || !dragEnd) return null;

    const left = Math.min(dragStart.x, dragEnd.x);
    const top = Math.min(dragStart.y, dragEnd.y);
    const width = Math.abs(dragEnd.x - dragStart.x);
    const height = Math.abs(dragEnd.y - dragStart.y);

    return { left, top, width, height };
  }, [dragStart, dragEnd]);

  // Handle mouse down for drag selection
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only respond to right-click (button 2)
    if (!isTextSelectionMode || e.button !== 2) return;

    e.preventDefault(); // Prevent context menu
    setMouseDownTime(Date.now());
    setIsDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setDragEnd({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for drag selection
  const handleMouseMove = (e: React.MouseEvent) => {
    // Check if we should start dragging (after 100ms)
    if (!isDragging && mouseDownTime && Date.now() - mouseDownTime > 100) {
      setIsDragging(true);
      setDragStart({ x: e.clientX, y: e.clientY });
      setDragEnd({ x: e.clientX, y: e.clientY });
      return;
    }

    if (!isDragging || !dragStart) return;

    e.preventDefault();
    setDragEnd({ x: e.clientX, y: e.clientY });
  };
  // Handle mouse up to finalize selection
  const handleMouseUp = (e: React.MouseEvent) => {
    // Only handle right-click release
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setMouseDownTime(null);

    if (e.button !== 2 || !selectionRect || !documentRef.current) return;

    const pdfPage = documentRef.current.querySelector(".react-pdf__Page");
    if (!pdfPage) return;

    const pageRect = pdfPage.getBoundingClientRect();
    const selectedSpans: {
      text: string;
      position: { top: number; left: number };
      pagePosition: { x: number; y: number };
      pageSize: { width: number; height: number }; // Add dimensions
    }[] = [];

    // Find all text spans within the selection rectangle
    document
      .querySelectorAll(".react-pdf__Page__textContent span")
      .forEach((span) => {
        const spanRect = span.getBoundingClientRect();

        if (
          spanRect.left < selectionRect.left + selectionRect.width &&
          spanRect.right > selectionRect.left &&
          spanRect.top < selectionRect.top + selectionRect.height &&
          spanRect.bottom > selectionRect.top
        ) {
          const text = span.textContent || "";

          // Inside the span selection loop:
          const pageWidth = spanRect.width / scale;
          const pageHeight = spanRect.height / scale;

          // Calculate position in PDF coordinates (original scale)
          const pageX = (spanRect.left - pageRect.left) / scale;
          const pageY = (spanRect.top - pageRect.top) / scale;

          selectedSpans.push({
            text,
            position: { top: spanRect.top, left: spanRect.left },
            pagePosition: { x: pageX, y: pageY },
            pageSize: { width: pageWidth, height: pageHeight },
          });
        }
      });

    if (selectedSpans.length > 0) {
      const popupPosition = calculatePopupPosition(
        selectionRect.top,
        selectionRect.height
      );

      setTextSelectionPopup({
        texts: selectedSpans,
        popupPosition: {
          top: popupPosition.top,
          left: selectionRect.left + selectionRect.width / 2,
          position: popupPosition.position,
        },
      });
    }

    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
  };

  const calculateFieldDimensions = (
    text: string,
    fontSize: number,
    fontFamily: string,
    characterSpacing: number = 0
  ) => {
    const padding = 5; // Small padding for visual comfort
    const { width, height } = measureText(
      text,
      fontSize,
      fontFamily,
      characterSpacing
    );

    // Add more generous padding for height to prevent clipping
    // Especially important for descenders (g, j, p, q, y) and to match textarea rendering
    const heightPadding = Math.max(fontSize * 0.2, 4); // At least 20% of font size or 4px

    return {
      width: Math.max(width + padding + 5, 5),
      height: Math.max(height + heightPadding, fontSize), // Ensure minimum height is at least font size
    };
  };

  const calculatePopupPosition = (
    top: number,
    height: number
  ): { top: number; position: "above" | "below" } => {
    const windowHeight = window.innerHeight;
    const estimatedPopupHeight = 200; // Estimated max height of popup

    // If near bottom of viewport, show above the selection
    if (top + height + estimatedPopupHeight > windowHeight) {
      return {
        top: top - estimatedPopupHeight - 5,
        position: "above",
      };
    }
    // Otherwise show below the selection
    return {
      top: top + height + 5,
      position: "below",
    };
  };

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError("");
    setIsDocumentLoaded(true);
  };

  const handleDocumentLoadError = (error: Error) => {
    setError(`Failed to load document: ${error.message}`);
    console.error("Document loading error:", error);
  };

  const handlePageLoadSuccess = (page: any) => {
    const { width, height } = page.getViewport({ scale: 1 });
    setPageWidth(width);
    setPageHeight(height);
    setIsDocumentLoaded(true);
  };

  const handleImageLoadSuccess = (
    event: React.SyntheticEvent<HTMLImageElement>
  ) => {
    const img = event.currentTarget;
    const { naturalWidth, naturalHeight } = img;

    setPageWidth(naturalWidth);
    setPageHeight(naturalHeight);
    setImageDimensions({ width: naturalWidth, height: naturalHeight });
    setNumPages(1); // Images only have 1 "page"
    setCurrentPage(1);
    setError("");
    setIsDocumentLoaded(true);
  };

  const handleImageLoadError = (
    error: React.SyntheticEvent<HTMLImageElement>
  ) => {
    setError("Failed to load image");
    console.error("Image loading error:", error);
  };

  // Handle text span click during selection mode
  const handleTextSpanClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (!isTextSelectionMode) return;
      e.stopPropagation();

      const span = e.currentTarget;
      const textContent = span.textContent || "";

      if (!textContent.trim()) return;

      const pdfPage = documentRef.current?.querySelector(".react-pdf__Page");
      if (!pdfPage) return;

      const spanRect = span.getBoundingClientRect();

      // Calculate dimensions in original scale
      const pageWidth = spanRect.width / scale;
      const pageHeight = spanRect.height / scale;

      // Calculate position relative to viewport
      const popupTop = spanRect.bottom + 5;
      const popupLeft = spanRect.left + spanRect.width / 2;

      // Calculate position relative to PDF page (original scale)
      const pageRect = pdfPage.getBoundingClientRect();
      const pageX = (spanRect.left - pageRect.left) / scale;
      const pageY = (spanRect.top - pageRect.top) / scale;

      const popupPosition = calculatePopupPosition(
        spanRect.top,
        spanRect.height
      );

      setTextSelectionPopup((prev) => {
        const newSelection = {
          text: textContent,
          position: { top: spanRect.top, left: spanRect.left },
          pagePosition: { x: pageX, y: pageY },
          pageSize: { width: pageWidth, height: pageHeight },
        };

        // If shift key is pressed, add to existing selections
        if (e.shiftKey && prev) {
          return {
            texts: [...prev.texts, newSelection],
            popupPosition: {
              top: popupTop,
              left: popupLeft,
              position: "below",
            }, // Explicitly set position
          };
        }

        // Otherwise, create new selection
        return {
          texts: [newSelection],
          popupPosition: {
            top: popupPosition.top,
            left: popupLeft,
            position: popupPosition.position || "below", // Ensure position is always set
          },
        };
      });
      console.log("Text selected", textSelectionPopup);
    },
    [isTextSelectionMode, scale]
  );

  // Attach click handlers to text spans
  useEffect(() => {
    if (!isTextSelectionMode || !documentUrl) return;

    const attachHandlers = () => {
      const textSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );

      textSpans.forEach((span) => {
        // Only attach handler once
        if (!(span as any).hasListener) {
          span.addEventListener("click", handleTextSpanClick as any);
          (span as any).hasListener = true;
        }
      });
    };

    // Create a mutation observer to detect when text layer updates
    const observer = new MutationObserver(attachHandlers);

    if (documentRef.current) {
      const config = { childList: true, subtree: true };
      observer.observe(documentRef.current, config);

      // Initial attachment
      attachHandlers();
    }

    return () => {
      observer.disconnect();
      const textSpans = document.querySelectorAll(
        ".react-pdf__Page__textContent span"
      );
      textSpans.forEach((span) => {
        span.removeEventListener("click", handleTextSpanClick as any);
        delete (span as any).hasListener;
      });
    };
  }, [isTextSelectionMode, documentUrl, currentPage, handleTextSpanClick]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        textSelectionPopup &&
        !(e.target as Element).closest(".text-selection-popup")
      ) {
        setTextSelectionPopup(null);
      }
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [textSelectionPopup]);

  const addTextField = (x: number, y: number) => {
    if (!localWorkflowData) return;

    const value = "New Text Field";
    const fontSize = 8;
    const fontFamily = "Arial, sans-serif";
    const fieldId = generateUUID();

    const { width, height } = calculateFieldDimensions(
      value,
      fontSize,
      fontFamily
    );

    setLocalWorkflowData((prev) => {
      if (!prev) return prev;

      const updatedData = { ...prev };

      // Add to fields
      const updatedFields = { ...(updatedData.fields || {}) };
      updatedFields[fieldId] = {
        value: currentTab === "original" ? value : "",
        translated_value: currentTab === "translated" ? value : "",
        value_status: "edited",
        translated_status: "edited",
        isCustomField: true, // Mark as custom field for deletion logic
      };
      updatedData.fields = updatedFields;

      // Add to appropriate template mapping
      const mappingKey =
        currentTab === "original"
          ? "origin_template_mappings"
          : "translated_template_mappings";
      const updatedMappings = { ...(updatedData[mappingKey] || {}) };

      const newMapping: ExtendedTemplateMapping = {
        position: { x0: x, y0: y, x1: x + width, y1: y + height },
        font: { size: fontSize, name: fontFamily, color: "#000000" },
        page_number: currentPage,
        label: "New Text Field",
        bbox_center: { x: x + width / 2, y: y + height / 2 },
        alignment: "left",
        font_color: "#000000",
        character_spacing: 0,
        font_weight: "normal",
        font_style: "normal",
        rotation: 0,
      };

      updatedMappings[fieldId] = newMapping;
      updatedData[mappingKey] = updatedMappings;

      return updatedData as WorkflowData;
    });

    setSelectedFieldId(fieldId);
    setIsAddTextBoxMode(false);
    setIsTextSelectionMode(false);
    setTextSelectionPopup(null);
    markAsUnsaved();
  };

  const addDeletionRectangle = (sel: {
    pagePosition: { x: number; y: number };
    pageSize: { width: number; height: number };
  }) => {
    // Capture background color only once when rectangle is created
    // Use a consistent reference scale to avoid color changes when zooming
    const canvas = document.querySelector(
      ".react-pdf__Page__canvas"
    ) as HTMLCanvasElement;
    let bgColor = "white"; // Default fallback color

    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) {
        try {
          // Calculate the canvas scale factor (current canvas size vs natural PDF size)
          const canvasScale = canvas.width / pageWidth;

          // Use the canvas scale to get consistent pixel coordinates
          const centerX = Math.floor(sel.pagePosition.x * canvasScale);
          const centerY = Math.floor(sel.pagePosition.y * canvasScale);

          // Sample a 3x3 area around the center point
          let totalR = 0,
            totalG = 0,
            totalB = 0;
          let validSamples = 0;

          for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
              const x = centerX + dx;
              const y = centerY + dy;

              // Make sure we're within canvas bounds
              if (x >= 0 && y >= 0 && x < canvas.width && y < canvas.height) {
                const pixel = ctx.getImageData(x, y, 1, 1).data;
                totalR += pixel[0];
                totalG += pixel[1];
                totalB += pixel[2];
                validSamples++;
              }
            }
          }

          if (validSamples > 0) {
            const avgR = Math.round(totalR / validSamples);
            const avgG = Math.round(totalG / validSamples);
            const avgB = Math.round(totalB / validSamples);
            bgColor = `rgb(${avgR}, ${avgG}, ${avgB})`;
          }
        } catch (error) {
          console.warn("Failed to capture background color:", error);
          // Keep default white color
        }
      }
    }

    const newDeletion: Rectangles = {
      id: `rec-${Date.now()}-${Math.random()}`,
      x: sel.pagePosition.x,
      y: sel.pagePosition.y,
      width: sel.pageSize.width + 1,
      height: sel.pageSize.height + 1,
      page: currentPage,
      tab: currentTab, // Associate deletion rectangle with current tab
      pagePosition: sel.pagePosition,
      pageSize: sel.pageSize,
      background: bgColor, // Store the captured color permanently
    };

    if (localWorkflowData) {
      setLocalWorkflowData((prev) => {
        if (!prev) return prev;
        const updatedRectangles: Record<string, any> = {
          ...(prev.deletion_rectangles || {}),
        };
        updatedRectangles[newDeletion.id] = newDeletion;
        return {
          ...prev,
          deletion_rectangles: updatedRectangles,
        } as WorkflowData;
      });
    }
    markAsUnsaved();
  };

  const deleteDeletionRectangle = (id: string) => {
    if (localWorkflowData) {
      setLocalWorkflowData((prev) => {
        if (!prev) return prev;
        const updatedRectangles: Record<string, any> = {
          ...(prev.deletion_rectangles || {}),
        };
        delete updatedRectangles[id];
        return {
          ...prev,
          deletion_rectangles: updatedRectangles,
        } as WorkflowData;
      });
    }
    markAsUnsaved();
  };

  const deleteTextField = (fieldId: string) => {
    if (!localWorkflowData) return;

    setLocalWorkflowData((prev) => {
      if (!prev) return prev;

      const updatedData = { ...prev };

      // Remove from fields
      const updatedFields = { ...(updatedData.fields || {}) };
      delete updatedFields[fieldId];
      updatedData.fields = updatedFields;

      // Remove from both template mappings (in case it exists in both)
      if (updatedData.origin_template_mappings) {
        const updatedOriginMappings = {
          ...updatedData.origin_template_mappings,
        };
        delete updatedOriginMappings[fieldId];
        updatedData.origin_template_mappings = updatedOriginMappings;
      }

      if (updatedData.translated_template_mappings) {
        const updatedTranslatedMappings = {
          ...updatedData.translated_template_mappings,
        };
        delete updatedTranslatedMappings[fieldId];
        updatedData.translated_template_mappings = updatedTranslatedMappings;
      }

      return updatedData as WorkflowData;
    });

    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
    markAsUnsaved();
  };

  const handleDocumentContainerClick = (e: React.MouseEvent) => {
    // Handle shape drawing
    if (shapeDrawingMode && !isDrawingInProgress) {
      handleShapeDrawStart(e);
      return;
    }

    if (isAddTextBoxMode && documentRef.current) {
      const container = documentRef.current;
      const rect = container.getBoundingClientRect();

      // Calculate click position relative to document container
      const clickX = e.clientX - rect.left;
      const clickY = e.clientY - rect.top;

      // Convert to original scale coordinates
      const originalX = clickX / scale;
      const originalY = clickY / scale;

      addTextField(originalX, originalY);
      return; // Don't deselect when adding a new field
    }

    // Check if click target is the document container or PDF page (not a text field or shape)
    const isEmptyAreaClick =
      e.target === e.currentTarget ||
      (e.target as Element).closest(".react-pdf__Page") === e.target ||
      (e.target as Element).classList.contains("react-pdf__Page__canvas") ||
      (e.target as Element).classList.contains("react-pdf__Page__textContent");

    if (isEmptyAreaClick) {
      // Deselect any selected field or shape when clicking on empty areas
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      setIsTextSelectionMode(false);
      setIsAddTextBoxMode(false);
      setShapeDrawingMode(null);
      setSettingsPopupFor(null); // Also close any open settings popup
    }
  };

  // Optimized drag handlers using direct DOM manipulation
  const handleFieldDrag = useCallback(
    (fieldId: string, x: number, y: number, element: HTMLElement | null) => {
      // Comprehensive element validation
      if (
        !element ||
        typeof element !== "object" ||
        !element.isConnected ||
        !element.style ||
        typeof element.style !== "object"
      ) {
        return;
      }

      // Store drag state in ref
      dragStatesRef.current[fieldId] = {
        x: x / scale,
        y: y / scale,
        element,
      };
      isDraggingRef.current[fieldId] = true;

      // Cancel previous animation frame if it exists
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
      }

      // Use requestAnimationFrame for smooth 60fps visual updates
      dragRafRef.current = requestAnimationFrame(() => {
        try {
          // Triple-check element still exists and is valid before manipulating
          if (
            element &&
            typeof element === "object" &&
            element.isConnected &&
            element.style &&
            typeof element.style === "object"
          ) {
            element.style.transform = `translate(${x}px, ${y}px)`;
            element.style.willChange = "transform";
          }
        } catch (error) {
          console.warn("Error updating element transform during drag:", error);
          // Clean up this drag state if there's an error
          delete dragStatesRef.current[fieldId];
          delete isDraggingRef.current[fieldId];
        }
      });
    },
    [scale]
  );

  const handleFieldDragStop = useCallback(
    (fieldId: string, x: number, y: number) => {
      // Cancel any pending animation frames
      if (dragRafRef.current) {
        cancelAnimationFrame(dragRafRef.current);
        dragRafRef.current = null;
      }

      // Clear drag state and reset transform with comprehensive safety checks
      try {
        const dragState = dragStatesRef.current[fieldId];
        if (dragState?.element) {
          const element = dragState.element;
          // Multiple safety checks before manipulating the element
          if (
            element &&
            typeof element === "object" &&
            element.isConnected &&
            element.style &&
            typeof element.style === "object"
          ) {
            element.style.transform = "";
            element.style.willChange = "auto";
          }
        }
      } catch (error) {
        console.warn("Error resetting element transform on drag stop:", error);
      }

      // Clean up all drag-related state
      delete dragStatesRef.current[fieldId];
      delete isDraggingRef.current[fieldId];

      // Update the actual field position in React state
      // Note: x and y from onDragStop are already pixel positions, so we need to convert to PDF coordinates
      updateTextField(fieldId, {
        x: x / scale,
        y: y / scale,
      });
    },
    [scale, updateTextField]
  );

  const exportToPDF = async () => {
    if (!documentUrl || !documentRef.current) return;

    // Save current state before starting
    const originalScale = scale;
    const tempSelectedField = selectedFieldId;
    const tempSelectedShape = selectedShapeId;
    const tempSettingsPopup = settingsPopupFor;
    const tempEditMode = isEditMode;
    const tempTextSelectionMode = isTextSelectionMode;
    const tempShowRectangles = showRectangles;
    const originalTextFields = getTextFieldsFromWorkflowData();
    const originalShapes = getShapesAsArray();

    setIsLoading(true);

    try {
      // Turn off edit mode and all editing controls for clean export
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      setSettingsPopupFor(null);
      setIsEditMode(false);
      setIsTextSelectionMode(false);
      setShapeDrawingMode(null);
      setTextSelectionPopup(null);
      setShapeDropdownOpen(false);
      setFieldStatusDropdownOpen(false);
      setShowRectangles(false); // Hide deletion rectangles during export

      // Set zoom to 300% for maximum quality
      setScale(3.0);
      setZoomMode("page");

      // Wait for zoom and controls to update
      await new Promise((resolve) => setTimeout(resolve, 800));

      // Find the PDF page element and canvas
      const pdfPageElement =
        documentRef.current.querySelector(".react-pdf__Page");
      const pdfCanvas = documentRef.current.querySelector(
        ".react-pdf__Page__canvas"
      ) as HTMLCanvasElement;

      if (!pdfPageElement || !pdfCanvas) {
        throw new Error("PDF page or canvas not found");
      }

      console.log("PDF Canvas found:", {
        width: pdfCanvas.width,
        height: pdfCanvas.height,
        clientWidth: pdfCanvas.clientWidth,
        clientHeight: pdfCanvas.clientHeight,
      });

      // Use html2canvas to capture the rendered PDF with all styling
      const html2canvas = (await import("html2canvas")).default;

      // Capture the entire document container which includes text fields and shapes
      const canvas = await html2canvas(documentRef.current, {
        scale: 1, // Use 1x scale since we already scaled the content to 300%
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ef4444", // Always red background
        logging: false,
        foreignObjectRendering: false, // Disable for better PDF.js compatibility
        ignoreElements: (element) => {
          // Only ignore control elements, NOT shapes themselves
          return (
            element.classList.contains("drag-handle") ||
            element.tagName === "BUTTON" ||
            element.classList.contains("settings-popup") ||
            element.classList.contains("text-selection-popup") ||
            element.classList.contains("shape-dropdown") ||
            element.classList.contains("field-status-dropdown") ||
            element.classList.contains("fixed") ||
            element.closest(".fixed") !== null ||
            // Ignore resize handles but not the shapes themselves
            element.classList.contains("react-resizable-handle")
          );
        },
        onclone: (clonedDoc) => {
          console.log("Cloning document for export...");

          // Find the cloned document container
          const clonedContainer = clonedDoc.querySelector(
            'div[style*="relative"]'
          );

          if (clonedContainer) {
            // Remove control elements but keep shapes
            // Remove buttons and control elements, but NOT shape-drag-handle (which are the actual shapes)
            clonedContainer
              .querySelectorAll(
                "button, .drag-handle, .settings-popup, .text-selection-popup, .shape-dropdown, .field-status-dropdown, .fixed, .react-resizable-handle"
              )
              .forEach((el) => el.remove());

            // Clean up Rnd containers (both text fields and shapes)
            clonedContainer.querySelectorAll(".rnd").forEach((rnd) => {
              if (rnd instanceof HTMLElement) {
                // Remove border and controls but keep the content
                rnd.style.border = "none";
                rnd.style.backgroundColor = "transparent";
                rnd.style.boxShadow = "none";
                rnd.style.outline = "none";
                rnd.style.cursor = "default";

                // Check if this is a text field container and raise it for better export appearance
                const textarea = rnd.querySelector("textarea");
                if (textarea && textarea instanceof HTMLElement) {
                  // Raise ALL text field containers by adjusting position
                  const currentTop = parseFloat(rnd.style.top || "0");
                  rnd.style.top = `${currentTop - 5 * scale}px`; // Raise by 5px scaled (increased from 3px)

                  // Clean up textarea styling
                  textarea.style.border = "none";
                  textarea.style.outline = "none";
                  textarea.style.resize = "none";
                  textarea.style.padding = "2px"; // Match live editor padding
                  textarea.style.margin = "0";
                  textarea.style.backgroundColor = "transparent";
                  textarea.style.cursor = "default";
                  textarea.style.overflow = "visible"; // Allow overflow during export to prevent clipping
                  textarea.style.whiteSpace = "pre-wrap"; // Ensure text wrapping is preserved
                  textarea.style.wordWrap = "break-word"; // Ensure long words break properly
                  textarea.style.wordBreak = "break-word"; // Additional word breaking support

                  // Ensure adequate height for wrapped text during export
                  const textContent = textarea.value || "";
                  if (textContent.length > 0) {
                    // Force explicit text wrapping styles
                    textarea.style.whiteSpace = "pre-wrap";
                    textarea.style.wordWrap = "break-word";
                    textarea.style.wordBreak = "break-word";
                    textarea.style.overflowWrap = "break-word";

                    // Calculate estimated height based on content
                    const fontSize = parseFloat(
                      textarea.style.fontSize || "12"
                    );
                    const lineHeight = fontSize * 1.1;

                    // Count explicit line breaks and estimate wrapped lines
                    const explicitLines =
                      (textContent.match(/\n/g) || []).length + 1;
                    const avgCharsPerLine = Math.max(
                      20,
                      Math.floor(
                        parseFloat(rnd.style.width || "200") / (fontSize * 0.6)
                      )
                    );
                    const estimatedWrappedLines = Math.ceil(
                      textContent.replace(/\n/g, " ").length / avgCharsPerLine
                    );
                    const totalEstimatedLines = Math.max(
                      explicitLines,
                      estimatedWrappedLines
                    );

                    // Apply generous height to ensure all text is visible
                    const generousHeight =
                      totalEstimatedLines * lineHeight + 20; // Extra 20px buffer
                    const currentHeight = parseFloat(rnd.style.height || "0");

                    // Always expand if we have multi-line content
                    if (
                      totalEstimatedLines > 1 ||
                      generousHeight > currentHeight
                    ) {
                      rnd.style.height = `${generousHeight}px`;
                      textarea.style.height = `${generousHeight - 8}px`; // Slightly smaller than container
                    }

                    // Ensure no text overflow
                    textarea.style.overflow = "visible";
                    textarea.style.textOverflow = "clip";
                  }

                  // No position adjustments - keep exactly what user sees in live editor
                }

                // Ensure shapes are visible and properly styled for export
                const shapeElement = rnd.querySelector(".shape-drag-handle");
                if (shapeElement && shapeElement instanceof HTMLElement) {
                  // Keep the shape but remove interactive styling for export
                  shapeElement.style.cursor = "default";
                  shapeElement.style.pointerEvents = "none";
                  // Ensure the shape maintains its visual properties
                  shapeElement.style.display = "block";
                  shapeElement.style.visibility = "visible";
                  shapeElement.style.opacity = "1";
                }
              }
            });

            // Also clean up any standalone shape elements that might not be in Rnd containers
            clonedContainer
              .querySelectorAll(".shape-drag-handle")
              .forEach((shape) => {
                if (shape instanceof HTMLElement) {
                  shape.style.cursor = "default";
                  shape.style.pointerEvents = "none";
                  shape.style.display = "block";
                  shape.style.visibility = "visible";
                  shape.style.opacity = "1";
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
              console.log("Cloned canvas configured:", {
                width: clonedCanvas.width,
                height: clonedCanvas.height,
              });
            }
          }
        },
      });

      console.log("Captured canvas:", {
        width: canvas.width,
        height: canvas.height,
      });

      // Load the export template PDF
      const templateResponse = await fetch(
        "/export_template/export_template.pdf"
      );
      const templateArrayBuffer = await templateResponse.arrayBuffer();
      const templatePdfDoc = await PDFDocument.load(templateArrayBuffer);

      // Get the template pages
      const templatePages = templatePdfDoc.getPages();
      const templatePage1 = templatePages[0];
      const templatePage2 = templatePages[1];
      const templatePage3 = templatePages[2];

      // Get template page dimensions
      const { width: templateWidth, height: templateHeight } =
        templatePage1.getSize();

      // Create a new PDF document and copy the template pages
      const pdfDoc = await PDFDocument.create();

      // Copy all three pages from the template
      const [copiedPage1, copiedPage2, copiedPage3] = await pdfDoc.copyPages(
        templatePdfDoc,
        [0, 1, 2]
      );

      // Add the copied pages to the new document
      pdfDoc.addPage(copiedPage1);
      pdfDoc.addPage(copiedPage2);
      pdfDoc.addPage(copiedPage3);

      // Get the added pages for modification
      const pages = pdfDoc.getPages();
      const page2 = pages[1]; // Second page for base file
      const page3 = pages[2]; // Third page for exported content

      // Process the base file (original document) for page 2
      let baseFileImage;
      const baseFileUrl =
        localWorkflowData?.base_file_public_url || documentUrl;
      const isBaseFilePdf = isPdfFile(baseFileUrl);
      const isBaseFileImage = isImageFile(baseFileUrl);

      if (isBaseFilePdf) {
        // For PDF files, we need to convert the first page to an image
        // We'll use the existing PDF canvas from the viewer
        const baseFileCanvas = document.createElement("canvas");
        const baseFileContext = baseFileCanvas.getContext("2d");

        if (baseFileContext && pdfCanvas) {
          // Copy the original PDF canvas content
          baseFileCanvas.width = pdfCanvas.width;
          baseFileCanvas.height = pdfCanvas.height;
          baseFileContext.drawImage(pdfCanvas, 0, 0);

          // Convert to PNG
          const baseFileDataUrl = baseFileCanvas.toDataURL("image/png", 1.0);
          const baseFileImageBytes = await fetch(baseFileDataUrl).then((res) =>
            res.arrayBuffer()
          );
          baseFileImage = await pdfDoc.embedPng(baseFileImageBytes);
        }
      } else if (isBaseFileImage) {
        // For image files, load directly
        try {
          const baseFileResponse = await fetch(baseFileUrl);
          const baseFileArrayBuffer = await baseFileResponse.arrayBuffer();

          // Determine image type and embed accordingly
          const fileExtension = getCleanExtension(baseFileUrl).toLowerCase();
          if (fileExtension === "png") {
            baseFileImage = await pdfDoc.embedPng(baseFileArrayBuffer);
          } else if (fileExtension === "jpg" || fileExtension === "jpeg") {
            baseFileImage = await pdfDoc.embedJpg(baseFileArrayBuffer);
          } else {
            // For other formats, convert to PNG first
            const img = new Image();
            img.crossOrigin = "anonymous";
            await new Promise((resolve, reject) => {
              img.onload = resolve;
              img.onerror = reject;
              img.src = baseFileUrl;
            });

            const tempCanvas = document.createElement("canvas");
            const tempContext = tempCanvas.getContext("2d");
            tempCanvas.width = img.width;
            tempCanvas.height = img.height;
            tempContext?.drawImage(img, 0, 0);

            const convertedDataUrl = tempCanvas.toDataURL("image/png", 1.0);
            const convertedImageBytes = await fetch(convertedDataUrl).then(
              (res) => res.arrayBuffer()
            );
            baseFileImage = await pdfDoc.embedPng(convertedImageBytes);
          }
        } catch (error) {
          console.error("Error loading base file image:", error);
        }
      }

      // Add the base file to the center of page 2 (lowered position)
      if (baseFileImage) {
        const baseFileDims = baseFileImage.scale(1);

        // Calculate scale to fit the image within the page while maintaining aspect ratio
        const maxWidth = templateWidth * 0.8; // Use 80% of page width
        const maxHeight = templateHeight * 0.8; // Use 80% of page height

        const scaleX = maxWidth / baseFileDims.width;
        const scaleY = maxHeight / baseFileDims.height;
        const scale = Math.min(scaleX, scaleY);

        const scaledWidth = baseFileDims.width * scale;
        const scaledHeight = baseFileDims.height * scale;

        // Center the image on the page horizontally, but lower it vertically
        const x = (templateWidth - scaledWidth) / 2;
        const y = (templateHeight - scaledHeight) / 2 - 50; // Lower by 50 points

        // Draw border around the image
        const borderWidth = 2;

        page2.drawRectangle({
          x: x - borderWidth,
          y: y - borderWidth,
          width: scaledWidth + borderWidth * 2,
          height: scaledHeight + borderWidth * 2,
          borderColor: rgb(0, 0, 0), // Black border
          borderWidth: borderWidth,
        });

        page2.drawImage(baseFileImage, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
      }

      // Convert the captured canvas to PNG for page 3
      const canvasDataUrl = canvas.toDataURL("image/png", 1.0);
      const pngImageBytes = await fetch(canvasDataUrl).then((res) =>
        res.arrayBuffer()
      );
      const pngImage = await pdfDoc.embedPng(pngImageBytes);

      // Add the exported content to the center of page 3 (lowered position)
      const exportedDims = pngImage.scale(1);

      // Calculate scale to fit the exported content within the page while maintaining aspect ratio
      const maxExportWidth = templateWidth * 0.8; // Use 80% of page width
      const maxExportHeight = templateHeight * 0.8; // Use 80% of page height

      const exportScaleX = maxExportWidth / exportedDims.width;
      const exportScaleY = maxExportHeight / exportedDims.height;
      const exportScale = Math.min(exportScaleX, exportScaleY);

      const exportedScaledWidth = exportedDims.width * exportScale;
      const exportedScaledHeight = exportedDims.height * exportScale;

      // Center the exported content on the page horizontally, but lower it vertically
      const exportX = (templateWidth - exportedScaledWidth) / 2;
      const exportY = (templateHeight - exportedScaledHeight) / 2 - 50; // Lower by 50 points

      // Draw border around the exported content
      const exportBorderWidth = 2;

      page3.drawRectangle({
        x: exportX - exportBorderWidth,
        y: exportY - exportBorderWidth,
        width: exportedScaledWidth + exportBorderWidth * 2,
        height: exportedScaledHeight + exportBorderWidth * 2,
        borderColor: rgb(0, 0, 0), // Black border
        borderWidth: exportBorderWidth,
      });

      page3.drawImage(pngImage, {
        x: exportX,
        y: exportY,
        width: exportedScaledWidth,
        height: exportedScaledHeight,
      });

      // Save and download the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = `${currentTab}-template-filled.pdf`;
      link.click();

      URL.revokeObjectURL(url);

      // Note: Text fields are now derived from workflow data, so no restoration needed
      // Restore original shapes in localWorkflowData
      if (localWorkflowData) {
        setLocalWorkflowData((prev) => {
          if (!prev) return prev;
          const shapesAsRecord: Record<string, any> = {};
          originalShapes.forEach((shape) => {
            shapesAsRecord[shape.id] = shape;
          });
          return { ...prev, shapes: shapesAsRecord } as WorkflowData;
        });
      }
      setScale(originalScale);
      setSelectedFieldId(tempSelectedField);
      setSelectedShapeId(tempSelectedShape);
      setSettingsPopupFor(tempSettingsPopup);
      setIsEditMode(tempEditMode);
      setIsTextSelectionMode(tempTextSelectionMode);
      setShowRectangles(tempShowRectangles); // Restore deletion rectangles visibility
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setError("Failed to export PDF");

      // Note: Text fields are now derived from workflow data, so no restoration needed
      // Restore original shapes in localWorkflowData
      if (localWorkflowData) {
        setLocalWorkflowData((prev) => {
          if (!prev) return prev;
          const shapesAsRecord: Record<string, any> = {};
          originalShapes.forEach((shape) => {
            shapesAsRecord[shape.id] = shape;
          });
          return { ...prev, shapes: shapesAsRecord } as WorkflowData;
        });
      }
      setScale(originalScale);
      setSelectedFieldId(tempSelectedField);
      setSelectedShapeId(tempSelectedShape);
      setSettingsPopupFor(tempSettingsPopup);
      setIsEditMode(tempEditMode);
      setIsTextSelectionMode(tempTextSelectionMode);
      setShowRectangles(tempShowRectangles); // Restore deletion rectangles visibility
    } finally {
      setIsLoading(false);
    }
  };

  const saveChanges = async () => {
    if (!localWorkflowData || !hasUnsavedChanges || !conversationId) return;

    setIsSaving(true);
    try {
      // Transform fields to match backend FieldMetadataDict format
      const transformedFields: Record<string, any> = {};
      if (localWorkflowData.fields) {
        for (const [fieldKey, fieldData] of Object.entries(
          localWorkflowData.fields
        )) {
          transformedFields[fieldKey] = {
            value: fieldData.value || null,
            value_status: fieldData.value_status || "pending",
            translated_value: fieldData.translated_value || null,
            translated_status: fieldData.translated_status || "pending",
          };
        }
      }

      // Transform shapes from object to array
      const transformedShapes = localWorkflowData.shapes
        ? Object.values(localWorkflowData.shapes)
        : null;

      // Transform deletion_rectangles from object to array
      const transformedDeletionRectangles =
        localWorkflowData.deletion_rectangles
          ? Object.values(localWorkflowData.deletion_rectangles)
          : null;

      // Transform localWorkflowData to match ReplaceWorkflowRequest format
      const requestData = {
        file_id: localWorkflowData.file_id,
        base_file_public_url: localWorkflowData.base_file_public_url || null,
        template_id: localWorkflowData.template_id,
        template_file_public_url:
          localWorkflowData.template_file_public_url || null,
        origin_template_mappings:
          localWorkflowData.origin_template_mappings || null,
        fields:
          Object.keys(transformedFields).length > 0 ? transformedFields : null,
        template_translated_id: localWorkflowData.template_translated_id,
        template_translated_file_public_url:
          localWorkflowData.template_translated_file_public_url || null,
        translated_template_mappings:
          localWorkflowData.translated_template_mappings || null,
        translate_to: localWorkflowData.translate_to,
        translate_from: localWorkflowData.translate_from,
        shapes: transformedShapes,
        deletion_rectangles: transformedDeletionRectangles,
      };

      console.log("Sending workflow data:", requestData);

      // Call the new replace workflow API endpoint
      const response = await api.put(
        `/api/workflow/${conversationId}/replace`,
        requestData
      );

      if (response.data.success) {
        // Update the initial workflow data to current state
        setInitialWorkflowData(JSON.parse(JSON.stringify(localWorkflowData)));
        setHasUnsavedChanges(false);

        // Show brief "Saved" confirmation like in Word
        setShowSavedIndicator(true);
        setTimeout(() => {
          setShowSavedIndicator(false);
        }, 2000); // Show for 2 seconds

        // Show success feedback
        console.log("Changes saved successfully!");
      } else {
        throw new Error(response.data.message || "Failed to save changes");
      }
    } catch (err) {
      console.error("Error saving changes:", err);

      let errorMessage = "Failed to save changes to the server";

      // Type guard for axios errors
      if (err && typeof err === "object" && "response" in err) {
        const error = err as { response?: { data?: any } };
        console.error("Full error response:", error.response);

        if (error.response?.data) {
          const errorData = error.response.data;
          console.error("Error data:", errorData);

          if (typeof errorData.detail === "string") {
            errorMessage = `Failed to save: ${errorData.detail}`;
          } else if (Array.isArray(errorData.detail)) {
            // Handle Pydantic validation errors
            const validationErrors = errorData.detail
              .map((validationErr: any) => {
                const location = validationErr.loc
                  ? validationErr.loc.join(".")
                  : "unknown";
                const message = validationErr.msg || "validation error";
                return `${location}: ${message}`;
              })
              .join(", ");
            errorMessage = `Validation errors: ${validationErrors}`;
          } else if (errorData.detail && typeof errorData.detail === "object") {
            errorMessage = `Failed to save: ${JSON.stringify(
              errorData.detail
            )}`;
          } else if (errorData.message) {
            errorMessage = `Failed to save: ${errorData.message}`;
          }
        }
      }

      setError(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  const translateAllFields = async () => {
    if (
      !localWorkflowData ||
      !conversationId ||
      !localWorkflowData.translate_to
    )
      return;

    setIsTranslatingAll(true);
    setError("");

    try {
      const translateRequest = {
        target_language: localWorkflowData.translate_to,
        source_language: localWorkflowData.translate_from,
        use_gemini: true,
        force_retranslate: false,
      };

      const response = await api.post(
        `/api/workflow/${conversationId}/translate-all-fields`,
        translateRequest
      );

      if (response.data.success) {
        // Update local workflow data with translated values
        const updatedFields = { ...localWorkflowData.fields };

        // Apply translations to fields
        Object.entries(response.data.translated_fields).forEach(
          ([fieldKey, translatedValue]) => {
            if (updatedFields[fieldKey]) {
              updatedFields[fieldKey] = {
                ...updatedFields[fieldKey],
                translated_value: translatedValue as string,
                translated_status: "translated",
              };
            }
          }
        );

        // Update local workflow data
        setLocalWorkflowData({
          ...localWorkflowData,
          fields: updatedFields,
        });

        setHasUnsavedChanges(true);
        console.log(
          `Successfully translated ${
            Object.keys(response.data.translated_fields).length
          } fields`
        );

        if (Object.keys(response.data.skipped_fields).length > 0) {
          console.log("Skipped fields:", response.data.skipped_fields);
        }
      } else {
        throw new Error(response.data.message || "Failed to translate fields");
      }
    } catch (error: any) {
      console.error("Error translating fields:", error);
      let errorMessage = "Failed to translate fields";
      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.message) {
        errorMessage = error.message;
      }
      setError(errorMessage);
    } finally {
      setIsTranslatingAll(false);
    }
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      setShowSaveConfirmation(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setShowSaveConfirmation(false);
    setHasUnsavedChanges(false);
    onClose();
  };

  const cancelClose = () => {
    setShowSaveConfirmation(false);
  };

  const saveAndClose = async () => {
    await saveChanges();
    setShowSaveConfirmation(false);
    onClose();
  };

  const exportFieldsData = () => {
    const exportData = {
      documentUrl,
      fields: getTextFieldsFromWorkflowData(),
      shapes: getShapesAsArray(),
      rectangles: getRectanglesAsArray(),
      scale,
      pageWidth,
      pageHeight,
      numPages,
      workflowId: localWorkflowData?.template_id || "unknown",
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "document-fields.json";
    link.click();

    URL.revokeObjectURL(url);
  };

  const goToPage = (pageNumber: number) => {
    if (pageNumber >= 1 && pageNumber <= numPages) {
      setCurrentPage(pageNumber);
      setSelectedFieldId(null);
      setTextSelectionPopup(null); // Close any popup
    }
  };

  // Handle trash icon click in text selection popup
  const handleTrashClick = (position: { x: number; y: number }) => {
    console.log("Text coordinates:", position);
    setTextSelectionPopup(null);
  };

  // Zoom to fit width
  const zoomToFitWidth = useCallback(() => {
    setZoomMode("width");
    if (containerRef.current && pageWidth) {
      const rect = containerRef.current.getBoundingClientRect();
      const calculatedScale = rect.width / pageWidth;
      setScale(Math.min(calculatedScale, 3.0)); // Max zoom 300%
    }
  }, [pageWidth]);

  // Zoom to actual size
  const zoomToActualSize = useCallback(() => {
    setZoomMode("page");
    setScale(1.0);
  }, []);

  // Zoom in
  const zoomIn = useCallback(() => {
    setZoomMode("page");
    setScale((prev) => Math.min(3.0, prev + 0.1));
  }, []);

  // Zoom out
  const zoomOut = useCallback(() => {
    setZoomMode("page");
    setScale((prev) => Math.max(0.25, prev - 0.1));
  }, []);

  // Add new shape drawing handlers
  const handleShapeDrawStart = (e: React.MouseEvent) => {
    if (!shapeDrawingMode || !documentRef.current) return;

    const container = documentRef.current;
    const rect = container.getBoundingClientRect();

    const startX = (e.clientX - rect.left) / scale;
    const startY = (e.clientY - rect.top) / scale;

    setShapeDrawStart({ x: startX, y: startY });
    setShapeDrawEnd({ x: startX, y: startY });
    setIsDrawingInProgress(true);
  };

  const handleShapeDrawMove = (e: React.MouseEvent) => {
    if (!isDrawingInProgress || !shapeDrawStart || !documentRef.current) return;

    const container = documentRef.current;
    const rect = container.getBoundingClientRect();

    const endX = (e.clientX - rect.left) / scale;
    const endY = (e.clientY - rect.top) / scale;

    setShapeDrawEnd({ x: endX, y: endY });
  };

  const handleShapeDrawEnd = () => {
    if (
      !isDrawingInProgress ||
      !shapeDrawStart ||
      !shapeDrawEnd ||
      !shapeDrawingMode
    ) {
      setIsDrawingInProgress(false);
      setShapeDrawStart(null);
      setShapeDrawEnd(null);
      return;
    }

    const startX = Math.min(shapeDrawStart.x, shapeDrawEnd.x);
    const startY = Math.min(shapeDrawStart.y, shapeDrawEnd.y);
    const width = Math.abs(shapeDrawEnd.x - shapeDrawStart.x);
    const height = Math.abs(shapeDrawEnd.y - shapeDrawStart.y);

    // Only create shape if it has meaningful size
    if (width > 5 && height > 5) {
      const newShape: Shape = {
        id: `shape-${Date.now()}`,
        type: shapeDrawingMode,
        x: startX,
        y: startY,
        width,
        height,
        page: currentPage,
        tab: currentTab, // Associate shape with current tab/view
        borderColor: "#000000",
        borderWidth: 2,
        fillColor: "#ffffff",
        fillOpacity: 0.3,
        rotation: 0,
      };

      if (localWorkflowData) {
        setLocalWorkflowData((prev) => {
          if (!prev) return prev;
          const updatedShapes = { ...(prev.shapes || {}) } as Record<
            string,
            any
          >;
          updatedShapes[newShape.id] = newShape;
          return {
            ...prev,
            shapes: updatedShapes,
          } as WorkflowData;
        });
      }
      setSelectedShapeId(newShape.id);
      markAsUnsaved();
    }

    setIsDrawingInProgress(false);
    setShapeDrawStart(null);
    setShapeDrawEnd(null);
    setShapeDrawingMode(null);
  };

  // Add shape update function
  const updateShape = (shapeId: string, updates: Partial<Shape>) => {
    if (localWorkflowData) {
      setLocalWorkflowData((prev) => {
        if (!prev) return prev;
        const updatedShapes = { ...(prev.shapes || {}) } as Record<string, any>;
        if (updatedShapes[shapeId]) {
          updatedShapes[shapeId] = { ...updatedShapes[shapeId], ...updates };
        }
        return {
          ...prev,
          shapes: updatedShapes,
        } as WorkflowData;
      });
    }
    markAsUnsaved();
  };

  // Add shape deletion function
  const deleteShape = (shapeId: string) => {
    if (localWorkflowData) {
      setLocalWorkflowData((prev) => {
        if (!prev) return prev;
        const updatedShapes = { ...(prev.shapes || {}) } as Record<string, any>;
        delete updatedShapes[shapeId];
        return {
          ...prev,
          shapes: updatedShapes,
        } as WorkflowData;
      });
    }
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(null);
    }
    markAsUnsaved();
  };

  // Optimized shape drag handlers using direct DOM manipulation
  const handleShapeDrag = useCallback(
    (shapeId: string, x: number, y: number, element: HTMLElement | null) => {
      // Comprehensive element validation
      if (
        !element ||
        typeof element !== "object" ||
        !element.isConnected ||
        !element.style ||
        typeof element.style !== "object"
      ) {
        return;
      }

      // Store drag state in ref
      shapeDragStatesRef.current[shapeId] = {
        x: x / scale,
        y: y / scale,
        element,
      };
      isShapeDraggingRef.current[shapeId] = true;

      // Cancel previous animation frame if it exists
      if (shapeDragRafRef.current) {
        cancelAnimationFrame(shapeDragRafRef.current);
      }

      // Use requestAnimationFrame for smooth 60fps visual updates
      shapeDragRafRef.current = requestAnimationFrame(() => {
        try {
          // Triple-check element still exists and is valid before manipulating
          if (
            element &&
            typeof element === "object" &&
            element.isConnected &&
            element.style &&
            typeof element.style === "object"
          ) {
            element.style.transform = `translate(${x}px, ${y}px)`;
            element.style.willChange = "transform";
          }
        } catch (error) {
          console.warn(
            "Error updating element transform during shape drag:",
            error
          );
          // Clean up this drag state if there's an error
          delete shapeDragStatesRef.current[shapeId];
          delete isShapeDraggingRef.current[shapeId];
        }
      });
    },
    [scale]
  );

  const handleShapeDragStop = useCallback(
    (shapeId: string, x: number, y: number) => {
      // Cancel any pending animation frames
      if (shapeDragRafRef.current) {
        cancelAnimationFrame(shapeDragRafRef.current);
        shapeDragRafRef.current = null;
      }

      // Clear drag state and reset transform with comprehensive safety checks
      try {
        const dragState = shapeDragStatesRef.current[shapeId];
        if (dragState?.element) {
          const element = dragState.element;
          // Multiple safety checks before manipulating the element
          if (
            element &&
            typeof element === "object" &&
            element.isConnected &&
            element.style &&
            typeof element.style === "object"
          ) {
            element.style.transform = "";
            element.style.willChange = "auto";
          }
        }
      } catch (error) {
        console.warn(
          "Error resetting element transform on shape drag stop:",
          error
        );
      }

      // Clean up all drag-related state
      delete shapeDragStatesRef.current[shapeId];
      delete isShapeDraggingRef.current[shapeId];

      // Update the actual shape position in React state
      updateShape(shapeId, {
        x: x / scale,
        y: y / scale,
      });
    },
    [scale, updateShape]
  );

  // Update the drawing preview rendering
  const shapePreview = useMemo(() => {
    if (!isDrawingInProgress || !shapeDrawStart || !shapeDrawEnd) return null;

    const startX = Math.min(shapeDrawStart.x, shapeDrawEnd.x);
    const startY = Math.min(shapeDrawStart.y, shapeDrawEnd.y);
    const width = Math.abs(shapeDrawEnd.x - shapeDrawStart.x);
    const height = Math.abs(shapeDrawEnd.y - shapeDrawStart.y);

    return { x: startX, y: startY, width, height };
  }, [isDrawingInProgress, shapeDrawStart, shapeDrawEnd]);

  // Add tab switching function
  const handleTabChange = (tab: TabType) => {
    if (hasUnsavedChanges) {
      // Show a warning but allow the switch (user can save later if needed)
      console.warn("Switching tabs with unsaved changes");
    }

    // Immediately reset file detection to prevent race conditions
    setIsFileTypeDetected(false);
    setIsDocumentLoaded(false);
    setDocumentUrl("");
    setFileType(null);
    setError("");

    setCurrentTab(tab);
    setSelectedFieldId(null);
    setSelectedShapeId(null); // Deselect shapes when switching tabs
    setSettingsPopupFor(null);
    setTextSelectionPopup(null);
  };

  // Determine if controls should be shown based on current tab
  const showControls = currentTab !== "document";

  // Memoize filtered text fields to avoid unnecessary re-computations
  const visibleTextFields = useMemo(() => {
    const textFields = getTextFieldsFromWorkflowData();
    return textFields
      .filter((field) => field.page === currentPage)
      .filter((field) => !field.isFromWorkflow || showWorkflowFields);
  }, [getTextFieldsFromWorkflowData, currentPage, showWorkflowFields]);

  // Memoize filtered shapes to avoid unnecessary re-computations
  const visibleShapes = useMemo(() => {
    return getShapesAsArray().filter(
      (shape) => shape.page === currentPage && shape.tab === currentTab
    );
  }, [getShapesAsArray, currentPage, currentTab]);

  // Memoize filtered rectangles to avoid unnecessary re-computations
  const visibleRectangles = useMemo(() => {
    return getRectanglesAsArray().filter(
      (rec) => rec.page === currentPage && rec.tab === currentTab
    );
  }, [getRectanglesAsArray, currentPage, currentTab]);

  return (
    <AnimatePresence>
      <TooltipProvider>
        <div
          className={`${
            isOpen ? "flex" : "hidden"
          } relative w-full transition-all duration-300 ease-in-out  h-screen flex flex-col bg-gray-100 shadow-2xl`}
        >
          <style>{styles}</style>

          {/* Top Header Bar - Enhanced Red Design */}
          <div className="bg-gradient-to-r from-red-50 to-white shadow-lg border-b-2 border-red-500">
            <div className="relative max-w-7xl mx-auto">
              {/* Persistent Toolbar - Always visible */}
              <div className="bg-white/80 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
                  {/* Top Row */}
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-4">
                      {/* Views controls - Tab-like design */}
                      <div className="flex items-center bg-red-50 rounded-xl p-1 border border-red-200">
                        {/* Close button */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={handleClose}
                              className={`p-2 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg transition-all duration-200 flex items-center justify-center group relative ${
                                hasUnsavedChanges ? "ring-2 ring-amber-400" : ""
                              }`}
                            >
                              <X
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                              {hasUnsavedChanges && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse" />
                              )}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                            <p>
                              {hasUnsavedChanges
                                ? "Close (You have unsaved changes)"
                                : "Close Document Editor"}
                            </p>
                          </TooltipContent>
                        </Tooltip>

                        <div className="w-px h-6 bg-gray-300 mx-2"></div>

                        {/* Document tabs */}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleTabChange("document")}
                              className={`px-3 py-2 rounded-lg shadow-sm border transition-all duration-200 flex items-center gap-2 hover:shadow-md group ${
                                currentTab === "document"
                                  ? "bg-white text-red-700 border-red-200 hover:bg-red-50"
                                  : "text-red-600 hover:text-red-800 hover:bg-white/60 border-transparent"
                              }`}
                            >
                              <File
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                              <span className="text-sm font-medium">
                                Document
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                            <p>Original Document</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleTabChange("original")}
                              className={`px-3 py-2 rounded-lg shadow-sm border transition-all duration-200 flex items-center gap-2 hover:shadow-md group ${
                                currentTab === "original"
                                  ? "bg-white text-red-700 border-red-200 hover:bg-red-50"
                                  : "text-red-600 hover:text-red-800 hover:bg-white/60 border-transparent"
                              }`}
                            >
                              <FileText
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                              <span className="text-sm font-medium">
                                Original Template
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                            <p>Original Template</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => handleTabChange("translated")}
                              className={`px-3 py-2 rounded-lg shadow-sm border transition-all duration-200 flex items-center gap-2 hover:shadow-md group ${
                                currentTab === "translated"
                                  ? "bg-white text-red-700 border-red-200 hover:bg-red-50"
                                  : "text-red-600 hover:text-red-800 hover:bg-white/60 border-transparent"
                              }`}
                            >
                              <Languages
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                              <span className="text-sm font-medium">
                                Translated Template
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                            <p>Translated Template</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>

                      {/* Main Controls - Only show for template tabs */}
                      {showControls && (
                        <div className="flex items-center gap-6">
                          {/* Tools Section */}
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-gray-600">
                              Tools
                            </span>
                            <div className="flex items-center gap-2">
                              {/* Add textbox button */}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => {
                                      setIsAddTextBoxMode((prev) => !prev);
                                      setShapeDrawingMode(null);
                                      setIsTextSelectionMode(false);
                                    }}
                                    className={`px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group ${
                                      isAddTextBoxMode
                                        ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                                        : "bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300"
                                    } ${
                                      !isEditMode
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                    }`}
                                    disabled={!documentUrl || !isEditMode}
                                  >
                                    <Type
                                      size={18}
                                      className="group-hover:scale-110 transition-transform"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                                  <p>
                                    {isAddTextBoxMode
                                      ? "Click to place text field"
                                      : "Add Text Field"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => {
                                      setIsTextSelectionMode(
                                        !isTextSelectionMode
                                      );
                                      setShapeDrawingMode(null);
                                      setIsAddTextBoxMode(false);
                                    }}
                                    className={`px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group ${
                                      isTextSelectionMode
                                        ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                                        : "bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300"
                                    } ${
                                      !isEditMode
                                        ? "opacity-50 cursor-not-allowed"
                                        : ""
                                    }`}
                                    disabled={!documentUrl || !isEditMode}
                                  >
                                    <MousePointer2
                                      size={18}
                                      className="group-hover:scale-110 transition-transform"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                                  <p>
                                    {isTextSelectionMode
                                      ? "Text Selection Active"
                                      : "Select Text"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Draw Shape Dropdown */}
                              <div className="relative shape-dropdown">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <button
                                      ref={shapeButtonRef}
                                      onClick={(e) => {
                                        e.stopPropagation();

                                        if (
                                          !shapeDropdownOpen &&
                                          shapeButtonRef.current
                                        ) {
                                          const rect =
                                            shapeButtonRef.current.getBoundingClientRect();
                                          setDropdownPosition({
                                            top: rect.bottom + 4,
                                            left: rect.left,
                                          });
                                        }

                                        setShapeDropdownOpen(
                                          !shapeDropdownOpen
                                        );

                                        // If drawing mode is active, deactivate it
                                        if (shapeDrawingMode) {
                                          setShapeDrawingMode(null);
                                        }
                                        setIsAddTextBoxMode(false);
                                        setIsTextSelectionMode(false);
                                      }}
                                      className={`px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group ${
                                        shapeDrawingMode
                                          ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                                          : "bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300"
                                      } ${
                                        !isEditMode
                                          ? "opacity-50 cursor-not-allowed"
                                          : ""
                                      }`}
                                      disabled={!documentUrl || !isEditMode}
                                    >
                                      <div className="flex items-center gap-1">
                                        {selectedShapeType === "rectangle" ? (
                                          <Square
                                            size={18}
                                            className="group-hover:scale-110 transition-transform"
                                          />
                                        ) : (
                                          <Circle
                                            size={18}
                                            className="group-hover:scale-110 transition-transform"
                                          />
                                        )}
                                        <ChevronDown
                                          size={14}
                                          className={`transition-transform ml-1 ${
                                            shapeDropdownOpen
                                              ? "rotate-180"
                                              : ""
                                          }`}
                                        />
                                      </div>
                                    </button>
                                  </TooltipTrigger>
                                  <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                                    <p>
                                      {shapeDrawingMode
                                        ? `Drawing ${
                                            selectedShapeType === "rectangle"
                                              ? "Rectangle"
                                              : "Circle"
                                          }`
                                        : "Draw Shapes"}
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </div>

                          {/* View Section */}
                          <div className="flex items-center gap-3">
                            <div className="w-px h-8 bg-red-200"></div>
                            <span className="text-sm font-medium text-gray-600">
                              View
                            </span>
                            <div className="flex items-center gap-2">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() => setIsEditMode(!isEditMode)}
                                    className={`px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 group ${
                                      isEditMode
                                        ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                                        : "bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300"
                                    }`}
                                  >
                                    <Edit3
                                      size={18}
                                      className="group-hover:scale-110 transition-transform"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                                  <p>
                                    {isEditMode
                                      ? "Exit Edit Mode"
                                      : "Enter Edit Mode"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>

                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <button
                                    onClick={() =>
                                      setShowRectangles(!showRectangles)
                                    }
                                    className={`px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group ${
                                      showRectangles
                                        ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                                        : "bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300"
                                    }`}
                                  >
                                    <Trash2
                                      size={18}
                                      className="group-hover:scale-110 transition-transform"
                                    />
                                  </button>
                                </TooltipTrigger>
                                <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                                  <p>
                                    {showRectangles
                                      ? "Hide Deletion Rectangles"
                                      : "Show Deletion Rectangles"}
                                  </p>
                                </TooltipContent>
                              </Tooltip>

                              {/* Field Status Button - Only show for template tabs with workflow fields */}
                              {getTextFieldsFromWorkflowData().some(
                                (field) => field.isFromWorkflow && field.status
                              ) && (
                                <div className="relative field-status-dropdown">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <button
                                        ref={fieldStatusButtonRef}
                                        onClick={() => {
                                          if (
                                            !fieldStatusDropdownOpen &&
                                            fieldStatusButtonRef.current
                                          ) {
                                            const rect =
                                              fieldStatusButtonRef.current.getBoundingClientRect();
                                            setDropdownPosition({
                                              top: rect.bottom + 4,
                                              left: rect.left,
                                            });
                                          }
                                          setFieldStatusDropdownOpen(
                                            !fieldStatusDropdownOpen
                                          );
                                        }}
                                        className={`px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center gap-2 group ${
                                          fieldStatusDropdownOpen
                                            ? "bg-gradient-to-r from-red-500 to-red-600 text-white shadow-red-200"
                                            : "bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300"
                                        }`}
                                      >
                                        <Palette
                                          size={18}
                                          className="group-hover:scale-110 transition-transform"
                                        />
                                        <span className="text-sm font-medium">
                                          Field Status
                                        </span>
                                        <ChevronDown
                                          size={14}
                                          className={`transition-transform ${
                                            fieldStatusDropdownOpen
                                              ? "rotate-180"
                                              : ""
                                          }`}
                                        />
                                      </button>
                                    </TooltipTrigger>
                                    <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                                      <p>View Field Status Legend</p>
                                    </TooltipContent>
                                  </Tooltip>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right side - Export actions - Only show for template tabs */}
                    {showControls && (
                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.button
                                onClick={saveChanges}
                                disabled={
                                  !documentUrl || !hasUnsavedChanges || isSaving
                                }
                                className={`px-3 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group relative overflow-hidden ${
                                  hasUnsavedChanges
                                    ? isSaving
                                      ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                                      : "bg-gradient-to-r from-green-500 to-green-600 text-white shadow-green-200 hover:from-green-600 hover:to-green-700"
                                    : "bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300"
                                }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {isSaving ? (
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{
                                      duration: 1,
                                      repeat: Infinity,
                                      ease: "linear",
                                    }}
                                    className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full"
                                  />
                                ) : (
                                  <Save
                                    size={18}
                                    className="group-hover:scale-110 transition-transform"
                                  />
                                )}

                                {/* Saving shimmer effect */}
                                {isSaving && (
                                  <motion.div
                                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                                    animate={{
                                      x: ["-100%", "100%"],
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                    }}
                                  />
                                )}
                              </motion.button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                              <p>
                                {isSaving
                                  ? "Saving changes..."
                                  : hasUnsavedChanges
                                  ? "Save Changes"
                                  : "No changes to save"}
                              </p>
                            </TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <button
                                onClick={exportToPDF}
                                className="px-3 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 hover:border-gray-300 shadow-gray-100"
                                disabled={isLoading || !documentUrl}
                              >
                                {isLoading ? (
                                  <div
                                    className={`w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin`}
                                  />
                                ) : (
                                  <Download
                                    size={18}
                                    className="group-hover:scale-110 transition-transform"
                                  />
                                )}
                              </button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                              <p>
                                {isLoading
                                  ? "Exporting PDF..."
                                  : hasUnsavedChanges
                                  ? "Export to PDF (You have unsaved changes)"
                                  : "Export to PDF"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </div>

                        {/* Translate All Button - Only show on translated tab */}
                        {currentTab === "translated" && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <motion.button
                                onClick={translateAllFields}
                                disabled={
                                  !documentUrl ||
                                  !localWorkflowData?.translate_to ||
                                  isTranslatingAll ||
                                  !localWorkflowData?.fields ||
                                  Object.keys(localWorkflowData.fields)
                                    .length === 0
                                }
                                className={`px-3 py-2.5 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group ${
                                  isTranslatingAll
                                    ? "bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-blue-200"
                                    : "bg-gradient-to-r from-purple-500 to-purple-600 text-white shadow-purple-200 hover:from-purple-600 hover:to-purple-700"
                                } ${
                                  !documentUrl ||
                                  !localWorkflowData?.translate_to ||
                                  !localWorkflowData?.fields ||
                                  Object.keys(localWorkflowData.fields)
                                    .length === 0
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                }`}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                              >
                                {isTranslatingAll ? (
                                  <motion.div
                                    animate={{ rotate: 360 }}
                                    transition={{
                                      duration: 1,
                                      repeat: Infinity,
                                      ease: "linear",
                                    }}
                                    className="w-[18px] h-[18px] border-2 border-white border-t-transparent rounded-full"
                                  />
                                ) : (
                                  <Languages
                                    size={18}
                                    className="group-hover:scale-110 transition-transform"
                                  />
                                )}
                              </motion.button>
                            </TooltipTrigger>
                            <TooltipContent className="bg-white border border-gray-200 text-purple-600 rounded-lg shadow-lg">
                              <p>
                                {isTranslatingAll
                                  ? "Translating all fields..."
                                  : !localWorkflowData?.translate_to
                                  ? "No target language set"
                                  : !localWorkflowData?.fields ||
                                    Object.keys(localWorkflowData.fields)
                                      .length === 0
                                  ? "No fields to translate"
                                  : "Translate All Fields"}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Show loading state */}
          {workflowLoading && (
            <div className="flex-1 flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center p-8 text-center"
              >
                {/* Workflow Icon Animation */}
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
                  className="relative mb-6"
                >
                  {/* Workflow Document Stack */}
                  <motion.div className="relative">
                    {/* Background documents */}
                    <motion.div
                      animate={{
                        scale: [1, 1.02, 1],
                        rotate: [0, 2, 0],
                      }}
                      transition={{
                        duration: 3,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.2,
                      }}
                      className="absolute top-1 left-1 w-12 h-14 bg-gradient-to-br from-gray-400 to-gray-500 rounded-lg shadow-md"
                    />
                    <motion.div
                      animate={{
                        scale: [1, 1.03, 1],
                        rotate: [0, -1, 0],
                      }}
                      transition={{
                        duration: 2.5,
                        repeat: Infinity,
                        ease: "easeInOut",
                        delay: 0.1,
                      }}
                      className="absolute top-0.5 left-0.5 w-12 h-14 bg-gradient-to-br from-blue-400 to-blue-500 rounded-lg shadow-md"
                    />

                    {/* Front document */}
                    <motion.div
                      animate={{
                        scale: [1, 1.05, 1],
                        rotateY: [0, 3, 0],
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: "easeInOut",
                      }}
                      className="relative w-12 h-14 bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg overflow-hidden"
                    >
                      {/* Document content lines */}
                      <div className="absolute top-2 left-1.5 right-1.5 space-y-0.5">
                        {[...Array(4)].map((_, i) => (
                          <motion.div
                            key={i}
                            initial={{ width: 0 }}
                            animate={{ width: "100%" }}
                            transition={{
                              delay: 0.5 + i * 0.15,
                              duration: 0.6,
                              ease: "easeOut",
                            }}
                            className="h-0.5 bg-white/50 rounded"
                            style={{ width: i === 3 ? "70%" : "100%" }}
                          />
                        ))}
                      </div>

                      {/* Workflow badge */}
                      <div className="absolute bottom-1 left-1/2 transform -translate-x-1/2 text-white text-[8px] font-bold">
                        WF
                      </div>
                    </motion.div>
                  </motion.div>

                  {/* Workflow connection lines */}
                  <div className="absolute inset-0">
                    {[...Array(3)].map((_, i) => (
                      <motion.div
                        key={i}
                        className="absolute w-8 h-0.5 bg-red-400/60"
                        initial={{ scaleX: 0, opacity: 0 }}
                        animate={{
                          scaleX: [0, 1, 0],
                          opacity: [0, 1, 0],
                          x: [20, 30, 40],
                        }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          delay: i * 0.3,
                          ease: "easeInOut",
                        }}
                        style={{
                          left: "50%",
                          top: `${50 + (i - 1) * 15}%`,
                          transformOrigin: "left center",
                        }}
                      />
                    ))}
                  </div>
                </motion.div>

                {/* Loading Progress Indicator */}
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "100%", opacity: 1 }}
                  transition={{ delay: 0.3, duration: 0.8 }}
                  className="w-24 h-1 bg-gray-200 rounded-full overflow-hidden mb-4"
                >
                  <motion.div
                    className="h-full bg-gradient-to-r from-red-500 to-blue-500 rounded-full"
                    animate={{
                      x: ["-100%", "100%"],
                    }}
                    transition={{
                      duration: 1.8,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                  />
                </motion.div>

                {/* Loading Text */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="space-y-1"
                >
                  <motion.h3
                    animate={{
                      opacity: [0.7, 1, 0.7],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className="text-lg font-semibold text-gray-700"
                  >
                    Loading Workflow
                  </motion.h3>
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.7 }}
                    className="text-sm text-gray-500"
                  >
                    Setting up your document workflow...
                  </motion.p>
                </motion.div>

                {/* Pulsing Dots */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  className="flex space-x-1 mt-4"
                >
                  {[...Array(3)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-red-500 rounded-full"
                      animate={{
                        scale: [1, 1.4, 1],
                        opacity: [0.4, 1, 0.4],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Infinity,
                        delay: i * 0.25,
                        ease: "easeInOut",
                      }}
                    />
                  ))}
                </motion.div>
              </motion.div>
            </div>
          )}

          {/* Show error state */}
          {workflowError && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <p className="text-red-600 mb-4">{workflowError}</p>
                <button
                  onClick={fetchWorkflowData}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Show no workflow state */}
          {!workflowLoading && !workflowError && !localWorkflowData && (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Edit3 size={64} className="mb-4 text-gray-300 mx-auto" />
                <h2 className="text-xl font-semibold mb-2">
                  No Workflow Found
                </h2>
                <p className="text-gray-600">
                  No workflow data available for this conversation.
                </p>
              </div>
            </div>
          )}

          {/* Main content - only show when workflow data is available */}
          {!workflowLoading && !workflowError && localWorkflowData && (
            <>
              {isDragging && selectionRect && (
                <div
                  className="fixed border-2 border-blue-500 bg-blue-100 bg-opacity-20 z-[999] pointer-events-none"
                  style={{
                    left: `${selectionRect.left}px`,
                    top: `${selectionRect.top}px`,
                    width: `${selectionRect.width}px`,
                    height: `${selectionRect.height}px`,
                  }}
                />
              )}

              {/* Page Navigation Controls - Only show for PDFs with multiple pages */}
              {isPdfFile(documentUrl) && fileType === "pdf" && numPages > 1 && (
                <div className="bg-white border-b border-gray-200 px-4 py-2 flex items-center justify-center z-10">
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => goToPage(currentPage - 1)}
                      disabled={currentPage <= 1}
                      className="p-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      <ChevronLeft size={20} />
                    </button>
                    <span className="text-gray-700 min-w-[120px] text-center">
                      Page {currentPage} of {numPages}
                    </span>
                    <button
                      onClick={() => goToPage(currentPage + 1)}
                      disabled={currentPage >= numPages}
                      className="p-1 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded transition-colors"
                    >
                      <ChevronRight size={20} />
                    </button>
                  </div>
                </div>
              )}

              {/* Main Content Area */}
              <div
                className="flex-1 bg-gray-200 relative overflow-hidden"
                ref={containerRef}
              >
                {/* Vertical Zoom Controls - Adobe Acrobat Style */}
                {documentUrl && (
                  <div className="fixed bottom-6 right-6 z-[99999999999] flex flex-col items-center bg-white rounded-lg shadow-xl border border-gray-200">
                    {/* Auto Fit Button */}
                    <button
                      onClick={zoomToFitWidth}
                      className="p-2 hover:bg-gray-50 border-b border-gray-200 rounded-t-lg transition-colors group flex items-center justify-center"
                      title="Fit to Width"
                    >
                      <Maximize2
                        size={16}
                        className="text-gray-600 group-hover:text-gray-800"
                      />
                    </button>

                    {/* Zoom In Button */}
                    <button
                      onClick={zoomIn}
                      className="p-2 hover:bg-gray-50 border-b border-gray-200 transition-colors group flex items-center justify-center"
                      title="Zoom In"
                    >
                      <Plus
                        size={16}
                        className="text-gray-600 group-hover:text-gray-800"
                      />
                    </button>

                    {/* 300% Label */}
                    <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-gray-200">
                      300%
                    </div>

                    {/* Vertical Slider Container */}
                    <div className="relative py-4 px-3 flex flex-col items-center">
                      <div className="relative h-32 w-6 flex items-center justify-center">
                        {/* Slider Track */}
                        <div className="absolute w-1 h-full bg-gray-300 rounded-full"></div>

                        {/* Progress Track */}
                        <div
                          className="absolute w-1 bg-blue-500 rounded-full bottom-0"
                          style={{
                            height: `${((scale * 100 - 25) / 275) * 100}%`,
                          }}
                        ></div>

                        {/* Slider Input - Fixed positioning */}
                        <input
                          type="range"
                          min="25"
                          max="300"
                          value={Math.round(scale * 100)}
                          onChange={(e) => {
                            setZoomMode("page");
                            setScale(parseInt(e.target.value) / 100);
                          }}
                          className="absolute w-32 h-6 opacity-0 cursor-pointer origin-center"
                          style={{
                            transform: "rotate(-90deg)",
                            transformOrigin: "center",
                          }}
                        />

                        {/* Custom Handle */}
                        <div
                          className="absolute w-4 h-3 bg-white border-2 border-blue-500 rounded-sm shadow-sm pointer-events-none"
                          style={{
                            bottom: `${((scale * 100 - 25) / 275) * 100}%`,
                            transform: "translateY(50%)",
                          }}
                        ></div>
                      </div>
                    </div>

                    {/* 25% Label */}
                    <div className="px-3 py-1 text-xs text-gray-500 font-medium border-b border-gray-200">
                      25%
                    </div>

                    {/* Zoom Out Button */}
                    <button
                      onClick={zoomOut}
                      className="p-2 hover:bg-gray-50 border-b border-gray-200 transition-colors group flex items-center justify-center"
                      title="Zoom Out"
                    >
                      <Minus
                        size={16}
                        className="text-gray-600 group-hover:text-gray-800"
                      />
                    </button>

                    {/* Current Zoom Display */}
                    <div className="px-3 py-2 text-xs font-semibold text-gray-700 bg-gray-50 rounded-b-lg border-t border-gray-200 min-w-[60px] text-center">
                      {Math.round(scale * 100)}%
                    </div>
                  </div>
                )}

                {error && (
                  <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-red-100 border border-red-400 text-red-700 rounded px-4 py-2 z-[60]">
                    {error}
                  </div>
                )}

                {/* Beautiful Saved Indicator */}
                <AnimatePresence>
                  {showSavedIndicator && (
                    <motion.div
                      initial={{ opacity: 0, y: -50, scale: 0.8 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.9 }}
                      transition={{
                        type: "spring",
                        damping: 15,
                        stiffness: 300,
                      }}
                      className="absolute top-4 right-4 z-[70] bg-gradient-to-r from-green-500 to-emerald-600 text-white px-6 py-3 rounded-xl shadow-xl border border-green-400/20"
                    >
                      <div className="flex items-center gap-3">
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{
                            delay: 0.2,
                            type: "spring",
                            stiffness: 500,
                          }}
                          className="w-6 h-6 bg-white/20 rounded-full flex items-center justify-center"
                        >
                          <motion.svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{
                              delay: 0.3,
                              duration: 0.5,
                              ease: "easeOut",
                            }}
                          >
                            <motion.path d="m9 12 2 2 4-4" />
                          </motion.svg>
                        </motion.div>
                        <div className="flex flex-col">
                          <motion.span
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.1 }}
                            className="font-semibold text-sm"
                          >
                            Changes Saved
                          </motion.span>
                          <motion.span
                            initial={{ opacity: 0, x: 10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: 0.15 }}
                            className="text-xs text-green-100"
                          >
                            All changes have been saved successfully
                          </motion.span>
                        </div>
                      </div>

                      {/* Confetti particles */}
                      <div className="absolute inset-0 pointer-events-none">
                        {[...Array(8)].map((_, i) => (
                          <motion.div
                            key={i}
                            className="absolute w-1 h-1 bg-white/60 rounded-full"
                            initial={{
                              x: "50%",
                              y: "50%",
                              scale: 0,
                            }}
                            animate={{
                              x: `${50 + (Math.random() - 0.5) * 200}%`,
                              y: `${50 + (Math.random() - 0.5) * 200}%`,
                              scale: [0, 1, 0],
                            }}
                            transition={{
                              delay: 0.5 + i * 0.1,
                              duration: 1,
                              ease: "easeOut",
                            }}
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Text Selection Popup */}
                {textSelectionPopup && (
                  <div
                    className={`fixed bg-white shadow-lg rounded-md border border-gray-200 z-[1000] p-2 flex flex-col max-h-60 overflow-y-auto text-selection-popup max-w-xs ${
                      textSelectionPopup.popupPosition.position === "above"
                        ? "bottom-auto"
                        : "top-auto"
                    }`}
                    style={{
                      top:
                        textSelectionPopup.popupPosition.position === "below"
                          ? `${textSelectionPopup.popupPosition.top}px`
                          : undefined,
                      bottom:
                        textSelectionPopup.popupPosition.position === "above"
                          ? `${
                              window.innerHeight -
                              textSelectionPopup.popupPosition.top
                            }px`
                          : undefined,
                      left: `${textSelectionPopup.popupPosition.left}px`,
                      transform: "translateX(-50%)",
                      maxWidth: "300px",
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex justify-between items-center mb-2 pb-2 border-b">
                      <span className="text-sm font-medium">
                        {textSelectionPopup.texts.length} selected
                      </span>
                      <button
                        onClick={() => setTextSelectionPopup(null)}
                        className="text-gray-500 hover:text-gray-800"
                      >
                        <X size={16} />
                      </button>
                    </div>

                    {textSelectionPopup.texts.map((sel, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between py-1"
                      >
                        <span className="text-sm truncate flex-1">
                          {sel.text}
                        </span>
                        <div className="flex space-x-1 ml-2">
                          <button
                            onClick={() => {
                              const newSelections = [
                                ...textSelectionPopup.texts,
                              ];
                              newSelections.splice(index, 1);

                              if (newSelections.length === 0) {
                                setTextSelectionPopup(null);
                              } else {
                                setTextSelectionPopup({
                                  texts: newSelections,
                                  popupPosition:
                                    textSelectionPopup.popupPosition,
                                });
                              }
                            }}
                            className="p-1 text-gray-500 hover:text-red-500"
                            title="Remove from selection"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    ))}

                    <button
                      onClick={() => {
                        textSelectionPopup.texts.forEach((sel) => {
                          addDeletionRectangle(sel);
                        });
                        setTextSelectionPopup(null);
                      }}
                      className="mt-2 p-2 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center justify-center"
                    >
                      <Trash2 size={14} className="mr-1" />
                      <span>Delete Selected Text</span>
                    </button>

                    <button
                      onClick={() => {
                        textSelectionPopup.texts.forEach((sel) => {
                          console.log("Text coordinates:", sel.pagePosition);
                        });
                        setTextSelectionPopup(null);
                      }}
                      className="mt-2 p-1 bg-red-500 text-white rounded-md hover:bg-red-600 flex items-center justify-center"
                    >
                      <Trash2 size={14} className="mr-1" />
                      <span>Log all positions</span>
                    </button>
                  </div>
                )}
                {documentUrl ? (
                  <div className="flex flex-col h-full">
                    <div
                      className="flex-1 overflow-x-scroll overflow-y-auto p-4 max-h-full"
                      style={{ scrollbarWidth: "thin" }}
                    >
                      <div
                        className={`relative bg-white shadow-lg mx-auto ${
                          isTextSelectionMode ? "text-selection-mode" : ""
                        }`}
                        ref={documentRef}
                        style={{
                          // transform: `scale(${scale})`,
                          // transformOrigin: 'top left',
                          width: pageWidth * scale,
                          height: pageHeight * scale,
                          minWidth: pageWidth * scale,
                          minHeight: pageHeight * scale,
                        }}
                        onContextMenu={(e) => {
                          if (isTextSelectionMode) {
                            e.preventDefault();
                          }
                        }}
                        onClick={handleDocumentContainerClick}
                        // Event handlers for text selection and shape drawing
                        onMouseDown={(e) => {
                          if (shapeDrawingMode && !isDrawingInProgress) {
                            handleShapeDrawStart(e);
                          } else {
                            handleMouseDown(e);
                          }
                        }}
                        onMouseMove={(e) => {
                          if (isDrawingInProgress) {
                            handleShapeDrawMove(e);
                          } else {
                            handleMouseMove(e);
                          }
                        }}
                        onMouseUp={(e) => {
                          if (isDrawingInProgress) {
                            handleShapeDrawEnd();
                          } else {
                            handleMouseUp(e);
                          }
                        }}
                        onMouseLeave={() => {
                          setMouseDownTime(null);
                          if (isDragging) {
                            setIsDragging(false);
                            setDragStart(null);
                            setDragEnd(null);
                          }
                          if (isDrawingInProgress) {
                            setIsDrawingInProgress(false);
                            setShapeDrawStart(null);
                            setShapeDrawEnd(null);
                          }
                        }}
                      >
                        {/* Document - Conditional rendering based on file type */}
                        {!isFileTypeDetected ? (
                          <div className="p-8 text-center">
                            <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                            Detecting document type...
                          </div>
                        ) : !documentUrl ? (
                          <div className="p-8 text-center">
                            No document available for this tab
                          </div>
                        ) : isImageFile(documentUrl) ? (
                          // ALWAYS render images first - never let them reach PDF.js
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
                        ) : isPdfFile(documentUrl) && fileType === "pdf" ? (
                          // Only render PDF.js if it's definitely a PDF file
                          <Document
                            file={documentUrl}
                            onLoadSuccess={handleDocumentLoadSuccess}
                            onLoadError={handleDocumentLoadError}
                            loading={
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="flex flex-col items-center justify-center p-12 text-center"
                              >
                                {/* PDF Icon Animation */}
                                <motion.div
                                  initial={{ scale: 0.8, opacity: 0 }}
                                  animate={{ scale: 1, opacity: 1 }}
                                  transition={{
                                    delay: 0.1,
                                    type: "spring",
                                    stiffness: 200,
                                  }}
                                  className="relative mb-6"
                                >
                                  {/* PDF Document Icon */}
                                  <motion.div
                                    animate={{
                                      scale: [1, 1.05, 1],
                                      rotateY: [0, 5, 0],
                                    }}
                                    transition={{
                                      duration: 2,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                    }}
                                    className="w-16 h-20 bg-gradient-to-br from-red-500 to-red-600 rounded-lg shadow-lg relative overflow-hidden"
                                  >
                                    {/* PDF Text */}
                                    <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 text-white text-xs font-bold">
                                      PDF
                                    </div>

                                    {/* Document Lines */}
                                    <div className="absolute top-3 left-2 right-2 space-y-1">
                                      {[...Array(3)].map((_, i) => (
                                        <motion.div
                                          key={i}
                                          initial={{ width: 0 }}
                                          animate={{ width: "100%" }}
                                          transition={{
                                            delay: 0.5 + i * 0.2,
                                            duration: 0.8,
                                            ease: "easeOut",
                                          }}
                                          className="h-0.5 bg-white/40 rounded"
                                        />
                                      ))}
                                    </div>

                                    {/* Corner Fold */}
                                    <div className="absolute top-0 right-0 w-3 h-3 bg-red-400 transform rotate-45 translate-x-1.5 -translate-y-1.5" />
                                  </motion.div>

                                  {/* Floating Loading Particles */}
                                  <div className="absolute inset-0">
                                    {[...Array(6)].map((_, i) => (
                                      <motion.div
                                        key={i}
                                        className="absolute w-1 h-1 bg-red-400 rounded-full"
                                        animate={{
                                          y: [-20, -40, -20],
                                          x: [
                                            Math.cos((i * 60 * Math.PI) / 180) *
                                              30,
                                            Math.cos((i * 60 * Math.PI) / 180) *
                                              40,
                                            Math.cos((i * 60 * Math.PI) / 180) *
                                              30,
                                          ],
                                          opacity: [0.3, 0.8, 0.3],
                                          scale: [0.5, 1, 0.5],
                                        }}
                                        transition={{
                                          duration: 2 + i * 0.2,
                                          repeat: Infinity,
                                          ease: "easeInOut",
                                          delay: i * 0.3,
                                        }}
                                        style={{
                                          left: "50%",
                                          top: "50%",
                                        }}
                                      />
                                    ))}
                                  </div>
                                </motion.div>

                                {/* Loading Progress Bar */}
                                <motion.div
                                  initial={{ width: 0, opacity: 0 }}
                                  animate={{ width: "100%", opacity: 1 }}
                                  transition={{ delay: 0.3, duration: 0.8 }}
                                  className="w-32 h-1 bg-gray-200 rounded-full overflow-hidden mb-4"
                                >
                                  <motion.div
                                    className="h-full bg-gradient-to-r from-red-500 to-red-600 rounded-full"
                                    animate={{
                                      x: ["-100%", "100%"],
                                    }}
                                    transition={{
                                      duration: 1.5,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                    }}
                                  />
                                </motion.div>

                                {/* Loading Text */}
                                <motion.div
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: 0.5 }}
                                  className="space-y-1"
                                >
                                  <motion.h3
                                    animate={{
                                      opacity: [0.7, 1, 0.7],
                                    }}
                                    transition={{
                                      duration: 2,
                                      repeat: Infinity,
                                      ease: "easeInOut",
                                    }}
                                    className="text-lg font-semibold text-gray-700"
                                  >
                                    Loading PDF Document
                                  </motion.h3>
                                  <motion.p
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.7 }}
                                    className="text-sm text-gray-500"
                                  >
                                    Preparing your document for editing...
                                  </motion.p>
                                </motion.div>

                                {/* Loading Dots */}
                                <motion.div
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: 0.8 }}
                                  className="flex space-x-1 mt-4"
                                >
                                  {[...Array(3)].map((_, i) => (
                                    <motion.div
                                      key={i}
                                      className="w-2 h-2 bg-red-500 rounded-full"
                                      animate={{
                                        scale: [1, 1.3, 1],
                                        opacity: [0.5, 1, 0.5],
                                      }}
                                      transition={{
                                        duration: 1.2,
                                        repeat: Infinity,
                                        delay: i * 0.2,
                                        ease: "easeInOut",
                                      }}
                                    />
                                  ))}
                                </motion.div>
                              </motion.div>
                            }
                          >
                            <Page
                              pageNumber={currentPage}
                              onLoadSuccess={handlePageLoadSuccess}
                              renderTextLayer={isTextSelectionMode}
                              renderAnnotationLayer={false}
                              width={pageWidth * scale}
                              renderMode="canvas"
                            />
                          </Document>
                        ) : (
                          <div className="p-8 text-center text-red-600">
                            <p>Unsupported document type</p>
                            <p className="text-sm text-gray-500 mt-2">
                              File:{" "}
                              {documentUrl.split("/").pop()?.split("?")[0]}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">
                              Extension: {getCleanExtension(documentUrl)}
                            </p>
                          </div>
                        )}

                        {/* Deletion Rectangle Overlays - Only show when document is fully loaded */}
                        {isDocumentLoaded &&
                          visibleRectangles.map((rec) => (
                            <div
                              key={rec.id}
                              className={`absolute bg-white ${
                                showRectangles
                                  ? "bg-opacity-90 border border-red-300"
                                  : ""
                              }  flex items-center justify-center`}
                              style={{
                                left: rec.x * scale,
                                top: rec.y * scale,
                                width: rec.width * scale,
                                height: rec.height * scale,
                                zIndex: 50,
                                backgroundColor: rec.background || "white", // Use captured color
                                border: showRectangles
                                  ? "1px dashed red"
                                  : "none",
                              }}
                            >
                              {showRectangles && (
                                <button
                                  onClick={() =>
                                    deleteDeletionRectangle(rec.id)
                                  }
                                  className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
                                >
                                  <X size={12} />
                                </button>
                              )}
                            </div>
                          ))}

                        {/* Shape Preview during drawing - Only show when document is fully loaded */}
                        {isDocumentLoaded &&
                          shapePreview &&
                          shapeDrawingMode && (
                            <div
                              className="absolute border-2 border-dashed border-blue-500 bg-blue-100 bg-opacity-20 pointer-events-none"
                              style={{
                                left: shapePreview.x * scale,
                                top: shapePreview.y * scale,
                                width: shapePreview.width * scale,
                                height: shapePreview.height * scale,
                                borderRadius:
                                  shapeDrawingMode === "circle" ? "50%" : "0",
                                zIndex: 1000,
                              }}
                            />
                          )}

                        {/* Shape Overlays - Only show when document is fully loaded */}
                        {isDocumentLoaded &&
                          visibleShapes.map((shape) => (
                            <Rnd
                              key={shape.id}
                              size={{
                                width: shape.width * scale,
                                height: shape.height * scale,
                              }}
                              position={{
                                x: shape.x * scale,
                                y: shape.y * scale,
                              }}
                              onDrag={(e, d) => {
                                // Use currentTarget directly - it's the Rnd element
                                const element = e.currentTarget as HTMLElement;
                                handleShapeDrag(shape.id, d.x, d.y, element);
                              }}
                              onDragStop={(e, d) => {
                                handleShapeDragStop(shape.id, d.x, d.y);
                              }}
                              onResizeStop={(
                                e,
                                direction,
                                ref,
                                delta,
                                position
                              ) => {
                                updateShape(shape.id, {
                                  width: parseInt(ref.style.width) / scale,
                                  height: parseInt(ref.style.height) / scale,
                                  x: position.x / scale,
                                  y: position.y / scale,
                                });
                              }}
                              disableDragging={!isEditMode}
                              enableResizing={
                                isEditMode && selectedShapeId === shape.id
                              }
                              bounds="parent"
                              onClick={(e: { stopPropagation: () => void }) => {
                                e.stopPropagation();
                                setSelectedShapeId(shape.id);
                                setSelectedFieldId(null);
                                setIsTextSelectionMode(false);
                              }}
                              dragHandleClassName="shape-drag-handle"
                              className={`${
                                isEditMode && selectedShapeId === shape.id
                                  ? "border-2 border-blue-500"
                                  : "border-2 border-transparent hover:border-blue-400"
                              } transition-all duration-200 ease-in-out`}
                              style={{
                                zIndex:
                                  selectedShapeId === shape.id ? 1000 : 200,
                                cursor: isEditMode ? "move" : "default",
                              }}
                            >
                              <div className="w-full h-full relative group">
                                {/* Shape Element */}
                                <div
                                  className="w-full h-full shape-drag-handle"
                                  style={{
                                    backgroundColor: hexToRgba(
                                      shape.fillColor,
                                      shape.fillOpacity
                                    ),
                                    border: `${shape.borderWidth}px solid ${shape.borderColor}`,
                                    borderRadius:
                                      shape.type === "circle" ? "50%" : "0",
                                    transform: shape.rotation
                                      ? `rotate(${shape.rotation}deg)`
                                      : "none",
                                    transformOrigin: "center center",
                                  }}
                                />

                                {/* Shape Controls */}
                                {isEditMode && selectedShapeId === shape.id && (
                                  <>
                                    {/* Delete button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteShape(shape.id);
                                      }}
                                      className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
                                    >
                                      <Trash2 size={10} />
                                    </button>

                                    {/* Settings button */}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSettingsPopupFor(shape.id);
                                      }}
                                      className={`absolute top-0 right-0 transform -translate-y-1/2 translate-x-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors z-10 ${
                                        settingsPopupFor === shape.id
                                          ? "bg-gray-100 border-gray-400"
                                          : ""
                                      }`}
                                    >
                                      <Palette
                                        size={14}
                                        className="text-gray-600"
                                      />
                                    </button>

                                    {/* Shape Settings popup */}
                                    {settingsPopupFor === shape.id && (
                                      <div
                                        className="absolute top-0 right-0 transform translate-y-8 translate-x-1 bg-white shadow-xl rounded-lg p-4 z-[9999999999] border border-gray-200 w-72 settings-popup"
                                        style={{
                                          transform: `translate(0.25rem, 2rem) scale(${Math.max(
                                            0.6,
                                            1 / scale
                                          )})`,
                                          transformOrigin: "top right",
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      >
                                        <div className="flex justify-between items-center mb-3">
                                          <h3 className="font-semibold text-gray-800">
                                            {shape.type === "circle"
                                              ? "Circle"
                                              : "Rectangle"}{" "}
                                            Settings
                                          </h3>
                                          <button
                                            onClick={() =>
                                              setSettingsPopupFor(null)
                                            }
                                            className="text-gray-500 hover:text-gray-800"
                                          >
                                            <X size={16} />
                                          </button>
                                        </div>

                                        <div className="space-y-4">
                                          {/* Position Controls */}
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                X Position
                                              </label>
                                              <input
                                                type="number"
                                                value={Math.round(shape.x)}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    x:
                                                      parseInt(
                                                        e.target.value
                                                      ) || 0,
                                                  })
                                                }
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                                min="0"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Y Position
                                              </label>
                                              <input
                                                type="number"
                                                value={Math.round(shape.y)}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    y:
                                                      parseInt(
                                                        e.target.value
                                                      ) || 0,
                                                  })
                                                }
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                                min="0"
                                              />
                                            </div>
                                          </div>

                                          {/* Size Controls */}
                                          <div className="grid grid-cols-2 gap-3">
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Width
                                              </label>
                                              <input
                                                type="number"
                                                value={Math.round(shape.width)}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    width:
                                                      parseInt(
                                                        e.target.value
                                                      ) || 1,
                                                  })
                                                }
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                                min="1"
                                              />
                                            </div>
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Height
                                              </label>
                                              <input
                                                type="number"
                                                value={Math.round(shape.height)}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    height:
                                                      parseInt(
                                                        e.target.value
                                                      ) || 1,
                                                  })
                                                }
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                                min="1"
                                              />
                                            </div>
                                          </div>

                                          {/* Border Settings */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">
                                              Border
                                            </label>
                                            <div className="flex items-center space-x-2 mb-2">
                                              <input
                                                type="color"
                                                value={shape.borderColor}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    borderColor: e.target.value,
                                                  })
                                                }
                                                className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                                              />
                                              <input
                                                type="text"
                                                value={shape.borderColor}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    borderColor: e.target.value,
                                                  })
                                                }
                                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-500"
                                                placeholder="#000000"
                                              />
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              <span className="text-xs text-gray-600 min-w-[40px]">
                                                Width:
                                              </span>
                                              <input
                                                type="range"
                                                min="0"
                                                max="10"
                                                step="1"
                                                value={shape.borderWidth}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    borderWidth: parseInt(
                                                      e.target.value
                                                    ),
                                                  })
                                                }
                                                className="flex-1 shape-slider"
                                              />
                                              <span className="text-xs font-medium text-gray-700 min-w-[25px] text-center">
                                                {shape.borderWidth}px
                                              </span>
                                            </div>
                                          </div>

                                          {/* Fill Settings */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-2">
                                              Fill
                                            </label>
                                            <div className="flex items-center space-x-2 mb-2">
                                              <input
                                                type="color"
                                                value={shape.fillColor}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    fillColor: e.target.value,
                                                  })
                                                }
                                                className="w-10 h-8 border border-gray-300 rounded cursor-pointer"
                                              />
                                              <input
                                                type="text"
                                                value={shape.fillColor}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    fillColor: e.target.value,
                                                  })
                                                }
                                                className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-red-500"
                                                placeholder="#ffffff"
                                              />
                                            </div>
                                            <div className="flex items-center space-x-2">
                                              <span className="text-xs text-gray-600 min-w-[50px]">
                                                Opacity:
                                              </span>
                                              <input
                                                type="range"
                                                min="0"
                                                max="1"
                                                step="0.01"
                                                value={shape.fillOpacity}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    fillOpacity: parseFloat(
                                                      e.target.value
                                                    ),
                                                  })
                                                }
                                                className="flex-1 shape-slider"
                                              />
                                              <span className="text-xs font-medium text-gray-700 min-w-[35px] text-center">
                                                {Math.round(
                                                  shape.fillOpacity * 100
                                                )}
                                                %
                                              </span>
                                            </div>
                                          </div>

                                          {/* Rotation */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Rotation
                                            </label>
                                            <div className="flex items-center space-x-2">
                                              <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                step="5"
                                                value={shape.rotation || 0}
                                                onChange={(e) =>
                                                  updateShape(shape.id, {
                                                    rotation: parseInt(
                                                      e.target.value
                                                    ),
                                                  })
                                                }
                                                className="flex-1 shape-slider"
                                              />
                                              <span className="text-xs font-medium text-gray-700 min-w-[30px] text-center">
                                                {shape.rotation || 0}°
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                )}
                              </div>
                            </Rnd>
                          ))}

                        {/* Text Field Overlays - Only show when document is fully loaded */}
                        {isDocumentLoaded &&
                          visibleTextFields.map((field) => {
                            return (
                              <Rnd
                                key={field.id}
                                size={{
                                  width: field.width * scale,
                                  height: field.height * scale,
                                }}
                                position={{
                                  x: field.x * scale,
                                  y: field.y * scale,
                                }}
                                onDrag={(e, d) => {
                                  // Use currentTarget directly - it's the Rnd element
                                  const element =
                                    e.currentTarget as HTMLElement;
                                  handleFieldDrag(field.id, d.x, d.y, element);
                                }}
                                onDragStop={(e, d) => {
                                  handleFieldDragStop(field.id, d.x, d.y);
                                }}
                                onResizeStop={(
                                  e,
                                  direction,
                                  ref,
                                  delta,
                                  position
                                ) => {
                                  // Convert scaled dimensions back to original scale
                                  updateTextField(field.id, {
                                    width: parseInt(ref.style.width) / scale,
                                    height: parseInt(ref.style.height) / scale,
                                    x: position.x / scale,
                                    y: position.y / scale,
                                  });
                                }}
                                disableDragging={!isEditMode || isRotating}
                                enableResizing={false}
                                bounds="parent"
                                onClick={(e: {
                                  stopPropagation: () => void;
                                }) => {
                                  e.stopPropagation();
                                  setSelectedFieldId(field.id);
                                  setIsTextSelectionMode(false);
                                }}
                                dragHandleClassName="drag-handle"
                                dragAxis="both"
                                dragGrid={[1, 1]}
                                resizeGrid={[1, 1]}
                                className={`border-2 ${
                                  isEditMode &&
                                  field.isFromWorkflow &&
                                  field.status
                                    ? `hover:border-opacity-80`
                                    : isEditMode
                                    ? "border-gray-300 hover:border-blue-400"
                                    : "border-transparent"
                                } ${
                                  isEditMode && selectedFieldId === field.id
                                    ? "border-blue-500"
                                    : ""
                                } ${
                                  isEditMode &&
                                  isRotating &&
                                  rotatingFieldId === field.id
                                    ? "border-yellow-500 border-2"
                                    : ""
                                } transition-all duration-200 ease-in-out`}
                                style={{
                                  backgroundColor: isEditMode
                                    ? "rgba(255, 255, 255, 0.1)"
                                    : "transparent",
                                  transition: "transform 0.1s ease-out",
                                  zIndex:
                                    selectedFieldId === field.id ? 1000 : 100,
                                  transform: "none", // Ensure no additional scaling
                                  cursor:
                                    isRotating && rotatingFieldId === field.id
                                      ? "grabbing"
                                      : "auto",
                                  // Add status-based border color only in edit mode
                                  borderColor:
                                    isEditMode &&
                                    field.isFromWorkflow &&
                                    field.status &&
                                    selectedFieldId !== field.id &&
                                    !isRotating
                                      ? getStatusColor(field.status)
                                      : undefined,
                                }}
                              >
                                <div className="w-full h-full relative group">
                                  {/* Move handle */}
                                  {isEditMode &&
                                    selectedFieldId === field.id && (
                                      <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
                                        {/* Move handle */}
                                        <div className="drag-handle bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                                          <Move size={10} />
                                        </div>

                                        {/* Font size input */}
                                        <div className="flex items-center bg-white rounded-md shadow-lg overflow-hidden">
                                          <input
                                            type="number"
                                            value={
                                              Math.round(field.fontSize * 10) /
                                              10
                                            }
                                            onChange={(e) => {
                                              e.stopPropagation();
                                              const newSize =
                                                parseFloat(e.target.value) || 5;
                                              updateTextField(field.id, {
                                                fontSize: Math.max(
                                                  5,
                                                  Math.min(72, newSize)
                                                ),
                                              });
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                            onFocus={(e) => {
                                              e.stopPropagation();
                                              e.target.select();
                                            }}
                                            className="text-black text-xs font-medium px-2 py-1 w-12 text-center border-none outline-none bg-transparent"
                                            min="5"
                                            max="72"
                                            step="0.1"
                                            title="Font size"
                                          />
                                          <span className="text-gray-500 text-xs pr-1">
                                            px
                                          </span>
                                        </div>
                                      </div>
                                    )}

                                  {/* Delete button */}
                                  {isEditMode &&
                                    selectedFieldId === field.id && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (field.isFromWorkflow) {
                                            // Show confirmation for workflow fields
                                            if (
                                              confirm(
                                                `Are you sure you want to delete the "${field.fieldKey}" field?\n\nThis will remove the field from both the form data and template mappings.`
                                              )
                                            ) {
                                              deleteTextField(field.id);
                                            }
                                          } else {
                                            // Direct delete for regular text fields
                                            deleteTextField(field.id);
                                          }
                                        }}
                                        className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
                                        title={
                                          field.isFromWorkflow
                                            ? "Delete workflow field and remove from template mappings"
                                            : "Delete text field"
                                        }
                                      >
                                        <Trash2 size={10} />
                                      </button>
                                    )}

                                  {/* Field properties */}
                                  {isEditMode &&
                                    selectedFieldId === field.id && (
                                      <>
                                        {/* Settings button */}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSettingsPopupFor(field.id);
                                          }}
                                          className={`absolute top-0 right-0 transform -translate-y-1/2 translate-x-1/2 w-6 h-6 bg-white border border-gray-300 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors z-10 ${
                                            settingsPopupFor === field.id
                                              ? "bg-gray-100 border-gray-400"
                                              : ""
                                          }`}
                                        >
                                          <MoreHorizontal
                                            size={14}
                                            className="text-gray-600"
                                          />
                                        </button>

                                        {/* Settings popup */}
                                        {settingsPopupFor === field.id && (
                                          <div
                                            className=" absolute top-0 right-0 transform translate-y-8 translate-x-1 bg-white shadow-xl rounded-lg p-4 z-[9999999999] border border-gray-200 w-64 settings-popup"
                                            style={{
                                              transform: `translate(0.25rem, 2rem) scale(${Math.max(
                                                0.6,
                                                1 / scale
                                              )})`,
                                              transformOrigin: "top right",
                                            }}
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            <div className="flex justify-between items-center mb-3">
                                              <h3 className="font-semibold text-gray-800">
                                                Field Settings
                                              </h3>
                                              <button
                                                onClick={() =>
                                                  setSettingsPopupFor(null)
                                                }
                                                className="text-gray-500 hover:text-gray-800"
                                              >
                                                <X size={16} />
                                              </button>
                                            </div>

                                            <div className="space-y-4">
                                              {/* Field Values - Only show for workflow fields */}
                                              {field.isFromWorkflow &&
                                                field.fieldKey &&
                                                localWorkflowData?.fields?.[
                                                  field.fieldKey
                                                ] && (
                                                  <div className="grid grid-cols-1 mb-4">
                                                    {/* Original Value */}
                                                    <div>
                                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Original Value
                                                        {currentTab ===
                                                          "translated" && (
                                                          <span className="text-xs text-gray-500 ml-1">
                                                            (read-only)
                                                          </span>
                                                        )}
                                                      </label>
                                                      {currentTab ===
                                                      "original" ? (
                                                        <textarea
                                                          value={
                                                            localWorkflowData
                                                              ?.fields?.[
                                                              field.fieldKey ||
                                                                ""
                                                            ]?.value || ""
                                                          }
                                                          onChange={(e) => {
                                                            // Update workflow data and text field
                                                            const newValue =
                                                              e.target.value;
                                                            const fieldKey =
                                                              field.fieldKey;
                                                            if (
                                                              localWorkflowData.fields &&
                                                              fieldKey
                                                            ) {
                                                              setLocalWorkflowData(
                                                                (prev) => {
                                                                  if (!prev)
                                                                    return prev;
                                                                  const updatedFields =
                                                                    {
                                                                      ...prev.fields,
                                                                    };
                                                                  if (
                                                                    updatedFields[
                                                                      fieldKey
                                                                    ]
                                                                  ) {
                                                                    updatedFields[
                                                                      fieldKey
                                                                    ] = {
                                                                      ...updatedFields[
                                                                        fieldKey
                                                                      ],
                                                                      value:
                                                                        newValue,
                                                                      value_status:
                                                                        newValue.trim() ===
                                                                        ""
                                                                          ? "pending"
                                                                          : "edited",
                                                                    };
                                                                  }
                                                                  return {
                                                                    ...prev,
                                                                    fields:
                                                                      updatedFields,
                                                                  } as WorkflowData;
                                                                }
                                                              );
                                                            }
                                                            updateTextField(
                                                              field.id,
                                                              {
                                                                value: newValue,
                                                              }
                                                            );
                                                            markAsUnsaved();
                                                          }}
                                                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 resize-none"
                                                          placeholder="Enter original value..."
                                                          rows={2}
                                                        />
                                                      ) : (
                                                        <div className="w-full px-3 py-2 text-sm text-gray-600 rounded-lg min-h-[24px] whitespace-pre-wrap">
                                                          {localWorkflowData
                                                            ?.fields?.[
                                                            field.fieldKey || ""
                                                          ]?.value || (
                                                            <span className="text-gray-400 italic">
                                                              No original value
                                                            </span>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* Translated Value */}
                                                    <div>
                                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Translated Value
                                                        {currentTab ===
                                                          "original" && (
                                                          <span className="text-xs text-gray-500 ml-1">
                                                            (read-only)
                                                          </span>
                                                        )}
                                                      </label>
                                                      {currentTab ===
                                                      "translated" ? (
                                                        <div className="flex items-center space-x-2">
                                                          <textarea
                                                            value={
                                                              localWorkflowData
                                                                ?.fields?.[
                                                                field.fieldKey ||
                                                                  ""
                                                              ]
                                                                ?.translated_value ||
                                                              ""
                                                            }
                                                            onChange={(e) => {
                                                              // Update workflow data and text field
                                                              const newValue =
                                                                e.target.value;
                                                              const fieldKey =
                                                                field.fieldKey;
                                                              if (
                                                                localWorkflowData?.fields &&
                                                                fieldKey
                                                              ) {
                                                                setLocalWorkflowData(
                                                                  (prev) => {
                                                                    if (!prev)
                                                                      return prev;
                                                                    const updatedFields =
                                                                      {
                                                                        ...prev.fields,
                                                                      };
                                                                    if (
                                                                      updatedFields[
                                                                        fieldKey
                                                                      ]
                                                                    ) {
                                                                      updatedFields[
                                                                        fieldKey
                                                                      ] = {
                                                                        ...updatedFields[
                                                                          fieldKey
                                                                        ],
                                                                        translated_value:
                                                                          newValue,
                                                                        translated_status:
                                                                          newValue.trim() ===
                                                                          ""
                                                                            ? "pending"
                                                                            : "edited",
                                                                      };
                                                                    }
                                                                    return {
                                                                      ...prev,
                                                                      fields:
                                                                        updatedFields,
                                                                    } as WorkflowData;
                                                                  }
                                                                );
                                                              }
                                                              // Update text field value since we're on translated tab
                                                              updateTextField(
                                                                field.id,
                                                                {
                                                                  value:
                                                                    newValue,
                                                                }
                                                              );
                                                              markAsUnsaved();
                                                            }}
                                                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white transition-all duration-200 resize-none"
                                                            placeholder="Enter translated value..."
                                                            rows={2}
                                                          />
                                                          {/* Translate Button */}
                                                          <TranslateFieldButton
                                                            fieldKey={
                                                              field.fieldKey
                                                            }
                                                            conversationId={
                                                              conversationId ||
                                                              ""
                                                            }
                                                            originalValue={
                                                              localWorkflowData
                                                                ?.fields?.[
                                                                field.fieldKey ||
                                                                  ""
                                                              ]?.value
                                                            }
                                                            setTranslatedValue={(
                                                              val
                                                            ) => {
                                                              const fieldKey =
                                                                field.fieldKey;
                                                              if (
                                                                localWorkflowData?.fields &&
                                                                fieldKey
                                                              ) {
                                                                setLocalWorkflowData(
                                                                  (prev) => {
                                                                    if (!prev)
                                                                      return prev;
                                                                    const updatedFields =
                                                                      {
                                                                        ...prev.fields,
                                                                      };
                                                                    if (
                                                                      updatedFields[
                                                                        fieldKey
                                                                      ]
                                                                    ) {
                                                                      updatedFields[
                                                                        fieldKey
                                                                      ] = {
                                                                        ...updatedFields[
                                                                          fieldKey
                                                                        ],
                                                                        translated_value:
                                                                          val,
                                                                        translated_status:
                                                                          "translated",
                                                                      };
                                                                    }
                                                                    return {
                                                                      ...prev,
                                                                      fields:
                                                                        updatedFields,
                                                                    } as WorkflowData;
                                                                  }
                                                                );
                                                              }
                                                            }}
                                                            translateTo={
                                                              localWorkflowData?.translate_to
                                                            }
                                                            translateFrom={
                                                              localWorkflowData?.translate_from
                                                            }
                                                          />
                                                        </div>
                                                      ) : (
                                                        <div className="w-full px-3 py-2 text-sm text-gray-600 rounded-lg min-h-[24px] whitespace-pre-wrap">
                                                          {localWorkflowData
                                                            ?.fields?.[
                                                            field.fieldKey || ""
                                                          ]
                                                            ?.translated_value || (
                                                            <span className="text-gray-400 italic">
                                                              No translated
                                                              value
                                                            </span>
                                                          )}
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}

                                              {/* Font Family */}
                                              <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                  Font Family
                                                </label>
                                                <select
                                                  value={field.fontFamily}
                                                  onChange={(e) =>
                                                    updateTextField(field.id, {
                                                      fontFamily:
                                                        e.target.value,
                                                    })
                                                  }
                                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                                >
                                                  <option value="Arial, sans-serif">
                                                    Arial
                                                  </option>
                                                  <option value="Helvetica, sans-serif">
                                                    Helvetica
                                                  </option>
                                                  <option value="Times New Roman, serif">
                                                    Times New Roman
                                                  </option>
                                                  <option value="Georgia, serif">
                                                    Georgia
                                                  </option>
                                                  <option value="Courier New, monospace">
                                                    Courier New
                                                  </option>
                                                  <option value="Verdana, sans-serif">
                                                    Verdana
                                                  </option>
                                                  <option value="Tahoma, sans-serif">
                                                    Tahoma
                                                  </option>
                                                  <option value="Trebuchet MS, sans-serif">
                                                    Trebuchet MS
                                                  </option>
                                                  <option value="Palatino, serif">
                                                    Palatino
                                                  </option>
                                                  <option value="Lucida Console, monospace">
                                                    Lucida Console
                                                  </option>
                                                </select>
                                              </div>

                                              {/* Font Color */}
                                              <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                  Font Color
                                                </label>
                                                <div className="flex items-center space-x-2">
                                                  <input
                                                    type="color"
                                                    value={field.fontColor}
                                                    onChange={(e) =>
                                                      updateTextField(
                                                        field.id,
                                                        {
                                                          fontColor:
                                                            e.target.value,
                                                        }
                                                      )
                                                    }
                                                    className="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer bg-white"
                                                  />
                                                  <input
                                                    type="text"
                                                    value={field.fontColor}
                                                    onChange={(e) =>
                                                      updateTextField(
                                                        field.id,
                                                        {
                                                          fontColor:
                                                            e.target.value,
                                                        }
                                                      )
                                                    }
                                                    className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                                    placeholder="#000000"
                                                  />
                                                </div>
                                              </div>

                                              {/* Bold and Italic */}
                                              <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-2">
                                                  Text Style
                                                </label>
                                                <div className="flex items-center space-x-2">
                                                  <button
                                                    onClick={() =>
                                                      updateTextField(
                                                        field.id,
                                                        {
                                                          fontWeight:
                                                            field.fontWeight ===
                                                            "bold"
                                                              ? "normal"
                                                              : "bold",
                                                        }
                                                      )
                                                    }
                                                    className={`w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center font-bold text-lg transition-all duration-200 ${
                                                      field.fontWeight ===
                                                      "bold"
                                                        ? "bg-red-500 text-white border-red-500"
                                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                                    }`}
                                                    title="Bold"
                                                  >
                                                    B
                                                  </button>
                                                  <button
                                                    onClick={() =>
                                                      updateTextField(
                                                        field.id,
                                                        {
                                                          fontStyle:
                                                            field.fontStyle ===
                                                            "italic"
                                                              ? "normal"
                                                              : "italic",
                                                        }
                                                      )
                                                    }
                                                    className={`w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center italic text-lg transition-all duration-200 ${
                                                      field.fontStyle ===
                                                      "italic"
                                                        ? "bg-red-500 text-white border-red-500"
                                                        : "bg-white text-gray-700 hover:bg-gray-50"
                                                    }`}
                                                    title="Italic"
                                                  >
                                                    I
                                                  </button>
                                                </div>
                                              </div>

                                              {/* Chracter Spacing */}
                                              <div className="mt-3">
                                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                                  Character Spacing
                                                </label>
                                                <div className="flex items-center">
                                                  <button
                                                    onClick={() => {
                                                      const current =
                                                        field.characterSpacing ||
                                                        0;
                                                      updateTextField(
                                                        field.id,
                                                        {
                                                          characterSpacing:
                                                            Math.max(
                                                              0,
                                                              current - 0.5
                                                            ),
                                                        }
                                                      );
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-l-lg hover:bg-gray-200 transition-colors"
                                                  >
                                                    <Minus size={14} />
                                                  </button>

                                                  <div className="w-16 h-8 flex items-center justify-center border-t border-b border-gray-300 bg-white">
                                                    {field.characterSpacing ||
                                                      0}
                                                    px
                                                  </div>

                                                  <button
                                                    onClick={() => {
                                                      const current =
                                                        field.characterSpacing ||
                                                        0;
                                                      updateTextField(
                                                        field.id,
                                                        {
                                                          characterSpacing:
                                                            Math.min(
                                                              20,
                                                              current + 0.5
                                                            ),
                                                        }
                                                      );
                                                    }}
                                                    className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-r-lg hover:bg-gray-200 transition-colors"
                                                  >
                                                    <Plus size={14} />
                                                  </button>
                                                </div>
                                              </div>

                                              {/* Rotation */}
                                              <div className="mt-4 p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                <label className=" text-sm font-semibold text-gray-800 mb-2 flex items-center gap-2">
                                                  <svg
                                                    width="16"
                                                    height="16"
                                                    viewBox="0 0 24 24"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    strokeWidth="2"
                                                    className="text-red-500"
                                                  >
                                                    <path d="M21 12c0 5-4 9-9 9s-9-4-9-9 4-9 9-9" />
                                                    <path d="M9 12l2 2 4-4" />
                                                  </svg>
                                                  Rotation
                                                </label>
                                                <div className="flex items-center space-x-3">
                                                  <input
                                                    type="range"
                                                    min="0"
                                                    max="360"
                                                    step="5"
                                                    value={field.rotation || 0}
                                                    onChange={(e) =>
                                                      updateTextField(
                                                        field.id,
                                                        {
                                                          rotation: parseInt(
                                                            e.target.value
                                                          ),
                                                        }
                                                      )
                                                    }
                                                    className="flex-1 rotation-slider"
                                                    style={{
                                                      background: `linear-gradient(to right, #fee2e2 0%, #fecaca ${
                                                        ((field.rotation || 0) /
                                                          360) *
                                                        100
                                                      }%, #f3f4f6 ${
                                                        ((field.rotation || 0) /
                                                          360) *
                                                        100
                                                      }%, #f3f4f6 100%)`,
                                                    }}
                                                  />
                                                  <span className="text-sm font-bold text-red-600 min-w-[40px] text-center bg-white px-2 py-1 rounded border border-red-200 shadow-sm">
                                                    {field.rotation || 0}°
                                                  </span>
                                                </div>
                                              </div>

                                              {/* Delete Field */}
                                              <div className="mt-4 pt-4 border-t border-gray-200">
                                                <button
                                                  onClick={() => {
                                                    setSettingsPopupFor(null);
                                                    if (field.isFromWorkflow) {
                                                      // Show confirmation for workflow fields
                                                      if (
                                                        confirm(
                                                          `Are you sure you want to delete the "${field.fieldKey}" field?\n\nThis will remove the field from both the form data and template mappings.`
                                                        )
                                                      ) {
                                                        deleteTextField(
                                                          field.id
                                                        );
                                                      }
                                                    } else {
                                                      // Direct delete for regular text fields
                                                      deleteTextField(field.id);
                                                    }
                                                  }}
                                                  className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all duration-200 font-medium"
                                                >
                                                  <Trash2 size={16} />
                                                  Delete Field
                                                </button>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </>
                                    )}

                                  {/* Text content - wrapped in rotating container */}
                                  <div
                                    className="w-full h-full absolute"
                                    style={{
                                      transform: field.rotation
                                        ? `rotate(${field.rotation}deg)`
                                        : "none",
                                      transformOrigin: "center center",
                                    }}
                                  >
                                    <textarea
                                      value={field.value}
                                      onChange={(e) =>
                                        updateTextField(field.id, {
                                          value: e.target.value,
                                        })
                                      }
                                      readOnly={!isEditMode}
                                      className="absolute top-0 left-0 w-full h-full resize-none border-none outline-none bg-transparent transition-all duration-200"
                                      style={{
                                        fontSize: `${field.fontSize * scale}px`,
                                        color: field.fontColor,
                                        fontFamily: field.fontFamily,
                                        fontWeight:
                                          field.fontWeight || "normal",
                                        fontStyle: field.fontStyle || "normal",
                                        cursor: "text",
                                        paddingBottom: "1px",
                                        lineHeight: "1.1",
                                        wordWrap: "break-word",
                                        wordBreak: "break-all",
                                        whiteSpace: "pre-wrap",
                                        boxSizing: "border-box",
                                        overflow: "hidden", // Keep hidden during editing to prevent scrollbars
                                        letterSpacing: field.characterSpacing
                                          ? `${field.characterSpacing}px`
                                          : "normal",
                                      }}
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedFieldId(field.id);
                                        setIsTextSelectionMode(false);
                                      }}
                                    />
                                  </div>
                                </div>
                              </Rnd>
                            );
                          })}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Edit3 size={64} className="mb-4 text-gray-300" />
                    <h2 className="text-xl font-semibold mb-2">
                      Document Editor
                    </h2>
                    <p className="text-center mb-6 max-w-md">
                      Upload a document to start adding and editing text fields.
                      You can drag, resize, and customize text overlays.
                    </p>
                  </div>
                )}
              </div>

              {/* Shape Dropdown - Rendered outside clipping containers */}
              {shapeDropdownOpen && (
                <div
                  className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999999999] min-w-[140px]"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                  }}
                >
                  <button
                    onClick={() => {
                      setSelectedShapeType("rectangle");
                      setShapeDropdownOpen(false);
                      setShapeDrawingMode("rectangle");
                      setIsAddTextBoxMode(false);
                      setIsTextSelectionMode(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm rounded-t-lg ${
                      selectedShapeType === "rectangle"
                        ? "bg-red-50 text-red-700"
                        : "text-gray-700"
                    }`}
                  >
                    <Square size={16} />
                    Rectangle
                  </button>
                  <button
                    onClick={() => {
                      setSelectedShapeType("circle");
                      setShapeDropdownOpen(false);
                      setShapeDrawingMode("circle");
                      setIsAddTextBoxMode(false);
                      setIsTextSelectionMode(false);
                    }}
                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-2 text-sm rounded-b-lg ${
                      selectedShapeType === "circle"
                        ? "bg-red-50 text-red-700"
                        : "text-gray-700"
                    }`}
                  >
                    <Circle size={16} />
                    Circle
                  </button>
                </div>
              )}

              {/* Field Status Dropdown - Rendered outside clipping containers */}
              {fieldStatusDropdownOpen && (
                <div
                  className="fixed bg-white border border-gray-200 rounded-lg shadow-lg z-[9999999999] min-w-[200px] max-w-[280px]"
                  style={{
                    top: `${dropdownPosition.top}px`,
                    left: `${dropdownPosition.left}px`,
                  }}
                >
                  <div className="p-4">
                    <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-500 to-green-500"></div>
                      Field Status Legend
                    </h3>
                    <div className="space-y-2">
                      {/* Get unique statuses from current fields */}
                      {Array.from(
                        new Set(
                          getTextFieldsFromWorkflowData()
                            .filter(
                              (field) => field.isFromWorkflow && field.status
                            )
                            .map((field) => field.status!)
                        )
                      ).map((status: string) => (
                        <div
                          key={status}
                          className="flex items-center gap-3 py-1"
                        >
                          <div
                            className="w-4 h-4 rounded-full border-2 border-white shadow-sm"
                            style={{
                              backgroundColor: getStatusColor(status),
                            }}
                          ></div>
                          <span className="text-sm text-gray-700 font-medium">
                            {getStatusLabel(status)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 pt-2 border-t border-gray-200">
                      <p className="text-xs text-gray-500">
                        {currentTab === "original" ? "Original" : "Translated"}{" "}
                        field statuses
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {/* Save Confirmation Dialog */}
          {showSaveConfirmation && (
            <div className="fixed inset-0 z-[999999999999] flex items-center justify-center bg-black bg-opacity-50">
              <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center">
                    <Save className="text-amber-600" size={20} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      Unsaved Changes
                    </h3>
                    <p className="text-sm text-gray-600">
                      You have unsaved changes in this document.
                    </p>
                  </div>
                </div>

                <p className="text-gray-700 mb-6">
                  Would you like to save your changes before closing?
                </p>

                <div className="flex gap-3 justify-end">
                  <button
                    onClick={cancelClose}
                    className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={confirmClose}
                    className="px-4 py-2 text-red-700 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                  >
                    Discard Changes
                  </button>
                  <button
                    onClick={saveAndClose}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Save & Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </AnimatePresence>
  );
};

export default DocumentCanvas;
