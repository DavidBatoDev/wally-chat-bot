import React, { memo, useCallback, useState } from "react";
import { Rnd } from "react-rnd";
import { Trash2, Move } from "lucide-react";
import { Shape } from "../../types/pdf-editor.types";

interface LineProps {
  shape: Shape;
  isSelected: boolean;
  isEditMode: boolean;
  scale: number;
  pageWidth: number;
  pageHeight: number;
  onSelect: (id: string) => void;
  onUpdate: (
    id: string,
    updates: Partial<Shape>,
    isOngoingOperation?: boolean
  ) => void;
  onDelete: (id: string) => void;
  isInSelectionPreview?: boolean;
}

export const MemoizedLine = memo(
  ({
    shape,
    isSelected,
    isEditMode,
    scale,
    pageWidth,
    pageHeight,
    onSelect,
    onUpdate,
    onDelete,
    isInSelectionPreview = false,
  }: LineProps) => {
    // For lines, use the line coordinates if available, otherwise fallback to bounding box
    const x1 = (shape.x1 ?? shape.x) * scale;
    const y1 = (shape.y1 ?? shape.y) * scale;
    const x2 = (shape.x2 ?? shape.x + shape.width) * scale;
    const y2 = (shape.y2 ?? shape.y + shape.height) * scale;

    // Calculate bounding box for the container
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);
    const maxX = Math.max(x1, x2);
    const maxY = Math.max(y1, y2);
    const boundingWidth = maxX - minX + 20; // Add padding for easier selection
    const boundingHeight = maxY - minY + 20;

    // Adjust line coordinates relative to bounding box
    const relativeX1 = x1 - minX + 10;
    const relativeY1 = y1 - minY + 10;
    const relativeX2 = x2 - minX + 10;
    const relativeY2 = y2 - minY + 10;

    const handleClick = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        onSelect(shape.id);
      },
      [shape.id, onSelect]
    );

    // Handle anchor point dragging
    const handleAnchorMouseDown = useCallback(
      (e: React.MouseEvent, isStart: boolean) => {
        e.stopPropagation();
        if (!isEditMode || !isSelected) return;

        const startX = e.clientX;
        const startY = e.clientY;
        const originalX1 = shape.x1 ?? shape.x;
        const originalY1 = shape.y1 ?? shape.y;
        const originalX2 = shape.x2 ?? shape.x + shape.width;
        const originalY2 = shape.y2 ?? shape.y + shape.height;

        const handleAnchorMove = (e: MouseEvent) => {
          const deltaX = (e.clientX - startX) / scale;
          const deltaY = (e.clientY - startY) / scale;

          if (isStart) {
            // Constrain start point within page boundaries
            const newX1 = Math.max(0, Math.min(pageWidth, originalX1 + deltaX));
            const newY1 = Math.max(
              0,
              Math.min(pageHeight, originalY1 + deltaY)
            );

            onUpdate(
              shape.id,
              {
                x1: newX1,
                y1: newY1,
              },
              true
            );
          } else {
            // Constrain end point within page boundaries
            const newX2 = Math.max(0, Math.min(pageWidth, originalX2 + deltaX));
            const newY2 = Math.max(
              0,
              Math.min(pageHeight, originalY2 + deltaY)
            );

            onUpdate(
              shape.id,
              {
                x2: newX2,
                y2: newY2,
              },
              true
            );
          }
        };

        const handleAnchorUp = (upEvent: MouseEvent) => {
          // Final update without ongoing flag
          const deltaX = (upEvent.clientX - startX) / scale;
          const deltaY = (upEvent.clientY - startY) / scale;

          if (isStart) {
            // Constrain start point within page boundaries
            const newX1 = Math.max(0, Math.min(pageWidth, originalX1 + deltaX));
            const newY1 = Math.max(
              0,
              Math.min(pageHeight, originalY1 + deltaY)
            );

            onUpdate(
              shape.id,
              {
                x1: newX1,
                y1: newY1,
              },
              false
            );
          } else {
            // Constrain end point within page boundaries
            const newX2 = Math.max(0, Math.min(pageWidth, originalX2 + deltaX));
            const newY2 = Math.max(
              0,
              Math.min(pageHeight, originalY2 + deltaY)
            );

            onUpdate(
              shape.id,
              {
                x2: newX2,
                y2: newY2,
              },
              false
            );
          }

          document.removeEventListener("mousemove", handleAnchorMove);
          document.removeEventListener("mouseup", handleAnchorUp);
        };

        document.addEventListener("mousemove", handleAnchorMove);
        document.addEventListener("mouseup", handleAnchorUp);
      },
      [isEditMode, isSelected, onUpdate, shape, scale, pageWidth, pageHeight]
    );

    return (
      <Rnd
        key={shape.id}
        position={{
          x: minX - 10,
          y: minY - 10,
        }}
        size={{
          width: boundingWidth,
          height: boundingHeight,
        }}
        bounds="parent"
        dragHandleClassName="line-drag-handle"
        enableResizing={false} // Lines don't resize like rectangles
        onDragStop={(e, d) => {
          // Calculate the offset from the original position
          const deltaX = (d.x - (minX - 10)) / scale;
          const deltaY = (d.y - (minY - 10)) / scale;

          // Update both line points
          onUpdate(
            shape.id,
            {
              x1: (shape.x1 ?? shape.x) + deltaX,
              y1: (shape.y1 ?? shape.y) + deltaY,
              x2: (shape.x2 ?? shape.x + shape.width) + deltaX,
              y2: (shape.y2 ?? shape.y + shape.height) + deltaY,
            },
            false
          );
        }}
        className="line-element"
        style={{
          // Remove all visual styling - invisible container
          background: "transparent",
          border: "none",
          outline: "none",
          boxShadow: "none",
        }}
      >
        <div className="w-full h-full relative group">
          {/* Line SVG - this is what handles the click detection */}
          <svg
            width={boundingWidth}
            height={boundingHeight}
            className="absolute inset-0"
            style={{ pointerEvents: "none" }} // Prevent container from intercepting clicks
          >
            {/* Invisible thicker line for easier clicking */}
            <line
              x1={relativeX1}
              y1={relativeY1}
              x2={relativeX2}
              y2={relativeY2}
              stroke="transparent"
              strokeWidth={Math.max(8, shape.borderWidth * scale + 4)} // Minimum 8px click area
              strokeLinecap="round"
              style={{
                pointerEvents: "auto", // Allow clicking on the invisible line
                cursor: "pointer",
              }}
              onClick={handleClick}
            />

            {/* Visible line */}
            <line
              x1={relativeX1}
              y1={relativeY1}
              x2={relativeX2}
              y2={relativeY2}
              stroke={
                isSelected
                  ? "#3b82f6" // Blue when selected
                  : isInSelectionPreview
                  ? "#60a5fa" // Lighter blue for preview
                  : shape.borderColor // Normal color
              }
              strokeWidth={
                isSelected
                  ? Math.max(shape.borderWidth * scale + 1, 2) // Slightly thicker when selected
                  : shape.borderWidth * scale
              }
              strokeLinecap="round"
              style={{
                pointerEvents: "none", // Let the invisible line handle clicks
                filter: isSelected
                  ? "drop-shadow(0 0 3px rgba(59, 130, 246, 0.4))"
                  : "none", // Subtle glow when selected
              }}
            />
          </svg>

          {/* Control Points - only show when selected and in edit mode */}
          {isEditMode && isSelected && (
            <>
              {/* Start anchor */}
              <div
                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-lg cursor-pointer hover:bg-blue-600 transition-colors z-20"
                style={{
                  left: relativeX1 - 6,
                  top: relativeY1 - 6,
                }}
                onMouseDown={(e) => handleAnchorMouseDown(e, true)}
                title="Start point"
              />

              {/* End anchor */}
              <div
                className="absolute w-3 h-3 bg-blue-500 border-2 border-white rounded-full shadow-lg cursor-pointer hover:bg-blue-600 transition-colors z-20"
                style={{
                  left: relativeX2 - 6,
                  top: relativeY2 - 6,
                }}
                onMouseDown={(e) => handleAnchorMouseDown(e, false)}
                title="End point"
              />

              {/* Move handle - positioned at center of line */}
              <div
                className="absolute transform -translate-x-1/2 -translate-y-1/2 transition-all duration-300 z-20 flex items-center space-x-1"
                style={{
                  left: (relativeX1 + relativeX2) / 2,
                  top: (relativeY1 + relativeY2) / 2 + 20, // Slightly below the line center
                }}
              >
                <div className="line-drag-handle bg-gray-500 hover:bg-gray-600 text-white p-1 rounded-md shadow-lg flex items-center justify-center transform hover:scale-105 transition-all duration-200 cursor-move">
                  <Move size={10} />
                </div>
              </div>

              {/* Delete button - positioned at center of line */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(shape.id);
                }}
                className="absolute transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-all duration-200 z-10"
                style={{
                  left: (relativeX1 + relativeX2) / 2,
                  top: (relativeY1 + relativeY2) / 2 - 20, // Slightly above the line center
                }}
                title="Delete line"
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

MemoizedLine.displayName = "MemoizedLine";
