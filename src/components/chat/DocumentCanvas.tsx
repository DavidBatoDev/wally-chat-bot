// client/src/components/chat/DocumentCanvas.tsx
import React, { useState, useEffect, useRef, useCallback } from "react";
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
  Minus,
  Layout,
  MousePointer2,
  Maximize2,
  MoreHorizontal,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Add polyfill for Promise.withResolvers if not available
if (!Promise.withResolvers) {
  Promise.withResolvers = function <T>() {
    let resolve!: (value: T | PromiseLike<T>) => void;
    let reject!: (reason?: any) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

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
}

interface WorkflowField {
  value: string;
  value_status: string;
  translated_value: string | null;
  translated_status: string;
}

interface WorkflowMapping {
  font: {
    name: string;
    size: number;
    color: string;
    flags: number;
    style: string;
  };
  position: {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
    width: number;
    height: number;
  };
  rotation: number;
  alignment: string;
  bbox_center: { x: number; y: number };
  page_number: number;
}

interface WorkflowData {
  id: string;
  template_id: string;
  conversation_id: string;
  base_file_public_url: string;
  template_file_public_url: string;
  template_required_fields: Record<
    string,
    {
      label: string;
      description: string;
    }
  >;
  fields: Record<string, WorkflowField>;
  origin_template_mappings: Record<string, WorkflowMapping>;
  translated_template_mappings: Record<string, WorkflowMapping>;
  translate_to: string;
  created_at: string;
}

const DocumentCanvas: React.FC<DocumentCanvasProps> = ({ isOpen, onClose, conversationId }) => {
  const [documentUrl, setDocumentUrl] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [numPages, setNumPages] = useState<number>(0);
  const [scale, setScale] = useState<number>(1.0);
  const [textFields, setTextFields] = useState<TextField[]>([]);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState<boolean>(true);
  const [showWorkflowFields, setShowWorkflowFields] = useState<boolean>(true);
  const [showTextboxBorders, setShowTextboxBorders] = useState<boolean>(true);
  const [isTextSelectionMode, setIsTextSelectionMode] = useState<boolean>(false);
  const [pageWidth, setPageWidth] = useState<number>(612);
  const [pageHeight, setPageHeight] = useState<number>(792);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [textSelectionPopup, setTextSelectionPopup] = useState<{
    text: string;
    position: { top: number; left: number };
    pagePosition: { x: number; y: number };
  } | null>(null);
  const [zoomMode, setZoomMode] = useState<'page' | 'width'>('page');
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [settingsPopupFor, setSettingsPopupFor] = useState<string | null>(null)
  
  const documentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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
  `;

  // Hardcoded workflow data for demo
  const workflowData: WorkflowData = {
    id: "5eb24566-ddd6-48ae-ab32-80574e0875a3",
    template_id: "9fc0c5fc-2885-4d58-ba0f-4711244eb7df",
    conversation_id: "e6cdbca2-c538-4f5f-8e7f-278840645bb3",
    base_file_public_url:
      "https://ylvmwrvyiamecvnydwvj.supabase.co/storage/v1/object/public/templates/templates/PSA%20Birth%20Cert%201993%20ENG%20blank%20w%202nd%20page.pdf",
    template_file_public_url:
      "https://ylvmwrvyiamecvnydwvj.supabase.co/storage/v1/object/public/templates/templates/PSA%20Birth%20Cert%201993%20ENG%20blank%20w%202nd%20page.pdf",
    template_required_fields: {
      "{fe}": {
        label: "Sex: Female",
        description: "Checkbox to mark with 'X' if the child is female.",
      },
      "{last_name}": {
        label: "Child's Last Name",
        description: "Text input field for the child's last name.",
      },
    },
    fields: {
      "{fe}": {
        value: "X",
        value_status: "ocr",
        translated_value: null,
        translated_status: "pending",
      },
      "{last_name}": {
        value: "DIONISIO GARCIA",
        value_status: "ocr",
        translated_value: null,
        translated_status: "pending",
      },
    },
    origin_template_mappings: {
      "{fe}": {
        "font": {
          "name": "ArialMT",
          "size": 6,
          "color": "#ee0000",
          "flags": 0,
          "style": "normal"
        },
        "position": {
          "x0": 91.34400177001953,
          "x1": 99.87519683837891,
          "y0": 164.989990234375,
          "y1": 171.6799774169922,
          "width": 8.53119506835938,
          "height": 6.6899871826171875
        },
        "rotation": 0,
        "alignment": "left",
        "bbox_center": {
          "x": 95.60959930419922,
          "y": 168.3349838256836
        },
        "page_number": 1
      },
    "{last_name}": {
      "font": {
        "name": "ArialMT",
        "size": 8.039999961853027,
        "color": "#ee0000",
        "flags": 0,
        "style": "normal"
      },
      "position": {
        "x0": 294.8900146484375,
        "x1": 335.6771774291992,
        "y0": 144.90379333496094,
        "y1": 153.86839294433594,
        "width": 40.78716278076172,
        "height": 8.964599609375
      },
      "rotation": 0,
      "alignment": "left",
      "bbox_center": {
        "x": 315.28359603881836,
        "y": 149.38609313964844
      },
      "page_number": 1
    },
    },
    translated_template_mappings: {},
    translate_to: "Greek",
    created_at: "2025-06-19T07:44:46.900296Z",
  };

  // Initialize with demo PDF on mount
  useEffect(() => {
    // Load the demo PDF immediately
    setDocumentUrl(workflowData.base_file_public_url);
    
    // Set initial zoom to fit width
    setZoomMode('width');
  }, []);

    useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsPopupFor && !(e.target as Element).closest('.settings-popup')) {
        setSettingsPopupFor(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [settingsPopupFor]);

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

    window.addEventListener('resize', handleResize);
    handleResize(); // Initial measurement
    
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Adjust scale when in width mode
  useEffect(() => {
    if (zoomMode === 'width' && containerWidth > 0 && pageWidth > 0) {
      const calculatedScale = containerWidth / pageWidth;
      setScale(Math.min(calculatedScale, 3.0)); // Max zoom 300%
    }
  }, [containerWidth, pageWidth, zoomMode]);

  const loadWorkflowFields = useCallback(() => {
    const fields: TextField[] = [];

    Object.entries(workflowData.origin_template_mappings).forEach(
      ([key, mapping]) => {
        const fieldData = workflowData.fields[key];
        if (fieldData && mapping) {          
          // If your mappings are already in web coordinates (top-left origin)
          const field: TextField = {
            id: `workflow-${key}`,
            x: mapping.position.x0,
            y: mapping.position.y0, // Use directly without flipping
            width: Math.max(mapping.position.width, 30), // Reduced minimum width
            height: Math.max(mapping.position.height, 12), // Reduced minimum height
            value: fieldData.value || "",
            fontSize: Math.max(mapping.font.size, 6), // Allow smaller font sizes
            fontColor: mapping.font.color || "#000000",
            fontFamily: "Arial, sans-serif",
            page: mapping.page_number,
            fieldKey: key,
            isFromWorkflow: true,
          };
          
          fields.push(field);
        }
      }
    );

    setTextFields(fields);
  }, [pageHeight]);

  const handleDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setError("");
  };

  const handleDocumentLoadError = (error: Error) => {
    setError(`Failed to load PDF: ${error.message}`);
    console.error("PDF loading error:", error);
  };

  const handlePageLoadSuccess = (page: any) => {
    const { width, height } = page.getViewport({ scale: 1 });
    setPageWidth(width);
    setPageHeight(height);
  };

  // Handle text selection mode
  const handleTextSelection = useCallback(() => {
    setIsTextSelectionMode(true);
    setIsEditMode(true);
    setSelectedFieldId(null);
    setTextSelectionPopup(null); // Close any existing popups
  }, []);

  // Handle text span click during selection mode
  const handleTextSpanClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      if (!isTextSelectionMode) return;
      
      const span = e.currentTarget;
      const textContent = span.textContent || '';
      
      if (!textContent.trim()) return;
      
      // Get the PDF page container
      const pdfPage = documentRef.current?.querySelector('.react-pdf__Page');
      if (!pdfPage) return;
      
      const pageRect = pdfPage.getBoundingClientRect();
      const spanRect = span.getBoundingClientRect();
      
      // Calculate position relative to the PDF page (not scaled container)
      const x = spanRect.left - pageRect.left;
      const y = spanRect.top - pageRect.top;
      
      // Calculate page coordinates
      const pageX = x;
      const pageY = y;
      
      // Show popup above the selected text
      const popupTop = spanRect.top - 40;
      const popupLeft = spanRect.left + (spanRect.width / 2);
      
      setTextSelectionPopup({
        text: textContent,
        position: { top: popupTop, left: popupLeft },
        pagePosition: { x: pageX, y: pageY }
      });
    },
    [isTextSelectionMode]
  );

  // Attach click handlers to text spans
  useEffect(() => {
    if (!isTextSelectionMode || !documentUrl) return;

    const textSpans = document.querySelectorAll(
      '.react-pdf__Page__textContent span'
    );

    textSpans.forEach(span => {
      span.addEventListener('click', handleTextSpanClick as any);
    });

    return () => {
      textSpans.forEach(span => {
        span.removeEventListener('click', handleTextSpanClick as any);
      });
    };
  }, [isTextSelectionMode, documentUrl, currentPage, handleTextSpanClick]);

  // Close popup when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (textSelectionPopup && !(e.target as Element).closest('.text-selection-popup')) {
        setTextSelectionPopup(null);
      }
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [textSelectionPopup]);

  const addTextField = () => {
    const newField: TextField = {
      id: `field-${Date.now()}`,
      x: 50,
      y: 50,
      width: 150,
      height: 30,
      value: "New Text Field",
      fontSize: 14,
      fontColor: "#000000",
      fontFamily: "Arial, sans-serif",
      page: currentPage,
      isFromWorkflow: false,
    };
    setTextFields([...textFields, newField]);
    setSelectedFieldId(newField.id);
    setIsTextSelectionMode(false);
    setTextSelectionPopup(null); // Close any popup
  };

  const deleteTextField = (fieldId: string) => {
    setTextFields(textFields.filter((field) => field.id !== fieldId));
    if (selectedFieldId === fieldId) {
      setSelectedFieldId(null);
    }
  };

  const updateTextField = (fieldId: string, updates: Partial<TextField>) => {
    setTextFields(
      textFields.map((field) =>
        field.id === fieldId ? { ...field, ...updates } : field
      )
    );
  };

  const exportToPDF = async () => {
    if (!documentUrl) return;

    setIsLoading(true);
    try {
      // Fetch the original PDF
      const existingPdfBytes = await fetch(documentUrl).then((res) =>
        res.arrayBuffer()
      );
      const pdfDoc = await PDFDocument.load(existingPdfBytes);
      const pages = pdfDoc.getPages();

      // Add text fields to PDF
      for (const field of textFields) {
        if (field.page <= pages.length && field.value.trim()) {
          const page = pages[field.page - 1];
          const { height } = page.getSize();

          // Convert color from hex to RGB
          const hexColor = field.fontColor.replace("#", "");
          const r = parseInt(hexColor.substr(0, 2), 16) / 255;
          const g = parseInt(hexColor.substr(2, 2), 16) / 255;
          const b = parseInt(hexColor.substr(4, 2), 16) / 255;

          // Add text to page (PDF uses bottom-left origin)
          page.drawText(field.value, {
            x: field.x,
            y: height - field.y - field.height,
            size: field.fontSize,
            color: rgb(r, g, b),
            font: await pdfDoc.embedFont(StandardFonts.Helvetica),
          });
        }
      }

      // Save and download the PDF
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "edited-document.pdf";
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting PDF:", error);
      setError("Failed to export PDF");
    } finally {
      setIsLoading(false);
    }
  };

  const exportFieldsData = () => {
    const exportData = {
      documentUrl,
      fields: textFields,
      scale,
      pageWidth,
      pageHeight,
      numPages,
      workflowId: workflowData.id,
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
    setZoomMode('width');
    if (containerRef.current && pageWidth) {
      const rect = containerRef.current.getBoundingClientRect();
      const calculatedScale = rect.width / pageWidth;
      setScale(Math.min(calculatedScale, 3.0)); // Max zoom 300%
    }
  }, [pageWidth]);

  // Zoom to actual size
  const zoomToActualSize = useCallback(() => {
    setZoomMode('page');
    setScale(1.0);
  }, []);

  // Zoom in
  const zoomIn = useCallback(() => {
    setZoomMode('page');
    setScale(prev => Math.min(3.0, prev + 0.1));
  }, []);

  // Zoom out
  const zoomOut = useCallback(() => {
    setZoomMode('page');
    setScale(prev => Math.max(0.25, prev - 0.1));
  }, []);

  return (
    <AnimatePresence>

      <div 
        className={`${isOpen ? "flex" : "hidden"} w-full transition-all duration-300 ease-in-out  h-screen flex flex-col bg-gray-100 shadow-2xl`}>
        <style>{styles}</style>
        
        {/* Top Header Bar - Clean Red Design */}
        <div className="bg-white shadow-lg border-b-2 border-red-500">
          <div className="relative max-w-7xl mx-auto">
            
            {/* Persistent Toolbar - Always visible */}
            <div className="bg-white">
              <div className="max-w-7xl mx-auto px-6 py-4">
                {/* Top Row - Always visible tools */}
                <div className="flex items-center justify-between">

                  <div className="flex flex-col gap-5">
                    {/* Views controls */}
                    <div className="flex">
                      {/* Close button */}
                      <button
                        onClick={onClose}
                        className="p-2 transition-all duration-200 flex items-center justify-center"
                        title="Close Document Editor"
                      >
                        <X size={20} />
                      </button>

                      {/* Show upload */}
                      <button
                        onClick={() => {}}
                        className="p-2 transition-all duration-200 flex items-center justify-center"
                        title="Close Document Editor"
                      >
                        Document
                      </button>

                      {/* Show original document */}
                      <button
                        onClick={() => {}}
                        className="p-2 transition-all duration-200 flex items-center justify-center"
                        title="Close Document Editor"
                      >
                        Original Template
                      </button>

                      {/* Show translated document */}
                      <button
                        onClick={() => {}}
                        className="p-2 transition-all duration-200 flex items-center justify-center"
                        title="Close Document Editor"
                      >
                        Translated template
                      </button>

                    </div>
                    
                    {/* Controls */}
                    <div className="flex items-center space-x-4">
                      {/* Document Tools */}
                      <div className="flex items-center space-x-3">
                        {/* Add textbox button */}
                        <button
                          onClick={addTextField}
                          className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group"
                          disabled={!documentUrl}
                          title="Add Text Field"
                        >
                          <Plus size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                        
                        <button
                          onClick={handleTextSelection}
                          className={`p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group ${
                            isTextSelectionMode 
                              ? "bg-red-500 text-white" 
                              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                          }`}
                          disabled={!documentUrl}
                          title="Text Selection Mode"
                        >
                          <MousePointer2 size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                      </div>
                      
                      {/* View Options */}
                      <div className="flex items-center space-x-3">
                        <div className="w-px h-8 bg-gray-300"></div>
                        <button
                          onClick={() => setShowTextboxBorders(!showTextboxBorders)}
                          className={`p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group ${
                            showTextboxBorders
                              ? "bg-red-500 text-white"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                          }`}
                          title="Toggle Field Borders"
                        >
                          <Layout size={20} className="group-hover:scale-110 transition-transform" />
                        </button>
                        
                        <button
                          onClick={() => setIsEditMode(!isEditMode)}
                          className={`p-3 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group gap-2 ${
                            isEditMode
                              ? "bg-red-500 text-white"
                              : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                          }`}
                          title={isEditMode ? "Exit Edit Mode" : "Enter Edit Mode"}
                        >
                          <Type size={20} className="group-hover:scale-110 transition-transform" />
                          <div>Edit Mode</div>
                        </button>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right side - Export actions */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={exportFieldsData}
                      className="p-3 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group"
                      disabled={!documentUrl}
                      title="Export Field Data"
                    >
                      <Save size={20} className="group-hover:scale-110 transition-transform" />
                    </button>
                    
                    <button
                      onClick={exportToPDF}
                      className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center group"
                      disabled={isLoading || !documentUrl}
                      title="Export to PDF"
                    >
                      {isLoading ? (
                        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Download size={20} className="group-hover:scale-110 transition-transform" />
                      )}
                    </button>
                  </div>
                </div>
                
              </div>
            </div>

          </div>
        </div>
        
        {/* Main Content Area */}
        <div 
          className="h-[85%] bg-gray-200 relative overflow-hidden"
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
              <Maximize2 size={16} className="text-gray-600 group-hover:text-gray-800" />
            </button>
            
            {/* Zoom In Button */}
            <button
              onClick={zoomIn}
              className="p-2 hover:bg-gray-50 border-b border-gray-200 transition-colors group flex items-center justify-center"
              title="Zoom In"
            >
              <Plus size={16} className="text-gray-600 group-hover:text-gray-800" />
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
                    height: `${((scale * 100 - 25) / 275) * 100}%`
                  }}
                ></div>
                
                {/* Slider Input - Fixed positioning */}
                <input
                  type="range"
                  min="25"
                  max="300"
                  value={Math.round(scale * 100)}
                  onChange={(e) => {
                    setZoomMode('page');
                    setScale(parseInt(e.target.value) / 100);
                  }}
                  className="absolute w-32 h-6 opacity-0 cursor-pointer origin-center"
                  style={{
                    transform: 'rotate(-90deg)',
                    transformOrigin: 'center'
                  }}
                />
                
                {/* Custom Handle */}
                <div 
                  className="absolute w-4 h-3 bg-white border-2 border-blue-500 rounded-sm shadow-sm pointer-events-none"
                  style={{
                    bottom: `${((scale * 100 - 25) / 275) * 100}%`,
                    transform: 'translateY(50%)'
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
              <Minus size={16} className="text-gray-600 group-hover:text-gray-800" />
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

          {isTextSelectionMode && (
            <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[60] flex items-center space-x-2">
              <MousePointer2 size={18} />
              <span>Click on any text in the document to inspect it</span>
              <button 
                onClick={() => setIsTextSelectionMode(false)}
                className="ml-4 p-1 bg-blue-800 rounded-full hover:bg-blue-900"
              >
                <X size={16} />
              </button>
            </div>
          )}

          {/* Text Selection Popup */}
          {textSelectionPopup && (
            <div 
              className="absolute bg-white shadow-lg rounded-md border border-gray-200 z-[1000] p-2 flex items-center space-x-2 text-selection-popup"
              style={{
                top: `${textSelectionPopup.position.top}px`,
                left: `${textSelectionPopup.position.left}px`,
                transform: 'translateX(-50%)'
              }}
            >
              <button
                onClick={() => handleTrashClick(textSelectionPopup.pagePosition)}
                className="p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                title="Log coordinates"
              >
                <Trash2 size={16} />
              </button>
              <span className="text-sm max-w-xs truncate">{textSelectionPopup.text}</span>
            </div>
          )}

          {documentUrl ? (
            <div className="flex flex-col h-full">            
              <div className="flex-1 overflow-auto p-4 max-h-full">
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
                  onClick={(e) => {
                    if (e.target === e.currentTarget) {
                      setSelectedFieldId(null);
                      setIsTextSelectionMode(false);
                    }
                  }}
                >
                  {/* Document */}
                  <Document
                    file={documentUrl}
                    onLoadSuccess={handleDocumentLoadSuccess}
                    onLoadError={handleDocumentLoadError}
                    loading={<div className="p-8 text-center">Loading PDF...</div>}
                  >
                    <Page
                      pageNumber={currentPage}
                      onLoadSuccess={handlePageLoadSuccess}
                      renderTextLayer={isTextSelectionMode}
                      renderAnnotationLayer={false}
                      width={pageWidth * scale}
                    />
                  </Document>

                  {/* Text Field Overlays */}
                  {textFields
                    .filter((field) => field.page === currentPage)
                    .filter((field) => !field.isFromWorkflow || showWorkflowFields)
                    .map((field) => (
                      <Rnd
                        key={field.id}
                        size={{ width: field.width * scale, height: field.height * scale }}
                        position={{ x: field.x * scale, y: field.y * scale }}
                        onDrag={(e, d) => {
                          updateTextField(field.id, { 
                            x: d.x / scale, 
                            y: d.y / scale 
                          });
                        }}
                        onDragStop={(e, d) => {
                          updateTextField(field.id, { 
                            x: d.x / scale, 
                            y: d.y / scale 
                          });
                        }}
                        onResizeStop={(e, direction, ref, delta, position) => {
                          // Convert scaled dimensions back to original scale
                          updateTextField(field.id, {
                            width: parseInt(ref.style.width) / scale,
                            height: parseInt(ref.style.height) / scale,
                            x: position.x / scale,
                            y: position.y / scale
                          });
                        }}
                        disableDragging={!isEditMode}
                        enableResizing={isEditMode ? {
                          top: false,
                          right: false,
                          bottom: false,
                          left: false,
                          topRight: false,
                          bottomLeft: false,
                          topLeft: false,
                          bottomRight: true
                        } : false}
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
                        className={`${showTextboxBorders ? 'border border-blue-500' : 'border'} ${field.isFromWorkflow ? ' hover:border-purple-400' : 'border-gray-300 hover:border-blue-400'} ${
                          selectedFieldId === field.id
                            ? ""
                            : ""
                        } transition-all duration-200 ease-in-out`}
                        style={{
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          transition: "transform 0.1s ease-out",
                          zIndex: selectedFieldId === field.id ? 1000 : 100,
                          transform: "none", // Ensure no additional scaling
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
                                      fontSize: Math.max(6, field.fontSize - 1) 
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
                                      fontSize: Math.min(72, field.fontSize + 1) 
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
                                settingsPopupFor === field.id ? 'bg-gray-100 border-gray-400' : ''
                              }`}
                            >
                              <MoreHorizontal size={14} className="text-gray-600" />
                            </button>

                            {/* Settings popup */}
                            {settingsPopupFor === field.id && (
                              <div 
                                className="absolute top-0 right-0 transform translate-y-8 translate-x-1 bg-white shadow-xl rounded-lg p-4 z-20 border border-gray-200 w-64 settings-popup"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <div className="flex justify-between items-center mb-3">
                                  <h3 className="font-semibold text-gray-800">Field Settings</h3>
                                  <button 
                                    onClick={() => setSettingsPopupFor(null)}
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
                                            x: parseInt(e.target.value) || 0,
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
                                            y: parseInt(e.target.value) || 0,
                                          })
                                        }
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                        min="0"
                                      />
                                    </div>
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
                                          updateTextField(field.id, { fontColor: e.target.value })
                                        }
                                        className="w-10 h-10 border border-gray-300 rounded-lg cursor-pointer bg-white"
                                      />
                                      <input
                                        type="text"
                                        value={field.fontColor}
                                        onChange={(e) =>
                                          updateTextField(field.id, { fontColor: e.target.value })
                                        }
                                        className="flex-1 px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all duration-200"
                                        placeholder="#000000"
                                      />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}


                          {/* Text content */}
                          <textarea
                            value={field.value}
                            onChange={(e) =>
                              updateTextField(field.id, { value: e.target.value })
                            }
                            className="w-full h-full resize-none border-none outline-none bg-transparent transition-all duration-200 absolute"
                            style={{
                              fontSize: `${field.fontSize * scale}px`,
                              color: field.fontColor,
                              fontFamily: field.fontFamily,
                              cursor: "text",
                              padding: "1px",
                              lineHeight: "1.1",
                              wordWrap: "break-word",
                              wordBreak: "break-all",
                              whiteSpace: "pre-wrap",
                              boxSizing: "border-box",
                              overflow: "hidden",
                            }}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedFieldId(field.id);
                              setIsTextSelectionMode(false);
                            }}
                          />
                          
                        </div>
                      </Rnd>
                    ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Edit3 size={64} className="mb-4 text-gray-300" />
              <h2 className="text-xl font-semibold mb-2">PDF Document Editor</h2>
              <p className="text-center mb-6 max-w-md">
                Upload a PDF document to start adding and editing text fields. You
                can drag, resize, and customize text overlays.
              </p>
            </div>
          )}
        </div>
        
        {/* Bottom Controls - Simplified with Zoom Slider */}
        <div className="absolute bottom-0 bg-white border-t border-gray-200 px-4 py-2 flex items-center justify-between">
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
          

          
          <div className="w-28"></div> {/* Spacer for alignment */}
        </div>
      
      </div>

    </AnimatePresence>
  );
};

export default DocumentCanvas;