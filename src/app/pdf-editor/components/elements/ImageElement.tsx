import React, { memo, useCallback } from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move } from "lucide-react";
import { Image } from "../../types/pdf-editor.types";
import { permissions } from "../../../pdf-editor-shared/utils/permissions";

interface ImageElementProps {
  image: Image;
  isSelected: boolean;
  isEditMode: boolean;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  onSelect: (id: string) => void;
  onUpdate: (id: string, updates: Partial<Image>) => void;
  onDelete: (id: string) => void;
  // Selection preview prop
  isInSelectionPreview?: boolean;
  // Element index for z-index ordering
  elementIndex?: number;
  // Transform-based drag offset for performance optimization
  dragOffset?: { x: number; y: number } | null;
}

export const MemoizedImage = memo(
  ({
    image,
    isSelected,
    isEditMode,
    scale,
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
  }: ImageElementProps) => {
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
        onSelect(image.id);
      },
      [image.id, onSelect, isSelected]
    );

    // Custom resize handlers
    const handleResizeStart = useCallback(
      (e: React.MouseEvent, direction: string) => {
        e.stopPropagation();
        e.preventDefault(); // Prevent text selection

        // Add class to body to prevent text selection globally
        document.body.classList.add("resizing-element");

        const startX = e.clientX;
        const startY = e.clientY;
        const startWidth = image.width * scale;
        const startHeight = image.height * scale;
        const startXPos = image.x * scale;
        const startYPos = image.y * scale;
        const originalAspectRatio = image.width / image.height;

        const handleMouseMove = (moveEvent: MouseEvent) => {
          const deltaX = (moveEvent.clientX - startX) / scale;
          const deltaY = (moveEvent.clientY - startY) / scale;

          let newWidth = startWidth / scale;
          let newHeight = startHeight / scale;
          let newX = startXPos / scale;
          let newY = startYPos / scale;

          // Handle different resize directions
          switch (direction) {
            case "nw":
              // Corner: proportional resize
              newWidth = Math.max(20, newWidth - deltaX);
              newHeight = newWidth / originalAspectRatio;
              newX = startXPos / scale + deltaX;
              newY = startYPos / scale + (startHeight / scale - newHeight);
              break;
            case "ne":
              // Corner: proportional resize
              newWidth = Math.max(20, newWidth + deltaX);
              newHeight = newWidth / originalAspectRatio;
              newY = startYPos / scale + (startHeight / scale - newHeight);
              break;
            case "sw":
              // Corner: proportional resize
              newWidth = Math.max(20, newWidth - deltaX);
              newHeight = newWidth / originalAspectRatio;
              newX = startXPos / scale + deltaX;
              break;
            case "se":
              // Corner: proportional resize
              newWidth = Math.max(20, newWidth + deltaX);
              newHeight = newWidth / originalAspectRatio;
              break;
            case "n":
              // Edge: only height, maintain width
              newHeight = Math.max(20, newHeight - deltaY);
              newY = startYPos / scale + deltaY;
              break;
            case "s":
              // Edge: only height, maintain width
              newHeight = Math.max(20, newHeight + deltaY);
              break;
            case "e":
              // Edge: only width, maintain height
              newWidth = Math.max(20, newWidth + deltaX);
              break;
            case "w":
              // Edge: only width, maintain height
              newWidth = Math.max(20, newWidth - deltaX);
              newX = startXPos / scale + deltaX;
              break;
          }

          // Apply boundary constraints using the same logic as calculateImageFitAndPosition
          let constrainedX = newX;
          let constrainedY = newY;
          let constrainedWidth = newWidth;
          let constrainedHeight = newHeight;

          // Ensure width and height don't exceed page dimensions
          if (constrainedWidth > pageWidth) {
            constrainedWidth = pageWidth;
          }
          if (constrainedHeight > pageHeight) {
            constrainedHeight = pageHeight;
          }

          // Ensure the image stays within page boundaries
          constrainedX = Math.max(
            0,
            Math.min(constrainedX, pageWidth - constrainedWidth)
          );
          constrainedY = Math.max(
            0,
            Math.min(constrainedY, pageHeight - constrainedHeight)
          );

          // Final boundary check - ensure width and height don't exceed page dimensions
          const finalWidth = Math.min(
            constrainedWidth,
            pageWidth - constrainedX
          );
          const finalHeight = Math.min(
            constrainedHeight,
            pageHeight - constrainedY
          );

          // Ensure minimum size (20px)
          const minSize = 20;
          if (finalWidth < minSize) {
            constrainedX = Math.min(constrainedX, pageWidth - minSize);
          }
          if (finalHeight < minSize) {
            constrainedY = Math.min(constrainedY, pageHeight - minSize);
          }

          onUpdate(image.id, {
            x: constrainedX,
            y: constrainedY,
            width: finalWidth,
            height: finalHeight,
          });
        };

        const handleMouseUp = () => {
          document.removeEventListener("mousemove", handleMouseMove);
          document.removeEventListener("mouseup", handleMouseUp);

          // Remove class from body to restore text selection
          document.body.classList.remove("resizing-element");
        };

        document.addEventListener("mousemove", handleMouseMove);
        document.addEventListener("mouseup", handleMouseUp);
      },
      [image.id, image.width, image.height, image.x, image.y, scale, onUpdate]
    );

    const dragOffsetX = (dragOffset?.x || 0) * scale;
    const dragOffsetY = (dragOffset?.y || 0) * scale;

    return (
      <Rnd
        key={image.id}
        position={{ x: image.x * scale, y: image.y * scale }}
        size={{ width: image.width * scale, height: image.height * scale }}
        bounds="parent"
        dragHandleClassName="drag-handle"
        disableDragging={!isEditMode || !permissions.canEditContent()}
        enableResizing={false}
        onDragStart={(e, d) => {
          document.body.classList.add("dragging-element");
        }}
        onDragStop={(e, d) => {
          // Remove the class after drag with a small delay to prevent immediate selection
          setTimeout(() => {
            document.body.classList.remove("dragging-element");
          }, 50);
          onUpdate(image.id, { x: d.x / scale, y: d.y / scale });
        }}
        className={`image-element select-none ${
          isSelected ? "ring-2 ring-blue-500 selected" : ""
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
          data-element-id={image.id}
          style={{
            transform: dragOffset
              ? dragOffsetX !== 0 || dragOffsetY !== 0
                ? `translate(${dragOffsetX}px, ${dragOffsetY}px)`
                : "none"
              : `translate(var(--drag-offset-x, 0px), var(--drag-offset-y, 0px))`,
            willChange: dragOffset ? "transform" : "auto",
          }}
        >
          {/* Delete button - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete(image.id);
              }}
              className="absolute top-[-15px] left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200"
              style={{ zIndex: 10 }}
              title="Delete image"
            >
              <Trash2 size={10} />
            </button>
          )}

          {/* Move handle - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <div
              className="absolute -bottom-7 left-1 transform transition-all duration-300"
              style={{ zIndex: 20 }}
            >
              <div className="drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                <Move size={10} />
              </div>
            </div>
          )}

          {/* Image content */}
          <div
            className="w-full h-full absolute select-none"
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
              className="w-full h-full object-cover select-none"
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

          {/* Custom resize handles - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <>
              {/* Corner handles */}
              <div
                className="absolute top-0 left-0 w-3 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-nw-resize transform -translate-x-1/2 -translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "nw")}
              />
              <div
                className="absolute top-0 right-0 w-3 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-ne-resize transform translate-x-1/2 -translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "ne")}
              />
              <div
                className="absolute bottom-0 left-0 w-3 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-sw-resize transform -translate-x-1/2 translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "sw")}
              />
              <div
                className="absolute bottom-0 right-0 w-3 h-3 bg-blue-500 border-2 border-white rounded-sm cursor-se-resize transform translate-x-1/2 translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "se")}
              />

              {/* Edge handles */}
              <div
                className="absolute top-0 left-1/2 w-2 h-2 bg-blue-500 border-2 border-white rounded-sm cursor-n-resize transform -translate-x-1/2 -translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "n")}
              />
              <div
                className="absolute bottom-0 left-1/2 w-2 h-2 bg-blue-500 border-2 border-white rounded-sm cursor-s-resize transform -translate-x-1/2 translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "s")}
              />
              <div
                className="absolute left-0 top-1/2 w-2 h-2 bg-blue-500 border-2 border-white rounded-sm cursor-w-resize transform -translate-x-1/2 -translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "w")}
              />
              <div
                className="absolute right-0 top-1/2 w-2 h-2 bg-blue-500 border-2 border-white rounded-sm cursor-e-resize transform translate-x-1/2 -translate-y-1/2 hover:bg-blue-600 transition-colors"
                style={{ zIndex: 30 }}
                onMouseDown={(e) => handleResizeStart(e, "e")}
              />
            </>
          )}
        </div>
      </Rnd>
    );
  }
);

MemoizedImage.displayName = "MemoizedImage";
