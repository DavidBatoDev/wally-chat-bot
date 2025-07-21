import React from 'react';
import { MemoizedTextBox } from '@/app/pdf-editor/components/elements/TextBox';
import { MemoizedShape } from '@/app/pdf-editor/components/elements/Shape';
import { MemoizedImage } from '@/app/pdf-editor/components/elements/ImageElement';
import { SelectionPreview } from '@/app/pdf-editor/components/elements/SelectionPreview';
import { SelectionRectangle } from '@/app/pdf-editor/components/elements/SelectionRectangle';
import { TextField, Shape as ShapeType, Image as ImageType, DeletionRectangle } from '@/app/pdf-editor/types/pdf-editor.types';

interface DocumentElementsLayerProps {
  viewType: 'original' | 'translated';
  currentPage: number;
  scale: number;
  
  // Deletion rectangles
  deletionRectangles: DeletionRectangle[];
  showDeletionRectangles: boolean;
  onDeleteDeletionRectangle: (id: string) => void;
  colorToRgba: (color: string, opacity: number) => string;

  // Elements
  sortedElements: Array<{ type: 'textbox' | 'shape' | 'image'; element: TextField | ShapeType | ImageType }>;
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
    targetView: 'original' | 'translated' | null;
    selectionBounds: any;
    selectedElements: any[];
    isMovingSelection: boolean;
  };
  currentView: 'original' | 'translated' | 'split';
  onMoveSelection: () => void;
  onDeleteSelection: () => void;
  onDragSelection: (deltaX: number, deltaY: number) => void;
  onDragStopSelection: (deltaX: number, deltaY: number) => void;
}

const DocumentElementsLayer: React.FC<DocumentElementsLayerProps> = ({
  viewType,
  currentPage,
  scale,
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
}) => {
  const elementsInSelectionPreview = getElementsInSelectionPreview();

  const shouldShowSelectionComponents = () => {
    if (!multiSelection.targetView) return false;
    if (currentView === 'split') {
      return multiSelection.targetView === viewType;
    }
    return (
      (currentView === 'original' && multiSelection.targetView === 'original') ||
      (currentView === 'translated' && multiSelection.targetView === 'translated')
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
              left: rect.x * scale,
              top: rect.y * scale,
              width: rect.width * scale,
              height: rect.height * scale,
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
      {sortedElements.map(({ type, element }) => {
        if (type === "textbox") {
          const textBox = element as TextField;
          const isInSelectionPreview = elementsInSelectionPreview.has(textBox.id);
          return (
            <MemoizedTextBox
              key={`${viewType}-text-${textBox.id}`}
              textBox={textBox}
              isSelected={selectedFieldId === textBox.id}
              isEditMode={isEditMode}
              scale={scale}
              showPaddingIndicator={showPaddingIndicator}
              onSelect={onTextBoxSelect}
              onUpdate={onUpdateTextBox}
              onDelete={onDeleteTextBox}
              isTextSelectionMode={isTextSelectionMode}
              isSelectedInTextMode={selectedTextBoxes.textBoxIds.includes(textBox.id)}
              autoFocusId={autoFocusTextBoxId}
              onAutoFocusComplete={onAutoFocusComplete}
              isInSelectionPreview={isInSelectionPreview}
            />
          );
        } else if (type === "shape") {
          const shape = element as ShapeType;
          const isInSelectionPreview = elementsInSelectionPreview.has(shape.id);
          return (
            <MemoizedShape
              key={`${viewType}-shape-${shape.id}`}
              shape={shape}
              isSelected={selectedShapeId === shape.id}
              isEditMode={isEditMode}
              scale={scale}
              onSelect={onShapeSelect}
              onUpdate={onUpdateShape}
              onDelete={onDeleteShape}
              isInSelectionPreview={isInSelectionPreview}
            />
          );
        } else if (type === "image") {
          const image = element as ImageType;
          const isInSelectionPreview = elementsInSelectionPreview.has(image.id);
          return (
            <MemoizedImage
              key={`${viewType}-image-${image.id}`}
              image={image}
              isSelected={selectedElementId === image.id}
              isEditMode={isEditMode}
              scale={scale}
              onSelect={onImageSelect}
              onUpdate={onUpdateImage}
              onDelete={onDeleteImage}
              isInSelectionPreview={isInSelectionPreview}
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
                scale={scale}
              />
            )}

          {/* Selection Rectangle */}
          {multiSelection.selectionBounds &&
            multiSelection.selectedElements.length > 0 && (
              <SelectionRectangle
                bounds={multiSelection.selectionBounds}
                scale={scale}
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
