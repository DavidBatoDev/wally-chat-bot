import React, { memo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move } from "lucide-react";
import { Image } from "../../types/pdf-editor.types";

interface ImageElementProps {
  image: Image;
  isSelected: boolean;
  isEditMode: boolean;
  scale: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Image>) => void;
  onDelete: (id: string) => void;
}

export const MemoizedImage = memo(
  ({
    image,
    isSelected,
    isEditMode,
    scale,
    onSelect,
    onUpdate,
    onDelete,
  }: ImageElementProps) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(image.id);
      },
      [image.id, onSelect]
    );

    return (
      <Rnd
        key={image.id}
        position={{ x: image.x * scale, y: image.y * scale }}
        size={{ width: image.width * scale, height: image.height * scale }}
        bounds="parent"
        dragHandleClassName="drag-handle"
        disableDragging={!isEditMode}
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
          onUpdate(image.id, { x: d.x / scale, y: d.y / scale });
        }}
        onResizeStop={(e, direction, ref, delta, position) => {
          onUpdate(image.id, {
            x: position.x / scale,
            y: position.y / scale,
            width: parseInt(ref.style.width) / scale,
            height: parseInt(ref.style.height) / scale,
          });
        }}
        className={`image-element ${
          isSelected ? "ring-2 ring-blue-500 selected" : ""
        } ${isEditMode ? "edit-mode" : ""}`}
        style={{ transform: "none" }}
        onClick={handleClick}
      >
        <div className="w-full h-full relative group">
          {/* Delete button - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image.id);
              }}
              className="absolute top-0 left-0 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
              title="Delete image"
            >
              <Trash2 size={10} />
            </button>
          )}

          {/* Move handle - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
              <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                <Move size={10} />
              </div>
            </div>
          )}

          {/* Image content */}
          <div
            className="w-full h-full absolute"
            style={{
              transform: image.rotation
                ? `rotate(${image.rotation}deg)`
                : "none",
              transformOrigin: "center center",
            }}
          >
            <img
              src={image.src}
              alt="Document image"
              className="w-full h-full object-cover"
              style={{
                opacity: image.opacity || 1,
                border: image.borderWidth
                  ? `${image.borderWidth * scale}px solid ${
                      image.borderColor || "#000000"
                    }`
                  : "none",
                borderRadius: `${(image.borderRadius || 0) * scale}px`,
              }}
              draggable={false}
            />
          </div>
        </div>
      </Rnd>
    );
  }
);

MemoizedImage.displayName = "MemoizedImage";
