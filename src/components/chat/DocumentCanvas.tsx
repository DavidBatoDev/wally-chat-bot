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

// Add the useWorkflowData hook import
import { useWorkflowData } from "./DocumentCanvas/hooks/useWorkflowData";
import { WorkflowData, TemplateMapping } from "./DocumentCanvas/types/workflow";

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

  const lineHeight = fontSize * 1.2;
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

// Add polyfill for Promise.withResolvers if not available
// if (!Promise.withResolvers) {
//   Promise.withResolvers = function <T>() {
//     let resolve!: (value: T | PromiseLike<T>) => void;
//     let reject!: (reason?: any) => void;
//     const promise = new Promise<T>((res, rej) => {
//       resolve = res;
//       reject = rej;
//     });
//     return { promise, resolve, reject };
//   };
// }

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
  borderColor: string;
  borderWidth: number;
  fillColor: string;
  fillOpacity: number;
  rotation?: number;
}

// Add tab type
type TabType = "document" | "original" | "translated";

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({
  isOpen,
  onClose,
  conversationId,
}) => {
  // Add workflow data state
  const {
    workflowData,
    loading: workflowLoading,
    error: workflowError,
    fetchWorkflowData,
  } = useWorkflowData(conversationId || "");

  // Add tab state
  const [currentTab, setCurrentTab] = useState<TabType>("document");

  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [textFields, setTextFields] = useState<TextField[]>([]);
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

  // Add new shape-related state
  const [shapes, setShapes] = useState<Shape[]>([]);
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
  const [rectangles, setRectangles] = useState<Rectangles[]>([]);
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
    }

    .shape-drag-handle:hover {
      cursor: move;
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

  `;

  // Initialize with workflow data when available
  useEffect(() => {
    if (conversationId) {
      fetchWorkflowData();
    }
  }, [conversationId, fetchWorkflowData]);

  // Set document URL based on current tab and workflow data
  useEffect(() => {
    if (workflowData) {
      let url = "";
      switch (currentTab) {
        case "document":
          url = workflowData.base_file_public_url || "";
          break;
        case "original":
          url = workflowData.template_file_public_url || "";
          break;
        case "translated":
          url = workflowData.template_translated_file_public_url || "";
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
  }, [currentTab, workflowData]);

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
    };

    document.addEventListener("click", handleClickOutside);
    return () => {
      document.removeEventListener("click", handleClickOutside);
    };
  }, [settingsPopupFor, shapeDropdownOpen]);

  // Load workflow fields when page dimensions are available
  useEffect(() => {
    if (pageWidth && pageHeight) {
      loadWorkflowFields();
    }
  }, [pageWidth, pageHeight]);

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

  // Handle keyboard shortcuts for formatting
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      // Only handle shortcuts when a field is selected and not in text selection mode
      if (!selectedFieldId || isTextSelectionMode) return;

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
  }, [selectedFieldId, textFields, isTextSelectionMode]);

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

  // Update loadWorkflowFields to use the appropriate mappings and values based on tab
  const loadWorkflowFields = useCallback(() => {
    if (!workflowData || !pageWidth || !pageHeight) return;

    const fields: TextField[] = [];
    let mappings: Record<string, TemplateMapping> = {};

    // Determine which mappings to use based on current tab
    switch (currentTab) {
      case "original":
        mappings = workflowData.origin_template_mappings || {};
        break;
      case "translated":
        mappings = workflowData.translated_template_mappings || {};
        break;
      default:
        // For document tab, don't show any fields
        setTextFields([]);
        return;
    }

    Object.entries(mappings).forEach(([key, mapping]) => {
      const fieldData = workflowData.fields?.[key];
      if (fieldData && mapping) {
        // Determine which value to use based on current tab
        let fieldValue = "";
        switch (currentTab) {
          case "original":
            fieldValue = fieldData.value || "";
            break;
          case "translated":
            fieldValue = fieldData.translated_value || "";
            break;
        }

        // Calculate dimensions based on the value and font from mapping
        const { width, height } = calculateFieldDimensions(
          fieldValue,
          mapping.font.size,
          mapping.font.name || "Arial, sans-serif"
        );

        const field: TextField = {
          id: `workflow-${key}`,
          x: mapping.position.x0,
          y: mapping.position.y0,
          width, // Use calculated width instead of mapping width
          height, // Use calculated height instead of mapping height
          value: fieldValue,
          fontSize: mapping.font.size,
          fontColor: "#000000", // Always default to black, ignore mapping color
          fontFamily: mapping.font.name || "Arial, sans-serif",
          page: mapping.page_number,
          fieldKey: key,
          isFromWorkflow: true,
          characterSpacing: 0, // Default character spacing since TemplateMapping doesn't have this
          fontWeight: "normal",
          fontStyle: "normal",
          rotation: 0, // Default rotation since TemplateMapping doesn't have this
        };

        fields.push(field);
      }
    });

    setTextFields(fields);
  }, [workflowData, pageHeight, pageWidth, currentTab]);

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

    return {
      width: Math.max(width + padding, 5), // Minimum width 30px
      height: Math.max(height + padding, 1), // Minimum height 12px
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
  };

  const handleDocumentLoadError = (error: Error) => {
    setError(`Failed to load document: ${error.message}`);
    console.error("Document loading error:", error);
  };

  const handlePageLoadSuccess = (page: any) => {
    const { width, height } = page.getViewport({ scale: 1 });
    setPageWidth(width);
    setPageHeight(height);
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
    const value = "New Text Field";
    const fontSize = 14;
    const fontFamily = "Arial, sans-serif";

    const { width, height } = calculateFieldDimensions(
      value,
      fontSize,
      fontFamily
    );

    const newField: TextField = {
      id: `field-${Date.now()}`,
      x: x, // Use provided x coordinate
      y: y, // Use provided y coordinate
      width,
      height,
      value,
      fontSize,
      fontColor: "#000000",
      fontFamily,
      page: currentPage,
      isFromWorkflow: false,
      characterSpacing: 0, // Default character spacing
      fontWeight: "normal",
      fontStyle: "normal",
      rotation: 0, // Default no rotation
    };

    setTextFields([...textFields, newField]);
    setSelectedFieldId(newField.id);
    setIsAddTextBoxMode(false);
    setIsTextSelectionMode(false);
    setTextSelectionPopup(null);
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
      pagePosition: sel.pagePosition,
      pageSize: sel.pageSize,
      background: bgColor, // Store the captured color permanently
    };

    setRectangles((prev) => [...prev, newDeletion]);
  };

  const deleteDeletionRectangle = (id: string) => {
    setRectangles(rectangles.filter((rec) => rec.id !== id));
  };

  const deleteTextField = (fieldId: string) => {
    setTextFields(textFields.filter((field) => field.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
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

  const updateTextField = (fieldId: string, updates: Partial<TextField>) => {
    setTextFields(
      textFields.map((field) => {
        if (field.id !== fieldId) return field;

        const newField = { ...field, ...updates };

        // Recalculate dimensions when text/font/spacing changes
        if (
          updates.value !== undefined ||
          updates.fontSize !== undefined ||
          updates.fontFamily !== undefined ||
          updates.characterSpacing !== undefined
        ) {
          // Add this condition

          const { width, height } = calculateFieldDimensions(
            updates.value ?? field.value,
            updates.fontSize ?? field.fontSize,
            updates.fontFamily ?? field.fontFamily,
            updates.characterSpacing ?? field.characterSpacing ?? 0 // Pass character spacing
          );

          newField.width = width;
          newField.height = height;
        }

        return newField;
      })
    );
  };

  const exportToPDF = async () => {
    if (!documentUrl || !documentRef.current) return;

    // Save current state before starting
    const originalScale = scale;
    const tempSelectedField = selectedFieldId;
    const tempSelectedShape = selectedShapeId;
    const tempSettingsPopup = settingsPopupFor;
    const tempEditMode = isEditMode;
    const tempTextSelectionMode = isTextSelectionMode;
    const originalTextFields = [...textFields];
    const originalShapes = [...shapes];

    setIsLoading(true);

    try {
      // Turn off all editing controls and modes for clean export
      setSelectedFieldId(null);
      setSelectedShapeId(null);
      setSettingsPopupFor(null);
      setIsEditMode(false);
      setIsTextSelectionMode(false);
      setShapeDrawingMode(null);

      // Temporarily adjust text field positions upward for better export alignment
      const adjustedTextFields = textFields.map((field) => ({
        ...field,
        x: field.x - 2, // Raise each text field by 3 pixels
        y: field.y - 3, // Raise each text field by 3 pixels
      }));
      setTextFields(adjustedTextFields);

      // Set zoom to 300% for maximum quality
      setScale(3.0);
      setZoomMode("page");

      // Wait for zoom and controls to update
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Find the PDF page element
      const pdfPageElement =
        documentRef.current.querySelector(".react-pdf__Page");
      if (!pdfPageElement) {
        throw new Error("PDF page not found");
      }

      // Use html2canvas to capture the rendered PDF with all styling
      const html2canvas = (await import("html2canvas")).default;

      // Capture the entire document container which includes text fields
      const canvas = await html2canvas(documentRef.current, {
        scale: 2, // Higher resolution
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        onclone: (clonedDoc) => {
          // Remove editing controls but keep text content
          const clonedContainer =
            clonedDoc.querySelector('[data-testid="document-container"]') ||
            clonedDoc.querySelector('div[style*="relative"]');

          if (clonedContainer) {
            // Remove control buttons and handles, but keep text fields and shapes
            clonedContainer
              .querySelectorAll("button")
              .forEach((btn) => btn.remove());
            clonedContainer
              .querySelectorAll(".drag-handle, .shape-drag-handle")
              .forEach((handle) => handle.remove());

            // Remove all borders and backgrounds from text field and shape containers
            clonedContainer.querySelectorAll(".rnd").forEach((rnd) => {
              if (rnd instanceof HTMLElement) {
                // For text fields, remove the container styling
                if (rnd.querySelector("textarea")) {
                  rnd.style.border = "none";
                  rnd.style.backgroundColor = "transparent";
                  rnd.style.boxShadow = "none";
                }
                // For shapes, keep the shape styling but remove container borders
                else if (rnd.querySelector(".shape-drag-handle")) {
                  rnd.style.border = "none";
                  rnd.style.boxShadow = "none";
                }
              }
            });

            // Clean up text areas for better appearance
            clonedContainer.querySelectorAll("textarea").forEach((textarea) => {
              if (textarea instanceof HTMLElement) {
                textarea.style.padding = "0px";
                textarea.style.margin = "0px";
              }
            });
          }
        },
      });

      // Create a new PDF with the captured image
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([canvas.width / 2, canvas.height / 2]); // Divide by 2 due to scale factor

      // Convert canvas to PNG bytes
      const canvasDataUrl = canvas.toDataURL("image/png");
      const pngImageBytes = await fetch(canvasDataUrl).then((res) =>
        res.arrayBuffer()
      );
      const pngImage = await pdfDoc.embedPng(pngImageBytes);

      // Draw the image on the PDF page
      page.drawImage(pngImage, {
        x: 0,
        y: 0,
        width: canvas.width / 2,
        height: canvas.height / 2,
      });

      // Save and download the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "edited-document.pdf";
      link.click();

      URL.revokeObjectURL(url);

      // Restore the original state
      setTextFields(originalTextFields);
      setShapes(originalShapes);
      setScale(originalScale);
      setSelectedFieldId(tempSelectedField);
      setSelectedShapeId(tempSelectedShape);
      setSettingsPopupFor(tempSettingsPopup);
      setIsEditMode(tempEditMode);
      setIsTextSelectionMode(tempTextSelectionMode);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setError("Failed to export PDF");

      // Restore original state even on error
      setTextFields(originalTextFields);
      setShapes(originalShapes);
      setScale(originalScale);
      setSelectedFieldId(tempSelectedField);
      setSelectedShapeId(tempSelectedShape);
      setSettingsPopupFor(tempSettingsPopup);
      setIsEditMode(tempEditMode);
      setIsTextSelectionMode(tempTextSelectionMode);
    } finally {
      setIsLoading(false);
    }
  };

  const exportFieldsData = () => {
    const exportData = {
      documentUrl,
      fields: textFields,
      shapes: shapes,
      scale,
      pageWidth,
      pageHeight,
      numPages,
      workflowId: workflowData?.template_id || "unknown",
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
        borderColor: "#000000",
        borderWidth: 2,
        fillColor: "#ffffff",
        fillOpacity: 0.3,
        rotation: 0,
      };

      setShapes((prev) => [...prev, newShape]);
      setSelectedShapeId(newShape.id);
    }

    setIsDrawingInProgress(false);
    setShapeDrawStart(null);
    setShapeDrawEnd(null);
    setShapeDrawingMode(null);
  };

  // Add shape update function
  const updateShape = (shapeId: string, updates: Partial<Shape>) => {
    setShapes((prev) =>
      prev.map((shape) =>
        shape.id === shapeId ? { ...shape, ...updates } : shape
      )
    );
  };

  // Add shape deletion function
  const deleteShape = (shapeId: string) => {
    setShapes((prev) => prev.filter((shape) => shape.id !== shapeId));
    if (selectedShapeId === shapeId) {
      setSelectedShapeId(null);
    }
  };

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
    // Immediately reset file detection to prevent race conditions
    setIsFileTypeDetected(false);
    setDocumentUrl("");
    setFileType(null);
    setError("");

    setCurrentTab(tab);
    setSelectedFieldId(null);
    setSelectedShapeId(null);
    setSettingsPopupFor(null);
    setTextSelectionPopup(null);
  };

  // Determine if controls should be shown based on current tab
  const showControls = currentTab !== "document";

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
                              onClick={onClose}
                              className="p-2 hover:bg-red-100 text-gray-600 hover:text-red-600 rounded-lg transition-all duration-200 flex items-center justify-center group"
                            >
                              <X
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                            <p>Close Document Editor</p>
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
                                      onClick={() => {
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
                                        <button
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
                                          }}
                                          className="hover:bg-black hover:bg-opacity-10 rounded p-1 transition-colors"
                                          disabled={!isEditMode}
                                        >
                                          <ChevronDown
                                            size={14}
                                            className={`transition-transform ${
                                              shapeDropdownOpen
                                                ? "rotate-180"
                                                : ""
                                            }`}
                                          />
                                        </button>
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
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Right side - Export actions - Only show for template tabs */}
                    {showControls && (
                      <div className="flex items-center gap-2">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={exportFieldsData}
                              className="px-3 py-2.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 hover:border-red-300 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center group"
                              disabled={!documentUrl}
                            >
                              <Save
                                size={18}
                                className="group-hover:scale-110 transition-transform"
                              />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent className="bg-white border border-gray-200 text-red-600 rounded-lg shadow-lg">
                            <p>Export Field Data</p>
                          </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              onClick={exportToPDF}
                              className="px-3 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white rounded-xl shadow-md hover:shadow-lg shadow-red-200 transition-all duration-200 flex items-center justify-center group"
                              disabled={isLoading || !documentUrl}
                            >
                              {isLoading ? (
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
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
                              {isLoading ? "Exporting PDF..." : "Export to PDF"}
                            </p>
                          </TooltipContent>
                        </Tooltip>
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
              <div className="text-center">
                <div className="w-8 h-8 border-2 border-red-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Loading workflow data...</p>
              </div>
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
          {!workflowLoading && !workflowError && !workflowData && (
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
          {!workflowLoading && !workflowError && workflowData && (
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
                  <div className="fixed bottom-6 right-6 z-50 flex flex-col items-center bg-white rounded-lg shadow-xl border border-gray-200">
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
                              <div className="p-8 text-center">
                                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                                Loading PDF document...
                              </div>
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

                        {rectangles
                          .filter((rec) => rec.page === currentPage)
                          .map((rec) => (
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

                        {/* Shape Preview during drawing */}
                        {shapePreview && shapeDrawingMode && (
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

                        {/* Shape Overlays */}
                        {shapes
                          .filter((shape) => shape.page === currentPage)
                          .map((shape) => (
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
                                updateShape(shape.id, {
                                  x: d.x / scale,
                                  y: d.y / scale,
                                });
                              }}
                              onDragStop={(e, d) => {
                                updateShape(shape.id, {
                                  x: d.x / scale,
                                  y: d.y / scale,
                                });
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

                        {/* Text Field Overlays */}
                        {textFields
                          .filter((field) => field.page === currentPage)
                          .filter(
                            (field) =>
                              !field.isFromWorkflow || showWorkflowFields
                          )
                          .map((field) => (
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
                                updateTextField(field.id, {
                                  x: d.x / scale,
                                  y: d.y / scale,
                                });
                              }}
                              onDragStop={(e, d) => {
                                updateTextField(field.id, {
                                  x: d.x / scale,
                                  y: d.y / scale,
                                });
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
                              onClick={(e: { stopPropagation: () => void }) => {
                                e.stopPropagation();
                                setSelectedFieldId(field.id);
                                setIsTextSelectionMode(false);
                              }}
                              dragHandleClassName="drag-handle"
                              dragAxis="both"
                              dragGrid={[1, 1]}
                              resizeGrid={[1, 1]}
                              className={`${
                                isEditMode
                                  ? "border-2 border-blue-500"
                                  : "border-2 border-transparent"
                              } ${
                                field.isFromWorkflow
                                  ? " hover:border-purple-400"
                                  : "border-gray-300 hover:border-blue-400"
                              } ${selectedFieldId === field.id ? "" : ""} ${
                                isRotating && rotatingFieldId === field.id
                                  ? "border-yellow-500 border-2"
                                  : ""
                              } transition-all duration-200 ease-in-out`}
                              style={{
                                backgroundColor: "rgba(255, 255, 255, 0.1)",
                                transition: "transform 0.1s ease-out",
                                zIndex:
                                  selectedFieldId === field.id ? 1000 : 100,
                                transform: "none", // Ensure no additional scaling
                                cursor:
                                  isRotating && rotatingFieldId === field.id
                                    ? "grabbing"
                                    : "auto",
                              }}
                            >
                              <div className="w-full h-full relative group">
                                {/* Move handle */}
                                {isEditMode && selectedFieldId === field.id && (
                                  <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
                                    {/* Move handle */}
                                    <div className="drag-handle bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                                      <Move size={10} />
                                    </div>

                                    {/* Font size controls */}
                                    <div className="flex items-center bg-white rounded-md shadow-lg overflow-hidden">
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateTextField(field.id, {
                                            // Adjust font size in original scale
                                            fontSize: Math.max(
                                              6,
                                              field.fontSize - 1
                                            ),
                                          });
                                        }}
                                        className="text-black p-1 hover:bg-gray-100 transition-all duration-200"
                                        title="Decrease font size"
                                      >
                                        <Minus size={10} />
                                      </button>
                                      <span className="text-black text-xs font-medium px-2 min-w-[20px] text-center">
                                        {/* Display original font size, not scaled */}
                                        {field.fontSize.toFixed(2)}
                                      </span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateTextField(field.id, {
                                            // Adjust font size in original scale
                                            fontSize: Math.min(
                                              72,
                                              field.fontSize + 1
                                            ),
                                          });
                                        }}
                                        className="text-black p-1 hover:bg-gray-100 transition-all duration-200"
                                        title="Increase font size"
                                      >
                                        <Plus size={10} />
                                      </button>
                                    </div>
                                  </div>
                                )}

                                {/* Delete button */}
                                {isEditMode &&
                                  selectedFieldId === field.id &&
                                  !field.isFromWorkflow && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        deleteTextField(field.id);
                                      }}
                                      className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  )}

                                {/* Rotation handle - positioned at bottom-right corner */}
                                {isEditMode && selectedFieldId === field.id && (
                                  <div
                                    className="absolute bottom-0 right-0 transform translate-x-1/2 translate-y-1/2 w-6 h-6 bg-blue-500 hover:bg-blue-600 border-2 border-white rounded-full flex items-center justify-center cursor-grab shadow-lg z-20"
                                    style={{
                                      cursor:
                                        isRotating &&
                                        rotatingFieldId === field.id
                                          ? "grabbing"
                                          : "grab",
                                    }}
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      setIsRotating(true);
                                      setRotatingFieldId(field.id);
                                      setInitialRotation(field.rotation || 0);

                                      // Calculate field center for rotation
                                      const fieldRect =
                                        e.currentTarget.parentElement?.getBoundingClientRect();
                                      if (fieldRect) {
                                        const centerX =
                                          fieldRect.left + fieldRect.width / 2;
                                        const centerY =
                                          fieldRect.top + fieldRect.height / 2;
                                        setRotationCenter({
                                          x: centerX,
                                          y: centerY,
                                        });
                                      }
                                    }}
                                    title="Hold and drag to rotate"
                                  >
                                    <svg
                                      width="12"
                                      height="12"
                                      viewBox="0 0 24 24"
                                      fill="none"
                                      stroke="currentColor"
                                      strokeWidth="2"
                                      className="text-white"
                                    >
                                      <path d="M12 2v20M2 12h20" />
                                      <path d="m19 9-3 3 3 3" />
                                      <path d="m5 15 3-3-3-3" />
                                    </svg>
                                  </div>
                                )}

                                {/* Rotation degree indicator - shows during rotation */}
                                {isRotating && rotatingFieldId === field.id && (
                                  <div
                                    className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black bg-opacity-80 text-white px-3 py-1 rounded-lg text-sm font-semibold shadow-lg z-30 pointer-events-none"
                                    style={{
                                      backdropFilter: "blur(4px)",
                                    }}
                                  >
                                    {field.rotation || 0}°
                                  </div>
                                )}

                                {/* Field properties */}
                                {isEditMode && selectedFieldId === field.id && (
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
                                          <div className="grid grid-cols-2 gap-3">
                                            {/* Position X */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                X Position
                                              </label>
                                              <input
                                                type="number"
                                                value={Math.round(field.x)}
                                                onChange={(e) =>
                                                  updateTextField(field.id, {
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

                                            {/* Position Y */}
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Y Position
                                              </label>
                                              <input
                                                type="number"
                                                value={Math.round(field.y)}
                                                onChange={(e) =>
                                                  updateTextField(field.id, {
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

                                          {/* Font Family */}
                                          <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Font Family
                                            </label>
                                            <select
                                              value={field.fontFamily}
                                              onChange={(e) =>
                                                updateTextField(field.id, {
                                                  fontFamily: e.target.value,
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
                                                  updateTextField(field.id, {
                                                    fontColor: e.target.value,
                                                  })
                                                }
                                                className="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer bg-white"
                                              />
                                              <input
                                                type="text"
                                                value={field.fontColor}
                                                onChange={(e) =>
                                                  updateTextField(field.id, {
                                                    fontColor: e.target.value,
                                                  })
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
                                                  updateTextField(field.id, {
                                                    fontWeight:
                                                      field.fontWeight ===
                                                      "bold"
                                                        ? "normal"
                                                        : "bold",
                                                  })
                                                }
                                                className={`w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center font-bold text-lg transition-all duration-200 ${
                                                  field.fontWeight === "bold"
                                                    ? "bg-red-500 text-white border-red-500"
                                                    : "bg-white text-gray-700 hover:bg-gray-50"
                                                }`}
                                                title="Bold"
                                              >
                                                B
                                              </button>
                                              <button
                                                onClick={() =>
                                                  updateTextField(field.id, {
                                                    fontStyle:
                                                      field.fontStyle ===
                                                      "italic"
                                                        ? "normal"
                                                        : "italic",
                                                  })
                                                }
                                                className={`w-10 h-10 border border-gray-300 rounded-lg flex items-center justify-center italic text-lg transition-all duration-200 ${
                                                  field.fontStyle === "italic"
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
                                                    field.characterSpacing || 0;
                                                  updateTextField(field.id, {
                                                    characterSpacing: Math.max(
                                                      0,
                                                      current - 0.5
                                                    ),
                                                  });
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-l-lg hover:bg-gray-200 transition-colors"
                                              >
                                                <Minus size={14} />
                                              </button>

                                              <div className="w-16 h-8 flex items-center justify-center border-t border-b border-gray-300 bg-white">
                                                {field.characterSpacing || 0}px
                                              </div>

                                              <button
                                                onClick={() => {
                                                  const current =
                                                    field.characterSpacing || 0;
                                                  updateTextField(field.id, {
                                                    characterSpacing: Math.min(
                                                      20,
                                                      current + 0.5
                                                    ),
                                                  });
                                                }}
                                                className="w-8 h-8 flex items-center justify-center bg-gray-100 border border-gray-300 rounded-r-lg hover:bg-gray-200 transition-colors"
                                              >
                                                <Plus size={14} />
                                              </button>
                                            </div>
                                          </div>

                                          {/* Rotation */}
                                          <div className="mt-3">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                              Rotation
                                            </label>
                                            <div className="flex items-center space-x-2">
                                              <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                step="5"
                                                value={field.rotation || 0}
                                                onChange={(e) =>
                                                  updateTextField(field.id, {
                                                    rotation: parseInt(
                                                      e.target.value
                                                    ),
                                                  })
                                                }
                                                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-thumb:bg-red-500"
                                              />
                                              <span className="text-xs font-medium text-gray-700 min-w-[30px] text-center">
                                                {field.rotation || 0}°
                                              </span>
                                            </div>
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
                                    className="absolute w-full h-full resize-none border-none outline-none bg-transparent transition-all duration-200"
                                    style={{
                                      fontSize: `${field.fontSize * scale}px`,
                                      color: field.fontColor,
                                      fontFamily: field.fontFamily,
                                      fontWeight: field.fontWeight || "normal",
                                      fontStyle: field.fontStyle || "normal",
                                      cursor: "text",
                                      padding: "1px",
                                      lineHeight: "1.1",
                                      wordWrap: "break-word",
                                      wordBreak: "break-all",
                                      whiteSpace: "pre-wrap",
                                      boxSizing: "border-box",
                                      overflow: "hidden",
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
                          ))}
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
            </>
          )}
        </div>
      </TooltipProvider>
    </AnimatePresence>
  );
};

export default DocumentCanvas;
