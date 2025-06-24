import React, { useState, useEffect, useRef, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Rnd } from "react-rnd";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import {
  X,
  Download,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Save,
  Edit3,
  Type,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  Upload,
  Move,
  Square,
  ChevronLeft,
  ChevronRight,
  Minus,
  Layout,
  MousePointer2
} from "lucide-react";

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

const DocumentCanvas: React.FC = () => {
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

  const fileInputRef = useRef<HTMLInputElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);

const styles = `
  .drag-handle:active {
    transform: scale(0.95) !important;
  }
  
  .rnd {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
  
  .rnd:hover {
    z-index: 10;
  }
  
  .rnd.react-draggable-dragging {
    z-index: 1000;
    transition: none;
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
  }, []);

  // Load workflow fields when page dimensions are available
  useEffect(() => {
    if (pageWidth && pageHeight) {
      loadWorkflowFields();
    }
  }, [pageWidth, pageHeight]);

// Change only the loadWorkflowFields function to properly handle the coordinate conversion:

  const loadWorkflowFields = useCallback(() => {
    const fields: TextField[] = [];

    Object.entries(workflowData.origin_template_mappings).forEach(
      ([key, mapping]) => {
        const fieldData = workflowData.fields[key];
        if (fieldData && mapping) {
          // Convert PDF coordinates (PDF uses bottom-left origin, we use top-left)
          // Option 1: If your mappings are already in PDF coordinates (bottom-left origin)
          // Comment out the lines below if using Option 2
          /*
          const field: TextField = {
            id: `workflow-${key}`,
            x: mapping.position.x0,
            y: pageHeight - mapping.position.y0, // Use y0 (bottom) and flip
            width: Math.max(mapping.position.width, 50),
            height: Math.max(mapping.position.height, 20),
            value: fieldData.value || "",
            fontSize: Math.max(mapping.font.size, 8),
            fontColor: mapping.font.color || "#000000",
            fontFamily: "Arial, sans-serif",
            page: mapping.page_number,
            fieldKey: key,
            isFromWorkflow: true,
          };
          */
          
          // Option 2: If your mappings are already in web coordinates (top-left origin)
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

  const loadDocumentFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === "application/pdf") {
      const url = URL.createObjectURL(file);
      setDocumentUrl(url);
      setTextFields([]);
      setSelectedFieldId(null);
      setCurrentPage(1);
      setIsTextSelectionMode(false);
      setTextSelectionPopup(null); // Close any popup
    }
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

  return (
    <div className="h-screen flex bg-gray-100">
      <style>{styles}</style>
      {/* Sidebar */}
      <div className="w-80 bg-white shadow-lg border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-2 mb-4">
            <Edit3 size={20} className="text-blue-600" />
            <h1 className="text-lg font-semibold text-gray-800">PDF Editor</h1>
          </div>

          {/* File Upload */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf"
            onChange={loadDocumentFile}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors flex items-center justify-center space-x-2"
          >
            <Upload size={16} />
            <span>Load PDF</span>
          </button>
        </div>

        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200">
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={addTextField}
              className="px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
            >
              <Plus size={16} />
              <span>Add Text</span>
            </button>
            <button
              onClick={() => setIsEditMode(!isEditMode)}
              className={`px-3 py-2 rounded transition-colors flex items-center justify-center space-x-1 ${
                isEditMode
                  ? "bg-orange-600 text-white hover:bg-orange-700"
                  : "bg-gray-600 text-white hover:bg-gray-700"
              }`}
            >
              <Type size={16} />
              <span>{isEditMode ? "Edit" : "View"}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 mb-4">
            <button
              onClick={() => setShowWorkflowFields(!showWorkflowFields)}
              className={`px-3 py-2 rounded transition-colors flex items-center space-x-1 ${
                showWorkflowFields
                  ? "bg-purple-600 text-white hover:bg-purple-700"
                  : "bg-gray-400 text-white hover:bg-gray-500"
              }`}
            >
              {showWorkflowFields ? <Eye size={16} /> : <EyeOff size={16} />}
              <span>Workflow</span>
            </button>
            
            <button
              onClick={() => setShowTextboxBorders(!showTextboxBorders)}
              className={`px-3 py-2 rounded transition-colors flex items-center space-x-1 ${
                showTextboxBorders
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-400 text-white hover:bg-gray-500"
              }`}
            >
              <Layout size={16} />
              <span>Borders</span>
            </button>
          </div>

          {/* Text Selection Mode Button */}
          <div className="mb-4">
            <button
              onClick={handleTextSelection}
              className={`w-full px-3 py-2 rounded transition-colors flex items-center justify-center space-x-1 ${
                isTextSelectionMode
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "bg-gray-600 text-white hover:bg-gray-700"
              }`}
            >
              <MousePointer2 size={16} />
              <span>Text Selection Mode</span>
            </button>
            {isTextSelectionMode && (
              <div className="mt-2 p-2 bg-blue-50 text-blue-700 text-xs rounded border border-blue-200 z-[70]">
                Click on any text in the document to inspect it
              </div>
            )}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setScale(Math.max(0.5, scale - 0.1))}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ZoomOut size={16} />
            </button>
            <span className="text-sm text-gray-600 min-w-[60px] text-center">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale(Math.min(2.0, scale + 0.1))}
              className="p-2 bg-gray-200 hover:bg-gray-300 rounded transition-colors"
            >
              <ZoomIn size={16} />
            </button>
          </div>

          {/* Export Buttons */}
          <div className="space-y-2">
            <button
              onClick={exportToPDF}
              disabled={!documentUrl || isLoading}
              className="w-full px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              <Download size={16} />
              <span>{isLoading ? "Exporting..." : "Export PDF"}</span>
            </button>
            <button
              onClick={exportFieldsData}
              disabled={!documentUrl}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
            >
              <Save size={16} />
              <span>Export Data</span>
            </button>
          </div>
        </div>

        {/* Page Navigation */}
        {numPages > 0 && (
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <button
                onClick={() => goToPage(currentPage - 1)}
                disabled={currentPage <= 1}
                className="p-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded transition-colors"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {numPages}
              </span>
              <button
                onClick={() => goToPage(currentPage + 1)}
                disabled={currentPage >= numPages}
                className="p-2 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 disabled:cursor-not-allowed rounded transition-colors"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}

        {/* Field Properties Panel */}
        {selectedFieldId && isEditMode && (
          <div className="p-4 border-b border-gray-200 flex-1 overflow-y-auto">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Field Properties
            </h3>
            {(() => {
              const field = textFields.find((f) => f.id === selectedFieldId);
              if (!field) return null;

              return (
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Text Value
                    </label>
                    <textarea
                      value={field.value}
                      onChange={(e) =>
                        updateTextField(field.id, { value: e.target.value })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded resize-none"
                      rows={3}
                    />
                  </div>

                  {/* Position Controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
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
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
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
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        min="0"
                      />
                    </div>
                  </div>

                  {/* Size Controls */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Width
                      </label>
                      <input
                        type="number"
                        value={Math.round(field.width)}
                        onChange={(e) =>
                          updateTextField(field.id, {
                            width: parseInt(e.target.value) || 50,
                          })
                        }
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        min="10"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">
                        Height
                      </label>
                      <input
                        type="number"
                        value={Math.round(field.height)}
                        onChange={(e) =>
                          updateTextField(field.id, {
                            height: parseInt(e.target.value) || 20,
                          })
                        }
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                        min="10"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Font Size
                    </label>
                    <input
                      type="number"
                      value={field.fontSize}
                      onChange={(e) =>
                        updateTextField(field.id, {
                          fontSize: parseInt(e.target.value) || 12,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                      min="6"
                      max="72"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Color
                    </label>
                    <input
                      type="color"
                      value={field.fontColor}
                      onChange={(e) =>
                        updateTextField(field.id, { fontColor: e.target.value })
                      }
                      className="w-full h-8 border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-600 mb-1">
                      Font Family
                    </label>
                    <select
                      value={field.fontFamily}
                      onChange={(e) =>
                        updateTextField(field.id, {
                          fontFamily: e.target.value,
                        })
                      }
                      className="w-full px-2 py-1 text-xs border border-gray-300 rounded"
                    >
                      <option value="Arial, sans-serif">Arial</option>
                      <option value="Georgia, serif">Georgia</option>
                      <option value="'Times New Roman', serif">
                        Times New Roman
                      </option>
                      <option value="'Courier New', monospace">
                        Courier New
                      </option>
                      <option value="Verdana, sans-serif">Verdana</option>
                    </select>
                  </div>
                  {field.isFromWorkflow && (
                    <div className="p-2 bg-purple-100 rounded text-xs">
                      <div className="font-semibold text-purple-800">
                        Workflow Field
                      </div>
                      <div className="text-purple-600">
                        Key: {field.fieldKey}
                      </div>
                      {workflowData.template_required_fields[
                        field.fieldKey!
                      ] && (
                        <div className="mt-1 text-purple-600">
                          <div className="font-medium">
                            {
                              workflowData.template_required_fields[
                                field.fieldKey!
                              ].label
                            }
                          </div>
                          <div className="text-xs">
                            {
                              workflowData.template_required_fields[
                                field.fieldKey!
                              ].description
                            }
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <button
                    onClick={() => deleteTextField(field.id)}
                    className="w-full px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors flex items-center justify-center space-x-1"
                  >
                    <Trash2 size={14} />
                    <span>Delete Field</span>
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto bg-gray-200 p-4">
        {error && (
          <div className="mb-4 p-4 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {isTextSelectionMode && (
          <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg z-[60] flex items-center space-x-2">
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
            className="fixed bg-white shadow-lg rounded-md border border-gray-200 z-[1000] p-2 flex items-center space-x-2 text-selection-popup"
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
          <div className="flex justify-center">
            <div
              className={`relative bg-white shadow-lg ${
                isTextSelectionMode ? "text-selection-mode" : ""
              }`}
              ref={documentRef}
              onClick={(e) => {
                if (e.target === e.currentTarget) {
                  setSelectedFieldId(null);
                  setIsTextSelectionMode(false);
                }
              }}
            >
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
                  width={pageWidth}
                />
              </Document>

              {/* Text Field Overlays */}
              {textFields
                .filter((field) => field.page === currentPage)
                .filter((field) => !field.isFromWorkflow || showWorkflowFields)
                .map((field) => (
                  <Rnd
                    key={field.id}
                    size={{ width: field.width, height: field.height }}
                    position={{ x: field.x, y: field.y }}
                    onDrag={(e, d) => {
                      updateTextField(field.id, { x: d.x, y: d.y });
                    }}
                    onDragStop={(e, d) => {
                      updateTextField(field.id, { x: d.x, y: d.y });
                    }}
                    onResizeStop={(e, direction, ref, delta, position) => {
                      updateTextField(field.id, {
                        width: parseInt(ref.style.width),
                        height: parseInt(ref.style.height),
                        ...position,
                      });
                    }}
                    disableDragging={!isEditMode}
                    enableResizing={isEditMode}
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
                    className={`${showTextboxBorders ? 'border-2' : 'border-0'} ${field.isFromWorkflow ? ' hover:border-purple-400' : 'border-gray-300 hover:border-blue-400'} ${
                      selectedFieldId === field.id
                        ? ""
                        : ""
                    } transition-all duration-200 ease-in-out`}
                    style={{
                      backgroundColor: "rgba(255, 255, 255, 0.1)", // Semi-transparent background
                      transition: "transform 0.1s ease-out",
                      zIndex: selectedFieldId === field.id ? 1000 : 100,
                    }}
                  >
                    <div className="w-full h-full relative group">
                      {/* Move handle */}
                      {isEditMode && (
                       <div className="absolute -bottom-7 left-1 transform opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 flex items-center space-x-1">
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
                                  fontSize: Math.max(6, field.fontSize - 1) 
                                });
                              }}
                              className="text-black p-1 transition-all duration-200 transform hover:scale-105"
                              title="Decrease font size"
                            >
                              <Minus size={10} />
                            </button>
                            <span className="text-black text-xs font-medium text-center">
                              {field.fontSize}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                updateTextField(field.id, { 
                                  fontSize: Math.min(72, field.fontSize + 1) 
                                });
                              }}
                              className="text-black p-1 transition-all duration-200 transform hover:scale-105"
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
                            className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 transform hover:scale-110 z-10"
                          >
                            <Trash2 size={10} />
                          </button>
                        )}


                      {/* Text content */}
  <textarea
    value={field.value}
    onChange={(e) =>
      updateTextField(field.id, { value: e.target.value })
    }
    className="w-full h-full resize-none border-none outline-none bg-transparent transition-all duration-200 absolute"
    style={{
      fontSize: `${field.fontSize}px`,
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
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Edit3 size={64} className="mb-4 text-gray-300" />
            <h2 className="text-xl font-semibold mb-2">PDF Document Editor</h2>
            <p className="text-center mb-6 max-w-md">
              Upload a PDF document to start adding and editing text fields. You
              can drag, resize, and customize text overlays.
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Upload size={20} />
              <span>Load PDF Document</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentCanvas;