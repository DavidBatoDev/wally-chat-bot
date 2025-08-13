import React from "react";
import { MemoizedTextBox } from "@/app/pdf-editor/components/elements/TextBox";
import { MemoizedShape } from "@/app/pdf-editor/components/elements/Shape";
import { MemoizedImage } from "@/app/pdf-editor/components/elements/ImageElement";
import { SelectionPreview } from "@/app/pdf-editor/components/elements/SelectionPreview";
import { SelectionRectangle } from "@/app/pdf-editor/components/elements/SelectionRectangle";
import {
  TextField,
  Shape as ShapeType,
  Image as ImageType,
  DeletionRectangle,
} from "@/app/pdf-editor/types/pdf-editor.types";

interface DocumentElementsLayerProps {
  viewType: "original" | "translated" | "final-layout";
  currentPage: number;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  // Template dimensions for translated view
  templateWidth?: number;
  templateHeight?: number;
  // Template scale factor for split view (to scale template to match original document size)
  templateScaleFactor?: number;

  // Deletion rectangles
  deletionRectangles: DeletionRectangle[];
  showDeletionRectangles: boolean;
  onDeleteDeletionRectangle: (id: string) => void;
  colorToRgba: (color: string, opacity: number) => string;

  // Elements
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
  
  // Multi-selection drag handlers
  onMultiSelectDragStart?: (id: string) => void;
  onMultiSelectDrag?: (id: string, deltaX: number, deltaY: number) => void;
  onMultiSelectDragStop?: (id: string, deltaX: number, deltaY: number) => void;
  
  // Performance optimization: Direct DOM manipulation
  registerElementRef?: (elementId: string, element: HTMLElement | null) => void;
}

