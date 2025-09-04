import React, { memo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move } from "lucide-react";
import { Shape } from "../../types/pdf-editor.types";
import { hexToRgba } from "../../utils/colors";
import { MemoizedLine } from "./Line";
import { permissions } from "../../../pdf-editor-shared/utils/permissions";

interface ShapeProps {
  shape: Shape;
  isSelected: boolean;
  isEditMode: boolean;
  pageWidth: number;
  pageHeight: number;
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    updates: Partial<Shape>,
    isOngoingOperation?: boolean
  ) => void;
  onDelete: (id: string) => void;
  // Selection preview prop
  isInSelectionPreview?: boolean;
  // Element index for z-index ordering
  elementIndex?: number;
  // Transform-based drag offset for performance optimization
  dragOffset?: { x: number; y: number } | null;
}

export const MemoizedShape = memo(
  ({
    shape,
    isSelected,
    isEditMode,
    pageWidth,
    pageHeight,
    onSelect,
    onUpdate,
    onDelete,
    // Selection preview prop
    isInSelectionPreview = false,
    // Element index for z-index ordering
    elementIndex = 0,
    // Transform-based drag offset for performance optimization
    dragOffset,
  }: ShapeProps) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        // Don't allow any interaction if user cannot edit content
        if (!permissions.canEditContent()) {
          e.stopPropagation();
          return;
        }

        // Don't allow selection if we're currently dragging AND this is not the selected element
        if (
          document.body.classList.contains("dragging-element") &&
          !isSelected
        ) {
          return;
        }

        e.stopPropagation();
        onSelect(shape.id);
      },
      [shape.id, onSelect, isSelected]
    );

    // Render line shapes using the Line component
    if (shape.type === "line") {
      return (
        <MemoizedLine
          shape={shape}
          isSelected={isSelected}
          isEditMode={isEditMode}
          pageWidth={pageWidth}
          pageHeight={pageHeight}
          onSelect={onSelect}
          onUpdate={onUpdate}
          onDelete={onDelete}
          isInSelectionPreview={isInSelectionPreview}
        />
      );
    }

    const dragOffsetX = dragOffset?.x || 0;
    const dragOffsetY = dragOffset?.y || 0;

    return (
      <Rnd
        key={shape.id}
        position={{ x: shape.x, y: shape.y }}
        size={{ width: shape.width, height: shape.height }}
        bounds="parent"
        dragHandleClassName="drag-handle"
        enableResizing={
          isEditMode && isSelected && permissions.canEditContent()
            ? {
                top: false, // Disable top resize to avoid conflict with delete button
                right: true,
                bottom: true,
                left: false, // Disable left resize to avoid conflict with delete button
                topRight: true,
                bottomRight: true,
                bottomLeft: true,
                topLeft: false, // Disable topLeft resize to avoid conflict with delete button
              }
            : false
        }
        disableDragging={!permissions.canEditContent()}
        onDragStart={(e, d) => {
          document.body.classList.add("dragging-element");
        }}
        onDragStop={(e, d) => {
          // Remove the class after drag with a small delay to prevent immediate selection
          setTimeout(() => {
            document.body.classList.remove("dragging-element");
          }, 50);
          onUpdate(
            shape.id,
            {
              x: d.x,
              y: d.y,
              type: shape.type,
            },
            true
          ); // Mark as ongoing operation
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(
            shape.id,
            {
              x: position.x,
              y: position.y,
              width: parseInt(ref.style.width),
              height: parseInt(ref.style.height),
              type: shape.type,
            },
            false
          ); // Don't mark as ongoing operation - resize is a one-time event
        }}
        className={`shape-element ${
          isSelected ? "ring-2 ring-gray-500 selected" : ""
        } ${isEditMode ? "edit-mode" : ""} ${
          isInSelectionPreview
            ? "ring-2 ring-blue-400 ring-dashed selection-preview"
            : ""
        }`}
        style={{
          zIndex: isSelected ? 9999 : elementIndex,
        }}
        onClick={handleClick}
      >
        <div
          className="w-full h-full relative group"
          data-element-id={shape.id}
          style={{
            transform: dragOffset
              ? dragOffsetX !== 0 || dragOffsetY !== 0
                ? `translate(${dragOffsetX}px, ${dragOffsetY}px)`
                : "none"
              : `translate(var(--drag-offset-x, 0px), var(--drag-offset-y, 0px))`,
            willChange: dragOffset ? "transform" : "auto",
          }}
        >
          {/* Shape Element */}
          <div
            className="w-full h-full"
            style={{
              backgroundColor: hexToRgba(shape.fillColor, shape.fillOpacity),
              border: `${shape.borderWidth}px solid ${shape.borderColor}`,
              borderRadius:
                shape.type === "circle"
                  ? "50%"
                  : shape.borderRadius !== undefined
                  ? `${shape.borderRadius}px`
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
              <div
                className="absolute -bottom-7 left-1 transform transition-all duration-300 flex items-center space-x-1"
                style={{ zIndex: 20 }}
              >
                <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:1-105 transition-all duration-200 cursor-move">
                  <Move size={10} />
                </div>
              </div>

              {/* Delete button */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(shape.id);
                }}
                className="absolute -top-2 -left-2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 shadow-lg cursor-pointer"
                style={{
                  zIndex: 9999,
                  pointerEvents: "auto",
                  position: "absolute",
                  isolation: "isolate",
                }}
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
