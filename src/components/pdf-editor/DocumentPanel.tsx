import React from "react";
import DocumentView from "./DocumentView";
import DocumentElementsLayer from "./DocumentElementsLayer";
import BlankTranslatedView from "./BlankTranslatedView";
import {
  TextField,
  Shape as ShapeType,
  Image as ImageType,
  DeletionRectangle,
} from "@/app/pdf-editor/types/pdf-editor.types";

interface DocumentPanelProps {
  viewType: "original" | "translated" | "final-layout";

  // Document props
  documentUrl: string;
  currentPage: number;
  pageWidth: number;
  pageHeight: number;
  scale: number;
  pdfRenderScale: number; // Add PDF render scale
  numPages: number;
  isScaleChanging: boolean;
  isAddTextBoxMode: boolean;
  isTextSpanZooming: boolean;
  isPdfFile: (url: string) => boolean;

  // Handlers and actions
  handlers: {
    handleDocumentLoadSuccess: (pdf: any) => void;
    handleDocumentLoadError: (error: any) => void;
    handlePageLoadSuccess: (page: any) => void;
    handlePageLoadError: (error: any) => void;
    handleImageLoadSuccess: (
      event: React.SyntheticEvent<HTMLImageElement>
    ) => void;
    handleImageLoadError: () => void;
  };
  actions: {
    capturePdfBackgroundColor: () => void;
    updatePdfRenderScale: (scale: number) => void; // Add PDF render scale action
  };
  setDocumentState: React.Dispatch<React.SetStateAction<any>>;

  // Translated view specific props
  isPageTranslated?: boolean;
  isTransforming?: boolean;
  isTranslating?: boolean;
  onRunOcr?: () => void;
  // Template dimensions for translated view
  templateWidth?: number;
  templateHeight?: number;
  // Template scale factor for split view (to scale template to match original document size)
  templateScaleFactor?: number;
  // Template dimension update callback
  onTemplateLoadSuccess?: (
    pageNumber: number,
    width: number,
    height: number
  ) => void;

  // Elements layer props
  deletionRectangles: DeletionRectangle[];
  showDeletionRectangles: boolean;
  onDeleteDeletionRectangle: (id: string) => void;
  colorToRgba: (color: string, opacity: number) => string;
  sortedElements: Array<{
    type: "textbox" | "shape" | "image";
    element: TextField | ShapeType | ImageType;
  }>;
  getElementsInSelectionPreview: () => Set<string>;

  // Element handlers
  selectedFieldId: string | null;
  selectedShapeId: string | null;
  selectedElementId: string | null;
  isEditMode: boolean;
  showPaddingIndicator: boolean;
  onTextBoxSelect: (id: string) => void;
  onShapeSelect: (id: string) => void;
  onImageSelect: (id: string) => void;
  onUpdateTextBox: (id: string, updates: any) => void;
  onUpdateShape: (id: string, updates: any) => void;
  onUpdateImage: (id: string, updates: any) => void;
  onDeleteTextBox: (id: string) => void;
  onDeleteShape: (id: string) => void;
  onDeleteImage: (id: string) => void;

  // Text selection mode
  isTextSelectionMode: boolean;
  selectedTextBoxes: { textBoxIds: string[] };

  // Auto focus
  autoFocusTextBoxId: string | null;
  onAutoFocusComplete: (id: string) => void;

  // Selection mode
  isSelectionMode: boolean;
  multiSelection: {
    isDrawingSelection: boolean;
    selectionStart: { x: number; y: number } | null;
    selectionEnd: { x: number; y: number } | null;
    targetView: "original" | "translated" | "final-layout" | null;
    selectionBounds: any;
    selectedElements: any[];
    isMovingSelection: boolean;
    dragOffsets?: Record<string, { x: number; y: number }>;
  };
  currentView: "original" | "translated" | "split" | "final-layout";
  onMoveSelection: () => void;
  onDeleteSelection: () => void;
  onDragSelection: (deltaX: number, deltaY: number) => void;
  onDragStopSelection: (deltaX: number, deltaY: number) => void;
  
  // Multi-selection drag handlers for performance optimization
  onMultiSelectDragStart?: (id: string) => void;
  onMultiSelectDrag?: (id: string, deltaX: number, deltaY: number) => void;
  onMultiSelectDragStop?: (id: string, deltaX: number, deltaY: number) => void;
  
  // Performance optimization: Direct DOM manipulation
  registerElementRef?: (elementId: string, element: HTMLElement | null) => void;

  // Optional header
  header?: React.ReactNode;
}