const DocumentElementsLayer: React.FC<DocumentElementsLayerProps> = ({
  viewType,
  currentPage,
  scale,
  pageWidth,
  pageHeight,
  templateWidth,
  templateHeight,
  templateScaleFactor,
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

  // For interactive elements in split view, we scale them proportionally with the template
  // This ensures elements appear at the same relative size as the scaled template
  const elementPositioningWidth = effectivePageWidth;
  const elementPositioningHeight = effectivePageHeight;

  const elementsInSelectionPreview = getElementsInSelectionPreview();

  // Calculate the effective scale for components in split view
  // In split view, we need to scale elements by the same factor as the template
  // This ensures elements appear at the same relative size as the scaled template
  const effectiveScale =
    isSplitView && viewType === "translated" && templateScaleFactor
      ? scale * templateScaleFactor
      : scale;

  // Helper function to scale element coordinates and dimensions for split view
  const getScaledElementStyle = (element: any) => {
    return {
      left: element.x * effectiveScale,
      top: element.y * effectiveScale,
      width: element.width * effectiveScale,
      height: element.height * effectiveScale,
    };
  };

  const shouldShowSelectionComponents = () => {
    if (!multiSelection.targetView) return false;
    if (currentView === "split") {
      return multiSelection.targetView === viewType;
    }
    return (
      (currentView === "original" &&
        multiSelection.targetView === "original") ||
      (currentView === "translated" &&
        multiSelection.targetView === "translated") ||
      (currentView === "final-layout" &&
        multiSelection.targetView === "final-layout")
    );
  };

  return (
    <div className="absolute inset-0" style={{ zIndex: 10000 }}>
      {/* Deletion Rectangles */}
      {deletionRectangles
        .filter((rect) => rect.page === currentPage)
        .map((rect) => (
          <div
            key={`${viewType}-del-${rect.id}`}
            className={`absolute ${
              showDeletionRectangles ? "border border-red-400" : ""
            }`}
            style={{
              ...getScaledElementStyle(rect),
              zIndex: showDeletionRectangles ? -10 : -20,
              backgroundColor: rect.background
                ? colorToRgba(rect.background, rect.opacity || 1.0)
                : "white",
            }}
          >
            {showDeletionRectangles && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteDeletionRectangle(rect.id);
                }}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 text-xs shadow-md"
                title="Delete area"
              >
                ×
              </button>
            )}
          </div>
        ))}

      {/* Elements in Layer Order */}
      {sortedElements.map(({ type, element }, index) => {
        if (type === "textbox") {
          const textBox = element as TextField;
          const isInSelectionPreview = elementsInSelectionPreview.has(
            textBox.id
          );
          const isMultiSelected = multiSelection.selectedElements.some(
            (el) => el.id === textBox.id
          );
          const dragOffset = multiSelection.dragOffsets?.[textBox.id] || null;
          
          return (
            <MemoizedTextBox
              key={`${viewType}-text-${textBox.id}`}
              textBox={textBox}
              isSelected={selectedFieldId === textBox.id}
              isEditMode={isEditMode}
              scale={effectiveScale}
              showPaddingIndicator={showPaddingIndicator}
              onSelect={onTextBoxSelect}
              onUpdate={onUpdateTextBox}
              onDelete={onDeleteTextBox}
              isTextSelectionMode={isTextSelectionMode}
              isSelectedInTextMode={selectedTextBoxes.textBoxIds.includes(
                textBox.id
              )}
              autoFocusId={autoFocusTextBoxId}
              onAutoFocusComplete={onAutoFocusComplete}
              isInSelectionPreview={isInSelectionPreview}
              elementIndex={index}
              // Multi-selection and performance props
              isMultiSelected={isMultiSelected}
              selectedElementIds={multiSelection.selectedElements.map(el => el.id)}
              onMultiSelectDragStart={onMultiSelectDragStart}
              onMultiSelectDrag={onMultiSelectDrag}
              onMultiSelectDragStop={onMultiSelectDragStop}
              dragOffset={dragOffset}
              registerElementRef={registerElementRef}
            />
          );
        } else if (type === "shape") {
          const shape = element as ShapeType;
          const isInSelectionPreview = elementsInSelectionPreview.has(shape.id);
          const isMultiSelected = multiSelection.selectedElements.some(
            (el) => el.id === shape.id
          );
          const dragOffset = multiSelection.dragOffsets?.[shape.id] || null;
          
          return (
            <MemoizedShape
              key={`${viewType}-shape-${shape.id}`}
              shape={shape}
              isSelected={selectedShapeId === shape.id}
              isEditMode={isEditMode}
              scale={effectiveScale}
              pageWidth={elementPositioningWidth}
              pageHeight={elementPositioningHeight}
              onSelect={onShapeSelect}
              onUpdate={onUpdateShape}
              onDelete={onDeleteShape}
              isInSelectionPreview={isInSelectionPreview}
              elementIndex={index}
              // Multi-selection and performance props
              isMultiSelected={isMultiSelected}
              selectedElementIds={multiSelection.selectedElements.map(el => el.id)}
              onMultiSelectDragStart={onMultiSelectDragStart}
              onMultiSelectDrag={onMultiSelectDrag}
              onMultiSelectDragStop={onMultiSelectDragStop}
              dragOffset={dragOffset}
              registerElementRef={registerElementRef}
            />
          );
        } else if (type === "image") {
          const image = element as ImageType;
          const isInSelectionPreview = elementsInSelectionPreview.has(image.id);
          const isMultiSelected = multiSelection.selectedElements.some(
            (el) => el.id === image.id
          );
          const dragOffset = multiSelection.dragOffsets?.[image.id] || null;
          
          return (
            <MemoizedImage
              key={`${viewType}-image-${image.id}`}
              image={image}
              isSelected={selectedElementId === image.id}
              isEditMode={isEditMode}
              scale={effectiveScale}
              pageWidth={elementPositioningWidth}
              pageHeight={elementPositioningHeight}
              onSelect={onImageSelect}
              onUpdate={onUpdateImage}
              onDelete={onDeleteImage}
              isInSelectionPreview={isInSelectionPreview}
              elementIndex={index}
              // Multi-selection and performance props
              isMultiSelected={isMultiSelected}
              selectedElementIds={multiSelection.selectedElements.map(el => el.id)}
              onMultiSelectDragStart={onMultiSelectDragStart}
              onMultiSelectDrag={onMultiSelectDrag}
              onMultiSelectDragStop={onMultiSelectDragStop}
              dragOffset={dragOffset}
              registerElementRef={registerElementRef}
            />
          );
        }
        return null;
      })}

      {/* Selection Components */}
      {isSelectionMode && shouldShowSelectionComponents() && (
        <>
          {/* Selection Preview */}
          {multiSelection.isDrawingSelection &&
            multiSelection.selectionStart &&
            multiSelection.selectionEnd && (
              <SelectionPreview
                start={multiSelection.selectionStart}
                end={multiSelection.selectionEnd}
                scale={effectiveScale}
              />
            )}

          {/* Selection Rectangle */}
          {multiSelection.selectionBounds &&
            multiSelection.selectedElements.length > 0 && (
              <SelectionRectangle
                bounds={multiSelection.selectionBounds}
                scale={effectiveScale}
                onMove={onMoveSelection}
                onDelete={onDeleteSelection}
                isMoving={multiSelection.isMovingSelection}
                onDragSelection={onDragSelection}
                onDragStopSelection={onDragStopSelection}
              />
            )}
        </>
      )}
    </div>
  );
};

export default DocumentElementsLayer;
