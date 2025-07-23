import React, { memo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move, Plus, Minus } from "lucide-react";
import { Image } from "../../types/pdf-editor.types";

interface ImageElementProps {
  image: Image;
  isSelected: boolean;
  isEditMode: boolean;
  scale: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Image>) => void;
  onDelete: (id: string) => void;
  // Selection preview prop
  isInSelectionPreview?: boolean;
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
    // Selection preview prop
    isInSelectionPreview = false,
  }: ImageElementProps) => {
    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(image.id);
      },
      [image.id, onSelect]
    );

    const handleScaleUp = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const scaleStep = 0.1;
        const newWidth = image.width * (1 + scaleStep);
        const newHeight = image.height * (1 + scaleStep);
        onUpdate(image.id, {
          width: newWidth,
          height: newHeight,
        });
      },
      [image.id, image.width, image.height, onUpdate]
    );

    const handleScaleDown = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        const scaleStep = 0.1;
        const minSize = 20; // Minimum size in pixels
        const newWidth = Math.max(minSize / scale, image.width * (1 - scaleStep));
        const newHeight = Math.max(minSize / scale, image.height * (1 - scaleStep));
        onUpdate(image.id, {
          width: newWidth,
          height: newHeight,
        });
      },
      [image.id, image.width, image.height, scale, onUpdate]
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
        } ${isEditMode ? "edit-mode" : ""} ${
          isInSelectionPreview
            ? "ring-2 ring-blue-400 ring-dashed selection-preview"
            : ""
        }`}
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

          {/* Move handle and scale controls - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <div className="absolute -bottom-7 left-1 transform transition-all duration-300 z-20 flex items-center space-x-1">
              <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                <Move size={10} />
              </div>
              {/* Scale controls */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={handleScaleDown}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200"
                  title="Scale down"
                >
                  <Minus size={10} />
                </button>
                <button
                  onClick={handleScaleUp}
                  className="bg-blue-500 hover:bg-blue-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200"
                  title="Scale up"
                >
                  <Plus size={10} />
                </button>
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