const DocumentPanel: React.FC<DocumentPanelProps> = ({
  viewType,
  documentUrl,
  currentPage,
  pageWidth,
  pageHeight,
  scale,
  pdfRenderScale,
  numPages,
  isScaleChanging,
  isAddTextBoxMode,
  isTextSpanZooming,
  isPdfFile,
  handlers,
  actions,
  setDocumentState,
  isPageTranslated = false,
  isTransforming = false,
  isTranslating = false,
  onRunOcr,
  deletionRectangles,
  showDeletionRectangles,
  onDeleteDeletionRectangle,
  colorToRgba,
  sortedElements,
  getElementsInSelectionPreview,
  selectedFieldId,
  selectedShapeId,
  selectedElementId,
  isEditMode,
  showPaddingIndicator,
  onTextBoxSelect,
  onShapeSelect,
  onImageSelect,
  onUpdateTextBox,
  onUpdateShape,
  onUpdateImage,
  onDeleteTextBox,
  onDeleteShape,
  onDeleteImage,
  isTextSelectionMode,
  selectedTextBoxes,
  autoFocusTextBoxId,
  onAutoFocusComplete,
  isSelectionMode,
  multiSelection,
  currentView,
  onMoveSelection,
  onDeleteSelection,
  onDragSelection,
  onDragStopSelection,
  // New performance optimization props
  onMultiSelectDragStart,
  onMultiSelectDrag,
  onMultiSelectDragStop,
  registerElementRef,
  header,
  templateWidth,
  templateHeight,
  templateScaleFactor,
  onTemplateLoadSuccess,
}) => {
  // Use template dimensions for translated view if available, otherwise use original dimensions
  // In split view, we want to scale the template to match original document size
  const isSplitView = currentView === "split";
  const effectivePageWidth =
    viewType === "translated" && templateWidth
      ? isSplitView && templateScaleFactor
        ? templateWidth * templateScaleFactor
        : templateWidth
      : pageWidth;
  const effectivePageHeight =
    viewType === "translated" && templateHeight
      ? isSplitView && templateScaleFactor
        ? templateHeight * templateScaleFactor
        : templateHeight
      : pageHeight;

  return (
    <DocumentView
      viewType={viewType}
      documentUrl={documentUrl}
      currentPage={currentPage}
      pageWidth={effectivePageWidth}
      pageHeight={effectivePageHeight}
      scale={scale}
      pdfRenderScale={pdfRenderScale}
      isScaleChanging={isScaleChanging}
      isAddTextBoxMode={isAddTextBoxMode}
      isTextSpanZooming={isTextSpanZooming}
      isPdfFile={isPdfFile}
      handlers={handlers}
      actions={actions}
      setDocumentState={setDocumentState}
      header={header}
      onTemplateLoadSuccess={onTemplateLoadSuccess}
    >
      {/* Translated view content - show BlankTranslatedView when no template document URL */}
      {viewType === "translated" &&
        onRunOcr &&
        (!documentUrl || documentUrl === "") && (
          <BlankTranslatedView
            currentPage={currentPage}
            numPages={numPages}
            isPageTranslated={isPageTranslated}
            isTransforming={isTransforming}
            isTranslating={isTranslating}
            onRunOcr={onRunOcr}
          />
        )}

      {/* Elements Layer */}
      <DocumentElementsLayer
        viewType={viewType}
        currentPage={currentPage}
        scale={scale}
        pageWidth={pageWidth}
        pageHeight={pageHeight}
        templateWidth={templateWidth}
        templateHeight={templateHeight}
        templateScaleFactor={templateScaleFactor}
        deletionRectangles={deletionRectangles}
        showDeletionRectangles={showDeletionRectangles}
        onDeleteDeletionRectangle={onDeleteDeletionRectangle}
        colorToRgba={colorToRgba}
        sortedElements={sortedElements}
        getElementsInSelectionPreview={getElementsInSelectionPreview}
        selectedFieldId={selectedFieldId}
        selectedShapeId={selectedShapeId}
        selectedElementId={selectedElementId}
        isEditMode={isEditMode}
        showPaddingIndicator={showPaddingIndicator}
        onTextBoxSelect={onTextBoxSelect}
        onShapeSelect={onShapeSelect}
        onImageSelect={onImageSelect}
        onUpdateTextBox={onUpdateTextBox}
        onUpdateShape={onUpdateShape}
        onUpdateImage={onUpdateImage}
        onDeleteTextBox={onDeleteTextBox}
        onDeleteShape={onDeleteShape}
        onDeleteImage={onDeleteImage}
        isTextSelectionMode={isTextSelectionMode}
        selectedTextBoxes={selectedTextBoxes}
        autoFocusTextBoxId={autoFocusTextBoxId}
        onAutoFocusComplete={onAutoFocusComplete}
        isSelectionMode={isSelectionMode}
        multiSelection={multiSelection}
        currentView={currentView}
        onMoveSelection={onMoveSelection}
        onDeleteSelection={onDeleteSelection}
        onDragSelection={onDragSelection}
        onDragStopSelection={onDragStopSelection}
        // Performance optimization props
        onMultiSelectDragStart={onMultiSelectDragStart}
        onMultiSelectDrag={onMultiSelectDrag}
        onMultiSelectDragStop={onMultiSelectDragStop}
        registerElementRef={registerElementRef}
      />
    </DocumentView>
  );
};

export default DocumentPanel;
