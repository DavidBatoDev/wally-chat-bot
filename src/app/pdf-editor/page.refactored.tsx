"use client";

import React, { useState, useRef, useCallback, useEffect } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { toast } from "sonner";
import {
  TextFormatProvider,
  useTextFormat,
} from "@/components/editor/ElementFormatContext";
import { ElementFormatDrawer } from "@/components/editor/ElementFormatDrawer";

// Import our new types and utilities
import {
  DocumentState,
  EditorState,
  ToolState,
  ErasureState,
  SelectionState,
  ViewState,
  PageState,
  ViewMode,
} from "./types/pdf-editor.types";

// Import custom hooks
import { useDocumentState } from "./hooks/useDocumentState";
import { useElementManagement } from "./hooks/useElementManagement";

// Import components
import { PDFEditorHeader } from "./components/layout/PDFEditorHeader";
import { FloatingToolbar } from "./components/layout/FloatingToolbar";

// Import utilities
import { generateUUID, measureText, isPdfFile } from "./utils/measurements";
import { colorToRgba, rgbStringToHex } from "./utils/colors";
import {
  screenToDocumentCoordinates,
  determineClickedView,
} from "./utils/coordinates";

// Import react-pdf CSS for text layer support
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

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

  // Use our custom hooks
  const { documentState, setDocumentState, handlers, actions } =
    useDocumentState();
  const {
    elementCollections,
    layerState,
    getCurrentTextBoxes,
    getCurrentShapes,
    getCurrentImages,
    getCurrentDeletionRectangles,
    getSortedElements,
    addTextBox,
    addShape,
    addImage,
    addDeletionRectangle,
    updateTextBox,
    updateShape,
    updateImage,
    deleteTextBox,
    deleteShape,
    deleteImage,
    deleteDeletionRectangle,
    moveToFront,
    moveToBack,
    moveForward,
    moveBackward,
    isElementAtFront,
    isElementAtBack,
  } = useElementManagement();

  // Editor state
  const [editorState, setEditorState] = useState<EditorState>({
    selectedFieldId: null,
    selectedShapeId: null,
    isEditMode: true,
    isAddTextBoxMode: false,
    isTextSelectionMode: false,
    showDeletionRectangles: false,
    isImageUploadMode: false,
  });

  // Tool state
  const [toolState, setToolState] = useState<ToolState>({
    shapeDrawingMode: null,
    selectedShapeType: "rectangle",
    isDrawingShape: false,
    shapeDrawStart: null,
    shapeDrawEnd: null,
    isDrawingInProgress: false,
    shapeDrawTargetView: null,
  });

  // Erasure state
  const [erasureState, setErasureState] = useState<ErasureState>({
    isErasureMode: false,
    isDrawingErasure: false,
    erasureDrawStart: null,
    erasureDrawEnd: null,
    erasureDrawTargetView: null,
    erasureSettings: {
      width: 20,
      height: 20,
      background: "#ffffff",
      opacity: 1.0,
    },
  });

  // Selection state
  const [selectionState, setSelectionState] = useState<SelectionState>({
    selectedTextBoxes: { textBoxIds: [] },
    isDrawingSelection: false,
    selectionStart: null,
    selectionEnd: null,
  });

  // View state
  const [viewState, setViewState] = useState<ViewState>({
    currentView: "original",
    zoomMode: "page",
    containerWidth: 0,
    isCtrlPressed: false,
    transformOrigin: "center center",
    isSidebarCollapsed: false,
    activeSidebarTab: "pages",
  });

  // Page state
  const [pageState, setPageState] = useState<PageState>({
    deletedPages: new Set(),
    isPageTranslated: new Map(),
    isTransforming: false,
    showTransformButton: true,
  });

  // Refs
  const documentRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const appendFileInputRef = useRef<HTMLInputElement>(null);

  // Tool change handler
  const handleToolChange = useCallback((tool: string, enabled: boolean) => {
    // Reset all tool states first
    setEditorState((prev) => ({
      ...prev,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
    }));
    setToolState((prev) => ({
      ...prev,
      shapeDrawingMode: null,
      isDrawingInProgress: false,
      shapeDrawStart: null,
      shapeDrawEnd: null,
      shapeDrawTargetView: null,
    }));
    setErasureState((prev) => ({
      ...prev,
      isErasureMode: false,
    }));

    // Enable the selected tool
    switch (tool) {
      case "textSelection":
        if (enabled) {
          setEditorState((prev) => ({ ...prev, isTextSelectionMode: true }));
        }
        break;
      case "addTextBox":
        if (enabled) {
          setEditorState((prev) => ({ ...prev, isAddTextBoxMode: true }));
        }
        break;
      case "rectangle":
        if (!enabled) {
          // If currently enabled, disable it
          setToolState((prev) => ({ ...prev, shapeDrawingMode: "rectangle" }));
        }
        break;
      case "circle":
        if (!enabled) {
          // If currently enabled, disable it
          setToolState((prev) => ({ ...prev, shapeDrawingMode: "circle" }));
        }
        break;
      case "erasure":
        if (enabled) {
          setErasureState((prev) => ({ ...prev, isErasureMode: true }));
        }
        break;
    }
  }, []);

  // View change handler
  const handleViewChange = useCallback((view: ViewMode) => {
    setViewState((prev) => ({ ...prev, currentView: view }));
  }, []);

  // Edit mode toggle
  const handleEditModeToggle = useCallback(() => {
    setEditorState((prev) => ({ ...prev, isEditMode: !prev.isEditMode }));
  }, []);

  // Deletion toggle
  const handleDeletionToggle = useCallback(() => {
    setEditorState((prev) => ({
      ...prev,
      showDeletionRectangles: !prev.showDeletionRectangles,
    }));
  }, []);

  // Image upload handler
  const handleImageUpload = useCallback(() => {
    // Reset other tool modes
    setEditorState((prev) => ({
      ...prev,
      isTextSelectionMode: false,
      isAddTextBoxMode: false,
    }));
    setToolState((prev) => ({
      ...prev,
      shapeDrawingMode: null,
      isDrawingInProgress: false,
      shapeDrawStart: null,
      shapeDrawEnd: null,
      shapeDrawTargetView: null,
    }));
    setErasureState((prev) => ({ ...prev, isErasureMode: false }));

    // Trigger file input
    imageInputRef.current?.click();
  }, []);

  // Document container click handler
  const handleDocumentContainerClick = useCallback(
    (e: React.MouseEvent) => {
      if (!documentRef.current) return;

      // Don't handle clicks on interactive elements
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
      const { x, y } = screenToDocumentCoordinates(
        e.clientX,
        e.clientY,
        rect,
        documentState.scale,
        determineClickedView(
          e.clientX - rect.left,
          documentState.pageWidth,
          documentState.scale
        ),
        viewState.currentView,
        documentState.pageWidth
      );

      if (editorState.isAddTextBoxMode) {
        const targetView =
          viewState.currentView === "split"
            ? determineClickedView(
                e.clientX - rect.left,
                documentState.pageWidth,
                documentState.scale
              )
            : undefined;

        const fieldId = addTextBox(
          x,
          y,
          documentState.currentPage,
          viewState.currentView,
          targetView || undefined
        );

        // Select the new textbox
        setEditorState((prev) => ({
          ...prev,
          selectedFieldId: fieldId,
          isAddTextBoxMode: false,
        }));
        setSelectedElementId(fieldId);
        setSelectedElementType("textbox");
        setIsDrawerOpen(true);
      } else if (toolState.shapeDrawingMode) {
        if (!toolState.isDrawingInProgress) {
          const targetView =
            viewState.currentView === "split"
              ? determineClickedView(
                  e.clientX - rect.left,
                  documentState.pageWidth,
                  documentState.scale
                )
              : null;

          setToolState((prev) => ({
            ...prev,
            shapeDrawStart: { x, y },
            shapeDrawTargetView: targetView,
            isDrawingInProgress: true,
          }));
        }
      } else {
        // Clear selections if not clicking on an element
        if (!target.closest(".rnd")) {
          setEditorState((prev) => ({
            ...prev,
            selectedFieldId: null,
            selectedShapeId: null,
          }));
          setSelectedElementId(null);
          setSelectedElementType(null);
          setCurrentFormat(null);
          setIsDrawerOpen(false);
        }
      }
    },
    [
      documentState.scale,
      documentState.pageWidth,
      documentState.currentPage,
      viewState.currentView,
      editorState.isAddTextBoxMode,
      toolState.shapeDrawingMode,
      toolState.isDrawingInProgress,
      addTextBox,
      setSelectedElementId,
      setSelectedElementType,
      setCurrentFormat,
      setIsDrawerOpen,
    ]
  );

  // File upload handlers
  const handleFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        actions.loadDocument(file);
        setViewState((prev) => ({ ...prev, activeSidebarTab: "pages" }));
      }
    },
    [actions]
  );

  const handleImageFileUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        const url = URL.createObjectURL(file);

        const imageId = addImage(
          url,
          100, // Default position
          100,
          200, // Default size
          150,
          documentState.currentPage,
          viewState.currentView
        );

        setSelectedElementId(imageId);
        setSelectedElementType("image");
        setIsDrawerOpen(true);

        // Reset file input
        if (imageInputRef.current) {
          imageInputRef.current.value = "";
        }

        toast.success("Image added to document");
      }
    },
    [
      addImage,
      documentState.currentPage,
      viewState.currentView,
      setSelectedElementId,
      setSelectedElementType,
      setIsDrawerOpen,
    ]
  );

  // Project management
  const saveProject = useCallback(() => {
    localStorage.setItem(
      "pdf-editor-project",
      JSON.stringify({
        elementCollections,
        layerState,
        documentUrl: documentState.url,
        currentPage: documentState.currentPage,
      })
    );
    toast.success("Project saved!");
  }, [
    elementCollections,
    layerState,
    documentState.url,
    documentState.currentPage,
  ]);

  const exportData = useCallback(() => {
    const data = {
      ...elementCollections,
      documentInfo: {
        url: documentState.url,
        currentPage: documentState.currentPage,
        numPages: documentState.numPages,
        scale: documentState.scale,
        pageWidth: documentState.pageWidth,
        pageHeight: documentState.pageHeight,
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
  }, [elementCollections, documentState]);

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Add the CSS styles */}
      <style>{`
        /* All the existing CSS styles from the original component */
        .react-pdf__Page__canvas {
          display: block !important;
          position: relative !important;
          z-index: 1 !important;
        }

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
          margin: 0 !important;
          padding: 0 !important;
          box-sizing: border-box !important;
        }

        .rnd {
          z-index: 10000 !important;
          position: absolute !important;
        }

        .rnd.selected {
          z-index: 20000 !important;
        }

        .add-text-box-mode .react-pdf__Page__textContent {
          pointer-events: auto !important;
          z-index: 200 !important;
        }

        .add-text-box-mode .react-pdf__Page__textContent span {
          cursor: pointer !important;
          color: rgba(0, 0, 0, 0.1) !important;
          background-color: rgba(34, 197, 94, 0.2) !important;
          transition: background-color 0.2s !important;
          pointer-events: auto !important;
          border-radius: 2px !important;
          z-index: 200 !important;
        }

        .add-text-box-mode .react-pdf__Page__textContent span:hover {
          background-color: rgba(34, 197, 94, 0.4) !important;
          color: rgba(0, 0, 0, 0.3) !important;
        }

        /* Additional styles... */
      `}</style>

      {/* Header */}
      <PDFEditorHeader
        isSidebarCollapsed={viewState.isSidebarCollapsed}
        onSidebarToggle={() =>
          setViewState((prev) => ({
            ...prev,
            isSidebarCollapsed: !prev.isSidebarCollapsed,
          }))
        }
        onFileUpload={() => fileInputRef.current?.click()}
        onSaveProject={saveProject}
        onExportData={exportData}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Hidden file inputs */}
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
          onChange={handleImageFileUpload}
          accept=".jpg,.jpeg,.png,.gif,.bmp,.webp,.svg"
          className="hidden"
        />

        {/* Sidebar would go here */}
        <div
          className={`bg-white border-r border-red-100 p-4 overflow-y-auto transition-all duration-300 shadow-sm ${
            viewState.isSidebarCollapsed ? "w-0 p-0 border-r-0" : "w-80"
          }`}
        >
          {/* Sidebar content would be implemented here */}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden relative">
          {/* ElementFormatDrawer */}
          <div className="relative z-40 transition-all duration-300">
            <ElementFormatDrawer />
          </div>

          {/* Floating Toolbars */}
          <FloatingToolbar
            editorState={editorState}
            toolState={toolState}
            erasureState={erasureState}
            currentView={viewState.currentView}
            showDeletionRectangles={editorState.showDeletionRectangles}
            isSidebarCollapsed={viewState.isSidebarCollapsed}
            onToolChange={handleToolChange}
            onViewChange={handleViewChange}
            onEditModeToggle={handleEditModeToggle}
            onDeletionToggle={handleDeletionToggle}
            onImageUpload={handleImageUpload}
          />

          {/* Document Viewer */}
          <div
            className="flex-1 document-viewer document-container"
            ref={containerRef}
            style={{
              scrollBehavior: "smooth",
              overflow: "auto",
              paddingTop: "20px",
            }}
          >
            {documentState.error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-red-500 text-lg mb-2">Error</div>
                  <div className="text-gray-600">{documentState.error}</div>
                </div>
              </div>
            )}

            {!documentState.url && !documentState.error && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <div className="text-gray-500 text-lg mb-2">
                    No document loaded
                  </div>
                  <button onClick={() => fileInputRef.current?.click()}>
                    Upload Document
                  </button>
                </div>
              </div>
            )}

            {documentState.url && !documentState.error && (
              <div
                className="document-wrapper"
                style={{
                  minHeight: `${Math.max(
                    100,
                    documentState.pageHeight * documentState.scale + 80
                  )}px`,
                  height: `${Math.max(
                    100,
                    documentState.pageHeight * documentState.scale + 80
                  )}px`,
                  width: `${Math.max(
                    100,
                    viewState.currentView === "split"
                      ? documentState.pageWidth * documentState.scale * 2 + 100
                      : documentState.pageWidth * documentState.scale + 80
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
                    editorState.isAddTextBoxMode ? "add-text-box-mode" : ""
                  } ${
                    editorState.isTextSelectionMode ? "text-selection-mode" : ""
                  } ${
                    editorState.isAddTextBoxMode ||
                    toolState.shapeDrawingMode ||
                    erasureState.isErasureMode
                      ? "cursor-crosshair"
                      : ""
                  }`}
                  onClick={handleDocumentContainerClick}
                  style={{
                    width:
                      viewState.currentView === "split"
                        ? documentState.pageWidth * documentState.scale * 2 + 20
                        : documentState.pageWidth * documentState.scale,
                    height: documentState.pageHeight * documentState.scale,
                  }}
                >
                  {/* Document rendering based on current view */}
                  {viewState.currentView === "original" &&
                    isPdfFile(documentState.url) && (
                      <Document
                        file={documentState.url}
                        onLoadSuccess={handlers.handleDocumentLoadSuccess}
                        onLoadError={handlers.handleDocumentLoadError}
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
                          pageNumber={documentState.currentPage}
                          onLoadSuccess={handlers.handlePageLoadSuccess}
                          onLoadError={handlers.handlePageLoadError}
                          onRenderSuccess={() =>
                            setDocumentState((prev) => ({
                              ...prev,
                              isPageLoading: false,
                            }))
                          }
                          onRenderError={handlers.handlePageLoadError}
                          renderTextLayer={editorState.isAddTextBoxMode}
                          renderAnnotationLayer={false}
                          width={documentState.pageWidth * documentState.scale}
                        />
                      </Document>
                    )}

                  {/* Interactive elements would be rendered here */}
                  {/* This would include the MemoizedTextBox, MemoizedShape, etc. components */}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status Bar */}
      <div className="bg-white border-t border-gray-200 px-4 py-2">
        <div className="flex items-center justify-between text-sm text-gray-600">
          <div className="flex items-center space-x-4">
            <span>Current View: {viewState.currentView}</span>
            <span>
              Page: {documentState.currentPage} of {documentState.numPages}
            </span>
            <span>Scale: {Math.round(documentState.scale * 100)}%</span>
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
