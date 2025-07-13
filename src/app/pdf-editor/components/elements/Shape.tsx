import React, { memo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move } from "lucide-react";
import { Shape } from "../../types/pdf-editor.types";
import { hexToRgba } from "../../utils/colors";

interface ShapeProps {
  shape: Shape;
  isSelected: boolean;
  isEditMode: boolean;
  scale: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Shape>) => void;
  onDelete: (id: string) => void;
  // Selection preview prop
  isInSelectionPreview?: boolean;
}

export const MemoizedShape = memo(
  ({
    shape,
    isSelected,
    isEditMode,
    scale,
    onSelect,
    onUpdate,
    onDelete,
    // Selection preview prop
    isInSelectionPreview = false,
  }: ShapeProps) => {
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
        } ${isEditMode ? "edit-mode" : ""} ${
          isInSelectionPreview ? "ring-2 ring-blue-400 ring-dashed selection-preview" : ""
        }`}
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
